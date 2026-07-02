import { authed } from "@/lib/server/api";

export async function GET() {
  return authed(async (q) => {
    const { rows } = await q.query(
      `select p.id, p.name, p.status, p.is_active_billing, p.group_id,
              g.name as group_name, a.street, a.city, a.region,
              (select count(*)::int from public.project_contacts_effective e
                where e.project_id = p.id and e.effective_status = 'active') as active_contacts
       from public.projects p
       left join public.groups g on g.id = p.group_id
       left join public.addresses a on a.id = p.address_id
       order by p.name`
    );
    return rows;
  });
}
