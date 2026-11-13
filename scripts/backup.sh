#!/usr/bin/env bash
set -euo pipefail

# ==============================================================================
# Nabat Al Atlas — Automated PostgreSQL (Control + Shared + Dedicated) & Storage Backup
# ==============================================================================

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

if [[ -f .env ]]; then
  set -a
  # shellcheck disable=SC1091
  source .env
  set +a
fi

PG_USER="${POSTGRES_USER:-postgres}"
PG_DB="${POSTGRES_DB:-nabat_atlas}"
RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-14}"
STAMP="$(date +%Y%m%d_%H%M%S)"
BACKUP_DIR="$ROOT_DIR/backups/$STAMP"

mkdir -p "$BACKUP_DIR"

echo "[backup] Dumping primary database ($PG_DB)..."
docker compose exec -T postgres pg_dump -U "$PG_USER" -Fc "$PG_DB" > "$BACKUP_DIR/db_main.dump"

# Discover dedicated tenant databases registered on local PostgreSQL cluster
DEDICATED_DBS="$(docker compose exec -T postgres psql -U "$PG_USER" -d "$PG_DB" -tAc \
  "SELECT COALESCE(db_name, '') FROM control_plane.tenants WHERE isolation_mode = 'DEDICATED' AND db_name IS NOT NULL AND db_name <> '';" 2>/dev/null || true)"

if [[ -n "$DEDICATED_DBS" ]]; then
  while IFS= read -r ddb; do
    ddb_trimmed="$(echo "$ddb" | tr -d '[:space:]')"
    if [[ -n "$ddb_trimmed" ]]; then
      echo "[backup] Dumping dedicated tenant DB ($ddb_trimmed)..."
      docker compose exec -T postgres pg_dump -U "$PG_USER" -Fc "$ddb_trimmed" > "$BACKUP_DIR/db_dedicated_${ddb_trimmed}.dump" || true
    fi
  done <<< "$DEDICATED_DBS"
fi

echo "[backup] Archiving uploaded media & digital assets..."
if docker compose exec -T web sh -c "test -d /app/storage" >/dev/null 2>&1; then
  docker compose exec -T web tar -czf - -C /app/storage . > "$BACKUP_DIR/storage.tar.gz"
fi

# Generate SHA-256 manifest
(cd "$BACKUP_DIR" && sha256sum ./* > SHA256SUMS 2>/dev/null || true)

# Prune backups older than retention window
find "$ROOT_DIR/backups" -maxdepth 1 -mindepth 1 -type d -mtime +"$RETENTION_DAYS" -exec rm -rf {} + 2>/dev/null || true

echo "[backup] Backup completed successfully: $BACKUP_DIR"

