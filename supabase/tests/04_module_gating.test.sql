-- TEST 04 — Module gating + min_role_visibility on documents.
-- Fixture: one doc_type='budgets' document with min_role_visibility='editor',
-- one ungated lease document.
--   read_only + {"budgets": false} -> budgets doc hidden (both gates), lease visible
--   editor    + {"budgets": false} -> budgets doc hidden by the MODULE gate alone
--                                     (their rank passes min_role_visibility)
--   admin     + budgets visible    -> sees both

-- ---- read_only with budgets:false (the brief's fixture)
begin;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub": "auth0|harborline-readonly"}', true);

do $$
declare n bigint;
begin
  select count(*) into n from public.documents where doc_type = 'budgets';
  if n <> 0 then raise exception 'FAIL: read_only(budgets:false) sees % budgets docs', n; end if;

  select count(*) into n from public.documents where doc_type = 'lease';
  if n <> 1 then raise exception 'FAIL: read_only should see 1 lease doc, sees %', n; end if;

  raise notice 'PASS: read_only(budgets:false) -> budgets hidden, lease visible';
end $$;
rollback;

-- ---- editor with budgets:false (isolates the module gate from the rank gate)
begin;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub": "auth0|harborline-editor"}', true);

do $$
declare n bigint;
begin
  select count(*) into n from public.documents where doc_type = 'budgets';
  if n <> 0 then
    raise exception 'FAIL: editor(budgets:false) sees % budgets docs — module gate leaked', n;
  end if;

  select count(*) into n from public.documents where doc_type = 'lease';
  if n <> 1 then raise exception 'FAIL: editor should see 1 lease doc, sees %', n; end if;

  raise notice 'PASS: editor(budgets:false) -> module gate blocks despite sufficient rank';
end $$;
rollback;

-- ---- admin with budgets visible
begin;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub": "auth0|harborline-admin"}', true);

do $$
declare n bigint;
begin
  select count(*) into n from public.documents where doc_type = 'budgets';
  if n <> 1 then raise exception 'FAIL: admin should see 1 budgets doc, sees %', n; end if;

  raise notice 'PASS: admin -> budgets doc visible (rank >= editor, module on)';
end $$;
rollback;
