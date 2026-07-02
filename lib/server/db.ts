import { Pool, type PoolClient } from "pg";

// Server-side data access with RLS enforced per request.
//
// Every query runs inside a transaction as role `authenticated` with the
// caller's JWT claims in `request.jwt.claims` — the exact mechanism hosted
// Supabase uses and the SQL test suite proves. Works identically against the
// local dev cluster (scripts/db-dev.sh) and, later, the dedicated dev Supabase
// project via its Postgres connection string.
//
// HARD RULE: DATABASE_URL must never point at the shared production project
// vlezoyalutexenbnzzui. Guarded below.

const FORBIDDEN_REF = "vlezoyalutexenbnzzui";

function connectionString(): string {
  const url =
    process.env.DATABASE_URL ??
    // Zero-config dev default: the cluster scripts/db-dev.sh runs.
    "postgres://postgres@localhost:55432/kg_core_dev";
  if (url.includes(FORBIDDEN_REF)) {
    throw new Error(
      "DATABASE_URL points at the shared production Supabase project. Refusing to start."
    );
  }
  return url;
}

let pool: Pool | null = null;
function getPool(): Pool {
  if (!pool) pool = new Pool({ connectionString: connectionString(), max: 5 });
  return pool;
}

export type Rls = PoolClient;

// Run `fn` as the authenticated user identified by `sub` (Auth0 subject),
// under RLS, in a single transaction. Rolls back on any throw.
export async function withRls<T>(
  sub: string,
  fn: (q: Rls) => Promise<T>
): Promise<T> {
  const client = await getPool().connect();
  try {
    await client.query("begin");
    await client.query("select set_config('request.jwt.claims', $1, true)", [
      JSON.stringify({ sub }),
    ]);
    await client.query("set local role authenticated");
    const result = await fn(client);
    await client.query("commit");
    return result;
  } catch (err) {
    await client.query("rollback").catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

// Append an events row inside the caller's transaction. actor_type resolves
// to 'operator' for super_admins, 'user' otherwise; actor/client come from
// the session, so callers can't spoof them.
export async function logEvent(
  q: Rls,
  e: {
    verb: string;
    targetType: string;
    targetId: string | null;
    payload?: Record<string, unknown>;
    durationMs?: number;
  }
): Promise<void> {
  await q.query(
    `insert into public.events
       (client_id, actor_type, actor_id, verb, target_type, target_id, payload, duration_ms)
     values
       (public.current_client_id(),
        case when public.is_operator() then 'operator' else 'user' end,
        public.current_user_id(), $1, $2, $3, $4, $5)`,
    [
      e.verb,
      e.targetType,
      e.targetId,
      JSON.stringify(e.payload ?? {}),
      e.durationMs ?? null,
    ]
  );
}
