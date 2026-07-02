"use client";

import { useCallback, useEffect, useState } from "react";
import { getJson, sendJson } from "@/components/workspace/types";

// The Budget slot — BKG's budget ribbon essence (one stable "spent / total"
// headline, live movement, headroom as a flag) rebuilt on the ledger views.
// Live-ness: refetch after every change + a 5s poll while the rail is open —
// the seam where a Supabase Realtime subscription on public.events lands once
// a hosted project exists (bkg used postgres_changes on the rollup caches).

type Financials = {
  gated: boolean;
  totals: { budget: string; actual: string; remaining: string } | null;
  codes: Array<{ code: string; label: string; revised_budget: string; actual: string; remaining: string }>;
  changeOrders: Array<{ id: string; number: number; status: string; description: string | null; delta: string }>;
  entries: Array<{ id: string; entry_date: string; source_type: string; memo: string | null; amount: string }>;
  costCodes: Array<{ code: string; label: string }>;
};

function money(v: string | number | null | undefined): string {
  const n = Number(v ?? 0);
  if (Math.abs(n) >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (Math.abs(n) >= 1_000) return `$${Math.round(n / 1_000)}K`;
  return `$${Math.round(n).toLocaleString("en-US")}`;
}

export function BudgetSlot({ projectId }: { projectId: string }) {
  const [fin, setFin] = useState<Financials | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expense, setExpense] = useState({ code: "", amount: "", memo: "" });
  const [busy, setBusy] = useState(false);
  const [flash, setFlash] = useState(false);

  const load = useCallback(async () => {
    try {
      setFin(await getJson<Financials>(`/api/projects/${projectId}/financials`));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Load failed");
    }
  }, [projectId]);

  useEffect(() => {
    load();
    const t = setInterval(load, 5000); // realtime seam: poll until hosted Supabase
    return () => clearInterval(t);
  }, [load]);

  const change = useCallback(
    async (body: Record<string, unknown>) => {
      setBusy(true);
      setError(null);
      try {
        await sendJson("POST", `/api/projects/${projectId}/ledger/change`, body);
        await load();
        setFlash(true);
        setTimeout(() => setFlash(false), 900);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Change rejected");
      } finally {
        setBusy(false);
      }
    },
    [projectId, load]
  );

  if (!fin) return <p className="h-caption text-sm">Reconciling…</p>;
  if (fin.gated) return null; // module_visibility gate — no budget UI at all
  if (!fin.totals) {
    return <p className="h-caption text-sm">No budget baselined for this project yet.</p>;
  }

  const budget = Number(fin.totals.budget);
  const actual = Number(fin.totals.actual);
  const remaining = Number(fin.totals.remaining);
  const headFlag = remaining < 0 ? "flag-bad" : remaining < budget * 0.1 ? "flag-warn" : "flag-good";
  const pending = fin.changeOrders.filter((co) => co.status === "pending" || co.status === "draft");

  return (
    <div className="space-y-3">
      {/* Ribbon headline: spent / total, headroom as a flag */}
      <div className="flex items-baseline justify-between">
        <span
          className="h-display text-xl transition-colors"
          style={flash ? { color: "var(--teal)" } : undefined}
        >
          {money(actual)} <span className="text-ink-soft">/ {money(budget)}</span>
        </span>
        <span className={`flag-chip ${headFlag}`}>{money(remaining)} left</span>
      </div>

      {/* Per-code bars: actual vs revised */}
      <ul className="space-y-2">
        {fin.codes.map((c) => {
          const rev = Number(c.revised_budget);
          const act = Number(c.actual);
          const pct = rev > 0 ? Math.min(100, Math.round((act / rev) * 100)) : 0;
          return (
            <li key={c.code}>
              <div className="flex justify-between font-mono text-xs">
                <span>{c.label}</span>
                <span className={Number(c.remaining) < 0 ? "text-rust" : "text-ink-soft"}>
                  {money(act)} / {money(rev)}
                </span>
              </div>
              <div className="mt-0.5 h-1.5 w-full bg-vellum">
                <div
                  className="h-1.5"
                  style={{
                    width: `${pct}%`,
                    background: pct >= 100 ? "var(--rust)" : pct >= 85 ? "var(--gold)" : "var(--sage)",
                  }}
                />
              </div>
            </li>
          );
        })}
      </ul>

      {/* Pending change orders — the only thing that moves revised budget */}
      {pending.map((co) => (
        <div key={co.id} className="flex items-center justify-between gap-2 border border-vellum bg-cream px-2 py-1.5">
          <span className="text-xs">
            CO #{co.number} · {co.description ?? "—"}{" "}
            <span className="font-mono text-gold">+{money(co.delta)}</span>
          </span>
          <button className="btn btn-quiet !px-2 !py-0.5" disabled={busy}
            onClick={() => change({ kind: "approve_change_order", change_order_id: co.id })}>
            Approve
          </button>
        </div>
      ))}

      {/* Post an expense — change a variable, watch the view reconcile */}
      <div className="flex flex-wrap items-center gap-1.5">
        <select className="field !py-1 text-xs" value={expense.code}
          onChange={(e) => setExpense({ ...expense, code: e.target.value })}>
          <option value="">Cost code…</option>
          {fin.costCodes.map((c) => (
            <option key={c.code} value={c.code}>{c.label}</option>
          ))}
        </select>
        <input className="field w-24 !py-1 text-xs" type="number" min="0" placeholder="Amount"
          value={expense.amount}
          onChange={(e) => setExpense({ ...expense, amount: e.target.value })} />
        <input className="field w-32 flex-1 !py-1 text-xs" placeholder="Memo"
          value={expense.memo}
          onChange={(e) => setExpense({ ...expense, memo: e.target.value })} />
        <button className="btn !px-2 !py-1" disabled={busy || !expense.code || !(Number(expense.amount) > 0)}
          onClick={async () => {
            await change({ kind: "post_expense", code: expense.code, amount: Number(expense.amount), memo: expense.memo || undefined });
            setExpense({ code: "", amount: "", memo: "" });
          }}>
          Post
        </button>
      </div>

      {/* Recent entries with the undo beat (reversal, never delete) */}
      {fin.entries.length > 0 && (
        <details>
          <summary className="h-label cursor-pointer text-gold">Recent entries</summary>
          <ul className="mt-1.5 space-y-1">
            {fin.entries.map((e) => (
              <li key={e.id} className="flex items-center justify-between gap-2 text-xs">
                <span className="truncate">{e.entry_date} · {e.memo ?? e.source_type}</span>
                <span className="flex items-center gap-1.5 font-mono">
                  {money(e.amount)}
                  <button className="h-label text-rust" disabled={busy} title="Reverse (a new balancing entry)"
                    onClick={() => change({ kind: "reverse_entry", entry_id: e.id })}>
                    undo
                  </button>
                </span>
              </li>
            ))}
          </ul>
        </details>
      )}

      {error && <p className="text-xs text-rust">{error}</p>}
    </div>
  );
}
