import { ConfigModule, ConfigService } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import * as Joi from 'joi';
import {
  createInspectorCoreOptionsFromConfigService,
  InspectorCoreModule,
} from '@slatrap/slatrap-engine';

const appValidationSchema = Joi.object({
  NODE_ENV: Joi.string()
    .valid('development', 'test', 'production')
    .default('development'),
  PORT: Joi.number().port().default(3000),
  STRIPE_SECRET_KEY: Joi.string().optional(),
  STRIPE_WEBHOOK_SECRET: Joi.string().optional(),
  STRIPE_EXTERNAL_REF_ID: Joi.string().optional(),
  STRIPE_HTTP_TIMEOUT_MS: Joi.number().integer().min(1000).optional(),
  SLACK_WEBHOOK_URL: Joi.string().uri().optional(),
  REDIS_HOST: Joi.string().optional().allow(''),
  REDIS_PORT: Joi.number().port().default(6379),
  REDIS_USERNAME: Joi.string().optional(),
  REDIS_PASSWORD: Joi.string().optional(),
  DATABASE_URL: Joi.string().optional().allow(''),

  // Optional simulation settings are validated so shared env files remain compatible.
  SIMULATION_ENABLED: Joi.boolean()
    .truthy('true')
    .falsy('false')
    .default(false),
  SIMULATION_INTERNAL_TOKEN: Joi.string().optional(),
  SIMULATION_ITEM_ID: Joi.string().optional(),
  SIMULATION_INSTITUTION_ID: Joi.string().default('ins_109508'),
  SIMULATION_INSTITUTION_NAME: Joi.string().optional(),
  ERROR_DEDUP_WINDOW_SECONDS: Joi.number().optional(),
  PLAID_LATENCY_THRESHOLD_MS: Joi.number().integer().min(1).optional(),
  PLAID_SIMULATION_SLOW_MS: Joi.number().integer().min(1).optional(),
  DEFAULT_LATENCY_THRESHOLD_MS: Joi.number().integer().min(1).optional(),
  LATENCY_INCIDENT_WINDOW_SECONDS: Joi.number().integer().min(1).optional(),
});

export function createAppCoreImports() {
  return [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      expandVariables: true,
      envFilePath: ['.env.local', '.env'],
      validationSchema: appValidationSchema,
      validationOptions: {
        abortEarly: false,
      },
    }),
    InspectorCoreModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) =>
        createInspectorCoreOptionsFromConfigService(configService),
    }),
    ScheduleModule.forRoot(),
  ];
}
