import { createBrowserClient } from "@supabase/ssr";

// Browser-side Supabase client. Auth is Auth0 (not Supabase Auth): the Auth0
// access token is forwarded as the Supabase JWT so RLS helpers can read the
// `sub` claim (see supabase/migrations/*_rls_helpers.sql). Token wiring lands
// with the Auth0 integration; until then this is the anonymous client.
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
