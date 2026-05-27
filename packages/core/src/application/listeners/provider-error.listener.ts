import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { ProviderErrorCaptureService } from '../services/provider-error-capture.service';
import { EventBusService } from '../../infrastructure/eventing/event-bus.service';
import { PROVIDER_ERROR_EVENT } from '../../domain/events/events.constants';
import { type ProviderErrorInspectionEvent } from '../../domain/events/events.types';
import {
  SLACK_QUEUE_NAME,
  SLACK_SEND_ALERT_JOB,
  type SlackAlertJobData,
} from '../../infrastructure/notifications/slack-queue';
import { ErrorDeduplicationService } from '../services/error-deduplication.service';

@Injectable()
export class ProviderErrorListener implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ProviderErrorListener.name);

  private readonly listener = (payload: unknown) => {
    const event = payload as ProviderErrorInspectionEvent;
    void this.handleProviderError(event).catch((error) => {
      this.logger.error(
        `Failed to handle provider error event: ${String(error)}`,
        error instanceof Error ? error.stack : undefined,
      );
    });
  };

  constructor(
    private readonly inspector: EventBusService,
    private readonly fintechErrorCaptureService: ProviderErrorCaptureService,
    private readonly deduplicationService: ErrorDeduplicationService,
    @InjectQueue(SLACK_QUEUE_NAME)
    private readonly slackQueue: Queue<SlackAlertJobData>,
  ) { }

  onModuleInit() {
    this.inspector.on(PROVIDER_ERROR_EVENT, this.listener);
  }

  onModuleDestroy() {
    this.inspector.off(PROVIDER_ERROR_EVENT, this.listener);
  }

  private async handleProviderError(event: ProviderErrorInspectionEvent) {
    const capturedError =
      await this.fintechErrorCaptureService.captureProviderError({
        provider: event.provider,
        endpoint: event.endpoint,
        statusCode: event.statusCode,
        providerPayload: event.providerPayload,
        latency: event.latency,
      });

    if (!capturedError) {
      this.logger.warn(
        `Skipped provider error event because no error context could be extracted from endpoint ${event.endpoint}`,
      );
      return;
    }

    const errorFingerprint = {
      provider: capturedError.normalizedProvider ?? 'undefined',
      errorCode: capturedError.errorCode ?? '',
      endpoint: capturedError.endpoint ?? '',
      statusCode: capturedError.statusCode ?? 0,
      latency: event.latency ?? 0,
      errorType: capturedError.errorType ?? '',
      errorMessage: capturedError.errorMessage ?? '',
      requestId: capturedError.requestId,
      metadata: capturedError.metadata ?? {},
    };

    const dedup =
      await this.deduplicationService.checkAndRegisterError(errorFingerprint);

    // ONLY send Slack if first occurrence
    if (!dedup.isDuplicate) {
      const fullErrorMessage = {
        providerPayload: event.providerPayload,
        endpoint: capturedError.endpoint,
        statusCode: capturedError.statusCode,
        provider: capturedError.normalizedProvider,
      };

      await this.slackQueue.add(SLACK_SEND_ALERT_JOB, {
        text: JSON.stringify(fullErrorMessage, null, 2),
      });
    } else {
      this.logger.debug(
        `Duplicate error suppressed (already seen within 5min): ${dedup.id}`,
      );
    }
  }
}
