import {
  type DynamicModule,
  type InjectionToken,
  Module,
  type Provider,
} from '@nestjs/common';
import Redis from 'ioredis';
import { PrismaService } from './database/prisma.service';
import { ProviderErrorCaptureService } from './application/services/provider-error-capture.service';
import { PlaidItemCreatedListener } from './application/listeners/plaid-item-created.listener';
import { ProviderErrorListener } from './application/listeners/provider-error.listener';
import { ProviderLatencyListener } from './application/listeners/provider-latency.listener';
import { ErrorIncidentService } from './application/services/error-incident.service';
import { LatencyIncidentService } from './application/services/latency-incident.service';
import { LatencyTrackingService } from './application/services/latency-tracking.service';
import { SlackService } from './infrastructure/notifications/slack.service';
import { EventBusService } from './infrastructure/eventing/event-bus.service';
import { ItemMetadataService } from './application/services/item-metadata.service';
import { InspectorCoreSlackQueueBootstrap } from './inspector-core-slack-queue.bootstrap';
import { InspectorSlackQueueModule } from './inspector-slack-queue.module';
import {
  DEDUP_STORE,
  INSPECTOR_CORE_OPTIONS,
} from './config/inspector-core.constants';
import {
  getRedisConnectionOptions,
  isRedisConfigured,
  normalizeInspectorCoreOptions,
  type InspectorCoreModuleAsyncOptions,
  type InspectorCoreModuleOptions,
} from './config/inspector-core.options';
import {
  InMemoryDedupStore,
  RedisDedupStore,
} from './infrastructure/redis/dedup-store';
import { validateSlackWebhookUrl } from './config/validate-slack-webhook-url';

const CORE_PROVIDERS: Provider[] = [
  PrismaService,
  EventBusService,
  ItemMetadataService,
  ProviderErrorCaptureService,
  ProviderErrorListener,
  ProviderLatencyListener,
  PlaidItemCreatedListener,
  SlackService,
  ErrorIncidentService,
  LatencyTrackingService,
  LatencyIncidentService,
  InspectorCoreSlackQueueBootstrap,
];

const CORE_EXPORTS = [
  INSPECTOR_CORE_OPTIONS,
  DEDUP_STORE,
  PrismaService,
  EventBusService,
  ItemMetadataService,
  ProviderErrorCaptureService,
  ErrorIncidentService,
  LatencyTrackingService,
  LatencyIncidentService,
];

function createDedupStoreProvider(): Provider {
  return {
    provide: DEDUP_STORE,
    inject: [INSPECTOR_CORE_OPTIONS],
    useFactory: (options: InspectorCoreModuleOptions) => {
      if (!isRedisConfigured(options)) {
        return new InMemoryDedupStore();
      }

      const redis = new Redis(getRedisConnectionOptions(options));
      return new RedisDedupStore(redis);
    },
  };
}

function createSlackQueueImport(
  options: InspectorCoreModuleOptions,
): DynamicModule | undefined {
  return isRedisConfigured(options)
    ? InspectorSlackQueueModule.forRoot(options)
    : undefined;
}

function createDynamicModule(
  optionsProvider: Provider,
  slackQueueImport?: DynamicModule,
): DynamicModule {
  return {
    module: InspectorCoreModule,
    imports: slackQueueImport ? [slackQueueImport] : [],
    providers: [optionsProvider, createDedupStoreProvider(), ...CORE_PROVIDERS],
    exports: CORE_EXPORTS,
  };
}

function createAsyncOptionsProvider<TInject extends readonly unknown[]>(
  asyncOptions: InspectorCoreModuleAsyncOptions<TInject>,
): Provider {
  return {
    provide: INSPECTOR_CORE_OPTIONS,
    useFactory: async (...args: TInject) => {
      const options = await asyncOptions.useFactory(...args);
      const normalized = normalizeInspectorCoreOptions(options);
      validateSlackWebhookUrl(normalized.slackWebhookUrl);
      return normalized;
    },
    inject: (asyncOptions.inject ?? []) as InjectionToken[],
  };
}

@Module({})
export class InspectorCoreModule {
  static forRoot(options: InspectorCoreModuleOptions): DynamicModule {
    const normalized = normalizeInspectorCoreOptions(options);
    validateSlackWebhookUrl(normalized.slackWebhookUrl);

    return createDynamicModule(
      {
        provide: INSPECTOR_CORE_OPTIONS,
        useValue: normalized,
      },
      createSlackQueueImport(normalized),
    );
  }

  static forRootAsync<TInject extends readonly unknown[]>(
    asyncOptions: InspectorCoreModuleAsyncOptions<TInject>,
  ): DynamicModule {
    const base = createDynamicModule(createAsyncOptionsProvider(asyncOptions));

    return {
      ...base,
      imports: [...(base.imports ?? []), ...(asyncOptions.imports ?? [])],
    };
  }
}
