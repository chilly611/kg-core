-- projects: the unit of work. group_id and address_id are both nullable —
-- a project can exist before it has a home (dream projects) or a container.
-- attrs is the category-agnostic extension point (see attribute_defs / Rubicon Rule).
create table public.projects (
  id                uuid primary key default gen_random_uuid(),
  client_id         uuid not null references public.clients(id),
  group_id          uuid references public.groups(id),
  address_id        uuid references public.addresses(id),
  name              text not null,
  status            text not null default 'active',
  is_active_billing boolean not null default false,
  created_by        uuid references public.users(id),
  attrs             jsonb not null default '{}',
  created_at        timestamptz not null default now()
);

create index projects_client_id_idx on public.projects (client_id);
create index projects_group_id_idx  on public.projects (group_id);
