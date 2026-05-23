# FORGE MIND — Next.js Web App
# Leverages Next.js standalone output for minimal image size
# Usage: docker build -f apps/web/Dockerfile -t forge-mind-web .

# ─── Stage 1: dependencies ────────────────────────────────────────────────────
FROM node:22-alpine AS deps

RUN corepack enable && corepack prepare pnpm@9 --activate

WORKDIR /app
COPY apps/web/package.json apps/web/pnpm-lock.yaml* ./

RUN pnpm install --frozen-lockfile

# ─── Stage 2: builder ─────────────────────────────────────────────────────────
FROM node:22-alpine AS builder

RUN corepack enable && corepack prepare pnpm@9 --activate

WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY apps/web .

ARG NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production

RUN pnpm build

# ─── Stage 3: runtime ─────────────────────────────────────────────────────────
FROM node:22-alpine AS runtime

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

WORKDIR /app

# Non-root user
RUN addgroup -S forge && adduser -S forge -G forge
USER forge

# Copy the standalone output
COPY --from=builder --chown=forge:forge /app/.next/standalone ./
COPY --from=builder --chown=forge:forge /app/.next/static ./.next/static
COPY --from=builder --chown=forge:forge /app/public ./public

EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
    CMD ["wget", "-qO-", "http://localhost:3000/api/health"]

CMD ["node", "server.js"]
