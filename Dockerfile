# ==============================================================================
# Nabat Al Atlas — Multi-Stage Production Dockerfile (Web & Worker Targets)
# ==============================================================================

FROM node:22-alpine AS base
RUN apk add --no-cache libc6-compat openssl
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

# ------------------------------------------------------------------------------
# Stage 1: Install production + build dependencies
# ------------------------------------------------------------------------------
FROM base AS deps
COPY package.json package-lock.json ./
RUN npm ci

# ------------------------------------------------------------------------------
# Stage 2: Build Next.js App Router (Standalone Output)
# ------------------------------------------------------------------------------
FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Dummy non-secret build-time values so static metadata evaluation succeeds
ENV NODE_ENV=production
ENV SESSION_SECRET=build-time-placeholder-secret-min-32-characters
ENV TENANT_ENCRYPTION_KEY=build-time-placeholder-encryption-key-min-32-chars

RUN npm run build

# ------------------------------------------------------------------------------
# Target A: Next.js Web Server (Minimal Standalone Bundle)
# ------------------------------------------------------------------------------
FROM base AS web
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

RUN addgroup --system --gid 1001 nodejs \
 && adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

RUN mkdir -p /app/storage/uploads /app/storage/private-digital /app/storage/backups \
 && chown -R nextjs:nodejs /app/storage

USER nextjs
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3000/api/health >/dev/null 2>&1 || exit 1

CMD ["node", "server.js"]

# ------------------------------------------------------------------------------
# Target B: Background Worker & CLI Migration/Seed Runner
# ------------------------------------------------------------------------------
FROM base AS worker
WORKDIR /app
ENV NODE_ENV=production

RUN addgroup --system --gid 1001 nodejs \
 && adduser --system --uid 1001 nextjs

COPY --from=deps /app/node_modules ./node_modules
COPY package.json tsconfig.json ./
COPY src ./src
COPY drizzle ./drizzle
COPY public ./public

RUN mkdir -p /app/storage/uploads /app/storage/private-digital /app/storage/backups \
 && chown -R nextjs:nodejs /app/storage

USER nextjs

CMD ["npm", "run", "worker"]
