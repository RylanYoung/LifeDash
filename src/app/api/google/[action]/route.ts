import { handle, HttpError, userClient } from "@/lib/server/auth";
import { account, authUrl, connect, disconnect } from "@/lib/server/google";

export const runtime = "nodejs";

const redirectUri = (req: Request) => `${new URL(req.url).origin}/google/callback`;

/** GET /api/google/status | /api/google/auth-url?state=... */
export async function GET(req: Request, { params }: { params: Promise<{ action: string }> }) {
  const { action } = await params;
  return handle(async () => {
    const { sb } = await userClient(req);
    if (action === "status") {
      const acc = await account(sb);
      return { connected: Boolean(acc), email: acc?.email ?? null, timeZone: acc?.time_zone ?? null };
    }
    if (action === "auth-url") {
      const state = new URL(req.url).searchParams.get("state") ?? "";
      return { url: authUrl(redirectUri(req), state) };
    }
    throw new HttpError(404, "Unknown action.");
  });
}

/** POST /api/google/exchange {code} | /api/google/disconnect */
export async function POST(req: Request, { params }: { params: Promise<{ action: string }> }) {
  const { action } = await params;
  return handle(async () => {
    const { sb, userId } = await userClient(req);
    if (action === "exchange") {
      const { code } = await req.json();
      if (!code) throw new HttpError(400, "Missing code.");
      return connect(sb, userId, code, redirectUri(req));
    }
    if (action === "disconnect") {
      disconnect(userId);
      const { error } = await sb.from("google_accounts").delete().eq("user_id", userId);
      if (error) throw new HttpError(500, error.message);
      return { ok: true };
    }
    throw new HttpError(404, "Unknown action.");
  });
}
