import { authed } from "@/lib/server/api";

// Who am I + which module slots my grants let me see.
export async function GET() {
  return authed(async (q) => {
    const { rows } = await q.query(
      `select u.id, u.display_name, u.email, c.name as client_name,
              public.is_operator() as is_operator,
              public.module_visible(u.client_id, 'journey') as journey_visible,
              public.module_visible(u.client_id, 'budgets') as budget_visible
       from public.users u
       join public.clients c on c.id = u.client_id
       where u.id = public.current_user_id()`
    );
    if (!rows[0]) throw new Error("Signed-in subject has no user row");
    return rows[0];
  });
}
