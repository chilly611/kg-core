# kg-core session log
*Append-only. Newest entry on top. Keep a NOW block current.*

## NOW
- Foundation landed: schema (12 concerns), RLS, seed fixture, SQL test suite — all green locally.
- Next lane: **CODE-B grid workspace** (see tasks.todo.md).
- Remote Supabase: **not linked to anything yet** (LOCAL ONLY session). Founder provides the new dev project ref before any `supabase link` / `db push`.

---

## 2026-07-01 — Foundation session (Claude Code, autonomous)
- Scaffolded Next.js (App Router) + TS + Tailwind v4; added `@supabase/supabase-js`, `@supabase/ssr`, supabase CLI (npm dev dep); `supabase init`.
- 15 migrations in `supabase/migrations/` — one per concern: extensions, clients, users, roles + role_grants, groups + list_values, addresses, projects, contacts + contact_types, project_contacts (+ `project_contacts_effective` view), documents + document_links, events (append-only), expected_counts, attribute_defs, RLS helpers, RLS policies + privileges.
- RLS on every table. Helpers read `request.jwt.claims` directly (Auth0 `sub` → `users.auth0_sub`) — identical behavior on hosted Supabase and plain local PG, no `auth` schema dependency.
- Seed fixture: Harborline Property Management (Ryan-shaped, fake) — 3 users, 2 groups, 8 projects (incl. "Marsh Road concept" with street NULL), 12 contacts (incl. 1 agent w/ endpoint), lessee windows incl. one lapsed last month, vendor spanning 3 projects, expected_counts 8/12, events across user/operator/machine. Plus minimal second client (Crestline) purely for isolation tests.
- 4 SQL test files in `supabase/tests/`, run by `scripts/db-test.sh` (throwaway local PG via micromamba, no Docker): RLS isolation, time-bounds effective_status, reconciliation (8/8, 12/12), module gating.
- **Bug caught by tests:** `FOR ALL` write policies OR'd their USING into SELECT, letting an editor bypass the documents module gate. Fixed by splitting documents policies per verb + `document_visible()` helper. Logged in tasks.lessons.md.
- Docs: `docs/core-data-model.md` (ERD, category rule, Rubicon Rule, superseded 2026-05-28 palette/Clerk guidance), CLAUDE.md lane rules, .env.example.
- Local Postgres for the harness: micromamba env at `~/Developer/kg-core-tools/pgenv` (PG 16.13).
