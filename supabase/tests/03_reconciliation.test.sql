-- TEST 03 — Reconciliation: expected_counts vs actual counts must match
-- exactly (8/8 projects, 12/12 contacts) for Harborline.
begin;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub": "auth0|harborline-admin"}', true);

do $$
declare
  r record;
  v_actual bigint;
  ok boolean := true;
begin
  for r in
    select entity, expected, client_id
    from public.expected_counts
    where client_id = 'c0000000-0000-4000-8000-000000000001'
    order by entity
  loop
    case r.entity
      when 'projects' then
        select count(*) into v_actual from public.projects where client_id = r.client_id;
      when 'contacts' then
        select count(*) into v_actual from public.contacts where client_id = r.client_id;
      else
        raise exception 'FAIL: no reconciliation query for entity %', r.entity;
    end case;

    raise notice '%: %/%', r.entity, v_actual, r.expected;
    if v_actual <> r.expected then ok := false; end if;
  end loop;

  if not ok then raise exception 'FAIL: reconciliation mismatch (see notices above)'; end if;
  raise notice 'PASS: all expected_counts reconcile';
end $$;

rollback;
