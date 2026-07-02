# kg-core session log
*Append-only. Newest entry on top. Keep a NOW block current.*

## NOW
- **CODE-C intake built** on `rebuild/intake-v1` — PR open, founder dogfoods before merge (90-second script in the PR).
- Next lane after merge: **CODE-D module slots** (Journey/Budget rails stubbed and gated since CODE-B).
- Remote Supabase: **still not linked** (LOCAL ONLY). Founder provides the new dev project ref before any `supabase link` / `db push`.

---

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
