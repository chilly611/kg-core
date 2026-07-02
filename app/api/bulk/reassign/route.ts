import { authed } from "@/lib/server/api";
import { logEvent } from "@/lib/server/db";

// The "contractor leaves, new one assigned everywhere" action, atomically:
// end-date the departing contact's selected project_contacts rows and create
// replacement links to the chosen contact — same projects, same contact types.
// One transaction; every mutation logged; summary event carries duration_ms.
export async function POST(request: Request) {
  const body = await request.json();
  const { fromContactId, toContactId, assignmentIds, endDate } = body as {
    fromContactId: string;
    toContactId: string;
    assignmentIds: string[];
    endDate: string; // YYYY-MM-DD
  };

  return authed(async (q) => {
    if (!fromContactId || !toContactId) throw new Error("Both contacts are required");
    if (fromContactId === toContactId) throw new Error("Replacement must be a different contact");
    if (!Array.isArray(assignmentIds) || assignmentIds.length === 0)
      throw new Error("No assignments selected");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(endDate ?? "")) throw new Error("Bad end date");

    const started = Date.now();

    // End-date + deactivate the old links. `contact_id = fromContactId` guards
    // against stray ids; RLS guards the client boundary.
    const ended = (
      await q.query(
        `update public.project_contacts
         set valid_to = $1::date, status = 'inactive'
         where id = any($2::uuid[]) and contact_id = $3
         returning id, project_id, contact_type_id`,
        [endDate, assignmentIds, fromContactId]
      )
    ).rows;
    if (ended.length === 0) throw new Error("No matching assignments for that contact");

    // Create the replacement links, starting where the old ones end.
    const created = (
      await q.query(
        `insert into public.project_contacts
           (client_id, project_id, contact_id, contact_type_id, valid_from, status, source, created_by)
         select client_id, project_id, $1, contact_type_id, $2::date, 'active', 'manual',
                public.current_user_id()
         from public.project_contacts
         where id = any($3::uuid[])
         returning id, project_id`,
        [toContactId, endDate, ended.map((r) => r.id)]
      )
    ).rows;

    for (const row of ended) {
      await logEvent(q, {
        verb: "project_contact.end_dated",
        targetType: "project_contact",
        targetId: row.id,
        payload: { contact_id: fromContactId, valid_to: endDate },
      });
    }
    for (const row of created) {
      await logEvent(q, {
        verb: "project_contact.created",
        targetType: "project_contact",
        targetId: row.id,
        payload: { contact_id: toContactId, project_id: row.project_id, source: "reassign" },
      });
    }
    await logEvent(q, {
      verb: "bulk.reassign",
      targetType: "contact",
      targetId: fromContactId,
      payload: {
        from_contact_id: fromContactId,
        to_contact_id: toContactId,
        ended: ended.length,
        created: created.length,
        end_date: endDate,
      },
      durationMs: Date.now() - started,
    });

    return { ended: ended.length, created: created.length };
  });
}
