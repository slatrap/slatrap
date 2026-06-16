import { getQueueToken } from '@nestjs/bullmq';
import { PROVIDER_ERROR_EVENT } from '../../domain/events/events.constants';
import { SLACK_SEND_ALERT_JOB } from '../../infrastructure/notifications/slack-queue';
import { EventBusService } from '../../infrastructure/eventing/event-bus.service';
import { ProviderErrorCaptureService } from '../services/provider-error-capture.service';
import { ErrorIncidentService } from '../services/error-incident.service';
import { ProviderErrorListener } from './provider-error.listener';
import { Logger } from '@nestjs/common';
import { SlackService } from '../../infrastructure/notifications/slack.service';
import { ModuleRef } from '@nestjs/core';
import { SLACK_QUEUE_NAME } from '../../infrastructure/notifications/slack-queue';
import { type InspectorCoreModuleOptions } from '../../config/inspector-core.options';

describe('ProviderErrorListener', () => {
  const defaultOptions: InspectorCoreModuleOptions = {
    redis: { host: '127.0.0.1', port: 6379 },
  };

  const createSlackService = (isEnabled = true) =>
    ({
      isEnabled,
      sendMessage: jest.fn().mockResolvedValue(undefined),
    }) as unknown as SlackService;

  const createModuleRef = (queue?: { add: jest.Mock }) => {
    return {
      get: jest.fn((token: string) => {
        if (token === getQueueToken(SLACK_QUEUE_NAME)) {
          return queue;
        }
        return undefined;
      }),
    } as unknown as ModuleRef;
  };

  const flushPromises = async () => {
    await new Promise((resolve) => setImmediate(resolve));
  };

  it('subscribes and unsubscribes on module lifecycle hooks', () => {
    const inspector = { on: jest.fn(), off: jest.fn() };
    const fintechErrorCaptureService = { captureProviderError: jest.fn() };
    const errorIncidentService = { checkAndRegisterIncident: jest.fn() };

    const listener = new ProviderErrorListener(
      inspector as unknown as EventBusService,
      fintechErrorCaptureService as unknown as ProviderErrorCaptureService,
      errorIncidentService as unknown as ErrorIncidentService,
      createSlackService(),
      createModuleRef(),
      defaultOptions,
    );

    listener.onModuleInit();
    expect(inspector.on).toHaveBeenCalledWith(
      PROVIDER_ERROR_EVENT,
      expect.any(Function),
    );

    listener.onModuleDestroy();
    expect(inspector.off).toHaveBeenCalledWith(
      PROVIDER_ERROR_EVENT,
      expect.any(Function),
    );
  });

  it('skips deduplication and slack when capture result is null', async () => {
    let registeredListener: ((payload: unknown) => void) | undefined;
    const inspector = {
      on: jest.fn((eventName: string, listener: (payload: unknown) => void) => {
        if (eventName === PROVIDER_ERROR_EVENT) {
          registeredListener = listener;
        }
      }),
      off: jest.fn(),
    };
    const fintechErrorCaptureService = {
      captureProviderError: jest.fn().mockResolvedValue(null),
    };
    const errorIncidentService = { checkAndRegisterIncident: jest.fn() };
    const slackService = createSlackService();
    const slackQueue = { add: jest.fn() };

    const listener = new ProviderErrorListener(
      inspector as unknown as EventBusService,
      fintechErrorCaptureService as unknown as ProviderErrorCaptureService,
      errorIncidentService as unknown as ErrorIncidentService,
      slackService,
      createModuleRef(slackQueue),
      defaultOptions,
    );

    listener.onModuleInit();
    registeredListener?.({
      provider: 'plaid',
      endpoint: '/plaid/transactions/get',
      statusCode: 429,
      providerPayload: { error_code: 'RATE_LIMIT_EXCEEDED' },
      latency: 25,
    });

    await flushPromises();

    expect(errorIncidentService.checkAndRegisterIncident).not.toHaveBeenCalled();
    expect(slackQueue.add).not.toHaveBeenCalled();
    expect(slackService.sendMessage).not.toHaveBeenCalled();
  });

  it('enqueues slack alert on first error occurrence when redis is configured', async () => {
    let registeredListener: ((payload: unknown) => void) | undefined;
    const inspector = {
      on: jest.fn((eventName: string, listener: (payload: unknown) => void) => {
        if (eventName === PROVIDER_ERROR_EVENT) {
          registeredListener = listener;
        }
      }),
      off: jest.fn(),
    };
    const capturedError = {
      normalizedProvider: 'plaid',
      errorCode: 'ITEM_LOGIN_REQUIRED',
      errorType: 'ITEM_ERROR',
      errorMessage: 'Re-auth required',
      requestId: 'req_01',
      endpoint: '/plaid/transactions/get',
      statusCode: 429,
      metadata: {},
    };
    const fintechErrorCaptureService = {
      captureProviderError: jest.fn().mockResolvedValue(capturedError),
    };
    const errorIncidentService = {
      checkAndRegisterIncident: jest
        .fn()
        .mockResolvedValue({ isDuplicate: false, id: 1, count: 1, severity: 'medium' }),
    };
    const slackService = createSlackService();
    const slackQueue = { add: jest.fn().mockResolvedValue(undefined) };

    const listener = new ProviderErrorListener(
      inspector as unknown as EventBusService,
      fintechErrorCaptureService as unknown as ProviderErrorCaptureService,
      errorIncidentService as unknown as ErrorIncidentService,
      slackService,
      createModuleRef(slackQueue),
      defaultOptions,
    );

    listener.onModuleInit();

    const eventPayload = {
      provider: 'plaid',
      endpoint: '/plaid/transactions/get',
      statusCode: 429,
      providerPayload: { error_code: 'ITEM_LOGIN_REQUIRED' },
      latency: 42,
    };

    registeredListener?.(eventPayload);
    await flushPromises();

    expect(slackQueue.add).toHaveBeenCalledWith(SLACK_SEND_ALERT_JOB, {
      text: expect.stringContaining('"type": "error_incident"'),
    });
    expect(slackService.sendMessage).not.toHaveBeenCalled();
  });

  it('sends slack directly when redis is not configured', async () => {
    let registeredListener: ((payload: unknown) => void) | undefined;
    const inspector = {
      on: jest.fn((eventName: string, listener: (payload: unknown) => void) => {
        if (eventName === PROVIDER_ERROR_EVENT) {
          registeredListener = listener;
        }
      }),
      off: jest.fn(),
    };
    const capturedError = {
      normalizedProvider: 'plaid',
      errorCode: 'ITEM_LOGIN_REQUIRED',
      errorType: 'ITEM_ERROR',
      errorMessage: 'Re-auth required',
      requestId: 'req_01',
      endpoint: '/plaid/transactions/get',
      statusCode: 429,
      metadata: {},
    };
    const fintechErrorCaptureService = {
      captureProviderError: jest.fn().mockResolvedValue(capturedError),
    };
    const errorIncidentService = {
      checkAndRegisterIncident: jest
        .fn()
        .mockResolvedValue({ isDuplicate: false, id: 1, count: 1, severity: 'medium' }),
    };
    const slackService = createSlackService();
    const slackQueue = { add: jest.fn() };

    const listener = new ProviderErrorListener(
      inspector as unknown as EventBusService,
      fintechErrorCaptureService as unknown as ProviderErrorCaptureService,
      errorIncidentService as unknown as ErrorIncidentService,
      slackService,
      createModuleRef(slackQueue),
      {},
    );

    listener.onModuleInit();
    registeredListener?.({
      provider: 'plaid',
      endpoint: '/plaid/transactions/get',
      statusCode: 429,
      providerPayload: { error_code: 'ITEM_LOGIN_REQUIRED' },
      latency: 42,
    });

    await flushPromises();

    expect(slackQueue.add).not.toHaveBeenCalled();
    expect(slackService.sendMessage).toHaveBeenCalled();
  });

  it('suppresses slack alert for duplicate errors', async () => {
    let registeredListener: ((payload: unknown) => void) | undefined;
    const inspector = {
      on: jest.fn((eventName: string, listener: (payload: unknown) => void) => {
        if (eventName === PROVIDER_ERROR_EVENT) {
          registeredListener = listener;
        }
      }),
      off: jest.fn(),
    };
    const capturedError = {
      normalizedProvider: 'plaid',
      errorCode: 'RATE_LIMIT_EXCEEDED',
      errorType: 'API_ERROR',
      errorMessage: 'Rate limit exceeded',
      requestId: 'req_02',
      endpoint: '/plaid/transactions/get',
      statusCode: 429,
      metadata: {},
    };
    const fintechErrorCaptureService = {
      captureProviderError: jest.fn().mockResolvedValue(capturedError),
    };
    const errorIncidentService = {
      checkAndRegisterIncident: jest
        .fn()
        .mockResolvedValue({ isDuplicate: true, id: 1, count: 2, severity: 'high' }),
    };
    const slackService = createSlackService();
    const slackQueue = { add: jest.fn() };

    const listener = new ProviderErrorListener(
      inspector as unknown as EventBusService,
      fintechErrorCaptureService as unknown as ProviderErrorCaptureService,
      errorIncidentService as unknown as ErrorIncidentService,
      slackService,
      createModuleRef(slackQueue),
      defaultOptions,
    );

    listener.onModuleInit();
    registeredListener?.({
      provider: 'plaid',
      endpoint: '/plaid/transactions/get',
      statusCode: 429,
      providerPayload: { error_code: 'RATE_LIMIT_EXCEEDED' },
      latency: 15,
    });

    await flushPromises();

    expect(slackQueue.add).not.toHaveBeenCalled();
    expect(slackService.sendMessage).not.toHaveBeenCalled();
  });

  it('does not send slack when Slack is not configured', async () => {
    let registeredListener: ((payload: unknown) => void) | undefined;
    const inspector = {
      on: jest.fn((eventName: string, listener: (payload: unknown) => void) => {
        if (eventName === PROVIDER_ERROR_EVENT) {
          registeredListener = listener;
        }
      }),
      off: jest.fn(),
    };
    const capturedError = {
      normalizedProvider: 'plaid',
      errorCode: 'ITEM_LOGIN_REQUIRED',
      errorType: 'ITEM_ERROR',
      errorMessage: 'Re-auth required',
      requestId: 'req_01',
      endpoint: '/plaid/transactions/get',
      statusCode: 429,
      metadata: {},
    };
    const fintechErrorCaptureService = {
      captureProviderError: jest.fn().mockResolvedValue(capturedError),
    };
    const errorIncidentService = {
      checkAndRegisterIncident: jest
        .fn()
        .mockResolvedValue({ isDuplicate: false, id: 1, count: 1, severity: 'medium' }),
    };
    const slackService = createSlackService(false);
    const slackQueue = { add: jest.fn() };

    const listener = new ProviderErrorListener(
      inspector as unknown as EventBusService,
      fintechErrorCaptureService as unknown as ProviderErrorCaptureService,
      errorIncidentService as unknown as ErrorIncidentService,
      slackService,
      createModuleRef(slackQueue),
      defaultOptions,
    );

    listener.onModuleInit();
    registeredListener?.({
      provider: 'plaid',
      endpoint: '/plaid/transactions/get',
      statusCode: 429,
      providerPayload: { error_code: 'ITEM_LOGIN_REQUIRED' },
      latency: 42,
    });

    await flushPromises();

    expect(slackQueue.add).not.toHaveBeenCalled();
    expect(slackService.sendMessage).not.toHaveBeenCalled();
  });

  it('logs handler failures without throwing', async () => {
    const loggerErrorSpy = jest
      .spyOn(Logger.prototype, 'error')
      .mockImplementation(() => undefined);

    let registeredListener: ((payload: unknown) => void) | undefined;
    const inspector = {
      on: jest.fn((eventName: string, listener: (payload: unknown) => void) => {
        if (eventName === PROVIDER_ERROR_EVENT) {
          registeredListener = listener;
        }
      }),
      off: jest.fn(),
    };
    const fintechErrorCaptureService = {
      captureProviderError: jest
        .fn()
        .mockRejectedValue(new Error('capture failed')),
    };
    const errorIncidentService = { checkAndRegisterIncident: jest.fn() };

    const listener = new ProviderErrorListener(
      inspector as unknown as EventBusService,
      fintechErrorCaptureService as unknown as ProviderErrorCaptureService,
      errorIncidentService as unknown as ErrorIncidentService,
      createSlackService(),
      createModuleRef(),
      defaultOptions,
    );

    listener.onModuleInit();
    registeredListener?.({
      provider: 'plaid',
      providerPayload: { error_code: 'ANY' },
    });

    await flushPromises();

    expect(loggerErrorSpy).toHaveBeenCalled();
    loggerErrorSpy.mockRestore();
  });
});
