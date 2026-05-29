# Slatrap

Slatrap is a fintech error-capture toolkit for Plaid and Stripe style integrations.
It standardizes provider errors, emits monitoring events, and redacts sensitive data before emission.

## What it includes

- @slatrap/slatrap: sanitization, emit API, axios error middleware, Nest interceptor.
- @slatrap/core: inspector runtime with deduplication, persistence, and notification pipeline.

## Runtime flow (Redis, Database, Slack)

1. Provider error event is emitted from interceptor, middleware, or manual Slatrap.emit.  
2. Core listener normalizes and deduplicates errors using Redis.
3. First occurrences are persisted to database.
4. Alert payload is queued and sent to Slack webhook.

## Sensitive data protection

Sensitive fields are redacted automatically (for example access_token, refresh_token, client_secret, api_key, authorization, password, account and card identifiers).

In normal usage, raw secret values are not visible in emitted payloads.

## Quick setup

### Install packages

If you already have the package tarballs (`.tgz`), install them directly:

```bash
npm install /path/to/slatrap-package.tgz /path/to/core-package.tgz
```

If you don't have tarballs yet, you can build + pack them from this repo:

```bash
npm install
npm run build

cd packages/core && npm pack
cd ../slatrap && npm pack
```

### Start dependencies (Redis + Postgres)

Start Redis and Postgres with Docker Compose:

```bash
npm run dev:infra
```

Stop them when done:

```bash
npm run dev:infra:down
```

### Configure environment

Create `.env` (or `.env.local` for local overrides):

```bash
# Database (optional — omit to skip persistence; Redis dedup still works)
# docker-compose.yml defaults:
# - user: postgres
# - password: mysecretpassword
# - db: nest_db
DATABASE_URL="postgresql://postgres:mysecretpassword@localhost:5432/nest_db?schema=public"

# Slack (optional — omit to skip Slack alerts)
SLACK_WEBHOOK_URL="https://hooks.slack.com/services/xxx/yyy/zzz"

# Redis (optional — omit host for in-memory dedup; set host to enable Redis dedup + queued Slack alerts)
REDIS_HOST=127.0.0.1
REDIS_PORT=6379
REDIS_USERNAME=
REDIS_PASSWORD=
```

### Initialize database schema

Run Prisma migrations:

```bash
npx prisma migrate deploy
```

### Start the app

Run the Nest server in watch mode:

```bash
npm run start:dev
```

Useful scripts:

```bash
# Infrastructure
npm run dev:infra
npm run dev:infra:down

# App
npm run start:dev

# Tests
npm run test
npm run test:core
npm run test:slatrap
npm run test:e2e
```

Configure inspector (Nest):

```ts
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import {
  InspectorCoreModule,
  createInspectorCoreOptionsFromConfigService,
} from '@slatrap/core';

@Module({
  imports: [
    InspectorCoreModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) =>
        createInspectorCoreOptionsFromConfigService(config),
    }),
  ],
})
export class AppModule {}
```

Or pass options directly (all optional):

```ts
InspectorCoreModule.forRoot({
  databaseUrl: process.env.DATABASE_URL,
  slackWebhookUrl: process.env.SLACK_WEBHOOK_URL,
  redis: process.env.REDIS_HOST
    ? { host: process.env.REDIS_HOST, port: 6379 }
    : undefined,
});
```

When `redis` is set, Slack alerts are enqueued (BullMQ) so the error handler returns quickly. Without Redis, dedup uses in-memory storage and Slack is sent directly.

Wire Slatrap emit API to the core event bus (required once per app process; otherwise `Slatrap.emit()` is a no-op):

