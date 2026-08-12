# syntax=docker/dockerfile:1

# Build the LetterForge dashboard (packages/dashboard, Next.js) from the monorepo context.

ARG NODE_VERSION=24-alpine

# --- Install workspace dependencies ---
FROM node:${NODE_VERSION} AS deps

WORKDIR /usr/src/app

# Copy workspace manifests first for layer caching.
COPY package.json package-lock.json* ./
COPY packages/server/package.json ./packages/server/
COPY packages/dashboard/package.json ./packages/dashboard/

# Uses `npm install` (not `npm ci`) until package-lock.json is committed,
# matching the server Dockerfile.
RUN npm install

# --- Build the Next.js app ---
FROM deps AS builder

ENV NEXT_TELEMETRY_DISABLED=1

COPY packages/dashboard/ ./packages/dashboard/

RUN npm run build --workspace packages/dashboard

# --- Runtime ---
FROM node:${NODE_VERSION}

WORKDIR /usr/src/app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=9002

COPY --from=deps /usr/src/app/node_modules ./node_modules
COPY --from=deps /usr/src/app/package.json ./package.json
COPY --from=builder /usr/src/app/packages/dashboard ./packages/dashboard

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

USER nodejs

WORKDIR /usr/src/app/packages/dashboard
EXPOSE 9002
CMD ["node", "/usr/src/app/node_modules/next/dist/bin/next", "start", "-H", "0.0.0.0", "-p", "9002"]
