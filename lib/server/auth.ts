// Session resolution, in order of preference:
//   1. Auth0 — active when AUTH0_DOMAIN + AUTH0_CLIENT_ID are configured
//      (lazy-loaded so the app builds and runs without the SDK initialized).
//   2. DEV_BYPASS=true — a local development user mapped to the seed fixture
//      admin. No credentials involved; it only works against a database that
//      has the fixture's auth0_sub values.
//   3. Neither -> unauthenticated (APIs return 401).

export type SessionClaims = { sub: string };

export async function getSessionClaims(): Promise<SessionClaims | null> {
  if (process.env.AUTH0_DOMAIN && process.env.AUTH0_CLIENT_ID) {
    const { getAuth0Session } = await import("./auth0");
    const session = await getAuth0Session();
    return session?.user?.sub ? { sub: session.user.sub } : null;
  }

  if (process.env.DEV_BYPASS === "true") {
    return { sub: process.env.DEV_BYPASS_SUB ?? "auth0|harborline-admin" };
  }

  return null;
}
