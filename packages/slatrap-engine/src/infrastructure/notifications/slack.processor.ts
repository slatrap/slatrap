import { Injectable } from '@nestjs/common';
import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { SlackService } from './slack.service';
import {
  SLACK_QUEUE_NAME,
  SLACK_SEND_ALERT_JOB,
  type SlackAlertJobData,
} from './slack-queue';

@Injectable()
@Processor(SLACK_QUEUE_NAME)
export class SlackProcessor extends WorkerHost {
  constructor(private readonly slackService: SlackService) {
    super();
  }

  async process(job: Job<SlackAlertJobData>): Promise<void> {
    if (job.name !== SLACK_SEND_ALERT_JOB) {
      return;
    }

    await this.slackService.sendMessage(job.data.text);
  }
}
