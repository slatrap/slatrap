import {
  Inject,
  Injectable,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';

import { PrismaPg } from '@prisma/adapter-pg';
import { Prisma, PrismaClient } from '@prisma/client';
import { INSPECTOR_CORE_OPTIONS } from '../config/inspector-core.constants';
import { type InspectorCoreModuleOptions } from '../config/inspector-core.options';
import {
  type ExternalErrorCreateData,
  type ExternalErrorUpdateData,
  type RecentExternalErrorRow,
} from './external-error-db.types';

@Injectable()
export class PrismaService implements OnModuleInit, OnModuleDestroy {
  private readonly client: PrismaClient | null;
  readonly isEnabled: boolean;

  constructor(
    @Inject(INSPECTOR_CORE_OPTIONS)
    private readonly options: InspectorCoreModuleOptions,
  ) {
    const connectionString = this.options.databaseUrl;

    this.isEnabled = Boolean(connectionString);

    this.client = this.isEnabled
      ? new PrismaClient({
          adapter: new PrismaPg(connectionString!),
        })
      : null;
  }

  /** Prisma client; only available when `databaseUrl` is configured. */

  get db(): PrismaClient {
    if (!this.client) {
      throw new Error(
        'Database is not configured. Pass databaseUrl in InspectorCoreModule.forRoot() to enable persistence.',
      );
    }

    return this.client;
  }

  async onModuleInit() {
    if (this.client) {
      await this.client.$connect();
    }
  }

  async onModuleDestroy() {
    if (this.client) {
      await this.client.$disconnect();
    }
  }

  createLatencyObservation(
    data: Prisma.LatencyObservationCreateInput,
  ): Promise<{ id: number }> {
    return this.db.latencyObservation.create({
      data,
      select: { id: true },
    });
  }

  findRecentLatencyIncident(
    where: Prisma.LatencyIncidentWhereInput,
    windowStart: Date,
  ) {
    return this.db.latencyIncident.findFirst({
      where: {
        ...where,
        timestamp: { gte: windowStart },
      },
      orderBy: { timestamp: 'desc' },
      select: {
        id: true,
        count: true,
        maxLatencyMs: true,
        timestamp: true,
      },
    });
  }

  incrementLatencyIncident(
    id: number,
    data: Prisma.LatencyIncidentUpdateInput,
  ): Promise<void> {
    return this.db.latencyIncident
      .update({
        where: { id },
        data,
      })
      .then(() => undefined);
  }

  createLatencyIncident(
    data: Prisma.LatencyIncidentCreateInput,
  ): Promise<{ id: number }> {
    return this.db.latencyIncident.create({
      data,
      select: { id: true },
    });
  }

  findRecentExternalError(
    where: Prisma.ExternalErrorWhereInput,
    windowStart: Date,
  ): Promise<RecentExternalErrorRow | null> {
    return this.db.externalError
      .findFirst({
        where: {
          ...where,
          timestamp: { gte: windowStart },
        },
        orderBy: { timestamp: 'desc' },
      })
      .then((row) => {
        if (!row) {
          return null;
        }

        return row as unknown as RecentExternalErrorRow;
      });
  }

  incrementExternalError(
    id: number,
    data: ExternalErrorUpdateData,
  ): Promise<void> {
    return this.db.externalError
      .update({
        where: { id },
        data: data as Prisma.ExternalErrorUpdateInput,
      })
      .then(() => undefined);
  }

  createExternalError(
    data: ExternalErrorCreateData,
  ): Promise<{ id: number }> {
    return this.db.externalError.create({
      data: data as Prisma.ExternalErrorCreateInput,
      select: { id: true },
    });
  }

  countPriorExternalErrorIncidents(
    where: Prisma.ExternalErrorWhereInput,
    before: Date,
  ): Promise<number> {
    return this.db.externalError.count({
      where: {
        ...where,
        timestamp: { lt: before },
      },
    });
  }
}
