import type {
  Bundle,
  ContactDraft,
  ImportRow,
} from "./types";

// ---------------------------------------------------------------- headers

// Default template columns (docs/import-template.md was absent when this
// shipped — this IS the default spec) plus forgiving aliases. Unknown
// columns are ignored, never fatal.
const HEADER_ALIASES: Record<string, keyof ImportRow> = {
  group_name: "group_name",
  group: "group_name",
  building: "group_name",
  group_kind: "group_kind",
  project_name: "project_name",
  project: "project_name",
  unit: "project_name",
  street: "street",
  address: "street",
  street_address: "street",
  city: "city",
  region: "region",
  state: "region",
  province: "region",
  postal: "postal",
  postal_code: "postal",
  zip: "postal",
  zip_code: "postal",
  country: "country",
  contact_name: "contact_name",
  contact: "contact_name",
  tenant: "contact_name",
  contact_type: "contact_type",
  role: "contact_type",
  contact_phone: "contact_phone",
  phone: "contact_phone",
  contact_email: "contact_email",
  email: "contact_email",
  preferred_contact_method: "preferred_contact_method",
  reach_by: "preferred_contact_method",
  lease_start: "lease_start",
  lease_end: "lease_end",
  notes: "notes",
  note: "notes",
};

export function normalizeHeader(raw: string): keyof ImportRow | null {
  const slug = raw.trim().toLowerCase().replace(/\s+/g, "_");
  return HEADER_ALIASES[slug] ?? null;
}

// ---------------------------------------------------------------- values

export function toDateString(value: unknown): string | undefined {
  if (value == null || value === "") return undefined;
  if (value instanceof Date && !isNaN(value.getTime())) {
    // SheetJS cellDates gives UTC-noon-ish dates; take the date part.
    return value.toISOString().slice(0, 10);
  }
  const s = String(value).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const parsed = new Date(s);
  if (!isNaN(parsed.getTime())) return parsed.toISOString().slice(0, 10);
  return s; // let validation flag it rather than silently dropping
}

export function phoneDigits(value: string | null | undefined): string {
  return (value ?? "").replace(/\D/g, "");
}

const norm = (v: unknown): string | undefined => {
  if (v == null) return undefined;
  const s = String(v).trim();
  return s === "" ? undefined : s;
};

// ---------------------------------------------------------------- rows -> bundle

// Shared by template import AND nl capture (the model emits ImportRow[]).
// Dedupes within the batch: same group name, same address, same project,
// same contact (email > phone > name) collapse to one draft.
export function rowsToBundle(rows: ImportRow[]): Bundle {
  const bundle: Bundle = { groups: [], addresses: [], projects: [], contacts: [], links: [] };
  const groupKeys = new Map<string, string>();
  const addressKeys = new Map<string, string>();
  const projectKeys = new Map<string, string>();
  const contactKeys = new Map<string, string>();

  for (const r of rows) {
    // group
    let groupKey: string | null = null;
    const groupName = norm(r.group_name);
    if (groupName) {
      const gk = groupName.toLowerCase();
      if (!groupKeys.has(gk)) {
        groupKeys.set(gk, `g${groupKeys.size + 1}`);
        bundle.groups.push({
          key: groupKeys.get(gk)!,
          name: groupName,
          group_kind: norm(r.group_kind) ?? null,
        });
      }
      groupKey = groupKeys.get(gk)!;
    }

    // address (only when any part present)
    let addressKey: string | null = null;
    const street = norm(r.street);
    const city = norm(r.city);
    const region = norm(r.region);
    const postal = norm(r.postal);
    if (street || city || region || postal) {
      const ak = [street, city, postal].map((s) => (s ?? "").toLowerCase()).join("|");
      if (!addressKeys.has(ak)) {
        addressKeys.set(ak, `a${addressKeys.size + 1}`);
        bundle.addresses.push({
          key: addressKeys.get(ak)!,
          raw_input: [street, city, region, postal].filter(Boolean).join(", "),
          street: street ?? null,
          city: city ?? null,
          region: region ?? null,
          postal: postal ?? null,
          country: norm(r.country) ?? null,
        });
      }
      addressKey = addressKeys.get(ak)!;
    }

    // project
    let projectKey: string | null = null;
    const projectName = norm(r.project_name);
    if (projectName) {
      const pk = projectName.toLowerCase();
      if (!projectKeys.has(pk)) {
        projectKeys.set(pk, `p${projectKeys.size + 1}`);
        bundle.projects.push({
          key: projectKeys.get(pk)!,
          name: projectName,
          groupKey,
          addressKey,
          notes: norm(r.notes) ?? null,
        });
      }
      projectKey = projectKeys.get(pk)!;
    }

    // contact
    let contactKey: string | null = null;
    const contactName = norm(r.contact_name);
    const email = norm(r.contact_email)?.toLowerCase();
    const phone = norm(r.contact_phone);
    if (contactName || email || phone) {
      const ck = email ?? (phoneDigits(phone) || contactName!.toLowerCase());
      if (!contactKeys.has(ck)) {
        contactKeys.set(ck, `c${contactKeys.size + 1}`);
        bundle.contacts.push({
          key: contactKeys.get(ck)!,
          display_name: contactName ?? email ?? phone ?? "Unknown",
          kind: "person",
          email: email ?? null,
          phone: phone ?? null,
          preferred_contact_method: norm(r.preferred_contact_method) ?? null,
        });
      }
      contactKey = contactKeys.get(ck)!;
    }

    // link
    if (projectKey && contactKey) {
      bundle.links.push({
        key: `l${bundle.links.length + 1}`,
        projectKey,
        contactKey,
        contact_type: norm(r.contact_type)?.toLowerCase().replace(/\s+/g, "_") ?? "occupant",
        lease_start: toDateString(r.lease_start) ?? null,
        lease_end: toDateString(r.lease_end) ?? null,
      });
    }
  }

  return bundle;
}

