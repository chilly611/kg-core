-- TEST 02 — Time bounds: effective_status derives from the validity window.
-- The past lessee (valid_to = last day of last month, stored status still
-- 'active') must resolve inactive; the current lessee must resolve active.
begin;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub": "auth0|harborline-admin"}', true);

do $$
declare
  v_effective text;
  v_stored    text;
begin
  -- Past lessee (Sam Okafor, Unit 203).
  select effective_status, status into v_effective, v_stored
  from public.project_contacts_effective
  where id = '60000000-0000-4000-8000-000000000003';

  if v_effective is null then raise exception 'FAIL: past-lessee row not visible'; end if;
  if v_stored <> 'active' then
    raise exception 'FAIL: fixture drift — past lessee stored status should be active, is %', v_stored;
  end if;
  if v_effective <> 'inactive' then
    raise exception 'FAIL: past lessee effective_status should be inactive, is %', v_effective;
  end if;

  -- Current lessee (Jordan Mears, Unit 101).
  select effective_status into v_effective
  from public.project_contacts_effective
  where id = '60000000-0000-4000-8000-000000000001';

  if v_effective <> 'active' then
    raise exception 'FAIL: current lessee effective_status should be active, is %', v_effective;
  end if;

  -- Open-ended window (month-to-month, no valid_to) stays active.
  select effective_status into v_effective
  from public.project_contacts_effective
  where id = '60000000-0000-4000-8000-00000000000b';

  if v_effective <> 'active' then
    raise exception 'FAIL: open-ended lessee effective_status should be active, is %', v_effective;
  end if;

  raise notice 'PASS: past lessee -> inactive (stored active), current lessee -> active, open-ended -> active';
end $$;

rollback;
