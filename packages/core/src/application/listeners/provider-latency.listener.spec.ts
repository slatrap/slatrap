import { getQueueToken } from '@nestjs/bullmq';
import { ModuleRef } from '@nestjs/core';
import { PROVIDER_LATENCY_EVENT } from '../../domain/events/events.constants';
import { EventBusService } from '../../infrastructure/eventing/event-bus.service';
import { SLACK_QUEUE_NAME, SLACK_SEND_ALERT_JOB } from '../../infrastructure/notifications/slack-queue';
import { SlackService } from '../../infrastructure/notifications/slack.service';
import { type InspectorCoreModuleOptions } from '../../config/inspector-core.options';
import { LatencyIncidentService } from '../services/latency-incident.service';
import { LatencyTrackingService } from '../services/latency-tracking.service';
import { ProviderLatencyListener } from './provider-latency.listener';

describe('ProviderLatencyListener', () => {
  const defaultOptions: InspectorCoreModuleOptions = {
    plaidLatencyThresholdMs: 2_000,
    redis: { host: '127.0.0.1', port: 6379 },
  };

  const createSlackService = (isEnabled = true) =>
    ({
      isEnabled,
      sendMessage: jest.fn().mockResolvedValue(undefined),
    }) as unknown as SlackService;

  const createModuleRef = (queue?: { add: jest.Mock }) =>
    ({
      get: jest.fn((token: string) => {
        if (token === getQueueToken(SLACK_QUEUE_NAME)) {
          return queue;
        }
        return undefined;
      }),
    }) as unknown as ModuleRef;

  const flushPromises = async () => {
    await new Promise((resolve) => setImmediate(resolve));
  };

  it('records metrics and enqueues slack on first latency incident', async () => {
    let registeredListener: ((payload: unknown) => void) | undefined;
    const inspector = {
      on: jest.fn((eventName: string, listener: (payload: unknown) => void) => {
        if (eventName === PROVIDER_LATENCY_EVENT) {
          registeredListener = listener;
        }
      }),
      off: jest.fn(),
    };
    const latencyTrackingService = {
      recordObservation: jest.fn().mockResolvedValue({ id: 1 }),
    };
    const latencyIncidentService = {
      checkAndRegisterIncident: jest.fn().mockResolvedValue({
        isIncident: true,
        isDuplicate: false,
        id: 9,
        count: 1,
      }),
    };
    const slackService = createSlackService();
    const slackQueue = { add: jest.fn() };

    const listener = new ProviderLatencyListener(
      inspector as unknown as EventBusService,
      latencyTrackingService as unknown as LatencyTrackingService,
      latencyIncidentService as unknown as LatencyIncidentService,
      slackService,
      createModuleRef(slackQueue),
      defaultOptions,
    );

    listener.onModuleInit();
    registeredListener?.({
      provider: 'plaid',
      endpoint: '/plaid/slow-response',
      latencyMs: 2_500,
      success: true,
      statusCode: 200,
      metadata: { simulatedDelayMs: 2_500 },
    });

    await flushPromises();

    expect(latencyTrackingService.recordObservation).toHaveBeenCalled();
    expect(latencyIncidentService.checkAndRegisterIncident).toHaveBeenCalledWith(
      expect.objectContaining({
        provider: 'plaid',
        latencyMs: 2_500,
        thresholdMs: 2_000,
      }),
    );
    expect(slackQueue.add).toHaveBeenCalledWith(
      SLACK_SEND_ALERT_JOB,
      expect.objectContaining({
        text: expect.stringContaining('"latencyMs": 2500'),
      }),
    );
    expect(slackQueue.add).toHaveBeenCalledWith(
      SLACK_SEND_ALERT_JOB,
      expect.objectContaining({
        text: expect.stringContaining('"thresholdMs": 2000'),
      }),
    );
  });

  it('suppresses slack for grouped latency incidents', async () => {
    let registeredListener: ((payload: unknown) => void) | undefined;
    const inspector = {
      on: jest.fn((eventName: string, listener: (payload: unknown) => void) => {
        if (eventName === PROVIDER_LATENCY_EVENT) {
          registeredListener = listener;
        }
      }),
      off: jest.fn(),
    };
    const latencyTrackingService = {
      recordObservation: jest.fn().mockResolvedValue({ id: 1 }),
    };
    const latencyIncidentService = {
      checkAndRegisterIncident: jest.fn().mockResolvedValue({
        isIncident: true,
        isDuplicate: true,
        id: 9,
        count: 4,
      }),
    };
    const slackService = createSlackService();
    const slackQueue = { add: jest.fn() };

    const listener = new ProviderLatencyListener(
      inspector as unknown as EventBusService,
      latencyTrackingService as unknown as LatencyTrackingService,
      latencyIncidentService as unknown as LatencyIncidentService,
      slackService,
      createModuleRef(slackQueue),
      defaultOptions,
    );

    listener.onModuleInit();
    registeredListener?.({
      provider: 'plaid',
      endpoint: '/plaid/slow-response',
      latencyMs: 3_000,
      success: true,
      statusCode: 200,
    });

    await flushPromises();

    expect(slackQueue.add).not.toHaveBeenCalled();
    expect(slackService.sendMessage).not.toHaveBeenCalled();
  });
});
