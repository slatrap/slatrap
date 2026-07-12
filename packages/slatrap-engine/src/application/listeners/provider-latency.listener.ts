import {
  Inject,
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { PROVIDER_LATENCY_EVENT } from '../../domain/events/events.constants';
import { type ProviderLatencyInspectionEvent } from '../../domain/events/events.types';
import { EventBusService } from '../../infrastructure/eventing/event-bus.service';
import { enqueueSlackAlert } from '../../infrastructure/notifications/slack-alert-enqueue';
import { SlackService } from '../../infrastructure/notifications/slack.service';
import { INSPECTOR_CORE_OPTIONS } from '../../config/inspector-core.constants';
import { type InspectorCoreModuleOptions } from '../../config/inspector-core.options';
import { LatencyIncidentService } from '../services/latency-incident.service';
import { LatencyTrackingService } from '../services/latency-tracking.service';

@Injectable()
export class ProviderLatencyListener implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ProviderLatencyListener.name);

  private readonly listener = (payload: unknown) => {
    const event = payload as ProviderLatencyInspectionEvent;
    void this.handleProviderLatency(event).catch((error) => {
      this.logger.error(
        `Failed to handle provider latency event: ${String(error)}`,
        error instanceof Error ? error.stack : undefined,
      );
    });
  };

  constructor(
    private readonly inspector: EventBusService,
    private readonly latencyTrackingService: LatencyTrackingService,
    private readonly latencyIncidentService: LatencyIncidentService,
    private readonly slackService: SlackService,
    private readonly moduleRef: ModuleRef,
    @Inject(INSPECTOR_CORE_OPTIONS)
    private readonly options: InspectorCoreModuleOptions,
  ) {}

  onModuleInit() {
    this.inspector.on(PROVIDER_LATENCY_EVENT, this.listener);
  }

  onModuleDestroy() {
    this.inspector.off(PROVIDER_LATENCY_EVENT, this.listener);
  }

  private async handleProviderLatency(event: ProviderLatencyInspectionEvent) {
    const thresholdMs = this.resolveThresholdMs(event.provider);
    if (thresholdMs === undefined) {
      return;
    }

    await this.latencyTrackingService.recordObservation({
      provider: event.provider,
      endpoint: event.endpoint,
      latency: event.latency,
      success: event.success,
      statusCode: event.statusCode,
      metadata: event.metadata,
    });

    const incident = await this.latencyIncidentService.checkAndRegisterIncident({
      provider: event.provider,
      endpoint: event.endpoint,
      latency: event.latency,
      thresholdMs,
      success: event.success,
      statusCode: event.statusCode,
      metadata: event.metadata,
    });

    if (!incident.isIncident) {
      return;
    }

    this.logger.warn(
      {
        provider: event.provider,
        endpoint: event.endpoint,
        latency: event.latency,
        thresholdMs,
        success: event.success,
        statusCode: event.statusCode,
        incidentId: incident.id,
        occurrenceCount: incident.count,
      },
      'Provider latency threshold exceeded',
    );

    if (!incident.isDuplicate && this.slackService.isEnabled) {
      const text = JSON.stringify(
        {
          type: 'latency_incident',
          provider: event.provider,
          endpoint: event.endpoint,
          latency: event.latency,
          thresholdMs,
          success: event.success,
          statusCode: event.statusCode,
          occurrenceCount: incident.count,
          metadata: event.metadata ?? {},
        },
        null,
        2,
      );

      await enqueueSlackAlert(
        this.options,
        this.moduleRef,
        this.slackService,
        text,
      );
    } else if (incident.isDuplicate) {
      this.logger.debug(
        `Duplicate latency incident suppressed (already seen within window): ${incident.id}`,
      );
    }
  }

  private resolveThresholdMs(provider: string): number | undefined {
    const normalized = provider.toLowerCase();

    if (normalized === 'plaid') {
      return this.options.plaidLatencyThresholdMs;
    }

    return this.options.defaultLatencyThresholdMs;
  }
}
