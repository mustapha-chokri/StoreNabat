#!/usr/bin/env bash
set -euo pipefail

# ==============================================================================
# Nabat Al Atlas — Production VPS Zero-Friction Deploy Script
# ==============================================================================

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

if [[ ! -f .env ]]; then
  echo "[deploy] ERROR: .env file not found in $ROOT_DIR. Copy .env.example and configure secrets first."
  exit 1
fi

echo "[deploy] Checking repository updates..."
if [[ -d .git ]]; then
  git pull --ff-only || echo "[deploy] Warning: skipped git pull (local modifications present)."
fi

# Run pre-deployment backup when PostgreSQL is already active
if docker compose ps --status running postgres >/dev/null 2>&1; then
  if [[ -x scripts/backup.sh ]]; then
    echo "[deploy] Taking pre-deployment safety backup..."
    bash scripts/backup.sh || echo "[deploy] Warning: pre-deploy backup skipped."
  fi
fi

echo "[deploy] Building and starting containers..."
docker compose up -d --build postgres redis web worker nginx

echo "[deploy] Waiting for PostgreSQL and Worker readiness..."
sleep 5

echo "[deploy] Running database migrations and RLS enforcement..."
docker compose exec -T worker npm run db:migrate

echo "[deploy] Checking application health endpoint..."
for i in $(seq 1 15); do
  if curl -fsS http://127.0.0.1/api/health >/dev/null 2>&1 || docker compose exec -T web wget -qO- http://127.0.0.1:3000/api/health >/dev/null 2>&1; then
    echo "[deploy] Health check PASSED. Deployment successful."
    exit 0
  fi
  echo "[deploy] Waiting for web container ($i/15)..."
  sleep 2
done

echo "[deploy] ERROR: Health check did not pass within timeout. Check 'docker compose logs web worker'."
exit 1

