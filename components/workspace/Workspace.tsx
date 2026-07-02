"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AgGridReact } from "ag-grid-react";
import { QuickCapture } from "@/components/intake/QuickCapture";
import {
  AllCommunityModule,
  ModuleRegistry,
  type CellValueChangedEvent,
  type ColDef,
  type GridApi,
  type ICellRendererParams,
} from "ag-grid-community";
import { herbariumGridTheme } from "./gridTheme";
import { DetailRail } from "./DetailRail";
import { ReassignDialog } from "./ReassignDialog";
import {
  getJson,
  sendJson,
  type ContactRow,
  type GroupRow,
  type Me,
  type ProjectRow,
  type Recon,
  type UserRow,
} from "./types";

ModuleRegistry.registerModules([AllCommunityModule]);

const TABS = [
  { key: "projects", label: "Projects" },
  { key: "contacts", label: "Contacts" },
  { key: "groups", label: "Groups" },
  { key: "users", label: "Users" },
] as const;
type TabKey = (typeof TABS)[number]["key"];

type AnyRow = ProjectRow | ContactRow | GroupRow | UserRow;
type StatusFilter = "active" | "all" | "inactive";

const PATCH_BASE: Record<TabKey, string> = {
  projects: "/api/projects",
  contacts: "/api/contacts",
  groups: "/api/groups",
  users: "/api/users",
};

// ---------- cell renderers ----------

function StatusChipCell(p: ICellRendererParams) {
  if (p.value == null) return null;
  return (
    <span className={`flag-chip ${p.value === "active" ? "flag-good" : "flag-bad"}`}>
      {String(p.value)}
    </span>
  );
}

function RowActionsCell(p: ICellRendererParams) {
  const ctx = p.context as {
    tab: TabKey;
    onToggleStatus: (row: AnyRow) => void;
    onOpenRail: (row: ProjectRow) => void;
  };
  const status = (p.data as { status?: string }).status;
  return (
    <div className="flex h-full items-center gap-1.5">
      {ctx.tab === "projects" && (
        <button className="btn btn-quiet !px-2 !py-0.5" onClick={() => ctx.onOpenRail(p.data)}>
          Detail
        </button>
      )}
      {status != null && (
        <button
          className={`btn !px-2 !py-0.5 ${status === "active" ? "btn-rust" : "btn-quiet"}`}
          onClick={() => ctx.onToggleStatus(p.data)}
        >
          {status === "active" ? "Set inactive" : "Set active"}
        </button>
      )}
    </div>
  );
}

// ---------- recon chip ----------

function ReconChip({ recon }: { recon: Recon | undefined }) {
  if (!recon) {
    return <span className="flag-chip">no expected count</span>;
  }
  const diff = recon.expected - recon.actual;
  if (diff === 0) {
    return (
      <span className="flag-chip flag-good">
        {recon.actual} of {recon.expected} expected
      </span>
    );
  }
  return (
    <span className="flag-chip flag-warn">
      {recon.actual} of {recon.expected} —{" "}
      {diff > 0 ? `${diff} missing` : `${-diff} over`}
    </span>
  );
}

// ---------- the workspace ----------

