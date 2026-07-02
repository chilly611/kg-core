"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { PreviewPanel } from "@/components/intake/PreviewPanel";
import { SingleAdd } from "@/components/intake/SingleAdd";
import { getJson, sendJson, type Recon } from "@/components/workspace/types";
import type { Bundle, CommitResult, Proposal } from "@/lib/intake/types";

type Loaded = {
  bundle: Bundle;
  proposal: Proposal;
  startedAt: string;
  title: string;
};

// The intake screen: three ways in, one review pattern, and the
// reconciliation contract ("how many should exist?") right where you import.
export default function ImportPage() {
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [recon, setRecon] = useState<Recon[]>([]);
  const [expected, setExpected] = useState<{ projects: string; contacts: string }>({
    projects: "",
    contacts: "",
  });
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const vcfRef = useRef<HTMLInputElement>(null);

  const refreshRecon = useCallback(async () => {
    const r = await getJson<Recon[]>("/api/recon");
    setRecon(r);
    const p = r.find((x) => x.entity === "projects");
    const c = r.find((x) => x.entity === "contacts");
    setExpected({
      projects: p ? String(p.expected) : "",
      contacts: c ? String(c.expected) : "",
    });
  }, []);

  useEffect(() => {
    refreshRecon().catch((e) => setError(e.message));
  }, [refreshRecon]);

  const uploadTo = useCallback(
    async (endpoint: string, file: File, title: string) => {
      setError(null);
      const startedAt = new Date().toISOString(); // the leverage clock starts at drop
      const form = new FormData();
      form.append("file", file);
      const res = await fetch(endpoint, { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Upload failed");
        return;
      }
      setLoaded({ bundle: data.bundle, proposal: data.proposal, startedAt, title });
    },
    []
  );

  const onDrop = useCallback(
    (endpoint: string, title: string) => (e: React.DragEvent) => {
      e.preventDefault();
      const file = e.dataTransfer.files?.[0];
      if (file) uploadTo(endpoint, file, `${title}: ${file.name}`);
    },
    [uploadTo]
  );

  const saveExpected = useCallback(async () => {
    setError(null);
    try {
      await sendJson("POST", "/api/expected", {
        ...(expected.projects !== "" ? { projects: Number(expected.projects) } : {}),
        ...(expected.contacts !== "" ? { contacts: Number(expected.contacts) } : {}),
      });
      await refreshRecon();
      setNotice("Expected counts saved — chips updated everywhere.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    }
  }, [expected, refreshRecon]);

  const onCommitted = useCallback(
    (r: CommitResult) => {
      refreshRecon();
      setNotice(
        `${r.records_created + r.records_updated} records in ${
          r.user_active_seconds != null
            ? `${Math.floor(r.user_active_seconds / 60)}m ${r.user_active_seconds % 60}s`
            : "—"
        } of your time.`
      );
    },
    [refreshRecon]
  );

  const chip = (entity: string) => {
    const r = recon.find((x) => x.entity === entity);
    if (!r) return <span className="flag-chip">no expected count</span>;
    const diff = r.expected - r.actual;
    return (
      <span className={`flag-chip ${diff === 0 ? "flag-good" : "flag-warn"}`}>
        {r.actual} of {r.expected}
        {diff !== 0 && (diff > 0 ? ` — ${diff} missing` : ` — ${-diff} over`)}
      </span>
    );
  };

  return (
    <div className="flex min-h-screen flex-col">
      <header className="flex items-baseline justify-between border-b border-vellum bg-parchment px-6 py-3">
        <div className="flex items-baseline gap-4">
          <h1 className="h-display text-lg">Import</h1>
          <span className="h-caption text-sm">give me a spreadsheet — boom, projects created</span>
        </div>
        <Link href="/workspace" className="h-label text-teal">
          ← Workspace
        </Link>
      </header>

      <div className="grid gap-4 px-6 py-4 md:grid-cols-3">
        {/* Path 1: template */}
        <section
          className="well cursor-pointer p-4 text-center"
          onDragOver={(e) => e.preventDefault()}
          onDrop={onDrop("/api/intake/upload", "Template")}
          onClick={() => fileRef.current?.click()}
        >
          <div className="h-label text-gold">Template import</div>
          <p className="mt-2 text-sm">Drop .xlsx / .csv here (or click)</p>
          <p className="h-caption mt-1 text-xs">
            groups → addresses → projects → contacts → leases, deduped
          </p>
          <input
            ref={fileRef}
            type="file"
            accept=".xlsx,.csv"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) uploadTo("/api/intake/upload", f, `Template: ${f.name}`);
              e.target.value = "";
            }}
          />
        </section>

        {/* Path 2: vcf */}
        <section
          className="well cursor-pointer p-4 text-center"
          onDragOver={(e) => e.preventDefault()}
          onDrop={onDrop("/api/intake/vcf", "Contact card")}
          onClick={() => vcfRef.current?.click()}
        >
          <div className="h-label text-gold">Contact card</div>
          <p className="mt-2 text-sm">Drop an iPhone .vcf (or a batch)</p>
          <p className="h-caption mt-1 text-xs">unknown fields kept in attrs — nothing lost</p>
          <input
            ref={vcfRef}
            type="file"
            accept=".vcf,text/vcard"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) uploadTo("/api/intake/vcf", f, `Contact card: ${f.name}`);
              e.target.value = "";
            }}
          />
        </section>

        {/* Path 3: single add */}
        <section className="well p-4">
          <div className="h-label mb-2 text-gold">Single add</div>
          <SingleAdd
            onProposal={(bundle, proposal, startedAt) =>
              setLoaded({ bundle, proposal, startedAt, title: "Single add" })
            }
          />
        </section>
      </div>

      {/* Reconciliation contract */}
      <div className="mx-6 mb-4 flex flex-wrap items-center gap-3 rounded border border-vellum bg-parchment px-4 py-3">
        <span className="h-label text-gold">How many should exist?</span>
        <label className="flex items-center gap-1.5 text-sm">
          projects
          <input
            className="field w-20"
            type="number"
            min={0}
            value={expected.projects}
            onChange={(e) => setExpected({ ...expected, projects: e.target.value })}
          />
        </label>
        <label className="flex items-center gap-1.5 text-sm">
          contacts
          <input
            className="field w-20"
            type="number"
            min={0}
            value={expected.contacts}
            onChange={(e) => setExpected({ ...expected, contacts: e.target.value })}
          />
        </label>
        <button className="btn btn-quiet" onClick={saveExpected}>
          Save
        </button>
        <span className="ml-2">{chip("projects")}</span>
        <span>{chip("contacts")}</span>
        {notice && <span className="h-label ml-auto text-sage">{notice}</span>}
      </div>

      {error && <p className="px-6 pb-2 text-sm text-rust">{error}</p>}

      {/* The one review pattern */}
      {loaded && (
        <div className="flex min-h-0 flex-1 flex-col gap-2 px-6 pb-6">
          <div className="h-label text-gold">{loaded.title} — review before commit</div>
          <PreviewPanel
            key={loaded.startedAt}
            initialBundle={loaded.bundle}
            initialProposal={loaded.proposal}
            startedAt={loaded.startedAt}
            onCommitted={onCommitted}
          />
        </div>
      )}
    </div>
  );
}
