-- RLS helper functions.
--
-- Design: everything reads the JWT via current_setting('request.jwt.claims') —
-- the same GUC hosted Supabase populates — so these functions behave identically
-- on hosted Supabase, `supabase start`, and a plain local Postgres where tests
-- set the GUC by hand. No dependency on the `auth` schema.
--
-- Identity chain: JWT `sub` claim (Auth0) -> users.auth0_sub -> users row.
-- All lookups are SECURITY DEFINER so they bypass RLS on the tables they
-- consult (avoiding policy recursion); search_path is pinned.

-- The raw claims object ({} when unauthenticated).
create or replace function public.jwt_claims()
returns jsonb
language sql stable
as $$
  select coalesce(nullif(current_setting('request.jwt.claims', true), '')::jsonb, '{}'::jsonb)
$$;

-- The caller's users.id, or null when the sub is unknown/inactive.
create or replace function public.current_user_id()
returns uuid
language sql stable security definer set search_path = public
as $$
  select u.id
  from users u
  where u.auth0_sub = (jwt_claims() ->> 'sub')
    and u.status = 'active'
$$;

-- The caller's home client. THE tenancy boundary.
create or replace function public.current_client_id()
returns uuid
language sql stable security definer set search_path = public
as $$
  select u.client_id
  from users u
  where u.auth0_sub = (jwt_claims() ->> 'sub')
    and u.status = 'active'
$$;

-- Operator = holds super_admin anywhere. Bypasses client scoping.
create or replace function public.is_operator()
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1
    from role_grants g
    join roles r on r.id = g.role_id
    where g.user_id = current_user_id()
      and r.code = 'super_admin'
  )
$$;

-- Fixed rank order for role comparison. Unknown codes rank 0 (no access).
create or replace function public.role_rank(p_code text)
returns integer
language sql immutable
as $$
  select case p_code
    when 'read_only'   then 1
    when 'editor'      then 2
    when 'admin'       then 3
    when 'super_admin' then 4
    else 0
  end
$$;

-- The caller's grants that cover a given (client, group, project) target.
-- Coverage rules:
--   * a client-scoped grant covers everything in that client;
--   * a group-scoped grant covers that group (and rows queried with that group id);
--   * a project-scoped grant covers that project;
--   * for CLIENT-LEVEL tables (no group/project on the row — contacts, addresses,
--     documents, ...), any grant inside the client covers the row. This is the
--     lenient v0 reading, documented in docs/core-data-model.md; tighten later
--     by passing the row's group/project when tables gain that scoping.
create or replace function public.covering_grants(
  p_client  uuid,
  p_group   uuid default null,
  p_project uuid default null
)
returns setof public.role_grants
language sql stable security definer set search_path = public
as $$
  select g.*
  from role_grants g
  where g.user_id = current_user_id()
    and (
      (g.scope_type = 'client' and g.scope_id = p_client)
      or (g.scope_type = 'group' and (
            (p_group is not null and g.scope_id = p_group)
            or (p_group is null and p_project is null and exists (
                  select 1 from groups gr
                  where gr.id = g.scope_id and gr.client_id = p_client))
      ))
      or (g.scope_type = 'project' and (
            (p_project is not null and g.scope_id = p_project)
            or (p_group is null and p_project is null and exists (
                  select 1 from projects pr
                  where pr.id = g.scope_id and pr.client_id = p_client))
      ))
    )
$$;

-- Highest role rank among covering grants (0 = no covering grant).
create or replace function public.grant_rank(
  p_client  uuid,
  p_group   uuid default null,
  p_project uuid default null
)
returns integer
language sql stable security definer set search_path = public
as $$
  select coalesce(max(role_rank(r.code)), 0)
  from covering_grants(p_client, p_group, p_project) g
  join roles r on r.id = g.role_id
$$;

-- Read: any covering grant, or operator.
create or replace function public.can_read(
  p_client  uuid,
  p_group   uuid default null,
  p_project uuid default null
)
returns boolean
language sql stable security definer set search_path = public
as $$
  select (p_client = current_client_id() and grant_rank(p_client, p_group, p_project) >= 1)
      or is_operator()
$$;

-- Write: editor or above, or operator.
create or replace function public.can_write(
  p_client  uuid,
  p_group   uuid default null,
  p_project uuid default null
)
returns boolean
language sql stable security definer set search_path = public
as $$
  select (p_client = current_client_id() and grant_rank(p_client, p_group, p_project) >= role_rank('editor'))
      or is_operator()
$$;

-- Module gate: visible when SOME covering grant leaves the module on
-- (a missing key defaults to visible). Operators always pass.
create or replace function public.module_visible(p_client uuid, p_module text)
returns boolean
language sql stable security definer set search_path = public
as $$
  select p_module is null
      or is_operator()
      or exists (
           select 1
           from covering_grants(p_client) g
           where coalesce((g.module_visibility ->> p_module)::boolean, true)
         )
$$;

-- The full document visibility rule: client scope + min_role_visibility rank
-- + module gate. Used by documents' select AND update/delete policies so a
-- writer can never touch a row they cannot see.
create or replace function public.document_visible(
  p_client   uuid,
  p_min_role text,
  p_doc_type text
)
returns boolean
language sql stable security definer set search_path = public
as $$
  select can_read(p_client)
     and (p_min_role is null
          or is_operator()
          or grant_rank(p_client) >= role_rank(p_min_role))
     and module_visible(p_client, p_doc_type)
$$;

-- users.client_id lookup that bypasses RLS (for policies on tables that
-- reference a user but carry no client_id of their own, e.g. role_grants).
create or replace function public.client_of_user(p_user uuid)
returns uuid
language sql stable security definer set search_path = public
as $$
  select client_id from users where id = p_user
$$;
