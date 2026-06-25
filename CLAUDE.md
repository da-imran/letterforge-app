# LetterForge — Claude Code Instructions

This file is the source of truth for Claude when working in this monorepo. **Read it fully before starting any task.**

---

## Project Summary
A word game platform where players form words from random letters, earn scores, and compete on leaderboards. Multiple game modes: normal (untimed), time attack (60s), survival (lives), chain.

- **Monorepo** — npm workspaces, two app packages
- **Backend** (`packages/server`, CommonJS): Express 5 + MongoDB 7 native driver — no Mongoose
- **Frontend** (`packages/dashboard`, ESM): Next.js 15 (App Router) + React 19 + TypeScript + Tailwind + Radix UI
- **API docs** via swagger-autogen + swagger-ui-express at `/{ROUTE_PREPEND}/{VERSION}/api-docs`
- **CI/CD** via GitHub Actions (`.github/workflows/letterforge-check.yaml`)

---

## Monorepo Structure
```
letterforge-app/
├─ packages/
│  ├─ server/          Backend — Express 5 + MongoDB (CommonJS)   (@letterforge-app/server)
│  └─ dashboard/       Frontend — Next.js 15 + React 19 (ESM)     (@letterforge-app/dashboard)
├─ lib/                Reserved for shared internal packages
├─ tsconfig.base.json
├─ Dockerfile          Builds packages/server from monorepo context
├─ docker-compose.yaml server + mongodb
└─ run-local.sh        Local dev launcher (npm or docker)
```

- Root `package.json` declares `"workspaces": ["packages/*", "lib/*"]`. Use npm (NOT pnpm) for all installs and scripts.
- Backend stays CommonJS **intentionally** — do not rewrite it to ESM.
- Dashboard is Next.js App Router (ESM via Next).

---

## Technology Stack

| Layer    | Tech                                   | Notes                                              |
|----------|----------------------------------------|----------------------------------------------------|
| Runtime  | Node.js 24+                            | Root `Dockerfile` uses `node:24-alpine`            |
| Pkg mgr  | npm (workspaces)                        | `@letterforge-app/*` namespace                     |
| Backend  | Express 5                              | CommonJS, `require()` / `module.exports`           |
| Database | MongoDB 7                              | Native driver only — never Mongoose                 |
| API docs | swagger-autogen + swagger-ui-express   | `/${ROUTE_PREPEND}/${VERSION}/api-docs`             |
| Logging  | `utilities/logger.js` (console)       | Currently a stub — logs go to stdout               |
| Testing  | Mocha + Chai + Sinon                   | `mocha --timeout 10000 --exit`                      |
| Frontend | Next.js 15 + React 19 + TypeScript     | App Router, pages under `src/app/`                  |
| UI       | Radix UI + Tailwind + lucide-react + shadcn/ui | `@/*` alias → `packages/dashboard/src/*`  |
| Containers | Docker + Docker Compose             | Two services: server, mongodb                       |
| CI/CD    | GitHub Actions                         | Jobs: build, test                                   |

---

## Backend Conventions (`packages/server`)

### Module pattern
Each feature in `modules/<feature>/` exports a single function from `index.js`:
```js
module.exports = async (app, config, ...deps) => { /* mount routes */ };
```
Modules: `meta`, `scores`, `milestones`, `game`, `users`, `leaderboards`, `dictionary`, `words`, `scoring`. All mounted from `index.js` with dependency injection via the `config` param (`{ mongoClient }`).

### Data access
- Go through `utilities/mongodb.js` helpers (`clientConnect`, `findOne`, `insertOne`, `aggregate`, etc.).
- Return 400 with `{ status: 400, message: 'Bad request: ...' }` for validation failures.
- **Never** return 200 for errors; **never** return 500 for validation failures.

### Env loading
- `dotenv` is loaded inside `utilities/env.js` and `utilities/mongodb.js` (each calls `require('dotenv').config()`). `app.js` also explicitly loads `.env` from its own directory (`path.join(__dirname, '.env')`) for robustness when run from the monorepo root.
- `app.js` reads `MONGO_URI` from `process.env` when `NODE_ENV` is in `['local','dev','development']`. A secrets-manager branch exists but is currently dead code (no `utilities/secrets.js`) — do not uncomment it without implementing `secrets.js`.

### Swagger
- `npm run swagger` regenerates `swagger/swagger-output.json` via swagger-autogen.
- The `dev` script regenerates swagger on every restart.

---

## Frontend Conventions (`packages/dashboard`)

- Path alias: `@/*` → `packages/dashboard/src/*` (Next.js + tsconfig).
- API layer: `src/lib/api.ts` — base URL from `NEXT_PUBLIC_API_URL` (default `http://localhost:8888`) + `NEXT_PUBLIC_API_BASE` (default `/letter-forge/v1`).
- State: React Context (`src/context/UserContext.tsx`).
- UI: shadcn/ui components under `src/components/ui/`.

---

## Environment Variables

### Backend (`packages/server/.env`)
```bash
NODE_ENV=local
HOSTNAME=localhost
ROUTE_PREPEND=letter-forge
API_VERSION=1.0.0
APP_VERSION=1.0.0
SERVICE_NAME=letter-forge
VERSION=v1
PORT=8888
MONGO_URI=mongodb://localhost:27017/
MONGODB_DBNAME=data
```

### Frontend (`packages/dashboard/.env.local`)
```bash
NEXT_PUBLIC_API_URL=http://localhost:8888
NEXT_PUBLIC_API_BASE=/letter-forge/v1
```

> Never commit `.env`. Update `.env.example` whenever a variable changes.

---

## Commands (run from repo root)
```bash
npm install                  # install all workspace deps
npm run dev                  # server + dashboard in parallel (via concurrently)
npm run dev:server           # backend only (nodemon, port 8888)
npm run dev:dashboard        # frontend only (Next.js, port 9002)
npm run build                # build all packages
npm run typecheck            # tsc --noEmit across packages
npm run lint                 # eslint across packages
npm test                     # mocha suite (where defined)
npm run swagger              # regenerate server OpenAPI spec
./run-local.sh start          # one-shot launcher (preferred for local dev)
docker compose up --build     # server + mongodb
```

Run a single workspace explicitly: `npm run <script> --workspace packages/server`.

---

## Testing
```bash
cd packages/server
npm test                          # mocha --timeout 10000 --exit
```

- Tests stub `utilities/mongodb.js` with `sinon.stub()` where possible; integration tests hit a live Mongo.
- **Never** use `.only` — it silently skips the rest of the suite in CI.

---

## Migration Notes
This monorepo was migrated from two legacy repos:
- `letterforge` (frontend) → `packages/dashboard`
- `letterforge-engine` (backend) → `packages/server`

The legacy directories are preserved on disk during validation and can be removed once the migration is verified. Fixes applied during migration:
- `packages/server/app.js` — added `'development'` to the safe env list so default boot reads `MONGO_URI` from env (not the dead secrets branch); added explicit `dotenv.config()` with `__dirname`-relative path.
- `packages/server/scripts/update-milestones.js` — fixed cwd-relative `.env` read to use `__dirname`.
- `packages/server/scripts/bootstrap.sh` — detects the monorepo root and installs via npm from there; standalone fallback.
- Dropped `scripts/start-dev.sh` (replaced by root `run-local.sh`).

*Last Updated: 2026-06-24*
