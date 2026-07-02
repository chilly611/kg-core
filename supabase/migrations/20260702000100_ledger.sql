-- ============================================================================
-- Ledger (CODE-E) — double-entry money model, ported from BKG's proven
-- One-Loop slice (bkg feat/one-loop-ledger, 20260623_one_loop_ledger.sql).
--
-- Adaptations for kg-core, deliberate:
--   * keys on public.projects.id and carries client_id for standard RLS
--     (source used an isolated `oneloop` schema + service-role access);
--   * cost codes are CLIENT VOCABULARY (ledger_cost_codes), not MasterFormat —
--     category-agnostic per the Rubicon Rule; a construction client can load
--     MasterFormat AS their codes, but nothing here assumes it;
--   * TRUTH IS THE VIEW. The source's rollup cache tables existed only because
--     Supabase Realtime broadcasts table changes; kg-core polls until a hosted
--     project exists, so the caches (and their recompute cascade) are dropped.
--     When Realtime lands, subscribe to public.events instead.
--   * commitments / ETC overrides / hash-chained event log deferred — this
--     slice ports budget + change orders + balanced journal + reconciliation.
--     (events reuse kg-core's append-only public.events.)
-- Invariants kept verbatim from the source:
--   * Σdebit = Σcredit per journal entry (deferrable constraint trigger);
--   * only APPROVED change orders move revised budget;
--   * reversal is a new balancing entry, never a delete;
--   * ledger_assert_reconcile() raises rather than let a bad number render.
-- ============================================================================

-- ------------------------------------------------------- chart of accounts ---
create table public.ledger_accounts (
  id        uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id),
  code      text not null,
  name      text not null,
  type      text not null check (type in ('asset','liability','equity','revenue','expense','contra')),
  unique (client_id, code)
);

-- ------------------------------------------------- cost codes (client vocab) ---
create table public.ledger_cost_codes (
  id        uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id),
  code      text not null,
  label     text not null,
  unique (client_id, code)
);

-- --------------------------------------------------------------- budget ------
create table public.ledger_budget_lines (
  id              uuid primary key default gen_random_uuid(),
  client_id       uuid not null references public.clients(id),
  project_id      uuid not null references public.projects(id) on delete cascade,
  cost_code_id    uuid not null references public.ledger_cost_codes(id),
  original_amount numeric(14,2) not null default 0,
  baselined_at    timestamptz,
  unique (project_id, cost_code_id)
);

-- --------------------------------------------------------- change orders -----
create table public.ledger_change_orders (
  id          uuid primary key default gen_random_uuid(),
  client_id   uuid not null references public.clients(id),
  project_id  uuid not null references public.projects(id) on delete cascade,
  number      int  not null,
  status      text not null default 'draft' check (status in ('draft','pending','approved','void')),
  description text,
  created_by  uuid references public.users(id),
  approved_by uuid references public.users(id),
  approved_at timestamptz,
  created_at  timestamptz not null default now(),
  unique (project_id, number)
);

create table public.ledger_change_order_lines (
  id              uuid primary key default gen_random_uuid(),
  change_order_id uuid not null references public.ledger_change_orders(id) on delete cascade,
  cost_code_id    uuid not null references public.ledger_cost_codes(id),
  budget_delta    numeric(14,2) not null
);

-- -------------------------------------------------- journal (double entry) ---
create table public.ledger_entries (
  id          uuid primary key default gen_random_uuid(),
  client_id   uuid not null references public.clients(id),
  project_id  uuid not null references public.projects(id) on delete cascade,
  entry_date  date not null default current_date,
  source_type text not null check (source_type in ('invoice','payment','payroll','adjustment','opening')),
  memo        text,
  created_by  uuid references public.users(id),
  created_at  timestamptz not null default now()
);

create table public.ledger_lines (
  id            uuid primary key default gen_random_uuid(),
  entry_id      uuid not null references public.ledger_entries(id) on delete restrict,
  account_id    uuid not null references public.ledger_accounts(id),
  cost_code_id  uuid references public.ledger_cost_codes(id),
  debit         numeric(14,2) not null default 0 check (debit  >= 0),
  credit        numeric(14,2) not null default 0 check (credit >= 0),
  amount_signed numeric(14,2) generated always as (debit - credit) stored,
  check (not (debit > 0 and credit > 0))
);
create index ledger_lines_entry_idx on public.ledger_lines (entry_id);

