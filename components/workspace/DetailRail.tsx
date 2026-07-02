"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { BudgetSlot } from "@/components/rail/BudgetSlot";
import { JourneySlot } from "@/components/rail/JourneySlot";
import { getJson, fmtDate, type Me, type ProjectDetail } from "./types";

// Project detail as a slide-over rail — context without leaving the grid.
export function DetailRail({
  projectId,
  me,
  onClose,
}: {
  projectId: string;
  me: Me | null;
  onClose: () => void;
}) {
  const [detail, setDetail] = useState<ProjectDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [uploadState, setUploadState] = useState<string | null>(null);
  const [docType, setDocType] = useState("agreement");
  const [minRole, setMinRole] = useState("");
  const uploadRef = useRef<HTMLInputElement>(null);

  const load = useCallback(() => {
    getJson<ProjectDetail>(`/api/projects/${projectId}/detail`)
      .then(setDetail)
      .catch((e) => setError(e.message));
  }, [projectId]);

  useEffect(() => {
    setDetail(null);
    setError(null);
    load();
  }, [load]);

  const upload = useCallback(
    async (file: File) => {
      setUploadState("Uploading…");
      const form = new FormData();
      form.append("file", file);
      form.append("doc_type", docType);
      form.append("min_role_visibility", minRole);
      const res = await fetch(`/api/projects/${projectId}/documents`, {
        method: "POST",
        body: form,
      });
      const data = await res.json();
      setUploadState(res.ok ? `Filed "${file.name}" — logged.` : data.error ?? "Upload failed");
      if (res.ok) load();
    },
    [projectId, docType, minRole, load]
  );

  const activeContacts = detail?.contacts.filter((c) => c.effective_status === "active") ?? [];
  const inactiveContacts = detail?.contacts.filter((c) => c.effective_status !== "active") ?? [];

  return (
    <div className="fixed inset-0 z-40" role="dialog" aria-label="Project detail">
      <div className="absolute inset-0 bg-ink/20" onClick={onClose} />
      <aside className="absolute right-0 top-0 h-full w-[420px] max-w-[92vw] overflow-y-auto border-l border-vellum bg-cream shadow-xl">
        <header className="sticky top-0 flex items-start justify-between gap-3 border-b border-vellum bg-parchment px-5 py-4">
          <div>
            <div className="h-label text-gold">Project</div>
            <h2 className="h-display text-lg leading-tight">
              {detail?.project.name ?? "Loading…"}
            </h2>
            {detail && (
              <div className="mt-1 flex items-center gap-2">
                <span
                  className={`flag-chip ${detail.project.status === "active" ? "flag-good" : "flag-bad"}`}
                >
                  {detail.project.status}
                </span>
                {detail.project.group_name && (
                  <span className="h-caption text-sm">{detail.project.group_name}</span>
                )}
              </div>
            )}
          </div>
          <button className="btn btn-quiet" onClick={onClose}>
            Close
          </button>
        </header>

        {error && <p className="px-5 py-4 text-sm text-rust">{error}</p>}

        {detail && (
          <div className="space-y-5 px-5 py-4">
            {/* Address card */}
            <section className="well p-4">
              <div className="h-label mb-2 text-gold">Address</div>
              {detail.address ? (
                <>
                  {detail.address.raw_input && (
                    <p className="h-caption mb-2 text-sm">“{detail.address.raw_input}”</p>
                  )}
                  <dl className="grid grid-cols-[92px_1fr] gap-y-1 font-mono text-xs">
                    <dt className="text-ink-soft">street</dt>
                    <dd>{detail.address.street ?? "—"}</dd>
                    <dt className="text-ink-soft">city</dt>
                    <dd>
                      {detail.address.city ?? "—"}
                      {detail.address.region ? `, ${detail.address.region}` : ""}
                      {detail.address.postal ? ` ${detail.address.postal}` : ""}
                    </dd>
                    <dt className="text-ink-soft">provider</dt>
                    <dd>{detail.address.provider ?? "unverified"}</dd>
                    <dt className="text-ink-soft">place_id</dt>
                    <dd className="break-all">{detail.address.place_id ?? "—"}</dd>
                    <dt className="text-ink-soft">verified</dt>
                    <dd>{fmtDate(detail.address.verified_at)}</dd>
                  </dl>
                </>
              ) : (
                <p className="h-caption text-sm">No address on record.</p>
              )}
            </section>

            {/* Contacts */}
            <section className="well p-4">
              <div className="h-label mb-2 text-gold">
                Contacts — {activeContacts.length} active
              </div>
              <ul className="space-y-2">
                {activeContacts.map((c) => (
                  <li key={c.id} className="flex items-baseline justify-between gap-2 text-sm">
                    <span>{c.display_name}</span>
                    <span className="font-mono text-xs text-ink-soft">
                      {c.type_label}
                      {c.valid_from || c.valid_to
                        ? ` · ${fmtDate(c.valid_from)} → ${c.valid_to ? fmtDate(c.valid_to) : "open"}`
                        : ""}
                    </span>
                  </li>
                ))}
                {activeContacts.length === 0 && (
                  <li className="h-caption text-sm">No active contacts.</li>
                )}
              </ul>
              {inactiveContacts.length > 0 && (
                <details className="mt-3">
                  <summary className="h-label cursor-pointer text-rust">
                    {inactiveContacts.length} inactive — history
                  </summary>
                  <ul className="mt-2 space-y-2">
                    {inactiveContacts.map((c) => (
                      <li
                        key={c.id}
                        className="flex items-baseline justify-between gap-2 text-sm text-ink-soft"
                      >
                        <span>{c.display_name}</span>
                        <span className="font-mono text-xs">
                          {c.type_label} · {fmtDate(c.valid_from)} → {fmtDate(c.valid_to)}
                        </span>
                      </li>
                    ))}
                  </ul>
                </details>
              )}
            </section>

            {/* Documents: upload through the storage seam; list + download
                both enforce min_role_visibility and module gates via RLS. */}
            <section className="well p-4">
              <div className="h-label mb-2 text-gold">Documents</div>
              <ul className="space-y-1">
                {detail.documents.map((d) => (
                  <li key={d.id} className="flex items-baseline justify-between gap-2 text-sm">
                    <a className="text-teal underline decoration-vellum underline-offset-2"
                       href={`/api/documents/${d.id}/download`}>
                      {d.title ?? "Untitled"}
                    </a>
                    <span className="font-mono text-xs text-ink-soft">{d.doc_type ?? "—"}</span>
                  </li>
                ))}
                {detail.documents.length === 0 && (
                  <li className="h-caption text-sm">Nothing filed here yet.</li>
                )}
              </ul>
              <div className="mt-3 flex flex-wrap items-center gap-1.5 border-t border-vellum pt-2.5">
                <select className="field !py-1 text-xs" value={docType}
                        onChange={(e) => setDocType(e.target.value)} aria-label="Document type">
                  <option value="agreement">agreement</option>
                  <option value="lease">lease</option>
                  <option value="budgets">budgets</option>
                  <option value="photo">photo</option>
                  <option value="other">other</option>
                </select>
                <select className="field !py-1 text-xs" value={minRole}
                        onChange={(e) => setMinRole(e.target.value)} aria-label="Minimum role">
                  <option value="">everyone</option>
                  <option value="editor">editor+</option>
                  <option value="admin">admin+</option>
                </select>
                <button className="btn btn-quiet !px-2 !py-1" onClick={() => uploadRef.current?.click()}>
                  Upload
                </button>
                <input ref={uploadRef} type="file" className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) upload(f);
                    e.target.value = "";
                  }} />
                {uploadState && <span className="h-label text-sage">{uploadState}</span>}
              </div>
            </section>

            {/* Module slots — live since CODE-E; gated by module_visibility. */}
            {(me?.journey_visible ?? true) && (
              <section className="well p-4">
                <div className="h-label mb-2 text-gold">Journey</div>
                <JourneySlot projectId={projectId} />
              </section>
            )}
            {(me?.budget_visible ?? true) && (
              <section className="well p-4">
                <div className="h-label mb-2 text-gold">Budget</div>
                <BudgetSlot projectId={projectId} />
              </section>
            )}
          </div>
        )}
      </aside>
    </div>
  );
}
