#!/usr/bin/env bash
# kg-core local DB harness — no Docker required.
# Spins a throwaway Postgres cluster, applies all migrations + seed, runs SQL tests.
#
# Prereqs: Postgres 15+ binaries on PATH, or PG_BIN pointing at their bin/ dir.
#   (micromamba route: micromamba create -p ~/pgenv -c conda-forge postgresql=16)
#
# Usage: scripts/db-test.sh
# Env:   PG_BIN=/path/to/pg/bin   KG_PG_PORT=55432
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
DB=kg_core_test

mkdir -p "$ROOT/.local"

if [ ! -d "$PGDATA" ]; then
  echo "== initdb (throwaway cluster at .local/pgdata)"
  initdb -D "$PGDATA" -U postgres --auth=trust >/dev/null
fi

STARTED_HERE=0
if ! pg_ctl -D "$PGDATA" status >/dev/null 2>&1; then
  echo "== starting postgres on port $PGPORT"
  pg_ctl -D "$PGDATA" -o "-p $PGPORT -c listen_addresses=localhost" \
         -l "$ROOT/.local/pg.log" start >/dev/null
  STARTED_HERE=1
fi
cleanup() {
  if [ "$STARTED_HERE" = "1" ]; then
    pg_ctl -D "$PGDATA" stop -m fast >/dev/null 2>&1 || true
  fi
}
trap cleanup EXIT

echo "== recreating database $DB (drop-and-recreate freedom: no production data here, ever)"
dropdb --if-exists "$DB"
createdb "$DB"

# Shim the roles hosted Supabase provides out of the box.
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

echo "== applying migrations"
for f in "$ROOT"/supabase/migrations/*.sql; do
  echo "   $(basename "$f")"
  psql -d "$DB" -v ON_ERROR_STOP=1 -q -f "$f"
done

echo "== applying seed"
psql -d "$DB" -v ON_ERROR_STOP=1 -q -f "$ROOT/supabase/seed.sql"

echo "== running tests"
count=0
for t in "$ROOT"/supabase/tests/*.sql; do
  echo "-- $(basename "$t")"
  psql -d "$DB" -v ON_ERROR_STOP=1 -q -f "$t"
  count=$((count + 1))
done

echo "== ALL $count TEST FILES PASSED"