-- Balance guarantee (ported verbatim): Σdebit = Σcredit per entry, checked at
-- COMMIT so a two-line insert balances at transaction end.
create or replace function public.ledger_assert_entry_balanced() returns trigger
language plpgsql as $$
declare d numeric(14,2); c numeric(14,2); eid uuid;
begin
  eid := coalesce(new.entry_id, old.entry_id);
  select coalesce(sum(debit),0), coalesce(sum(credit),0) into d, c
    from public.ledger_lines where entry_id = eid;
  if d <> c then
    raise exception 'journal entry % is unbalanced: debit=% credit=%', eid, d, c;
  end if;
  return null;
end $$;
create constraint trigger trg_ledger_line_balance
  after insert or update or delete on public.ledger_lines
  deferrable initially deferred
  for each row execute function public.ledger_assert_entry_balanced();

-- ------------------------------------------- canonical views (the truth) -----
-- security_invoker: the caller's RLS decides which projects exist at all.
create or replace view public.v_ledger_cost_code_financials
  with (security_invoker = true) as
with codes as (
  select project_id, cost_code_id from public.ledger_budget_lines
  union select co.project_id, col.cost_code_id
    from public.ledger_change_order_lines col
    join public.ledger_change_orders co on co.id = col.change_order_id
  union select e.project_id, l.cost_code_id
    from public.ledger_lines l
    join public.ledger_entries e on e.id = l.entry_id
    where l.cost_code_id is not null
),
orig as (
  select project_id, cost_code_id, sum(original_amount) amt
  from public.ledger_budget_lines group by 1,2
),
co_delta as ( -- ONLY approved change orders move budget (invariant kept)
  select co.project_id, col.cost_code_id, sum(col.budget_delta) amt
  from public.ledger_change_order_lines col
  join public.ledger_change_orders co on co.id = col.change_order_id
  where co.status = 'approved' group by 1,2
),
act as (
  select e.project_id, l.cost_code_id, sum(l.debit - l.credit) amt
  from public.ledger_lines l
  join public.ledger_entries e on e.id = l.entry_id
  join public.ledger_accounts a on a.id = l.account_id
  where a.type = 'expense' and l.cost_code_id is not null
  group by 1,2
)
select
  k.project_id,
  k.cost_code_id,
  cc.code,
  cc.label,
  coalesce(o.amt,0)                                        as original_budget,
  coalesce(o.amt,0) + coalesce(cd.amt,0)                   as revised_budget,
  coalesce(ac.amt,0)                                       as actual,
  coalesce(o.amt,0) + coalesce(cd.amt,0) - coalesce(ac.amt,0) as remaining
from codes k
join public.ledger_cost_codes cc on cc.id = k.cost_code_id
left join orig     o  on o.project_id = k.project_id and o.cost_code_id  = k.cost_code_id
left join co_delta cd on cd.project_id = k.project_id and cd.cost_code_id = k.cost_code_id
left join act      ac on ac.project_id = k.project_id and ac.cost_code_id = k.cost_code_id;

create or replace view public.v_ledger_project_financials
  with (security_invoker = true) as
select
  p.id as project_id,
  coalesce(sum(f.revised_budget),0) as budget,
  coalesce(sum(f.actual),0)         as actual,
  coalesce(sum(f.remaining),0)      as remaining
from public.projects p
join public.v_ledger_cost_code_financials f on f.project_id = p.id
group by p.id;

