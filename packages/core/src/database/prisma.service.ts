import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService implements OnModuleInit, OnModuleDestroy {
  private readonly client: PrismaClient | null;
  readonly isEnabled: boolean;

  constructor(configService: ConfigService) {
    const connectionString = configService.get<string>('DATABASE_URL')?.trim();
    this.isEnabled = Boolean(connectionString);

    this.client = this.isEnabled
      ? new PrismaClient({
          adapter: new PrismaPg(connectionString!),
        })
      : null;
  }

  /** Prisma client; only available when `DATABASE_URL` is configured. */
  get db(): PrismaClient {
    if (!this.client) {
      throw new Error(
        'Database is not configured. Set DATABASE_URL to enable persistence.',
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
