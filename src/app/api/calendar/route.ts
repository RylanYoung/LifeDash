import { handle, HttpError, userClient } from "@/lib/server/auth";
import { createEvent, listEvents } from "@/lib/server/google";

export const runtime = "nodejs";

/** GET /api/calendar?from=ISO&to=ISO */
export async function GET(req: Request) {
  return handle(async () => {
    const { sb, userId } = await userClient(req);
    const p = new URL(req.url).searchParams;
    const from = p.get("from");
    const to = p.get("to");
    if (!from || !to) throw new HttpError(400, "from and to are required.");
    return { events: await listEvents(userId, sb, from, to) };
  });
}

export async function POST(req: Request) {
  return handle(async () => {
    const { sb, userId } = await userClient(req);
    return createEvent(userId, sb, await req.json());
  });
}
