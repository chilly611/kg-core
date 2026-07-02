-- Row-level security: enabled on EVERY table. Pattern:
--   read  = (client_id = current_client_id() AND a grant covers the row's scope) OR is_operator()
--   write = same, but the covering grant must be editor or above
-- Reference tables (roles, list_values, contact_types, attribute_defs) are readable
-- by all authenticated users and writable only by operators.
-- events is append-only: insert for all authenticated (own client), no update/delete
-- policies AND no update/delete privileges.

-- ---------------------------------------------------------------- clients
alter table public.clients enable row level security;

create policy clients_select on public.clients for select
  using (can_read(id));
create policy clients_write on public.clients for all
  using (can_write(id)) with check (can_write(id));

-- ---------------------------------------------------------------- users
alter table public.users enable row level security;

-- You can always see yourself (bootstrap: a fresh login must be able to load
-- its own row before any grant exists); otherwise standard client read.
create policy users_select on public.users for select
  using (id = current_user_id() or can_read(client_id));
create policy users_write on public.users for all
  using (can_write(client_id)) with check (can_write(client_id));

-- ---------------------------------------------------------------- roles
alter table public.roles enable row level security;

create policy roles_select on public.roles for select
  using (current_user_id() is not null);
create policy roles_write on public.roles for all
  using (is_operator()) with check (is_operator());

-- ---------------------------------------------------------------- role_grants
alter table public.role_grants enable row level security;

-- See your own grants; admins see grants across their client; operators see all.
create policy role_grants_select on public.role_grants for select
  using (
    user_id = current_user_id()
    or is_operator()
    or grant_rank(client_of_user(user_id)) >= role_rank('admin')
  );
-- Only admins (of the grantee's client) and operators manage grants.
create policy role_grants_write on public.role_grants for all
  using (is_operator() or grant_rank(client_of_user(user_id)) >= role_rank('admin'))
  with check (is_operator() or grant_rank(client_of_user(user_id)) >= role_rank('admin'));

-- ---------------------------------------------------------------- groups
alter table public.groups enable row level security;

create policy groups_select on public.groups for select
  using (can_read(client_id, id));
create policy groups_write on public.groups for all
  using (can_write(client_id, id)) with check (can_write(client_id, id));

-- ---------------------------------------------------------------- list_values
alter table public.list_values enable row level security;

create policy list_values_select on public.list_values for select
  using (current_user_id() is not null);
create policy list_values_write on public.list_values for all
  using (is_operator()) with check (is_operator());

-- ---------------------------------------------------------------- addresses
alter table public.addresses enable row level security;

create policy addresses_select on public.addresses for select
  using (can_read(client_id));
create policy addresses_write on public.addresses for all
  using (can_write(client_id)) with check (can_write(client_id));

-- ---------------------------------------------------------------- projects
alter table public.projects enable row level security;

create policy projects_select on public.projects for select
  using (can_read(client_id, group_id, id));
create policy projects_write on public.projects for all
  using (can_write(client_id, group_id, id)) with check (can_write(client_id, group_id, id));

-- ---------------------------------------------------------------- contacts
alter table public.contacts enable row level security;

create policy contacts_select on public.contacts for select
  using (can_read(client_id));
create policy contacts_write on public.contacts for all
  using (can_write(client_id)) with check (can_write(client_id));

-- ---------------------------------------------------------------- contact_types
alter table public.contact_types enable row level security;

create policy contact_types_select on public.contact_types for select
  using (current_user_id() is not null);
create policy contact_types_write on public.contact_types for all
  using (is_operator()) with check (is_operator());

-- ---------------------------------------------------------------- project_contacts
alter table public.project_contacts enable row level security;

create policy project_contacts_select on public.project_contacts for select
  using (can_read(client_id, null, project_id));
create policy project_contacts_write on public.project_contacts for all
  using (can_write(client_id, null, project_id))
  with check (can_write(client_id, null, project_id));

-- ---------------------------------------------------------------- documents
alter table public.documents enable row level security;

-- Three gates, all must pass: client scope, min_role_visibility rank,
-- and the grant's module_visibility for this doc_type (document_visible()).
-- Write policies are split per verb ON PURPOSE: a permissive `for all` policy
-- would OR its USING into SELECT and let writers bypass the visibility gates.
-- Update/delete additionally require document_visible: you cannot mutate a
-- row you cannot see.
create policy documents_select on public.documents for select
  using (document_visible(client_id, min_role_visibility, doc_type));
create policy documents_insert on public.documents for insert
  with check (can_write(client_id));
create policy documents_update on public.documents for update
  using (can_write(client_id) and document_visible(client_id, min_role_visibility, doc_type))
  with check (can_write(client_id));
create policy documents_delete on public.documents for delete
  using (can_write(client_id) and document_visible(client_id, min_role_visibility, doc_type));

-- ---------------------------------------------------------------- document_links
alter table public.document_links enable row level security;

-- Visibility follows the document: the subquery runs under the caller's RLS,
-- so a link is visible/writable iff the document itself is.
create policy document_links_select on public.document_links for select
  using (exists (select 1 from public.documents d where d.id = document_id));
create policy document_links_write on public.document_links for all
  using (exists (select 1 from public.documents d
                 where d.id = document_id and can_write(d.client_id)))
  with check (exists (select 1 from public.documents d
                      where d.id = document_id and can_write(d.client_id)));

-- ---------------------------------------------------------------- events (append-only)
alter table public.events enable row level security;

create policy events_select on public.events for select
  using (can_read(client_id));
-- Any authenticated user may log events for their own client; operators anywhere.
create policy events_insert on public.events for insert
  with check (client_id = current_client_id() or is_operator());
-- Deliberately NO update/delete policies.

-- ---------------------------------------------------------------- expected_counts
alter table public.expected_counts enable row level security;

create policy expected_counts_select on public.expected_counts for select
  using (can_read(client_id));
create policy expected_counts_write on public.expected_counts for all
  using (can_write(client_id)) with check (can_write(client_id));

-- ---------------------------------------------------------------- attribute_defs
alter table public.attribute_defs enable row level security;

create policy attribute_defs_select on public.attribute_defs for select
  using (current_user_id() is not null);
create policy attribute_defs_write on public.attribute_defs for all
  using (is_operator()) with check (is_operator());

-- ---------------------------------------------------------------- privileges
-- RLS decides WHICH rows; grants decide WHICH verbs. anon gets nothing.
grant usage on schema public to authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant usage, select on all sequences in schema public to authenticated;
grant execute on all functions in schema public to authenticated;

-- events is append-only at the privilege level too (belt and suspenders).
revoke update, delete on public.events from authenticated;
