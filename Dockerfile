# syntax=docker/dockerfile:1

# Build the LetterForge API server (packages/server) from the monorepo context.

ARG NODE_VERSION=24-alpine
FROM node:${NODE_VERSION}

WORKDIR /usr/src/app

# Copy workspace files first for layer caching
COPY package.json package-lock.json* ./
COPY packages/server/package.json ./packages/server/

# Install workspace dependencies.
# Uses `npm install` (not `npm ci`) until package-lock.json is committed.
# Switch to `npm ci` once a lockfile is in place for reproducible builds.
RUN npm install

# Copy source code
COPY packages/server/ ./packages/server/

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

USER nodejs

EXPOSE 8888
CMD ["node", "packages/server/app.js"]
