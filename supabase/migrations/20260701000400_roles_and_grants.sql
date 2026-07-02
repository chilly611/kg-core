-- roles: fixed platform role vocabulary. Rank order (low -> high):
--   read_only < editor < admin < super_admin
-- super_admin is the operator role: it bypasses client scoping entirely (is_operator()).
create table public.roles (
  id   uuid primary key default gen_random_uuid(),
  code text not null unique
);

-- Seeded with fixed ids so seeds/tests can reference them deterministically.
insert into public.roles (id, code) values
  ('a0000000-0000-4000-8000-000000000001', 'super_admin'),
  ('a0000000-0000-4000-8000-000000000002', 'admin'),
  ('a0000000-0000-4000-8000-000000000003', 'editor'),
  ('a0000000-0000-4000-8000-000000000004', 'read_only');

-- role_grants: what a user may do, and where.
-- scope_type/scope_id point at a client, group, or project row.
-- module_visibility is a per-grant feature gate: {"<module>": false} hides that
-- module's rows (today: documents by doc_type) even when the role rank would allow them.
-- A missing key defaults to visible.
create table public.role_grants (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references public.users(id),
  role_id           uuid not null references public.roles(id),
  scope_type        text not null check (scope_type in ('client', 'group', 'project')),
  scope_id          uuid not null,
  module_visibility jsonb not null default '{"budgets": true, "contracts": true}'
);

create index role_grants_user_id_idx on public.role_grants (user_id);
create index role_grants_scope_idx   on public.role_grants (scope_type, scope_id);
