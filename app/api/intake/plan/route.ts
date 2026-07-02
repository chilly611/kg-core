import { authed } from "@/lib/server/api";
import { planBundle } from "@/lib/server/intake";
import type { Bundle, Proposal } from "@/lib/intake/types";

// Re-plan an edited bundle (inline fixes in the preview re-check against the
// database) — also the entry point for the places/single-add path.
export async function POST(request: Request) {
  const body = (await request.json()) as { bundle: Bundle; source?: Proposal["source"] };
  return authed(async (q) => {
    const proposal = await planBundle(q, body.bundle, body.source ?? "template");
    return { proposal };
  });
}
