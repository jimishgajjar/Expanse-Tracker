import { z } from "zod";
import { getHouseholdDb } from "@/lib/household-db";
import { getSession } from "@/lib/session";
import { VIEW_HEADER } from "@/lib/tracker-view";
import { sameHouseholdOrigin } from "@/lib/household-features";
import {
  confirmAccountShare, previewAccountShare, previewPhoto, receivedReport, receivedShares,
  ShareError, sharedPhoto, sharingOptions, stopAccountShare,
} from "@/lib/account-share-store";

const headers = { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" };
const json = (data: unknown, status = 200) => Response.json(data, { status, headers });
const id = z.string().min(1).max(128);
const choice = z.object({ account:id, recipient:id, photos:z.boolean() });
const command = z.discriminatedUnion("action", [
  choice.extend({ action:z.literal("preview") }),
  choice.extend({ action:z.literal("confirm"), token:z.string().length(64), expires:z.number().int() }),
  z.object({ action:z.literal("stop"), account:id, recipient:id, revision:id }),
]);

async function handle(req: Request) {
  const db = await getHouseholdDb();
  if (!db) return json({error:"Unavailable."},404);
  const session = await getSession();
  if (!session?.workspaceId) return json({error:"Reopen the tracker."},401);
  const scope = { workspace:session.workspaceId, actor:session.user.id, sessionId:session.sessionId };
  const url = new URL(req.url);
  try {
    if (req.method === "POST") {
      if (req.headers.get(VIEW_HEADER) !== session.viewKey || !sameHouseholdOrigin(req))
        return json({error:"Reopen this tracker before changing sharing."},403);
      const parsed = command.safeParse(await req.json().catch(() => null));
      if (!parsed.success) return json({error:"Invalid sharing request."},400);
      const input = parsed.data;
      if (input.action === "preview") return json(await previewAccountShare(db,scope,input));
      if (input.action === "confirm") await confirmAccountShare(db,scope,input,input.token,input.expires);
      else await stopAccountShare(db,scope,input.account,input.recipient,input.revision);
      return json({ok:true});
    }
    const account = url.searchParams.get("account");
    const share = url.searchParams.get("share");
    const photo = url.searchParams.get("photo");
    if (photo) {
      const version = url.searchParams.get("v") ?? "";
      const data = account ? await previewPhoto(db,scope,account,photo,version) : await sharedPhoto(db,scope,share ?? "",version,photo);
      return new Response(new Uint8Array(data), {headers:{...headers,"Content-Type":"image/jpeg","Content-Disposition":"inline"}});
    }
    if (account) return json(await sharingOptions(db,scope,account));
    const list = await receivedShares(db,scope);
    const selected = list.find(item => item.id === share);
    const detail = selected && selected.revision !== url.searchParams.get("v") ? await receivedReport(db,scope,selected.id) : null;
    return json({list,detail});
  } catch (error) {
    return error instanceof ShareError ? json({error:error.message},error.status) : json({error:"Could not check sharing. Please reopen the preview."},500);
  }
}
export { handle as GET, handle as POST };
