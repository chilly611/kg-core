import { Auth0Client } from "@auth0/nextjs-auth0/server";

// Only imported (dynamically) when AUTH0_* env is present — see auth.ts.
// UNTESTED until a tenant exists; exercised the first time real AUTH0_* creds
// land in .env.local. Configuration comes entirely from env:
//   AUTH0_DOMAIN, AUTH0_CLIENT_ID, AUTH0_CLIENT_SECRET, AUTH0_SECRET,
//   APP_BASE_URL (defaults handled by the SDK where possible).

let client: Auth0Client | null = null;

function getClient(): Auth0Client {
  if (!client) client = new Auth0Client();
  return client;
}

export async function getAuth0Session() {
  return getClient().getSession();
}
