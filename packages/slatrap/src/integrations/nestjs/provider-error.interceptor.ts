import {
  CallHandler,
  ExecutionContext,
  HttpException,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable, catchError, throwError } from 'rxjs';
import { Slatrap } from '../../index';

type HttpRequestLike = {
  originalUrl?: string;
  url?: string;
};

/**
 * NestJS HTTP interceptor that automatically captures and emits provider errors through Slatrap.
 *
 * Usage (Global):
 * ```typescript
 * // In app.module.ts
 * import { APP_INTERCEPTOR } from '@nestjs/core';
 * import { SlatrapProviderErrorInterceptor } from '@slatrap/slatrap';
 *
 * @Module({
 *   providers: [
 *     { provide: APP_INTERCEPTOR, useClass: SlatrapProviderErrorInterceptor },
 *   ],
 * })
 * export class AppModule {}
 * ```
 *
 * Usage (Per-Controller):
 * ```typescript
 * import { UseInterceptors } from '@nestjs/common';
 * import { SlatrapProviderErrorInterceptor } from '@slatrap/slatrap';
 *
 * @Controller('plaid')
 * @UseInterceptors(SlatrapProviderErrorInterceptor)
 * export class PlaidController {}
 * ```
 *
 * What it does:
 * 1. Catches all HTTP request pipeline errors (HttpException and raw errors)
 * 2. Detects provider from error response payload via a pluggable provider detector registry
 * 3. Extracts HTTP endpoint and status code
 * 4. Sanitizes sensitive data (access tokens, secrets)
 * 5. Emits structured SlatrapProviderErrorEvent through Slatrap.emit()
 * 6. Re-throws original error to preserve HTTP response behavior
 *
 * Double-emit guard:
 * If the error response is already wrapped as { plaid: {...} } or { stripe: {...} },
 * the interceptor skips emission to avoid duplicates from handlers that already emitted.
 *
 * Requirements:
 * - Slatrap must be configured before app starts (via Slatrap.configureForCoreInspector)
 * - The interceptor is framework-agnostic and works with any error type
 */
@Injectable()
export class ProviderErrorInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const endpoint = this.readEndpoint(context);
    const startedAt = Date.now();

    return next.handle().pipe(
      catchError((error: unknown) => {
        const responsePayload = this.extractResponsePayload(error);

        if (!this.shouldEmit(responsePayload)) {
          return throwError(() => error);
        }

        const emitStartedAt = this.readEmitStartedAt(responsePayload, startedAt);

        void Slatrap.emit(
          Slatrap.sanitize({
            provider: this.detectProvider(responsePayload),
            endpoint,
            statusCode: this.readStatusCode(error),
            providerPayload: Slatrap.sanitize(this.omitStartedAt(responsePayload)),
            startedAt: emitStartedAt,
          }),
        );

        return throwError(() => error);
      }),
    );
  }

  private readEndpoint(context: ExecutionContext): string | undefined {
    if (context.getType<'http' | 'rpc' | 'ws'>() !== 'http') {
      return undefined;
    }

    const request = context.switchToHttp().getRequest<HttpRequestLike>();
    const rawEndpoint = request?.originalUrl ?? request?.url;
    return this.sanitizeEndpoint(rawEndpoint);
  }

  private sanitizeEndpoint(endpoint?: string): string | undefined {
    if (!endpoint) return undefined;

    // Remove query strings and fragments so access tokens/api keys in params are not emitted.
    const withoutQuery = endpoint.split('?')[0]?.split('#')[0] ?? endpoint;

    // Redact values in known sensitive key/value path patterns.
    let redacted = withoutQuery.replace(
      /(access[_-]?token|refresh[_-]?token|api[_-]?key|secret|password|authorization|bearer)\/[^/]+/gi,
      '$1/[REDACTED]',
    );

    // Redact UUID-like and long opaque path segments.
    redacted = redacted
      .replace(
        /\/[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}(?=\/|$)/g,
        '/:id',
      )
      .replace(/\/[A-Za-z0-9_-]{32,}(?=\/|$)/g, '/[REDACTED]');

    return redacted;
  }

  private extractResponsePayload(error: unknown): unknown {
    if (error instanceof HttpException) {
      return error.getResponse();
    }

    const httpLike = error as { response?: { data?: unknown } };
    return httpLike?.response?.data ?? null;
  }

  private detectProvider(payload: unknown): string | undefined {
    if (!this.isRecord(payload)) return undefined;

    if ('error_code' in payload || 'error_type' in payload) return 'plaid';
    if ('type' in payload || 'code' in payload) return 'stripe';

    return undefined;
  }

  private readStatusCode(error: unknown): number | null {
    if (!(error instanceof HttpException)) return null;

    const status = error.getStatus();
    return Number.isFinite(status) ? status : null;
  }

  private shouldEmit(payload: unknown): boolean {
    if (!this.isRecord(payload)) return false;

    // Avoid double-emitting when provider errors are already wrapped by handlers.
    if (this.isRecord(payload['plaid']) || this.isRecord(payload['stripe'])) {
      return false;
    }

    return Boolean(this.detectProvider(payload));
  }

  private readEmitStartedAt(payload: unknown, fallbackStartedAt: number): number {
    if (!this.isRecord(payload)) return fallbackStartedAt;

    const candidate = payload.startedAt;
    if (typeof candidate === 'number' && Number.isFinite(candidate)) {
      return candidate;
    }

    return fallbackStartedAt;
  }

  private omitStartedAt(payload: unknown): unknown {
    if (!this.isRecord(payload)) return payload;

    const { startedAt: _startedAt, ...rest } = payload;
    return rest;
  }

  private isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null;
  }
}
