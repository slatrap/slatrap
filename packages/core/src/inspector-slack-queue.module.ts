import { BullModule } from '@nestjs/bullmq';
import { type DynamicModule, Module } from '@nestjs/common';
import { SlackProcessor } from './infrastructure/notifications/slack.processor';
import { SlackService } from './infrastructure/notifications/slack.service';
import { SLACK_QUEUE_NAME } from './infrastructure/notifications/slack-queue';
import { INSPECTOR_CORE_OPTIONS } from './config/inspector-core.constants';
import {
  getRedisConnectionOptions,
  isRedisConfigured,
  normalizeInspectorCoreOptions,
  type InspectorCoreModuleOptions,
} from './config/inspector-core.options';

@Module({})
export class InspectorSlackQueueModule {
  /**
   * Self-contained Bull + Slack worker module. When loaded lazily it cannot see
   * parent providers, so options and SlackService are registered here too.
   */
  static forRoot(options: InspectorCoreModuleOptions): DynamicModule {
    const normalized = normalizeInspectorCoreOptions(options);

    return {
      module: InspectorSlackQueueModule,
      imports: [
        BullModule.forRoot({
          connection: getRedisConnectionOptions(normalized),
        }),
        BullModule.registerQueue({ name: SLACK_QUEUE_NAME }),
      ],
      providers: [
        { provide: INSPECTOR_CORE_OPTIONS, useValue: normalized },
        SlackService,
        SlackProcessor,
      ],
    };
  }

  static shouldRegister(options: InspectorCoreModuleOptions): boolean {
    return isRedisConfigured(options);
  }
}
