import { authed } from "@/lib/server/api";
import { planBundle } from "@/lib/server/intake";
import { vcfToBundle } from "@/lib/intake/normalize";

// VCF: iPhone contact card(s) -> contacts (unknown fields land in attrs.vcf)
// -> the same preview/commit pattern as every other path.
export async function POST(request: Request) {
  const contentType = request.headers.get("content-type") ?? "";
  let text: string;
  if (contentType.includes("multipart/form-data")) {
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return Response.json({ error: "No file uploaded" }, { status: 400 });
    }
    text = await file.text();
  } else {
    text = ((await request.json()) as { text: string }).text ?? "";
  }

  return authed(async (q) => {
    const bundle = vcfToBundle(text);
    if (bundle.contacts.length === 0) throw new Error("No contact cards found in that file");
    const proposal = await planBundle(q, bundle, "vcf");
    return { bundle, proposal };
  });
}
