#!/bin/bash

# LetterForge Server Bootstrap Script
# Sets up the project for development inside the letterforge-app monorepo.
#
# Run from anywhere; it resolves the package directory automatically.

set -e

echo "========================================="
echo "  LetterForge Server Bootstrap"
echo "========================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

print_success() { echo -e "${GREEN}[OK]${NC} $1"; }
print_warning() { echo -e "${YELLOW}[WARN]${NC} $1"; }
print_error()   { echo -e "${RED}[ERROR]${NC} $1"; }

# Resolve paths
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
MONOREPO_ROOT="$(dirname "$PROJECT_DIR")"

cd "$PROJECT_DIR"

echo ""
echo "Project directory: $PROJECT_DIR"
[ -f "$MONOREPO_ROOT/package.json" ] && echo "Monorepo root:     $MONOREPO_ROOT"
echo ""

# --- 1. Prerequisite checks ---
echo "========================================="
echo "Step 1: Checking prerequisites..."
echo "========================================="

if command -v node &> /dev/null; then
    print_success "Node.js found: $(node --version)"
else
    print_error "Node.js is not installed. Please install Node.js 20+ from https://nodejs.org/"
    exit 1
fi

if command -v npm &> /dev/null; then
    print_success "npm found: $(npm --version)"
else
    print_error "npm is not installed"
    exit 1
fi

if command -v docker &> /dev/null; then
    print_success "Docker found: $(docker --version | cut -d' ' -f3 | cut -d',' -f1)"
else
    print_warning "Docker not found (required only for spinning up MongoDB locally)"
fi

# --- 2. .env setup ---
echo ""
echo "========================================="
echo "Step 2: Setting up environment file..."
echo "========================================="

if [ -f .env ]; then
    print_warning ".env file already exists. Skipping..."
else
    if [ -f .env.example ]; then
        cp .env.example .env
        print_success "Created .env from .env.example"
    else
        print_error ".env.example not found"
        exit 1
    fi
fi

# --- 3. Install dependencies ---
echo ""
echo "========================================="
echo "Step 3: Installing dependencies..."
echo "========================================="

# Inside an npm workspace, install from the monorepo root so workspace deps
# resolve correctly. Fall back to a local install for standalone use.
if [ -f "$MONOREPO_ROOT/package.json" ] && grep -q '"workspaces"' "$MONOREPO_ROOT/package.json"; then
    if [ -d "$MONOREPO_ROOT/node_modules" ]; then
        print_warning "Monorepo node_modules already exists. Skipping npm install..."
    else
        print_success "Running npm install from monorepo root: $MONOREPO_ROOT"
        (cd "$MONOREPO_ROOT" && npm install)
        print_success "Workspace dependencies installed"
    fi
elif [ -d node_modules ]; then
    print_warning "node_modules already exists. Skipping install..."
else
    print_success "Running local npm install (standalone mode)"
    npm install
    print_success "Dependencies installed"
fi

# --- 4. MongoDB ---
echo ""
echo "========================================="
echo "Step 4: Setting up MongoDB..."
echo "========================================="

if command -v mongosh &> /dev/null || command -v mongo &> /dev/null; then
    if mongosh --eval "db.adminCommand({ ping: 1 })" --quiet &> /dev/null 2>&1; then
        print_success "Local MongoDB is already running"
        MONGO_RUNNING=true
    else
        print_warning "Local MongoDB is not running"
        MONGO_RUNNING=false
    fi
else
    # shellcheck disable=SC1091
    source .env
    if curl -s "${MONGO_URI}admin" &> /dev/null; then
        print_success "MongoDB at $MONGO_URI is accessible"
        MONGO_RUNNING=true
    else
        print_warning "MongoDB is not accessible at $MONGO_URI"
        MONGO_RUNNING=false
    fi
fi

if [ "$MONGO_RUNNING" = false ] && command -v docker &> /dev/null; then
    echo "Starting MongoDB container..."
    docker compose up -d mongodb

    echo "Waiting for MongoDB to be ready..."
    sleep 5
    for i in {1..30}; do
        if docker exec letter-forge-mongodb mongosh --eval "db.adminCommand({ ping: 1 })" --quiet &> /dev/null 2>&1; then
            print_success "MongoDB is ready"
            break
        fi
        if [ $i -eq 30 ]; then
            print_error "MongoDB failed to start"
            exit 1
        fi
        sleep 1
    done
elif [ "$MONGO_RUNNING" = false ]; then
    print_warning "MongoDB not running and Docker not available. Start it manually before booting the server."
fi

# --- 5. Verify connection ---
echo ""
echo "========================================="
echo "Step 5: Verifying MongoDB connection..."
echo "========================================="

# shellcheck disable=SC1091
source .env

if command -v mongosh &> /dev/null; then
    if mongosh "$MONGO_URI$MONGODB_DBNAME" --eval "db.adminCommand({ ping: 1 })" --quiet &> /dev/null 2>&1; then
        print_success "MongoDB connection successful: $MONGO_URI$MONGODB_DBNAME"
    else
        print_warning "Could not verify MongoDB connection (mongosh failed). Server will retry on start."
    fi
else
    print_warning "mongosh not installed; skipping live verification."
fi

# --- 6. Swagger ---
echo ""
echo "========================================="
echo "Step 6: Generating Swagger documentation..."
echo "========================================="

npm run swagger
print_success "Swagger documentation generated"

echo ""
echo "========================================="
echo "  Bootstrap Complete!"
echo "========================================="
echo ""
echo "To start the server:"
echo "  npm start        # Production mode"
echo "  npm run dev      # Development mode (nodemon)"
echo ""
echo "API will be available at: http://localhost:8888"
echo "Swagger docs at: http://localhost:8888/letter-forge/v1/api-docs"
echo ""
