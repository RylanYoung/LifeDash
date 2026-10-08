import { handle, userClient } from "@/lib/server/auth";
import { getSendAs } from "@/lib/server/google";

export const runtime = "nodejs";

/** The Gmail display name and signature, so compose can show it under the message. */
export async function GET(req: Request) {
  return handle(async () => {
    const { sb, userId } = await userClient(req);
    return getSendAs(userId, sb);
  });
}
