import { authed } from "@/lib/server/api";

export async function GET() {
  return authed(async (q) => {
    const { rows } = await q.query(
      `select c.id, c.display_name, c.kind, c.status,
              c.preferred_contact_method, c.agent_endpoint,
              coalesce((select array_agg(distinct ct.code)
                        from public.project_contacts pc
                        join public.contact_types ct on ct.id = pc.contact_type_id
                        where pc.contact_id = c.id), '{}') as types,
              (select count(*)::int from public.project_contacts_effective e
                where e.contact_id = c.id and e.effective_status = 'active') as active_assignments
       from public.contacts c
       order by c.display_name`
    );
    return rows;
  });
}
