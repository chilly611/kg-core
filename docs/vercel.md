# Vercel — kg-core

*Runbook for standing up and redeploying the hosted app. One script does everything: `scripts/vercel-standup.sh`.*

## Identity
- **Project:** `kgcore` (`prj_T8ZO5IWGAHzzZfaC1ctgb1rJl6tk`) · **Team scope:** `the-knowledge-gardens` (`team_JQzNMFY8gRKOV45SN17A4zwG`)
- **Production URL:** `https://kgcore-eight.vercel.app` — the domain Vercel auto-granted at first deploy. This is THE url; see the traps section for why it isn't `kg-core.vercel.app`.
- **Dashboard is locked out** (2FA passkey unavailable). All operations are CLI (`npx --yes vercel@latest`) with a `VERCEL_TOKEN` the founder pastes per session (current tokens look like `vcp_…`). Never persist the token to a file, env profile, or commit. The token defaults to the personal scope, so team operations need `--scope the-knowledge-gardens` (the script passes it).
- Deployment Protection is the default (Standard): previews and generated URLs sit behind Vercel SSO; the production domain above is public.

## vercel.app domain traps (learned the hard way, 2026-07-02)
- **The domains API lies.** `vercel project add` / `POST /projects/:id/domains` will record a `*.vercel.app` name as yours (`verified: true`) even when it is held by another account globally — and the edge then serves `404 NOT_FOUND` on it forever, while `aliasAssigned`/`aliasError` claim success. `kg-core.vercel.app` and `kgcore.vercel.app` are both in that state: externally held, unusable.
- **Only trust the domain Vercel auto-grants at deploy time.** The auto-namer knows real availability (it granted `kgcore-eight.vercel.app` because bare `kgcore` was taken).
- **Bootstrap new projects deploy-first.** Projects created via `project add` + `link` + `deploy` came up with hostnames that never bound at the edge; deleting and recreating under the same name inherits the breakage. Create by running `vercel deploy` from a directory named for the project, then rerun the stand-up script to push env and redeploy.
- A custom domain (e.g. `core.theknowledgegardens.com`) sidesteps all of this whenever the founder wants one — add it to the project and point DNS.

## Stand up / redeploy (same command)
```sh
VERCEL_TOKEN=PASTE_TOKEN_HERE scripts/vercel-standup.sh            # production
VERCEL_TOKEN=PASTE_TOKEN_HERE scripts/vercel-standup.sh --preview  # preview only
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
- When the Auth0 tenant lands: add `AUTH0_*` + `APP_BASE_URL=https://kgcore-eight.vercel.app` to the script's `ENV_VARS` list and rerun it.

## Verify a deploy
```sh
curl -sI -L https://kgcore-eight.vercel.app/workspace   # 200, title "Knowledge Gardens — Workspace"
curl -sI https://kgcore-eight.vercel.app/api/me         # 401 until Auth0
```
Then prove it in a real browser (lane rule: tests passing ≠ shipped).

## Stood up 2026-07-02
Project created deploy-first, env pushed, redeployed with env baked in; verified `/` → 307 → `/workspace` → 200, `/api/me` → 401. The founder's repo at `~/Developer/kg-core` is linked (`.vercel/project.json`, gitignored). Full narrative in `docs/session-log.md`.
