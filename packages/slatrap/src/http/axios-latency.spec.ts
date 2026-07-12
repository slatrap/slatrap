import axios from 'axios';
import {
  createAxiosLatencyHooks,
  emitProviderLatency,
  resolveAxiosResponseStatus,
} from './axios-latency';
import { PROVIDER_LATENCY_EVENT_NAME } from '../core/provider-latency-emit';

describe('axios-latency', () => {
  describe('resolveAxiosResponseStatus', () => {
    it('returns response status for axios errors', () => {
      const error = new axios.AxiosError('bad request');
      error.response = { status: 429 } as never;

      expect(resolveAxiosResponseStatus(error)).toBe(429);
    });

    it('returns null for non-axios errors', () => {
      expect(resolveAxiosResponseStatus(new Error('nope'))).toBeNull();
    });
  });

  describe('emitProviderLatency', () => {
    it('emits a provider latency envelope', () => {
      const emit = jest.fn();
      const slatrap = { emit } as never;
      const startedAt = Date.now() - 50;

      emitProviderLatency(slatrap, {
        provider: 'plaid',
        endpoint: '/accounts/get',
        startedAt,
        success: true,
        statusCode: 200,
      });

      expect(emit).toHaveBeenCalledWith({
        eventName: PROVIDER_LATENCY_EVENT_NAME,
        payload: expect.objectContaining({
          provider: 'plaid',
          endpoint: '/accounts/get',
          startedAt,
          success: true,
          statusCode: 200,
        }),
      });
    });
  });

  describe('createAxiosLatencyHooks', () => {
    it('emits latency on success', async () => {
      const emit = jest.fn();
      const slatrap = { emit } as never;
      const hooks = createAxiosLatencyHooks(slatrap, {
        provider: 'plaid',
        endpoint: '/item/get',
        startedAt: Date.now(),
      });

      const response = await hooks.onSuccess({
        status: 200,
        data: {},
      } as never);

      expect(response.status).toBe(200);
      expect(emit).toHaveBeenCalledTimes(1);
    });

    it('emits latency then delegates to onError', async () => {
      const emit = jest.fn();
      const slatrap = { emit } as never;
      const onError = jest.fn().mockRejectedValue(new Error('handled'));
      const hooks = createAxiosLatencyHooks(slatrap, {
        provider: 'plaid',
        endpoint: '/item/get',
        startedAt: Date.now(),
        onError,
      });

      const error = new axios.AxiosError('failed');
      error.response = { status: 400 } as never;

      await expect(hooks.onError(error)).rejects.toThrow('handled');
      expect(emit).toHaveBeenCalledTimes(1);
      expect(onError).toHaveBeenCalledWith(error);
    });
  });
});