-- ---------------------------------------------- reconciliation assertion -----
-- Honest-UI at the data layer (ported): if anything is off, RAISE — never
-- render a number that doesn't reconcile.
create or replace function public.ledger_assert_reconcile(p uuid) returns void
language plpgsql security definer set search_path = public as $$
declare bad int; v record; sum_cc numeric(14,2);
begin
  select count(*) into bad from (
    select l.entry_id from ledger_lines l
    join ledger_entries e on e.id = l.entry_id
    where e.project_id = p
    group by l.entry_id having sum(l.debit) <> sum(l.credit)
  ) q;
  if bad > 0 then raise exception 'reconcile[%]: % unbalanced journal entries', p, bad; end if;

  select * into v from v_ledger_project_financials where project_id = p;
  if v is null then return; end if; -- no budget/ledger rows yet: nothing to reconcile

  select coalesce(sum(revised_budget),0) into sum_cc
    from v_ledger_cost_code_financials where project_id = p;
  if v.budget <> sum_cc then
    raise exception 'reconcile[%]: project budget % <> Σcost_code %', p, v.budget, sum_cc;
  end if;
  if v.budget <> v.remaining + v.actual then
    raise exception 'reconcile[%]: budget(%) <> remaining(%) + actual(%)',
      p, v.budget, v.remaining, v.actual;
  end if;
end $$;

-- --------------------------------- change-a-variable functions (the moves) ---
-- security definer with authz enforced INSIDE (can_write on the project's
-- client). Each: write the model -> log an event -> assert reconcile ->
-- return the fresh totals. Ported from oneloop_post_expense / _reverse_entry /
-- _approve_change_order; ETC + commitments deferred with their tables.

