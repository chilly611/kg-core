import { authed } from "@/lib/server/api";
import { planBundle } from "@/lib/server/intake";
import { heuristicCapture, rowsToBundle } from "@/lib/intake/normalize";
import type { ImportRow } from "@/lib/intake/types";

// NL QUICK CAPTURE: one sentence -> structured proposal -> the SAME preview.
// Never auto-commits. Claude parses when ANTHROPIC_API_KEY is configured;
// otherwise a clearly-labeled heuristic handles the simple cases so the box
// still works on a keyless dev machine.

const SYSTEM = `You turn one sentence of property-management shorthand into import rows.
Extract ONLY facts stated in the text — never invent values. Today is {today}.
Map colloquial roles to contact_type codes: tenant/renter -> lessee; "month to month" -> month_to_month; keep owner/vendor/occupant/worker/agent/emergency_contact as-is; anything else keep verbatim (it becomes a draft type).
Resolve relative dates ("Aug 1") to YYYY-MM-DD using the CURRENT or NEXT occurrence.
"New client/property/project at <address>" means one project whose name is the street address unless a better name is given.
Split multi-entity sentences into multiple rows sharing group/project columns.`;

const TOOL = {
  name: "propose_records",
  description: "Emit the structured records described by the user's sentence.",
  input_schema: {
    type: "object" as const,
    properties: {
      rows: {
        type: "array",
        items: {
          type: "object",
          properties: {
            group_name: { type: "string" },
            group_kind: { type: "string", enum: ["single_residence", "multi_family", "commercial"] },
            project_name: { type: "string" },
            street: { type: "string" },
            city: { type: "string" },
            region: { type: "string" },
            postal: { type: "string" },
            country: { type: "string" },
            contact_name: { type: "string" },
            contact_type: { type: "string" },
            contact_phone: { type: "string" },
            contact_email: { type: "string" },
            preferred_contact_method: { type: "string" },
            lease_start: { type: "string", description: "YYYY-MM-DD" },
            lease_end: { type: "string", description: "YYYY-MM-DD" },
            notes: { type: "string" },
          },
          additionalProperties: false,
        },
      },
    },
    required: ["rows"],
  },
};

async function claudeCapture(text: string): Promise<ImportRow[]> {
  const { default: Anthropic } = await import("@anthropic-ai/sdk");
  const client = new Anthropic();
  const response = await client.messages.create({
    model: process.env.ANTHROPIC_MODEL ?? "claude-sonnet-5",
    max_tokens: 2000,
    system: SYSTEM.replace("{today}", new Date().toISOString().slice(0, 10)),
    messages: [{ role: "user", content: text }],
    tools: [TOOL],
    tool_choice: { type: "tool", name: "propose_records" },
  });
  const toolUse = response.content.find((b) => b.type === "tool_use");
  if (!toolUse || toolUse.type !== "tool_use") throw new Error("Model returned no structured rows");
  const rows = (toolUse.input as { rows: Omit<ImportRow, "row">[] }).rows ?? [];
  return rows.map((r, i) => ({ ...r, row: i + 1 }));
}

export async function POST(request: Request) {
  const { text } = (await request.json()) as { text: string };
  if (!text?.trim()) {
    return Response.json({ error: "Nothing to parse" }, { status: 400 });
  }

  return authed(async (q) => {
    let rows: ImportRow[];
    let parser: "claude" | "heuristic";
    if (process.env.ANTHROPIC_API_KEY) {
      rows = await claudeCapture(text.trim());
      parser = "claude";
    } else {
      rows = heuristicCapture(text.trim());
      parser = "heuristic";
    }
    const bundle = rowsToBundle(rows);
    const proposal = await planBundle(q, bundle, "nl");
    proposal.parser = parser;
    if (parser === "heuristic") {
      proposal.notes = [
        "Parsed without AI (ANTHROPIC_API_KEY not set) — review carefully.",
      ];
    }
    return { bundle, proposal };
  });
}
