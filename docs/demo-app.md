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

## Infrastructure

```bash
npm run dev:infra
npm run dev:infra:down   # stop
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

```bash
npx prisma migrate deploy
```

## Run the app

```bash
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

## Stripe webhooks (local)

```bash
npm run stripe:listen
```

Requires `STRIPE_WEBHOOK_SECRET` and `STRIPE_SECRET_KEY` in `.env`.

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
