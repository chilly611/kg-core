"use client";

import { useEffect, useMemo, useState } from "react";
import {
  getJson,
  sendJson,
  fmtDate,
  type Assignment,
  type ContactRow,
} from "./types";

// "Contractor leaves, new one assigned everywhere": pick the outgoing
// contact's assignments across projects, choose a replacement and an end
// date, commit as ONE action (one transaction server-side).
export function ReassignDialog({
  contact,
  contacts,
  onClose,
  onDone,
}: {
  contact: ContactRow;
  contacts: ContactRow[];
  onClose: () => void;
  onDone: (message: string) => void;
}) {
  const [assignments, setAssignments] = useState<Assignment[] | null>(null);
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [toContactId, setToContactId] = useState("");
  const [endDate, setEndDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getJson<Assignment[]>(`/api/contacts/${contact.id}/assignments`)
      .then((rows) => {
        setAssignments(rows);
        // Everything currently active is preselected — that's the use case.
        setChecked(new Set(rows.filter((r) => r.effective_status === "active").map((r) => r.id)));
      })
      .catch((e) => setError(e.message));
  }, [contact.id]);

  const replacementOptions = useMemo(
    () => contacts.filter((c) => c.id !== contact.id && c.status === "active"),
    [contacts, contact.id]
  );

  function toggle(id: string) {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      const result = await sendJson<{ ended: number; created: number }>(
        "POST",
        "/api/bulk/reassign",
        {
          fromContactId: contact.id,
          toContactId,
          assignmentIds: [...checked],
          endDate,
        }
      );
      const toName =
        replacementOptions.find((c) => c.id === toContactId)?.display_name ?? "replacement";
      onDone(
        `Reassigned ${result.ended} assignment${result.ended === 1 ? "" : "s"} from ${contact.display_name} to ${toName} — logged.`
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Reassign failed");
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" role="dialog">
      <div className="absolute inset-0 bg-ink/20" onClick={onClose} />
      <div className="relative w-[520px] max-w-[94vw] rounded border border-vellum bg-cream shadow-xl">
        <header className="border-b border-vellum bg-parchment px-5 py-4">
          <div className="h-label text-gold">Bulk reassign</div>
          <h2 className="h-display text-lg">{contact.display_name} steps away</h2>
          <p className="h-caption mt-1 text-sm">
            End-date the selected assignments and hand each one to the replacement — one action.
          </p>
        </header>

        <div className="max-h-[46vh] overflow-y-auto px-5 py-4">
          {!assignments && !error && <p className="text-sm">Loading assignments…</p>}
          {assignments && assignments.length === 0 && (
            <p className="h-caption text-sm">This contact has no assignments.</p>
          )}
          <ul className="space-y-2">
            {assignments?.map((a) => (
              <li key={a.id}>
                <label className="flex cursor-pointer items-center gap-3 text-sm">
                  <input
                    type="checkbox"
                    checked={checked.has(a.id)}
                    onChange={() => toggle(a.id)}
                    className="accent-[var(--teal)]"
                  />
                  <span className="flex-1">{a.project_name}</span>
                  <span className="font-mono text-xs text-ink-soft">
                    {a.type_label}
                    {a.effective_status !== "active" && " · ended " + fmtDate(a.valid_to)}
                  </span>
                </label>
              </li>
            ))}
          </ul>
        </div>

        <div className="space-y-3 border-t border-vellum px-5 py-4">
          <div className="flex items-center gap-3">
            <label className="h-label w-28 text-gold" htmlFor="reassign-to">
              Replace with
            </label>
            <select
              id="reassign-to"
              className="field flex-1"
              value={toContactId}
              onChange={(e) => setToContactId(e.target.value)}
            >
              <option value="">Choose a contact…</option>
              {replacementOptions.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.display_name} ({c.kind})
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-3">
            <label className="h-label w-28 text-gold" htmlFor="reassign-end">
              End date
            </label>
            <input
              id="reassign-end"
              type="date"
              className="field"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </div>
          {error && <p className="text-sm text-rust">{error}</p>}
          <div className="flex justify-end gap-2 pt-1">
            <button className="btn btn-quiet" onClick={onClose} disabled={busy}>
              Cancel
            </button>
            <button
              className="btn"
              onClick={submit}
              disabled={busy || checked.size === 0 || !toContactId}
            >
              {busy ? "Working…" : `Reassign ${checked.size}`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
