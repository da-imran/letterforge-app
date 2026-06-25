# LetterForge - Engine

A scalable backend engine for the LetterForge word game. Players form words from randomly generated letters to compete for top spots on the leaderboard.

## Features

- **Dual Game Modes**
  - Normal Mode: Untimed, strategy-focused gameplay
  - Time Attack Mode: 30-second fast-paced word formation

- **Dynamic Letter System**
  - Letters refresh after each word submission
  - Players can manually regenerate letters anytime
  - 2-3 letters per round (allows duplicates)

- **Scoring System**
  - New words: 10 points
  - Duplicate words: 5 points
  - Bonus for longer words (new words only):
    - 6-10 letters: +15 bonus (total: 25 points)
    - 11+ letters: +20 bonus (total: 30 points)

- **Constraint-Based Word Validation**
  - Words must use only available letters
  - Built-in dictionary validation

- **Leaderboard System**
  - Daily, Weekly, and All-Time rankings
  - Separate leaderboards for Normal and Time Attack modes

- **RESTful API**
  - Stateless HTTP architecture
  - MongoDB for persistent storage

## Tech Stack

- **Runtime:** Node.js
- **Framework:** Express.js
- **Database:** MongoDB
- **Containerization:** Docker

## Quick Start

```bash
# Install dependencies
npm install

# Start the server
npm start
```

The server will start on `http://localhost:8888`

## API Documentation

### Base URL
```
http://localhost:8888/letter-forge/v1
```

### Endpoints Overview

| Module | Endpoints |
|--------|-----------|
| Meta | 2 |
| Users | 5 |
| Games | 7 |
| Scores | 4 |
| Leaderboards | 3 |

**Total: 21 endpoints**

### 1. Meta Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/letter-forge/v1/meta` | Service metadata |
| GET | `/letter-forge/v1/health` | Health check |

### 2. Users Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/letter-forge/v1/users` | Create user |
| GET | `/letter-forge/v1/users?nickname=` | Get user by nickname |
| GET | `/letter-forge/v1/users/:userId` | Get user by ID |
| PUT | `/letter-forge/v1/users/:userId` | Update user |
| DELETE | `/letter-forge/v1/users/:userId` | Delete user |

### 3. Games Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/letter-forge/v1/games` | Create new game |
| GET | `/letter-forge/v1/games/:gameId` | Load game |
| POST | `/letter-forge/v1/games/:gameId/submit` | Submit word |
| POST | `/letter-forge/v1/games/:gameId/reset` | Reset letters |
| POST | `/letter-forge/v1/games/:gameId/complete` | Complete game |
| GET | `/letter-forge/v1/games/:gameId/result` | Get result |
| POST | `/letter-forge/v1/games/:gameId/leaderboard` | Submit to leaderboard |

### 4. Scores Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/letter-forge/v1/scores` | Create score |
| GET | `/letter-forge/v1/scores/game/:gameId` | Get scores by game |
| GET | `/letter-forge/v1/scores/user/:userId` | Get scores by user |
| GET | `/letter-forge/v1/scores/user/:userId/total` | Get total score |

### 5. Leaderboards Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/letter-forge/v1/leaderboard` | Get leaderboard |
| POST | `/letter-forge/v1/leaderboard/submit` | Submit score |
| GET | `/letter-forge/v1/leaderboard/rank/:userId` | Get user rank |

## Game Rules

### Creating a Game
```bash
curl -X POST http://localhost:8888/letter-forge/v1/games \
  -H "Content-Type: application/json" \
  -d '{"mode": "normal_mode"}'
```

Response includes:
- `letters`: Array of 2-3 random letters (may include duplicates)
- `letterCount`: Number of letters (2 or 3)
- `expiresAt`: TTL timestamp for time-attack mode (null for normal)

### Submitting a Word
```bash
curl -X POST http://localhost:8888/letter-forge/v1/games/:gameId/submit \
  -H "Content-Type: application/json" \
  -d '{"word": "cat"}'
```

**Scoring:**
| Word Type | Points |
|-----------|--------|
| New word (2-5 letters) | 10 |
| New word (6-10 letters) | 25 (+15 bonus) |
| New word (11+ letters) | 30 (+20 bonus) |
| Duplicate word | 5 |

Response includes new `letters` for the next round.

### Resetting Letters
```bash
curl -X POST http://localhost:8888/letter-forge/v1/games/:gameId/reset \
  -H "Content-Type: application/json" \
  -d '{"letterCount": 2}'
```

Available in both Normal and Time Attack modes. Clears used words and generates new letters.

### Getting Leaderboard
```bash
curl "http://localhost:8888/letter-forge/v1/leaderboard?mode=normal_mode&period=daily"
```

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Server port | `8888` |
| `MONGO_URI` | MongoDB connection string | `mongodb://localhost:27017/letterforge` |
| `ROUTE_PREPEND` | API route prefix | `letter-forge` |
| `VERSION` | API version | `v1` |

## Development

```bash
# Run tests
npm test

# Run with nodemon for development
npm run dev
```

## Docker

See [README.Docker.md](README.Docker.md) for Docker setup instructions.

## License

MIT
