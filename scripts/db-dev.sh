#!/usr/bin/env bash
# kg-core local DEV database — the cluster `npm run dev` talks to (no Docker).
# Starts (and leaves running) the local Postgres, and (re)creates kg_core_dev
# with all migrations + seed. Companion to scripts/db-test.sh, which uses a
# separate throwaway database and stops the server after.
#
# Usage: scripts/db-dev.sh [--reset]     (--reset drops and re-seeds kg_core_dev)
#        scripts/db-dev.sh --stop        (stops the local cluster)
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PG_BIN="${PG_BIN:-}"

if [ -z "$PG_BIN" ]; then
  if command -v pg_ctl >/dev/null 2>&1; then
    PG_BIN="$(dirname "$(command -v pg_ctl)")"
  elif [ -x "$HOME/Developer/kg-core-tools/pgenv/bin/pg_ctl" ]; then
    PG_BIN="$HOME/Developer/kg-core-tools/pgenv/bin"
  else
    echo "ERROR: no Postgres found. Install one (micromamba/conda-forge works without sudo) or set PG_BIN." >&2
    exit 1
  fi
fi
export PATH="$PG_BIN:$PATH"

PGDATA="$ROOT/.local/pgdata"
export PGHOST=localhost
export PGPORT="${KG_PG_PORT:-55432}"
export PGUSER=postgres
DB=kg_core_dev

if [ "${1:-}" = "--stop" ]; then
  pg_ctl -D "$PGDATA" stop -m fast
  exit 0
fi

mkdir -p "$ROOT/.local"

if [ ! -d "$PGDATA" ]; then
  echo "== initdb (local dev cluster at .local/pgdata)"
  initdb -D "$PGDATA" -U postgres --auth=trust >/dev/null
fi

if ! pg_ctl -D "$PGDATA" status >/dev/null 2>&1; then
  echo "== starting postgres on port $PGPORT"
  pg_ctl -D "$PGDATA" -o "-p $PGPORT -c listen_addresses=localhost" \
         -l "$ROOT/.local/pg.log" start >/dev/null
fi

if [ "${1:-}" = "--reset" ]; then
  echo "== dropping $DB (drop-and-recreate freedom: dev data only)"
  dropdb --if-exists "$DB"
fi

if ! psql -lqt | cut -d '|' -f 1 | grep -qw "$DB"; then
  echo "== creating $DB: roles shim + migrations + seed"
  createdb "$DB"
  psql -d "$DB" -v ON_ERROR_STOP=1 -q <<'SQL'
do $$
begin
  if not exists (select from pg_roles where rolname = 'anon') then
    create role anon nologin;
  end if;
  if not exists (select from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin;
  end if;
  if not exists (select from pg_roles where rolname = 'service_role') then
    create role service_role nologin bypassrls;
  end if;
end $$;
SQL
  for f in "$ROOT"/supabase/migrations/*.sql; do
    psql -d "$DB" -v ON_ERROR_STOP=1 -q -f "$f"
  done
  psql -d "$DB" -v ON_ERROR_STOP=1 -q -f "$ROOT/supabase/seed.sql"
else
  echo "== $DB already exists (use --reset to rebuild from migrations + seed)"
fi

echo "== ready: postgres://postgres@localhost:$PGPORT/$DB"
echo "   next: DEV_BYPASS=true npm run dev   (or put DEV_BYPASS=true in .env.local)"
