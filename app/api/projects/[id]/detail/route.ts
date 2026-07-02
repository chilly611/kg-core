import { authed } from "@/lib/server/api";

// Everything the detail rail needs in one round trip:
// project + address, typed/time-bounded contacts, documents (read-only).
export async function GET(
  _request: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;

  return authed(async (q) => {
    const project = (
      await q.query(
        `select p.id, p.name, p.status, p.is_active_billing, p.attrs, p.created_at,
                g.id as group_id, g.name as group_name
         from public.projects p
         left join public.groups g on g.id = p.group_id
         where p.id = $1`,
        [id]
      )
    ).rows[0];
    if (!project) throw new Error("Project not found");

    const address = (
      await q.query(
        `select a.raw_input, a.provider, a.place_id, a.street, a.city, a.region,
                a.postal, a.country, a.lat, a.lng, a.verified_at, a.normalized
         from public.addresses a
         join public.projects p on p.address_id = a.id
         where p.id = $1`,
        [id]
      )
    ).rows[0] ?? null;

    const contacts = (
      await q.query(
        `select e.id, e.contact_id, c.display_name, c.kind,
                ct.code as type_code, ct.label as type_label,
                e.valid_from, e.valid_to, e.status, e.effective_status
         from public.project_contacts_effective e
         join public.contacts c on c.id = e.contact_id
         join public.contact_types ct on ct.id = e.contact_type_id
         where e.project_id = $1
         order by (e.effective_status = 'active') desc, c.display_name`,
        [id]
      )
    ).rows;

    // Documents linked to the project itself, its group, or the client —
    // RLS (min_role_visibility + module gates) trims what the caller may see.
    const documents = (
      await q.query(
        `select distinct d.id, d.title, d.doc_type, d.mime, d.size, d.created_at
         from public.documents d
         join public.document_links l on l.document_id = d.id
         where (l.target_type = 'project' and l.target_id = $1)
            or (l.target_type = 'group'   and l.target_id = (select group_id from public.projects where id = $1))
            or (l.target_type = 'client'  and l.target_id = public.current_client_id())
         order by d.created_at desc`,
        [id]
      )
    ).rows;

    return { project, address, contacts, documents };
  });
}
