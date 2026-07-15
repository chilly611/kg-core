#!/usr/bin/env bash
# demo.sh — the kg-core live demo, one command, runnable from ANY directory:
#
#   bash ~/Developer/kg-core/scripts/demo.sh               # start (keeps data)
#   bash ~/Developer/kg-core/scripts/demo.sh --reset       # pristine fixture first
#   bash ~/Developer/kg-core/scripts/demo.sh --as readonly # role-lens flip (beat 9)
#   bash ~/Developer/kg-core/scripts/demo.sh --as admin    # back to the admin lens
#
# What it does: stops any previous kg-core dev server (Next refuses to
# double-start), ensures the seeded local Postgres is up (scripts/db-dev.sh is
# idempotent), and starts the app at http://localhost:3000/workspace signed in
# as a fixture user. DEV_BYPASS is a LOCAL-ONLY convenience — it is never set
# on any deployed environment (see .env.example).
#
# Presenter script, beat by beat: docs/demo-walkthrough.md

set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

RESET=""
SUB="auth0|harborline-admin"
while [ $# -gt 0 ]; do
  case "$1" in
    --reset) RESET="--reset" ;;
    --as)
      shift
      case "${1:-}" in
        admin|editor|readonly) SUB="auth0|harborline-$1" ;;
        *) echo "usage: --as admin|editor|readonly" >&2; exit 1 ;;
      esac ;;
    *) echo "unknown flag: $1 (known: --reset, --as admin|editor|readonly)" >&2; exit 1 ;;
  esac
  shift
done

# Stop a previous dev server belonging to THIS repo, wherever it's listening.
for port in 3000 3100; do
  pid="$(lsof -nP -iTCP:$port -sTCP:LISTEN -t 2>/dev/null | head -n 1 || true)"
  [ -n "$pid" ] || continue
  cwd="$(lsof -a -p "$pid" -d cwd -Fn 2>/dev/null | grep '^n' | cut -c2- || true)"
  if [ "$cwd" = "$ROOT" ]; then
    echo "== stopping previous demo server (pid $pid, port $port)"
    kill "$pid" 2>/dev/null || true
    sleep 2
  fi
done

# Seeded local Postgres — starts/creates only what's missing; --reset re-seeds.
if [ -n "$RESET" ]; then scripts/db-dev.sh --reset; else scripts/db-dev.sh; fi

echo
echo "== demo lens: ${SUB#auth0|harborline-} — open http://localhost:3000/workspace"
echo "== stop with Ctrl-C · beats: docs/demo-walkthrough.md"
echo
DEV_BYPASS=true DEV_BYPASS_SUB="$SUB" \
DATABASE_URL="postgres://postgres@localhost:${KG_PG_PORT:-55432}/kg_core_dev" \
exec npm run dev
