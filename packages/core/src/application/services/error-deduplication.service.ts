import { Inject, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { toPrismaJsonObject } from '../../database/prisma-json';
import {
  DEDUP_STORE,
  INSPECTOR_CORE_OPTIONS,
} from '../../config/inspector-core.constants';
import { type InspectorCoreModuleOptions } from '../../config/inspector-core.options';
import { type DedupStore } from '../../infrastructure/redis/dedup-store';

interface ErrorFingerprint {
  provider: string;
  errorCode: string;
  errorType: string;
  errorMessage: string;
  requestId: string | undefined;
  statusCode: number;
  endpoint: string;
  latency: number;
  metadata: Record<string, unknown>;
}

interface DeduplicationResult {
  isDuplicate: boolean;
  id?: number;
}

@Injectable()
export class ErrorDeduplicationService {
  constructor(
    @Inject(DEDUP_STORE) private readonly dedupStore: DedupStore,

    private readonly prisma: PrismaService,

    @Inject(INSPECTOR_CORE_OPTIONS)
    private readonly options: InspectorCoreModuleOptions,
  ) { }

  async checkAndRegisterError(
    errorFingerprint: ErrorFingerprint,
  ): Promise<DeduplicationResult> {
    const dedupWindowSeconds = this.options.errorDedupWindowSeconds ?? 300;
    const key = this.buildRedisKey(errorFingerprint);
    const cached = await this.dedupStore.get(key);
    const now = new Date();

    if (cached) {
      const existing = JSON.parse(cached) as {
        id: number;
        count: number;
        firstSeenAt: string;
      };
      const nextCount = existing.count + 1;
      let recordId = existing.id;

      if (this.prisma.isEnabled) {
        if (recordId === 0) {
          const created = await this.createErrorRecord(
            errorFingerprint,
            nextCount,
          );
          recordId = created.id;
        } else {
          await this.incrementErrorCount(recordId);
        }
      }

      await this.dedupStore.setex(
        key,
        dedupWindowSeconds,
        JSON.stringify({
          id: recordId,
          count: nextCount,
          firstSeenAt: existing.firstSeenAt,
          lastSeenAt: now,
        }),
      );

      return { isDuplicate: true, id: recordId };
    }

    const existingInDb = await this.findRecentMatchingErrorInDb(
      errorFingerprint,
      dedupWindowSeconds,
      now,
    );

    if (existingInDb) {
      const nextCount = existingInDb.count + 1;

      await this.incrementErrorCount(existingInDb.id);

      await this.dedupStore.setex(
        key,
        dedupWindowSeconds,
        JSON.stringify({
          id: existingInDb.id,
          count: nextCount,
          firstSeenAt: existingInDb.firstSeenAt.toISOString(),
          lastSeenAt: now.toISOString(),
        }),
      );

      return { isDuplicate: true, id: existingInDb.id };
    }

    const created = (await this.createErrorRecord(errorFingerprint)) as {
      id: number;
    };

    await this.dedupStore.setex(
      key,
      dedupWindowSeconds,
      JSON.stringify({
        id: created.id,
        count: 1,
        firstSeenAt: now.toISOString(),
        lastSeenAt: now.toISOString(),
      }),
    );

    return { isDuplicate: false, id: created.id };
  }

  private buildRedisKey(fp: ErrorFingerprint): string {
    return `error:${fp.provider}:${fp.errorCode}:${fp.endpoint}:${fp.statusCode}`;
  }

  /**
   * When dedup storage changes (in-memory vs Redis) or the process restarts, the
   * cache is empty but the DB may already have a row for this fingerprint.
   */
  private async findRecentMatchingErrorInDb(
    fp: ErrorFingerprint,
    dedupWindowSeconds: number,
    now: Date,
  ): Promise<{ id: number; count: number; firstSeenAt: Date } | null> {
    if (!this.prisma.isEnabled) {
      return null;
    }

    const windowStart = new Date(now.getTime() - dedupWindowSeconds * 1000);

    const row = await this.prisma.db.externalError.findFirst({
      where: {
        provider: fp.provider.toUpperCase(),
        errorCode: fp.errorCode,
        endpoint: fp.endpoint,
        statusCode: fp.statusCode,
        timestamp: { gte: windowStart },
      },
      orderBy: { timestamp: 'desc' },
      select: { id: true, count: true, timestamp: true },
    });

    if (!row) {
      return null;
    }

    return {
      id: row.id,
      count: row.count,
      firstSeenAt: row.timestamp,
    };
  }

  private async incrementErrorCount(id: number): Promise<void> {
    if (!this.prisma.isEnabled) {
      return;
    }

    await this.prisma.db.externalError.update({
      where: { id },
      data: { count: { increment: 1 } },
    });
  }

  private async createErrorRecord(
    fp: ErrorFingerprint,
    initialCount = 1,
  ): Promise<{ id: number }> {
    if (!this.prisma.isEnabled) {
      return { id: 0 };
    }

    return this.prisma.db.externalError.create({
      data: {
        provider: fp.provider?.toUpperCase(),
        errorCode: fp.errorCode,
        errorType: fp.errorType,
        errorMessage: fp.errorMessage,
        requestId: fp.requestId,
        statusCode: fp.statusCode,
        endpoint: fp.endpoint,
        latency: fp.latency,
        count: initialCount,
        metadata: toPrismaJsonObject(fp.metadata) as Prisma.InputJsonObject,
      },
    });
  }
}