export function Workspace() {
  const [tab, setTab] = useState<TabKey>("projects");
  const [me, setMe] = useState<Me | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);
  const [recon, setRecon] = useState<Recon[]>([]);
  const [projects, setProjects] = useState<ProjectRow[]>([]);
  const [contacts, setContacts] = useState<ContactRow[]>([]);
  const [groups, setGroups] = useState<GroupRow[]>([]);
  const [users, setUsers] = useState<UserRow[]>([]);

  const [statusFilter, setStatusFilter] = useState<StatusFilter>("active");
  const [groupFilter, setGroupFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [quick, setQuick] = useState("");

  const [selected, setSelected] = useState<AnyRow[]>([]);
  const [railProjectId, setRailProjectId] = useState<string | null>(null);
  const [reassignContact, setReassignContact] = useState<ContactRow | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const gridApi = useRef<GridApi | null>(null);

  const refreshAll = useCallback(async () => {
    const [p, c, g, u, r] = await Promise.all([
      getJson<ProjectRow[]>("/api/projects"),
      getJson<ContactRow[]>("/api/contacts"),
      getJson<GroupRow[]>("/api/groups"),
      getJson<UserRow[]>("/api/users"),
      getJson<Recon[]>("/api/recon"),
    ]);
    setProjects(p);
    setContacts(c);
    setGroups(g);
    setUsers(u);
    setRecon(r);
  }, []);

  useEffect(() => {
    getJson<Me>("/api/me")
      .then((m) => {
        setMe(m);
        return refreshAll();
      })
      .catch((e) => setAuthError(e.message));
  }, [refreshAll]);

  const say = useCallback((message: string) => {
    setNotice(message);
    window.setTimeout(() => setNotice((n) => (n === message ? null : n)), 6000);
  }, []);

  // ----- row actions -----

  const onToggleStatus = useCallback(
    async (row: AnyRow) => {
      const current = (row as { status?: string }).status;
      const next = current === "active" ? "inactive" : "active";
      try {
        await sendJson("PATCH", `${PATCH_BASE[tab]}/${row.id}`, { status: next });
        say(`Set ${next} — logged.`);
        await refreshAll();
      } catch (e) {
        say(e instanceof Error ? e.message : "Update failed");
      }
    },
    [tab, refreshAll, say]
  );

  const onOpenRail = useCallback((row: ProjectRow) => setRailProjectId(row.id), []);

  const onCellValueChanged = useCallback(
    async (e: CellValueChangedEvent) => {
      const field = e.colDef.field;
      if (!field || e.newValue === e.oldValue) return;
      try {
        await sendJson("PATCH", `${PATCH_BASE[tab]}/${e.data.id}`, {
          [field]: e.newValue,
        });
        say(`Saved ${field} — logged.`);
        await refreshAll();
      } catch (err) {
        say(err instanceof Error ? err.message : "Save failed");
        await refreshAll(); // revert the optimistic grid edit
      }
    },
    [tab, refreshAll, say]
  );

  const bulkStatus = useCallback(
    async (status: "active" | "inactive") => {
      try {
        const result = await sendJson<{ updated: number }>("POST", "/api/bulk/status", {
          entity: tab,
          ids: selected.map((r) => r.id),
          status,
        });
        gridApi.current?.deselectAll();
        say(`${result.updated} set ${status} — logged.`);
        await refreshAll();
      } catch (e) {
        say(e instanceof Error ? e.message : "Bulk update failed");
      }
    },
    [tab, selected, refreshAll, say]
  );

  // ----- rows through filters -----

  const statusOk = useCallback(
    (s: string) => statusFilter === "all" || s === statusFilter,
    [statusFilter]
  );

  const rows: AnyRow[] = useMemo(() => {
    switch (tab) {
      case "projects":
        return projects.filter(
          (r) => statusOk(r.status) && (!groupFilter || r.group_id === groupFilter)
        );
      case "contacts":
        return contacts.filter(
          (r) => statusOk(r.status) && (!typeFilter || r.types.includes(typeFilter))
        );
      case "groups":
        return groups;
      case "users":
        return users.filter((r) => statusOk(r.status));
    }
  }, [tab, projects, contacts, groups, users, statusOk, groupFilter, typeFilter]);

  // ----- column defs -----

  const columnDefs: ColDef[] = useMemo(() => {
    const status: ColDef = {
      field: "status",
      width: 130,
      cellRenderer: StatusChipCell,
    };
    const actions: ColDef = {
      headerName: "Actions",
      width: 210,
      sortable: false,
      cellRenderer: RowActionsCell,
    };
    switch (tab) {
      case "projects":
        return [
          { field: "name", flex: 2, editable: true },
          { field: "group_name", headerName: "Group", flex: 1 },
          {
            headerName: "Location",
            flex: 1.4,
            valueGetter: (p) =>
              [p.data.street, p.data.city].filter(Boolean).join(", ") || "—",
          },
          {
            field: "active_contacts",
            headerName: "Contacts",
            width: 110,
            cellClass: "font-mono",
          },
          status,
          actions,
        ];
      case "contacts":
        return [
          { field: "display_name", headerName: "Name", flex: 1.6, editable: true },
          { field: "kind", width: 95, cellClass: "font-mono" },
          {
            field: "types",
            headerName: "Types",
            flex: 1.2,
            cellClass: "font-mono",
            valueFormatter: (p) => (p.value as string[])?.join(", ") ?? "",
          },
          {
            field: "preferred_contact_method",
            headerName: "Reach by",
            width: 110,
            editable: true,
            cellClass: "font-mono",
          },
          {
            field: "active_assignments",
            headerName: "Assignments",
            width: 130,
            cellClass: "font-mono",
          },
          status,
          actions,
        ];
      case "groups":
        return [
          { field: "name", flex: 2, editable: true },
          { field: "group_kind", headerName: "Kind", flex: 1, cellClass: "font-mono" },
          {
            field: "project_count",
            headerName: "Projects",
            width: 120,
            cellClass: "font-mono",
          },
        ];
      case "users":
        return [
          { field: "display_name", headerName: "Name", flex: 1.5, editable: true },
          { field: "email", flex: 1.5 },
          {
            field: "roles",
            flex: 1,
            cellClass: "font-mono",
            valueFormatter: (p) => (p.value as string[])?.join(", ") ?? "",
          },
          status,
          actions,
        ];
    }
  }, [tab]);

  const tabRecon = recon.find((r) => r.entity === tab);
  const selectable = tab !== "groups";

  if (authError) {
    return (
      <main className="mx-auto mt-24 max-w-lg">
        <div className="well p-6">
          <h1 className="h-display text-xl">Not signed in</h1>
          <p className="mt-2 text-sm">
            Configure Auth0 (AUTH0_* in .env.local) or run locally with{" "}
            <code className="font-mono">DEV_BYPASS=true</code> and the seeded dev database
            (<code className="font-mono">scripts/db-dev.sh</code>).
          </p>
          <p className="h-caption mt-2 text-sm">{authError}</p>
        </div>
      </main>
    );
  }

  return (
    <div className="flex h-screen flex-col">
      {/* Masthead */}
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-vellum bg-parchment px-6 py-3">
        <div className="flex items-baseline gap-4">
          <h1 className="h-display text-lg tracking-wide">
            Knowledge Gardens
          </h1>
          <span className="h-label text-gold">Workspace</span>
          <Link href="/workspace/import" className="h-label text-teal">
            Import
          </Link>
        </div>
        <QuickCapture
          onCommitted={async (r) => {
            say(
              `${r.records_created + r.records_updated} records captured — logged.`
            );
            await refreshAll();
          }}
        />
        <div className="h-label text-ink-soft">
          {me ? `${me.display_name} · ${me.client_name}` : "…"}
        </div>
      </header>

      {/* Tabs */}
      <nav className="flex gap-1 border-b border-vellum bg-parchment px-6">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => {
              setTab(t.key);
              setSelected([]);
              setQuick("");
            }}
            className={`h-label border-b-2 px-4 py-2.5 transition-colors ${
              tab === t.key
                ? "border-teal text-teal"
                : "border-transparent text-ink-soft hover:text-ink"
            }`}
          >
            {t.label}
          </button>
        ))}
      </nav>

      {/* Grid header: recon chip + filters */}
      <div className="flex flex-wrap items-center gap-3 px-6 py-3">
        <ReconChip recon={tabRecon} />
        <span className="h-caption text-sm">
          {rows.length} showing
        </span>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <input
            className="field w-52"
            placeholder="Search this grid…"
            value={quick}
            onChange={(e) => setQuick(e.target.value)}
          />
          {tab !== "groups" && (
            <select
              className="field"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
              aria-label="Status filter"
            >
              <option value="active">Active only</option>
              <option value="inactive">Inactive only</option>
              <option value="all">Active + inactive</option>
            </select>
          )}
          {tab === "projects" && (
            <select
              className="field"
              value={groupFilter}
              onChange={(e) => setGroupFilter(e.target.value)}
              aria-label="Group filter"
            >
              <option value="">All groups</option>
              {groups.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </select>
          )}
          {tab === "contacts" && (
            <select
              className="field"
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              aria-label="Contact type filter"
            >
              <option value="">All types</option>
              {[...new Set(contacts.flatMap((c) => c.types))].sort().map((code) => (
                <option key={code} value={code}>
                  {code}
                </option>
              ))}
            </select>
          )}
        </div>
      </div>

      {/* Bulk bar */}
      {selected.length > 0 && (
        <div className="mx-6 mb-2 flex items-center gap-3 rounded border border-teal bg-parchment px-4 py-2">
          <span className="h-label text-teal">{selected.length} selected</span>
          <button className="btn btn-quiet" onClick={() => bulkStatus("active")}>
            Set active
          </button>
          <button className="btn btn-rust" onClick={() => bulkStatus("inactive")}>
            Set inactive
          </button>
          {tab === "contacts" && selected.length === 1 && (
            <button
              className="btn"
              onClick={() => setReassignContact(selected[0] as ContactRow)}
            >
              Reassign assignments…
            </button>
          )}
          <button
            className="h-label ml-auto text-ink-soft hover:text-ink"
            onClick={() => gridApi.current?.deselectAll()}
          >
            Clear
          </button>
        </div>
      )}

      {/* Notice line */}
      {notice && (
        <div className="px-6 pb-2">
          <span className="h-label text-sage">{notice}</span>
        </div>
      )}

      {/* The grid */}
      <div className="min-h-0 flex-1 px-6 pb-6">
        <AgGridReact
          key={tab}
          theme={herbariumGridTheme}
          rowData={rows}
          columnDefs={columnDefs}
          getRowId={(p) => p.data.id}
          quickFilterText={quick}
          defaultColDef={{ sortable: true, resizable: true }}
          rowSelection={
            selectable
              ? {
                  mode: "multiRow",
                  checkboxes: true,
                  headerCheckbox: true,
                  enableClickSelection: false,
                }
              : undefined
          }
          context={{ tab, onToggleStatus, onOpenRail }}
          onGridReady={(e) => {
            gridApi.current = e.api;
          }}
          onSelectionChanged={(e) => setSelected(e.api.getSelectedRows())}
          onCellValueChanged={onCellValueChanged}
        />
      </div>

      {railProjectId && (
        <DetailRail
          projectId={railProjectId}
          me={me}
          onClose={() => setRailProjectId(null)}
        />
      )}
      {reassignContact && (
        <ReassignDialog
          contact={reassignContact}
          contacts={contacts}
          onClose={() => setReassignContact(null)}
          onDone={async (message) => {
            setReassignContact(null);
            gridApi.current?.deselectAll();
            say(message);
            await refreshAll();
          }}
        />
      )}
    </div>
  );
}
