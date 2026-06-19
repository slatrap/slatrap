# Demo app (this repository)

The NestJS app in the repo root demonstrates [`@slatrap/slatrap`](https://www.npmjs.com/package/@slatrap/slatrap) with the in-repo `@slatrap/slatrap-engine` inspector.

## Architecture

```text
+------------------+
| Customer App     |
|                  |
| slatrap SDK      |
+------------------+
         |
         | sanitized events
         v
+------------------+
| Slatrap Engine   |
|                  |
| - incident rules |
| - grouping       |
| - severity       |
| - impact         |
+------------------+
         |
         +----> PostgreSQL
         |
         +----> Redis Queue
         |
         +----> Slack
```

## Prerequisites

- Node.js 18+
- Docker for the full local stack, or any reachable Postgres and Redis instances if you run the app another way

## Quick start

This repo is already wired end to end. The fastest way to run the complete payment incident monitoring demo is:

Copy `.env.example` to `.env`, then run:

```bash
npm install
docker compose up --build
```

This starts Postgres, Redis, migrations, the Nest app, Prisma Studio, and Stripe CLI when `STRIPE_SECRET_KEY` is set.

Stop everything with:

```bash
docker compose down
```

`slatrap-migrate` showing **Exited** is normal. It runs `prisma migrate deploy` once and stops. `dev` and `prisma-studio` should stay **Up**.

## Services

| URL                   | Service       |
| --------------------- | ------------- |
| http://localhost:3000 | Nest API      |
| http://localhost:5555 | Prisma Studio |
| localhost:5432        | Postgres      |
| localhost:6379        | Redis         |

## Environment

Copy `.env.example` to `.env`. The most important variables are:

```bash
DATABASE_URL="postgresql://postgres:mysecretpassword@localhost:5432/nest_db?schema=public"
SLACK_WEBHOOK_URL="https://hooks.slack.com/services/xxx/yyy/zzz"
REDIS_HOST=127.0.0.1
REDIS_PORT=6379
```

Notes:

- Omit `SLACK_WEBHOOK_URL` to disable Slack delivery.
- Omit Redis settings to run without Redis-backed deduplication and Slack queueing.
- `APP_PROFILE=simulation` and `SIMULATION_INTERNAL_TOKEN` are required for the simulation endpoints.

## Run without Docker for the app process

Use this path if you want Postgres and Redis in Docker but prefer to run Nest on your host.

Copy `.env.example` to `.env`, then run:

```bash
npm install
npm run dev:infra
npx prisma migrate deploy
npm run start:dev
```

Stop infra with:

```bash
npm run dev:infra:down
```

## Stripe webhooks (local)

When using `docker compose up`, the `stripe-cli` container can forward webhooks automatically if `STRIPE_SECRET_KEY` is set. Copy the webhook signing secret from its output into `STRIPE_WEBHOOK_SECRET`, then restart the `dev` service if needed.

If you are running the app on the host instead, start the Stripe listener manually:

```bash
npm run stripe:listen
```

## Simulation

Set `APP_PROFILE=simulation` and `SIMULATION_INTERNAL_TOKEN`. Send requests with header `x-simulation-token`.

```bash
curl -X POST "http://localhost:3000/plaid/no-accounts" \
  -H "x-simulation-token: your-dev-token"
```

`SIMULATION_ENABLED` only enables the Plaid auto-cron; manual endpoints work without it.

### Plaid latency incidents

Set `PLAID_LATENCY_THRESHOLD_MS` (default in `.env.example`: `2000`). Outbound Plaid simulation calls emit `provider.latency` metrics; spikes above the threshold create grouped `latency_incidents` rows and a Slack alert (with `latencyMs` and `thresholdMs`).

Test with:

```bash
curl -X POST "http://localhost:3000/plaid/slow-response" \
  -H "x-simulation-token: your-dev-token" \
  -H "Content-Type: application/json" \
  -d '{"delayMs": 2500}'
```

Repeated slow calls within `LATENCY_INCIDENT_WINDOW_SECONDS` increment the same incident count (Slack fires once).

### Stripe simulation routes

| POST                                                      | Result                                                                  |
| --------------------------------------------------------- | ----------------------------------------------------------------------- |
| `/stripe/account-closed`, `/stripe/insufficient-funds`, … | Real Stripe call → decline (`402`) when `STRIPE_HTTP_TIMEOUT_MS` allows |
| `/stripe/timeout`                                         | Instant timeout (`504`, `api_connection_error`) — no Stripe call        |

Set `STRIPE_HTTP_TIMEOUT_MS` in `.env` (default `30000`) to control outbound timeouts. Restart `dev` after changing it.

## Tests

```bash
npm run test:slatrap
npm run test:slatrap-engine
npm run typecheck
```

## Pack local tarballs (maintainers)

To test a pre-release tarball instead of the registry:

```bash
npm run build:slatrap
cd packages/slatrap && npm pack
```
