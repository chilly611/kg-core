import { getSessionClaims } from "@/lib/server/auth";
import { withRls } from "@/lib/server/db";
import { storageGet } from "@/lib/server/storage";

// Download enforces the SAME gates as the list: the document row is selected
// under the caller's RLS (client scope + min_role_visibility + module gate).
// If RLS hides the row, the file does not exist for you — 404, not 403.
export async function GET(
  _request: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;
  const claims = await getSessionClaims();
  if (!claims) return Response.json({ error: "Not signed in" }, { status: 401 });

  try {
    const doc = await withRls(claims.sub, async (q) => {
      const { rows } = await q.query(
        `select storage_path, title, mime from public.documents where id = $1`,
        [id]
      );
      return rows[0] ?? null;
    });
    if (!doc) return Response.json({ error: "Not found" }, { status: 404 });

    const bytes = await storageGet(doc.storage_path);
    return new Response(new Uint8Array(bytes), {
      headers: {
        "Content-Type": doc.mime ?? "application/octet-stream",
        "Content-Disposition": `attachment; filename="${(doc.title ?? "document").replace(/[^\w.\- ]+/g, "_")}"`,
      },
    });
  } catch (err) {
    console.error("[download]", err);
    return Response.json({ error: "Download failed" }, { status: 500 });
  }
}
