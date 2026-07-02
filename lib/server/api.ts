import { getSessionClaims } from "./auth";
import { withRls, type Rls } from "./db";

// Route-handler wrapper: resolve session -> open RLS transaction -> run.
// Handlers receive an RLS-scoped query client; whatever they return is JSON.
export async function authed(
  fn: (q: Rls) => Promise<unknown>
): Promise<Response> {
  const claims = await getSessionClaims();
  if (!claims) {
    return Response.json({ error: "Not signed in" }, { status: 401 });
  }
  try {
    const data = await withRls(claims.sub, fn);
    return Response.json(data);
  } catch (err) {
    console.error("[api]", err);
    const message = err instanceof Error ? err.message : "Request failed";
    return Response.json({ error: message }, { status: 500 });
  }
}
