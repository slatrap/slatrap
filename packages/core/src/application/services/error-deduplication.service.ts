import { Inject, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { type RedisClient } from 'bullmq';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../database/prisma.service';

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

function toJsonObject(
  metadata: Record<string, unknown>,
): Prisma.InputJsonObject {
  return Object.fromEntries(
    Object.entries(metadata).filter(([, value]) => value !== undefined),
  ) as Prisma.InputJsonObject;
}

@Injectable()
export class ErrorDeduplicationService {
  constructor(
    @Inject('REDIS_CLIENT') private readonly redis: RedisClient,
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {}

  async checkAndRegisterError(
    errorFingerprint: ErrorFingerprint,
  ): Promise<DeduplicationResult> {
    const redisDedupWindowSeconds =
      this.configService.get<string>('ERROR_DEDUP_WINDOW_SECONDS') ?? 300;
    const key = this.buildRedisKey(errorFingerprint);
    const cached = await this.redis.get(key);
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
          // Errors seen before DATABASE_URL was set only existed in Redis (id: 0).
          // Backfill one DB row with the total occurrence count so far.
          const created = await this.createErrorRecord(
            errorFingerprint,
            nextCount,
          );
          recordId = created.id;
        } else {
          await this.incrementErrorCount(recordId);
        }
      }

      await this.redis.setex(
        key,
        redisDedupWindowSeconds,
        JSON.stringify({
          id: recordId,
          count: nextCount,
          firstSeenAt: existing.firstSeenAt,
          lastSeenAt: now,
        }),
      );

      return { isDuplicate: true, id: recordId };
    }

    const created = (await this.createErrorRecord(errorFingerprint)) as {
      id: number;
    };

    await this.redis.setex(
      key,
      redisDedupWindowSeconds,
      JSON.stringify({
        id: created.id,
        count: 1,
        firstSeenAt: now,
        lastSeenAt: now,
      }),
    );

    return { isDuplicate: false, id: created.id };
  }

  private buildRedisKey(fp: ErrorFingerprint): string {
    return `error:${fp.provider}:${fp.errorCode}:${fp.endpoint}:${fp.statusCode}`;
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
        metadata: toJsonObject(fp.metadata),
      },
    });
  }
}
