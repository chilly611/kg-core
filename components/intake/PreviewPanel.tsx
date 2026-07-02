"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { AgGridReact } from "ag-grid-react";
import {
  AllCommunityModule,
  ModuleRegistry,
  type CellValueChangedEvent,
  type ColDef,
  type ICellRendererParams,
} from "ag-grid-community";
import { herbariumGridTheme } from "@/components/workspace/gridTheme";
import { sendJson } from "@/components/workspace/types";
import type { Bundle, CommitResult, Proposal, ProposalRow } from "@/lib/intake/types";

ModuleRegistry.registerModules([AllCommunityModule]);

// One preview, every path. Creates/updates/conflicts color-coded as Herbarium
// flags; row errors are fixed inline (edits re-plan against the DB); nothing
// commits until the person says so.

const ACTION_FLAG: Record<string, { cls: string; label: string }> = {
  create: { cls: "flag-good", label: "create" },
  update: { cls: "flag-warn", label: "update" },
  unchanged: { cls: "", label: "no change" },
  error: { cls: "flag-bad", label: "fix me" },
};

function ActionChip(p: ICellRendererParams) {
  const f = ACTION_FLAG[String(p.value)] ?? ACTION_FLAG.unchanged;
  return <span className={`flag-chip ${f.cls}`}>{f.label}</span>;
}

function SkipCell(p: ICellRendererParams) {
  const ctx = p.context as { onSkip: (key: string, skip: boolean) => void };
  const row = p.data as ProposalRow;
  return (
    <input
      type="checkbox"
      className="accent-[var(--rust)]"
      checked={row.skip}
      onChange={(e) => ctx.onSkip(row.key, e.target.checked)}
      aria-label="Skip this row"
    />
  );
}

