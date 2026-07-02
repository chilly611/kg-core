-- groups: an intermediate container between client and projects
-- (a building, a portfolio, a campus). attrs is the category-agnostic
-- extension point — shaped by attribute_defs, never by new columns (Rubicon Rule).
create table public.groups (
  id         uuid primary key default gen_random_uuid(),
  client_id  uuid not null references public.clients(id),
  name       text not null,
  group_kind text,                        -- validated against list_values(list_code='group_kind'); soft FK by design
  attrs      jsonb not null default '{}'
);

create index groups_client_id_idx on public.groups (client_id);

-- list_values: platform-managed controlled vocabularies.
-- category null = global value; category set = value only offered for that category.
create table public.list_values (
  id         uuid primary key default gen_random_uuid(),
  category   text,
  list_code  text not null,
  value_code text not null,
  label      text not null,
  unique nulls not distinct (category, list_code, value_code)
);

insert into public.list_values (category, list_code, value_code, label) values
  (null, 'group_kind', 'single_residence', 'Single residence'),
  (null, 'group_kind', 'multi_family',     'Multi-family'),
  (null, 'group_kind', 'commercial',       'Commercial');
