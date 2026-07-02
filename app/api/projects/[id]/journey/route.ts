import { authed } from "@/lib/server/api";

// The journey: everything that happened to a project, as data.
// Ported CONCEPT from BKG's TimeMachine (scrub through time, see state as-of);
// the source component was a THREE.js building with hardcoded construction
// phases + prohibited palette, so the visual was rebuilt category-agnostic:
// moments come from events, spans come from project_contacts windows, labels
// come from the rows themselves. Nothing here knows what kind of work this is.
export async function GET(
  _request: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;

  return authed(async (q) => {
    const project = (
      await q.query(
        `select id, name, created_at::date::text as started from public.projects where id = $1`,
        [id]
      )
    ).rows[0];
    if (!project) throw new Error("Project not found");

    // Module gate applies to the timeline too: ledger.* moments (and their
    // amounts) do not exist for a grant with {"budgets": false} — caught in
    // the CODE-E role-lens pass, where events leaked money past the gate.
    const budgetsVisible = (
      await q.query(
        `select public.module_visible(p.client_id, 'budgets') as v
         from public.projects p where p.id = $1`,
        [id]
      )
    ).rows[0]?.v ?? false;

    const moments = (
      await q.query(
        `select e.id::text, e.verb, e.actor_type, e.created_at,
                e.payload ->> 'memo' as memo, e.payload ->> 'amount' as amount
         from public.events e
         where ((e.target_type = 'project' and e.target_id = $1)
            or (e.target_type = 'document' and e.target_id in
                 (select document_id from public.document_links
                  where target_type = 'project' and target_id = $1)))
           and ($2 or e.verb not like 'ledger.%')
         order by e.created_at`,
        [id, budgetsVisible]
      )
    ).rows;

    const spans = (
      await q.query(
        `select pc.id, c.display_name, ct.label as type_label,
                pc.valid_from::text, pc.valid_to::text, e.effective_status
         from public.project_contacts_effective e
         join public.project_contacts pc on pc.id = e.id
         join public.contacts c on c.id = pc.contact_id
         join public.contact_types ct on ct.id = pc.contact_type_id
         where pc.project_id = $1
         order by pc.valid_from nulls first, c.display_name`,
        [id]
      )
    ).rows;

    return { project, moments, spans };
  });
}
