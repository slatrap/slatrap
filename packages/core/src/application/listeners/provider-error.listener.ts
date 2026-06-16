import {
  Inject,
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { ProviderErrorCaptureService } from '../services/provider-error-capture.service';
import { EventBusService } from '../../infrastructure/eventing/event-bus.service';
import { PROVIDER_ERROR_EVENT } from '../../domain/events/events.constants';
import { type ProviderErrorInspectionEvent } from '../../domain/events/events.types';
import { ErrorIncidentService } from '../services/error-incident.service';
import { SlackService } from '../../infrastructure/notifications/slack.service';
import { enqueueSlackAlert } from '../../infrastructure/notifications/slack-alert-enqueue';
import { buildErrorIncidentSlackAlert } from '../../infrastructure/notifications/slack-error-incident-alert';
import { buildErrorIncidentSummary } from '../../domain/incidents/build-error-incident-summary';
import { INSPECTOR_CORE_OPTIONS } from '../../config/inspector-core.constants';
import { type InspectorCoreModuleOptions } from '../../config/inspector-core.options';

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
    private readonly errorIncidentService: ErrorIncidentService,
    private readonly slackService: SlackService,
    private readonly moduleRef: ModuleRef,
    @Inject(INSPECTOR_CORE_OPTIONS)
    private readonly options: InspectorCoreModuleOptions,
  ) {}

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

    const summary = buildErrorIncidentSummary({
      captured: capturedError,
      latency: event.latency,
    });

    const incident =
      await this.errorIncidentService.checkAndRegisterIncident(summary);

    if (!incident.isDuplicate && this.slackService.isEnabled) {
      const text = buildErrorIncidentSlackAlert(summary, {
        incidentId: incident.id,
        occurrenceCount: incident.count,
      });

      await enqueueSlackAlert(
        this.options,
        this.moduleRef,
        this.slackService,
        text,
      );
    } else if (incident.isDuplicate) {
      this.logger.debug(
        `Duplicate error incident suppressed (already seen within window): ${incident.id}`,
      );
    }
  }
}
