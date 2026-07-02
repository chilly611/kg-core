-- clients: the top-level tenant. Every row in kg-core hangs off a client.
-- `kind` is free-text for now (e.g. 'property_management', 'general_contractor');
-- category-specific behavior must NOT branch on it without a design conversation (Rubicon Rule).
create table public.clients (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  kind       text,
  status     text not null default 'active',
  created_at timestamptz not null default now()
);
