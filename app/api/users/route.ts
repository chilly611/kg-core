import { authed } from "@/lib/server/api";

export async function GET() {
  return authed(async (q) => {
    const { rows } = await q.query(
      `select u.id, u.display_name, u.email, u.status,
              coalesce((select array_agg(distinct r.code)
                        from public.role_grants rg
                        join public.roles r on r.id = rg.role_id
                        where rg.user_id = u.id), '{}') as roles
       from public.users u
       order by u.display_name`
    );
    return rows;
  });
}
