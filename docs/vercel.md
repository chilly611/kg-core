# Vercel — kg-core

*Runbook for standing up and redeploying the hosted app. One script does everything: `scripts/vercel-standup.sh`.*

## Identity
- **Project:** `kg-core` · **Team scope:** `the-knowledge-gardens` (`team_JQzNMFY8gRKOV45SN17A4zwG`)
- **Production alias:** `https://kg-core.vercel.app` (unless the global alias namespace forced a suffix — the script prints how to check)
- **Dashboard is locked out.** All operations are CLI (`npx --yes vercel@latest`) with a `VERCEL_TOKEN` the founder pastes per session. Never persist the token to a file, env profile, or commit. The token defaults to the personal scope, so team operations need `--scope the-knowledge-gardens` (the script passes it).

## Stand up / redeploy (same command)
```sh
VERCEL_TOKEN=<paste> scripts/vercel-standup.sh            # production
VERCEL_TOKEN=<paste> scripts/vercel-standup.sh --preview  # preview only
```
- Deploys a fresh snapshot of **`origin/main`**, never the working tree.
- **Merges do not auto-deploy.** Git integration needs the dashboard, which is unavailable — after every merge to main, rerun the script or prod stays stale.
- Idempotent: safe to rerun; env vars are replaced, not duplicated.

## Environment
Source of truth is `.env.local` (gitignored; filled from `.env.example`). The script pushes exactly four vars to the `production` and `preview` targets:

| Var | Points at |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | kg-core-dev (`eyvzjofjwbxmryzupfsy`) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | kg-core-dev publishable key |
| `SUPABASE_SERVICE_ROLE_KEY` | kg-core-dev secret key (storage seam) |
| `DATABASE_URL` | kg-core-dev session pooler (`aws-1-us-west-1.pooler.supabase.com:5432`) |

Hard rules, enforced by the script **and** by `lib/server/db.ts` at boot:
- Nothing may resolve to `vlezoyalutexenbnzzui` (shared BKG/Orchid/Tox production).
- **`DEV_BYPASS` is never deployed.** It maps every visitor to the fixture admin with no credentials — on a public URL that is an open door to the database. `.env.example` says the same.

## What the deployed app does today (pre-Auth0)
- `/` → 307 → `/workspace`; the workspace shell renders (static prerender, no build-time DB).
- Every `/api/*` route returns **401**: `getSessionClaims()` (`lib/server/auth.ts`) finds no Auth0 config and no `DEV_BYPASS`, so requests are unauthenticated and RLS'd data stays locked. Grids render empty. This is the intended posture until the Auth0 tenant lands.
- Document uploads (once authed) go to the private `documents` bucket on kg-core-dev via the storage seam — not lambda-local disk.
- New Vercel projects ship with Standard Deployment Protection: per-deployment URLs and previews sit behind Vercel Authentication; the production alias is public.

## Verify a deploy
```sh
curl -sI -L https://kg-core.vercel.app/workspace   # 200
curl -sI https://kg-core.vercel.app/api/me         # 401 until Auth0
```
Then prove it in a real browser (lane rule: tests passing ≠ shipped).
