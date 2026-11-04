import { createHash, randomUUID } from "node:crypto";
import type { HouseholdDb, HouseholdTransaction } from "./household-db";
import { PgDialect } from "drizzle-orm/pg-core";
import { z } from "zod";
import { todayISO } from "./dates";
import { isPersonalLedger } from "./household-access";
import { authorizePlanning, PlanningError, type PlanningScope } from "./monthly-planning";
import { decimalMoney, moneyCents, statementDate } from "./statement-review";
import { createWithHistory } from "./transaction-create";

const id = z.string().min(1).max(128);
const record = z.object({ mode:z.literal("record"), date:statementDate, account:id, toAccount:id.nullable(), checkedMatches:z.boolean() });
const payment = z.discriminatedUnion("mode", [
  record, z.object({mode:z.literal("link"), key:z.string().min(3).max(130)}), z.object({mode:z.literal("outside")}),
]);
const command = z.object({ id:z.uuid(), peer:id, version:z.string().length(64), payment });
export type SettlementPayment = z.infer<typeof payment>;
type Item = { id:string; creditor:string; amount:string; note:string };
type Candidate = { key:string; id:string; kind:"income"|"expense"|"transfer"; date:string; note:string; account:string; destination:string|null };
type Member = { id:string; name:string; joined:string };
const digest = (input:unknown) => createHash("sha256").update(JSON.stringify(input)).digest("hex");

async function participants(tx: HouseholdTransaction, scope:PlanningScope, peer:string) {
  await authorizePlanning(tx,scope,true);
  if (isPersonalLedger(scope.workspace) || peer === scope.actor) throw new PlanningError("Choose another member of your household.");
  const { rows } = await tx.query<Member>(`SELECT m.user_id AS id, coalesce(nullif(u.name,''),u.email) AS name, m.created_at::text AS joined
    FROM workspace_members m JOIN users u ON u.id=m.user_id WHERE m.workspace_id=$1 AND m.user_id IN ($2,$3)
    AND m.role IN ('owner','member','viewer') ORDER BY m.user_id FOR SHARE OF m`,[scope.workspace,scope.actor,peer]);
  if (rows.length !== 2) throw new PlanningError("Both people must still belong to the household.");
  return rows;
}

async function review(tx: HouseholdTransaction, scope:PlanningScope, peer:string, people:Member[]) {
  const { workspace, actor } = scope;
  const {rows:items} = await tx.query<Item>(`SELECT id, creditor_id AS creditor, amount::text, note FROM splits
    WHERE workspace_id=$1 AND settled_at IS NULL AND ((creditor_id=$2 AND debtor_id=$3) OR (creditor_id=$3 AND debtor_id=$2))
    ORDER BY id FOR UPDATE`,[workspace,actor,peer]);
  const net = items.reduce((total,s) => total + (s.creditor === actor ? moneyCents(s.amount) : -moneyCents(s.amount)),BigInt(0));
  if (!net) throw new PlanningError("There is no outstanding payment between you. Refresh shared expenses.");
  const kind = net > 0 ? "income" as const : "expense" as const;
  const amount = decimalMoney(net > 0 ? net : -net);
  const day = todayISO();
  const {rows:candidates} = await tx.query<Candidate>(`SELECT * FROM (
    SELECT 't:'||t.id AS key,t.id,t.type::text AS kind,t.date::text,t.note,a.name AS account,NULL::text AS destination,
      a.id AS account_id,NULL::text AS destination_id
    FROM transactions t JOIN accounts a ON a.id=t.account_id AND a.workspace_id=t.workspace_id
    WHERE t.workspace_id=$1 AND t.amount=$2::numeric AND t.type=$3::tx_kind AND t.date<=$4
      AND NOT EXISTS (SELECT 1 FROM reimbursements r WHERE r.transaction_id=t.id)
      AND NOT EXISTS (SELECT 1 FROM refund_links f WHERE f.credit_id=t.id OR f.purchase_id=t.id)
    UNION ALL
    SELECT 'x:'||x.id,x.id,'transfer',x.date::text,x.note,a.name,b.name,a.id,b.id
    FROM transfers x JOIN accounts a ON a.id=x.from_account_id AND a.workspace_id=x.workspace_id
    JOIN accounts b ON b.id=x.to_account_id AND b.workspace_id=x.workspace_id
    WHERE x.workspace_id=$1 AND x.amount=$2::numeric AND x.date<=$4
      AND NOT EXISTS (SELECT 1 FROM reimbursements r WHERE r.transfer_id=x.id)
    ) matches ORDER BY date DESC,key`,[workspace,amount,kind,day]);
  const {rows:accounts} = await tx.query<{id:string;name:string}>(`SELECT id,name FROM accounts
    WHERE workspace_id=$1 AND NOT archived ORDER BY name,id`,[workspace]);
  const {rows:[state]} = await tx.query<{generation:string;currency:string}>(`SELECT
    (SELECT count(*)::text FROM reimbursements WHERE workspace_id=$1 AND ((actor_id=$2 AND peer_id=$3) OR (actor_id=$3 AND peer_id=$2))) AS generation,
    (SELECT currency_code FROM app_settings WHERE workspace_id=$1) AS currency`,[workspace,actor,peer]);
  return {items,kind,amount,candidates,accounts,day,version:digest([workspace,actor,peer,people,items,candidates,accounts,state])};
}

