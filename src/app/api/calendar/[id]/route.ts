import { handle, userClient } from "@/lib/server/auth";
import { deleteEvent, updateEvent } from "@/lib/server/google";

export const runtime = "nodejs";

type P = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, { params }: P) {
  const { id } = await params;
  return handle(async () => {
    const { sb, userId } = await userClient(req);
    return updateEvent(userId, sb, id, await req.json());
  });
}

export async function DELETE(req: Request, { params }: P) {
  const { id } = await params;
  return handle(async () => {
    const { sb, userId } = await userClient(req);
    return deleteEvent(userId, sb, id);
  });
}
