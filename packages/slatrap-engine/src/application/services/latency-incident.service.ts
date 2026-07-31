import { Inject, Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { toPrismaJsonObject } from '../../database/prisma-json';
import {
  DEDUP_STORE,
  INSPECTOR_CORE_OPTIONS,
} from '../../config/inspector-core.constants';
import { type InspectorCoreModuleOptions } from '../../config/inspector-core.options';
import { type DedupStore } from '../../infrastructure/redis/dedup-store';
import {
  registerDedupedIncident,
  type DedupBranchOutcome,
} from './register-deduped-incident';

export type LatencyIncidentInput = {
  provider: string;
  endpoint?: string;
  latency: number;
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

type CachedLatencyIncident = {
  id: number;
  count: number;
  maxLatencyMs: number;
  firstSeenAt: string;
  lastSeenAt?: string;
};

type DbLatencyIncident = {
  id: number;
  count: number;
  maxLatencyMs: number;
  firstSeenAt: Date;
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
    if (input.latency < input.thresholdMs) {
      return { isIncident: false, isDuplicate: false };
    }

    const windowSeconds =
      this.options.latencyIncidentWindowSeconds ??
      this.options.errorDedupWindowSeconds ??
      300;

    return registerDedupedIncident<
      LatencyIncidentResult,
      CachedLatencyIncident,
      DbLatencyIncident
    >({
      key: this.buildRedisKey(input),
      windowSeconds,
      dedupStore: this.dedupStore,
      parseCache: (raw) => JSON.parse(raw) as CachedLatencyIncident,
      onCacheHit: (cached, now) => this.handleCachedIncident(input, cached, now),
      findInDb: (now) =>
        this.findRecentMatchingIncidentInDb(input, windowSeconds, now),
      onDbHit: (existing, now) => this.handleDbHit(input, existing, now),
      onCreate: (now) => this.handleCreate(input, now),
    });
  }

  private async handleCachedIncident(
    input: LatencyIncidentInput,
    existing: CachedLatencyIncident,
    now: Date,
  ): Promise<DedupBranchOutcome<LatencyIncidentResult, CachedLatencyIncident>> {
    const nextCount = existing.count + 1;
    const maxLatencyMs = Math.max(existing.maxLatencyMs, input.latency);
    let recordId = existing.id;

    if (this.prisma.isEnabled) {
      if (recordId === 0) {
        const created = await this.createIncidentRecord(input, nextCount);
        recordId = created.id;
      } else {
        await this.incrementIncident(recordId, maxLatencyMs);
      }
    }

    return {
      result: {
        isIncident: true,
        isDuplicate: true,
        id: recordId,
        count: nextCount,
      },
      cacheValue: {
        id: recordId,
        count: nextCount,
        maxLatencyMs,
        firstSeenAt: existing.firstSeenAt,
        lastSeenAt: now.toISOString(),
      },
    };
  }

  private async handleDbHit(
    input: LatencyIncidentInput,
    existing: DbLatencyIncident,
    now: Date,
  ): Promise<DedupBranchOutcome<LatencyIncidentResult, CachedLatencyIncident>> {
    const nextCount = existing.count + 1;
    const maxLatencyMs = Math.max(existing.maxLatencyMs, input.latency);

    await this.incrementIncident(existing.id, maxLatencyMs);

    return {
      result: {
        isIncident: true,
        isDuplicate: true,
        id: existing.id,
        count: nextCount,
      },
      cacheValue: {
        id: existing.id,
        count: nextCount,
        maxLatencyMs,
        firstSeenAt: existing.firstSeenAt.toISOString(),
        lastSeenAt: now.toISOString(),
      },
    };
  }

  private async handleCreate(
    input: LatencyIncidentInput,
    now: Date,
  ): Promise<DedupBranchOutcome<LatencyIncidentResult, CachedLatencyIncident>> {
    const created = await this.createIncidentRecord(input, 1);

    return {
      result: {
        isIncident: true,
        isDuplicate: false,
        id: created.id,
        count: 1,
      },
      cacheValue: {
        id: created.id,
        count: 1,
        maxLatencyMs: input.latency,
        firstSeenAt: now.toISOString(),
        lastSeenAt: now.toISOString(),
      },
    };
  }

  private buildRedisKey(input: LatencyIncidentInput): string {
    return `latency:${input.provider}:${input.endpoint ?? 'unknown'}:${input.thresholdMs}`;
  }

  private async findRecentMatchingIncidentInDb(
    input: LatencyIncidentInput,
    windowSeconds: number,
    now: Date,
  ): Promise<DbLatencyIncident | null> {
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
      observedMs: input.latency,
      maxLatencyMs: input.latency,
      count: initialCount,
      metadata: toPrismaJsonObject({
        success: input.success,
        statusCode: input.statusCode ?? undefined,
        ...input.metadata,
      }),
    });
  }
}
