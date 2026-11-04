import { createHash, randomUUID } from "node:crypto";
import { z } from "zod";
import type { HouseholdDb, HouseholdTransaction } from "./household-db";
import { accountPositions, financeAccess, type FinanceAccount, type FinanceScope } from "./finance-position";
import { converted, currencyDigits, minor, money, payoff, rateUnits, transferResidual } from "./finance-money";

const id=z.string().min(1).max(128);
const code=z.string().regex(/^[A-Z]{3}$/);
const amount=z.string().trim().regex(/^-?\d{1,12}(?:\.\d{1,10})?$/);
const source=z.string().trim().min(1).max(120);
const date=z.iso.date();
const instant=z.iso.datetime({offset:true});
const kinds=["income","purchase","interest","fee","refund","transfer","payment"] as const;
const review=z.object({action:z.literal("review"),account:id,role:z.enum(["cash","asset","card","loan"]),
  currency:code,report:code,expected:amount,interpretation:z.enum(["signed","owed"])});
const quote=z.object({action:z.literal("quote"),currency:code,rate:amount,source,asOf:instant});
const statement=z.object({action:z.literal("statement"),account:id,starts:date,ends:date,due:date,closing:amount,minimum:amount});
const terms=z.object({action:z.literal("terms"),account:id,apr:amount,payment:amount,fee:amount,variable:z.boolean()});
const posting=z.object({action:z.literal("post"),request:z.uuid(),kind:z.enum(kinds),account:id,amount,date,
  note:z.string().trim().max(250).default(""),destination:id.optional(),received:amount.optional(),exchange:amount.optional(),
  fee:amount.optional(),interestPaid:amount.optional(),feesPaid:amount.optional(),rate:amount.optional(),source,asOf:instant,refundOf:id.optional(),existing:id.optional(),
  original:amount.optional(),originalCurrency:code.optional(),originalRate:amount.optional()});
export const financeCommand=z.discriminatedUnion("action",[review,quote,statement,terms,posting]);
type Posting=z.infer<typeof posting>;
type ReviewedAccount=FinanceAccount & {currency:string};
function positive(value:string,code:string) {
  if (minor(value,code)<=BigInt(0)) throw Error("The amount must be positive.");
  return money(minor(value,code),code);
}
function reviewed(accounts:FinanceAccount[],id:string|undefined):ReviewedAccount {
  const account=accounts.find(a=>a.id===id);
  if (!account?.currency) throw Error("Confirm this account and its currency first.");
  return account as ReviewedAccount;
}
function checkedTime(asOf:string) {
  if (Date.parse(asOf)>Date.now()) throw Error("The exchange-rate time must be in the past or present.");
}

