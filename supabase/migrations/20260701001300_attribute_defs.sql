-- attribute_defs: the schema-for-attrs registry. Category-specific fields live in
-- {groups,projects}.attrs jsonb, DESCRIBED here — never as new columns on core tables.
-- Any proposal to add a category-specific attribute stops for a design conversation
-- first (the Rubicon Rule); this table is where the outcome lands.
create table public.attribute_defs (
  id         uuid primary key default gen_random_uuid(),
  category   text not null,             -- e.g. 'property', 'construction'
  entity     text not null,             -- which table's attrs this key lives in: 'groups', 'projects', ...
  key        text not null,
  label      text not null,
  value_type text not null,             -- 'text' | 'number' | 'boolean' | 'date' | 'json'
  unique (category, entity, key)
);
