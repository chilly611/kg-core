import { authed } from "@/lib/server/api";

// The live money picture: project totals + per-cost-code rows + change orders
// + recent journal entries. Truth is the view; RLS scopes everything.
// Additionally gated on module_visibility.budgets — the money module simply
// does not exist for a grant with {"budgets": false}.
export async function GET(
  _request: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;

  return authed(async (q) => {
    const gate = (
      await q.query(
        `select public.module_visible(p.client_id, 'budgets') as visible
         from public.projects p where p.id = $1`,
        [id]
      )
    ).rows[0];
    if (!gate) throw new Error("Project not found");
    if (!gate.visible) return { gated: true };

    const totals = (
      await q.query(
        `select budget, actual, remaining from public.v_ledger_project_financials
         where project_id = $1`,
        [id]
      )
    ).rows[0] ?? null;

    const codes = (
      await q.query(
        `select code, label, original_budget, revised_budget, actual, remaining
         from public.v_ledger_cost_code_financials
         where project_id = $1 order by revised_budget desc`,
        [id]
      )
    ).rows;

    const changeOrders = (
      await q.query(
        `select co.id, co.number, co.status, co.description,
                coalesce(sum(l.budget_delta), 0) as delta
         from public.ledger_change_orders co
         left join public.ledger_change_order_lines l on l.change_order_id = co.id
         where co.project_id = $1
         group by co.id order by co.number`,
        [id]
      )
    ).rows;

    const entries = (
      await q.query(
        `select e.id, e.entry_date::text, e.source_type, e.memo,
                coalesce(sum(l.debit) filter (where l.debit > 0), 0) as amount
         from public.ledger_entries e
         join public.ledger_lines l on l.entry_id = e.id
         where e.project_id = $1
         group by e.id order by e.created_at desc limit 6`,
        [id]
      )
    ).rows;

    const costCodes = (
      await q.query(
        `select cc.code, cc.label from public.ledger_cost_codes cc
         join public.projects p on p.client_id = cc.client_id
         where p.id = $1 order by cc.label`,
        [id]
      )
    ).rows;

    return { gated: false, totals, codes, changeOrders, entries, costCodes };
  });
}
