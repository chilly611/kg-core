import type { Rls } from "./db";
import { logEvent } from "./db";
import { phoneDigits } from "@/lib/intake/normalize";
import type {
  Bundle,
  CommitResult,
  Proposal,
  ProposalRow,
} from "@/lib/intake/types";

// The one review pattern: plan diffs a Bundle against the (RLS-scoped)
// database into a Proposal; commit applies a (possibly user-edited) Proposal
// in a single transaction. No path auto-commits.

// ---------------------------------------------------------------- helpers

const low = (v: unknown) => String(v ?? "").trim().toLowerCase();

function addrKey(street: unknown, city: unknown, postal: unknown): string {
  return [low(street), low(city), low(postal)].join("|");
}

type ExistingContact = {
  id: string;
  display_name: string;
  emails: Array<{ label?: string; value: string }>;
  phones: Array<{ label?: string; value: string }>;
  preferred_contact_method: string | null;
};

// Validation shared by plan and commit — commit re-checks after inline fixes.
export function rowIssues(row: ProposalRow): string[] {
  const issues: string[] = [];
  const d = row.data as Record<string, string | null | undefined>;
  switch (row.entity) {
    case "group":
      if (!low(d.name)) issues.push("Group needs a name");
      break;
    case "project": {
      if (!low(d.name)) issues.push("Project needs a name");
      break;
    }
    case "address": {
      if (!low(d.street) && !low(d.city) && !low(d.region) && !low(d.postal)) {
        issues.push("Address needs at least one jurisdiction part (street, city, region or postal)");
      }
      break;
    }
    case "contact":
      if (!low(d.display_name)) issues.push("Contact needs a name");
      break;
    case "link": {
      const start = d.lease_start ?? null;
      const end = d.lease_end ?? null;
      const dateOk = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s);
      if (start && !dateOk(String(start))) issues.push(`Unreadable lease_start "${start}" — use YYYY-MM-DD`);
      if (end && !dateOk(String(end))) issues.push(`Unreadable lease_end "${end}" — use YYYY-MM-DD`);
      if (start && end && dateOk(String(start)) && dateOk(String(end)) && String(start) > String(end)) {
        issues.push("lease_start is after lease_end");
      }
      break;
    }
  }
  return issues;
}

// ---------------------------------------------------------------- plan

