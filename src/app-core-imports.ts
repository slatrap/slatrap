import { BullModule } from '@nestjs/bullmq';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import * as Joi from 'joi';
import { InspectorCoreModule } from '../packages/core/src';

const appValidationSchema = Joi.object({
  NODE_ENV: Joi.string()
    .valid('development', 'test', 'production')
    .default('development'),
  PORT: Joi.number().port().default(3000),
  STRIPE_SECRET_KEY: Joi.string().optional(),
  STRIPE_WEBHOOK_SECRET: Joi.string().optional(),
  STRIPE_EXTERNAL_REF_ID: Joi.string().optional(),
  SLACK_WEBHOOK_URL: Joi.string().uri().optional(),
  REDIS_HOST: Joi.string().default('127.0.0.1'),
  REDIS_PORT: Joi.number().port().default(6379),
  REDIS_USERNAME: Joi.string().optional(),
  REDIS_PASSWORD: Joi.string().optional(),

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
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        connection: {
          host: configService.get<string>('REDIS_HOST', '127.0.0.1'),
          port: configService.get<number>('REDIS_PORT', 6379),
          username: configService.get<string>('REDIS_USERNAME'),
          password: configService.get<string>('REDIS_PASSWORD'),
        },
      }),
    }),
    InspectorCoreModule,
    ScheduleModule.forRoot(),
  ];
}
