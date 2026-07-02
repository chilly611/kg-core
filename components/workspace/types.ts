export type Me = {
  id: string;
  display_name: string;
  email: string;
  client_name: string;
  is_operator: boolean;
  journey_visible: boolean;
  budget_visible: boolean;
};

export type Recon = {
  entity: string;
  expected: number;
  actual: number;
  as_of: string;
};

export type ProjectRow = {
  id: string;
  name: string;
  status: string;
  is_active_billing: boolean;
  group_id: string | null;
  group_name: string | null;
  street: string | null;
  city: string | null;
  region: string | null;
  active_contacts: number;
};

export type ContactRow = {
  id: string;
  display_name: string;
  kind: string;
  status: string;
  preferred_contact_method: string | null;
  agent_endpoint: string | null;
  types: string[];
  active_assignments: number;
};

export type GroupRow = {
  id: string;
  name: string;
  group_kind: string | null;
  project_count: number;
};

export type UserRow = {
  id: string;
  display_name: string | null;
  email: string | null;
  status: string;
  roles: string[];
};

export type Assignment = {
  id: string;
  project_id: string;
  project_name: string;
  type_code: string;
  type_label: string;
  valid_from: string | null;
  valid_to: string | null;
  status: string;
  effective_status: string;
};

export type ProjectDetail = {
  project: {
    id: string;
    name: string;
    status: string;
    is_active_billing: boolean;
    group_name: string | null;
    created_at: string;
  };
  address: {
    raw_input: string | null;
    provider: string | null;
    place_id: string | null;
    street: string | null;
    city: string | null;
    region: string | null;
    postal: string | null;
    country: string | null;
    lat: string | null;
    lng: string | null;
    verified_at: string | null;
  } | null;
  contacts: Array<{
    id: string;
    contact_id: string;
    display_name: string;
    kind: string;
    type_code: string;
    type_label: string;
    valid_from: string | null;
    valid_to: string | null;
    status: string;
    effective_status: string;
  }>;
  documents: Array<{
    id: string;
    title: string | null;
    doc_type: string | null;
    mime: string | null;
    size: number | null;
    created_at: string;
  }>;
};

export async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? `GET ${url} failed`);
  return data as T;
}

export async function sendJson<T>(
  method: "PATCH" | "POST",
  url: string,
  body: unknown
): Promise<T> {
  const res = await fetch(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? `${method} ${url} failed`);
  return data as T;
}

export function fmtDate(value: string | null): string {
  if (!value) return "—";
  return String(value).slice(0, 10);
}
