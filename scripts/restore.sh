#!/usr/bin/env bash
set -euo pipefail

# ==============================================================================
# Nabat Al Atlas — Disaster Recovery Restore Script
# Usage: ./scripts/restore.sh backups/20261111_120000
# ==============================================================================

if [[ $# -lt 1 ]]; then
  echo "Usage: $0 <backup_directory>"
  exit 1
fi

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

BACKUP_DIR="$1"
if [[ ! -d "$BACKUP_DIR" || ! -f "$BACKUP_DIR/db_main.dump" ]]; then
  echo "[restore] ERROR: Invalid backup directory or missing db_main.dump in $BACKUP_DIR"
  exit 1
fi

if [[ -f .env ]]; then
  set -a
  # shellcheck disable=SC1091
  source .env
  set +a
fi

PG_USER="${POSTGRES_USER:-postgres}"
PG_DB="${POSTGRES_DB:-nabat_atlas}"

echo "[restore] Stopping web and worker containers before restore..."
docker compose stop web worker

echo "[restore] Restoring primary database ($PG_DB)..."
cat "$BACKUP_DIR/db_main.dump" | docker compose exec -T postgres pg_restore -U "$PG_USER" -d "$PG_DB" --clean --if-exists --no-owner

# Restore any dedicated DB dumps included in this snapshot
for dfile in "$BACKUP_DIR"/db_dedicated_*.dump; do
  [[ -e "$dfile" ]] || continue
  ddb="$(basename "$dfile" .dump | sed 's/^db_dedicated_//')"
  echo "[restore] Restoring dedicated DB ($ddb)..."
  docker compose exec -T postgres psql -U "$PG_USER" -d postgres -c "CREATE DATABASE \"$ddb\";" 2>/dev/null || true
  cat "$dfile" | docker compose exec -T postgres pg_restore -U "$PG_USER" -d "$ddb" --clean --if-exists --no-owner
done

echo "[restore] Starting web and worker containers..."
docker compose start web worker

if [[ -f "$BACKUP_DIR/storage.tar.gz" ]]; then
  echo "[restore] Restoring /app/storage media & digital assets..."
  cat "$BACKUP_DIR/storage.tar.gz" | docker compose exec -T web tar -xzf - -C /app/storage
fi

echo "[restore] Restore complete."

