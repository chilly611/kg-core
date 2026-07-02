import { authed } from "@/lib/server/api";

// A contact's project_contacts rows across projects — the working set for
// the bulk reassign dialog ("contractor leaves, new one assigned everywhere").
export async function GET(
  _request: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;

  return authed(async (q) => {
    const { rows } = await q.query(
      `select e.id, e.project_id, p.name as project_name,
              ct.code as type_code, ct.label as type_label,
              e.valid_from, e.valid_to, e.status, e.effective_status
       from public.project_contacts_effective e
       join public.projects p on p.id = e.project_id
       join public.contact_types ct on ct.id = e.contact_type_id
       where e.contact_id = $1
       order by p.name`,
      [id]
    );
    return rows;
  });
}
