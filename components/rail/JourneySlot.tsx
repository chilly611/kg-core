"use client";

import { useEffect, useMemo, useState } from "react";
import { getJson, fmtDate } from "@/components/workspace/types";

// The Journey slot — the time-machine CONCEPT from BKG (scrub through project
// time, see the state as-of), rebuilt category-agnostic: moments are events,
// spans are project_contacts windows, every label comes from the data.

type Journey = {
  project: { id: string; name: string; started: string };
  moments: Array<{ id: string; verb: string; actor_type: string; created_at: string; memo: string | null; amount: string | null }>;
  spans: Array<{ id: string; display_name: string; type_label: string; valid_from: string | null; valid_to: string | null; effective_status: string }>;
};

export function JourneySlot({ projectId }: { projectId: string }) {
  const [j, setJ] = useState<Journey | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [asOfPct, setAsOfPct] = useState(100); // scrubber: 0 = start, 100 = today

  useEffect(() => {
    getJson<Journey>(`/api/projects/${projectId}/journey`)
      .then(setJ)
      .catch((e) => setError(e.message));
  }, [projectId]);

  const range = useMemo(() => {
    if (!j) return null;
    const dates: number[] = [new Date(j.project.started).getTime()];
    for (const m of j.moments) dates.push(new Date(m.created_at).getTime());
    for (const s of j.spans) {
      if (s.valid_from) dates.push(new Date(s.valid_from).getTime());
      if (s.valid_to) dates.push(new Date(s.valid_to).getTime());
    }
    dates.push(Date.now());
    const min = Math.min(...dates);
    const max = Math.max(...dates);
    return { min, max: max === min ? min + 86_400_000 : max };
  }, [j]);

  if (error) return <p className="text-xs text-rust">{error}</p>;
  if (!j || !range) return <p className="h-caption text-sm">Assembling the timeline…</p>;

  const asOf = range.min + ((range.max - range.min) * asOfPct) / 100;
  const asOfDate = new Date(asOf);
  const visibleMoments = j.moments.filter((m) => new Date(m.created_at).getTime() <= asOf);
  const activeSpans = j.spans.filter((s) => {
    const from = s.valid_from ? new Date(s.valid_from).getTime() : range.min;
    const to = s.valid_to ? new Date(s.valid_to).getTime() : Infinity;
    return from <= asOf && asOf <= to;
  });

  return (
    <div className="space-y-3">
      {/* Time scrubber */}
      <div>
        <input
          type="range" min={0} max={100} value={asOfPct}
          onChange={(e) => setAsOfPct(Number(e.target.value))}
          className="w-full accent-[var(--teal)]"
          aria-label="As-of date"
        />
        <div className="flex justify-between font-mono text-[10px] text-ink-soft">
          <span>{fmtDate(j.project.started)}</span>
          <span className="text-teal">as of {asOfDate.toISOString().slice(0, 10)}</span>
          <span>today</span>
        </div>
      </div>

      {/* Who is on the project as-of */}
      <div>
        <div className="h-label text-gold">On the project ({activeSpans.length})</div>
        <ul className="mt-1 space-y-0.5">
          {activeSpans.map((s) => (
            <li key={s.id} className="flex justify-between text-xs">
              <span>{s.display_name}</span>
              <span className="font-mono text-ink-soft">
                {s.type_label}
                {s.valid_from ? ` · ${fmtDate(s.valid_from)} → ${s.valid_to ? fmtDate(s.valid_to) : "open"}` : ""}
              </span>
            </li>
          ))}
          {activeSpans.length === 0 && <li className="h-caption text-xs">No one yet at this date.</li>}
        </ul>
      </div>

      {/* What happened up to as-of (labels straight from the events) */}
      <div>
        <div className="h-label text-gold">
          Moments ({visibleMoments.length} of {j.moments.length})
        </div>
        <ol className="mt-1 max-h-44 space-y-1 overflow-y-auto border-l-2 border-vellum pl-2.5">
          {visibleMoments.slice(-14).map((m) => (
            <li key={m.id} className="text-xs">
              <span className="font-mono text-ink-soft">
                {new Date(m.created_at).toISOString().slice(0, 10)}
              </span>{" "}
              <span className="font-mono text-teal">{m.verb}</span>
              {m.amount && <span className="font-mono"> ${Number(m.amount).toLocaleString()}</span>}
              {m.memo && <span className="text-ink-soft"> — {m.memo}</span>}
            </li>
          ))}
          {visibleMoments.length === 0 && (
            <li className="h-caption text-xs">Nothing recorded yet at this date.</li>
          )}
        </ol>
      </div>
    </div>
  );
}
