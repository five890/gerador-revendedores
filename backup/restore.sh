#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "Defina DATABASE_URL antes de restaurar." >&2
  exit 1
fi

pnpm install --frozen-lockfile

if command -v psql >/dev/null 2>&1 && [[ -f "$ROOT/backup/database-data.sql" ]]; then
  psql "$DATABASE_URL" < "$ROOT/backup/database-data.sql"
elif command -v mysql >/dev/null 2>&1 && [[ -f "$ROOT/backup/database-data.sql" ]]; then
  mysql "$DATABASE_URL" < "$ROOT/backup/database-data.sql"
else
  echo "Cliente de banco ou database-data.sql não encontrado; configure o banco e importe o dump manualmente." >&2
fi

pnpm check
pnpm test
pnpm build

echo "Restauração e validações concluídas."
