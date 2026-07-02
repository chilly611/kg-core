-- events: append-only activity log. Humans (user), platform staff (operator),
-- and machines (agents, jobs) all write here; nothing ever updates or deletes.
-- Enforced two ways: no UPDATE/DELETE privileges are granted (see rls_policies),
-- and no update/delete RLS policies exist.
create table public.events (
  id          bigint generated always as identity primary key,
  client_id   uuid not null references public.clients(id),
  actor_type  text not null check (actor_type in ('user', 'operator', 'machine')),
  actor_id    uuid,                     -- users.id for 'user'; null/opaque for operator & machine
  verb        text not null,            -- e.g. 'project.created', 'document.uploaded'
  target_type text not null,
  target_id   uuid,
  payload     jsonb not null default '{}',
  duration_ms integer,
  created_at  timestamptz not null default now()
);

create index events_client_id_created_idx on public.events (client_id, created_at desc);
create index events_target_idx on public.events (target_type, target_id);
