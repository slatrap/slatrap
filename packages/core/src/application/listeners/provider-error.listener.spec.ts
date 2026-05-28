import { type Queue } from 'bullmq';
import { PROVIDER_ERROR_EVENT } from '../../domain/events/events.constants';
import { SLACK_SEND_ALERT_JOB } from '../../infrastructure/notifications/slack-queue';
import { type SlackAlertJobData } from '../../infrastructure/notifications/slack-queue';
import { EventBusService } from '../../infrastructure/eventing/event-bus.service';
import { ProviderErrorCaptureService } from '../services/provider-error-capture.service';
import { ErrorDeduplicationService } from '../services/error-deduplication.service';
import { ProviderErrorListener } from './provider-error.listener';
import { Logger } from '@nestjs/common';
import { SlackService } from '../../infrastructure/notifications/slack.service';

describe('ProviderErrorListener', () => {
  const createSlackService = (isEnabled = true) =>
    ({ isEnabled }) as unknown as SlackService;
  const flushPromises = async () => {
    await new Promise((resolve) => setImmediate(resolve));
  };

  it('subscribes and unsubscribes on module lifecycle hooks', () => {
    const inspector = {
      on: jest.fn(),
      off: jest.fn(),
    };
    const fintechErrorCaptureService = {
      captureProviderError: jest.fn(),
    };
    const deduplicationService = {
      checkAndRegisterError: jest.fn(),
    };
    const slackQueue = {
      add: jest.fn(),
    };

    const listener = new ProviderErrorListener(
      inspector as unknown as EventBusService,
      fintechErrorCaptureService as unknown as ProviderErrorCaptureService,
      deduplicationService as unknown as ErrorDeduplicationService,
      createSlackService(),
      slackQueue as unknown as Queue<SlackAlertJobData>,
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

  it('skips deduplication and queue when capture result is null', async () => {
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
    const deduplicationService = {
      checkAndRegisterError: jest.fn(),
    };
    const slackQueue = {
      add: jest.fn(),
    };

    const listener = new ProviderErrorListener(
      inspector as unknown as EventBusService,
      fintechErrorCaptureService as unknown as ProviderErrorCaptureService,
      deduplicationService as unknown as ErrorDeduplicationService,
      createSlackService(),
      slackQueue as unknown as Queue<SlackAlertJobData>,
    );

    listener.onModuleInit();

    expect(registeredListener).toBeDefined();

    registeredListener?.({
      provider: 'plaid',
      endpoint: '/plaid/transactions/get',
      statusCode: 429,
      providerPayload: { error_code: 'RATE_LIMIT_EXCEEDED' },
      latency: 25,
    });

    await flushPromises();

    expect(
      fintechErrorCaptureService.captureProviderError,
    ).toHaveBeenCalledWith({
      provider: 'plaid',
      endpoint: '/plaid/transactions/get',
      statusCode: 429,
      providerPayload: { error_code: 'RATE_LIMIT_EXCEEDED' },
      latency: 25,
    });
    expect(deduplicationService.checkAndRegisterError).not.toHaveBeenCalled();
    expect(slackQueue.add).not.toHaveBeenCalled();
  });

  it('enqueues slack alert on first error occurrence (not duplicate)', async () => {
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
    const deduplicationService = {
      checkAndRegisterError: jest
        .fn()
        .mockResolvedValue({ isDuplicate: false, id: 'error_id_1' }),
    };
    const slackQueue = {
      add: jest.fn().mockResolvedValue(undefined),
    };

    const listener = new ProviderErrorListener(
      inspector as unknown as EventBusService,
      fintechErrorCaptureService as unknown as ProviderErrorCaptureService,
      deduplicationService as unknown as ErrorDeduplicationService,
      createSlackService(),
      slackQueue as unknown as Queue<SlackAlertJobData>,
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

    expect(deduplicationService.checkAndRegisterError).toHaveBeenCalledWith(
      expect.objectContaining({
        provider: capturedError.normalizedProvider,
        errorCode: capturedError.errorCode,
        endpoint: capturedError.endpoint,
        statusCode: capturedError.statusCode,
        latency: eventPayload.latency,
        errorType: capturedError.errorType,
        errorMessage: capturedError.errorMessage,
      }),
    );

    expect(slackQueue.add).toHaveBeenCalledWith(SLACK_SEND_ALERT_JOB, {
      text: JSON.stringify(
        {
          providerPayload: eventPayload.providerPayload,
          endpoint: capturedError.endpoint,
          statusCode: capturedError.statusCode,
          provider: 'plaid',
        },
        null,
        2,
      ),
    });
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
    const deduplicationService = {
      checkAndRegisterError: jest
        .fn()
        .mockResolvedValue({ isDuplicate: true, id: 'error_id_1' }),
    };
    const slackQueue = {
      add: jest.fn(),
    };

    const listener = new ProviderErrorListener(
      inspector as unknown as EventBusService,
      fintechErrorCaptureService as unknown as ProviderErrorCaptureService,
      deduplicationService as unknown as ErrorDeduplicationService,
      createSlackService(),
      slackQueue as unknown as Queue<SlackAlertJobData>,
    );

    listener.onModuleInit();

    const eventPayload = {
      provider: 'plaid',
      endpoint: '/plaid/transactions/get',
      statusCode: 429,
      providerPayload: { error_code: 'RATE_LIMIT_EXCEEDED' },
      latency: 15,
    };

    registeredListener?.(eventPayload);

    await flushPromises();

    expect(deduplicationService.checkAndRegisterError).toHaveBeenCalled();
    expect(slackQueue.add).not.toHaveBeenCalled();
  });

  it('does not enqueue slack alert when Slack is not configured', async () => {
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
    const deduplicationService = {
      checkAndRegisterError: jest
        .fn()
        .mockResolvedValue({ isDuplicate: false, id: 1 }),
    };
    const slackQueue = {
      add: jest.fn(),
    };

    const listener = new ProviderErrorListener(
      inspector as unknown as EventBusService,
      fintechErrorCaptureService as unknown as ProviderErrorCaptureService,
      deduplicationService as unknown as ErrorDeduplicationService,
      createSlackService(false),
      slackQueue as unknown as Queue<SlackAlertJobData>,
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
    const deduplicationService = {
      checkAndRegisterError: jest.fn(),
    };
    const slackQueue = {
      add: jest.fn(),
    };

    const listener = new ProviderErrorListener(
      inspector as unknown as EventBusService,
      fintechErrorCaptureService as unknown as ProviderErrorCaptureService,
      deduplicationService as unknown as ErrorDeduplicationService,
      createSlackService(),
      slackQueue as unknown as Queue<SlackAlertJobData>,
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
