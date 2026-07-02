-- users: application identities, mapped to Auth0 via auth0_sub.
-- auth0_sub is the Auth0 `sub` claim; it is the single JWT -> user mapping key
-- consumed by public.current_user_id() / public.current_client_id() (see rls_helpers).
create table public.users (
  id           uuid primary key default gen_random_uuid(),
  client_id    uuid not null references public.clients(id),
  auth0_sub    text unique,
  email        citext,
  display_name text,
  status       text not null default 'active'
);

create index users_client_id_idx on public.users (client_id);
