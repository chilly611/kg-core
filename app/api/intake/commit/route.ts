import { authed } from "@/lib/server/api";
import { commitProposal } from "@/lib/server/intake";
import type { Proposal } from "@/lib/intake/types";

// Apply a reviewed proposal atomically. startedAt = when the user dropped the
// file / typed the sentence — the basis of user_active_seconds (leverage).
export async function POST(request: Request) {
  const body = (await request.json()) as {
    proposal: Proposal;
    startedAt?: string | null;
  };
  return authed(async (q) => {
    if (!body.proposal?.rows?.length) throw new Error("Nothing to commit");
    return commitProposal(q, body.proposal, { startedAt: body.startedAt ?? null });
  });
}
