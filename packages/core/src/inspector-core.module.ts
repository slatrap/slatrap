import { BullModule } from '@nestjs/bullmq';
import { ConfigService } from '@nestjs/config';
import { Module } from '@nestjs/common';
import Redis from 'ioredis';
import { PrismaService } from './database/prisma.service';
import { ProviderErrorCaptureService } from './application/services/provider-error-capture.service';
import { PlaidItemCreatedListener } from './application/listeners/plaid-item-created.listener';
import { ProviderErrorListener } from './application/listeners/provider-error.listener';
import { ErrorDeduplicationService } from './application/services/error-deduplication.service';
import { SLACK_QUEUE_NAME } from './infrastructure/notifications/slack-queue';
import { SlackProcessor } from './infrastructure/notifications/slack.processor';
import { SlackService } from './infrastructure/notifications/slack.service';
import { EventBusService } from './infrastructure/eventing/event-bus.service';
import { ItemMetadataService } from './application/services/item-metadata.service';

const REDIS_CLIENT = 'REDIS_CLIENT';

@Module({
  imports: [BullModule.registerQueue({ name: SLACK_QUEUE_NAME })],
  providers: [
    {
      provide: REDIS_CLIENT,
      inject: [ConfigService],
      useFactory: (configService: ConfigService) =>
        new Redis({
          host: configService.get<string>('REDIS_HOST', '127.0.0.1'),
          port: configService.get<number>('REDIS_PORT', 6379),
          username: configService.get<string>('REDIS_USERNAME'),
          password: configService.get<string>('REDIS_PASSWORD'),
        }),
    },
    PrismaService,
    EventBusService,
    ItemMetadataService,
    ProviderErrorCaptureService,
    ProviderErrorListener,
    PlaidItemCreatedListener,
    SlackProcessor,
    SlackService,
    ErrorDeduplicationService,
  ],
  exports: [
    REDIS_CLIENT,
    PrismaService,
    EventBusService,
    ItemMetadataService,
    ProviderErrorCaptureService,
    ErrorDeduplicationService,
  ],
})
export class InspectorCoreModule {}
