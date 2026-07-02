import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

// Storage seam (same pattern as auth/extraction): Supabase Storage when the
// dedicated dev project exists (SUPABASE_URL + SERVICE_ROLE_KEY set), local
// disk otherwise so uploads work TODAY. Paths are identical either way:
// <client_id>/<project_id>/<uuid>-<filename>. Never the shared prod project.

const BUCKET = process.env.SUPABASE_STORAGE_BUCKET ?? "documents";
const LOCAL_ROOT = join(process.cwd(), ".local", "storage", BUCKET);

function supabaseConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY
  );
}

async function supabaseStorage() {
  const { createClient } = await import("@supabase/supabase-js");
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  if (url.includes("vlezoyalutexenbnzzui")) {
    throw new Error("Storage refuses the shared production Supabase project.");
  }
  return createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY!).storage.from(BUCKET);
}

export async function storagePut(
  path: string,
  bytes: Buffer,
  mime: string
): Promise<void> {
  if (supabaseConfigured()) {
    const bucket = await supabaseStorage();
    const { error } = await bucket.upload(path, bytes, { contentType: mime, upsert: false });
    if (error) throw new Error(`Storage upload failed: ${error.message}`);
    return;
  }
  const full = join(LOCAL_ROOT, path);
  await mkdir(dirname(full), { recursive: true });
  await writeFile(full, bytes);
}

export async function storageGet(path: string): Promise<Buffer> {
  if (supabaseConfigured()) {
    const bucket = await supabaseStorage();
    const { data, error } = await bucket.download(path);
    if (error || !data) throw new Error(`Storage download failed: ${error?.message}`);
    return Buffer.from(await data.arrayBuffer());
  }
  return readFile(join(LOCAL_ROOT, path));
}
