-- TEST 01 — RLS isolation: a Crestline user sees ZERO Harborline rows,
-- and still sees their own.
begin;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub": "auth0|crestline-admin"}', true);

do $$
declare
  harborline constant uuid := 'c0000000-0000-4000-8000-000000000001';
  n bigint;
begin
  select count(*) into n from public.projects where client_id = harborline;
  if n <> 0 then raise exception 'FAIL: crestline user sees % harborline projects', n; end if;

  select count(*) into n from public.contacts where client_id = harborline;
  if n <> 0 then raise exception 'FAIL: crestline user sees % harborline contacts', n; end if;

  select count(*) into n from public.groups where client_id = harborline;
  if n <> 0 then raise exception 'FAIL: crestline user sees % harborline groups', n; end if;

  select count(*) into n from public.addresses where client_id = harborline;
  if n <> 0 then raise exception 'FAIL: crestline user sees % harborline addresses', n; end if;

  select count(*) into n from public.documents where client_id = harborline;
  if n <> 0 then raise exception 'FAIL: crestline user sees % harborline documents', n; end if;

  select count(*) into n from public.project_contacts where client_id = harborline;
  if n <> 0 then raise exception 'FAIL: crestline user sees % harborline project_contacts', n; end if;

  select count(*) into n from public.events where client_id = harborline;
  if n <> 0 then raise exception 'FAIL: crestline user sees % harborline events', n; end if;

  select count(*) into n from public.expected_counts where client_id = harborline;
  if n <> 0 then raise exception 'FAIL: crestline user sees % harborline expected_counts', n; end if;

  -- Sanity: not blind — they DO see their own single project.
  select count(*) into n from public.projects;
  if n <> 1 then raise exception 'FAIL: crestline user should see exactly 1 project (own), sees %', n; end if;

  raise notice 'PASS: crestline user sees 0 harborline rows across 8 tables, and 1 own project';
end $$;

rollback;
