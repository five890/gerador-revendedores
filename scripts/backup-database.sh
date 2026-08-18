#!/usr/bin/env bash
set -euo pipefail

: "${BACKUP_DATABASE_URL:?Defina BACKUP_DATABASE_URL no ambiente do hospedador}"
OUT_DIR="${1:-./backup-runs/$(date -u +%Y%m%d-%H%M%S)}"
mkdir -p "$OUT_DIR"
cleanup() {
  if [[ -n "${MYSQL_CNF:-}" && -f "$MYSQL_CNF" ]]; then
    rm -f "$MYSQL_CNF"
  fi
}
trap cleanup EXIT

if [[ "${BACKUP_DATABASE_URL}" == postgres://* || "${BACKUP_DATABASE_URL}" == postgresql://* ]]; then
  command -v pg_dump >/dev/null 2>&1 || { echo "pg_dump não instalado" >&2; exit 1; }
  pg_dump --no-owner --no-privileges --format=custom "$BACKUP_DATABASE_URL" > "$OUT_DIR/database.dump"
  echo "postgresql" > "$OUT_DIR/database-engine.txt"
elif [[ "${BACKUP_DATABASE_URL}" == mysql://* || "${BACKUP_DATABASE_URL}" == mariadb://* ]]; then
  command -v mysqldump >/dev/null 2>&1 || { echo "mysqldump não instalado" >&2; exit 1; }
  MYSQL_CNF="$(mktemp)"
  chmod 600 "$MYSQL_CNF"
  BACKUP_DATABASE_URL="$BACKUP_DATABASE_URL" MYSQL_CNF="$MYSQL_CNF" python3 - <<'PY'
import os
from urllib.parse import urlparse, unquote

url = urlparse(os.environ["BACKUP_DATABASE_URL"])
with open(os.environ["MYSQL_CNF"], "w", encoding="utf-8") as f:
    f.write("[client]\n")
    if url.hostname:
        f.write(f"host={url.hostname}\n")
    if url.port:
        f.write(f"port={url.port}\n")
    if url.username:
        f.write(f"user={unquote(url.username)}\n")
    if url.password:
        f.write(f"password={unquote(url.password)}\n")
PY
  DB_NAME="${BACKUP_DATABASE_URL#*/}"
  DB_NAME="${DB_NAME%%\?*}"
  DB_NAME="${DB_NAME%%/*}"
  mysqldump --defaults-extra-file="$MYSQL_CNF" --single-transaction --routines --triggers --events --hex-blob --databases "$DB_NAME" | gzip -9 > "$OUT_DIR/database.sql.gz"
  echo "mysql" > "$OUT_DIR/database-engine.txt"
else
  echo "BACKUP_DATABASE_URL deve começar com postgres://, postgresql://, mysql:// ou mariadb://" >&2
  exit 1
fi

printf 'Shelby Panel database backup\nCreated UTC: %s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" > "$OUT_DIR/backup-info.txt"
sha256sum "$OUT_DIR"/* > "$OUT_DIR/SHA256SUMS"
printf 'Backup criado em %s\n' "$OUT_DIR"
