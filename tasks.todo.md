# tasks.todo.md — kg-core

## NOW
- [ ] **CODE-B: grid workspace** — the first surface over the record engine. Grid over drill-down.

## NEXT
- [ ] Founder: create GitHub repo `chilly611/kg-core` + push (see README / session log for the one-liner).
- [ ] Founder: provide the new dev Supabase project ref (NEVER `vlezoyalutexenbnzzui`); then `supabase link` + `db push` from a branch.
- [ ] Auth0 wiring: forward the Auth0 access token as the Supabase JWT; verify `current_client_id()` resolves against the dev project.
- [ ] Google Places address normalization behind a seam (raw_input → normalized/place_id).

## LATER
- [ ] Per-table tightening of the v0 client-level RLS leniency as rows gain group/project scope columns.
- [ ] Generated TS types from the schema.
