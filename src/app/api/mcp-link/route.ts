import { handle, HttpError, userClient } from "@/lib/server/auth";

export const runtime = "nodejs";

/**
 * Hands the signed-in owner their connector URL. The secret never ships in
 * the page bundle; it is returned only after the session is verified.
 */
export async function GET(req: Request) {
  return handle(async () => {
    const { email } = await userClient(req);
    const secret = process.env.MCP_SECRET;
    if (!secret) throw new HttpError(500, "Set MCP_SECRET on the server to enable the Claude connector.");
    const owner = process.env.OWNER_EMAIL?.toLowerCase();
    if (owner && email.toLowerCase() !== owner) throw new HttpError(403, "Only the owner can see the connector link.");
    return { url: `${new URL(req.url).origin}/api/mcp/${secret}`, ownerSet: Boolean(owner && process.env.OWNER_PASSWORD) };
  });
}
