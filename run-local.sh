#!/usr/bin/env bash
# =============================================================================
# run-local.sh - Run the LetterForge monorepo locally
#
# Usage:
#   ./run-local.sh start     # Start server, dashboard, and score worker
#   ./run-local.sh stop      # Stop all services
#   ./run-local.sh restart   # Restart all services
#   ./run-local.sh logs      # Show recent logs
#   ./run-local.sh status    # Check if services are running
#   ./run-local.sh docker    # Start all services with Docker Compose
#   ./run-local.sh docker-stop
#
# MongoDB and RabbitMQ are started automatically with Docker Compose when
# they aren't already running.
#
# Override defaults with env vars:
#   SERVER_PORT=8888 DASHBOARD_PORT=9002 MONGO_URI=mongodb://...
#   LOG_DIR=/abs/path/to/logs   # defaults to <repo-root>/logs
# =============================================================================

set -euo pipefail

# --- Config ---
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOG_DIR="${LOG_DIR:-$ROOT_DIR/logs}"
SERVER_PORT="${SERVER_PORT:-8888}"
DASHBOARD_PORT="${DASHBOARD_PORT:-9002}"
RABBITMQ_PORT="${RABBITMQ_PORT:-5672}"
PID_FILE="${PID_FILE:-$LOG_DIR/app.pid}"
SERVER_LOG="${SERVER_LOG:-$LOG_DIR/server.log}"
DASHBOARD_LOG="${DASHBOARD_LOG:-$LOG_DIR/dashboard.log}"
WORKER_LOG="${WORKER_LOG:-$LOG_DIR/worker.log}"

# --- Colours ---
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
RESET='\033[0m'

info()    { echo -e "${CYAN}[info]${RESET}  $*"; }
success() { echo -e "${GREEN}[ok]${RESET}    $*"; }
warn()    { echo -e "${YELLOW}[warn]${RESET} $*"; }
error()   { echo -e "${RED}[error]${RESET} $*" >&2; }
die()     { error "$*"; exit 1; }

# --- PID management ---
save_pids() {
  echo "SERVER_PID=$SERVER_PID" > "$PID_FILE"
  echo "DASHBOARD_PID=$DASHBOARD_PID" >> "$PID_FILE"
  echo "WORKER_PID=$WORKER_PID" >> "$PID_FILE"
}

load_pids() {
  if [[ -f "$PID_FILE" ]]; then
    # shellcheck source=/dev/null
    source "$PID_FILE"
  fi
}

is_running() {
  local pid="${1:-}"
  [[ -n "$pid" ]] && kill -0 "$pid" 2>/dev/null
}

# Find PIDs listening on a given TCP port. Empty if nothing is listening
# or lsof is unavailable. Returns one PID per line.
pids_on_port() {
  local port="$1"
  lsof -nP -iTCP:"$port" -sTCP:LISTEN -t 2>/dev/null || true
}

# Stop everything listening on a port. Falls back from PID file to port
# scan so this works even when the PID file is stale or from a different
# LOG_DIR. Kills the whole process group when possible so workers spawned
# by the wrapper (nodemon, next dev) don't get orphaned. Always returns 0.
stop_on_port() {
  local label="$1"
  local port="$2"
  local pid="${3:-}"
  local stopped=0

  # Prefer the PID from the file if it's actually our process.
  if is_running "$pid"; then
    info "Stopping ${label} (PID: $pid from pid file)..."
    # Kill the process group so child workers exit too.
    kill -- -"$pid" 2>/dev/null || kill "$pid" 2>/dev/null || true
    stopped=1
  fi

  # Whatever's still listening on the port — kill it. This catches workers
  # that survived the wrapper kill (and the case where the PID file is gone).
  local leftover
  for leftover in $(pids_on_port "$port"); do
    if is_running "$leftover"; then
      info "Stopping ${label} worker listening on :${port} (PID: $leftover)..."
      kill -- -"$leftover" 2>/dev/null || kill "$leftover" 2>/dev/null || true
      stopped=1
    fi
  done

  if [ "$stopped" -eq 0 ]; then
    info "${label} not running"
    return 1
  fi

  return 0
}

