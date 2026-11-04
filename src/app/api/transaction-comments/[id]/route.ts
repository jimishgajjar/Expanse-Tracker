import { getHouseholdDb } from "@/lib/household-db";
import { householdFeaturesEnabled, sameHouseholdOrigin } from "@/lib/household-features";
import { getSession } from "@/lib/session";
import { VIEW_HEADER } from "@/lib/tracker-view";
import { notifyWorkspace } from "@/lib/notify";
import { commentLink } from "@/lib/comment-link";
import { CommentError, commentCursor, commentId, commentInput, postComment, readComments, removeComment } from "@/lib/transaction-comments";

type Context = { params: Promise<{id:string}> };
const headers = {"Cache-Control":"private, no-store","X-Content-Type-Options":"nosniff"};
const json = (data:unknown,status=200) => Response.json(data,{headers,status});

async function handle(req:Request, {params}:Context) {
  if (!householdFeaturesEnabled()) return json({error:"Unavailable."},404);
  const session = await getSession();
  if (!session?.workspaceId) return json({error:"Reopen your tracker to view comments."},401);
  if (req.headers.get(VIEW_HEADER) !== session.viewKey)
    return json({error:"The active tracker changed. Reopen the transaction."},403);
  if (req.method !== "GET" && !sameHouseholdOrigin(req))
    return json({error:"Reopen the transaction before posting changes."},403);
  const db = await getHouseholdDb();
  if (!db) return json({error:"Unavailable."},404);
  const {id} = await params;
  const scope = {workspace:session.workspaceId,actor:session.user.id};
  const query = new URL(req.url).searchParams;
  try {
    if (req.method === "GET") {
      if (!query.has("at") && !query.has("before")) return json(await readComments(db,scope,id));
      const cursor = commentCursor.safeParse({at:query.get("at"),id:query.get("before")});
      if (!cursor.success) return json({error:"Invalid comment page."},400);
      return json(await readComments(db,scope,id,cursor.data));
    }
    if (req.method === "DELETE") {
      const selected = commentId.safeParse(query.get("comment"));
      if (!selected.success) return json({error:"Choose a comment to remove."},400);
      await removeComment(db,scope,id,selected.data);
      return json({ok:true});
    }
    const input = commentInput.safeParse(await req.json().catch(() => null));
    if (!input.success) return json({error:"Write a comment between 1 and 1,000 characters."},400);
    const result = await postComment(db,scope,id,input.data);
    if (result.created && input.data.mentions?.length) {
      await notifyWorkspace(scope.workspace,{topic:"mention",comment:result.id,title:"You were mentioned in a comment",
        body:"Open the shared transaction conversation to read the mention.",ctaLabel:"Read conversation",
        url:commentLink(id,scope.workspace) ?? "/?tab=transactions"});
    }
    return json({id:result.id},result.created?201:200);
  } catch (error) {
    return error instanceof CommentError ? json({error:error.message},error.status) : json({error:"Couldn’t load or save the comment. Try again."},500);
  }
}
export { handle as GET, handle as POST, handle as DELETE };
