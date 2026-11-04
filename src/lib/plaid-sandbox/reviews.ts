import { randomUUID } from "node:crypto";
import type { PGlite, Transaction } from "@electric-sql/pglite";
import { decimalMoney, moneyCents } from "../statement-review";
import { observationVersion } from "./inbox";
import { SandboxError, type Observation } from "./provider";

type Choice = { id: string; name: string };
export type ReviewDecision = "match" | "import" | "ignore";
export type ReviewOptions = {
  currency: string;
  accounts: Choice[];
  categories: (Choice & {kind: string})[];
  receipts: {id: string; decision: ReviewDecision; version: string}[];
};
export type Booking = {account: string; currency: string; settled?: string};
export type Decision = {kind: "ignore"} | (Booking & (
  {kind: "match"; target: string} | {kind: "import"; category: string | null; acknowledgeMatches: boolean}
));
export type Candidate = {id: string; date: string; label: string};

const currencyQuery = "SELECT COALESCE((SELECT currency_code FROM app_settings WHERE workspace_id=$1),'INR') AS currency";
const kindOf = (row: Observation) => row.amount < 0 ? "income" : "expense";
function reject(code: string): never { throw new SandboxError(code); }

// This table belongs exclusively to the dedicated local preview. Keeping the receipt
// and ledger entry in one transaction makes retries safe even if the response is lost.
export class SandboxReviews {
  private ready: Promise<unknown>;
  constructor(private db: PGlite) {
    this.ready = db.exec(`CREATE TABLE IF NOT EXISTS sandbox_bank_reviews (
      workspace text NOT NULL, bank_account text NOT NULL, source_id text NOT NULL,
      version text NOT NULL, decision text NOT NULL, target text, snapshot jsonb NOT NULL,
      PRIMARY KEY(workspace,bank_account,source_id), UNIQUE(workspace,target))`);
  }
  async options(ws: string, bank: string): Promise<ReviewOptions> {
    await this.ready;
    return this.db.transaction(async tx => ({
      currency: (await tx.query<{currency:string}>(currencyQuery,[ws])).rows[0].currency,
      accounts: (await tx.query<Choice>("SELECT id,name FROM accounts WHERE workspace_id=$1 AND NOT archived ORDER BY name,id",[ws])).rows,
      categories: (await tx.query<Choice & {kind:string}>("SELECT id,name,kind FROM categories WHERE workspace_id=$1 ORDER BY name,id",[ws])).rows,
      receipts: (await tx.query<ReviewOptions["receipts"][number]>("SELECT source_id AS id,version,decision FROM sandbox_bank_reviews WHERE workspace=$1 AND bank_account=$2",[ws,bank])).rows,
    }));
  }
  private async booking(tx: Transaction, ws: string, row: Observation, input: Booking) {
    if (row.pending || !row.amount || !row.iso_currency_code) reject("UNBOOKABLE");
    const {rows:[settings]} = await tx.query<{currency:string}>(currencyQuery,[ws]);
    if (settings.currency !== input.currency) reject("REVIEW_CHANGED");
    const raw = row.iso_currency_code === input.currency ? String(Math.abs(row.amount)) : input.settled;
    if (!raw || !/^\d{1,12}(\.\d{1,2})?$/.test(raw) || moneyCents(raw) <= BigInt(0)) reject("SETTLED_AMOUNT_REQUIRED");
    const amount = decimalMoney(moneyCents(raw));
    if (!(await tx.query("SELECT id FROM accounts WHERE workspace_id=$1 AND id=$2 AND NOT archived",[ws,input.account])).rows.length) reject("REVIEW_CHANGED");
    const {rows:candidates} = await tx.query<Candidate>(`SELECT t.id,t.date::text,COALESCE(NULLIF(t.note,''),'Tracker entry') AS label
      FROM transactions t WHERE t.workspace_id=$1 AND t.account_id=$2 AND t.type=$3 AND t.amount=$4
      AND t.date BETWEEN $5::date-7 AND $5::date+7 AND NOT EXISTS (
        SELECT 1 FROM sandbox_bank_reviews r WHERE r.workspace=t.workspace_id AND r.target=t.id)
      ORDER BY abs(t.date-$5::date),t.id`,[ws,input.account,kindOf(row),amount,row.date]);
    return {amount,candidates};
  }
  async preview(ws:string, row:Observation, input:Booking) {
    await this.ready;
    return this.db.transaction(tx=>this.booking(tx,ws,row,input));
  }
  async decide(ws:string, actor:string, row:Observation, version:string, decision:Decision) {
    await this.ready;
    if (version !== observationVersion(row) || row.pending) reject("REVIEW_CHANGED");
    await this.db.transaction(async tx=>{
      const source = [ws,row.account_id,row.transaction_id];
      const prior = await tx.query("SELECT 1 FROM sandbox_bank_reviews WHERE workspace=$1 AND bank_account=$2 AND source_id=$3",source);
      if (prior.rows.length) reject("ALREADY_REVIEWED");
      let target:string|null = null;
      if (decision.kind !== "ignore") {
        const {amount,candidates} = await this.booking(tx,ws,row,decision);
        if (decision.kind === "match") {
          if (!candidates.some(item=>item.id===decision.target)) reject("REVIEW_CHANGED");
          target = decision.target;
        } else {
          const schema = await tx.query<{ready:boolean}>("SELECT to_regclass('public.opening_cutoffs') IS NOT NULL AS ready");
          if (schema.rows[0].ready && (await tx.query("SELECT 1 FROM opening_cutoffs WHERE account_id=$1 AND workspace_id=$2 AND through_date >= $3::date",[decision.account,ws,row.date])).rows.length) reject("OPENING_CUTOFF");
          if (candidates.length && !decision.acknowledgeMatches) reject("MATCH_AVAILABLE");
          if (decision.category && !(await tx.query("SELECT id FROM categories WHERE workspace_id=$1 AND kind=$2 AND id=$3",[ws,kindOf(row),decision.category])).rows.length) reject("REVIEW_CHANGED");
          target = randomUUID();
          await tx.query(`INSERT INTO transactions(id,workspace_id,account_id,type,amount,date,note,category_id,created_by)
            VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,[target,ws,decision.account,kindOf(row),amount,row.date,row.name??"Bank transaction",decision.category,actor]);
        }
      }
      await tx.query(`INSERT INTO sandbox_bank_reviews(workspace,bank_account,source_id,version,decision,target,snapshot)
        VALUES($1,$2,$3,$4,$5,$6,$7)`,[...source,version,decision.kind,target,JSON.stringify({row,decision})]);
    });
  }
}