# --- Wait for MongoDB ---
wait_for_mongodb() {
  local host="localhost"
  local port=27017
  local timeout=30
  local elapsed=0

  info "Waiting for MongoDB to be ready on ${host}:${port}..."
  while [ $elapsed -lt $timeout ]; do
    if nc -z "$host" "$port" 2>/dev/null; then
      info "MongoDB is ready!"
      return 0
    fi

    sleep 1
    ((elapsed++))
    info "Still waiting for MongoDB... (${elapsed}/${timeout}s)"
  done
  return 1
}

# --- Wait for RabbitMQ ---
# Auto-starts the RabbitMQ broker via Docker Compose when it isn't running,
# then blocks until it answers on the AMQP port.
wait_for_rabbitmq() {
  local host="localhost"
  local port="$RABBITMQ_PORT"
  local timeout=30
  local elapsed=0

  info "Checking RabbitMQ on ${host}:${port}..."

  if ! nc -z "$host" "$port" 2>/dev/null; then
    if command -v docker &>/dev/null && docker compose version &>/dev/null; then
      info "RabbitMQ not running - starting it with Docker Compose..."
      docker compose up -d rabbitmq
    else
      info "RabbitMQ not running and Docker unavailable - will retry in the background."
      return 1
    fi
  fi

  info "Waiting for RabbitMQ to be ready on ${host}:${port}..."
  while [ $elapsed -lt $timeout ]; do
    if nc -z "$host" "$port" 2>/dev/null; then
      info "RabbitMQ is ready!"
      return 0
    fi

    sleep 1
    ((elapsed++))
    info "Still waiting for RabbitMQ... (${elapsed}/${timeout}s)"
  done
  return 1
}

