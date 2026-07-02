# kg-core

The category-agnostic record engine for The Knowledge Gardens. Next.js (App Router) + TypeScript + Tailwind v4 + Supabase (Postgres/RLS) + Auth0.

Read `docs/core-data-model.md` for the model, the category rule, and the Rubicon Rule. Session/lane rules live in `CLAUDE.md`.

## Quickstart

```bash
npm install
cp .env.example .env.local   # fill in when a dev Supabase project exists

# Verify the database layer (no Docker needed — spins a throwaway local Postgres):
scripts/db-test.sh

# Run the app:
npm run dev                  # http://localhost:3000
```

`scripts/db-test.sh` needs Postgres 15+ binaries on PATH, or `PG_BIN=/path/to/pg/bin`. A no-sudo install that works on this Mac (Homebrew is broken):

```bash
curl -Ls https://micro.mamba.pm/api/micromamba/osx-arm64/latest | tar -xj bin/micromamba
./bin/micromamba create -y -p ~/Developer/kg-core-tools/pgenv -c conda-forge postgresql=16
```

With Docker you can use the Supabase stack instead: `npx supabase start && npx supabase db reset` (applies `supabase/migrations/` + `supabase/seed.sql`), then run each file in `supabase/tests/` with `psql -v ON_ERROR_STOP=1 -f`.

## Layout

- `supabase/migrations/` — one file per concern, heavily commented. RLS on every table.
- `supabase/seed.sql` — Harborline fixture (fake, Ryan-shaped) + a second client for isolation tests.
- `supabase/tests/` — SQL assertions: RLS isolation, time-bounded contacts, count reconciliation, module gating.
- `lib/supabase/` — browser + server clients (@supabase/ssr).
- `docs/` — data model, session log.

## Hard rule

No config in this repo may ever point at Supabase project `vlezoyalutexenbnzzui` (shared production of the frozen BKG app). kg-core gets its own project.
