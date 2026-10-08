import { handle, HttpError, userClient } from "@/lib/server/auth";
import { listThreads, modifyThread, sendMail } from "@/lib/server/google";

export const runtime = "nodejs";

/** GET /api/mail?folder=inbox&q=... */
export async function GET(req: Request) {
  return handle(async () => {
    const { sb, userId } = await userClient(req);
    const p = new URL(req.url).searchParams;
    return { threads: await listThreads(userId, sb, { folder: p.get("folder") ?? "inbox", q: p.get("q") ?? "" }) };
  });
}

/** POST /api/mail {action: "send", ...} | {action: "modify", id, add, remove} */
export async function POST(req: Request) {
  return handle(async () => {
    const { sb, userId } = await userClient(req);
    const body = await req.json();
    if (body.action === "send") return sendMail(userId, sb, body);
    if (body.action === "modify") return modifyThread(userId, sb, body.id, body.add, body.remove);
    throw new HttpError(400, "Unknown action.");
  });
}