# --- Start services ---
start_services() {
  echo -e "${BOLD}LetterForge - Monorepo Dev Runner${RESET}"
  echo "======================================"

  # Ensure the log directory exists (and parent dirs) before any process writes to it.
  mkdir -p "$LOG_DIR"

  # --- 1. Check prerequisites ---
  if ! command -v node &>/dev/null; then
    die "Node.js not found. Install Node.js 20+ from https://nodejs.org"
  fi
  NODE_MAJOR=$(node --version | sed 's/v//' | cut -d. -f1)
  if [ "$NODE_MAJOR" -lt 20 ]; then
    die "Node.js 20+ required (found $(node --version)). Please upgrade."
  fi
  success "Node.js $(node --version)"

  if ! command -v npm &>/dev/null; then
    die "npm not found. Install Node.js (npm is bundled): https://nodejs.org"
  fi
  success "npm $(npm --version)"

  # --- 2. Load root .env if present ---
  if [ -f .env ]; then
    set -a
    # shellcheck source=/dev/null
    source .env
    set +a
    info "Loaded environment from .env"
  fi

  # --- 3. Wait for MongoDB ---
  if ! wait_for_mongodb; then
    warn "MongoDB is not available after 30 seconds."
    if [[ "$(uname)" == "Darwin" ]] && command -v brew &>/dev/null; then
      info "You can start it with: brew services start mongodb-community"
      info "Or run: docker compose up -d mongodb"
    else
      info "Please start MongoDB manually and ensure it's listening on port 27017."
    fi
    info "Continuing anyway - the server will retry connection attempts."
  fi

  # --- 3.5. Wait for RabbitMQ ---
  if ! wait_for_rabbitmq; then
    warn "RabbitMQ is not available after 30 seconds."
    info "Start it with: docker compose up -d rabbitmq  (or ./run-local.sh docker)"
    info "Continuing anyway - the server and worker will retry connection attempts."
  fi

  # --- 4. Install dependencies ---
  info "Installing workspace dependencies..."
  npm install
  success "Dependencies installed"

  # --- 5. Ensure server .env exists ---
  if [ ! -f packages/server/.env ] && [ -f packages/server/.env.example ]; then
    cp packages/server/.env.example packages/server/.env
    success "Created packages/server/.env from .env.example"
  fi

  # --- 5.5. Run server scripts from packages/server/scripts/ ---
  # bootstrap.sh handles prereqs, env, deps, mongo startup, swagger, tests
  # (idempotent — skips work already done by run-local.sh).
  # update-milestones.js seeds the milestones collection from milestone_data.js.
  # Failures here are non-fatal: the server will still start and retry as needed.
  info "Running server scripts from packages/server/scripts/..."
  (
    cd packages/server
    bash scripts/bootstrap.sh || warn "bootstrap.sh exited with non-zero status; continuing"
    node scripts/update-milestones.js || warn "update-milestones.js exited with non-zero status; continuing"
  )

  # --- 6. Start server ---
  info "Starting API server on port ${SERVER_PORT}..."
  (
    cd packages/server
    PORT="${SERVER_PORT}" NODE_ENV=local npm run dev
  ) > "$SERVER_LOG" 2>&1 &
  SERVER_PID=$!
  info "API server PID: $SERVER_PID (logs: $SERVER_LOG)"

  # --- 7. Start dashboard ---
  info "Starting dashboard dev server on port ${DASHBOARD_PORT}..."
  (
    cd packages/dashboard
    PORT="${DASHBOARD_PORT}" npm run dev
  ) > "$DASHBOARD_LOG" 2>&1 &
  DASHBOARD_PID=$!
  info "Dashboard PID: $DASHBOARD_PID (logs: $DASHBOARD_LOG)"

  # --- 7.5. Start score worker ---
  # Consumes `score.submitted` from RabbitMQ so the API's async score writes
  # are actually persisted. Idles gracefully when RabbitMQ is disabled.
  info "Starting score worker (RabbitMQ consumer)..."
  (
    cd packages/server
    npm run start:worker
  ) > "$WORKER_LOG" 2>&1 &
  WORKER_PID=$!
  info "Score worker PID: $WORKER_PID (logs: $WORKER_LOG)"

  save_pids

  sleep 3

  # --- 8. Summary ---
  LAN_IP=""
  if command -v ipconfig &>/dev/null && ipconfig getifaddr en0 >/dev/null 2>&1; then
    LAN_IP="$(ipconfig getifaddr en0 2>/dev/null || true)"
  fi
  if [ -z "$LAN_IP" ] && command -v hostname &>/dev/null; then
    LAN_IP="$(hostname -I 2>/dev/null | awk '{print $1}' || true)"
  fi

  echo ""
  echo -e "${BOLD}======================================${RESET}"
  echo -e "${GREEN}${BOLD}  Running!${RESET}"
  echo -e "  Dashboard  ->  ${CYAN}http://localhost:${DASHBOARD_PORT}${RESET}"
  echo -e "  API        ->  ${CYAN}http://localhost:${SERVER_PORT}/letter-forge/v1${RESET}"
  echo -e "  API docs   ->  ${CYAN}http://localhost:${SERVER_PORT}/letter-forge/v1/api-docs${RESET}"
  if [ -n "$LAN_IP" ]; then
    echo -e "  -- Same-network (LAN) --"
    echo -e "  Dashboard  ->  ${CYAN}http://${LAN_IP}:${DASHBOARD_PORT}${RESET}"
    echo -e "  API        ->  ${CYAN}http://${LAN_IP}:${SERVER_PORT}/letter-forge/v1${RESET}"
  fi
  echo -e "  API logs   ->  ${CYAN}$SERVER_LOG${RESET}"
  echo -e "  Web logs   ->  ${CYAN}$DASHBOARD_LOG${RESET}"
  echo -e "  Worker logs ->  ${CYAN}$WORKER_LOG${RESET}"
  echo -e "${BOLD}======================================${RESET}"
  echo -e "  To stop:  ${BOLD}./run-local.sh stop${RESET}"
  echo -e "  To view logs:  ${BOLD}./run-local.sh logs${RESET}"
  echo ""
}

# --- Stop services ---
stop_services() {
  load_pids
  local stopped=0

  # Try the PID file first; fall back to lsof on the configured port if the
  # PIDs are stale or missing (e.g. PID_FILE was at a different LOG_DIR).
  if stop_on_port "API server" "$SERVER_PORT" "${SERVER_PID:-}"; then
    stopped=$((stopped + 1))
  fi
  if stop_on_port "Dashboard dev server" "$DASHBOARD_PORT" "${DASHBOARD_PID:-}"; then
    stopped=$((stopped + 1))
  fi

  # The worker has no TCP port of its own; stop it via its PID/process group.
  if is_running "${WORKER_PID:-}"; then
    info "Stopping Score worker (PID: $WORKER_PID)..."
    kill -- -"$WORKER_PID" 2>/dev/null || kill "$WORKER_PID" 2>/dev/null || true
    stopped=$((stopped + 1))
  fi

  # Clean up any pid file we know about (current + legacy /tmp/ location).
  rm -f "$PID_FILE" /tmp/letterforge-app.pid

  if [ $stopped -gt 0 ]; then
    success "Stopped $stopped service(s)"
  else
    info "No services were running"
  fi
}

