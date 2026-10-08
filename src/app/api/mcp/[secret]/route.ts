import { ownerClient } from "@/lib/server/auth";
import { TOOLS, callTool } from "@/lib/server/tools";

/**
 * Hosted MCP endpoint (Streamable HTTP, JSON responses) for claude.ai's
 * "Add custom connector" and for scheduled Claude routines.
 *
 * Auth is a long random secret in the path, because the connector dialog
 * accepts only a URL. Anyone holding the URL can act as the owner: treat it
 * like a password. Queries run as the owner under row-level security.
 */

export const runtime = "nodejs";

const HEADERS = { "Content-Type": "application/json", "Cache-Control": "no-store" };

type Rpc = { jsonrpc: "2.0"; id?: string | number | null; method?: string; params?: Record<string, unknown> };

const result = (id: Rpc["id"], r: unknown) => new Response(JSON.stringify({ jsonrpc: "2.0", id, result: r }), { headers: HEADERS });
const rpcError = (id: Rpc["id"], code: number, message: string) =>
  new Response(JSON.stringify({ jsonrpc: "2.0", id, error: { code, message } }), { headers: HEADERS });

const INSTRUCTIONS =
  "This is the owner's Daybook: their to-do lists, Gmail, Google Calendar and business context. " +
  "Start with get_today for anything about today. Use get_business_context for business questions; personal lists are " +
  "not context, but you may read or change them when the owner asks. Never use em dashes in anything you write.";

export async function POST(req: Request, { params }: { params: Promise<{ secret: string }> }) {
  const { secret } = await params;
  const expected = process.env.MCP_SECRET;
  if (!expected) return rpcError(null, -32000, "Server has no MCP_SECRET configured.");
  if (secret !== expected) return new Response(JSON.stringify({ error: "Not found" }), { status: 404, headers: HEADERS });

  let body: Rpc;
  try {
    body = await req.json();
  } catch {
    return rpcError(null, -32700, "Parse error");
  }
  const { id = null, method, params: p = {} } = body;
  if (method?.startsWith("notifications/")) return new Response(null, { status: 202 });

  switch (method) {
    case "initialize":
      return result(id, {
        protocolVersion: (p as { protocolVersion?: string }).protocolVersion ?? "2025-06-18",
        capabilities: { tools: { listChanged: false } },
        serverInfo: { name: "daybook", version: "1.0.0" },
        instructions: INSTRUCTIONS,
      });
    case "ping":
      return result(id, {});
    case "tools/list":
      return result(id, { tools: TOOLS });
    case "tools/call": {
      const { name, arguments: args = {} } = p as { name: string; arguments?: Record<string, unknown> };
      try {
        const { sb, userId } = await ownerClient();
        const out = await callTool(sb, userId, name, args);
        return result(id, { content: [{ type: "text", text: JSON.stringify(out, null, 2) }] });
      } catch (e) {
        // Tool failures are results, so the model can read the message and correct itself.
        return result(id, { content: [{ type: "text", text: `ERROR: ${e instanceof Error ? e.message : String(e)}` }], isError: true });
      }
    }
    default:
      return rpcError(id, -32601, `Method not found: ${method}`);
  }
}

/** Clients may probe with GET for a server-initiated stream; there is none. */
export async function GET() {
  return new Response("Method Not Allowed", { status: 405, headers: { Allow: "POST" } });
}
