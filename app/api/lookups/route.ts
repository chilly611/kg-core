import { authed } from "@/lib/server/api";

// Vocabulary + filter options in one round trip.
export async function GET() {
  return authed(async (q) => {
    const contactTypes = (
      await q.query(
        `select id, category, code, label from public.contact_types order by label`
      )
    ).rows;
    const groups = (
      await q.query(`select id, name from public.groups order by name`)
    ).rows;
    return { contactTypes, groups };
  });
}
