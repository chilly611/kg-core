import { authed } from "@/lib/server/api";
import { logEvent } from "@/lib/server/db";

// Bulk set status across selected rows. One transaction: per-row events plus
// a timed summary event.
const TABLES: Record<string, { table: string; singular: string }> = {
  projects: { table: "public.projects", singular: "project" },
  contacts: { table: "public.contacts", singular: "contact" },
  users: { table: "public.users", singular: "user" },
};

export async function POST(request: Request) {
  const body = await request.json();
  const { entity, ids, status } = body as {
    entity: string;
    ids: string[];
    status: string;
  };

  return authed(async (q) => {
    const target = TABLES[entity];
    if (!target) throw new Error(`Bulk status not supported for '${entity}'`);
    if (!Array.isArray(ids) || ids.length === 0) throw new Error("No rows selected");
    if (status !== "active" && status !== "inactive") throw new Error("Bad status");

    const started = Date.now();
    const { rows } = await q.query(
      `update ${target.table} set status = $1 where id = any($2::uuid[]) returning id`,
      [status, ids]
    );

    for (const row of rows) {
      await logEvent(q, {
        verb: `${target.singular}.status_changed`,
        targetType: target.singular,
        targetId: row.id,
        payload: { to: status },
      });
    }
    await logEvent(q, {
      verb: "bulk.status_changed",
      targetType: entity,
      targetId: null,
      payload: { to: status, requested: ids.length, updated: rows.length },
      durationMs: Date.now() - started,
    });

    return { updated: rows.length };
  });
}
