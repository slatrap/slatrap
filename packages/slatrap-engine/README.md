# @slatrap/slatrap-engine

NestJS inspector for [Slatrap](https://www.npmjs.com/package/@slatrap/slatrap): incident detection, Prisma persistence, Slack alerts, and optional Redis-backed deduplication/queueing.

## Role

**Publishable package** (workspace member today; intended for independent install once released).

| Package | Role |
| --- | --- |
| [`@slatrap/slatrap`](https://www.npmjs.com/package/@slatrap/slatrap) | Public SDK — sanitize + emit |
| `@slatrap/slatrap-engine` | NestJS inspector — consume SDK events and run incident workflows |

```ts
import {
  InspectorCoreModule,
  EventBusService,
  PROVIDER_ERROR_EVENT,
} from '@slatrap/slatrap-engine';
```

In this monorepo the demo app depends on it via npm workspaces. Build output lives in `dist/src` and is produced by this package’s own `tsc` — not by Nest compiling the demo app.

## Install (when published)

```bash
npm install @slatrap/slatrap-engine @slatrap/slatrap
```

Also install peers your app uses:

```bash
npm install @nestjs/common @nestjs/core @nestjs/config @nestjs/bullmq \
  @prisma/client @prisma/adapter-pg bullmq ioredis reflect-metadata rxjs
```

## Build and test

From this package:

```bash
npm run build
npm test
```

From the repo root:

```bash
npm run build:slatrap-engine
npm run test:slatrap-engine
```

`npm run build` compiles only `packages/slatrap-engine/src` into `packages/slatrap-engine/dist/src`. There is no root `postbuild` sync step.

## Peer dependencies

| Peer | Why |
| --- | --- |
| `@nestjs/*`, `rxjs`, `reflect-metadata` | Nest module, listeners, DI |
| `@prisma/client`, `@prisma/adapter-pg` | Persistence |
| `bullmq`, `@nestjs/bullmq`, `ioredis` | Slack queue + dedup store |

The host app owns Prisma schema generation (`prisma generate` at the app root in this repo).

## Wire with the SDK

Configure `@slatrap/slatrap` to emit into the engine event bus (see the demo app’s `SlatrapBootstrapService`).
