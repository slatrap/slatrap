import {
  Inject,
  Injectable,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';

import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import { INSPECTOR_CORE_OPTIONS } from '../config/inspector-core.constants';
import { type InspectorCoreModuleOptions } from '../config/inspector-core.options';

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
}
