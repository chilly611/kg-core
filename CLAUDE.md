# CLAUDE.md — kg-core
*Lane rules for Claude Code / Cowork sessions · 2026-07*

## What this is
The category-agnostic record engine for The Knowledge Gardens. From-scratch rebuild (decided 2026-06-30 with Rich). The old BKG app at `~/Developer/bkg` is **frozen** — never modify it, never import from it.

## Read first, every session
1. `docs/session-log.md` — top NOW block.
2. `tasks.todo.md` — NOW section.
3. `tasks.lessons.md` — don't repeat what's already been learned.
4. `docs/core-data-model.md` — the model and the Rubicon Rule.

## Hard safety rules
- **NEVER connect to, link, or run DDL against Supabase project `vlezoyalutexenbnzzui`** (shared BKG/Orchid/Tox production). If any config resolves to it, STOP and tell the founder.
- No secrets in the repo. `.env.example` only.
- Drop-and-recreate freedom applies to local/dev databases only — it **ends at production data**.

## Lane discipline
- **Serial branches.** One write lane at a time; branch + PR for everything after the initial scaffold. No direct commits to main.
- **Founder merges on green.** Green = migrations apply clean + all SQL tests pass (`scripts/db-test.sh`) + build passes.
- **Founder dogfood is the shipping gate.** Tests passing ≠ shipped; the founder using it on real work is.
- **Rubicon Rule:** any category-specific attribute proposal (column, constraint, branch on `clients.kind`) stops for a design conversation before build. See `docs/core-data-model.md`.
- Tight scope: make exactly the changes specified; flag out-of-scope changes, don't silently do them.
- Append `docs/session-log.md` every session; keep `tasks.todo.md` NOW current; update `tasks.lessons.md` after any correction.

## Stack
Next.js (App Router) · TypeScript · Tailwind v4 · Supabase (dedicated kg-core project — see safety rules) · Auth0 · Anthropic API.

## Design system
Herbarium light system: light backgrounds only, no dark themes, no red `#E8443A`, no pure white. Archivo + Archivo Black. (The 2026-05-28 BKG palette/Clerk instructions are superseded.)

## Verify before "done"
- `scripts/db-test.sh` — local Postgres harness (no Docker): migrations + seed + SQL tests.
- Or `supabase db reset` with Docker/local stack, then `psql -f supabase/tests/*.sql`.
- App changes: prove them in a real browser, not just in a smoke test.
