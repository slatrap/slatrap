import { ExecutionContext, HttpException, HttpStatus } from '@nestjs/common';
import { of, lastValueFrom, Observable } from 'rxjs';
import { configureSlatrap } from '../../index';
import { ProviderErrorInterceptor } from './provider-error.interceptor';

// ─── helpers ────────────────────────────────────────────────────────────────

function makeHttpContext(url = '/plaid/transactions'): ExecutionContext {
  return {
    getType: () => 'http',
    switchToHttp: () => ({
      getRequest: () => ({ originalUrl: url }),
    }),
  } as unknown as ExecutionContext;
}

function makeNonHttpContext(): ExecutionContext {
  return { getType: () => 'rpc' } as unknown as ExecutionContext;
}

function makeHandler(error?: unknown) {
  return {
    handle: () =>
      error !== undefined
        ? new Observable((s) => {
            s.error(error);
          })
        : of({ ok: true }),
  };
}

/** Build an axios-like error whose response.data carries the given payload. */
function makeAxiosLikeError(data: unknown, status = 400): Error {
  const err = new Error('request failed') as Error & { response: unknown };
  err.response = { data, status };
  return err;
}

// ─── suite ──────────────────────────────────────────────────────────────────

describe('ProviderErrorInterceptor', () => {
  let interceptor: ProviderErrorInterceptor;
  let emit: jest.Mock;

  const getEmitted = () => (emit.mock.calls[0] as [Record<string, unknown>])[0];

  beforeEach(() => {
    interceptor = new ProviderErrorInterceptor();
    emit = jest.fn();
    configureSlatrap({ emit });
  });

  afterEach(() => {
    jest.restoreAllMocks();
    configureSlatrap({ emit: () => undefined });
  });

  // ── pass-through ────────────────────────────────────────────────────────

  it('passes successful responses through untouched', async () => {
    const result = await lastValueFrom(
      interceptor.intercept(makeHttpContext(), makeHandler()),
    );
    expect(result).toEqual({ ok: true });
    expect(emit).not.toHaveBeenCalled();
  });

  // ── endpoint ────────────────────────────────────────────────────────────

  it('reads originalUrl as endpoint from the HTTP request', async () => {
    const error = new HttpException({ error_code: 'INSTITUTION_DOWN' }, 503);
    await expect(
      lastValueFrom(
        interceptor.intercept(
          makeHttpContext('/plaid/institution-down'),
          makeHandler(error),
        ),
      ),
    ).rejects.toBe(error);

    const emitted = getEmitted();
    expect(emitted.endpoint).toBe('/plaid/institution-down');
  });

  it('sanitizes endpoint by stripping query and redacting sensitive path segments', async () => {
    const error = new HttpException({ error_code: 'INSTITUTION_DOWN' }, 503);
    await expect(
      lastValueFrom(
        interceptor.intercept(
          makeHttpContext(
            '/plaid/access_token/sk_test_abcdefghijklmnopqrstuvwxyz123456?api_key=very-secret',
          ),
          makeHandler(error),
        ),
      ),
    ).rejects.toBe(error);

    const emitted = getEmitted();
    expect(emitted.endpoint).toBe('/plaid/access_token/[REDACTED]');
  });

  it('sets endpoint to undefined for non-HTTP contexts', async () => {
    const error = new HttpException({ error_code: 'INSTITUTION_DOWN' }, 503);
    await expect(
      lastValueFrom(
        interceptor.intercept(makeNonHttpContext(), makeHandler(error)),
      ),
    ).rejects.toBe(error);

    const emitted = getEmitted();
    expect(emitted.endpoint == null).toBe(true);
  });

  // ── provider detection ──────────────────────────────────────────────────

  it('detects plaid from error_code field in HttpException response', async () => {
    const error = new HttpException(
      { error_code: 'NO_ACCOUNTS', error_type: 'ITEM_ERROR' },
      400,
    );
    await expect(
      lastValueFrom(
        interceptor.intercept(makeHttpContext(), makeHandler(error)),
      ),
    ).rejects.toBe(error);

    const emitted = getEmitted();
    expect(emitted.provider).toBe('plaid');
  });

  it('detects stripe from type/code fields in HttpException response', async () => {
    const error = new HttpException(
      { type: 'invalid_request_error', code: 'parameter_missing' },
      400,
    );
    await expect(
      lastValueFrom(
        interceptor.intercept(makeHttpContext(), makeHandler(error)),
      ),
    ).rejects.toBe(error);

    const emitted = getEmitted();
    expect(emitted.provider).toBe('stripe');
  });

  it('detects plaid from error_code in axios-like error response data', async () => {
    const error = makeAxiosLikeError(
      { error_code: 'RATE_LIMIT_EXCEEDED' },
      429,
    );
    await expect(
      lastValueFrom(
        interceptor.intercept(makeHttpContext(), makeHandler(error)),
      ),
    ).rejects.toBe(error);

    const emitted = getEmitted();
    expect(emitted.provider).toBe('plaid');
  });

  it('skips emit when provider cannot be inferred from payload', async () => {
    const error = new HttpException({ message: 'Unknown error' }, 500);
    await expect(
      lastValueFrom(
        interceptor.intercept(
          makeHttpContext('/unknown/route'),
          makeHandler(error),
        ),
      ),
    ).rejects.toBe(error);

    expect(emit).not.toHaveBeenCalled();
  });

  // ── status code ─────────────────────────────────────────────────────────

  it('reads statusCode from HttpException', async () => {
    const error = new HttpException(
      { error_code: 'ACCOUNTS_LIMIT' },
      HttpStatus.TOO_MANY_REQUESTS,
    );
    await expect(
      lastValueFrom(
        interceptor.intercept(makeHttpContext(), makeHandler(error)),
      ),
    ).rejects.toBe(error);

    const emitted = getEmitted();
    expect(emitted.statusCode).toBe(429);
  });

  it('sets statusCode to null for non-HttpException errors', async () => {
    const error = makeAxiosLikeError({ error_code: 'RATE_LIMIT_EXCEEDED' });
    await expect(
      lastValueFrom(
        interceptor.intercept(makeHttpContext(), makeHandler(error)),
      ),
    ).rejects.toBe(error);

    const emitted = getEmitted();
    expect(emitted.statusCode).toBeNull();
  });

  // ── double-emit guard ───────────────────────────────────────────────────

  it('skips emit for HttpException already wrapped as { plaid: {...} } (PlaidErrorHandler already emitted)', async () => {
    const error = new HttpException(
      { plaid: { error_code: 'ITEM_LOGIN_REQUIRED' } },
      400,
    );
    await expect(
      lastValueFrom(
        interceptor.intercept(makeHttpContext(), makeHandler(error)),
      ),
    ).rejects.toBe(error);

    expect(emit).not.toHaveBeenCalled();
  });

  it('skips emit for HttpException already wrapped as { stripe: {...} }', async () => {
    const error = new HttpException(
      { stripe: { code: 'insufficient_funds' } },
      402,
    );
    await expect(
      lastValueFrom(
        interceptor.intercept(makeHttpContext(), makeHandler(error)),
      ),
    ).rejects.toBe(error);

    expect(emit).not.toHaveBeenCalled();
  });

  // ── sanitization ────────────────────────────────────────────────────────

  it('sanitizes sensitive fields in providerPayload before emitting', async () => {
    const error = new HttpException(
      {
        type: 'invalid_request_error',
        code: 'parameter_missing',
        access_token: 'secret-token',
      },
      400,
    );

    await expect(
      lastValueFrom(
        interceptor.intercept(makeHttpContext(), makeHandler(error)),
      ),
    ).rejects.toBe(error);

    const emitted = getEmitted();
    const providerPayload = emitted.providerPayload as Record<string, unknown>;
    expect(providerPayload.access_token).toBe('[REDACTED]');
  });

  // ── startedAt promotion ─────────────────────────────────────────────────

  it('promotes startedAt from the error response to the emit envelope', async () => {
    jest.spyOn(Date, 'now').mockReturnValue(10_000);

    const error = new HttpException(
      {
        type: 'card_error',
        code: 'card_declined',
        startedAt: 7_500,
      },
      402,
    );
    await expect(
      lastValueFrom(
        interceptor.intercept(makeHttpContext('/stripe/webhook'), makeHandler(error)),
      ),
    ).rejects.toBe(error);

    const emitted = getEmitted();
    expect(emitted.startedAt).toBeUndefined();
    expect(emitted.latency).toBe(2_500);
    expect(emitted.providerPayload).toEqual({
      type: 'card_error',
      code: 'card_declined',
    });
  });

  // ── re-throw ─────────────────────────────────────────────────────────────

  it('always re-throws the original error after emitting', async () => {
    const error = new HttpException({ error_code: 'INSTITUTION_DOWN' }, 503);
    await expect(
      lastValueFrom(
        interceptor.intercept(makeHttpContext(), makeHandler(error)),
      ),
    ).rejects.toBe(error);
  });
});
