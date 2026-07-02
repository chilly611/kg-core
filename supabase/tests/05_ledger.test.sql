-- TEST 05 — Ledger: double-entry invariants + change-a-variable reconciliation.
-- Roof project seed: budget 135,000 capital+maintenance orig + 18,000 approved CO
-- = 153,000 revised; actual 42,500.

-- ---- invariants + the moves, as the Harborline admin
begin;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub": "auth0|harborline-admin"}', true);

do $$
declare
  roof constant uuid := '40000000-0000-4000-8000-000000000004';
  v_before record; v_after record; v_out jsonb; d numeric; c numeric; n int;
begin
  -- 1. Global invariant: every entry balances (Σdebit = Σcredit).
  select count(*) into n from (
    select l.entry_id from public.ledger_lines l
    group by l.entry_id having sum(l.debit) <> sum(l.credit)
  ) q;
  if n <> 0 then raise exception 'FAIL: % unbalanced entries in seed', n; end if;

  select coalesce(sum(debit),0), coalesce(sum(credit),0) into d, c from public.ledger_lines;
  if d <> c then raise exception 'FAIL: ledger-wide debits % <> credits %', d, c; end if;
  raise notice 'PASS: debits = credits (%) across the ledger', d;

  -- 2. Seed reconciles: budget = 153000, actual = 42500, remaining = 110500.
  select * into v_before from public.v_ledger_project_financials where project_id = roof;
  if v_before.budget <> 153000.00 or v_before.actual <> 42500.00 or v_before.remaining <> 110500.00 then
    raise exception 'FAIL: seed financials wrong (budget=% actual=% remaining=%)',
      v_before.budget, v_before.actual, v_before.remaining;
  end if;
  perform public.ledger_assert_reconcile(roof);
  raise notice 'PASS: seed reconciles (153000 = 42500 actual + 110500 remaining)';

  -- 3. Change a variable: post an expense -> actual moves, identity holds.
  v_out := public.ledger_post_expense(roof, 'maintenance', 1200.00, 'test: fastener restock');
  select * into v_after from public.v_ledger_project_financials where project_id = roof;
  if v_after.actual <> v_before.actual + 1200.00 then
    raise exception 'FAIL: post_expense actual % (expected %)', v_after.actual, v_before.actual + 1200.00;
  end if;
  if v_after.budget <> v_after.remaining + v_after.actual then
    raise exception 'FAIL: identity broke after expense'; end if;
  raise notice 'PASS: post_expense cascades through the view and reconciles';

  -- 4. Approve the pending CO -> revised budget moves by +9500.
  v_out := public.ledger_approve_change_order('83000000-0000-4000-8000-000000000002');
  select * into v_after from public.v_ledger_project_financials where project_id = roof;
  if v_after.budget <> v_before.budget + 9500.00 then
    raise exception 'FAIL: CO approve budget % (expected %)', v_after.budget, v_before.budget + 9500.00;
  end if;
  raise notice 'PASS: approved change order moves revised budget (162500)';

  -- 5. Reverse the expense -> actual returns to the seed value.
  perform public.ledger_reverse_entry(
    (select id from public.ledger_entries
     where project_id = roof and memo = 'test: fastener restock'));
  select * into v_after from public.v_ledger_project_financials where project_id = roof;
  if v_after.actual <> v_before.actual then
    raise exception 'FAIL: reversal actual % (expected %)', v_after.actual, v_before.actual;
  end if;
  raise notice 'PASS: reverse_entry balances back to % (a new entry, not a delete)', v_before.actual;

  -- 6. Direct unbalanced write is rejected at commit (constraint trigger).
  begin
    insert into public.ledger_entries (id, client_id, project_id, source_type, memo)
      values ('84000000-0000-4000-8000-00000000dead', 'c0000000-0000-4000-8000-000000000001',
              roof, 'adjustment', 'unbalanced probe');
    insert into public.ledger_lines (entry_id, account_id, debit, credit)
      values ('84000000-0000-4000-8000-00000000dead', '80000000-0000-4000-8000-000000000004', 500.00, 0);
    set constraints all immediate;  -- force the deferred balance check NOW
    raise exception 'FAIL: unbalanced entry was accepted';
  exception
    when raise_exception then
      if sqlerrm like 'FAIL:%' then raise;
      else raise notice 'PASS: unbalanced entry rejected (%)', sqlerrm; end if;
  end;

  -- 7. Events carry the ledger verbs.
  select count(*) into n from public.events
    where verb in ('ledger.expense_posted','ledger.change_order_approved','ledger.entry_reversed')
    and target_id = roof;
  if n < 3 then raise exception 'FAIL: expected >=3 ledger events, found %', n; end if;
  raise notice 'PASS: ledger moves are event-logged (%)', n;
end $$;

rollback;

-- ---- RLS isolation: Crestline sees no Harborline money
begin;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub": "auth0|crestline-admin"}', true);

do $$
declare n bigint;
begin
  select count(*) into n from public.ledger_entries;
  if n <> 0 then raise exception 'FAIL: crestline sees % ledger entries', n; end if;
  select count(*) into n from public.v_ledger_project_financials;
  if n <> 0 then raise exception 'FAIL: crestline sees % financial rows', n; end if;
  raise notice 'PASS: ledger is client-isolated under RLS';
end $$;

rollback;
