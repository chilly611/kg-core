-- documents: file metadata (bytes live in storage at storage_path).
-- doc_type doubles as the module key for role_grants.module_visibility gating
-- (e.g. a grant with {"budgets": false} cannot see doc_type='budgets' rows).
-- min_role_visibility: when set, only roles at or above that rank may select the row.
create table public.documents (
  id                  uuid primary key default gen_random_uuid(),
  client_id           uuid not null references public.clients(id),
  storage_path        text not null,
  doc_type            text,
  title               text,
  mime                text,
  size                integer,
  uploaded_by         uuid references public.users(id),
  source              text,
  min_role_visibility text,             -- null | 'read_only' | 'editor' | 'admin' | 'super_admin'
  created_at          timestamptz not null default now()
);

create index documents_client_id_idx on public.documents (client_id);

-- document_links: one document can attach to many targets (project, group, client).
-- Visibility follows the document: you can see a link iff you can see the document.
create table public.document_links (
  document_id uuid not null references public.documents(id),
  target_type text not null check (target_type in ('project', 'group', 'client')),
  target_id   uuid not null,
  primary key (document_id, target_type, target_id)
);
