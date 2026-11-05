import { addDays, differenceInCalendarDays, format, parseISO } from "date-fns";
import { projectTimeline, type ForecastEvent } from "./balance-forecast";
import { decimalMoney, moneyCents } from "./statement-review";

export type PlanOptions = { account: string; horizon: "payday" | "30" | "60" | "90"; scenario: "base" | "conservative"; includeExpectedPay: boolean };
export type EvidenceRow = { key: string; date: string; change: string; signature: string; fingerprint: string; refund: boolean };
export type PlanEvent = { key: string; date: string; change: string; source: ForecastEvent["source"]; signature: string; rule: string | null };
export type PlanEvidence = {
  options: PlanOptions; start: string; end: string; currency: string; opening: string;
  daily: string; buffer: string; reserved: string; events: PlanEvent[]; known: EvidenceRow[];
  goals: string[]; rules: string[]; issues: string[];
};
export type ComparisonLine = { key: string; label: string; kind: "correction" | "timing" | "amount" | "unconfirmed" | "recorded" | "allowance" | "matched";
  planned: string; actual: string; difference: string; plannedDate: string | null; actualDate: string | null };

export function evaluatePurchase(plan: PlanEvidence, amount: string, date: string, labels: Record<string,string>) {
  const original: ForecastEvent[] = plan.events.map(e => ({ ...e, cashChange: e.change, label: labels[e.key] ?? "Planned entry", detail: "", href: "" }));
  const project = (events: ForecastEvent[]) => {
    const result = projectTimeline(events.map(e => ({...e})), moneyCents(plan.opening), moneyCents(plan.opening), moneyCents(plan.daily), plan.start, plan.end);
    return { lowest: result.lowest, date: result.lowDate, closing: result.closing,
      available: decimalMoney(moneyCents(result.lowest) - moneyCents(plan.reserved) - moneyCents(plan.buffer)) };
  };
  const purchase: ForecastEvent = { key:"temporary-purchase",date,label:"Proposed purchase",detail:"",href:"",source:"Purchase scenario",change:decimalMoney(-moneyCents(amount)),cashChange:decimalMoney(-moneyCents(amount)) };
  const baseline = project(original), proposed = project([...original, purchase]);
  // A named incoming amount is a sensitivity example, never an asserted payday.
  const incoming = original.filter(e => moneyCents(e.change)>BigInt(0)).sort((a,b) => moneyCents(a.change)>moneyCents(b.change)?-1:moneyCents(a.change)<moneyCents(b.change)?1:a.key.localeCompare(b.key))[0];
  const delayedDate = incoming ? format(addDays(parseISO(incoming.date),7),"yyyy-MM-dd") : null;
  const delayed = incoming ? project([...original.filter(e=>e.key!==incoming.key),...(delayedDate!<=plan.end?[{...incoming,date:delayedDate!}]:[]),purchase]) : null;
  return { baseline, proposed, difference:decimalMoney(moneyCents(proposed.lowest)-moneyCents(baseline.lowest)),
    status: plan.issues.length ? "incomplete" as const : moneyCents(proposed.available)<BigInt(0) ? "shortfall" as const : "within_plan" as const,
    sensitivity: incoming ? { label:incoming.label, amount:incoming.change, originalDate:incoming.date, delayedDate:delayedDate!, result:delayed! } : null,
    extraDailyCost:decimalMoney(BigInt(differenceInCalendarDays(parseISO(plan.end),parseISO(plan.start)))*BigInt(100)) };
}

/** All differences reconcile to actual minus saved projection; a missing posting is not proof of a missed payment. */
export function comparePlan(plan: PlanEvidence, current: EvidenceRow[], currentInitial: string, through: string, labels: Record<string,string>) {
  const active = (row: EvidenceRow) => row.date>plan.start && row.date<=through;
  const earlier = current.filter(r=>r.date<=plan.start).reduce((s,r)=>s+moneyCents(r.change),moneyCents(currentInitial));
  const actual = current.filter(r=>r.date<=through).reduce((s,r)=>s+moneyCents(r.change),moneyCents(currentInitial));
  const known = new Map(plan.known.map(r=>[r.key,r])), byId = new Map(current.map(r=>[r.key,r]));
  const used = new Set<string>(), lines: ComparisonLine[] = [];
  const add = (line: Omit<ComparisonLine,"difference">) => lines.push({...line,difference:decimalMoney(moneyCents(line.actual)-moneyCents(line.planned))});
  if(earlier!==moneyCents(plan.opening))add({key:"opening",label:"Opening balance or earlier ledger history changed",kind:"correction",planned:plan.opening,actual:decimalMoney(earlier),plannedDate:plan.start,actualDate:plan.start});
  // Match already-recorded entries by immutable ID before matching estimates to new entries.
  const ordered = [...plan.events].sort((a,b)=>Number(!known.has(a.key))-Number(!known.has(b.key))||a.date.localeCompare(b.date)||a.key.localeCompare(b.key));
  let expected = moneyCents(plan.opening);
  for(const event of ordered) {
    const due = event.date<=through;
    if(due)expected+=moneyCents(event.change);
    let match = known.has(event.key) ? byId.get(event.key) : undefined;
    if(!known.has(event.key)&&event.signature) {
      const candidates=current.filter(r=>!used.has(r.key)&&active(r)&&!known.has(r.key)&&!r.refund&&r.signature===event.signature&&Math.abs(differenceInCalendarDays(parseISO(r.date),parseISO(event.date)))<=3);
      if(candidates.length===1&&ordered.filter(other=>!known.has(other.key)&&other.signature===event.signature&&Math.abs(differenceInCalendarDays(parseISO(candidates[0].date),parseISO(other.date)))<=3).length===1)match=candidates[0];
    }
    if(!due&&(!match||!active(match)))continue;
    if(match)used.add(match.key);
    const planned=due?event.change:"0.00", recorded=match&&active(match)?match.change:"0.00";
    const edited = known.has(event.key)&&(!match||known.get(event.key)!.fingerprint!==match.fingerprint);
    const kind = edited?"correction":!match?"unconfirmed":event.date!==match.date?"timing":event.change!==match.change?"amount":"matched";
    add({key:event.key,label:labels[event.key]??"Saved planned entry",kind,planned,actual:recorded,plannedDate:event.date,actualDate:match?.date??null});
  }
  for(const row of current.filter(r=>active(r)&&!used.has(r.key))) {
    const previous=known.get(row.key);
    add({key:row.key,label:labels[row.key]??(row.refund?"Recorded refund":"Additional recorded entry"),kind:previous&&previous.fingerprint!==row.fingerprint?"correction":"recorded",
      planned:"0.00",actual:row.change,plannedDate:previous?.date??null,actualDate:row.date});
  }
  const allowance=-moneyCents(plan.daily)*BigInt(differenceInCalendarDays(parseISO(through),parseISO(plan.start)));
  expected+=allowance;
  if(allowance!==BigInt(0))add({key:"daily",label:"Everyday spending allowance (compare with additional recorded expenses)",kind:"allowance",planned:decimalMoney(allowance),actual:"0.00",plannedDate:through,actualDate:null});
  return {through,expected:decimalMoney(expected),actual:decimalMoney(actual),difference:decimalMoney(actual-expected),lines};
}
