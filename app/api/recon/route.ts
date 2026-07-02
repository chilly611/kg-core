import { authed } from "@/lib/server/api";

// Reconciliation: expected_counts vs live (RLS-scoped) counts, per entity.
export async function GET() {
  return authed(async (q) => {
    const { rows } = await q.query(
      `select e.entity, e.expected, e.as_of,
              case e.entity
                when 'projects' then (select count(*) from public.projects)
                when 'contacts' then (select count(*) from public.contacts)
                when 'groups'   then (select count(*) from public.groups)
                when 'users'    then (select count(*) from public.users)
              end::int as actual
       from public.expected_counts e
       order by e.entity`
    );
    return rows;
  });
}
