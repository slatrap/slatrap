import {
  buildHttpTimeoutEmitPayload,
  buildHttpTimeoutTransportError,
  fetchWithTimeout,
  isHttpTimeoutError,
  parseHttpTimeoutMs,
  resolveEmitPayloadForHttpError,
} from './http-timeout';

describe('http-timeout', () => {
  describe('parseHttpTimeoutMs', () => {
    it('parses numeric strings from environment variables', () => {
      expect(parseHttpTimeoutMs('15000')).toBe(15_000);
    });

    it('falls back when value is missing or invalid', () => {
      expect(parseHttpTimeoutMs(undefined)).toBe(30_000);
      expect(parseHttpTimeoutMs('not-a-number')).toBe(30_000);
    });
  });

  describe('isHttpTimeoutError', () => {
    it('detects AbortError, TimeoutError, and axios timeout codes', () => {
      expect(
        isHttpTimeoutError(
          Object.assign(new Error('aborted'), { name: 'AbortError' }),
        ),
      ).toBe(true);
      expect(
        isHttpTimeoutError(
          Object.assign(new Error('timed out'), { name: 'TimeoutError' }),
        ),
      ).toBe(true);
      expect(isHttpTimeoutError({ code: 'ECONNABORTED' })).toBe(true);
      expect(isHttpTimeoutError({ code: 'ETIMEDOUT' })).toBe(true);
    });
  });

  describe('buildHttpTimeoutEmitPayload', () => {
    it('builds a provider-agnostic emit payload', () => {
      expect(
        buildHttpTimeoutEmitPayload({
          provider: 'stripe',
          endpoint: '/payment_intents',
          timeoutMs: 30_000,
          startedAt: 1_958,
        }),
      ).toEqual({
        provider: 'stripe',
        endpoint: '/payment_intents',
        statusCode: 504,
        startedAt: 1_958,
        providerPayload: {
          error_type: 'timeout',
          code: 'timeout',
          message: 'HTTP request timed out after 30000ms',
        },
      });
    });
  });

  describe('resolveEmitPayloadForHttpError', () => {
    it('normalizes timeout errors for emit', () => {
      const payload = resolveEmitPayloadForHttpError(
        Object.assign(new Error('aborted'), { name: 'AbortError' }),
        {
          defaultProvider: 'stripe',
          resolveEndpoint: () => '/payment_intents',
          resolveTimeoutMs: () => 12_000,
        },
      );

      expect(payload).toEqual(
        buildHttpTimeoutEmitPayload({
          provider: 'stripe',
          endpoint: '/payment_intents',
          timeoutMs: 12_000,
        }),
      );
    });

    it('returns the original error for non-timeout failures', () => {
      const error = { message: 'boom' };
      expect(resolveEmitPayloadForHttpError(error, undefined)).toBe(error);
    });
  });

  describe('fetchWithTimeout', () => {
    it('wraps fetch abort failures as transport errors', async () => {
      const fetchMock = jest
        .spyOn(global, 'fetch')
        .mockRejectedValue(
          Object.assign(new Error('The operation timed out'), {
            name: 'TimeoutError',
          }),
        );

      await expect(
        fetchWithTimeout('https://example.test', { timeoutMs: 5_000 }),
      ).rejects.toMatchObject({
        response: {
          status: 504,
          data: {
            error_type: 'timeout',
            code: 'timeout',
          },
        },
      });

      fetchMock.mockRestore();
    });
  });

  describe('buildHttpTimeoutTransportError', () => {
    it('supports custom provider-specific response bodies', () => {
      const error = buildHttpTimeoutTransportError({
        timeoutMs: 10_000,
        data: {
          error: {
            type: 'api_connection_error',
            code: 'timeout',
            message: 'Stripe API request timed out after 10000ms',
          },
        },
      });

      expect(error.response.data).toEqual({
        error: {
          type: 'api_connection_error',
          code: 'timeout',
          message: 'Stripe API request timed out after 10000ms',
        },
      });
    });
  });
});
