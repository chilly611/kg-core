# tasks.lessons.md — kg-core
*Patterns and mistakes we do not repeat. Append after any correction.*

- **Model before surfaces.** The record engine (schema, RLS, reconciliation) lands and proves out before any UI exists. Surfaces are replaceable; the model is not.
- **Rubicon Rule.** Any category-specific attribute proposal stops for a design conversation before build. The old BKG app is what happens otherwise.
- **Grid over drill-down.** The workspace is a dense grid the operator scans and edits in place — not a click-into-detail-page maze.
- **Drop-and-recreate freedom ends at production data.** Local/dev databases are cattle; the moment real client data exists, every schema change is a migration with a rollback story.
- **Supabase-js isn't the only door.** Without Docker/PostgREST, server route handlers over a raw Postgres connection enforce the same RLS (per-request `set local role authenticated` + `request.jwt.claims` GUC) and work unchanged against hosted Supabase's connection string later. Don't block a surface on infrastructure the model layer doesn't need. (CODE-B, 2026-07-01.)
- **`FOR ALL` RLS policies leak SELECT.** Permissive policies OR together, so a `FOR ALL` write policy grants SELECT via its USING clause and bypasses gated select policies. Split write policies per verb on any table whose select policy is stricter than "can write". (Caught by test 04 on documents, 2026-07-01.)
