# DEPLOYMENT.md

How to actually run this system outside of local dev. For going live specifically on 0G mainnet (real gas, real credentials), see [MAINNET_DEPLOYMENT.md](MAINNET_DEPLOYMENT.md) — this doc covers the general shape of a deployment regardless of network.

**Honest state of this today**: there is no Dockerfile, no CI/CD pipeline, and no infrastructure-as-code in this repo yet. What follows is the real, correct path to a working deployment with what exists today — not aspirational tooling. Adding containerization/CI is tracked in docs/PROJECT_ROADMAP.md, not pretended into existence here.

## Components and where they need to run

| Component | Nature | Where it can run |
|---|---|---|
| `apps/web` | Static build (`vite build`) | Any static host/CDN — Vercel, Netlify, S3+CloudFront. No server-side code. |
| `apps/api` | Long-running Node process (Express + WS server + 3 BullMQ workers in the same process, see `src/index.ts`) | A host that keeps a process alive — a VM, Railway/Render/Fly, or a container platform. **Not** a serverless/edge platform — the WebSocket server and in-process BullMQ workers need a persistent process. |
| Postgres | Stateful | Managed Postgres (RDS, Neon, Railway, etc.) or a self-managed instance. Local dev uses `docker-compose.dev.yml`'s Postgres 16 container — fine for dev, not for production. |
| Redis | Stateful (BullMQ job queues) | Managed Redis (Upstash, Elasticache, Railway) or self-managed. |
| `contracts/evm` | Deployed once per network via Hardhat | Not "deployed" in the hosting sense — `npm run contracts:deploy:testnet`/`:mainnet` writes addresses to `contracts/evm/deployments/<network>.json`, which `apps/api`'s `.env` then points at. |
| `pitch/` | Static build (`node build.js` → `pitch/index.html`) | Already live on Vercel with root directory `pitch` (knowledge_base.md §0) — separate from the app itself. |
| `contracts/miden/bridge` | Dormant Rust binary | Not deployed anywhere — kept in the repo, not wired to any live traffic (knowledge_base.md §11o-§11q). |

## Build

```bash
npm install
npm run build   # packages/shared -> apps/api -> apps/web, in that order (apps/api imports @nvei/shared's built output)
```

`apps/api`'s build (`tsc -p tsconfig.build.json`) excludes test files from the output — see `apps/api/tsconfig.build.json`. Run `npm test` separately in CI if you want test coverage gating a deploy; it isn't wired into `build` itself.

## Running apps/api in production

```bash
cd apps/api
node dist/index.js
```

Needs every env var in `.env.example` set for real (see MAINNET_DEPLOYMENT.md for the specific credentials and where to get them). `config/env.ts` validates the full set with zod at startup and exits immediately with a clear error if anything required is missing or malformed — this is deliberate fail-fast behavior, not a bug to work around.

Recommended for a real deployment (none of this is currently configured in the repo, described here as guidance):
- A process manager or the platform's own restart policy (systemd, PM2, or the hosting platform's built-in supervisor) — `src/index.ts` handles `SIGINT`/`SIGTERM` for graceful worker shutdown, but doesn't restart itself.
- `NODE_ENV=production` (this also disables the dev-only global-Prisma-client caching in `lib/prisma.ts`).
- A reverse proxy or the platform's own TLS termination — the app itself speaks plain HTTP/WS, `helmet()` sets headers but doesn't terminate TLS.
- Log shipping for `pino`'s JSON output (already structured, ready to pipe into whatever log aggregator you use).

## Running apps/web in production

```bash
cd apps/web
npm run build   # outputs dist/, ~930kB main bundle (not yet code-split, see docs/PROJECT_ROADMAP.md)
```

Serve `dist/` from any static host. **Real constraint worth knowing before you deploy this**: `apps/web/src/lib/api.ts` calls a hardcoded relative path (`/api${path}`), and WebSocket connections likewise target `/ws` relative to the current origin — there is no build-time `API_URL` env var today. This works in local dev only because `vite.config.ts`'s dev server proxies `/api` and `/ws` to `localhost:4000` (a dev-server-only feature, not present in the static `dist/` build). In production you must either:
1. Serve `apps/web` and `apps/api` from the **same origin**, with a reverse proxy (Nginx, the platform's own rewrite rules, etc.) routing `/api/*` and `/ws` to the `apps/api` process and everything else to the static files, or
2. Add a real `apps/web` env-driven base URL (not present in the code today) and set `apps/api`'s `CORS_ORIGIN` to match.

Option 1 requires no code change and is the more direct path with what exists now.

## Database migrations in production

```bash
npx prisma migrate deploy --schema prisma/schema.prisma
```

`migrate deploy` (not `migrate dev`) — it applies pending migrations without generating new ones or prompting, the correct command for CI/CD per Prisma's own docs. Never run `prisma db seed` against a production database — it's explicitly documented (`prisma/seed.ts`'s own header comment) as local-dev-only, and it upserts fixed demo accounts with a shared, publicly-known password.

## What's not here yet

- No Dockerfile for `apps/api` or `apps/web` — straightforward to add (standard multi-stage Node build), not done because no deployment target has needed it yet.
- No CI pipeline (no `.github/workflows`, no equivalent) — `npm run build`, `npm test`, and `npm run typecheck` are all real, scriptable checks that a pipeline would run; none currently run automatically on push.
- No infrastructure-as-code (Terraform, Pulumi, etc.) for the Postgres/Redis/hosting layer.

These are tracked, not silently assumed solved — see docs/PROJECT_ROADMAP.md.
