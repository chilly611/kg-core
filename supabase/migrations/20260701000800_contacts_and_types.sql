-- contacts: people, organizations, and machine agents a client works with.
-- phones/emails are jsonb arrays of {label, value} objects.
-- kind='agent' rows carry an agent_endpoint (a callable URL) — contacts are the
-- one directory for humans AND agents; the record engine does not care which.
create table public.contacts (
  id                       uuid primary key default gen_random_uuid(),
  client_id                uuid not null references public.clients(id),
  kind                     text not null check (kind in ('person', 'org', 'agent')),
  display_name             text not null,
  phones                   jsonb not null default '[]',
  emails                   jsonb not null default '[]',
  preferred_contact_method text,
  agent_endpoint           text,        -- only meaningful for kind='agent'
  status                   text not null default 'active'
);

create index contacts_client_id_idx on public.contacts (client_id);

-- contact_types: the role a contact plays ON a project (not what the contact IS).
-- category null = global type; category set = only offered for that category.
create table public.contact_types (
  id       uuid primary key default gen_random_uuid(),
  category text,
  code     text not null,
  label    text not null,
  unique nulls not distinct (category, code)
);

-- Fixed ids so seeds/tests can reference them deterministically.
insert into public.contact_types (id, category, code, label) values
  ('b0000000-0000-4000-8000-000000000001', null, 'owner',             'Owner'),
  ('b0000000-0000-4000-8000-000000000002', null, 'occupant',          'Occupant'),
  ('b0000000-0000-4000-8000-000000000003', null, 'vendor',            'Vendor'),
  ('b0000000-0000-4000-8000-000000000004', null, 'service_provider',  'Service provider'),
  ('b0000000-0000-4000-8000-000000000005', null, 'worker',            'Worker'),
  ('b0000000-0000-4000-8000-000000000006', null, 'agent',             'Agent'),
  ('b0000000-0000-4000-8000-000000000007', null, 'emergency_contact', 'Emergency contact'),
  ('b0000000-0000-4000-8000-000000000008', 'property', 'lessee',         'Lessee'),
  ('b0000000-0000-4000-8000-000000000009', 'property', 'month_to_month', 'Month-to-month');
