import { Inject, Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { toPrismaJsonObject } from '../../database/prisma-json';
import {
  DEDUP_STORE,
  INSPECTOR_CORE_OPTIONS,
} from '../../config/inspector-core.constants';
import { type InspectorCoreModuleOptions } from '../../config/inspector-core.options';
import { type DedupStore } from '../../infrastructure/redis/dedup-store';

export type LatencyIncidentInput = {
  provider: string;
  endpoint?: string;
  latencyMs: number;
  thresholdMs: number;
  success: boolean;
  statusCode?: number | null;
  metadata?: Record<string, unknown>;
};

export type LatencyIncidentResult = {
  isIncident: boolean;
  isDuplicate: boolean;
  id?: number;
  count?: number;
};

@Injectable()
export class LatencyIncidentService {
  constructor(
    @Inject(DEDUP_STORE) private readonly dedupStore: DedupStore,
    private readonly prisma: PrismaService,
    @Inject(INSPECTOR_CORE_OPTIONS)
    private readonly options: InspectorCoreModuleOptions,
  ) {}

  async checkAndRegisterIncident(
    input: LatencyIncidentInput,
  ): Promise<LatencyIncidentResult> {
    if (input.latencyMs < input.thresholdMs) {
      return { isIncident: false, isDuplicate: false };
    }

    const windowSeconds =
      this.options.latencyIncidentWindowSeconds ??
      this.options.errorDedupWindowSeconds ??
      300;
    const key = this.buildRedisKey(input);
    const cached = await this.dedupStore.get(key);
    const now = new Date();

    if (cached) {
      const existing = JSON.parse(cached) as {
        id: number;
        count: number;
        maxLatencyMs: number;
        firstSeenAt: string;
      };
      const nextCount = existing.count + 1;
      const maxLatencyMs = Math.max(existing.maxLatencyMs, input.latencyMs);
      let recordId = existing.id;

      if (this.prisma.isEnabled) {
        if (recordId === 0) {
          const created = await this.createIncidentRecord(input, nextCount);
          recordId = created.id;
        } else {
          await this.incrementIncident(recordId, maxLatencyMs);
        }
      }

      await this.dedupStore.setex(
        key,
        windowSeconds,
        JSON.stringify({
          id: recordId,
          count: nextCount,
          maxLatencyMs,
          firstSeenAt: existing.firstSeenAt,
          lastSeenAt: now.toISOString(),
        }),
      );

      return {
        isIncident: true,
        isDuplicate: true,
        id: recordId,
        count: nextCount,
      };
    }

    const existingInDb = await this.findRecentMatchingIncidentInDb(
      input,
      windowSeconds,
      now,
    );

    if (existingInDb) {
      const nextCount = existingInDb.count + 1;
      const maxLatencyMs = Math.max(existingInDb.maxLatencyMs, input.latencyMs);

      await this.incrementIncident(existingInDb.id, maxLatencyMs);
      await this.dedupStore.setex(
        key,
        windowSeconds,
        JSON.stringify({
          id: existingInDb.id,
          count: nextCount,
          maxLatencyMs,
          firstSeenAt: existingInDb.firstSeenAt.toISOString(),
          lastSeenAt: now.toISOString(),
        }),
      );

      return {
        isIncident: true,
        isDuplicate: true,
        id: existingInDb.id,
        count: nextCount,
      };
    }

    const created = await this.createIncidentRecord(input, 1);

    await this.dedupStore.setex(
      key,
      windowSeconds,
      JSON.stringify({
        id: created.id,
        count: 1,
        maxLatencyMs: input.latencyMs,
        firstSeenAt: now.toISOString(),
        lastSeenAt: now.toISOString(),
      }),
    );

    return {
      isIncident: true,
      isDuplicate: false,
      id: created.id,
      count: 1,
    };
  }

  private buildRedisKey(input: LatencyIncidentInput): string {
    return `latency:${input.provider}:${input.endpoint ?? 'unknown'}:${input.thresholdMs}`;
  }

  private async findRecentMatchingIncidentInDb(
    input: LatencyIncidentInput,
    windowSeconds: number,
    now: Date,
  ): Promise<{
    id: number;
    count: number;
    maxLatencyMs: number;
    firstSeenAt: Date;
  } | null> {
    if (!this.prisma.isEnabled) {
      return null;
    }

    const windowStart = new Date(now.getTime() - windowSeconds * 1000);

    const row = await this.prisma.findRecentLatencyIncident(
      {
        provider: input.provider.toUpperCase(),
        endpoint: input.endpoint,
        thresholdMs: input.thresholdMs,
      },
      windowStart,
    );

    if (!row) {
      return null;
    }

    return {
      id: row.id,
      count: row.count,
      maxLatencyMs: row.maxLatencyMs,
      firstSeenAt: row.timestamp,
    };
  }

  private async incrementIncident(
    id: number,
    maxLatencyMs: number,
  ): Promise<void> {
    if (!this.prisma.isEnabled) {
      return;
    }

    await this.prisma.incrementLatencyIncident(id, {
      count: { increment: 1 },
      maxLatencyMs,
      observedMs: maxLatencyMs,
    });
  }

  private async createIncidentRecord(
    input: LatencyIncidentInput,
    initialCount: number,
  ): Promise<{ id: number }> {
    if (!this.prisma.isEnabled) {
      return { id: 0 };
    }

    return this.prisma.createLatencyIncident({
      provider: input.provider.toUpperCase(),
      endpoint: input.endpoint,
      thresholdMs: input.thresholdMs,
      observedMs: input.latencyMs,
      maxLatencyMs: input.latencyMs,
      count: initialCount,
      metadata: toPrismaJsonObject({
        success: input.success,
        statusCode: input.statusCode ?? undefined,
        ...input.metadata,
      }),
    });
  }
}
