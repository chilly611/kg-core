import { randomUUID } from "node:crypto";
import { authed } from "@/lib/server/api";
import { logEvent } from "@/lib/server/db";
import { storagePut } from "@/lib/server/storage";

// Upload a document to a project. Bytes go through the storage seam; the row
// is inserted under RLS (editor+); the link targets the project (agreements —
// and everything else uploaded here — default-link to the project).
// min_role_visibility and doc_type gates apply from the moment the row exists.
export async function POST(
  request: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id: projectId } = await ctx.params;
  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof File)) {
    return Response.json({ error: "No file uploaded" }, { status: 400 });
  }
  const docType = String(form.get("doc_type") ?? "other") || "other";
  const minRoleRaw = String(form.get("min_role_visibility") ?? "");
  const minRole = ["read_only", "editor", "admin", "super_admin"].includes(minRoleRaw)
    ? minRoleRaw
    : null;
  const bytes = Buffer.from(await file.arrayBuffer());

  return authed(async (q) => {
    const proj = (
      await q.query(`select client_id from public.projects where id = $1`, [projectId])
    ).rows[0];
    if (!proj) throw new Error("Project not found");

    const safeName = file.name.replace(/[^\w.\-]+/g, "_").slice(0, 120);
    const path = `${proj.client_id}/${projectId}/${randomUUID()}-${safeName}`;
    await storagePut(path, bytes, file.type || "application/octet-stream");

    const doc = (
      await q.query(
        `insert into public.documents
           (client_id, storage_path, doc_type, title, mime, size, uploaded_by, source, min_role_visibility)
         values ($1, $2, $3, $4, $5, $6, public.current_user_id(), 'upload', $7)
         returning id, title, doc_type, mime, size, created_at`,
        [proj.client_id, path, docType, file.name, file.type || null, bytes.length, minRole]
      )
    ).rows[0];

    await q.query(
      `insert into public.document_links (document_id, target_type, target_id)
       values ($1, 'project', $2)`,
      [doc.id, projectId]
    );
    await logEvent(q, {
      verb: "document.uploaded",
      targetType: "document",
      targetId: doc.id,
      payload: { doc_type: docType, project_id: projectId, size: bytes.length, min_role_visibility: minRole },
    });
    return doc;
  });
}
