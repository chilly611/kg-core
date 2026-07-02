# tasks.todo.md — kg-core

## NOW
- [ ] **Founder: walk John & Rich through the build.** Send <https://kgcore-walkthrough.vercel.app>, then run the 15-minute live demo per `docs/demo-walkthrough.md` (local fixture, ten beats, role-lens flip, hosted fail-closed close). Prep is two commands.
- [ ] **Founder: Auth0 tenant** — the unlock for a signed-in HOSTED demo (today the live URL correctly shows "Not signed in"). Then add `AUTH0_*` + `APP_BASE_URL` to `scripts/vercel-standup.sh` env list and rerun.
- [ ] Redeploy after any merge: `VERCEL_TOKEN=PASTE_TOKEN_HERE scripts/vercel-standup.sh`. Runbook incl. domain traps: `docs/vercel.md`.
- [ ] Founder: want a custom domain (e.g. `core.theknowledgegardens.com`) instead of `kgcore-eight.vercel.app`? Bare `kg-core.vercel.app`/`kgcore.vercel.app` are unavailable (held elsewhere; see runbook).
- [x] ~~Vercel stand-up~~ LIVE 2026-07-02: project `kgcore` @ `the-knowledge-gardens`, `origin/main` `f962447`, env pushed, verified 200/401.
- [x] ~~Merge `infra/vercel-standup`~~ merged as PR #4 (`f962447`).
- [x] ~~Founder: dogfood + merge `rebuild/ledger-journey-port`~~ merged as PR #3 (`950a328`).

## NEXT
- [ ] **CODE-D: module slots** — fill the gated Journey/Budget rails stubbed in the detail rail.
- [ ] Founder: add ANTHROPIC_API_KEY (.env.local) → NL capture upgrades from heuristic to Claude; add GOOGLE_PLACES_KEY → type-ahead replaces the manual-fields fallback. Both legs are code-complete but unexercised.
- [ ] Rubicon queue surface: draft contact_types exist in the DB (status='draft') — needs an operator review UI (promote/delete).
- [x] ~~Founder: provide the new dev Supabase project ref~~ done 2026-07-02: `eyvzjofjwbxmryzupfsy` (kg-core-dev, us-west-1); migrations + seed applied via psql over the session pooler, SQL tests green hosted, `.env.local` points at it.
- [ ] After the Auth0 tenant lands: add `AUTH0_*` (+ `APP_BASE_URL`) to `scripts/vercel-standup.sh`'s env list and redeploy.
- [x] ~~CODE-B grid workspace~~ merged as PR #1.
- [ ] Auth0 wiring: forward the Auth0 access token as the Supabase JWT; verify `current_client_id()` resolves against the dev project.
- [ ] Google Places address normalization behind a seam (raw_input → normalized/place_id).

## LATER
- [ ] Per-table tightening of the v0 client-level RLS leniency as rows gain group/project scope columns.
- [ ] Generated TS types from the schema.
