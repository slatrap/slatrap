# Slatrap

Payment incident intelligence for Stripe, Plaid and custom APIs.

## Demo

Stripe simulation → webhook → sanitized error → database + Slack (~11s).

https://github.com/user-attachments/assets/5745a130-9b86-4a45-bcb2-1fa36ec2eb7e

## How it works

                   Customer Application
                            |
                            |
                          Slatrap
                  (sanitize errors + emit)
                            |
                            |
                  In-process Event Bus
                    (demo app wiring)
                            |
                            |
                      Slatrap Engine
            (incident detection & intelligence)
                            |
              +-------------+--------------+
              |             |              |
            PostgreSQL      Slack     Redis (optional)

The demo app wires the SDK directly into the engine's in-process event bus. Redis is optional and is used for deduplication and queued Slack delivery, not as the main event transport.

## Sanitize — keep data safe

Redact sensitive keys before anything hits logs, queues, or storage. Whitelisted error fields (codes, types, request IDs) stay intact so you can still debug.

```ts
import { sanitizeErrorData } from '@slatrap/slatrap';

const safe = sanitizeErrorData(providerError);
// access_token → [REDACTED]; error_code and error_type preserved
```

## Emit — stay informed and learn over time

Turn provider failures into structured events you wire once from your app. A typical Slatrap setup uses **emit** to:

- **Alert the team** — notify Slack when something new breaks (with deduplication so the same incident does not spam the channel).
- **Persist for analysis** — save normalized errors to a database so you can query trends, compare endpoints, and review history later.

```ts
import { configureSlatrap, Slatrap } from '@slatrap/slatrap';

configureSlatrap({
  emit: (payload) => {
    // Your bus, inspector, or custom handler — e.g. Slack + DB in the demo app
  },
});

await Slatrap.emit({
  provider: 'plaid',
  endpoint: '/transactions/get',
  statusCode: 400,
  providerPayload: safe,
});
```

Works from plain Node, Axios interceptors, or NestJS (`@slatrap/slatrap/nestjs`).

## Path 1 — Add Slatrap to your existing infrastructure

Use this path if your team already has an event bus, queue, alerting pipeline, database, or incident workflow and you only need Slatrap for sanitization and structured error emission.

Published on npm as [`@slatrap/slatrap`](https://www.npmjs.com/package/@slatrap/slatrap):

```bash
npm install @slatrap/slatrap
```

Nest interceptor (optional peers):

```bash
npm install @nestjs/common rxjs
```

You keep your existing infrastructure and wire Slatrap's `emit` hook into it. Typical destinations are your own queue, worker, incident service, Slack notifier, or database writer.

**API reference and examples:** [packages/slatrap/README.md](packages/slatrap/README.md)

## Path 2 — Run a complete payment incident monitoring system

Use this path if you want a complete working system instead of only the SDK. This repository includes a demo NestJS app plus the in-repo engine for incident detection, database persistence, Slack alerts, and optional Redis-backed deduplication/queueing.

Run **`docker compose up --build`** to start the full stack locally. For setup details, environment variables, and simulation flows, see [docs/demo-app.md](docs/demo-app.md).

## Develop in this monorepo

```bash
docker compose up --build
npm run build:slatrap
npm run test:slatrap
npm run test:slatrap-engine
npm run typecheck
```

## License

MIT — see [LICENSE](LICENSE).
