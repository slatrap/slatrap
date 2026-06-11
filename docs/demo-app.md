# Demo app (this repository)

The NestJS app in the repo root demonstrates [`@slatrap/slatrap`](https://www.npmjs.com/package/@slatrap/slatrap) with the in-repo `@slatrap/core` inspector (not on npm yet).

## Prerequisites

- Node.js 18+
- Docker (optional, for Postgres + Redis)

## Install and build

```bash
npm install
npm run build
```

## One-command dev stack (Docker)

Starts **Postgres**, **Redis**, runs **migrations**, then **Nest** (`start:dev`), **Prisma Studio**, and **Stripe CLI** (if `STRIPE_SECRET_KEY` is set):

```bash
npm install
cp .env.example .env   # set APP_PROFILE=simulation, SIMULATION_INTERNAL_TOKEN, etc.
docker compose up --build
```

Stop everything with `docker compose down`.

`slatrap-migrate` showing **Exited** is normal — it runs `prisma migrate deploy` once and stops. `dev` and `prisma-studio` should stay **Up**.

| URL                   | Service       |
| --------------------- | ------------- |
| http://localhost:3000 | Nest API      |
| http://localhost:5555 | Prisma Studio |
| localhost:5432        | Postgres      |
| localhost:6379        | Redis         |

**Infra only** (db + redis, run the app on your host):

```bash
npm run dev:infra
npm run dev:infra:down
```

## Environment

Copy `.env.example` to `.env`. Important variables:

```bash
# Optional — omit to disable feature
DATABASE_URL="postgresql://postgres:mysecretpassword@localhost:5432/nest_db?schema=public"
SLACK_WEBHOOK_URL="https://hooks.slack.com/services/xxx/yyy/zzz"
REDIS_HOST=127.0.0.1
REDIS_PORT=6379
```

## Database

Migrations run automatically when using `docker compose up`. To run manually on the host:

```bash
npx prisma migrate deploy
```

## Run the app (without Docker dev stack)

```bash
npm run dev:infra
npx prisma migrate deploy
npm run start:dev
```

## Wire Slatrap to core

Register `SlatrapBootstrapService` in `AppProductionModule` and import `InspectorCoreModule.forRootAsync` via `createAppCoreImports()` — see `src/app-core-imports.ts` and `src/bootstrap/slatrap-bootstrap.service.ts`.

## Simulation

Set `APP_PROFILE=simulation` and `SIMULATION_INTERNAL_TOKEN`. Send requests with header `x-simulation-token`.

```bash
curl -X POST "http://localhost:3000/plaid/no-accounts" \
  -H "x-simulation-token: your-dev-token"
```

`SIMULATION_ENABLED` only enables the Plaid auto-cron; manual endpoints work without it.

### Stripe simulation routes

| POST                                                      | Result                                                                  |
| --------------------------------------------------------- | ----------------------------------------------------------------------- |
| `/stripe/account-closed`, `/stripe/insufficient-funds`, … | Real Stripe call → decline (`402`) when `STRIPE_HTTP_TIMEOUT_MS` allows |
| `/stripe/timeout`                                         | Instant timeout (`504`, `api_connection_error`) — no Stripe call        |

Set `STRIPE_HTTP_TIMEOUT_MS` in `.env` (default `30000`) to control outbound timeouts. Restart `dev` after changing it.

## Stripe webhooks (local)

Included in `docker compose up` via the `stripe-cli` container when `STRIPE_SECRET_KEY` is in `.env`. Copy the webhook signing secret from the CLI output into `STRIPE_WEBHOOK_SECRET`, then restart the `dev` service if needed.

Or run on the host only:

```bash
npm run stripe:listen
```

## Tests

```bash
npm run test:slatrap
npm run test:core
npm run typecheck
```

## Pack local tarballs (maintainers)

To test a pre-release tarball instead of the registry:

```bash
npm run build:slatrap
cd packages/slatrap && npm pack
```
