# @slatrap/slatrap

[npm version](https://www.npmjs.com/package/@slatrap/slatrap)

Sanitize and emit fintech provider errors (Plaid, Stripe, and similar) without leaking secrets. Framework-agnostic use from Node, Axios, or NestJS.

Published on [npm](https://www.npmjs.com/package/@slatrap/slatrap) under the [@slatrap](https://www.npmjs.com/org/slatrap) scope.

## Install

```bash
npm install @slatrap/slatrap
```

For the Nest interceptor, also install peers:

```bash
npm install @nestjs/common rxjs
```

## Quick start

### 1. Sanitize a payload

Use this anywhere you need a safe object for logs or APIs:

```ts
import { sanitizeErrorData } from '@slatrap/slatrap';

const safe = sanitizeErrorData({
  access_token: 'secret',
  error_code: 'ITEM_LOGIN_REQUIRED',
  error_type: 'ITEM_ERROR',
});

// access_token → [REDACTED]; whitelisted error fields kept
```

### 2. Configure emit once (why and where)

**Why:** Axios middleware, the Nest interceptor, and `Slatrap.emit()` all funnel failures through one place. You should not duplicate “send to Slack / DB / logger” in every file. Instead, register **one handler** at startup; every later `Slatrap.emit()` (automatic or manual) runs that handler after sanitization.

**Where to wire:** Call `configureSlatrap` once when your process starts — for example in `main.ts`, in a Nest `onModuleInit`, or right after you create your event bus. Until you do, `Slatrap.emit()` is a no-op (nothing is sent).

```ts
import { configureSlatrap, Slatrap } from '@slatrap/slatrap';

// Once at application bootstrap
configureSlatrap({
  emit: (payload) => {
    // Examples: console, Pino, Sentry, internal event bus, queue worker
    console.log('provider error', payload);
    // myEventBus.publish('provider.error', payload);
    // mySlackNotifier.send(payload);
  },
});

// Later, from services, interceptors, or catch blocks
void Slatrap.emit({
  provider: 'plaid',
  endpoint: '/plaid/transactions/get',
  statusCode: 400,
  providerPayload: {
    error_code: 'ITEM_LOGIN_REQUIRED',
    error_type: 'ITEM_ERROR',
    request_id: 'req_123',
  },
});
```

**NestJS:** configure in `main.ts` before `listen()`, then attach `ProviderErrorInterceptor` on controllers (see [Nest example](#nestjs-interceptor) below). Failed HTTP calls to providers will sanitize and emit without extra boilerplate in each route.

**Axios:** after `configureSlatrap`, attach `createAxiosResponseErrorInterceptor()`; failed responses sanitize and emit automatically.

**Latency detection signals:** you can detect and emit provider latency with `emitProviderLatency`, or attach `createAxiosLatencyHooks` to automatically detect and emit latency on Axios success/error paths.

## How it works

```
┌─────────────────────────────────────────────────────────────┐
│   Your application                                          │
│                                                             │
│   manual Slatrap.emit()                                     │
│   Axios error interceptor  ────┐                            │
│   Nest ProviderErrorInterceptor│                            │
│                                ▼                            │
│                    sanitize (redact secrets)                │
│                                │                            │
│                         Slatrap.emit()                      │
│                                │                            │
│                                ▼                            │
│              your configureSlatrap({ emit }) handler        │
│         (logger · event bus · Slack · database · etc.)      │
└─────────────────────────────────────────────────────────────┘
```

Sanitization runs again on emit as a safety net. Your `emit` function decides what happens next — this package does not require Slack or Postgres; those are common choices you implement in the handler or in a downstream consumer (see the [demo app](https://github.com/slatrap/slatrap/blob/main/docs/demo-app.md)).

## Examples

### Standalone sanitizer

```ts
import { sanitizeErrorData, SENSITIVE_KEY_PATTERNS } from '@slatrap/slatrap';

const safe = sanitizeErrorData(raw, {
  redactionText: '[REDACTED]',
  whitelist: ['customField'],
});

// Inspect or extend default key rules
console.log(SENSITIVE_KEY_PATTERNS.length);
```

### Axios response interceptor

Bring your own `axios` client. Configure emit first, then attach the interceptor:

```ts
import axios from 'axios';
import {
  configureSlatrap,
  createAxiosResponseErrorInterceptor,
} from '@slatrap/slatrap';

configureSlatrap({ emit: (payload) => myLogger.error(payload) });

const client = axios.create();
client.interceptors.response.use(
  (response) => response,
  createAxiosResponseErrorInterceptor(),
);
```

### Axios latency hooks

Use these hooks when you want explicit provider latency telemetry in addition to error events:

```ts
import axios from 'axios';
import {
  configureSlatrap,
  createAxiosLatencyHooks,
} from '@slatrap/slatrap';

configureSlatrap({
  emit: (payload) => myEventBus.publish('provider.events', payload),
});

const startedAt = Date.now();
const hooks = createAxiosLatencyHooks({
  provider: 'plaid',
  endpoint: '/transactions/get',
  startedAt,
  onError: (error) => Promise.reject(error),
});

const client = axios.create();
client.interceptors.response.use(hooks.onSuccess, hooks.onError);
```

For manual emission without Axios hooks:

```ts
import { emitProviderLatency } from '@slatrap/slatrap';

emitProviderLatency({
  provider: 'stripe',
  endpoint: '/v1/payment_intents',
  startedAt: Date.now() - 450,
  succeeded: true,
  statusCode: 200,
});
```

### NestJS interceptor

```ts
import { Controller, UseInterceptors } from '@nestjs/common';
import { configureSlatrap } from '@slatrap/slatrap';
import { ProviderErrorInterceptor } from '@slatrap/slatrap/nestjs';

configureSlatrap({
  emit: (payload) => myEventBus.publish('provider.error', payload),
});

@Controller('payments')
@UseInterceptors(ProviderErrorInterceptor)
export class PaymentsController {}
```

### Event bus shortcut (demo app style)

Same as `configureSlatrap`, but the library fills in `emit` so your bus receives a normalized `provider.error` payload:

```ts
import { Slatrap } from '@slatrap/slatrap';

Slatrap.configureForCoreInspector({
  emitter: myEventBus,
  providerErrorEventName: 'provider.error',
  defaultProvider: 'plaid',
});
```

Equivalent manual wiring:

```ts
configureSlatrap({
  emit: (payload) => myEventBus.emit('provider.error' /* map payload */),
});
```

### Latency from startedAt

If you pass `startedAt` in emitted payloads, Slatrap derives `latency` automatically when `latency` is not already set.

```ts
void Slatrap.emit({
  provider: 'plaid',
  endpoint: '/transactions/get',
  startedAt: Date.now() - 320,
  providerPayload: { error_code: 'INSTITUTION_DOWN' },
});
```

### Separate instance (no global config)

```ts
import { createSlatrap } from '@slatrap/slatrap';

const tenantSlatrap = createSlatrap({
  emit: (payload) => tenantA.handleError(payload),
});
```

## What gets redacted

By default, keys matching sensitive patterns are replaced with `[REDACTED]`:

- Tokens and secrets: `access_token`, `refresh_token`, `client_secret`, `api_key`, `authorization`, `password`, …
- Account identifiers: account/card/routing patterns, `iban`, `ssn`, and similar (full list in [SENSITIVE_KEY_PATTERNS](https://github.com/slatrap/slatrap/blob/main/packages/slatrap/src/sanitization/sanitizer.ts#L66-L94)).

Import and use the constant in your app:

```ts
import { SENSITIVE_KEY_PATTERNS } from '@slatrap/slatrap';
```

Whitelisted top-level fields (e.g. `provider`, `endpoint`, `statusCode`, `providerPayload`, Plaid `error_code`) are kept. Extend with `whitelist` in `sanitizeErrorData` options.

## API summary


| Export                                                 | Purpose                                                                                                                                               |
| ------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| `sanitizeErrorData`                                    | Redact sensitive fields on any value                                                                                                                  |
| `SENSITIVE_KEY_PATTERNS`                               | Default regex list for sensitive keys ([source](https://github.com/slatrap/slatrap/blob/main/packages/slatrap/src/sanitization/sanitizer.ts#L66-L94)) |
| `Slatrap.sanitize` / `Slatrap.emit`                    | Global sanitize + emit API                                                                                                                            |
| `configureSlatrap`                                     | Set global `emit` handler and redaction defaults (call once at startup)                                                                               |
| `createSlatrap`                                        | Non-global instance with its own handler                                                                                                              |
| `createAxiosResponseErrorInterceptor`                  | Axios error middleware; normalizes timeout failures before `emit` (optional `defaultProvider`, `resolveEndpoint`, `resolveTimeoutMs`)              |
| `isHttpTimeoutError` / `buildHttpTimeoutEmitPayload`  | Detect HTTP timeouts and build a provider-agnostic emit payload (`504`, `error_type: timeout`)                                                       |
| `fetchWithTimeout`                                     | `fetch` with `AbortSignal.timeout`; optional `formatTimeoutError` for provider-specific transport errors                                            |
| `createAxiosLatencyHooks` / `emitProviderLatency`      | Emit provider latency telemetry for success and error paths (core event: `provider.latency`)                                                         |
| `buildProviderLatencyEmitPayload`                      | Build a core latency event envelope from provider/endpoint/timing inputs                                                                              |
| `PROVIDER_LATENCY_EVENT_NAME`                          | Constant event name for provider latency envelopes (`provider.latency`)                                                                               |
| `resolveAxiosResponseStatus`                           | Extract HTTP status from Axios responses/errors for latency/error classification                                                                       |
| `@slatrap/slatrap/nestjs` → `ProviderErrorInterceptor` | Nest HTTP interceptor (peer: `@nestjs/common`, `rxjs`)                                                                                                |
| `configureSlatrapForCoreInspector`                     | Map emits to your event bus by event name                                                                                                             |


## Related

- **Demo app** (Slack, database, dedup): [docs/demo-app.md](https://github.com/slatrap/slatrap/blob/main/docs/demo-app.md)
- **Monorepo root:** [github.com/slatrap/slatrap](https://github.com/slatrap/slatrap)

## License

MIT