# --- Restart services ---
restart_services() {
  info "Restarting services..."
  stop_services
  sleep 1
  start_services
}

# --- Show logs ---
show_logs() {
  echo -e "${BOLD}=== SERVER LOG (last 30 lines) ===${RESET}"
  tail -n 30 "$SERVER_LOG" 2>/dev/null || echo "No server log found"
  echo ""
  echo -e "${BOLD}=== DASHBOARD LOG (last 30 lines) ===${RESET}"
  tail -n 30 "$DASHBOARD_LOG" 2>/dev/null || echo "No dashboard log found"
  echo ""
  echo -e "${BOLD}=== WORKER LOG (last 30 lines) ===${RESET}"
  tail -n 30 "$WORKER_LOG" 2>/dev/null || echo "No worker log found"
}

# --- Check status ---
show_status() {
  load_pids
  echo -e "${BOLD}Service Status:${RESET}"

  if is_running "${SERVER_PID:-}"; then
    echo -e "  API Server:  ${GREEN}running (PID: $SERVER_PID)${RESET}"
  else
    echo -e "  API Server:  ${RED}not running${RESET}"
  fi

  if is_running "${DASHBOARD_PID:-}"; then
    echo -e "  Dashboard:   ${GREEN}running (PID: $DASHBOARD_PID)${RESET}"
  else
    echo -e "  Dashboard:   ${RED}not running${RESET}"
  fi

  if is_running "${WORKER_PID:-}"; then
    echo -e "  Score worker: ${GREEN}running (PID: $WORKER_PID)${RESET}"
  else
    echo -e "  Score worker: ${RED}not running${RESET}"
  fi
}

# --- Docker helpers ---
check_docker_prereqs() {
  if ! command -v docker &>/dev/null; then
    die "Docker not found. Install Docker from https://www.docker.com/get-docker"
  fi
  success "Docker $(docker --version | awk '{print $3}' | sed 's/,//')"

  if ! docker compose version &>/dev/null; then
    die "Docker Compose not found. Install Docker Compose."
  fi
  success "Docker Compose $(docker compose version --short)"
}

start_docker_services() {
  echo -e "${BOLD}LetterForge - Docker Compose Runner${RESET}"
  echo "======================================"
  check_docker_prereqs

  if [ -f .env ]; then
    set -a
    # shellcheck source=/dev/null
    source .env
    set +a
    info "Loaded environment from .env"
  fi

  info "Building and starting Docker services..."
  docker compose up -d --build

  sleep 3
  echo ""
  echo -e "${BOLD}======================================${RESET}"
  echo -e "${GREEN}${BOLD}  Docker services running!${RESET}"
  echo -e "  Dashboard  ->  ${CYAN}http://localhost:${DASHBOARD_PORT}${RESET}"
  echo -e "  API        ->  ${CYAN}http://localhost:${SERVER_PORT}/letter-forge/v1${RESET}"
  echo -e "  MongoDB    ->  ${CYAN}localhost:27017${RESET}"
  echo -e "${BOLD}======================================${RESET}"
  echo -e "  To stop:      ${BOLD}./run-local.sh docker-stop${RESET}"
  echo -e "  To view logs: ${BOLD}./run-local.sh docker-logs${RESET}"
  echo ""
}

stop_docker_services() {
  check_docker_prereqs
  info "Stopping Docker services..."
  docker compose down
  success "Docker services stopped"
}

show_docker_logs() {
  check_docker_prereqs
  docker compose logs --tail=50
}

# --- Main ---
case "${1:-start}" in
  start)        start_services ;;
  stop)         stop_services ;;
  restart)      restart_services ;;
  logs)         show_logs ;;
  status)       show_status ;;
  docker)       start_docker_services ;;
  docker-stop)  stop_docker_services ;;
  docker-logs)  show_docker_logs ;;
  *)
    echo "Usage: $0 {start|stop|restart|logs|status|docker|docker-stop|docker-logs}"
    echo "  start        - Start server, dashboard, and score worker locally (default)"
    echo "  stop         - Stop all services"
    echo "  restart      - Restart all services"
    echo "  logs         - Show recent logs"
    echo "  status       - Check if services are running"
    echo "  docker       - Start all services with Docker Compose"
    echo "  docker-stop  - Stop all Docker services"
    echo "  docker-logs  - Show Docker Compose logs"
    exit 1
    ;;
esac
