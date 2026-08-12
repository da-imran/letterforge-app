# LetterForge — Technical Documentation

A word game platform where players form words from random letters, earn scores, and compete on leaderboards. Supports multiple game modes (normal, time attack, survival, chain) with real-time scoring and async persistence.

---

## Table of Contents

1. [Overview](#overview)
2. [Monorepo Structure](#monorepo-structure)
3. [Technology Stack](#technology-stack)
4. [System Architecture](#system-architecture)
5. [Quick Start](#quick-start)
6. [Environment Setup](#environment-setup)
7. [API Reference](#api-reference)
8. [Database Schema](#database-schema)
9. [Async Score Processing](#async-score-processing)
10. [Development Workflow](#development-workflow)
11. [Testing Strategy](#testing-strategy)
12. [Deployment](#deployment)
13. [Troubleshooting](#troubleshooting)
14. [Contributing](#contributing)

---

## Overview

LetterForge is a full-stack word game combining real-time game logic, asynchronous score persistence, and competitive leaderboards. The architecture separates concerns into a stateless Express API server, a background score worker, and a Next.js frontend dashboard.

**Key Features:**
- Real-time word validation and scoring
- Multiple game modes with unique rule sets
- Asynchronous score persistence via RabbitMQ
- Leaderboard rankings with cache invalidation
- OpenAPI documentation with Swagger UI
- Docker Compose local environment with all services

---

## Monorepo Structure

```
letterforge-app/
├─ packages/
│  ├─ server/                  # Backend — Express 5, Node.js 24+
│  │  ├─ src/
│  │  │  ├─ routes/           # API endpoints
│  │  │  ├─ services/         # Business logic (ScoreService, GameService, etc.)
│  │  │  ├─ models/           # MongoDB schemas
│  │  │  ├─ middleware/       # Auth, validation, error handling
│  │  │  ├─ utilities/        # MongoDB connection, helpers
│  │  │  └─ workers/          # Message queue consumers
│  │  ├─ tests/
│  │  ├─ .env.example
│  │  ├─ package.json
│  │  └─ Dockerfile
│  │
│  └─ dashboard/               # Frontend — Next.js 15, React 19, TypeScript
│     ├─ src/
│     │  ├─ app/              # App Router pages and layouts
│     │  ├─ components/       # React components (Radix UI, shadcn)
│     │  ├─ lib/              # Utilities, API client, hooks
│     │  └─ styles/           # TailwindCSS
│     ├─ public/
│     ├─ .env.example
│     ├─ next.config.js
│     ├─ tsconfig.json
│     ├─ Dockerfile           # Multi-stage Next.js build for dashboard
│     └─ package.json
│
├─ lib/                        # Reserved for shared packages (types, utils)
├─ tsconfig.base.json         # Shared TypeScript configuration
├─ docker-compose.yaml        # 5 services: server, worker, dashboard, rabbitmq, mongodb
├─ Dockerfile                 # Multi-stage build for server
├─ run-local.sh              # Development launcher script
├─ package.json              # Root workspace configuration
└─ README.md                 # This file
```

### Key Design Decisions

- **Separate Worker Process** — Score persistence is decoupled from the API request thread to prevent blocking on database writes.
- **RabbitMQ Message Queue** — Enables graceful degradation and eventual consistency. Clients receive immediate responses; scores persist asynchronously.
- **CommonJS for Backend** — Express 5 runs in CommonJS mode for compatibility and simplicity; frontend uses ESM with Next.js.
- **MongoDB Native Driver** — No ORM overhead; explicit control over queries and schema validation.

---

## Technology Stack

| Layer | Technology | Version | Purpose |
|-------|-----------|---------|---------|
| **Runtime** | Node.js | 24+ | JavaScript runtime; alpine Linux for Docker |
| **Package Manager** | npm (workspaces) | 10+ | Monorepo dependency management |
| **Backend Framework** | Express.js | 5.x | REST API server; OpenAPI documentation |
| **Database** | MongoDB | 7.x | Document-oriented data store; native driver |
| **Message Queue** | RabbitMQ | 3.13+ | Async task processing; message broker |
| **Frontend Framework** | Next.js | 15.x | App Router, SSR, static export |
| **React** | 19.x | Component library with hooks |
| **UI Components** | shadcn/ui + Radix | — | Accessible, unstyled components |
| **Styling** | TailwindCSS | 3.x | Utility-first CSS framework |
| **Language** | TypeScript | 5.x | Frontend type safety |
| **Testing** | Mocha + Chai + Sinon | — | BDD testing framework |
| **Containerization** | Docker + Compose | — | Local and production environments |
| **API Docs** | swagger-autogen + swagger-ui | — | Auto-generated OpenAPI specs |

---

## System Architecture

### High-Level Overview

```mermaid
graph TB
    Client["🌐 Browser Client<br/>(React Dashboard)"]
    CDN["📦 Static Assets<br/>(Next.js / Vercel)"]
    API["🔌 Express API Server<br/>(Port 8888)"]
    DB[("🗄️ MongoDB<br/>(Port 27017)")]
    Queue["📮 RabbitMQ<br/>(Port 5672)"]
    Worker["⚙️ Score Worker<br/>(Node.js Process)"]
    Cache["💾 Leaderboard Cache<br/>(In-Memory)"]

    Client -->|HTTP/REST| API
    Client -->|Static assets| CDN
    API -->|Query/Insert| DB
    API -->|Publish: score.submitted| Queue
    Queue -->|Consume| Worker
    Worker -->|Write score| DB
    Worker -->|Emit: score.recorded| Queue
    Queue -->|Invalidate| Cache
    API -->|Read| Cache
    DB -->|Read| Cache

    style Client fill:#e3f2fd
    style API fill:#fff3e0
    style DB fill:#f3e5f5
    style Queue fill:#e8f5e9
    style Worker fill:#fff3e0
    style Cache fill:#fce4ec
    style CDN fill:#e3f2fd
```

### Monorepo Workspace Dependency Graph

```mermaid
graph LR
    Root["📦 Root Workspace<br/>(npm, docker-compose)"]
    Server["backend<br/>(packages/server)"]
    Dashboard["frontend<br/>(packages/dashboard)"]
    SharedLib["lib/<br/>(shared types, utils)"]

    Root -->|coordinates| Server
    Root -->|coordinates| Dashboard
    Server -.->|uses| SharedLib
    Dashboard -.->|uses| SharedLib

    style Root fill:#f0f0f0
    style Server fill:#fff3e0
    style Dashboard fill:#e3f2fd
    style SharedLib fill:#f3e5f5
```

---

## Quick Start

### Prerequisites

- **Node.js 20+** — Includes npm; verify with `node --version`
- **Docker & Docker Compose** (optional, for containerized runs)
- **MongoDB 7** — Local instance OR use Docker Compose

### Installation

```bash
# Clone the repository
git clone <repo-url>
cd letterforge-app

# Install all workspace dependencies
npm install
```

### Run Locally (Recommended)

```bash
# One-command launcher (both backend and frontend in parallel)
./run-local.sh start

# View logs
./run-local.sh logs

# Stop services
./run-local.sh stop

# Check status
./run-local.sh status
```

The launcher starts:
- **Backend API** → http://localhost:8888
- **Swagger Docs** → http://localhost:8888/letter-forge/v1/api-docs
- **Frontend Dashboard** → http://localhost:9002
- **Score worker** → RabbitMQ consumer for async score persistence
- **MongoDB / RabbitMQ** → started automatically via Docker Compose when they aren't already running

### Run with Docker Compose

```bash
# Start all services (server, worker, dashboard, rabbitmq, mongodb)
docker compose up -d --build

# View logs
docker compose logs -f

# Stop all services
docker compose down
```

Services will be available at:
- API: http://localhost:8888/letter-forge/v1
- Dashboard: http://localhost:9002
- MongoDB: mongodb://localhost:27017/data
- RabbitMQ Admin: http://localhost:15672 (guest/guest)

---

## Environment Setup

### Backend Configuration

Create `packages/server/.env` from `.env.example`:

```bash
# Application
NODE_ENV=local                          # local | dev | staging | production
HOSTNAME=localhost
ROUTE_PREPEND=letter-forge              # API route prefix
API_VERSION=1.0.0
APP_VERSION=1.0.0
SERVICE_NAME=letter-forge
VERSION=v1
PORT=8888                               # API server port

# Database
MONGO_URI=mongodb://localhost:27017/    # MongoDB connection string
MONGODB_DBNAME=data                     # Database name

# Async Processing (RabbitMQ)
RABBITMQ_ENABLED=true                  # false = synchronous score writes
RABBITMQ_URI=amqp://localhost
RABBITMQ_QUEUE_SCORES=score.submitted
RABBITMQ_QUEUE_SCORE_RECORDED=score.recorded
RABBITMQ_PREFETCH=10                    # Messages per consumer
RABBITMQ_RECONNECT_DELAY=5000          # ms between reconnect attempts
```

### Frontend Configuration

Create `packages/dashboard/.env.local` from `.env.example`:

```bash
# API Connection
NEXT_PUBLIC_API_URL=http://localhost:8888
NEXT_PUBLIC_API_BASE=/letter-forge/v1
```

> **Important:** Never commit `.env` files. Update `.env.example` when adding new variables.

---

## API Reference

### Base URL
```
http://localhost:8888/letter-forge/v1
```

### Swagger Documentation
```
http://localhost:8888/letter-forge/v1/api-docs
```

### Endpoints

#### Games

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/games` | Create a new game session |
| `GET` | `/games/:id` | Fetch game state and current letters |
| `POST` | `/games/:id/submit` | Submit a word and receive new letters |
| `POST` | `/games/:id/complete` | Finalize a game session |
| `POST` | `/games/:id/leaderboard` | Submit final score to rankings |

#### Leaderboard

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/leaderboard` | Fetch top scores (paginated) |
| `GET` | `/leaderboard/player/:playerId` | Fetch player's position and stats |
| `GET` | `/leaderboard/stats` | Fetch global stats (avg score, total players, etc.) |

#### Health & Docs

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/health` | Service health check |
| `GET` | `/api-docs` | Swagger UI |

### Request/Response Examples

#### Create Game
```bash
curl -X POST http://localhost:8888/letter-forge/v1/games \
  -H "Content-Type: application/json" \
  -d '{
    "playerId": "user123",
    "mode": "normal"
  }'
```

**Response (201):**
```json
{
  "gameId": "game-abc123",
  "mode": "normal",
  "letters": ["a", "e", "i", "o", "u", "r", "t"],
  "expiresAt": null,
  "createdAt": "2026-08-11T10:00:00Z"
}
```

#### Submit Word
```bash
curl -X POST http://localhost:8888/letter-forge/v1/games/game-abc123/submit \
  -H "Content-Type: application/json" \
  -d '{
    "word": "rate",
    "playerId": "user123"
  }'
```

**Response (200):**
```json
{
  "gameId": "game-abc123",
  "word": "rate",
  "points": 10,
  "totalScore": 45,
  "letters": ["a", "e", "i", "o", "u", "r", "s"],
  "message": "Valid word!"
}
```

#### Complete Game
```bash
curl -X POST http://localhost:8888/letter-forge/v1/games/game-abc123/complete \
  -H "Content-Type: application/json" \
  -d '{
    "playerId": "user123",
    "finalScore": 125
  }'
```

**Response (200):**
```json
{
  "gameId": "game-abc123",
  "playerId": "user123",
  "finalScore": 125,
  "wordsFormed": 12,
  "completedAt": "2026-08-11T10:15:30Z"
}
```

#### Submit to Leaderboard (Async)
```bash
curl -X POST http://localhost:8888/letter-forge/v1/games/game-abc123/leaderboard \
  -H "Content-Type: application/json" \
  -d '{
    "playerId": "user123",
    "playerName": "Alice",
    "finalScore": 125,
    "mode": "normal",
    "wordsFormed": 12,
    "duration": 900
  }'
```

**Response (202 Accepted):**
```json
{
  "message": "Score submitted for processing",
  "taskId": "score-abc123"
}
```

---

## Database Schema

### Collections

#### `games`
Tracks active and completed game sessions.

```json
{
  "_id": ObjectId,
  "gameId": "game-abc123",
  "playerId": "user123",
  "mode": "normal",
  "letters": ["a", "e", "i", "o", "u", "r", "t"],
  "wordsSubmitted": [
    {
      "word": "rate",
      "points": 10,
      "submittedAt": "2026-08-11T10:02:00Z"
    }
  ],
  "currentScore": 45,
  "status": "active",
  "expiresAt": null,
  "createdAt": "2026-08-11T10:00:00Z",
  "updatedAt": "2026-08-11T10:05:00Z"
}
```

#### `scores`
Persisted final scores for leaderboard rankings.

```json
{
  "_id": ObjectId,
  "playerId": "user123",
  "playerName": "Alice",
  "finalScore": 125,
  "mode": "normal",
  "wordsFormed": 12,
  "duration": 900,
  "rank": 5,
  "recordedAt": "2026-08-11T10:15:30Z",
  "createdAt": "2026-08-11T10:15:30Z"
}
```

#### `players`
Player profiles and statistics.

```json
{
  "_id": ObjectId,
  "playerId": "user123",
  "playerName": "Alice",
  "totalGames": 42,
  "totalScore": 5230,
  "averageScore": 124.5,
  "bestScore": 389,
  "bestMode": "time-attack",
  "stats": {
    "normal": { "gamesPlayed": 20, "totalScore": 2500 },
    "timeAttack": { "gamesPlayed": 15, "totalScore": 1800 },
    "survival": { "gamesPlayed": 5, "totalScore": 700 },
    "chain": { "gamesPlayed": 2, "totalScore": 230 }
  },
  "createdAt": "2026-08-01T00:00:00Z",
  "updatedAt": "2026-08-11T10:15:30Z"
}
```

### Indexes

For optimal query performance:

```javascript
// games collection
db.games.createIndex({ gameId: 1 }, { unique: true })
db.games.createIndex({ playerId: 1 })
db.games.createIndex({ status: 1 })
db.games.createIndex({ createdAt: 1 })
db.games.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 })  // TTL for time-attack

// scores collection
db.scores.createIndex({ playerId: 1 })
db.scores.createIndex({ mode: 1 })
db.scores.createIndex({ rank: 1 })
db.scores.createIndex({ finalScore: -1 })
db.scores.createIndex({ recordedAt: -1 })

// players collection
db.players.createIndex({ playerId: 1 }, { unique: true })
db.players.createIndex({ totalScore: -1 })
```

---

## Async Score Processing

The scoring pipeline decouples request handling from persistence, enabling fast API responses and resilience to database slowness.

### Architecture Diagram

```mermaid
sequenceDiagram
    participant Client as Client
    participant API as API Server<br/>(Express)
    participant Queue as Message Queue<br/>(RabbitMQ)
    participant Worker as Score Worker<br/>(Node.js)
    participant DB as MongoDB
    participant Cache as Leaderboard<br/>Cache

    Client->>+API: POST /games/:id/leaderboard<br/>(score payload)
    API->>API: Validate payload
    API->>+Queue: Publish score.submitted
    Queue-->>-API: Acknowledged
    API-->>-Client: 202 Accepted<br/>(taskId)

    Queue->>+Worker: Deliver score.submitted
    Worker->>Worker: Deserialize message
    Worker->>+DB: ScoreService.createScore()
    DB->>DB: Insert score doc<br/>Update player stats<br/>Calculate rank
    DB-->>-Worker: Success
    Worker->>+Queue: Publish score.recorded<br/>(invalidation event)
    Queue-->>-Worker: Acknowledged
    Worker-->>-Queue: Message ACKed

    Queue->>+API: Deliver score.recorded
    API->>Cache: Invalidate leaderboard<br/>Clear player cache
    Cache-->>-API: Cache cleared
    API-->>+DB: Fetch fresh rankings
    DB-->>-API: Top scores
    API->>API: Populate cache
```

### Message Queue Flow

```mermaid
graph LR
    A["API Server<br/>(Port 8888)"] -->|score.submitted| Q["RabbitMQ<br/>(Port 5672)"]
    Q -->|consume| W["Score Worker"]
    W -->|update| DB["MongoDB"]
    DB -->|score.recorded| Q
    Q -->|consume| A
    A -->|invalidate| C["Cache"]

    style A fill:#fff3e0
    style Q fill:#e8f5e9
    style W fill:#fff3e0
    style DB fill:#f3e5f5
    style C fill:#fce4ec
```

### Graceful Degradation

If RabbitMQ is unavailable:

1. **On publish failure:** API catches exception, waits for broker reconnect with exponential backoff.
2. **Fallback mode:** If `RABBITMQ_ENABLED=false`, the API writes scores **synchronously** to the database (blocks request, but guarantees persistence).
3. **Auto-reconnect:** Once the broker recovers, the API reconnects and resumes async publishing.
4. **No data loss:** Published messages persist in the queue; the worker consumes them upon restart.

### Configuration

```bash
# Enable/disable async processing
RABBITMQ_ENABLED=true

# Connection and prefetch
RABBITMQ_URI=amqp://localhost
RABBITMQ_PREFETCH=10

# Queue names
RABBITMQ_QUEUE_SCORES=score.submitted
RABBITMQ_QUEUE_SCORE_RECORDED=score.recorded

# Reconnection strategy
RABBITMQ_RECONNECT_DELAY=5000  # 5 seconds
```

---

## Development Workflow

### Running Services

```bash
# Run everything in parallel
npm run dev

# Or individually
npm run dev:server       # Backend only (nodemon, auto-reload)
npm run dev:worker       # Score worker only
npm run dev:dashboard    # Frontend only (Next.js)
```

### Available Scripts

```bash
npm install                    # Install all workspace dependencies
npm start                      # Backend API in production mode (node packages/server/app.js)
npm run dev                    # Start all services
npm run dev:server            # Backend API (port 8888)
npm run dev:worker            # Background worker
npm run dev:dashboard         # Frontend (port 9002)
npm run build                 # Build all packages
npm run build:server          # Build backend
npm run build:dashboard       # Build frontend
npm run typecheck             # TypeScript type checking (no emit)
npm run lint                  # ESLint across packages
npm run swagger               # Regenerate OpenAPI specs
npm test                      # Run test suite (Mocha)
npm run start:worker          # Run worker in production mode
```

### Code Organization

**Backend (`packages/server/src`):**
- `routes/` — API endpoint handlers
- `services/` — Business logic (GameService, ScoreService, LeaderboardService)
- `models/` — MongoDB schema and type definitions
- `middleware/` — Auth, validation, error handling
- `utilities/` — Database connection, helpers, validators
- `workers/` — RabbitMQ consumer implementation

**Frontend (`packages/dashboard/src`):**
- `app/` — Next.js App Router pages and layouts
- `components/` — React components (Game board, Leaderboard, etc.)
- `lib/` — API client, hooks (useGame, useLeaderboard), utilities
- `styles/` — TailwindCSS configuration and global styles

### Debugging

**Backend:**
```bash
# Run with Node debugger
node --inspect packages/server/src/index.js

# Then open chrome://inspect in Chrome DevTools
```

**Frontend:**
```bash
# Next.js provides built-in debugging
npm run dev:dashboard

# Open DevTools (F12) → Sources tab for breakpoints
```

---

## Testing Strategy

### Unit Tests (Mocha + Chai + Sinon)

```bash
cd packages/server
npm test
```

**Test Structure:**
```
packages/server/tests/
├─ unit/
│  ├─ services/          # ScoreService, GameService, etc.
│  └─ utilities/         # Validators, helpers
├─ integration/          # Database + RabbitMQ tests
└─ fixtures/             # Test data and mocks
```

**Example Test:**
```javascript
const { expect } = require('chai');
const sinon = require('sinon');
const GameService = require('../src/services/GameService');

describe('GameService', () => {
  it('should create a new game with random letters', async () => {
    const game = await GameService.createGame('user123', 'normal');
    expect(game.gameId).to.exist;
    expect(game.letters).to.have.lengthOf(7);
  });
});
```

### Test Configuration

```bash
# From package.json scripts
"test": "mocha --timeout 10000 --exit"

# Flags:
# --timeout 10000  — 10 second timeout per test (for DB operations)
# --exit           — Exit process after tests complete
# --grep "pattern" — Run only matching tests
```

### Mocking Database

```javascript
const sinon = require('sinon');
const mongodb = require('../utilities/mongodb');

beforeEach(() => {
  // Stub the database module
  this.dbStub = sinon.stub(mongodb, 'collection');
  this.dbStub.returns({
    insertOne: sinon.stub().resolves({ insertedId: 'test-id' }),
    findOne: sinon.stub().resolves({ _id: 'test-id' }),
  });
});

afterEach(() => {
  sinon.restore();
});
```

### CI/CD Integration

Add to `.github/workflows/test.yml`:

```yaml
name: Tests
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    services:
      mongodb:
        image: mongo:7
        options: --health-cmd "mongosh --eval 'db.adminCommand(\"ping\")'" --health-interval 10s --health-timeout 5s --health-retries 5
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '24'
      - run: npm install
      - run: npm test
```

---

## Deployment

### Docker Build

```bash
# Build the backend image
docker build -t letterforge-server:latest .

# Run the container
docker run -d \
  -e MONGO_URI=mongodb://db:27017/ \
  -e RABBITMQ_URI=amqp://rabbitmq \
  -p 8888:8888 \
  letterforge-server:latest

# Build the dashboard image
docker build -t letterforge-dashboard:latest -f packages/dashboard/Dockerfile .

# Run the container
docker run -d -p 9002:9002 letterforge-dashboard:latest
```

### Production Checklist

- [ ] Set `NODE_ENV=production`
- [ ] Configure external MongoDB (Atlas, self-hosted)
- [ ] Configure external RabbitMQ (CloudAMQP, self-hosted)
- [ ] Enable HTTPS/TLS
- [ ] Set up monitoring (logs, metrics, alerts)
- [ ] Configure rate limiting
- [ ] Enable CORS for frontend domain
- [ ] Set up backup strategy for MongoDB
- [ ] Test graceful shutdown (SIGTERM handling)
- [ ] Load test with expected player volume

### Environment Variables (Production)

```bash
NODE_ENV=production
HOSTNAME=api.letterforge.com
PORT=8888
MONGO_URI=mongodb+srv://user:pass@cluster.mongodb.net/
MONGODB_DBNAME=letterforge
RABBITMQ_URI=amqp://user:pass@rabbitmq.host:5672
RABBITMQ_ENABLED=true
```

### Kubernetes Deployment (Optional)

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: letterforge-api
spec:
  replicas: 3
  selector:
    matchLabels:
      app: letterforge-api
  template:
    metadata:
      labels:
        app: letterforge-api
    spec:
      containers:
      - name: api
        image: letterforge-server:latest
        ports:
        - containerPort: 8888
        env:
        - name: NODE_ENV
          value: "production"
        - name: MONGO_URI
          valueFrom:
            secretKeyRef:
              name: letterforge-secrets
              key: mongo-uri
        - name: RABBITMQ_URI
          valueFrom:
            secretKeyRef:
              name: letterforge-secrets
              key: rabbitmq-uri
        livenessProbe:
          httpGet:
            path: /letter-forge/v1/health
            port: 8888
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /letter-forge/v1/health
            port: 8888
          initialDelaySeconds: 10
          periodSeconds: 5
```

---

## Troubleshooting

### Common Issues

#### MongoDB Connection Fails
```bash
# Check if MongoDB is running
mongosh --eval "db.adminCommand('ping')"

# If using Docker Compose:
docker compose logs mongodb

# Verify MONGO_URI in .env
MONGO_URI=mongodb://localhost:27017/
```

#### RabbitMQ Connection Fails
```bash
# Check if RabbitMQ is running
docker compose logs rabbitmq

# Access RabbitMQ admin console
# http://localhost:15672 (default: guest/guest)

# Check message queue
docker compose exec rabbitmq rabbitmqctl list_queues
```

#### Score Not Appearing on Leaderboard
```bash
# Check worker logs
npm run dev:worker

# Check if messages are in queue
docker compose exec rabbitmq rabbitmqctl list_queues name messages

# Verify MongoDB has the score record
mongosh
> use data
> db.scores.findOne({ playerId: "user123" })
```

#### API Returns 500 Error
```bash
# Check server logs
npm run dev:server

# Verify environment variables are set
cat packages/server/.env

# Test database connection
mongosh $MONGO_URI

# Check API health endpoint
curl http://localhost:8888/letter-forge/v1/health
```

#### Frontend Won't Connect to API
```bash
# Verify API_BASE is correct in .env.local
NEXT_PUBLIC_API_URL=http://localhost:8888
NEXT_PUBLIC_API_BASE=/letter-forge/v1

# Check CORS configuration in backend
# Verify frontend is on allowed origin (localhost:9002)

# Test API from browser console
fetch('http://localhost:8888/letter-forge/v1/health')
  .then(r => r.json())
  .then(console.log)
```

### Performance Optimization

**Database Queries:**
- Ensure indexes are created (see Database Schema section)
- Use projection to fetch only needed fields
- Paginate leaderboard results (limit 50 per page)

**Caching Strategy:**
- Cache leaderboard in-memory for 5 minutes
- Invalidate on score.recorded event
- Cache game templates to avoid random letter generation overhead

**Async Processing:**
- Tune `RABBITMQ_PREFETCH` based on worker CPU capacity
- Monitor queue depth; scale workers if backlog grows
- Consider separate consumer groups for different message types

---

## Contributing

### Pull Request Process

1. Create a feature branch: `git checkout -b feature/game-mode`
2. Make changes and commit: `git commit -am 'Add survival mode'`
3. Push to branch: `git push origin feature/game-mode`
4. Open a pull request with a clear description

### Code Standards

- **Backend:** Follow Express best practices; validate all inputs
- **Frontend:** Use TypeScript; ensure component props are typed
- **Tests:** Write unit tests for services and utilities
- **Linting:** Run `npm run lint` before committing
- **Type Safety:** Run `npm run typecheck` to verify TypeScript

### Commit Message Format

```
<type>: <subject>

<body>

<footer>
```

Types: `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`

Example:
```
feat: add time attack game mode

Implement 60-second countdown timer and speed-based scoring.
Closes #42
```

### Reporting Bugs

Include:
- Steps to reproduce
- Expected behavior
- Actual behavior
- Environment (OS, Node version, browser)
- Error logs or screenshots

---

## License

ISC — see `packages/server/LICENSE` and `packages/dashboard/LICENSE`

---

## Support

For issues, feature requests, or documentation improvements, please open a GitHub issue or contact the development team.

**Useful Links:**
- [Express.js Docs](https://expressjs.com/)
- [Next.js Docs](https://nextjs.org/docs)
- [MongoDB Docs](https://docs.mongodb.com/)
- [RabbitMQ Docs](https://www.rabbitmq.com/documentation.html)
- [Swagger/OpenAPI](https://swagger.io/)