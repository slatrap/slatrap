# Slatrap

**Slatrap** helps fintech teams handle payment and provider failures without leaking secrets or losing signal.

When Plaid, Stripe, or similar APIs return errors, raw payloads often contain tokens, account identifiers, and other sensitive fields. Slatrap gives you a small, focused pipeline:

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

## Install

Published on npm as [`@slatrap/slatrap`](https://www.npmjs.com/package/@slatrap/slatrap):

```bash
npm install @slatrap/slatrap
```

Nest interceptor (optional peers):

```bash
npm install @nestjs/common rxjs
```

**API reference and examples:** [packages/slatrap/README.md](packages/slatrap/README.md)

## Try the full stack locally

This repository includes a demo NestJS app that wires sanitize + emit into Slack alerts and database persistence (with optional Redis deduplication). See [docs/demo-app.md](docs/demo-app.md).

## Develop in this monorepo

```bash
npm run build:slatrap
npm run test:slatrap
npm run test:core
npm run typecheck
```

## License

MIT — see [LICENSE](LICENSE).