```ts
import { Injectable, OnModuleInit } from '@nestjs/common';
import { Slatrap } from '@slatrap/slatrap';
import { EventBusService, PROVIDER_ERROR_EVENT } from '@slatrap/core';

@Injectable()
export class SlatrapBootstrapService implements OnModuleInit {
	constructor(private readonly inspector: EventBusService) {}

	onModuleInit() {
		Slatrap.configureForCoreInspector({
			emitter: this.inspector,
			providerErrorEventName: PROVIDER_ERROR_EVENT,
			defaultProvider: 'plaid',
		});
	}
}
```

Register it in the same Nest module that imports `InspectorCoreModule` (this repo: `AppProductionModule`):

```ts
@Module({
  imports: [InspectorCoreModule.forRootAsync({ /* ... */ })],
  providers: [SlatrapBootstrapService],
})
export class AppModule {}
```

Alternative: call `Slatrap.configureForCoreInspector(...)` once in `main.ts` after `NestFactory.create`, using `app.get(EventBusService)` — no extra provider class needed.

Use as axios error middleware:

```ts
import axios from 'axios';
import { createAxiosResponseErrorInterceptor } from '@slatrap/slatrap';

const client = axios.create();
client.interceptors.response.use(
	(response) => response,
	createAxiosResponseErrorInterceptor(),
);
```

Use as Nest interceptor:

```ts
import { Controller, UseInterceptors } from '@nestjs/common';
import { ProviderErrorInterceptor } from '@slatrap/slatrap';

@Controller('payments')
@UseInterceptors(ProviderErrorInterceptor)
export class PaymentsController {}
```

## Stripe webhooks (local)

If you want to receive and inspect real Stripe webhook events locally, run the Stripe CLI forwarder:

```bash
npm run stripe:listen
```

This forwards Stripe events to `http://localhost:3000/stripe/webhook`.

Required env vars for webhook verification:

```bash
STRIPE_WEBHOOK_SECRET="whsec_..."
STRIPE_SECRET_KEY="sk_..."
```

## Provider error payload format (for emit)

Plaid error payloads are expected in Plaid format (common fields):

```json
{
	"error_code": "ITEM_LOGIN_REQUIRED",
	"error_type": "ITEM_ERROR",
	"error_message": "Item requires user re-authentication",
	"request_id": "req_123"
}
```

Stripe error payloads are expected in Stripe format (common fields):

```json
{
	"type": "card_error",
	"code": "insufficient_funds",
	"decline_code": "insufficient_funds",
	"message": "Your card has insufficient funds.",
	"request_id": "req_123"
}
```

Important for Plaid emits:

- Emit with `provider: 'plaid'`.
- Put the provider response in `providerPayload` using Plaid keys (`error_code`, `error_type`, `error_message`, `request_id`).
- Include Plaid metadata when available (`itemId`, `institutionId`, `institutionName`) so inspector and alerts can enrich records correctly.

## Simulation

Simulation endpoints let you trigger provider-like failures safely in local/sandbox runs.

The simulation app profile is selected at bootstrap time:

- Set `APP_PROFILE=simulation` to start the simulation modules.
- `NODE_ENV=production` cannot be used with `APP_PROFILE=simulation`.

Simulation endpoints are also guarded by:

- an internal-network check (localhost/private IPs are allowed), and
- an internal token header (`x-simulation-token`) matching `SIMULATION_INTERNAL_TOKEN`.

Notes:

- `SIMULATION_ENABLED` is **not required** for manual testing; it only toggles the **Plaid auto-simulation cron** that may trigger scenarios periodically.
- Stripe simulations are **manual only** (no automatic cron runner).

Minimum env vars for manual simulation requests:

```bash
APP_PROFILE=simulation
SIMULATION_INTERNAL_TOKEN="your-dev-token"
```

- Examples:
	- POST /plaid/no-accounts
	- POST /plaid/invalid-access-token
	- POST /stripe/insufficient-funds
	- POST /stripe/fraudulent

Manual request example (same headers you’d set in Postman):

```bash
curl -X POST "http://localhost:3000/plaid/no-accounts" ^
  -H "x-simulation-token: your-dev-token"
```
