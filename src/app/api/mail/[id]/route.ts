import { handle, userClient } from "@/lib/server/auth";
import { getThread } from "@/lib/server/google";

export const runtime = "nodejs";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return handle(async () => {
    const { sb, userId } = await userClient(req);
    return getThread(userId, sb, id);
  });
}
