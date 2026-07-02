import { authed } from "@/lib/server/api";

// Change a variable (the write side, ported from BKG's one-loop change
// endpoint). Three moves in this slice — each writes the model, logs an
// event, asserts reconciliation IN the SQL function, and returns the fresh
// totals. A raise means the change was rejected, never half-applied.
//   post_expense         — money spent (actual moves)
//   approve_change_order — the only thing that moves revised budget
//   reverse_entry        — "undo that": a new balancing entry, never a delete
type ChangeBody =
  | { kind: "post_expense"; code: string; amount: number; memo?: string }
  | { kind: "approve_change_order"; change_order_id: string }
  | { kind: "reverse_entry"; entry_id: string };

export async function POST(
  request: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id: projectId } = await ctx.params;
  const body = (await request.json()) as ChangeBody;

  return authed(async (q) => {
    let row;
    switch (body?.kind) {
      case "post_expense": {
        if (!body.code || typeof body.amount !== "number" || body.amount <= 0) {
          throw new Error("A cost code and a positive amount are required");
        }
        row = await q.query(`select public.ledger_post_expense($1, $2, $3, $4) as f`, [
          projectId,
          body.code,
          body.amount,
          body.memo ?? null,
        ]);
        break;
      }
      case "approve_change_order": {
        if (!body.change_order_id) throw new Error("change_order_id required");
        row = await q.query(`select public.ledger_approve_change_order($1) as f`, [
          body.change_order_id,
        ]);
        break;
      }
      case "reverse_entry": {
        if (!body.entry_id) throw new Error("entry_id required");
        row = await q.query(`select public.ledger_reverse_entry($1) as f`, [body.entry_id]);
        break;
      }
      default:
        throw new Error("Unknown change kind");
    }
    return { ok: true, financials: row.rows[0].f };
  });
}
