# Slatrap

Fintech error toolkit: **sanitize** provider payloads, **emit** structured events, and optionally run the in-repo **inspector** (dedup, DB, Slack).

## Packages

| Package | npm | Description |
| --- | --- | --- |
| [`@slatrap/slatrap`](packages/slatrap/README.md) | [Published](https://www.npmjs.com/package/@slatrap/slatrap) · `npm install @slatrap/slatrap` | Sanitize + emit API, Axios helper, Nest via `@slatrap/slatrap/nestjs` |
| `@slatrap/core` | Not on npm yet | Inspector runtime in `packages/core` |

**Documentation for npm users:** [packages/slatrap/README.md](packages/slatrap/README.md)

## Install from npm

```bash
npm install @slatrap/slatrap
```

Nest interceptor (optional peers):

```bash
npm install @nestjs/common rxjs
```

## Run this repo locally

See [docs/demo-app.md](docs/demo-app.md) for Docker, Prisma, simulation endpoints, and `npm run start:dev`.

## Monorepo scripts

```bash
npm run build:slatrap   # build publishable package only
npm run test:slatrap
npm run test:core
npm run typecheck
```

## License

MIT — see [LICENSE](LICENSE).
