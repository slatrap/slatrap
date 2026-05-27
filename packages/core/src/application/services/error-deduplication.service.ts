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
      await this.incrementErrorCount(existing.id);

      await this.redis.setex(
        key,
        redisDedupWindowSeconds,
        JSON.stringify({
          id: existing.id,
          count: existing.count + 1,
          firstSeenAt: existing.firstSeenAt,
          lastSeenAt: now,
        }),
      );

      return { isDuplicate: true, id: existing.id };
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
    await this.prisma.externalError.update({
      where: { id },
      data: { count: { increment: 1 } },
    });
  }

  private async createErrorRecord(fp: ErrorFingerprint) {
    return this.prisma.externalError.create({
      data: {
        provider: fp.provider?.toUpperCase(),
        errorCode: fp.errorCode,
        errorType: fp.errorType,
        errorMessage: fp.errorMessage,
        requestId: fp.requestId,
        statusCode: fp.statusCode,
        endpoint: fp.endpoint,
        latency: fp.latency,
        count: 1,
        metadata: toJsonObject(fp.metadata),
      },
    });
  }
}
