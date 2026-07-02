"use client";

import { useCallback, useState } from "react";
import { sendJson } from "@/components/workspace/types";
import { PreviewPanel } from "./PreviewPanel";
import type { Bundle, CommitResult, Proposal } from "@/lib/intake/types";

// Path 4: the one-line box in the workspace header. Sentence in, preview out.
// NEVER commits on its own.
export function QuickCapture({ onCommitted }: { onCommitted?: (r: CommitResult) => void }) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<{
    bundle: Bundle;
    proposal: Proposal;
    startedAt: string;
  } | null>(null);

  const capture = useCallback(async () => {
    if (!text.trim()) return;
    setBusy(true);
    setError(null);
    const startedAt = new Date().toISOString();
    try {
      const r = await sendJson<{ bundle: Bundle; proposal: Proposal }>(
        "POST",
        "/api/capture",
        { text }
      );
      setPreview({ bundle: r.bundle, proposal: r.proposal, startedAt });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Capture failed");
    } finally {
      setBusy(false);
    }
  }, [text]);

  return (
    <>
      <div className="flex items-center gap-1.5">
        <input
          className="field w-80"
          placeholder="Quick capture: “New client at 59 Bay Vista, tenant Jane Doe…”"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && capture()}
        />
        <button className="btn btn-quiet" onClick={capture} disabled={busy || !text.trim()}>
          {busy ? "Parsing…" : "Capture"}
        </button>
        {error && <span className="h-label text-rust">{error}</span>}
      </div>

      {preview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" role="dialog">
          <div className="absolute inset-0 bg-ink/20" onClick={() => setPreview(null)} />
          <div className="relative flex max-h-[86vh] w-[880px] max-w-[96vw] flex-col gap-3 overflow-y-auto rounded border border-vellum bg-cream p-5 shadow-xl">
            <header className="flex items-baseline justify-between">
              <div>
                <div className="h-label text-gold">Quick capture — review before commit</div>
                <p className="h-caption mt-1 text-sm">“{text}”</p>
              </div>
              <button className="btn btn-quiet" onClick={() => setPreview(null)}>
                Close
              </button>
            </header>
            <PreviewPanel
              compact
              initialBundle={preview.bundle}
              initialProposal={preview.proposal}
              startedAt={preview.startedAt}
              onCommitted={(r) => {
                setText("");
                onCommitted?.(r);
              }}
            />
          </div>
        </div>
      )}
    </>
  );
}
