import * as XLSX from "xlsx";
import { authed } from "@/lib/server/api";
import { planBundle } from "@/lib/server/intake";
import { normalizeHeader, rowsToBundle, toDateString } from "@/lib/intake/normalize";
import type { ImportRow } from "@/lib/intake/types";

// TEMPLATE IMPORT: .xlsx or .csv upload -> parsed rows -> bundle -> plan.
// Never rejects a file: unreadable cells become row issues, fixable in the
// preview grid.
export async function POST(request: Request) {
  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof File)) {
    return Response.json({ error: "No file uploaded" }, { status: 400 });
  }
  const buf = Buffer.from(await file.arrayBuffer());

  return authed(async (q) => {
    const wb = XLSX.read(buf, { type: "buffer", cellDates: true });
    const ws = wb.Sheets[wb.SheetNames[0]];
    if (!ws) throw new Error("The file has no sheets");
    const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: "" });

    const rows: ImportRow[] = raw.map((r, i) => {
      const row: ImportRow = { row: i + 2 }; // +2: 1-based + header row
      for (const [header, value] of Object.entries(r)) {
        const field = normalizeHeader(header);
        if (!field || field === "row") continue;
        if (field === "lease_start" || field === "lease_end") {
          const d = toDateString(value);
          if (d) row[field] = d;
        } else {
          const s = String(value ?? "").trim();
          if (s) row[field] = s;
        }
      }
      return row;
    });

    const bundle = rowsToBundle(rows);
    const proposal = await planBundle(q, bundle, "template");
    return { bundle, proposal, rowCount: rows.length, fileName: file.name };
  });
}
