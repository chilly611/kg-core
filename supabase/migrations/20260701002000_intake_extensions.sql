-- Intake (CODE-C) extensions. Two deliberately generic widenings — reviewed
-- against the Rubicon Rule: neither is category-specific.
--
-- 1. contacts.attrs: the same category-agnostic extension point groups and
--    projects already carry. VCF import lands unknown card fields here
--    (org, title, birthday, ...), described by attribute_defs(entity='contacts').
alter table public.contacts
  add column attrs jsonb not null default '{}';

-- 2. contact_types.status: unknown contact types arriving through intake are
--    NEVER silently added to the vocabulary. They land as status='draft' —
--    the Rubicon queue — visible in previews as "draft type, review pending".
--    Operators promote drafts to 'published' (or delete them) after the
--    design conversation.
alter table public.contact_types
  add column status text not null default 'published';

-- Authenticated users may propose DRAFT types only; published vocabulary
-- stays operator-managed (the existing FOR ALL operator policy still governs
-- update/delete — and per tasks.lessons.md its USING would OR into SELECT,
-- which is fine here: contact_types are readable by all authenticated anyway).
create policy contact_types_insert_draft on public.contact_types
  for insert to authenticated
  with check (public.current_user_id() is not null and status = 'draft');
