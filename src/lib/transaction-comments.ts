import { createHash } from "node:crypto";
import type { HouseholdDb, HouseholdTransaction } from "./household-db";
import { z } from "zod";
import { canEditSharedLedger, isPersonalLedger } from "./household-access";

type Scope = { workspace: string; actor: string };
export class CommentError extends Error {
  constructor(message: string, readonly status: number) { super(message); }
}

export const commentInput = z.strictObject({
  requestId: z.uuid(),
  body: z.string().trim().min(1).max(1000).refine(body => !body.includes("\0")),
  mentions: z.array(z.string().min(1).max(128).refine(id => !id.includes("\0"))).max(10).optional(),
});
export const commentId = z.string().regex(/^[a-f0-9]{64}$/);
export const commentCursor = z.object({ at: z.iso.datetime(), id: commentId });
export type CommentCursor = z.infer<typeof commentCursor>;
export type CommentRow = { id: string; body: string; author: string; at: string; canRemove: boolean; mentions:string[] };
export type CommentPage = {
  rows: CommentRow[]; next: CommentCursor | null; canPost: boolean; personal: boolean; targets:{id:string; name:string}[];
};

// Lock the parent and membership for the entire operation. Tracker selection and
// commenting permissions never come from a request body or a share recipient.
async function access(tx: HouseholdTransaction, scope: Scope, entry: string) {
  const {rows:[member]} = await tx.query<{role:string; owner:boolean}>(`
    SELECT m.role,(m.role='owner' AND w.owner_id=m.user_id) AS owner
    FROM transactions t JOIN workspace_members m ON m.workspace_id=t.workspace_id
    JOIN workspaces w ON w.id=t.workspace_id
    WHERE t.id=$1 AND t.workspace_id=$2 AND m.user_id=$3 AND m.role IN ('owner','member','viewer')
    FOR SHARE OF t,m,w`, [entry,scope.workspace,scope.actor]);
  if (!member) throw new CommentError("Transaction unavailable.",404);
  return member;
}

function requireWriter(role: string) {
  if (!canEditSharedLedger(role)) throw new CommentError("Editing access is required to change comments.",403);
}

export async function readComments(db: HouseholdDb, scope: Scope, entry: string, before: CommentCursor|null = null): Promise<CommentPage> {
  return db.transaction(async tx => {
    const member = await access(tx,scope,entry);
    const canPost = canEditSharedLedger(member.role);
    const personal = isPersonalLedger(scope.workspace);
    const targets = canPost && !personal ? (await tx.query<{id:string;name:string}>(`
      SELECT u.id, CASE WHEN nullif(u.name,'') IS NULL THEN u.email
        WHEN count(*) OVER (PARTITION BY lower(u.name)) > 1 THEN u.name || ' (' || u.email || ')'
        ELSE u.name END AS name FROM workspace_members m JOIN users u ON u.id=m.user_id
      WHERE m.workspace_id=$1 AND m.user_id<>$2 AND m.role IN ('owner','member','viewer') ORDER BY name,u.id`,[scope.workspace,scope.actor])).rows : [];
    const {rows} = await tx.query<CommentRow>(`SELECT c.id,c.body,coalesce(nullif(u.name,''),'Tracker member') AS author,
      ARRAY(SELECT coalesce(nullif(p.name,''),p.email) FROM comment_mentions cm JOIN users p ON p.id=cm.user_id
        WHERE cm.comment_id=c.id AND cm.workspace_id=$7 ORDER BY 1,cm.user_id) AS mentions,
      to_char(c.created_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS at,
      ($2::boolean AND ($3::boolean OR c.author_id IS NOT DISTINCT FROM $4::text)) AS "canRemove"
      FROM transaction_comments c LEFT JOIN users u ON u.id=c.author_id
      WHERE c.transaction_id=$1 AND ($5::timestamptz IS NULL OR (c.created_at,c.id)<($5::timestamptz,$6::text))
      ORDER BY c.created_at DESC,c.id DESC LIMIT 26`,[entry,canPost,member.owner,scope.actor,before?.at??null,before?.id??null,scope.workspace]);
    const page = rows.slice(0,25);
    const last = page.at(-1);
    return {rows:page,next:rows.length>page.length && last ? {at:last.at,id:last.id} : null,canPost,personal,targets};
  });
}

export async function postComment(db: HouseholdDb, scope: Scope, entry: string, input: z.infer<typeof commentInput>) {
  const {body,requestId,mentions} = commentInput.parse(input);
  const recipients = [...new Set(mentions)].sort();
  const id = createHash("sha256").update(JSON.stringify([scope.workspace,entry,scope.actor,requestId])).digest("hex");
  return db.transaction(async tx => {
    requireWriter((await access(tx,scope,entry)).role);
    const inserted = await tx.query("INSERT INTO transaction_comments(id,transaction_id,author_id,body) VALUES ($1,$2,$3,$4) ON CONFLICT(id) DO NOTHING RETURNING id",
      [id,entry,scope.actor,body]);
    if (inserted.rows.length) {
      if (recipients.length) {
        if (isPersonalLedger(scope.workspace) || recipients.includes(scope.actor)) throw new CommentError("Choose other members of this household.",400);
        const eligible = await tx.query(`SELECT user_id FROM workspace_members WHERE workspace_id=$1
          AND user_id=ANY($2::text[]) AND role IN ('owner','member','viewer') FOR SHARE`,[scope.workspace,recipients]);
        if (eligible.rows.length !== recipients.length) throw new CommentError("A selected member is unavailable. Review your mentions.",400);
        await tx.query("INSERT INTO comment_mentions(comment_id,workspace_id,user_id) SELECT $1,$2,unnest($3::text[])",[id,scope.workspace,recipients]);
      }
      return {id,created:true};
    }
    const prior = await tx.query("SELECT id FROM transaction_comments WHERE id=$1 AND transaction_id=$2 AND author_id=$3 AND body=$4",
      [id,entry,scope.actor,body]);
    if (!prior.rows.length) throw new CommentError("This submission changed or was removed. Review the conversation before posting again.",409);
    const saved = await tx.query<{user_id:string}>("SELECT user_id FROM comment_mentions WHERE comment_id=$1",[id]);
    if (JSON.stringify(saved.rows.map(r=>r.user_id).sort()) !== JSON.stringify(recipients)) throw new CommentError("The mentions on this submission changed. Review the comment.",409);
    return {id,created:false};
  });
}

export async function removeComment(db: HouseholdDb, scope: Scope, entry: string, id: string) {
  await db.transaction(async tx => {
    const member = await access(tx,scope,entry);
    requireWriter(member.role);
    const changed = await tx.query(`UPDATE transaction_comments SET body=NULL,transaction_id=NULL,author_id=NULL
      WHERE id=$1 AND transaction_id=$2 AND (author_id=$3 OR $4::boolean) RETURNING id`,[id,entry,scope.actor,member.owner]);
    if (!changed.rows.length) throw new CommentError("Comment unavailable or you cannot remove it.",404);
    await tx.query("DELETE FROM comment_mentions WHERE comment_id=$1",[id]);
  });
}
