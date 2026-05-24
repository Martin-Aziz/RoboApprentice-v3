#!/usr/bin/env bash
set -euo pipefail

# Dev start script for Aurevix (RoboApprentice) repo
# Usage: ./scripts/dev_start.sh [--with-ollama] [--with-ml]
# - --with-ollama : attempt to pull/start Ollama and model
# - --with-ml     : start local ML FastAPI service (apps/ml-service)

ROOT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
cd "$ROOT_DIR"

WITH_OLLAMA=false
WITH_ML=false

while [[ $# -gt 0 ]]; do
  case "$1" in
    --with-ollama) WITH_OLLAMA=true; shift ;;
    --with-ml) WITH_ML=true; shift ;;
    -h|--help) echo "Usage: $0 [--with-ollama] [--with-ml]"; exit 0 ;;
    *) echo "Unknown arg: $1"; echo "Usage: $0 [--with-ollama] [--with-ml]"; exit 1 ;;
  esac
done

echo "Starting dev environment from: $ROOT_DIR"

mkdir -p logs

check_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "Warning: $1 not found in PATH"
    return 1
  fi
  return 0
}

echo "Checking required commands..."
check_cmd pnpm || echo "Install pnpm: https://pnpm.io/installation"
check_cmd docker || echo "Install Docker Desktop and ensure it's running"
check_cmd cargo || echo "Install Rust toolchain: https://rustup.rs/"
check_cmd node || echo "Install Node.js (v20+ recommended)"

# Ensure .env exists
if [ ! -f .env ]; then
  if [ -f .env.example ]; then
    echo "No .env found — copying .env.example → .env"
    cp .env.example .env
    echo "Please edit .env if necessary and re-run the script. Continuing with defaults from .env.example."
  else
    echo "No .env or .env.example found — please create a .env file before continuing.";
  fi
fi

echo "Installing JS dependencies (pnpm install)..."
pnpm install

# Start docker compose services (Postgres, Redis, MinIO)
if command -v pnpm >/dev/null 2>&1 && pnpm -s --no-color --version >/dev/null 2>&1; then
  if pnpm -s -w help >/dev/null 2>&1; then
    if pnpm -w ls --depth -1 >/dev/null 2>&1; then
      if grep -q "docker:up" package.json >/dev/null 2>&1 || pnpm -s -w run docker:up >/dev/null 2>&1; then
        echo "Starting Docker services via pnpm docker:up..."
        pnpm docker:up || echo "pnpm docker:up failed; falling back to docker compose"
      fi
    fi
  fi
fi

if ! docker ps >/dev/null 2>&1; then
  echo "Docker CLI not available. Skipping docker compose step.";
else
  echo "Bringing up Docker compose services (detached)..."
  docker compose up -d
fi

if [ "$WITH_OLLAMA" = true ]; then
  if check_cmd ollama; then
    echo "Pulling LLM model gemma4:latest (may take time)..."
    ollama pull gemma4:latest || echo "ollama pull failed or model already present"
    echo "Starting Ollama server in background..."
    nohup ollama serve > logs/ollama.log 2>&1 &
    sleep 2
    echo "Ollama logs: logs/ollama.log"
  else
    echo "ollama not found. Install from https://ollama.com and re-run with --with-ollama"
  fi
fi

if [ "$WITH_ML" = true ]; then
  if [ -d apps/ml-service ]; then
    echo "Starting local ML service (apps/ml-service)"
    if [ -f apps/ml-service/.venv/bin/activate ]; then
      echo "Using existing virtualenv at apps/ml-service/.venv"
      (cd apps/ml-service && nohup . .venv/bin/activate && uvicorn src.main:app --reload --host 0.0.0.0 --port 8001 > ../../logs/ml.log 2>&1 &) || true
    else
      echo "Please create a Python venv and install deps in apps/ml-service before using --with-ml"
      echo "Example: cd apps/ml-service && python -m venv .venv && . .venv/bin/activate && pip install -e . && ./scripts/dev_start.sh --with-ml"
    fi
  else
    echo "apps/ml-service not found; skipping ML service start"
  fi
fi

echo "Starting Rust backend (API)... logs: logs/api.log"
nohup cargo run --manifest-path apps/api/Cargo.toml > logs/api.log 2>&1 &

sleep 2

echo "Starting Next.js frontend (web) — logs: logs/web.log"
nohup pnpm dev > logs/web.log 2>&1 &

echo "Waiting a few seconds for services to initialize..."
sleep 6

echo "Quick verification checks:"
if grep -q NEXT_PUBLIC_API_URL .env >/dev/null 2>&1; then
  API_URL=$(grep NEXT_PUBLIC_API_URL .env | sed -E 's/NEXT_PUBLIC_API_URL=//')
else
  API_URL="http://localhost:3001"
fi

echo "- Frontend: http://localhost:3000"
echo "- API: ${API_URL}"

echo "You can inspect logs in the 'logs' directory. To stop docker services: docker compose down"

echo "Done. If you want me to run verification curl commands now, ask me to and I'll run them." 