function fmtDuration(seconds: number | null): string {
  if (seconds == null) return "—";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

// Which editable grid field maps to which draft field, per entity.
const EDIT_MAP: Record<string, Record<string, string>> = {
  group: { label: "name", type_col: "group_kind" },
  address: { street: "street", city: "city", region: "region", postal: "postal" },
  project: { label: "name" },
  contact: { label: "display_name", email: "email", phone: "phone" },
  link: { type_col: "contact_type", lease_start: "lease_start", lease_end: "lease_end" },
};

export function PreviewPanel({
  initialBundle,
  initialProposal,
  startedAt,
  onCommitted,
  compact = false,
}: {
  initialBundle: Bundle;
  initialProposal: Proposal;
  startedAt: string;
  onCommitted?: (result: CommitResult) => void;
  compact?: boolean;
}) {
  const bundleRef = useRef<Bundle>(structuredClone(initialBundle));
  const [proposal, setProposal] = useState<Proposal>(initialProposal);
  const skipsRef = useRef<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<CommitResult | null>(null);

  const rows = useMemo(
    () =>
      proposal.rows.map((r) => ({ ...r, skip: skipsRef.current.has(r.key) })),
    [proposal]
  );

  const counts = useMemo(() => {
    const c = { create: 0, update: 0, unchanged: 0, error: 0 };
    for (const r of rows) {
      if (r.skip) continue;
      c[r.action]++;
    }
    return c;
  }, [rows]);

  const replan = useCallback(async () => {
    const { proposal: fresh } = await sendJson<{ proposal: Proposal }>(
      "POST",
      "/api/intake/plan",
      { bundle: bundleRef.current, source: proposal.source }
    );
    fresh.parser = proposal.parser;
    fresh.notes = proposal.notes;
    setProposal(fresh);
  }, [proposal.source, proposal.parser, proposal.notes]);

  // Inline fix: write the edit into the bundle draft, then re-check.
  const onCellValueChanged = useCallback(
    async (e: CellValueChangedEvent) => {
      const row = e.data as ProposalRow;
      const gridField = e.colDef.colId ?? e.colDef.field;
      const draftField = EDIT_MAP[row.entity]?.[gridField ?? ""];
      if (!draftField) return;
      const value = e.newValue === "" ? null : e.newValue;

      const b = bundleRef.current;
      const list =
        row.entity === "group" ? b.groups
        : row.entity === "address" ? b.addresses
        : row.entity === "project" ? b.projects
        : row.entity === "contact" ? b.contacts
        : row.entity === "link" ? b.links
        : null;
      const draft = list?.find((d) => d.key === row.key) as
        | Record<string, unknown>
        | undefined;
      if (!draft) return;
      draft[draftField] = value;
      try {
        setError(null);
        await replan();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Re-check failed");
      }
    },
    [replan]
  );

  const onSkip = useCallback(
    (key: string, skip: boolean) => {
      if (skip) skipsRef.current.add(key);
      else skipsRef.current.delete(key);
      setProposal((p) => ({ ...p })); // re-render
    },
    []
  );

  const commit = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const toCommit: Proposal = {
        ...proposal,
        rows: proposal.rows.map((r) => ({ ...r, skip: skipsRef.current.has(r.key) })),
      };
      const res = await sendJson<CommitResult>("POST", "/api/intake/commit", {
        proposal: toCommit,
        startedAt,
      });
      setResult(res);
      onCommitted?.(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Commit failed");
    } finally {
      setBusy(false);
    }
  }, [proposal, startedAt, onCommitted]);

  const columnDefs: ColDef[] = useMemo(
    () => [
      {
        headerName: "",
        colId: "skip",
        width: 46,
        sortable: false,
        cellRenderer: SkipCell,
      },
      { field: "action", width: 110, cellRenderer: ActionChip },
      { field: "entity", width: 110, cellClass: "font-mono" },
      {
        field: "label",
        headerName: "Name",
        colId: "label",
        flex: 1.4,
        editable: (p) => ["group", "project", "contact"].includes(p.data.entity),
      },
      {
        headerName: "Street",
        colId: "street",
        width: 150,
        editable: (p) => p.data.entity === "address",
        valueGetter: (p) => p.data.data.street ?? "",
      },
      {
        headerName: "City",
        colId: "city",
        width: 110,
        editable: (p) => p.data.entity === "address",
        valueGetter: (p) => p.data.data.city ?? "",
      },
      {
        headerName: "Type",
        colId: "type_col",
        width: 110,
        cellClass: "font-mono",
        editable: (p) => ["link", "group"].includes(p.data.entity),
        valueGetter: (p) =>
          p.data.entity === "link"
            ? p.data.data.contact_type ?? ""
            : p.data.entity === "group"
              ? p.data.data.group_kind ?? ""
              : "",
      },
      {
        headerName: "Lease start",
        colId: "lease_start",
        width: 115,
        cellClass: "font-mono",
        editable: (p) => p.data.entity === "link",
        valueGetter: (p) => p.data.data.lease_start ?? "",
      },
      {
        headerName: "Lease end",
        colId: "lease_end",
        width: 115,
        cellClass: "font-mono",
        editable: (p) => p.data.entity === "link",
        valueGetter: (p) => p.data.data.lease_end ?? "",
      },
      { field: "detail", headerName: "What happens", flex: 1.4 },
      {
        field: "issues",
        flex: 1.2,
        cellClass: "text-rust",
        valueFormatter: (p) => (p.value as string[])?.join("; ") ?? "",
      },
    ],
    []
  );

  if (result) {
    const total = result.records_created + result.records_updated;
    return (
      <div className="well p-6 text-center">
        <div className="h-label text-gold">Committed</div>
        <p className="h-display mt-2 text-2xl">
          {total} record{total === 1 ? "" : "s"} in {fmtDuration(result.user_active_seconds)} of
          your time.
        </p>
        <p className="h-caption mt-2 text-sm">
          {result.records_created} created · {result.records_updated} updated
          {result.drafts_created > 0 &&
            ` · ${result.drafts_created} draft type${result.drafts_created === 1 ? "" : "s"} queued for review`}
        </p>
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="flag-chip flag-good">{counts.create} create</span>
        <span className="flag-chip flag-warn">{counts.update} update</span>
        <span className="flag-chip">{counts.unchanged} unchanged</span>
        {counts.error > 0 && (
          <span className="flag-chip flag-bad">{counts.error} to fix — edit cells inline</span>
        )}
        {proposal.notes?.map((n) => (
          <span key={n} className="h-caption text-sm text-rust">
            {n}
          </span>
        ))}
        <div className="ml-auto flex items-center gap-2">
          <button className="btn btn-quiet" onClick={replan} disabled={busy}>
            Re-check
          </button>
          <button
            className="btn"
            onClick={commit}
            disabled={busy || counts.error > 0 || counts.create + counts.update === 0}
          >
            {busy
              ? "Committing…"
              : counts.create + counts.update === 0
                ? "Nothing to commit"
                : `Commit ${counts.create + counts.update}`}
          </button>
        </div>
      </div>
      {error && <p className="text-sm text-rust">{error}</p>}
      <div className={compact ? "h-[320px]" : "h-[480px]"}>
        <AgGridReact
          theme={herbariumGridTheme}
          rowData={rows}
          columnDefs={columnDefs}
          getRowId={(p) => p.data.key}
          defaultColDef={{ sortable: true, resizable: true }}
          context={{ onSkip }}
          onCellValueChanged={onCellValueChanged}
        />
      </div>
    </div>
  );
}
