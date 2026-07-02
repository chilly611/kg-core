-- project_contacts: the join between projects and contacts, typed by contact_types
-- and optionally time-bounded (leases, engagements).
-- The stored `status` is the operator's intent; `effective_status` (view below)
-- derives inactive when the validity window has lapsed — never mutate status by cron.
create table public.project_contacts (
  id              uuid primary key default gen_random_uuid(),
  client_id       uuid not null references public.clients(id),
  project_id      uuid not null references public.projects(id),
  contact_id      uuid not null references public.contacts(id),
  contact_type_id uuid not null references public.contact_types(id),
  valid_from      date,
  valid_to        date,
  status          text not null default 'active',
  source          text,                 -- where this link came from: 'manual', 'import', 'agent'
  created_by      uuid references public.users(id),
  created_at      timestamptz not null default now()
);

create index project_contacts_project_id_idx on public.project_contacts (project_id);
create index project_contacts_contact_id_idx on public.project_contacts (contact_id);
create index project_contacts_client_id_idx  on public.project_contacts (client_id);

-- effective_status: inactive once valid_to has passed, else the stored status.
-- security_invoker so RLS on project_contacts applies to readers of the view.
create view public.project_contacts_effective
  with (security_invoker = true) as
select
  pc.*,
  case
    when pc.valid_to is not null and pc.valid_to < current_date then 'inactive'
    else pc.status
  end as effective_status
from public.project_contacts pc;
