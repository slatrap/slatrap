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
  type ErrorIncidentResult,
  type ErrorIncidentSummary,
  type IncidentSeverity,
} from '../../domain/incidents/incident.types';
import {
  resolveIncidentSeverity,
  resolveIncidentSeverityThresholds,
} from '../../domain/incidents/incident-severity.resolver';
import {
  registerDedupedIncident,
  type DedupBranchOutcome,
} from './register-deduped-incident';

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

type DbErrorIncident = {
  id: number;
  count: number;
  firstSeenAt: Date;
  severity: IncidentSeverity;
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

    return registerDedupedIncident<
      ErrorIncidentResult,
      CachedErrorIncident,
      DbErrorIncident
    >({
      key: summary.fingerprint.cacheKey,
      windowSeconds: dedupWindowSeconds,
      dedupStore: this.dedupStore,
      parseCache: (raw) => JSON.parse(raw) as CachedErrorIncident,
      onCacheHit: (cached, now) =>
        this.handleCachedIncident(summary, cached, now),
      findInDb: (now) =>
        this.findRecentMatchingIncidentInDb(summary, dedupWindowSeconds, now),
      onDbHit: (existing, now) =>
        this.handleDbHit(summary, existing, dedupWindowSeconds, now),
      onCreate: (now) =>
        this.handleCreate(summary, dedupWindowSeconds, now),
    });
  }

  private async handleCachedIncident(
    summary: ErrorIncidentSummary,
    existing: CachedErrorIncident,
    now: Date,
  ): Promise<DedupBranchOutcome<ErrorIncidentResult, CachedErrorIncident>> {
    const nextCount = existing.count + 1;
    const firstSeenAt = new Date(existing.firstSeenAt);
    const priorIncidentCount = existing.priorIncidentCount ?? 0;
    const severity = this.resolveSeverity(summary, {
      count: nextCount,
      firstSeenAt,
      lastSeenAt: now,
      priorIncidentCount,
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

    return {
      result: this.buildDuplicateResult(
        recordId,
        nextCount,
        existing.severity,
        severity,
      ),
      cacheValue: {
        id: recordId,
        count: nextCount,
        severity,
        firstSeenAt: existing.firstSeenAt,
        priorIncidentCount,
      },
    };
  }

  private async handleDbHit(
    summary: ErrorIncidentSummary,
    existing: DbErrorIncident,
    dedupWindowSeconds: number,
    now: Date,
  ): Promise<DedupBranchOutcome<ErrorIncidentResult, CachedErrorIncident>> {
    const nextCount = existing.count + 1;
    const priorIncidentCount = await this.countPriorIncidents(
      summary,
      new Date(now.getTime() - dedupWindowSeconds * 1000),
    );
    const severity = this.resolveSeverity(summary, {
      count: nextCount,
      firstSeenAt: existing.firstSeenAt,
      lastSeenAt: now,
      priorIncidentCount,
    });

    await this.updateIncidentRecord(existing.id, summary, severity);

    return {
      result: this.buildDuplicateResult(
        existing.id,
        nextCount,
        existing.severity,
        severity,
      ),
      cacheValue: {
        id: existing.id,
        count: nextCount,
        severity,
        firstSeenAt: existing.firstSeenAt.toISOString(),
        priorIncidentCount,
      },
    };
  }

  private async handleCreate(
    summary: ErrorIncidentSummary,
    dedupWindowSeconds: number,
    now: Date,
  ): Promise<DedupBranchOutcome<ErrorIncidentResult, CachedErrorIncident>> {
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

    return {
      result: {
        isDuplicate: false,
        id: created.id,
        count: 1,
        severity,
      },
      cacheValue: {
        id: created.id,
        count: 1,
        severity,
        firstSeenAt: now.toISOString(),
        priorIncidentCount,
      },
    };
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

  private async countPriorIncidents(
    summary: ErrorIncidentSummary,
    windowStart: Date,
  ): Promise<number> {
    if (!this.prisma.isEnabled) {
      return 0;
    }

    return this.prisma.countPriorExternalErrorIncidents(
      summary.fingerprint.hash,
      windowStart,
    );
  }

  private async findRecentMatchingIncidentInDb(
    summary: ErrorIncidentSummary,
    dedupWindowSeconds: number,
    now: Date,
  ): Promise<DbErrorIncident | null> {
    if (!this.prisma.isEnabled) {
      return null;
    }

    const windowStart = new Date(now.getTime() - dedupWindowSeconds * 1000);

    const row = await this.prisma.findRecentExternalError(
      summary.fingerprint.hash,
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
      metadata: toPrismaJsonObject(summary.metadata),
      fingerprint: summary.fingerprint.hash,
      fingerprintVersion: summary.fingerprint.parts.fingerprintVersion,
      environment: summary.fingerprint.parts.environment,
    });
  }
}
