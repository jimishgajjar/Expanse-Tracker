"use client";

import { useState, useRef, type FormEvent, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { CURRENCIES } from "@/lib/currencies";
import type { FinanceReport } from "@/lib/finance-position";
import { saveFinance } from "@/lib/finance-actions";
import { todayISO } from "@/lib/dates";
import { displayMoney,minor,money,payoff } from "@/lib/finance-money";

const control="block w-full rounded-md border bg-background px-2 py-1.5 text-sm";
function Field({label,children}:{label:string;children:ReactNode}) {
  return <label className="grid content-start gap-1 text-xs text-muted-foreground">{label}{children}</label>;
}
function Input({name,label,initial,type="text",required=true}:{name:string;label:string;initial?:string;type?:string;required?:boolean}) {
  return <Field label={label}><input name={name} required={required} defaultValue={initial} type={type} className={control}/></Field>;
}
function Currency({name,label,optional=false}:{name:string;label:string;optional?:boolean}) {
  return <Field label={label}><select name={name} required={!optional} defaultValue="" className={control}>
    <option value="">{optional?"Same as account":"Choose currency"}</option>{CURRENCIES.map(c=><option key={c.code}>{c.code}</option>)}</select></Field>;
}
const modes={review:"Review an account",post:"Book activity",statement:"Record a statement",terms:"Loan payoff",quote:"Update valuation"};
type Mode=keyof typeof modes;

function LoanProjection({terms,account}:{terms:FinanceReport["projections"][number];account:FinanceReport["accounts"][number]}) {
  const [extra,setExtra]=useState("");
  const unit=account.currency;
  if (!unit || !terms.scenario) return <p className="text-sm">{account.name} · Review the balance to calculate payoff.</p>;
  const signed=minor(account.balance,unit);
  const principal=money(signed<BigInt(0)?-signed:BigInt(0),unit);
  let comparison="";
  if (extra.trim()) {
    try {
      const additional=minor(extra,unit);
      if (additional<=BigInt(0)) throw Error();
      const result=payoff(principal,unit,terms.apr,money(minor(terms.payment,unit)+additional,unit),terms.monthly_fee);
      comparison=result.status==="Projected"?result.months+" months · Interest "+displayMoney(result.interest,unit)+" · Fees "+displayMoney(result.fees,unit):result.status;
    } catch {comparison="Enter a positive amount in "+unit+".";}
  }
  const base=terms.scenario;
  return <div className="space-y-2 border-t py-2 text-sm">
    <p><strong>{account.name}</strong> · {displayMoney(principal,unit)} starting debt · {terms.apr}% APR · Payment {displayMoney(terms.payment,unit)}/month · Fee {displayMoney(terms.monthly_fee,unit)}/month.</p>
    <p>{base.status==="Projected"?base.months+" months · Interest "+displayMoney(base.interest,unit)+" · Fees "+displayMoney(base.fees,unit)+" · Final payment "+displayMoney(base.finalPayment,unit):base.status}. {terms.variable?"Variable rate held constant for this estimate.":""}</p>
    <details><summary className="cursor-pointer text-brand">Compare an extra monthly payment</summary>
      <div className="mt-2 max-w-xs"><Field label={"Extra per month in "+unit}><input className={control} value={extra} inputMode="decimal" onChange={e=>setExtra(e.target.value)}/></Field></div>
      <output aria-live="polite">{comparison}</output>
    </details>
  </div>;
}
export function FinanceWorkspace({workspace,data,debtOnly}:{workspace:string;data:FinanceReport;debtOnly:boolean}) {
  const router=useRouter();
  const [mode,setMode]=useState<Mode>(data.report?"post":"review");
  const [accountId,setAccountId]=useState("");
  const [kind,setKind]=useState("purchase");
  const [role,setRole]=useState("");
  const [meaning,setMeaning]=useState("signed");
  const [existing,setExisting]=useState("");
  const [pending,setPending]=useState(false),[message,setMessage]=useState("");
  const request=useRef<string|null>(null);
  const owner=data.role==="owner", editor=data.role!=="viewer";
  const accounts=data.accounts.filter(a=>mode==="review"?!a.currency:!!a.currency &&
    (mode==="terms"?a.role==="loan":mode==="statement"?a.role==="loan" || a.role==="card":true));
  const account=accounts.find(a=>a.id===accountId)??accounts[0];
  const move=kind==="transfer" || kind==="payment";
  const day=todayISO();
  const original=data.entries.find(e=>e.id===existing);
  const choices=data.entries.filter(e=>!e.booked && e.account===account?.id && (move?!!e.destination:
    !e.destination && (["refund","income"].includes(kind)?e.kind==="income":e.kind==="expense")));
  const selectAccount=<Field label="Account"><select className={control} required value={account?.id??""} onChange={e=>{setAccountId(e.target.value);setExisting("");}}>
    {!accounts.length && <option value="">No eligible accounts</option>}{accounts.map(a=><option key={a.id} value={a.id}>{a.name} {a.currency}</option>)}</select></Field>;
  async function submit(e:FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (pending) return;
    const fields=Object.fromEntries([...new FormData(e.currentTarget)].filter(([,v])=>v!==""));
    const payload:Record<string,unknown>={...fields,action:mode,account:account?.id};
    if (mode==="review") Object.assign(payload,{expected:account?.raw,role:account?.role??role,interpretation:account?.role?"signed":meaning,report:data.report??fields.report});
    if (mode==="terms") payload.variable=fields.variable==="on";
    if (mode==="post") Object.assign(payload,{request:request.current??=crypto.randomUUID(),kind});
    if (fields.asOf) payload.asOf=new Date(String(fields.asOf)+"Z").toISOString();
    setPending(true);setMessage("");
    try {
      const result=await saveFinance(workspace,payload);
      if (result.error) {setMessage(result.error);return;}
      request.current=null; setMessage("Saved to this tracker.");setExisting("");setGeneration(g=>g+1);
      if (mode==="review") {
        setRole("");setMeaning("signed");
        if (accounts.length===1) setMode("post");
      }
      router.refresh();
    } catch {setMessage("The save could not be confirmed. Retry with the same details.");}
    finally {setPending(false);}
  }
  const [generation,setGeneration]=useState(0);
  return <div className="space-y-4">
    <section className="dashboard-panel p-4"><h2 className="mb-2 font-semibold">Account balances</h2>
      {data.accounts.map(a=><div key={a.id} className="flex flex-wrap items-baseline justify-between gap-1 border-t py-2 text-sm">
        <span>{a.name} <small className="text-muted-foreground">{a.role??"Awaiting owner review"}{a.archived?" · archived":""}</small></span>
        <span>{a.uncertain?"Transfer or precision review needed":a.currency?displayMoney(a.balance,a.currency):"Recorded "+a.raw+" · currency unconfirmed"}
          {a.rate && <small className="block text-right text-muted-foreground">Rate {a.rate} · {a.quote_source} · {a.quote_date?.slice(0,10)}</small>}</span>
      </div>)}
    </section>
    {editor && <section className="dashboard-panel space-y-3 p-4">
      <nav aria-label="Financial actions" className="flex flex-wrap gap-2">{(Object.entries(modes) as [Mode,string][]).filter(([key])=>
        (owner || key==="post") && (data.report || key==="review") && (!debtOnly || key!=="quote")).map(([key,label])=><button type="button" key={key} aria-pressed={mode===key}
          className={"rounded-md border px-3 py-1.5 text-sm "+(mode===key?"bg-foreground text-background":"")}
          onClick={()=>{setMode(key);setExisting("");setMessage("");request.current=null;}}>{label}</button>)}</nav>
      <form key={mode+generation} onSubmit={submit} className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {mode!=="quote" && selectAccount}
          {mode==="review" && <>
            <Currency name="currency" label="Account currency from your records"/>
            {!data.report && <Currency name="report" label="Reporting currency for this tracker"/>}
            <Field label="Account purpose"><select className={control} required disabled={!!account?.role} value={account?.role??role} onChange={e=>{setRole(e.target.value);setMeaning("signed");}}>
              <option value="">Choose account purpose</option>
              <option value="cash">Liquid cash</option><option value="asset">Other asset</option><option value="card">Credit card</option><option value="loan">Loan</option></select></Field>
            {!account?.role && ["card","loan"].includes(role) && <Field label="How is today's recorded balance expressed?"><select className={control} value={meaning} onChange={e=>setMeaning(e.target.value)}>
              <option value="signed">Signed value (negative means owed)</option><option value="owed">Positive amount owed</option></select></Field>}
            <p className="text-sm">Recorded {account?.raw??"—"} → signed position {account?.role?account.balance:(meaning==="owed" && account && Number(account.raw)>0?"−":"")+(account?.raw??"—")}. This confirms the denomination of this account’s existing entries.</p>
            <label className="self-center text-sm"><input required type="checkbox"/> I checked the account and balance against my records.</label>
          </>}
          {mode==="quote" && <><Currency name="currency" label="Value one unit of"/><Input name="rate" label={"Rate in "+data.report+" per unit"}/></>}
          {mode==="post" && <>
            <Field label="Type"><select className={control} value={kind} onChange={e=>{setKind(e.target.value);setExisting("");}}>
              {Object.entries({purchase:"Purchase",income:"Income",refund:"Purchase refund",interest:"Interest charge",fee:"Fee",payment:"Debt repayment",transfer:"Transfer"}).map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></Field>
            <Field label="Existing ledger ID (leave empty for a new entry)"><input name="existing" list="finance-existing" className={control} value={existing} onChange={e=>setExisting(e.target.value)}/>
              <datalist id="finance-existing">{choices.map(c=><option key={c.id} value={c.id}>{c.posted} · {c.note||c.kind} · {c.amount}</option>)}</datalist></Field>
            <Input key={"amount"+existing} name="amount" label={"Posted amount in "+(account?.currency??"account currency")} initial={original?.amount}/>
            <Input key={"date"+existing} name="date" label="Posting date" type="date" initial={original?.posted??day}/>
            <Input name="note" label="Description" required={false}/>
            {move && <><Field label="Destination account"><select key={existing} className={control} name="destination" required defaultValue={original?.destination??""}><option value="">Choose destination</option>
              {data.accounts.filter(a=>a.currency && a.id!==account?.id).map(a=><option key={a.id} value={a.id}>{a.name} · {a.currency}</option>)}</select></Field>
              <Input name="received" label="Actual amount received (destination currency)" required={false}/>
              <Input name="exchange" label="Destination units per source unit (if currencies differ)" required={false}/>
              <Input name="fee" label="Additional fee charged to source account" required={false}/>
              {kind==="payment" && <><Input name="interestPaid" label="Already-booked interest paid (destination currency)" required={false}/><Input name="feesPaid" label="Already-booked fees paid (destination currency)" required={false}/>
                <p className="text-xs text-muted-foreground">The remainder pays principal. Record newly assessed charges separately.</p></>}
            </>}
            {kind==="refund" && <Field label="Original purchase ID"><input name="refundOf" list="finance-purchases" required className={control}/><datalist id="finance-purchases">{data.entries.filter(e=>e.account===account?.id && ["expense","purchase"].includes(e.kind)).map(e=><option key={e.id} value={e.id}>{e.note} · {e.posted} · {e.amount}</option>)}</datalist></Field>}
            {account?.currency!==data.report && <Input name="rate" label={data.report+" per "+account?.currency+" at booking"}/>}
            {!move && !debtOnly && <details className="sm:col-span-2"><summary className="cursor-pointer text-sm">Receipt in another currency</summary><div className="mt-2 grid gap-2 sm:grid-cols-3">
              <Currency name="originalCurrency" label="Receipt currency" optional/><Input name="original" label="Receipt amount" required={false}/><Input name="originalRate" label="Account units per receipt unit" required={false}/></div></details>}
          </>}
          {(mode==="post" || mode==="quote") && <><Input name="source" label="Rate or booking source" initial={mode==="post"?"Account statement":""}/>
            <Input name="asOf" label="Rate or booking time (UTC)" type="datetime-local" initial={day+"T00:00"}/></>}
          {mode==="statement" && <><Input name="starts" label="Cycle starts" type="date"/><Input name="ends" label="Cycle closes" type="date"/>
            <Input name="due" label="Payment due" type="date"/><Input name="closing" label="Statement balance owed"/><Input name="minimum" label="Minimum payment"/></>}
          {mode==="terms" && <><Input name="apr" label="Annual nominal rate (%)"/><Input name="payment" label="Monthly payment"/><Input name="fee" label="Monthly fee" initial="0"/>
            <label className="text-sm"><input name="variable" type="checkbox"/> Variable rate</label></>}
        </div>
        <button type="submit" disabled={pending || (mode!=="quote" && !account)} className="rounded-md bg-brand px-3 py-2 text-sm font-medium text-brand-foreground disabled:opacity-50">{pending?"Saving…":mode==="review"?"Confirm account":"Save"}</button>
        <p role="status" className="text-sm">{message}</p>
      </form>
    </section>}
    <section className="dashboard-panel space-y-2 p-4"><h2 className="font-semibold">Statements & payoff estimates</h2>
      {!data.statements.length && !data.projections.length && <p className="text-sm">Reviewed statements and loan scenarios appear here.</p>}
      {data.statements.map(v=>{const a=data.accounts.find(a=>a.id===v.account_id);return <p key={v.account_id+v.ends} className="border-t py-2 text-sm">{a?.name} · {v.starts} to {v.ends} · Closing {a?.currency} {v.closing} · Minimum {v.minimum} due {v.due}</p>;})}
      {data.projections.map(v=><LoanProjection key={v.account_id} terms={v} account={data.accounts.find(a=>a.id===v.account_id)!}/>)}
      <p className="text-xs text-muted-foreground">Estimates charge monthly interest at APR ÷ 12 and round to the account’s smallest currency unit before each payment. Your lender’s dates and compounding can differ.</p>
    </section>
    <section className="dashboard-panel space-y-2 p-4"><h2 className="font-semibold">Recent ledger activity</h2>
      <p className="text-xs text-muted-foreground">Latest 100 entries. The workbook includes the full history and the IDs for booking older items.</p>
      {data.entries.map(e=>{const a=data.accounts.find(a=>a.id===e.account),dest=data.accounts.find(a=>a.id===e.destination);
        return <div className="flex flex-wrap justify-between gap-2 border-t py-2 text-sm" key={e.kind+e.id}>
          <span>{e.note||e.kind} <small className="block text-muted-foreground">{e.posted} · {a?.name??"Unassigned"} · {e.kind}</small></span>
          <span className="text-right tabular-nums">{a?.currency??"Unconfirmed units"} {e.amount}
            {dest && <small className="block">Received · {dest.currency??"Unconfirmed units"} {e.received??(dest.currency && a?.currency===dest.currency?e.amount:"Needs review")}</small>}
            {e.report_value && <small className="block text-muted-foreground">Booked · {data.report} {e.report_value}</small>}</span>
        </div>;})}
    </section>
    <section className="dashboard-panel space-y-2 p-4"><h2 className="font-semibold">Planning assumptions</h2><p className="text-sm">Existing budgets and forecasts use the tracker’s original single-currency amounts. Compare them only within their confirmed currency. Current balance valuations use the latest entered quote. Spending uses the rate booked with each entry.</p></section>
  </div>;
}
