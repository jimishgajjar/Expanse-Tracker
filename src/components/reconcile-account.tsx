"use client";

import { useId, useState } from "react";
import { Scale } from "lucide-react";
import { ManagerPanel } from "./manager-panel";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { useFormat } from "./settings-provider";
import { todayISO } from "@/lib/dates";
import { statementComparison } from "@/lib/reconciliation";
import type { AccountDTO, TransactionDTO, TransferDTO } from "@/lib/queries";

export function ReconcileAccount({account, transactions, transfers}: {account: AccountDTO; transactions: TransactionDTO[]; transfers: TransferDTO[]}) {
  const id = useId();
  const [date, setDate] = useState(todayISO);
  const [amount, setAmount] = useState("");
  const { money, signedMoney } = useFormat();
  const valid = amount.trim() !== "" && Number.isFinite(Number(amount)) && /^\d{4}-\d{2}-\d{2}$/.test(date);
  const comparison = valid ? statementComparison(account.initialBalance, transactions, transfers, account.id, date, Number(amount)) : null;
  return <ManagerPanel title="Check against a statement" description={account.name} icon={Scale} trigger={<Button variant="outline" size="sm"><Scale className="size-4" />Check balance</Button>}>
    <p className="text-sm text-muted-foreground">Enter the closing balance from your bank statement. This comparison never changes your account or transactions.</p>
    <div className="space-y-2"><Label htmlFor={`${id}-date`}>Statement closing date</Label><Input id={`${id}-date`} type="date" value={date} onChange={e => setDate(e.target.value)} /></div>
    <div className="space-y-2"><Label htmlFor={`${id}-amount`}>Statement closing balance</Label><Input id={`${id}-amount`} type="number" step="0.01" inputMode="decimal" placeholder="0.00" value={amount} onChange={e => setAmount(e.target.value)} /></div>
    {comparison && <section className="dashboard-panel space-y-3 p-4" aria-live="polite"><h3 className="font-semibold">{comparison.matched ? "Balances match" : "Difference to investigate"}</h3><dl className="grid grid-cols-2 gap-2 text-sm"><dt>Ledger through {date}</dt><dd className="text-right tabular-nums">{money(comparison.ledger)}</dd><dt>Statement balance</dt><dd className="text-right tabular-nums">{money(Number(amount))}</dd><dt>Statement minus ledger</dt><dd className="text-right font-semibold tabular-nums">{signedMoney(comparison.difference)}</dd></dl><p className="text-xs text-muted-foreground">Includes opening balance, income, expenses, and transfers through the closing date. Pending bank payments and different posting dates can explain a difference.</p>{!comparison.matched && <p className="text-sm">Review missing or duplicate entries, transfers, and the opening balance in the account activity. Correct only entries you can verify against the statement.</p>}</section>}
  </ManagerPanel>;
}
