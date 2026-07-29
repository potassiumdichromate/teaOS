# DEPLOYMENT.md

How to actually run this system outside of local dev. For going live specifically on 0G mainnet (real gas, real credentials), see [MAINNET_DEPLOYMENT.md](MAINNET_DEPLOYMENT.md) — this doc covers the general shape of a deployment regardless of network.

**Honest state of this today (updated 2026-07-29)**: `apps/web` deploys to Vercel and `apps/api` deploys to Render, using real config files in this repo — `apps/web/vercel.json` and `render.yaml` at the repo root, not just prose instructions. There is still no Dockerfile and no CI pipeline (see "What's not here yet" below) — those remain real gaps, not silently assumed solved.

## Deploying to Vercel (frontend) + Render (backend)

This is the concrete, current path — the two config files below are real and committed, not aspirational.

### 1. Backend first: Render

1. In the Render dashboard: **New +** → **Blueprint**, point it at this repo. Render reads `render.yaml` (repo root) and proposes three resources together: the `teaos-api` web service, a `teaos-postgres` database, and a `teaos-redis` Key Value instance.
2. Render will prompt for every env var marked `sync: false` in `render.yaml` before it lets you apply the blueprint — these are the real secrets, listed in `apps/api/.env.example`: `QUESTION_BANK_MASTER_KEY`, `ZG_SERVICE_PRIVATE_KEY`, `ZG_COMPUTE_API_KEY`, the five `*_REGISTRY_ADDRESS` values, and `CORS_ORIGIN`. `JWT_SECRET` and `RESULT_KEY_SALT` are `generateValue: true` — Render generates real random values for those itself, nothing to supply.
3. **`CORS_ORIGIN` is a real chicken-and-egg**: you don't know the Vercel URL until step 2 (below) exists. Leave it as a placeholder (e.g. `https://placeholder.invalid`) to get Render deployed, then come back and set the real value once you have the Vercel URL — Render redeploys automatically when an env var changes.
4. `startCommand` in `render.yaml` runs `prisma migrate deploy` before starting the server — the schema is applied for real on every deploy, not a separate manual step you can forget.
5. Once live, `https://<your-service>.onrender.com/healthz` should return `{"ok":true,"db":true,"redis":true}` — a real check, not a static 200 (see `apps/api/src/routes/health.routes.ts`). If `db`/`redis` are `false`, the `fromDatabase`/`fromService` wiring in `render.yaml` didn't resolve — check the service's env var list in the Render dashboard.

### 2. Frontend: Vercel

