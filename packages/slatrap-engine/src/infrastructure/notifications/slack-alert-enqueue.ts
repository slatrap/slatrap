import { getQueueToken } from '@nestjs/bullmq';
import { ModuleRef } from '@nestjs/core';
import { Queue } from 'bullmq';
import { type InspectorCoreModuleOptions, isRedisConfigured } from '../../config/inspector-core.options';
import { getOptionalModuleRef } from '../nest/get-optional-module-ref';
import {
  SLACK_QUEUE_NAME,
  SLACK_SEND_ALERT_JOB,
  type SlackAlertJobData,
} from './slack-queue';
import { SlackService } from './slack.service';

export async function enqueueSlackAlert(
  options: InspectorCoreModuleOptions,
  moduleRef: ModuleRef,
  slackService: SlackService,
  text: string,
): Promise<void> {
  if (isRedisConfigured(options)) {
    const queue = getOptionalModuleRef<Queue<SlackAlertJobData>>(
      moduleRef,
      getQueueToken(SLACK_QUEUE_NAME),
    );

    if (queue) {
      await queue.add(SLACK_SEND_ALERT_JOB, { text });
      return;
    }
  }

  await slackService.sendMessage(text);
}
