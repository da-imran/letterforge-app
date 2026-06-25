# syntax=docker/dockerfile:1

# Standalone Dockerfile for the LetterForge server package.
# Build context = packages/server/ (used by packages/server/docker-compose.yaml).
#
# For the monorepo-wide build (context = repo root), use the root ./Dockerfile
# instead, which installs via npm and resolves workspace dependencies.

ARG NODE_VERSION=24-alpine
FROM node:${NODE_VERSION}-alpine
WORKDIR /usr/src/app
COPY package*.json ./
# `npm install` (not `npm ci`) because this package has no committed package-lock.json.
# Switch to `npm ci` once a lockfile is in place for reproducible builds.
RUN npm install --omit=dev
COPY . .
# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001
USER nodejs
EXPOSE 8888
CMD ["npm", "start"]
