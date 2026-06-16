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
import {
  type ErrorIncidentResult,
  type ErrorIncidentSummary,
  type IncidentSeverity,
} from '../../domain/incidents/incident.types';
import {
  resolveIncidentSeverity,
  resolveIncidentSeverityThresholds,
} from '../../domain/incidents/incident-severity.resolver';

type CachedErrorIncident = {
  id: number;
  count: number;
  severity: IncidentSeverity;
  firstSeenAt: string;
  priorIncidentCount: number;
};

type IncidentWindow = {
  count: number;
  firstSeenAt: Date;
  lastSeenAt: Date;
  priorIncidentCount: number;
};

@Injectable()
export class ErrorIncidentService {
  constructor(
    @Inject(DEDUP_STORE) private readonly dedupStore: DedupStore,
    private readonly prisma: PrismaService,
    @Inject(INSPECTOR_CORE_OPTIONS)
    private readonly options: InspectorCoreModuleOptions,
  ) {}

  async checkAndRegisterIncident(
    summary: ErrorIncidentSummary,
  ): Promise<ErrorIncidentResult> {
    const dedupWindowSeconds = this.options.errorDedupWindowSeconds ?? 300;
    const key = this.buildRedisKey(summary);
    const cached = await this.dedupStore.get(key);
    const now = new Date();

    if (cached) {
      return this.handleCachedIncident(
        summary,
        JSON.parse(cached) as CachedErrorIncident,
        key,
        dedupWindowSeconds,
        now,
      );
    }

    const existingInDb = await this.findRecentMatchingIncidentInDb(
      summary,
      dedupWindowSeconds,
      now,
    );

    if (existingInDb) {
      const nextCount = existingInDb.count + 1;
      const priorIncidentCount = await this.countPriorIncidents(
        summary,
        new Date(now.getTime() - dedupWindowSeconds * 1000),
      );
      const severity = this.resolveSeverity(summary, {
        count: nextCount,
        firstSeenAt: existingInDb.firstSeenAt,
        lastSeenAt: now,
        priorIncidentCount,
      });

      await this.updateIncidentRecord(existingInDb.id, summary, severity);

      await this.dedupStore.setex(
        key,
        dedupWindowSeconds,
        JSON.stringify({
          id: existingInDb.id,
          count: nextCount,
          severity,
          firstSeenAt: existingInDb.firstSeenAt.toISOString(),
          priorIncidentCount,
        }),
      );

      return this.buildDuplicateResult(
        existingInDb.id,
        nextCount,
        existingInDb.severity,
        severity,
      );
    }

    const priorIncidentCount = await this.countPriorIncidents(
      summary,
      new Date(now.getTime() - dedupWindowSeconds * 1000),
    );
    const severity = this.resolveSeverity(summary, {
      count: 1,
      firstSeenAt: now,
      lastSeenAt: now,
      priorIncidentCount,
    });
    const created = await this.createIncidentRecord(summary, 1, severity);

    await this.dedupStore.setex(
      key,
      dedupWindowSeconds,
      JSON.stringify({
        id: created.id,
        count: 1,
        severity,
        firstSeenAt: now.toISOString(),
        priorIncidentCount,
      }),
    );

    return {
      isDuplicate: false,
      id: created.id,
      count: 1,
      severity,
    };
  }

  private async handleCachedIncident(
    summary: ErrorIncidentSummary,
    existing: CachedErrorIncident,
    key: string,
    dedupWindowSeconds: number,
    now: Date,
  ): Promise<ErrorIncidentResult> {
    const nextCount = existing.count + 1;
    const firstSeenAt = new Date(existing.firstSeenAt);
    const severity = this.resolveSeverity(summary, {
      count: nextCount,
      firstSeenAt,
      lastSeenAt: now,
      priorIncidentCount: existing.priorIncidentCount ?? 0,
    });
    let recordId = existing.id;

    if (this.prisma.isEnabled) {
      if (recordId === 0) {
        const created = await this.createIncidentRecord(
          summary,
          nextCount,
          severity,
        );
        recordId = created.id;
      } else {
        await this.updateIncidentRecord(recordId, summary, severity);
      }
    }

    await this.dedupStore.setex(
      key,
      dedupWindowSeconds,
      JSON.stringify({
        id: recordId,
        count: nextCount,
        severity,
        firstSeenAt: existing.firstSeenAt,
        priorIncidentCount: existing.priorIncidentCount ?? 0,
      }),
    );

    return this.buildDuplicateResult(
      recordId,
      nextCount,
      existing.severity,
      severity,
    );
  }