export async function planBundle(
  q: Rls,
  bundle: Bundle,
  source: Proposal["source"]
): Promise<Proposal> {
  const rows: ProposalRow[] = [];

  const [groups, addresses, projects, contacts, types, links] = await Promise.all([
    q.query(`select id, name, group_kind from public.groups`),
    q.query(`select id, street, city, postal, place_id from public.addresses`),
    q.query(`select id, name, attrs from public.projects`),
    q.query(
      `select id, display_name, emails, phones, preferred_contact_method from public.contacts`
    ),
    q.query(`select id, code, label, status, category from public.contact_types`),
    q.query(
      `select id, project_id, contact_id, contact_type_id, valid_from::text, valid_to::text
       from public.project_contacts`
    ),
  ]).then((results) => results.map((r) => r.rows));

  // groups
  const groupIdByKey = new Map<string, string | null>();
  for (const g of bundle.groups) {
    const match = groups.find((x) => low(x.name) === low(g.name));
    groupIdByKey.set(g.key, match?.id ?? null);
    const kindChanges = g.group_kind && match && match.group_kind !== g.group_kind;
    const row: ProposalRow = {
      key: g.key,
      entity: "group",
      action: match ? (kindChanges ? "update" : "unchanged") : "create",
      label: g.name,
      detail: match
        ? kindChanges
          ? `kind: ${match.group_kind ?? "—"} → ${g.group_kind}`
          : "already on record"
        : `new group (${g.group_kind ?? "kind unset"})`,
      issues: [],
      matchId: match?.id ?? null,
      skip: false,
      refs: {},
      data: { name: g.name, group_kind: g.group_kind ?? null },
    };
    row.issues = rowIssues(row);
    if (row.issues.length) row.action = "error";
    rows.push(row);
  }

  // addresses
  const addressIdByKey = new Map<string, string | null>();
  for (const a of bundle.addresses) {
    const match =
      (a.place_id && addresses.find((x) => x.place_id === a.place_id)) ||
      addresses.find((x) => addrKey(x.street, x.city, x.postal) === addrKey(a.street, a.city, a.postal));
    addressIdByKey.set(a.key, match?.id ?? null);
    const label = [a.street, a.city].filter(Boolean).join(", ") || a.raw_input || "(address)";
    const row: ProposalRow = {
      key: a.key,
      entity: "address",
      action: match ? "unchanged" : "create",
      label,
      detail: match
        ? "already on record"
        : a.street
          ? "new address"
          : "new address — no street (concept ok)",
      issues: [],
      matchId: match?.id ?? null,
      skip: false,
      refs: {},
      data: {
        street: a.street ?? null,
        city: a.city ?? null,
        region: a.region ?? null,
        postal: a.postal ?? null,
        country: a.country ?? null,
        place_id: a.place_id ?? null,
        provider: a.provider ?? null,
        raw_input: a.raw_input ?? null,
        lat: a.lat ?? null,
        lng: a.lng ?? null,
        normalized: a.normalized ?? null,
        verified: a.verified ?? false,
      },
    };
    row.issues = rowIssues(row);
    if (row.issues.length) row.action = "error";
    rows.push(row);
  }

  // projects
  const projectIdByKey = new Map<string, string | null>();
  for (const p of bundle.projects) {
    const match = projects.find((x) => low(x.name) === low(p.name));
    projectIdByKey.set(p.key, match?.id ?? null);
    const notesChange =
      p.notes && match && (match.attrs?.notes ?? null) !== p.notes;
    const row: ProposalRow = {
      key: p.key,
      entity: "project",
      action: match ? (notesChange ? "update" : "unchanged") : "create",
      label: p.name,
      detail: match
        ? notesChange
          ? "notes change"
          : "already on record"
        : "new project",
      issues: [],
      matchId: match?.id ?? null,
      skip: false,
      refs: {
        ...(p.groupKey ? { groupKey: p.groupKey } : {}),
        ...(p.addressKey ? { addressKey: p.addressKey } : {}),
      },
      data: { name: p.name, notes: p.notes ?? null },
    };
    row.issues = rowIssues(row);
    // Jurisdiction rule: a NEW project must arrive with at least one address part.
    if (!match && !p.addressKey) {
      row.issues.push("Project needs an address with at least one jurisdiction part");
    }
    if (row.issues.length) row.action = "error";
    rows.push(row);
  }

  // contacts
  const contactIdByKey = new Map<string, string | null>();
  const existingContacts = contacts as ExistingContact[];
  for (const c of bundle.contacts) {
    const email = c.email ? low(c.email) : null;
    const digits = phoneDigits(c.phone);
    const match =
      (email &&
        existingContacts.find((x) => (x.emails ?? []).some((e) => low(e.value) === email))) ||
      (digits &&
        existingContacts.find((x) =>
          (x.phones ?? []).some((ph) => phoneDigits(ph.value) === digits)
        )) ||
      existingContacts.find((x) => low(x.display_name) === low(c.display_name)) ||
      null;
    contactIdByKey.set(c.key, match?.id ?? null);

    const additions: string[] = [];
    if (match) {
      if (email && !(match.emails ?? []).some((e) => low(e.value) === email)) additions.push("email");
      if (digits && !(match.phones ?? []).some((ph) => phoneDigits(ph.value) === digits))
        additions.push("phone");
      if (c.preferred_contact_method && match.preferred_contact_method !== c.preferred_contact_method)
        additions.push("reach-by");
      if (c.attrs && Object.keys(c.attrs).length) additions.push("attrs");
    }
    const row: ProposalRow = {
      key: c.key,
      entity: "contact",
      action: match ? (additions.length ? "update" : "unchanged") : "create",
      label: c.display_name,
      detail: match
        ? additions.length
          ? `adds ${additions.join(", ")}`
          : "already on record"
        : `new ${c.kind ?? "person"}`,
      issues: [],
      matchId: match?.id ?? null,
      skip: false,
      refs: {},
      data: {
        display_name: c.display_name,
        kind: c.kind ?? "person",
        email: c.email ?? null,
        phone: c.phone ?? null,
        preferred_contact_method: c.preferred_contact_method ?? null,
        attrs: c.attrs ?? null,
      },
    };
    row.issues = rowIssues(row);
    if (row.issues.length) row.action = "error";
    rows.push(row);
  }

  // contact types (unknown -> DRAFT proposal, the Rubicon queue)
  const typeIdByCode = new Map<string, string>();
  for (const t of types) typeIdByCode.set(low(t.code), t.id);
  const unknownTypes = new Map<string, ProposalRow>();
  for (const l of bundle.links) {
    const code = low(l.contact_type);
    if (!code || typeIdByCode.has(code)) continue;
    const labelMatch = types.find((t) => low(t.label) === code);
    if (labelMatch) {
      typeIdByCode.set(code, labelMatch.id);
      continue;
    }
    if (!unknownTypes.has(code)) {
      unknownTypes.set(code, {
        key: `t:${code}`,
        entity: "contact_type",
        action: "create",
        label: code,
        detail: "unknown type — created as DRAFT for review (Rubicon queue)",
        issues: [],
        matchId: null,
        skip: false,
        refs: {},
        data: { code, label: code.replace(/_/g, " ") },
      });
    }
  }
  rows.push(...unknownTypes.values());

  // links
  for (const l of bundle.links) {
    const projectId = projectIdByKey.get(l.projectKey) ?? null;
    const contactId = contactIdByKey.get(l.contactKey) ?? null;
    const typeId = typeIdByCode.get(low(l.contact_type)) ?? null;
    const projectLabel =
      bundle.projects.find((p) => p.key === l.projectKey)?.name ?? "?";
    const contactLabel =
      bundle.contacts.find((c) => c.key === l.contactKey)?.display_name ?? "?";

    const match =
      projectId && contactId && typeId
        ? links.find(
            (x) =>
              x.project_id === projectId &&
              x.contact_id === contactId &&
              x.contact_type_id === typeId
          )
        : null;
    const dateChange =
      match &&
      ((l.lease_start ?? null) !== (match.valid_from ?? null) ||
        (l.lease_end ?? null) !== (match.valid_to ?? null));

    const row: ProposalRow = {
      key: l.key,
      entity: "link",
      action: match ? (dateChange ? "update" : "unchanged") : "create",
      label: `${contactLabel} → ${projectLabel}`,
      detail: match
        ? dateChange
          ? `dates: ${match.valid_from ?? "—"}→${match.valid_to ?? "open"} becomes ${l.lease_start ?? "—"}→${l.lease_end ?? "open"}`
          : "already linked"
        : `${l.contact_type}${l.lease_start ? ` · ${l.lease_start} → ${l.lease_end ?? "open"}` : ""}`,
      issues: [],
      matchId: match?.id ?? null,
      skip: false,
      refs: { projectKey: l.projectKey, contactKey: l.contactKey },
      data: {
        contact_type: low(l.contact_type),
        lease_start: l.lease_start ?? null,
        lease_end: l.lease_end ?? null,
      },
    };
    row.issues = rowIssues(row);
    if (row.issues.length) row.action = "error";
    rows.push(row);
  }

  return { source, rows };
}