async function bookMovement(tx:HouseholdTransaction,s:FinanceScope,p:Posting,accounts:FinanceAccount[],report:string) {
  const account=reviewed(accounts,p.account);
  const value=positive(p.amount,account.currency);
  const conversion=account.currency===report?"1":p.rate??null;
  if (!conversion) throw Error("Enter the booked reporting rate from the statement or receipt.");
  const booked=conversion ? converted(value,account.currency,report,conversion):null;
  const originalCurrency=p.originalCurrency??account.currency;
  if (originalCurrency!==account.currency && !p.original) throw Error("Enter the original receipt amount.");
  const original=positive(p.original??value,originalCurrency);
  if (originalCurrency!==account.currency && !p.originalRate) throw Error("Enter the original-to-account exchange rate.");
  const originalRate=originalCurrency===account.currency?"1":p.originalRate!;
  if (converted(original,originalCurrency,account.currency,originalRate)!==value) throw Error("The original amount and rate must reconcile to the posted account amount.");
  const move=p.kind==="transfer" || p.kind==="payment";
  if (account.archived && !p.existing) throw Error("Choose an active account.");
  if (p.kind==="interest" && !["card","loan"].includes(account.role!)) throw Error("Choose a liability account.");
  let principal:string|null=null,interestPaid:string|null=null,feesPaid:string|null=null;
  let txId:string|null=null,transferId:string|null=null,received:string|null=null,destinationCurrency:string|null=null,exchange:string|null=null,residual:string|null=null;
  const ledgerId=p.existing??randomUUID();
  if (move) {
    const dest=reviewed(accounts,p.destination);
    if (dest.id===account.id || (!p.existing && dest.archived)) throw Error("Choose a different, active destination.");
    if (p.kind==="payment" && (account.role!=="cash" || !["card","loan"].includes(dest.role!))) throw Error("Repay a card or loan from a liquid account.");
    destinationCurrency=dest.currency;
    received=positive(p.received??(dest.currency===account.currency?value:""),dest.currency);
    exchange=dest.currency===account.currency?"1":p.exchange??"";
    residual=transferResidual(value,account.currency,received,dest.currency,exchange);
    if (p.kind==="payment") {
      const interest=minor(p.interestPaid??"0",dest.currency),fees=minor(p.feesPaid??"0",dest.currency);
      const remainder=minor(received,dest.currency)-interest-fees;
      if (interest<BigInt(0) || fees<BigInt(0) || remainder<BigInt(0)) throw Error("Payment allocations must fit within the amount received.");
      principal=money(remainder,dest.currency); interestPaid=money(interest,dest.currency); feesPaid=money(fees,dest.currency);
    }
    transferId=ledgerId;
    if (p.existing) {
      const found=await tx.query("SELECT id FROM transfers WHERE id=$1 AND workspace_id=$2 AND from_account_id=$3 AND to_account_id=$4 AND amount=$5 AND date=$6 FOR UPDATE",
        [ledgerId,s.workspace,account.id,dest.id,value,p.date]);
      if (!found.rows.length) throw Error("The original transfer does not match these legs or date.");
    } else await tx.query("INSERT INTO transfers(id,workspace_id,from_account_id,to_account_id,amount,date,note) VALUES($1,$2,$3,$4,$5,$6,$7)",
      [ledgerId,s.workspace,account.id,dest.id,value,p.date,p.note]);
  } else {
    const type=p.kind==="income" || p.kind==="refund"?"income":"expense";
    if (p.kind==="refund") {
      const {rows:[purchase]}=await tx.query<{amount:string}>(`SELECT amount::text FROM transactions WHERE id=$1 AND workspace_id=$2 AND account_id=$3
        AND type='expense' AND date<=$4 AND NOT EXISTS(SELECT 1 FROM finance_bookings WHERE transaction_id=$1 AND kind<>'purchase') FOR UPDATE`,[p.refundOf??"",s.workspace,account.id,p.date]);
      if (!purchase) throw Error("Choose a purchase from this account on or before the refund date.");
      const {rows:[used]}=await tx.query<{total:string}>(`SELECT coalesce(sum(n),0)::text AS total FROM (
        SELECT account_amount AS n FROM finance_bookings WHERE workspace_id=$1 AND refund_of=$2
        UNION ALL SELECT t.amount FROM refund_links r JOIN transactions t ON t.id=r.credit_id AND t.workspace_id=r.workspace_id
          WHERE r.workspace_id=$1 AND r.purchase_id=$2 AND r.credit_id<>$3 AND NOT EXISTS(SELECT 1 FROM finance_bookings b WHERE b.transaction_id=r.credit_id)
      ) credits`,[s.workspace,p.refundOf,p.existing??""]);
      if (minor(value,account.currency)>minor(purchase.amount,account.currency)-minor(used.total,account.currency)) throw Error("The refund exceeds the remaining purchase amount.");
    }
    txId=ledgerId;
    if (p.existing) {
      const found=await tx.query(`SELECT id FROM transactions WHERE id=$1 AND workspace_id=$2 AND account_id=$3 AND type=$4 AND amount=$5 AND date=$6
        AND NOT EXISTS(SELECT 1 FROM refund_links WHERE credit_id=$1 AND purchase_id IS DISTINCT FROM $7) FOR UPDATE`,[ledgerId,s.workspace,account.id,type,value,p.date,p.kind==="refund"?p.refundOf:null]);
      if (!found.rows.length) throw Error("The existing entry differs or already has a refund link.");
    } else await tx.query("INSERT INTO transactions(id,workspace_id,account_id,type,amount,date,note,created_by) VALUES($1,$2,$3,$4,$5,$6,$7,$8)",
      [ledgerId,s.workspace,account.id,type,value,p.date,p.note,s.actor]);
  }
  await tx.query(`INSERT INTO finance_bookings(id,operation_id,workspace_id,transaction_id,transfer_id,refund_of,kind,original_amount,original_currency,original_rate,
     account_amount,account_currency,reporting_amount,reporting_currency,booked_rate,source,as_of,received,destination_currency,exchange_rate,residual,principal_paid,interest_paid,fees_paid)
     VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24)`,
    [randomUUID(),p.request,s.workspace,txId,transferId,p.kind==="refund"?p.refundOf:null,p.kind,original,originalCurrency,originalRate,value,account.currency,
      booked,report,conversion,p.source,p.asOf,received,destinationCurrency,exchange,residual,principal,interestPaid,feesPaid]);
}

