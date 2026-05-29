import { type ModuleMetadata, type Type } from '@nestjs/common';
import { type ConfigService } from '@nestjs/config';

export interface InspectorCoreRedisOptions {
  host?: string;
  port?: number;
  username?: string;
  password?: string;
}

export interface InspectorCoreModuleOptions {
  /** PostgreSQL connection string. Omit to skip DB persistence. */
  databaseUrl?: string;
  /** Slack incoming webhook URL. Omit to skip Slack alerts. */
  slackWebhookUrl?: string;
  /** Redis connection for error deduplication. Omit to use in-memory dedup. */
  redis?: InspectorCoreRedisOptions;
  /** Dedup window in seconds. Default: 300 */
  errorDedupWindowSeconds?: number;
}

export interface InspectorCoreModuleAsyncOptions<
  TInject extends readonly unknown[] = [],
> extends Pick<ModuleMetadata, 'imports'> {
  inject?: { readonly [K in keyof TInject]: Type<TInject[K]> | string | symbol };
  useFactory: (
    ...args: TInject
  ) => InspectorCoreModuleOptions | Promise<InspectorCoreModuleOptions>;
}

export function isRedisConfigured(
  options: InspectorCoreModuleOptions,
): boolean {
  const host = options.redis?.host?.trim();
  if (host === '') {
    return false;
  }

  return Boolean(host);
}

export function getRedisConnectionOptions(
  options: InspectorCoreModuleOptions,
): Required<Pick<InspectorCoreRedisOptions, 'host' | 'port'>> &
  Pick<InspectorCoreRedisOptions, 'username' | 'password'> {
  return {
    host: options.redis?.host ?? '127.0.0.1',
    port: options.redis?.port ?? 6379,
    username: options.redis?.username,
    password: options.redis?.password,
  };
}

export function normalizeInspectorCoreOptions(
  options: InspectorCoreModuleOptions,
): InspectorCoreModuleOptions {
  return {
    databaseUrl: options.databaseUrl?.trim() || undefined,
    slackWebhookUrl: options.slackWebhookUrl?.trim() || undefined,
    redis: options.redis
      ? {
          host: options.redis.host?.trim(),
          port: options.redis.port,
          username: options.redis.username?.trim() || undefined,
          password: options.redis.password,
        }
      : undefined,
    errorDedupWindowSeconds: options.errorDedupWindowSeconds ?? 300,
  };
}

/** Maps common env vars to module options (for use inside forRootAsync). */
export function createInspectorCoreOptionsFromConfigService(
  configService: ConfigService,
): InspectorCoreModuleOptions {
  const redisHost = configService.get<string>('REDIS_HOST')?.trim();

  return normalizeInspectorCoreOptions({
    databaseUrl: configService.get<string>('DATABASE_URL'),
    slackWebhookUrl: configService.get<string>('SLACK_WEBHOOK_URL'),
    redis: redisHost
      ? {
          host: redisHost,
          port: configService.get<number>('REDIS_PORT', 6379),
          username: configService.get<string>('REDIS_USERNAME'),
          password: configService.get<string>('REDIS_PASSWORD'),
        }
      : undefined,
    errorDedupWindowSeconds: configService.get<number>(
      'ERROR_DEDUP_WINDOW_SECONDS',
      300,
    ),
  });
}
