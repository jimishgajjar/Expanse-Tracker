import { z } from "zod";
const ZERO = BigInt(0), HUNDRED = BigInt(100);

export const statementDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(value => {
  const date = new Date(`${value}T00:00:00Z`);
  return !value.startsWith("0000") && !Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === value;
}, "Choose a valid calendar date.");
export const statementAmount = z.string().trim().regex(/^-?\d{1,12}(\.\d{1,2})?$/, "Use a balance with at most two decimal places.");
export const statementInput = z.object({
  id: z.uuid(), accountId: z.string().min(1).max(128),
  start: statementDate, end: statementDate, closingBalance: statementAmount,
}).refine(value => value.start <= value.end, "The closing date must be on or after the starting date.");
export type StatementInput = z.infer<typeof statementInput>;
export type ReviewChoice = "cleared" | "outstanding";
export type ReviewEntry = {
  id: string; date: string; kind: "income" | "expense" | "transfer";
  amount: string; delta: string; note: string; accountId: string;
  fromAccountId?: string; toAccountId?: string;
};
export type LedgerSnapshot = { initialBalance: string; currency: string; entries: ReviewEntry[] };
export type EntryChange = { before:ReviewEntry|null; after:ReviewEntry|null };
export type StatementReview = {
  id: string; accountId: string; start: string; end: string; closingBalance: string;
  snapshot: LedgerSnapshot; decisions: Record<string, ReviewChoice>; duplicatesReviewed: boolean;
  status: "draft" | "completed"; effectiveStatus: "draft" | "completed" | "needs_review";
  version: number; actorName: string; createdAt: string; completedAt: string | null;
  changes: string[];
  entryChanges: EntryChange[];
  omittedChanges: number;
};

/** Decimal strings remain exact even when a large account total exceeds JS safe cents. */
export function moneyCents(value: string): bigint {
  if (!/^-?\d+(\.\d{1,2})?$/.test(value)) throw new Error("Invalid stored monetary amount.");
  const negative = value.startsWith("-");
  const [whole, fraction = ""] = value.replace(/^-/, "").split(".");
  const cents = BigInt(whole) * HUNDRED + BigInt(fraction.padEnd(2, "0"));
  return negative ? -cents : cents;
}
export function decimalMoney(value: bigint): string {
  const absolute = value < ZERO ? -value : value;
  return `${value < ZERO ? "-" : ""}${absolute / HUNDRED}.${String(absolute % HUNDRED).padStart(2, "0")}`;
}

export function analyseStatement(snapshot: LedgerSnapshot, start: string, end: string, closing: string, decisions: Record<string, ReviewChoice>, duplicatesReviewed = false) {
  let opening = moneyCents(snapshot.initialBalance), cleared = ZERO, outstanding = ZERO, unreviewedAmount = ZERO;
  const entries = snapshot.entries.filter(entry => entry.date >= start && entry.date <= end);
  for (const entry of snapshot.entries) if (entry.date < start) opening += moneyCents(entry.delta);
  const groups = new Map<string, string[]>();
  for (const entry of entries) {
    const key = `${entry.date}:${entry.kind}:${entry.delta}`;
    groups.set(key, [...(groups.get(key) ?? []), entry.id]);
    if (decisions[entry.id] === "cleared") cleared += moneyCents(entry.delta);
    else if (decisions[entry.id] === "outstanding") outstanding += moneyCents(entry.delta);
    else unreviewedAmount += moneyCents(entry.delta);
  }
  const duplicateIds = [...groups.values()].filter(ids => ids.length > 1).flat();
  const unreviewed = entries.filter(entry => !decisions[entry.id]).length;
  const difference = moneyCents(closing) - opening - cleared;
  return {
    entries, duplicateIds, unreviewed, opening: decimalMoney(opening),
    clearedClosing: decimalMoney(opening + cleared), ledgerClosing: decimalMoney(opening + cleared + outstanding + unreviewedAmount),
    outstanding: decimalMoney(outstanding), difference: decimalMoney(difference),
    canComplete: difference === ZERO && unreviewed === 0 && (duplicateIds.length === 0 || duplicatesReviewed),
  };
}

export function compareSnapshots(before: LedgerSnapshot, current: LedgerSnapshot | null, limit=50) {
  const entryChanges:EntryChange[]=[];
  if (!current) return {changes:["This account was removed or is no longer accessible."],entryChanges,omittedChanges:0};
  const changes: string[] = [];
  if (before.initialBalance !== current.initialBalance) changes.push("Opening balance: "+before.currency+" "+before.initialBalance+" → "+current.currency+" "+current.initialBalance+".");
  if (before.currency !== current.currency) changes.push("Workspace currency: "+before.currency+" → "+current.currency+".");
  const old = new Map(before.entries.map(entry => [entry.id, entry]));
  const now = new Map(current.entries.map(entry => [entry.id, entry]));
  let added=0,removed=0,changed=0;
  for(const entry of current.entries){
    const previous=old.get(entry.id);
    if(!previous) added++;
    else if((Object.keys(entry) as (keyof ReviewEntry)[]).some(key=>entry[key]!==previous[key])) changed++;
    else continue;
    if(entryChanges.length<limit)entryChanges.push({before:previous??null,after:entry});
  }
  for(const entry of before.entries)if(!now.has(entry.id)){
    removed++; if(entryChanges.length<limit)entryChanges.push({before:entry,after:null});
  }
  if (added) changes.push(`${added} ${added === 1 ? "entry was" : "entries were"} added or moved into this account or period.`);
  if (removed) changes.push(`${removed} ${removed === 1 ? "entry was" : "entries were"} deleted or moved out of this account or period.`);
  if (changed) changes.push(`${changed} ${changed === 1 ? "entry changed" : "entries changed"} amount, date, account, type or note.`);
  return {changes,entryChanges,omittedChanges:added+removed+changed-entryChanges.length};
}
