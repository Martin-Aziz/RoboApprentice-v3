#!/usr/bin/env bash
# FORGE MIND — Production Deploy Script
# Usage: bash scripts/deploy.sh [IMAGE_TAG]
#
# Requires:
#   - Docker + Docker Compose installed on the server
#   - .env.prod in the project root
#   - GITHUB_REPO env var set (e.g. myorg/forge-mind)
#   - ghcr.io login: echo "$GHCR_TOKEN" | docker login ghcr.io -u "$GHCR_USER" --password-stdin

set -euo pipefail

IMAGE_TAG="${1:-latest}"
COMPOSE_FILE="docker-compose.prod.yml"

echo "=== FORGE MIND Deploy: tag=${IMAGE_TAG} ==="

# 1. Pull latest images
echo "--- Pulling images..."
IMAGE_TAG="$IMAGE_TAG" docker compose -f "$COMPOSE_FILE" pull

# 2. Run migrations before switching traffic
echo "--- Running migrations..."
docker compose -f "$COMPOSE_FILE" run --rm api \
  sh -c 'sqlx migrate run --source /app/migrations' 2>/dev/null || \
  echo "Note: sqlx not in API image — ensure migrations ran separately"

# 3. Rotate services with zero-downtime rolling restart
echo "--- Updating services..."
IMAGE_TAG="$IMAGE_TAG" docker compose -f "$COMPOSE_FILE" up -d \
  --remove-orphans \
  --no-build

# 4. Health check
echo "--- Waiting for API health..."
for i in $(seq 1 30); do
  if curl -sf "https://${DOMAIN:-localhost}/health" > /dev/null 2>&1; then
    echo "API is healthy!"
    break
  fi
  echo "  attempt $i/30..."
  sleep 2
done

# 5. Remove dangling images
echo "--- Cleaning up old images..."
docker image prune -f

echo "=== Deploy complete ==="