// ---------------------------------------------------------------- commit

export async function commitProposal(
  q: Rls,
  proposal: Proposal,
  meta: { startedAt?: string | null }
): Promise<CommitResult> {
  const started = Date.now();
  const active = proposal.rows.filter((r) => !r.skip);

  // Re-validate after inline fixes; anything still broken aborts atomically.
  const stillBroken = active
    .map((r) => ({ key: r.key, label: r.label, issues: rowIssues(r) }))
    .filter((r) => r.issues.length);
  if (stillBroken.length) {
    throw new Error(
      `Fix these rows first: ${stillBroken
        .map((r) => `${r.label}: ${r.issues.join("; ")}`)
        .join(" | ")}`
    );
  }

  let created = 0;
  let updated = 0;
  let drafts = 0;
  const idByKey = new Map<string, string>();
  for (const r of active) if (r.matchId) idByKey.set(r.key, r.matchId);

  const byEntity = (e: ProposalRow["entity"]) => active.filter((r) => r.entity === e);

  // 1. draft contact types
  const typeIdByCode = new Map<string, string>();
  {
    const { rows: types } = await q.query(
      `select id, code, label from public.contact_types`
    );
    for (const t of types) typeIdByCode.set(low(t.code), t.id);
    for (const r of byEntity("contact_type")) {
      const code = low(r.data.code);
      if (typeIdByCode.has(code)) continue;
      const ins = await q.query(
        `insert into public.contact_types (category, code, label, status)
         values (null, $1, $2, 'draft') returning id`,
        [code, String(r.data.label ?? code)]
      );
      typeIdByCode.set(code, ins.rows[0].id);
      drafts++;
      await logEvent(q, {
        verb: "contact_type.drafted",
        targetType: "contact_type",
        targetId: ins.rows[0].id,
        payload: { code, via: proposal.source },
      });
    }
  }

  // 2. groups
  for (const r of byEntity("group")) {
    if (r.action === "create") {
      const ins = await q.query(
        `insert into public.groups (client_id, name, group_kind)
         values (public.current_client_id(), $1, $2) returning id`,
        [r.data.name, r.data.group_kind ?? null]
      );
      idByKey.set(r.key, ins.rows[0].id);
      created++;
    } else if (r.action === "update" && r.matchId) {
      await q.query(`update public.groups set group_kind = $2 where id = $1`, [
        r.matchId,
        r.data.group_kind ?? null,
      ]);
      updated++;
    }
  }

  // 3. addresses
  for (const r of byEntity("address")) {
    if (r.action !== "create") continue;
    const d = r.data;
    const ins = await q.query(
      `insert into public.addresses
         (client_id, raw_input, provider, place_id, street, city, region, postal, country,
          lat, lng, normalized, verified_at)
       values (public.current_client_id(), $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11,
               case when $12 then now() else null end)
       returning id`,
      [
        d.raw_input ?? null,
        d.provider ?? null,
        d.place_id ?? null,
        d.street ?? null,
        d.city ?? null,
        d.region ?? null,
        d.postal ?? null,
        d.country ?? null,
        d.lat ?? null,
        d.lng ?? null,
        d.normalized ? JSON.stringify(d.normalized) : null,
        Boolean(d.verified),
      ]
    );
    idByKey.set(r.key, ins.rows[0].id);
    created++;
  }

  // 4. projects
  for (const r of byEntity("project")) {
    if (r.action === "create") {
      const groupId = r.refs.groupKey ? idByKey.get(r.refs.groupKey) ?? null : null;
      const addressId = r.refs.addressKey ? idByKey.get(r.refs.addressKey) ?? null : null;
      const ins = await q.query(
        `insert into public.projects (client_id, group_id, address_id, name, created_by, attrs)
         values (public.current_client_id(), $1, $2, $3, public.current_user_id(), $4)
         returning id`,
        [groupId, addressId, r.data.name, JSON.stringify(r.data.notes ? { notes: r.data.notes } : {})]
      );
      idByKey.set(r.key, ins.rows[0].id);
      created++;
    } else if (r.action === "update" && r.matchId) {
      await q.query(
        `update public.projects set attrs = attrs || $2 where id = $1`,
        [r.matchId, JSON.stringify({ notes: r.data.notes })]
      );
      updated++;
    }
  }

  // 5. contacts
  for (const r of byEntity("contact")) {
    const d = r.data;
    const emailArr = d.email ? [{ label: "main", value: String(d.email) }] : [];
    const phoneArr = d.phone ? [{ label: "main", value: String(d.phone) }] : [];
    if (r.action === "create") {
      const ins = await q.query(
        `insert into public.contacts
           (client_id, kind, display_name, emails, phones, preferred_contact_method, attrs)
         values (public.current_client_id(), $1, $2, $3, $4, $5, $6) returning id`,
        [
          d.kind ?? "person",
          d.display_name,
          JSON.stringify(emailArr),
          JSON.stringify(phoneArr),
          d.preferred_contact_method ?? null,
          JSON.stringify(d.attrs ?? {}),
        ]
      );
      idByKey.set(r.key, ins.rows[0].id);
      created++;
    } else if (r.action === "update" && r.matchId) {
      // Merge: append missing email/phone, overlay attrs, update reach-by.
      await q.query(
        `update public.contacts set
           emails = case when $2::jsonb is not null and not (emails @> $2::jsonb)
                         then emails || $2::jsonb else emails end,
           phones = case when $3::jsonb is not null and not (phones @> $3::jsonb)
                         then phones || $3::jsonb else phones end,
           preferred_contact_method = coalesce($4, preferred_contact_method),
           attrs = attrs || $5::jsonb
         where id = $1`,
        [
          r.matchId,
          emailArr.length ? JSON.stringify(emailArr) : null,
          phoneArr.length ? JSON.stringify(phoneArr) : null,
          d.preferred_contact_method ?? null,
          JSON.stringify(d.attrs ?? {}),
        ]
      );
      updated++;
    }
  }

  // 6. links
  for (const r of byEntity("link")) {
    const typeId = typeIdByCode.get(low(r.data.contact_type));
    if (r.action === "create") {
      const projectId = idByKey.get(r.refs.projectKey);
      const contactId = idByKey.get(r.refs.contactKey);
      if (!projectId || !contactId || !typeId) {
        throw new Error(`Link "${r.label}" references a row that was skipped or failed`);
      }
      await q.query(
        `insert into public.project_contacts
           (client_id, project_id, contact_id, contact_type_id, valid_from, valid_to,
            status, source, created_by)
         values (public.current_client_id(), $1, $2, $3, $4, $5, 'active', $6,
                 public.current_user_id())`,
        [
          projectId,
          contactId,
          typeId,
          r.data.lease_start ?? null,
          r.data.lease_end ?? null,
          proposal.source,
        ]
      );
      created++;
    } else if (r.action === "update" && r.matchId) {
      await q.query(
        `update public.project_contacts set valid_from = $2, valid_to = $3 where id = $1`,
        [r.matchId, r.data.lease_start ?? null, r.data.lease_end ?? null]
      );
      updated++;
    }
  }

  const durationMs = Date.now() - started;
  const activeSeconds = meta.startedAt
    ? Math.max(0, Math.round((Date.now() - new Date(meta.startedAt).getTime()) / 1000))
    : null;

  // The leverage ledger: one session-level event with the numbers that matter.
  await logEvent(q, {
    verb: "import.committed",
    targetType: "client",
    targetId: null,
    payload: {
      source: proposal.source,
      records_created: created,
      records_updated: updated,
      drafts_created: drafts,
      user_active_seconds: activeSeconds,
    },
    durationMs,
  });

  return {
    records_created: created,
    records_updated: updated,
    drafts_created: drafts,
    user_active_seconds: activeSeconds,
    duration_ms: durationMs,
  };
}
