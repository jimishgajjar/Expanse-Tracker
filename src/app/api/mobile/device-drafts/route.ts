import { z } from "zod";
import { getSession } from "@/lib/session";
import { getActiveWorkspace } from "@/lib/workspace";
import { getDb } from "@/lib/db";
import { createWithHistory, TransactionCreateError, transactionCreateSchema } from "@/lib/transaction-create";
import type { DeviceReceipt } from "@/lib/mobile-contract";

const envelope = z.object({
  actor: z.string(), workspace: z.string(), requestId: z.uuid(),
  entry: transactionCreateSchema,
});

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return Response.json({error:"Sign in again."}, {status:401});
  const workspace = await getActiveWorkspace();
  const parsed = envelope.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({error:"Review the amount, date, and account.",code:"invalid"}, {status:422});
  const {actor, workspace:target, requestId, entry} = parsed.data;
  if (request.headers.get("x-tracker-view") !== session.viewKey || actor !== session.user.id ||
      target !== workspace?.id || !["owner","member"].includes(workspace.role)) {
    return Response.json({error:"Reopen the original tracker with permission to add entries."}, {status:403});
  }
  if (entry.allocations) return Response.json({error:"Split purchases must be reviewed in the tracker.",code:"invalid"},{status:422});
  try {
    const result = await createWithHistory(await getDb(), target, {id:actor,name:session.user.name || session.user.email},
      {...entry,requestId});
    const receipt: DeviceReceipt = {requestId,transactionId:result.id,replayed:result.replayed};
    return Response.json(receipt,{headers:{"Cache-Control":"private, no-store"}});
  } catch (error) {
    if (error instanceof TransactionCreateError)
      return Response.json({error:error.message,code:error.reason},{status:error.reason === "invalid" ? 422 : 409});
    return Response.json({error:"Could not confirm the save. Retry this same draft."},{status:503});
  }
}
