// The intake pipeline: every path (template, vcf, places, nl) produces a
// Bundle of drafts; the server diffs it against the database into a Proposal;
// the user reviews/fixes in ONE preview grid; commit applies it atomically.

export type ImportRow = {
  row: number; // 1-based source row for error messages
  group_name?: string;
  group_kind?: string;
  project_name?: string;
  street?: string;
  city?: string;
  region?: string;
  postal?: string;
  country?: string;
  contact_name?: string;
  contact_type?: string;
  contact_phone?: string;
  contact_email?: string;
  preferred_contact_method?: string;
  lease_start?: string; // YYYY-MM-DD
  lease_end?: string;
  notes?: string;
};

export type GroupDraft = { key: string; name: string; group_kind?: string | null };

export type AddressDraft = {
  key: string;
  raw_input?: string | null;
  street?: string | null;
  city?: string | null;
  region?: string | null;
  postal?: string | null;
  country?: string | null;
  place_id?: string | null;
  provider?: string | null;
  lat?: number | null;
  lng?: number | null;
  verified?: boolean;
  normalized?: Record<string, unknown> | null;
};

export type ProjectDraft = {
  key: string;
  name: string;
  groupKey?: string | null;
  addressKey?: string | null;
  notes?: string | null;
};

export type ContactDraft = {
  key: string;
  display_name: string;
  kind?: "person" | "org" | "agent";
  email?: string | null;
  phone?: string | null;
  preferred_contact_method?: string | null;
  attrs?: Record<string, unknown>;
};

export type LinkDraft = {
  key: string;
  projectKey: string;
  contactKey: string;
  contact_type: string;
  lease_start?: string | null;
  lease_end?: string | null;
};

export type Bundle = {
  groups: GroupDraft[];
  addresses: AddressDraft[];
  projects: ProjectDraft[];
  contacts: ContactDraft[];
  links: LinkDraft[];
};

export type ProposalAction = "create" | "update" | "unchanged" | "error";

export type ProposalRow = {
  key: string;
  entity: "group" | "address" | "project" | "contact" | "contact_type" | "link";
  action: ProposalAction;
  label: string; // human summary shown in the grid
  detail: string; // what will happen / what changes
  issues: string[];
  matchId: string | null;
  skip: boolean; // user can exclude a row without rejecting the file
  refs: Record<string, string>; // bundle-key references (groupKey, projectKey, ...)
  data: Record<string, unknown>; // editable draft fields
};

export type Proposal = {
  source: "template" | "vcf" | "places" | "nl";
  rows: ProposalRow[];
  parser?: string; // e.g. 'claude' | 'heuristic' for nl
  notes?: string[];
};

export type CommitResult = {
  records_created: number;
  records_updated: number;
  drafts_created: number;
  user_active_seconds: number | null;
  duration_ms: number;
};
