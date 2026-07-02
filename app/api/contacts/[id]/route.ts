import { authed } from "@/lib/server/api";
import { logEvent } from "@/lib/server/db";

const EDITABLE = ["display_name", "status", "preferred_contact_method"] as const;

export async function PATCH(
  request: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;
  const body = await request.json();

  return authed(async (q) => {
    const fields = EDITABLE.filter((f) => f in body);
    if (fields.length === 0) throw new Error("No editable fields in request");

    const sets = fields.map((f, i) => `${f} = $${i + 2}`).join(", ");
    const { rows } = await q.query(
      `update public.contacts set ${sets} where id = $1
       returning id, display_name, status, preferred_contact_method`,
      [id, ...fields.map((f) => body[f])]
    );
    if (!rows[0]) throw new Error("Contact not found or not writable");

    await logEvent(q, {
      verb: "contact.updated",
      targetType: "contact",
      targetId: id,
      payload: { fields: Object.fromEntries(fields.map((f) => [f, body[f]])) },
    });
    return rows[0];
  });
}