1. In the Vercel dashboard: **Add New** → **Project**, import this repo. **Set Root Directory to `apps/web`** in the import screen — this is a real, necessary manual step per [Vercel's own monorepo docs](https://vercel.com/docs/monorepos); it can't be expressed inside `vercel.json` itself. With Root Directory set, Vercel still runs `npm install` from the true repo root (it detects the npm-workspaces `workspaces` field in the root `package.json`), so `apps/web/vercel.json`'s `installCommand`/`buildCommand` (which `cd ../..` back to the repo root to build `packages/shared` before `apps/web`, since Vite needs that package's *built* output, not just its source) work correctly.
2. Set the one required env var: **`VITE_API_BASE_URL`** = the real Render origin from step 1, e.g. `https://teaos-api.onrender.com` (no trailing slash). This is read by `apps/web/src/lib/origin.ts` at build time — see that file's own comment for exactly how it's used for both REST (`apiUrl()`) and WebSocket (`wsUrl()`) calls. Unset, the app falls back to relative `/api`/`/ws` paths, which is correct for local dev (Vite's dev-server proxy) but wrong here, since Vercel and Render are different origins.
3. Deploy. `vercel.json`'s `rewrites` entry (`"/(.*)" -> "/index.html"`) is the standard SPA fallback — real static files (JS/CSS/images) still resolve normally; only paths with no matching file (i.e. every client-side React Router route) fall through to `index.html`.
4. Go back to Render and set the real `CORS_ORIGIN` to this Vercel URL (from step 1.3 above) — until you do, every request from the deployed frontend will be rejected by `cors()` in `apps/api/src/app.ts`, even though everything else works.

### 3. Contracts and 0G credentials

Neither Vercel nor Render deploy `contracts/evm` — that's a one-time Hardhat step you run yourself before Render even needs the registry addresses. See [MAINNET_DEPLOYMENT.md](MAINNET_DEPLOYMENT.md) for the full real sequence (deploy the five registries, get their addresses, get a 0G Compute API key) — do that first, then fill in Render's `sync: false` vars with the real results.

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

Serve `dist/` from any static host. **Fixed 2026-07-29** (previously a real gap, recorded in knowledge_base.md §11r's original punch-list): `apps/web/src/lib/origin.ts` reads a real build-time env var, `VITE_API_BASE_URL`, for both REST (`apiUrl()`, used by `lib/api.ts`) and WebSocket (`wsUrl()`, used by `lib/live-logs.ts`) calls. Unset, both fall back to the old relative-path behavior (`/api`, `/ws`) — correct for local dev via Vite's dev-server proxy, or for a same-origin reverse-proxy deployment. Set to the backend's real origin (e.g. `https://teaos-api.onrender.com`) for a cross-origin deployment like Vercel + Render — see the "Deploying to Vercel + Render" section above for the concrete steps. Either way, `apps/api`'s `CORS_ORIGIN` must match whatever origin the frontend actually loads from, or every request gets rejected by `cors()` regardless of the base URL being correct.

## Database migrations in production

```bash
npx prisma migrate deploy --schema prisma/schema.prisma
```

`migrate deploy` (not `migrate dev`) — it applies pending migrations without generating new ones or prompting, the correct command for CI/CD per Prisma's own docs.

**`prisma db seed` runs on Render too, deliberately** (`render.yaml`'s `startCommand`, decided 2026-07-29 after a real deploy came up with zero users and every login 401'd — this app has no self-registration flow, so seeding is the only way any account exists at all). It upserts the same 5 demo accounts documented in `README.md`, sharing one publicly-known password (`dev-password-only`) — **know what that means before you point this deployment at anything beyond a controlled demo**: anyone who has the URL and reads the public repo can log in as Admin or Teacher and trigger real actions (paper generation, real 0G Compute calls, real gas spend). Fine for what this app's own hero copy already calls itself ("Prototype — not a production deployment"); not fine to leave running once the URL is shared broadly without adding real access control first. `prisma/seed.ts` is upsert-based, so re-running it on every deploy is safe — it never touches data those accounts have since created.

## What's not here yet

- No Dockerfile for `apps/api` or `apps/web` — not needed for the Vercel/Render path above (both platforms build directly from the repo, no container step required), but would matter for a different host (a raw VM, Kubernetes, etc.).
- No CI pipeline (no `.github/workflows`, no equivalent) — `npm run build`, `npm test`, and `npm run typecheck` are all real, scriptable checks that a pipeline would run; none currently run automatically on push. Render/Vercel both run their own build on every push to `main`, which catches a broken build, but nothing runs `npm test` before a deploy goes live.
- `render.yaml`'s free-tier Postgres/Redis/web service plans have real limitations worth knowing before you rely on them: Render's free Postgres instances are deleted after a fixed retention window, and free web services spin down after a period of inactivity (the next request pays a real cold-start delay). Fine for demoing this prototype; not a substrate for anything that needs to stay up unattended. Upgrading the `plan:` values in `render.yaml` is a one-line change per resource.
- No preview-deployment CORS handling — `CORS_ORIGIN` in `render.yaml` is a single origin (the Vercel production URL). Vercel's per-PR preview URLs (a different origin each time) will hit CORS rejections against the deployed API unless `apps/api/src/app.ts`'s `cors()` config is extended to accept a pattern or list.

These are tracked, not silently assumed solved — see docs/PROJECT_ROADMAP.md.
