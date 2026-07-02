import { authed } from "@/lib/server/api";
import { logEvent } from "@/lib/server/db";

// groups carry no status column — name is the only inline-editable field.
export async function PATCH(
  request: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;
  const body = await request.json();

  return authed(async (q) => {
    if (typeof body.name !== "string" || body.name.trim() === "") {
      throw new Error("name is required");
    }
    const { rows } = await q.query(
      `update public.groups set name = $2 where id = $1 returning id, name`,
      [id, body.name.trim()]
    );
    if (!rows[0]) throw new Error("Group not found or not writable");

    await logEvent(q, {
      verb: "group.updated",
      targetType: "group",
      targetId: id,
      payload: { fields: { name: body.name.trim() } },
    });
    return rows[0];
  });
}
