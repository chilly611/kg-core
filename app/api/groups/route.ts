import { authed } from "@/lib/server/api";

export async function GET() {
  return authed(async (q) => {
    const { rows } = await q.query(
      `select g.id, g.name, g.group_kind, g.attrs,
              (select count(*)::int from public.projects p where p.group_id = g.id) as project_count
       from public.groups g
       order by g.name`
    );
    return rows;
  });
}