export async function applyFinance(db:HouseholdDb,s:FinanceScope,raw:unknown,debtOnly=false) {
  const input=financeCommand.parse(raw);
  await db.transaction(async tx=>{
    await financeAccess(tx,s,input.action==="post"?"write":"owner");
    // Serialize reviews, refund limits and request retries for this tracker.
    await tx.query("SELECT pg_advisory_xact_lock(hashtext($1))",[s.workspace]);
    const accounts=(await tx.query<FinanceAccount>(accountPositions,[s.workspace])).rows;
    const {rows:[book]}=await tx.query<{currency:string}>("SELECT currency FROM finance_books WHERE workspace_id=$1",[s.workspace]);
    if (debtOnly && (input.action==="quote" || (input.action==="review" && input.currency!==input.report))) throw Error("This release supports one confirmed currency. Open the multicurrency preview for FX.");
    if (input.action==="review") {
      const a=accounts.find(a=>a.id===input.account);
      currencyDigits(input.report);
      if (!a || a.currency || (a.role && a.role!==input.role) || (book && book.currency!==input.report)) throw Error("Reopen the account review and confirm the current reporting currency.");
      currencyDigits(input.currency);
      // The old ledger has two decimal places, even for accounts later reviewed as JPY.
      // An incoming legacy FX transfer can temporarily carry a fractional source amount.
      if (minor(a.raw,"CAD")!==minor(input.expected,"CAD")) throw Error("The balance changed. Review the new balance before confirming.");
      if (input.currency==="JPY") {
        const fractional=await tx.query(`SELECT 1 FROM accounts WHERE id=$2 AND workspace_id=$1 AND initial_balance<>trunc(initial_balance)
          UNION ALL SELECT 1 FROM transactions WHERE workspace_id=$1 AND account_id=$2 AND amount<>trunc(amount)
          UNION ALL SELECT 1 FROM transfers WHERE workspace_id=$1 AND from_account_id=$2 AND amount<>trunc(amount) LIMIT 1`,[s.workspace,a.id]);
        if (fractional.rows.length) throw Error("Historical fractional amounts need review before confirming JPY.");
      }
      const current=minor(a.raw,"CAD");
      if (input.interpretation==="owed" && (!["loan","card"].includes(input.role) || current<BigInt(0) || a.uncertain)) throw Error("Review the transfer legs and positive debt balance before reversing its sign.");
      const correction=input.interpretation==="owed"?-BigInt(2)*minor(a.raw,input.currency):BigInt(0);
      await tx.query("INSERT INTO finance_books(workspace_id,currency) VALUES($1,$2) ON CONFLICT DO NOTHING",[s.workspace,input.report]);
      await tx.query("INSERT INTO finance_accounts(workspace_id,account_id,role,reviewed_balance,adjustment,interpretation,reviewer) VALUES($1,$2,$3,$4,$5,$6,$7) ON CONFLICT(workspace_id,account_id) DO NOTHING",
        [s.workspace,a.id,input.role,a.raw,money(correction,input.currency),input.interpretation,s.actor]);
      await tx.query("INSERT INTO account_denominations VALUES($1,$2,$3)",[s.workspace,a.id,input.currency]);
      return;
    }
    if (!book) throw Error("The owner must review an account first.");
    if (input.action==="quote") {
      checkedTime(input.asOf); rateUnits(input.rate); currencyDigits(input.currency);
      if (input.currency===book.currency) throw Error("The reporting currency already values at one.");
      await tx.query("INSERT INTO valuation_quotes(workspace_id,currency,as_of,rate,source) VALUES($1,$2,$3,$4,$5)",[s.workspace,input.currency,input.asOf,input.rate,input.source]);
      return;
    }
    const a=reviewed(accounts,input.account);
    if (input.action==="statement") {
      if (!["card","loan"].includes(a.role!)) throw Error("Choose a card or loan.");
      const closing=minor(input.closing,a.currency), minimum=minor(input.minimum,a.currency);
      if (input.starts>input.ends || input.ends>input.due || minimum<BigInt(0) || minimum>(closing>BigInt(0)?closing:BigInt(0))) throw Error("Check the statement dates, closing amount and minimum due.");
      const overlap=await tx.query("SELECT 1 FROM debt_statements WHERE workspace_id=$1 AND account_id=$2 AND starts<=$4 AND ends>=$3",[s.workspace,a.id,input.starts,input.ends]);
      if (overlap.rows.length) throw Error("This statement period overlaps another statement.");
      await tx.query("INSERT INTO debt_statements VALUES($1,$2,$3,$4,$5,$6,$7)",[s.workspace,a.id,input.starts,input.ends,input.due,input.closing,input.minimum]);
    } else if (input.action==="terms") {
      if (a.role!=="loan") throw Error("Choose a reviewed loan.");
      payoff("0",a.currency,input.apr,input.payment,input.fee);
      await tx.query(`INSERT INTO loan_terms VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT(workspace_id,account_id) DO UPDATE
        SET apr=excluded.apr,payment=excluded.payment,monthly_fee=excluded.monthly_fee,variable=excluded.variable`,[s.workspace,a.id,input.apr,input.payment,input.fee,input.variable]);
    } else {
      checkedTime(input.asOf);
      if (debtOnly && (a.currency!==book.currency || input.originalCurrency && input.originalCurrency!==a.currency ||
          input.destination && reviewed(accounts,input.destination).currency!==a.currency)) throw Error("Foreign activity requires the multicurrency release.");
      const fingerprint=createHash("sha256").update(JSON.stringify(input)).digest("hex");
      const {rows}=await tx.query("INSERT INTO finance_operations VALUES($1,$2,$3,$4) ON CONFLICT DO NOTHING RETURNING id",[input.request,s.workspace,s.actor,fingerprint]);
      if (!rows.length) {
        const duplicate=await tx.query("SELECT 1 FROM finance_operations WHERE id=$1 AND workspace_id=$2 AND actor=$3 AND fingerprint=$4",[input.request,s.workspace,s.actor,fingerprint]);
        if (!duplicate.rows.length) throw Error("This request was previously used for a different entry.");
        return;
      }
      await bookMovement(tx,s,input,accounts,book.currency);
      if (input.fee && minor(input.fee,a.currency)!==BigInt(0)) {
        if (!["payment","transfer"].includes(input.kind)) throw Error("A separate transfer fee requires a transfer or payment.");
        await bookMovement(tx,s,{...input,kind:"fee",amount:input.fee,original:undefined,originalCurrency:undefined,originalRate:undefined,existing:undefined,note:"Transfer fee · "+input.note},accounts,book.currency);
      }
    }
  });
}