export async function reviewReimbursement(db: HouseholdDb, scope:PlanningScope, peer:string) {
  return db.transaction(async tx => review(tx,scope,peer,await participants(tx,scope,id.parse(peer))));
}

export async function settleReimbursement(db: HouseholdDb, scope:PlanningScope, raw:unknown) {
  const input = command.parse(raw);
  const {workspace,actor} = scope;
  const hash = digest([workspace,actor,input]);
  return db.transaction(async tx => {
    await tx.exec("SET TRANSACTION ISOLATION LEVEL SERIALIZABLE");
    const people = await participants(tx,scope,input.peer);
    const prior = (await tx.query<{hash:string;reopened:boolean}>(
      "SELECT request_hash AS hash,reopened_at IS NOT NULL AS reopened FROM reimbursements WHERE id=$1",[input.id])).rows[0];
    if (prior) {
      if (prior.hash === hash && !prior.reopened) return;
      throw new PlanningError("This confirmation has already been used. Review the current balance.");
    }
    const current = await review(tx,scope,input.peer,people);
    if (current.version !== input.version) throw new PlanningError("The IOUs or available payments changed. Review them again.");
    const choice = input.payment;
    let transaction:string|null = null, transfer:string|null = null;
    if (choice.mode === "link") {
      const candidate = current.candidates.find(c => c.key === choice.key);
      if (!candidate) throw new PlanningError("Select an available payment with the matching amount and direction.");
      if (candidate.kind === "transfer") transfer = candidate.id;
      else transaction = candidate.id;
    }
    if (choice.mode === "record") {
      if (choice.date > current.day) throw new PlanningError("Choose the date the payment actually took place.");
      if (current.candidates.length && !choice.checkedMatches) throw new PlanningError("Review the matching payments before recording another.");
      const owns = (account:string) => current.accounts.some(a => a.id === account);
      if (!owns(choice.account) || (choice.toAccount !== null && (!owns(choice.toAccount) || choice.toAccount === choice.account)))
        throw new PlanningError("Choose active household accounts with different transfer endpoints.");
      const name = people.find(p => p.id === input.peer)!.name;
      const note = ("Reimbursement · " + name).slice(0,200);
      if (choice.toAccount) {
        transfer = randomUUID();
        await tx.query(`INSERT INTO transfers(id,workspace_id,from_account_id,to_account_id,amount,date,note)
          VALUES ($1,$2,$3,$4,$5,$6,$7)`,[transfer,workspace,choice.account,choice.toAccount,current.amount,choice.date,note]);
      } else {
        // Run the normal ledger + history write inside this settlement's transaction.
        const dialect = new PgDialect();
        const executor = {execute(query:Parameters<typeof dialect.sqlToQuery>[0]) {
          const compiled = dialect.sqlToQuery(query);
          return tx.query<Record<string,unknown>>(compiled.sql,compiled.params);
        }};
        const entry = await createWithHistory(executor,workspace,{id:actor,name:people.find(p => p.id === actor)!.name},{
          requestId:"reimbursement_"+input.id,type:current.kind,amount:current.amount,date:choice.date,accountId:choice.account,note,
        });
        if (entry.replayed) throw new PlanningError("This payment already exists. Link the existing entry.");
        transaction = entry.id;
      }
    }
    const ids = current.items.map(s => s.id);
    await tx.query(`INSERT INTO reimbursements(id,workspace_id,actor_id,peer_id,kind,amount,method,split_ids,request_hash,transaction_id,transfer_id)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,[input.id,workspace,actor,input.peer,current.kind,current.amount,choice.mode,ids,hash,transaction,transfer]);
    const saved = await tx.query("UPDATE splits SET settled_at=now() WHERE workspace_id=$1 AND id=ANY($2::text[]) AND settled_at IS NULL RETURNING id",[workspace,ids]);
    if (saved.rows.length !== ids.length) throw new PlanningError("The IOUs changed. Review them again.");
  });
}

export type SettlementRow = { id:string; name:string; amount:string; method:"link"|"record"|"outside"; date:string; count:number; paymentLabel:string|null };
export async function listReimbursements(db: HouseholdDb, scope:PlanningScope) {
  return db.transaction(async tx => {
    await authorizePlanning(tx,scope,false);
    if (isPersonalLedger(scope.workspace)) return [];
    return (await tx.query<SettlementRow>(`SELECT r.id,coalesce(nullif(u.name,''),u.email,'Former member') AS name,r.amount::text,r.method,
      coalesce(t.date,x.date,r.created_at::date)::text AS date,cardinality(r.split_ids) AS count,
      CASE WHEN t.id IS NOT NULL THEN a.name WHEN x.id IS NOT NULL THEN concat_ws(' → ',f.name,d.name) END AS "paymentLabel"
      FROM reimbursements r LEFT JOIN users u ON u.id=CASE WHEN r.actor_id=$2 THEN r.peer_id ELSE r.actor_id END
      LEFT JOIN transactions t ON t.id=r.transaction_id AND t.workspace_id=$1 LEFT JOIN accounts a ON a.id=t.account_id AND a.workspace_id=$1
      LEFT JOIN transfers x ON x.id=r.transfer_id AND x.workspace_id=$1 LEFT JOIN accounts f ON f.id=x.from_account_id AND f.workspace_id=$1
      LEFT JOIN accounts d ON d.id=x.to_account_id AND d.workspace_id=$1
      WHERE r.workspace_id=$1 AND $2 IN (r.actor_id,r.peer_id) AND r.reopened_at IS NULL ORDER BY r.created_at DESC,r.id`,[scope.workspace,scope.actor])).rows;
  });
}

export async function reopenReimbursement(db: HouseholdDb, scope:PlanningScope, reimbursement:string) {
  await db.transaction(async tx => {
    await authorizePlanning(tx,scope,true);
    if (isPersonalLedger(scope.workspace)) throw new PlanningError("Open the household tracker.");
    const {rows:[row]} = await tx.query<{split_ids:string[];reopened_at:Date|null}>(`SELECT split_ids,reopened_at FROM reimbursements
      WHERE workspace_id=$1 AND id=$2 AND $3 IN (actor_id,peer_id) FOR UPDATE`,[scope.workspace,id.parse(reimbursement),scope.actor]);
    if (!row) throw new PlanningError("This reimbursement is unavailable.");
    if (row.reopened_at) return;
    const restored = await tx.query(`UPDATE splits SET settled_at=NULL
      WHERE workspace_id=$1 AND id=ANY($2::text[]) AND settled_at IS NOT NULL RETURNING id`,[scope.workspace,row.split_ids]);
    if (restored.rows.length !== row.split_ids.length) throw new PlanningError("The original IOUs changed. The settlement could not be reopened.");
    await tx.query("UPDATE reimbursements SET reopened_at=now(), transaction_id=NULL, transfer_id=NULL WHERE id=$1",[reimbursement]);
  });
}
