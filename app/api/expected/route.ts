import { authed } from "@/lib/server/api";
import { logEvent } from "@/lib/server/db";

const ENTITIES = ["projects", "contacts", "groups", "users"] as const;

// The reconciliation contract, editable from the import screen:
// "How many projects should exist? Contacts?" Chips update live everywhere.
export async function POST(request: Request) {
  const body = (await request.json()) as Partial<Record<(typeof ENTITIES)[number], number>>;

  return authed(async (q) => {
    const set: Record<string, number> = {};
    for (const entity of ENTITIES) {
      const value = body[entity];
      if (value == null) continue;
      const n = Number(value);
      if (!Number.isInteger(n) || n < 0) throw new Error(`Bad expected count for ${entity}`);
      await q.query(
        `insert into public.expected_counts (client_id, entity, expected, as_of)
         values (public.current_client_id(), $1, $2, current_date)
         on conflict (client_id, entity)
         do update set expected = excluded.expected, as_of = excluded.as_of`,
        [entity, n]
      );
      set[entity] = n;
    }
    if (Object.keys(set).length === 0) throw new Error("No counts provided");
    await logEvent(q, {
      verb: "expected_counts.set",
      targetType: "client",
      targetId: null,
      payload: set,
    });
    return { set };
  });
}