  private buildDuplicateResult(
    id: number,
    count: number,
    previousSeverity: IncidentSeverity,
    severity: IncidentSeverity,
  ): ErrorIncidentResult {
    return {
      isDuplicate: true,
      id,
      count,
      severity,
      previousSeverity,
    };
  }

  private resolveSeverity(
    summary: ErrorIncidentSummary,
    window: IncidentWindow,
  ): IncidentSeverity {
    const dedupWindowSeconds = this.options.errorDedupWindowSeconds ?? 300;

    return resolveIncidentSeverity(
      {
        baseSeverity: summary.severity,
        count: window.count,
        firstSeenAt: window.firstSeenAt,
        lastSeenAt: window.lastSeenAt,
        windowSeconds: dedupWindowSeconds,
        provider: summary.provider,
        priorIncidentCount: window.priorIncidentCount,
      },
      resolveIncidentSeverityThresholds(this.options.errorSeverityThresholds),
    );
  }

  private buildRedisKey(summary: ErrorIncidentSummary): string {
    return `error:${summary.provider}:${summary.errorCode}:${summary.errorType}:${summary.endpoint}:${summary.statusCode}`;
  }

  private buildFingerprintWhere(
    summary: ErrorIncidentSummary,
  ): Prisma.ExternalErrorWhereInput {
    return {
      provider: summary.provider.toUpperCase(),
      errorCode: summary.errorCode,
      errorType: summary.errorType,
      endpoint: summary.endpoint,
      statusCode: summary.statusCode,
    };
  }

  private async countPriorIncidents(
    summary: ErrorIncidentSummary,
    windowStart: Date,
  ): Promise<number> {
    if (!this.prisma.isEnabled) {
      return 0;
    }

    return this.prisma.countPriorExternalErrorIncidents(
      this.buildFingerprintWhere(summary),
      windowStart,
    );
  }

  private async findRecentMatchingIncidentInDb(
    summary: ErrorIncidentSummary,
    dedupWindowSeconds: number,
    now: Date,
  ): Promise<{
    id: number;
    count: number;
    firstSeenAt: Date;
    severity: IncidentSeverity;
  } | null> {
    if (!this.prisma.isEnabled) {
      return null;
    }

    const windowStart = new Date(now.getTime() - dedupWindowSeconds * 1000);

    const row = await this.prisma.findRecentExternalError(
      this.buildFingerprintWhere(summary),
      windowStart,
    );

    if (!row) {
      return null;
    }

    return {
      id: row.id,
      count: row.count,
      firstSeenAt: row.timestamp,
      severity: row.severity as IncidentSeverity,
    };
  }

  private async updateIncidentRecord(
    id: number,
    summary: ErrorIncidentSummary,
    severity: IncidentSeverity,
  ): Promise<void> {
    if (!this.prisma.isEnabled) {
      return;
    }

    await this.prisma.incrementExternalError(id, {
      count: { increment: 1 },
      lastSeenAt: new Date(),
      severity,
      errorMessage: summary.errorMessage,
      requestId: summary.requestId,
      latency: summary.latency ?? 0,
    });
  }

  private async createIncidentRecord(
    summary: ErrorIncidentSummary,
    initialCount: number,
    severity: IncidentSeverity,
  ): Promise<{ id: number }> {
    if (!this.prisma.isEnabled) {
      return { id: 0 };
    }

    const now = new Date();

    return this.prisma.createExternalError({
      provider: summary.provider.toUpperCase(),
      errorCode: summary.errorCode,
      errorType: summary.errorType,
      errorMessage: summary.errorMessage,
      requestId: summary.requestId,
      statusCode: summary.statusCode,
      endpoint: summary.endpoint,
      latency: summary.latency ?? 0,
      severity,
      count: initialCount,
      timestamp: now,
      lastSeenAt: now,
      metadata: toPrismaJsonObject(summary.metadata) as Prisma.InputJsonObject,
    });
  }
}
