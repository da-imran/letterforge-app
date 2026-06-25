# LetterForge - Docker Setup

Run LetterForge engine in Docker containers with MongoDB.

## Prerequisites

- Docker
- Docker Compose

## Quick Start

```bash
# Build and start all services
docker compose up --build
```

The API will be available at `http://localhost:8888`

MongoDB will be available at `mongodb://localhost:27017`

## Services

### API Service
- **Image:** Node.js application
- **Port:** `8888`
- **Environment:** Configured via `.env` file

### MongoDB Service
- **Image:** MongoDB latest
- **Port:** `27017`
- **Volume:** `mongodb_data` for persistence

## Configuration

The application uses environment variables defined in `.env`:

```env
PORT=8888
MONGO_URI=mongodb://mongo:27017/letterforge
ROUTE_PREDEND=letter-forge
VERSION=v1
```

## Docker Commands

```bash
# Start services in detached mode
docker compose up -d

# View logs
docker compose logs -f

# Stop services
docker compose down

# Stop services and remove volumes
docker compose down -v

# Rebuild services
docker compose build --no-cache
```

## Building for Production

```bash
# Build the image
docker build -t letterforge-app-server .

# Run the container
docker run -p 8888:8888 \
  -e MONGO_URI=mongodb://host.docker.internal:27017/letterforge \
  letterforge-app-server
```

Note: Use `host.docker.internal` on macOS/Windows to access the host's MongoDB.

## Multi-Platform Build

If deploying to a cloud with a different CPU architecture:

```bash
docker build --platform=linux/amd64 -t letterforge-app-server .
```

## Health Check

Verify the service is running:

```bash
curl http://localhost:8888/letter-forge/v1/health
```

Expected response:
```json
{ "status": "healthy" }
```

## Swagger Documentation

When running locally, access Swagger docs at:
```
http://localhost:8888/letter-forge/v1/api-docs
```

## Troubleshooting

### Container won't start
- Check if port 8888 or 27017 is already in use
- Verify MongoDB container is running: `docker compose ps`

### Cannot connect to MongoDB
- Ensure the `MONGO_URI` in `.env` matches your MongoDB service name
- For Docker Compose, use the service name: `mongodb://mongo:27017/letterforge`

### Logs not showing
- Use `docker compose logs api` to see API logs specifically
- Add `-f` flag to follow logs in real-time

## References

- [Docker's Node.js guide](https://docs.docker.com/language/nodejs/)
- [Docker Compose documentation](https://docs.docker.com/compose/)
- [MongoDB Docker image](https://hub.docker.com/_/mongo)
