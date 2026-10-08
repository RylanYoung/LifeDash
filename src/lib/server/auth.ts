import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Server-side Supabase access. Two ways in, and neither uses a service-role key:
 *
 *  - userClient(req): the browser sends its access token; queries run as that
 *    user under row-level security.
 *  - ownerClient(): the MCP connector has no browser session, so it signs in
 *    as the owner with OWNER_EMAIL / OWNER_PASSWORD. Same RLS applies.
 */

export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

function env() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) throw new HttpError(500, "Supabase is not configured on the server.");
  return { url, anon };
}

export type Ctx = { sb: SupabaseClient; userId: string; email: string };

export async function userClient(req: Request): Promise<Ctx> {
  const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) throw new HttpError(401, "Not signed in.");
  const { url, anon } = env();
  const sb = createClient(url, anon, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data, error } = await sb.auth.getUser(token);
  if (error || !data.user) throw new HttpError(401, "Not signed in.");
  return { sb, userId: data.user.id, email: data.user.email ?? "" };
}

let cached: (Ctx & { at: number }) | null = null;

export async function ownerClient(): Promise<Ctx> {
  if (cached && Date.now() - cached.at < 30 * 60_000) return cached;
  const { url, anon } = env();
  const email = process.env.OWNER_EMAIL;
  const password = process.env.OWNER_PASSWORD;
  if (!email || !password) throw new HttpError(500, "Server is missing OWNER_EMAIL or OWNER_PASSWORD.");
  const sb = createClient(url, anon, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await sb.auth.signInWithPassword({ email, password });
  if (error) throw new HttpError(500, `Could not sign in as the owner: ${error.message}`);
  cached = { sb, userId: data.user.id, email, at: Date.now() };
  return cached;
}

export const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });

/** Wrap a route body so thrown errors become clean JSON responses. */
export async function handle(fn: () => Promise<unknown>): Promise<Response> {
  try {
    return json(await fn());
  } catch (e) {
    const status = e instanceof HttpError ? e.status : 500;
    return json({ error: e instanceof Error ? e.message : String(e) }, status);
  }
}
