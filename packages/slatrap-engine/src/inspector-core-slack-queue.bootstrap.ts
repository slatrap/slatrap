import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import { getQueueToken } from '@nestjs/bullmq';
import { LazyModuleLoader, ModuleRef } from '@nestjs/core';
import { INSPECTOR_CORE_OPTIONS } from './config/inspector-core.constants';
import {
  isRedisConfigured,
  type InspectorCoreModuleOptions,
} from './config/inspector-core.options';
import { getOptionalModuleRef } from './infrastructure/nest/get-optional-module-ref';
import { InspectorSlackQueueModule } from './inspector-slack-queue.module';
import { SLACK_QUEUE_NAME } from './infrastructure/notifications/slack-queue';

@Injectable()
export class InspectorCoreSlackQueueBootstrap implements OnModuleInit {
  constructor(
    private readonly lazyModuleLoader: LazyModuleLoader,
    private readonly moduleRef: ModuleRef,
    @Inject(INSPECTOR_CORE_OPTIONS)
    private readonly options: InspectorCoreModuleOptions,
  ) {}

  async onModuleInit(): Promise<void> {
    if (!isRedisConfigured(this.options)) {
      return;
    }

    const existingQueue = getOptionalModuleRef(
      this.moduleRef,
      getQueueToken(SLACK_QUEUE_NAME),
    );
    if (existingQueue) {
      return;
    }

    // Pass resolved options directly — lazy-loaded modules cannot inject
    // INSPECTOR_CORE_OPTIONS from the parent InspectorCoreModule context.
    await this.lazyModuleLoader.load(() =>
      InspectorSlackQueueModule.forRoot(this.options),
    );
  }
}