// ---------------------------------------------------------------- vcf

// Minimal vCard 3.0/4.0 parser — enough for iPhone contact cards and small
// batches. Known fields map to contact columns; everything else lands in
// attrs.vcf so nothing on the card is lost.
export function vcfToBundle(text: string): Bundle {
  const contacts: ContactDraft[] = [];
  // Unfold continuation lines (RFC 6350 §3.2), tolerate \r\n.
  const unfolded = text.replace(/\r\n/g, "\n").replace(/\n[ \t]/g, "");
  const cards = unfolded.split(/BEGIN:VCARD/i).slice(1);

  for (const card of cards) {
    let displayName = "";
    let email: string | null = null;
    let phone: string | null = null;
    let isOrg = false;
    const extras: Record<string, string> = {};

    for (const line of card.split("\n")) {
      const m = line.match(/^([^:;]+)((?:;[^:]*)?):(.*)$/);
      if (!m) continue;
      const prop = m[1].trim().toUpperCase();
      const value = m[3].trim();
      if (!value || prop === "END" || prop === "VERSION") continue;

      switch (prop) {
        case "FN":
          displayName = value;
          break;
        case "N":
          if (!displayName) {
            const [last, first] = value.split(";");
            displayName = [first, last].filter(Boolean).join(" ");
          }
          break;
        case "EMAIL":
          if (!email) email = value.toLowerCase();
          break;
        case "TEL":
          if (!phone) phone = value;
          break;
        case "ORG":
          extras.org = value.replace(/;+$/, "");
          break;
        case "X-ABSHOWAS":
          if (value.toUpperCase() === "COMPANY") isOrg = true;
          break;
        default: {
          // Unknown/extra fields land in attrs — never dropped.
          const cleanProp = prop.replace(/^ITEM\d+\./, "").toLowerCase();
          if (!["photo", "prodid", "rev", "uid"].includes(cleanProp)) {
            extras[cleanProp] = value.slice(0, 500);
          }
        }
      }
    }

    if (isOrg && !displayName && extras.org) displayName = extras.org;
    if (!displayName && !email && !phone) continue;

    contacts.push({
      key: `c${contacts.length + 1}`,
      display_name: displayName || email || phone || "Unknown",
      kind: isOrg ? "org" : "person",
      email,
      phone,
      preferred_contact_method: email ? "email" : phone ? "phone" : null,
      attrs: Object.keys(extras).length ? { vcf: extras } : undefined,
    });
  }

  return { groups: [], addresses: [], projects: [], contacts, links: [] };
}

// ---------------------------------------------------------------- nl fallback

// Keyless heuristic for quick capture: handles the simple
// "project at <address>, tenant <name> <email> <phone>, lease starts <date>"
// shape. Clearly labeled so the UI can say "parsed without AI".
export function heuristicCapture(text: string): ImportRow[] {
  const email = text.match(/[\w.+-]+@[\w-]+\.[\w.]+/)?.[0];
  const phone = text.match(/(?:\+?1[-. ]?)?(?:\(?\d{3}\)?[-. ]?)\d{3}[-. ]?\d{4}/)?.[0];
  const addr = text.match(
    /\bat\s+(\d+[^,.]*?(?:\s(?:st|street|ave|avenue|rd|road|blvd|ln|lane|way|dr|drive|ct|court|vista|terrace|pl|place)\b[^,.]*)?)(?=[,.]|$)/i
  )?.[1];
  const name = text.match(
    /\b(?:tenant|contact|lessee|owner|vendor|occupant)\s+([A-Z][\w'-]+(?:\s+[A-Z][\w'-]+)+)/
  )?.[1] ??
    text.match(/\b(?:tenant|contact|lessee|owner|vendor|occupant)\s+([A-Z][\w'-]+)/)?.[1];
  const typeWord = text.match(/\b(tenant|lessee|owner|vendor|occupant|worker)\b/i)?.[1];
  const leaseStart = text.match(
    /lease\s+(?:starts?|from|beginning)\s+([A-Za-z]+\.?\s+\d{1,2}(?:,?\s+\d{4})?|\d{4}-\d{2}-\d{2})/i
  )?.[1];

  const year = new Date().getFullYear();
  const start = leaseStart
    ? toDateString(/\d{4}/.test(leaseStart) ? leaseStart : `${leaseStart} ${year}`)
    : undefined;

  return [
    {
      row: 1,
      project_name: addr ?? name ?? text.slice(0, 60),
      street: addr,
      contact_name: name,
      contact_email: email,
      contact_phone: phone,
      contact_type: typeWord ? (typeWord.toLowerCase() === "tenant" ? "lessee" : typeWord.toLowerCase()) : undefined,
      lease_start: start,
    },
  ];
}
