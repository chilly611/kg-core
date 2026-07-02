#!/usr/bin/env bash
# vercel-standup.sh — create/link the kg-core Vercel project, push env, deploy origin/main.
#
# The Vercel dashboard is locked out; every Vercel operation is CLI-only with a
# token pasted into the session (never written to a file, never committed).
# This script is the whole stand-up AND the redeploy path — auto-deploy on merge
# is unavailable without the dashboard, so rerun it after every merge to main.
#
#   VERCEL_TOKEN=PASTE_TOKEN_HERE scripts/vercel-standup.sh            # deploy production
#   VERCEL_TOKEN=PASTE_TOKEN_HERE scripts/vercel-standup.sh --preview  # preview deploy only
#
# What it does, in order:
#   1. Reads the four runtime env values out of .env.local (the only place
#      secrets live). Aborts if any is missing or resolves to the shared
#      production Supabase project (vlezoyalutexenbnzzui — hard rule).
#      DEV_BYPASS is structurally never pushed: only the fixed list below goes up.
#   2. Snapshots origin/main (fetched fresh) into a temp dir — deploys are the
#      merged state, never your working tree.
#   3. Creates the Vercel project if needed, links, pushes env (production +
#      preview targets), deploys, then copies .vercel/project.json back into
#      the repo root (gitignored) so future one-off CLI ops are linked.
#
# Deployed posture with this env set: UI shell renders; every API returns 401
# (no Auth0 tenant yet, DEV_BYPASS absent); document uploads go to the private
# `documents` bucket on kg-core-dev. See docs/vercel.md.

set -euo pipefail

SCOPE="the-knowledge-gardens"
PROJECT="kg-core"
PROD_ALIAS="https://kg-core.vercel.app"
ENV_VARS="NEXT_PUBLIC_SUPABASE_URL NEXT_PUBLIC_SUPABASE_ANON_KEY SUPABASE_SERVICE_ROLE_KEY DATABASE_URL"
FORBIDDEN_REF="vlezoyalutexenbnzzui"

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="$REPO_ROOT/.env.local"

MODE="prod"
[ "${1:-}" = "--preview" ] && MODE="preview"

[ -n "${VERCEL_TOKEN:-}" ] || {
  echo "VERCEL_TOKEN is required. Paste it inline (bare token, no brackets or quotes needed):" >&2
  echo "  VERCEL_TOKEN=PASTE_TOKEN_HERE scripts/vercel-standup.sh" >&2
  exit 1
}
case "$VERCEL_TOKEN" in
  *"<"*|*">"*)
    echo "VERCEL_TOKEN contains < or > — those were placeholder brackets in the docs." >&2
    echo "Paste the bare token: VERCEL_TOKEN=cp_xxxx scripts/vercel-standup.sh" >&2
    echo "(In zsh, an unquoted < also silently redirects — part of the token may have been eaten.)" >&2
    exit 1 ;;
esac
[ -f "$ENV_FILE" ] || { echo "$ENV_FILE not found — fill it from .env.example first." >&2; exit 1; }

vc() { npx --yes vercel@latest "$@" --token "$VERCEL_TOKEN"; }
env_val() { sed -n "s/^$1=//p" "$ENV_FILE" | head -n 1; }

# Fail fast on auth problems, with errors that name the actual fix.
WHO="$(vc whoami 2>/dev/null | tail -n 1)" || true
[ -n "$WHO" ] || {
  echo "Vercel rejected the token (whoami failed) — it is invalid, expired, or incomplete." >&2
  echo "Re-copy it from Account Settings -> Tokens (or mint a new one) and paste it bare." >&2
  exit 1
}
echo "Token OK — authenticated as: $WHO"
vc projects ls --scope "$SCOPE" >/dev/null 2>&1 || {
  echo "Token works but cannot access team '$SCOPE'." >&2
  echo "When creating the token, set Scope to 'Full Account' (or one covering $SCOPE), then retry." >&2
  exit 1
}

# Fail fast on env problems before touching the network. Values stay out of logs.
for var in $ENV_VARS; do
  val="$(env_val "$var")"
  [ -n "$val" ] || { echo "Missing $var in .env.local — refusing." >&2; exit 1; }
  case "$val" in
    *"$FORBIDDEN_REF"*) echo "$var resolves to the shared production Supabase project. Refusing." >&2; exit 1 ;;
  esac
done

git -C "$REPO_ROOT" fetch origin
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
git -C "$REPO_ROOT" archive origin/main | tar -x -C "$TMP"
echo "Deploying origin/main ($(git -C "$REPO_ROOT" rev-parse --short origin/main)) as $MODE"

cd "$TMP"
vc project add "$PROJECT" --scope "$SCOPE" 2>/dev/null || true # no-op if it already exists
vc link --yes --project "$PROJECT" --scope "$SCOPE"

for var in $ENV_VARS; do
  for target in production preview; do
    vc env rm "$var" "$target" --yes 2>/dev/null || true # idempotent re-runs
    env_val "$var" | tr -d '\n' | vc env add "$var" "$target"
  done
done

if [ "$MODE" = "prod" ]; then
  URL="$(vc deploy --prod --yes)"
else
  URL="$(vc deploy --yes)"
fi
echo "Deployment URL: $URL"

mkdir -p "$REPO_ROOT/.vercel"
cp "$TMP/.vercel/project.json" "$REPO_ROOT/.vercel/project.json"

if [ "$MODE" = "prod" ]; then
  code="000"
  for _ in 1 2 3 4 5 6; do
    code="$(curl -s -o /dev/null -w '%{http_code}' -L "$PROD_ALIAS/workspace" || echo 000)"
    [ "$code" = "200" ] && break
    sleep 5
  done
  echo "$PROD_ALIAS/workspace -> HTTP $code (expect 200; APIs 401 until Auth0)"
  if [ "$code" != "200" ]; then
    echo "If the kg-core.vercel.app alias was taken globally, find the real one with:" >&2
    echo "  npx vercel@latest inspect $URL --scope $SCOPE --token \$VERCEL_TOKEN" >&2
  fi
else
  echo "Preview deployments have Vercel Authentication on by default — open in a browser."
fi

echo "Done. Remember: merges do NOT auto-deploy; rerun this script to ship main."
