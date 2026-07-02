# kg-core session log
*Append-only. Newest entry on top. Keep a NOW block current.*

## NOW
- **kg-core is LIVE: <https://kgcore-eight.vercel.app>** (Vercel project `kgcore` @ `the-knowledge-gardens`, deployed `origin/main` `f962447`, all four kg-core-dev env vars on production+preview). Verified: `/` → 307 → `/workspace` 200 ("Knowledge Gardens — Workspace"), `/api/me` 401 (intended pre-Auth0 posture). Founder: dogfood it in a browser. Redeploy after any merge = `VERCEL_TOKEN=PASTE_TOKEN_HERE scripts/vercel-standup.sh` (no auto-deploy — dashboard still locked out, 2FA passkey).
- The URL is `kgcore-eight` because bare `kg-core.vercel.app`/`kgcore.vercel.app` are held elsewhere globally and Vercel's domains API records them as yours anyway while the edge 404s them — full traps writeup in `docs/vercel.md`. A custom domain (e.g. `core.theknowledgegardens.com`) sidesteps this whenever wanted.
- CODE-E merged (PR #3, `950a328`). Dev Supabase `eyvzjofjwbxmryzupfsy` live: migrations + seed applied hosted, SQL tests green over the session pooler (2026-07-02 session).
- Until the Auth0 tenant exists: workspace shell renders, every API 401s, data stays behind RLS.

---

## 2026-07-02 — Stand-up round 2: LIVE at kgcore-eight.vercel.app (Claude Code, autonomous)
- Real token arrived (`vcp_…` — first paste had lost the leading `v` to the zsh `<` redirect). `whoami` = `chillydahlgren`, team visible. Dashboard confirmed still locked (founder screenshot: passkey 2FA wall) — paste-per-session continues.
- Script ran clean end-to-end (project create → env ×8 → prod deploy READY)… and then the real saga: **every project domain 404'd at the edge while Vercel's control plane swore `aliasAssigned`, no `aliasError`, PROMOTED.** Generated/alias URLs routed (302 SSO) but project domains never bound. Domain rm/re-add, fresh deploys, delete+recreate under the same name — no fix (recreate made it worse: tombstoned hostnames).
- **Canary isolation** (throwaway static project): fresh deploy-created project routed fine, its bare auto-domain served 200 → platform healthy, `project add`-created projects + externally-held bare names were the poison. `kg-core.vercel.app` and `kgcore.vercel.app` are held by other accounts globally; the domains API records them as yours (`verified:true`) anyway and the edge 404s forever.
- **Fix:** recreate deploy-first (deploy from a dir named `kgcore` auto-creates the project and grants an honest domain — `kgcore-eight.vercel.app`), then rerun the stand-up script to push env + redeploy with env baked in. Verified live (200/401/title). Founder repo `.vercel/project.json` linked (`prj_T8ZO5IWGAHzzZfaC1ctgb1rJl6tk`). Canary + poisoned projects deleted; `kgcore` has exactly one domain.
- Script updated: `PROJECT=kgcore`, real `PROD_ALIAS`, CLI-54 JSON stdout parsing, bootstrap-deploy-first rule documented in the header. Runbook gained a "vercel.app domain traps" section.

## 2026-07-02 — First stand-up run: zsh placeholder trap + invalid token (Claude Code, autonomous)
- Founder ran `VERCEL_TOKEN=<cp_…` in zsh — the literal `<` from the docs' `VERCEL_TOKEN=<paste>` placeholder is a redirect in zsh, so the shell tried to open the token as a file and the script never ran. Docs placeholder was mine; trap fixed everywhere (`PASTE_TOKEN_HERE`, no angle brackets) and the script now refuses tokens containing `<`/`>` with an explanation.
- Reran the stand-up in-session with the pasted token: `vercel whoami` → "token is not valid". The earlier "You do not have access to the specified account" on `link --scope the-knowledge-gardens` was the same auth failure surfacing through scope resolution. So: token invalid/expired/incomplete (possibly characters lost around the `<`), or not a Vercel API token.
- Hardened `scripts/vercel-standup.sh` to fail fast pre-flight: bracket check → `whoami` (invalid-token message) → `projects ls --scope the-knowledge-gardens` (under-scoped-token message naming the Full Account fix). No more confusing scope errors as the first symptom.
- Open question for founder: if this token was minted today, dashboard access may be restored — that would re-enable git auto-deploy and end the paste-per-session era; worth confirming.

## 2026-07-02 — Vercel stand-up scripted; deploy is founder-token-gated (Claude Code, autonomous)
- Task: "stand up Vercel for kg-core." The token is pasted per session (never persisted — see bkg deploy rules) and no token was provided this session, so the authenticated calls can't run here. Everything up to them is done and verified; the stand-up is now one paste-and-run.
- **Proved `origin/main` (950a328) builds for production**: clean `git archive` → `npm ci` → `next build` with the real kg-core-dev env (minus `DEV_BYPASS`). Green. `/workspace` + `/workspace/import` prerender static (no build-time DB); all `/api/*` dynamic.
- **`scripts/vercel-standup.sh`** (macOS bash-3.2-safe): env-guards first (aborts on missing vars or anything resolving to `vlezoyalutexenbnzzui`; only the fixed 4-var list is ever pushed, so `DEV_BYPASS` structurally can't leak), snapshots `origin/main` to a temp dir, `project add` → `link` → `env rm/add` (production+preview, idempotent) → `deploy`, copies `.vercel/project.json` back (gitignored), curl-verifies the prod alias. `--preview` flag for non-prod runs.
- **Dry-ran the whole script** against a stubbed `vercel` CLI: call sequence correct, deploy URL captured, link copy-back works, forbidden-ref guard refuses (exit 1). Token guard refuses when `VERCEL_TOKEN` unset.
- **`docs/vercel.md`** runbook: identity (project `kg-core`, scope `the-knowledge-gardens`), CLI-only reality, env table, deployed posture pre-Auth0 (shell 200 / APIs 401 / uploads → private `documents` bucket), verify commands.
- Alias check: `kg-core.vercel.app` currently serves Vercel's 404 — global alias likely free.
- Flagged for after Auth0 lands: add `AUTH0_*` to the script's env list + `APP_BASE_URL` for the prod domain.

## 2026-07-02 — CODE-E: BKG primitives ported onto the core model (Claude Code, autonomous)
- **Ledger** ported from bkg `feat/one-loop-ledger` (61eff69): double-entry journal with the deferrable Σdebit=Σcredit constraint trigger, approved-COs-move-budget invariant, reversal-not-delete, `ledger_assert_reconcile` (raise before rendering a bad number). Adapted: public schema + client_id RLS keyed on core projects.id; cost codes are CLIENT VOCABULARY (`ledger_cost_codes`), not MasterFormat; rollup caches DROPPED (they existed only for Realtime broadcast — truth is the view; poll seam until hosted Supabase). Commitments/ETC/hash-chain deferred. Test 05: 8 assertions incl. unbalanced-write rejection + client isolation.
- **Budget slot** (rail): ribbon essence — stable "spent / total" headline, headroom flag, per-code bars, pending-CO approve, post-expense, undo (reversal). Gated by module_visibility.budgets at THREE layers (rail wrapper, /financials `{gated:true}`, RLS on docs).
- **Journey slot** (rail): time-machine CONCEPT rebuilt category-agnostic (bkg TimeMachine was THREE.js + hardcoded construction phases + prohibited red — not portable as-is). Scrubber shows as-of state; moments = events, spans = project_contacts windows, labels from data.
- **Role-lens pass caught a real leak:** events carried money into the journey for budgets:false grants — journey endpoint now hides `ledger.*` moments behind the module gate. Lens pair committed: `docs/dogfood/code-e-lens-{admin,readonly}.png`.
- **Documents:** real upload through a storage seam (`lib/server/storage.ts`: local disk now; Supabase Storage code-complete for when the dev project exists — never vlezoyalutexenbnzzui). Download re-selects the row under caller RLS (hidden row = 404). Uploads default-link to the project. Readonly download of a gated doc proven 404.
- **Capture endpoint verdict:** bkg `feat/capture-endpoint` adds voice/photo→field-report→ledger behind a structurer seam. NOT folded: modalities are key-gated (Whisper/vision) and need media storage; our CODE-C text seam already implements the same pattern. Revisit when keys + storage land.
- Deep link added: `/workspace?project=<id>` opens that project's rail.
- Verified: change-a-variable live in the rail (approve CO → $153K→$163K headline, bars, flag all moved), 14/14 SQL assertions, build green, zero console errors. Dev DB reset pristine.

## 2026-07-01 (late) — CODE-C intake v1 (Claude Code, autonomous)
- Branch `rebuild/intake-v1` (CODE-B merged as PR #1). Four intake paths, ONE review pattern: every path produces a Bundle → `planBundle` diffs it against the RLS-scoped DB into a color-coded Proposal → the same preview grid → `commitProposal` applies atomically. Nothing auto-commits.
- **Template import** (`/workspace/import`): .xlsx/.csv (SheetJS), header aliases, full tree build with dedupe (groups by name; addresses by place_id/street+city+postal; contacts by email>phone>name). Files never rejected — bad cells are inline-fixable issues that re-plan on edit.
- **VCF**: iPhone cards parse; unknown fields land in `contacts.attrs.vcf` (new `attrs` column, Rubicon-reviewed: it's the generic extension point, not a category column).
- **Places single add**: server-side proxy keeps the key private; keyless fallback = manual fields + amber "normalization pending" chip (`normalized` stays NULL).
- **NL quick capture**: header one-liner → `/api/capture` → Claude (tool-forced JSON → ImportRow[], same builder as template) or a labeled heuristic when no ANTHROPIC_API_KEY. Never auto-commits.
- **Rubicon queue**: unknown contact_type → `contact_types` row with new `status='draft'` (authenticated may INSERT drafts only; published vocabulary stays operator-managed).
- **Reconciliation + leverage**: expected_counts editor on the import screen (chips live-update; over-import shows amber "N over"); every commit logs `import.committed` {source, records_created, records_updated, user_active_seconds} + duration_ms; UI shows "29 records in 11s of your time."
- Verified: fixture spreadsheet (incl. no-street dream project + already-ended lease → effective inactive) imports clean; **re-import = 29 unchanged / 0 writes (idempotent)**; VCF attrs round-trip; NL sentence → preview → commit in the browser; events ledger correct in psql; zero console errors; SQL suite green with the new migration.
- Fixtures: `tests/fixtures/harborline-import.{xlsx,csv}`, `kai-rivera.vcf` (regenerate: `node scripts/make-fixtures.mjs`). `docs/import-template.md` authored as the canonical column spec (Cowork had not delivered one).
- Assumption flagged: no ANTHROPIC key or GOOGLE_PLACES key on this machine — Claude leg and live Places leg are code-complete but unexercised until founder adds keys.

## 2026-07-01 (evening) — CODE-B grid workspace (Claude Code, autonomous)
- Branch `rebuild/grid-workspace`. `/workspace` with four ag-Grid Community (MIT) grids: Projects · Contacts · Groups · Users, themed Herbarium via the ag-Grid Theming API (quartz blue dead; parchment/vellum/teal).
- Data layer: Next route handlers over RLS-enforced Postgres (`lib/server/db.ts` — per-request `set local role authenticated` + `request.jwt.claims`, the exact mechanism the SQL tests prove). Same code will point at the dev Supabase project's connection string later. Auth: Auth0 SDK wired but dormant (no tenant); `DEV_BYPASS=true` maps the session to the fixture admin.
- Reconciliation chips on every grid (sage when exact, amber-gold with the delta); seed + test 03 extended so groups (2) and users (3) reconcile alongside projects (8) and contacts (12).
- Row quick actions (Detail rail, set inactive/active), inline edit (names, reach-by), filters (status default hides inactive; group; contact type), bulk bar (status + **bulk vendor reassign** — end-date N assignments and create replacements in one transaction).
- Every mutation writes events (actor_type user/operator, duration_ms on bulk ops).
- Verified in a real browser (Chrome): all four grids with fixture data, rail with address/contacts/documents/gated CODE-D slots, bulk reassign Bayline→Marin Electric across 3 projects end-to-end, events trail confirmed in psql, zero console errors, leave→return persists.
- Local dev: `scripts/db-dev.sh` (persistent seeded cluster) + `DEV_BYPASS=true npm run dev`. Dev DB reset to pristine fixture for founder dogfood.

## 2026-07-01 — Foundation session (Claude Code, autonomous)
- Scaffolded Next.js (App Router) + TS + Tailwind v4; added `@supabase/supabase-js`, `@supabase/ssr`, supabase CLI (npm dev dep); `supabase init`.
- 15 migrations in `supabase/migrations/` — one per concern: extensions, clients, users, roles + role_grants, groups + list_values, addresses, projects, contacts + contact_types, project_contacts (+ `project_contacts_effective` view), documents + document_links, events (append-only), expected_counts, attribute_defs, RLS helpers, RLS policies + privileges.
- RLS on every table. Helpers read `request.jwt.claims` directly (Auth0 `sub` → `users.auth0_sub`) — identical behavior on hosted Supabase and plain local PG, no `auth` schema dependency.
- Seed fixture: Harborline Property Management (Ryan-shaped, fake) — 3 users, 2 groups, 8 projects (incl. "Marsh Road concept" with street NULL), 12 contacts (incl. 1 agent w/ endpoint), lessee windows incl. one lapsed last month, vendor spanning 3 projects, expected_counts 8/12, events across user/operator/machine. Plus minimal second client (Crestline) purely for isolation tests.
- 4 SQL test files in `supabase/tests/`, run by `scripts/db-test.sh` (throwaway local PG via micromamba, no Docker): RLS isolation, time-bounds effective_status, reconciliation (8/8, 12/12), module gating.
- **Bug caught by tests:** `FOR ALL` write policies OR'd their USING into SELECT, letting an editor bypass the documents module gate. Fixed by splitting documents policies per verb + `document_visible()` helper. Logged in tasks.lessons.md.
- Docs: `docs/core-data-model.md` (ERD, category rule, Rubicon Rule, superseded 2026-05-28 palette/Clerk guidance), CLAUDE.md lane rules, .env.example.
- Local Postgres for the harness: micromamba env at `~/Developer/kg-core-tools/pgenv` (PG 16.13).
