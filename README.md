# LetterForge

A word game platform where players form words from random letters, earn scores, and compete on leaderboards. Game modes include normal (untimed), time attack, survival, and chain.

This is the **monorepo** that houses both the backend API server and the frontend dashboard.

---

## Monorepo Structure

```
letterforge-app/
├─ packages/
│  ├─ server/          Backend — Express 5 + MongoDB (CommonJS)
│  └─ dashboard/        Frontend — Next.js 15 + React 19 + TypeScript (ESM)
├─ lib/                 Reserved for shared internal packages
├─ tsconfig.base.json   Shared TS compiler defaults
├─ Dockerfile           Builds packages/server from the monorepo context
├─ docker-compose.yaml  server + mongodb
└─ run-local.sh         One-shot local dev launcher
```

## Technology Stack

| Layer        | Tech                                          | Notes                                              |
|--------------|-----------------------------------------------|----------------------------------------------------|
| Runtime      | Node.js 24+                                   | Root `Dockerfile` uses `node:24-alpine`            |
| Package mgr  | npm (workspaces)                              | Root `package.json` declares `packages/*` + `lib/*`|
| Backend      | Express 5                                     | CommonJS, `require()` / `module.exports`           |
| Database     | MongoDB 7                                     | Native driver only — no Mongoose                   |
| API docs     | swagger-autogen + swagger-ui-express          | `/{ROUTE_PREPEND}/{VERSION}/api-docs`             |
| Testing      | Mocha + Chai + Sinon                          | `mocha --timeout 10000 --exit`                     |
| Frontend     | Next.js 15 (App Router) + React 19 + TypeScript | `@/*` alias → `packages/dashboard/src/*`        |
| Styling      | TailwindCSS + Radix UI / shadcn               |                                                    |
| Containers   | Docker + Docker Compose                       | Two services: server, mongodb                      |

---

## Quick Start

### Prerequisites
- Node.js 20+ (npm is bundled with Node)
- MongoDB 7 (local or via Docker)
- Docker (optional, for containerized runs)

### Install
```bash
npm install
```

### Run everything locally (recommended)
```bash
./run-local.sh start      # starts server + dashboard in parallel
./run-local.sh stop
./run-local.sh logs
./run-local.sh status
```

Or run the two packages directly:
```bash
npm run dev           # both packages in parallel (via concurrently)
npm run dev:server    # backend only (nodemon, port 8888)
npm run dev:dashboard # frontend only (Next.js, port 9002)
```

### Run with Docker Compose
```bash
./run-local.sh docker        # builds server + mongodb
./run-local.sh docker-stop
```

Or directly:
```bash
docker compose up -d --build
```

---

## Commands (run from repo root)

```bash
npm install              # install all workspace deps
npm run dev              # server + dashboard in parallel
npm run dev:server       # backend only
npm run dev:dashboard    # frontend only
npm run build            # build all packages
npm run typecheck        # tsc --noEmit across packages
npm run lint             # eslint across packages
npm test                 # mocha suite (where defined)
npm run swagger          # regenerate OpenAPI spec for the server
```

---

## Environment Variables

Each package reads its own `.env` from inside its directory. Copy the example and fill in values:

### Backend (`packages/server/.env` from `.env.example`)
```bash
NODE_ENV=local                # local | dev | development | staging | production
HOSTNAME=localhost
ROUTE_PREPEND=letter-forge    # URL prefix for all routes
API_VERSION=1.0.0
APP_VERSION=1.0.0
SERVICE_NAME=letter-forge
VERSION=v1
PORT=8888
MONGO_URI=mongodb://localhost:27017/   # Default MongoDB localhost URI
MONGODB_DBNAME=data
```

### Frontend (`packages/dashboard/.env.local` from `.env.example`)
```bash
NEXT_PUBLIC_API_URL=http://localhost:8888   # backend origin
NEXT_PUBLIC_API_BASE=/letter-forge/v1       # route prefix + version
```

> Never commit `.env`. Update `.env.example` whenever a variable changes.

---

## Testing
```bash
cd packages/server
npm test                          # mocha --timeout 10000 --exit
```

- Tests stub `utilities/mongodb.js` with `sinon.stub()` where possible; integration tests hit a live Mongo (CI provides a `mongo:7` service).
- **Never** use `.only` — it silently skips the rest of the suite in CI.

---

## API Overview

| Base URL | `http://localhost:8888/letter-forge/v1` |
|----------|------|
| Swagger docs | `http://localhost:8888/letter-forge/v1/api-docs` |

### Game Flow
1. `POST /games` — Returns `gameId`, random letters, `expiresAt` (time attack only)
2. `POST /games/:id/submit` — Validates word, scores it, returns new letters
3. `POST /games/:id/complete` — Finalizes game
4. `POST /games/:id/leaderboard` — Submits score to rankings

### Scoring
- New word: 10 pts (2–5 letters), 25 pts (6–10), 30 pts (11+)
- Duplicate word: 5 pts

See the OpenAPI docs for the full endpoint reference.

---

## License

ISC — see `packages/server/LICENSE` and `packages/dashboard/LICENSE`.