create or replace function public.ledger_post_expense(
  p_project uuid, p_code text, p_amount numeric, p_memo text default null
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_client uuid; v_code uuid; v_exp uuid; v_ap uuid; v_entry uuid; v_out jsonb;
begin
  select client_id into v_client from projects where id = p_project;
  if v_client is null then raise exception 'project not found'; end if;
  if not can_write(v_client, null, p_project) then raise exception 'not allowed'; end if;
  if p_amount is null or p_amount <= 0 then raise exception 'amount must be > 0'; end if;

  select id into v_code from ledger_cost_codes where client_id = v_client and code = p_code;
  if v_code is null then raise exception 'unknown cost code %', p_code; end if;
  select id into v_exp from ledger_accounts where client_id = v_client and type = 'expense'   order by code limit 1;
  select id into v_ap  from ledger_accounts where client_id = v_client and type = 'liability' order by code limit 1;
  if v_exp is null or v_ap is null then raise exception 'chart of accounts missing expense/liability account'; end if;

  insert into ledger_entries (client_id, project_id, source_type, memo, created_by)
    values (v_client, p_project, 'invoice', p_memo, current_user_id()) returning id into v_entry;
  insert into ledger_lines (entry_id, account_id, cost_code_id, debit, credit) values
    (v_entry, v_exp, v_code, p_amount, 0),
    (v_entry, v_ap,  null,   0,        p_amount);

  insert into events (client_id, actor_type, actor_id, verb, target_type, target_id, payload)
    values (v_client, case when is_operator() then 'operator' else 'user' end, current_user_id(),
            'ledger.expense_posted', 'project', p_project,
            jsonb_build_object('code', p_code, 'amount', p_amount, 'memo', p_memo, 'entry_id', v_entry));

  perform ledger_assert_reconcile(p_project);
  select to_jsonb(f.*) into v_out from v_ledger_project_financials f where f.project_id = p_project;
  return v_out;
end $$;

create or replace function public.ledger_reverse_entry(p_entry uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_client uuid; v_proj uuid; v_new uuid; v_out jsonb;
begin
  select client_id, project_id into v_client, v_proj from ledger_entries where id = p_entry;
  if v_proj is null then raise exception 'journal entry not found'; end if;
  if not can_write(v_client, null, v_proj) then raise exception 'not allowed'; end if;

  insert into ledger_entries (client_id, project_id, source_type, memo, created_by)
    values (v_client, v_proj, 'adjustment', 'reversal of ' || p_entry::text, current_user_id())
    returning id into v_new;
  insert into ledger_lines (entry_id, account_id, cost_code_id, debit, credit)
    select v_new, account_id, cost_code_id, credit, debit  -- swap = reversal
    from ledger_lines where entry_id = p_entry;

  insert into events (client_id, actor_type, actor_id, verb, target_type, target_id, payload)
    values (v_client, case when is_operator() then 'operator' else 'user' end, current_user_id(),
            'ledger.entry_reversed', 'project', v_proj,
            jsonb_build_object('reversed_entry', p_entry, 'entry_id', v_new));

  perform ledger_assert_reconcile(v_proj);
  select to_jsonb(f.*) into v_out from v_ledger_project_financials f where f.project_id = v_proj;
  return v_out;
end $$;

create or replace function public.ledger_approve_change_order(p_co uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_client uuid; v_proj uuid; v_status text; v_out jsonb;
begin
  select client_id, project_id, status into v_client, v_proj, v_status
    from ledger_change_orders where id = p_co;
  if v_proj is null then raise exception 'change order not found'; end if;
  if not can_write(v_client, null, v_proj) then raise exception 'not allowed'; end if;
  if v_status = 'approved' then raise exception 'change order already approved'; end if;
  if v_status = 'void' then raise exception 'change order is void'; end if;

  update ledger_change_orders
    set status = 'approved', approved_by = current_user_id(), approved_at = now()
    where id = p_co;

  insert into events (client_id, actor_type, actor_id, verb, target_type, target_id, payload)
    values (v_client, case when is_operator() then 'operator' else 'user' end, current_user_id(),
            'ledger.change_order_approved', 'project', v_proj,
            jsonb_build_object('change_order_id', p_co));

  perform ledger_assert_reconcile(v_proj);
  select to_jsonb(f.*) into v_out from v_ledger_project_financials f where f.project_id = v_proj;
  return v_out;
end $$;

-- ------------------------------------------------------------------- RLS -----
alter table public.ledger_accounts enable row level security;
create policy ledger_accounts_select on public.ledger_accounts for select using (can_read(client_id));
create policy ledger_accounts_write  on public.ledger_accounts for all
  using (can_write(client_id)) with check (can_write(client_id));

alter table public.ledger_cost_codes enable row level security;
create policy ledger_cost_codes_select on public.ledger_cost_codes for select using (can_read(client_id));
create policy ledger_cost_codes_write  on public.ledger_cost_codes for all
  using (can_write(client_id)) with check (can_write(client_id));

alter table public.ledger_budget_lines enable row level security;
create policy ledger_budget_lines_select on public.ledger_budget_lines for select
  using (can_read(client_id, null, project_id));
create policy ledger_budget_lines_write on public.ledger_budget_lines for all
  using (can_write(client_id, null, project_id)) with check (can_write(client_id, null, project_id));

alter table public.ledger_change_orders enable row level security;
create policy ledger_change_orders_select on public.ledger_change_orders for select
  using (can_read(client_id, null, project_id));
create policy ledger_change_orders_write on public.ledger_change_orders for all
  using (can_write(client_id, null, project_id)) with check (can_write(client_id, null, project_id));

alter table public.ledger_change_order_lines enable row level security;
-- Visibility follows the parent change order (subquery runs under caller RLS).
create policy ledger_co_lines_select on public.ledger_change_order_lines for select
  using (exists (select 1 from public.ledger_change_orders co where co.id = change_order_id));
create policy ledger_co_lines_write on public.ledger_change_order_lines for all
  using (exists (select 1 from public.ledger_change_orders co
                 where co.id = change_order_id and can_write(co.client_id, null, co.project_id)))
  with check (exists (select 1 from public.ledger_change_orders co
                      where co.id = change_order_id and can_write(co.client_id, null, co.project_id)));

alter table public.ledger_entries enable row level security;
create policy ledger_entries_select on public.ledger_entries for select
  using (can_read(client_id, null, project_id));
create policy ledger_entries_write on public.ledger_entries for all
  using (can_write(client_id, null, project_id)) with check (can_write(client_id, null, project_id));

alter table public.ledger_lines enable row level security;
create policy ledger_lines_select on public.ledger_lines for select
  using (exists (select 1 from public.ledger_entries e where e.id = entry_id));
create policy ledger_lines_write on public.ledger_lines for all
  using (exists (select 1 from public.ledger_entries e
                 where e.id = entry_id and can_write(e.client_id, null, e.project_id)))
  with check (exists (select 1 from public.ledger_entries e
                      where e.id = entry_id and can_write(e.client_id, null, e.project_id)));

-- ------------------------------------------------------------- privileges ----
grant select, insert, update, delete on all tables in schema public to authenticated;
grant execute on all functions in schema public to authenticated;
