"use client";

import { useState, useTransition, type ReactElement } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowRightLeft, Wallet } from "lucide-react";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { FormError } from "./form-error";
import { useFormat } from "./settings-provider";
import { convertEntryToTransfer, findTransferCandidates, moveEntryToOpeningBalance } from "@/lib/convert-transfer-actions";
import { shortDay } from "@/lib/dates";
import type { AccountDTO, TransactionDTO } from "@/lib/queries";
import { cn } from "@/lib/utils";

type Candidate = Awaited<ReturnType<typeof findTransferCandidates>>[number];

/**
 * Fix money that moved between the household's own accounts but was recorded as spending
 * or income. Both options keep account balances exactly as they are.
 */
export function ConvertTransferDialog({ t, accounts, trigger }: { t: TransactionDTO; accounts: AccountDTO[]; trigger: ReactElement }) {
  const router = useRouter();
  const { money } = useFormat();
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"transfer" | "opening">("transfer");
  const [candidates, setCandidates] = useState<Candidate[] | null>(null);
  const [other, setOther] = useState("");
  const [pair, setPair] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  const others = accounts.filter((a) => a.id !== t.accountId && !a.archived);
  const name = (id: string | null | undefined) => accounts.find((a) => a.id === id)?.name ?? "another account";
  const isExpense = t.type === "expense";

  function onOpenChange(next: boolean) {
    setOpen(next);
    if (!next) return;
    setError(""); setMode("transfer"); setCandidates(null); setPair(null); setOther(others[0]?.id ?? "");
    void findTransferCandidates(t.id).then((rows) => {
      setCandidates(rows);
      // The best match picks the account and the entry to remove together.
      if (rows[0]) { setOther(rows[0].accountId); setPair(rows[0].id); }
    });
  }

  const matches = (candidates ?? []).filter((c) => c.accountId === other);
  const from = isExpense ? name(t.accountId) : name(other);
  const to = isExpense ? name(other) : name(t.accountId);

  function submit() {
    setError("");
    start(async () => {
      const r = mode === "opening"
        ? await moveEntryToOpeningBalance(t.id)
        : await convertEntryToTransfer({ id: t.id, otherAccountId: other, counterpartId: pair });
      if (!r.ok) { setError(r.error); return; }
      toast.success(mode === "opening" ? "Moved into the starting balance" : "Converted to a transfer");
      setOpen(false);
      window.dispatchEvent(new Event("ledger-changed"));
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger render={trigger} />
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Not really {isExpense ? "spending" : "income"}?</DialogTitle>
          <DialogDescription>
            <span className="amount">{money(t.amount)}</span> · {t.note || "Untitled"} · {shortDay(t.date)}. Account balances stay exactly the same either way.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-2" role="radiogroup" aria-label="What was this?">
          <button type="button" role="radio" aria-checked={mode === "transfer"} disabled={!others.length} onClick={() => setMode("transfer")}
            className={cn("flex gap-3 rounded-xl border p-3 text-left text-sm transition-colors disabled:opacity-50", mode === "transfer" ? "border-brand/50 bg-brand/5" : "hover:bg-muted/50")}>
            <ArrowRightLeft className="mt-0.5 size-4 shrink-0 text-brand" aria-hidden />
            <span><strong className="font-medium">Money moved between our accounts</strong>
              <span className="block text-xs text-muted-foreground">Becomes a transfer, so it no longer counts as {isExpense ? "spending" : "income"}.</span></span>
          </button>
          {!isExpense && (
            <button type="button" role="radio" aria-checked={mode === "opening"} onClick={() => setMode("opening")}
              className={cn("flex gap-3 rounded-xl border p-3 text-left text-sm transition-colors", mode === "opening" ? "border-brand/50 bg-brand/5" : "hover:bg-muted/50")}>
              <Wallet className="mt-0.5 size-4 shrink-0 text-brand" aria-hidden />
              <span><strong className="font-medium">Money the account already had</strong>
                <span className="block text-xs text-muted-foreground">Adds it to {name(t.accountId)}&apos;s starting balance and removes this entry.</span></span>
            </button>
          )}
        </div>

        {mode === "transfer" && others.length > 0 && (
          <div className="grid gap-3">
            <label className="grid gap-1 text-xs font-medium">
              {isExpense ? "Moved to" : "Moved from"}
              <select value={other} disabled={pending} onChange={(e) => { setOther(e.target.value); setPair(null); }}
                className="min-h-10 rounded-lg border bg-background px-3 text-sm">
                {others.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </label>
            <fieldset className="grid gap-1.5">
              <legend className="mb-1 text-xs font-medium">The other side in {name(other)}</legend>
              {candidates === null && <p className="text-xs text-muted-foreground">Looking for a matching entry…</p>}
              {matches.map((c) => (
                <label key={c.id} className={cn("flex cursor-pointer items-center gap-2 rounded-lg border p-2.5 text-sm", pair === c.id && "border-brand/50 bg-brand/5")}>
                  <input type="radio" name="pair" checked={pair === c.id} onChange={() => setPair(c.id)} />
                  <span className="min-w-0 flex-1 truncate">Remove “{c.note || "Untitled"}” {c.type} · {shortDay(c.date)}</span>
                  <span className="amount text-xs">{money(c.amount)}</span>
                </label>
              ))}
              {candidates !== null && (
                <label className={cn("flex cursor-pointer items-center gap-2 rounded-lg border p-2.5 text-sm", pair === null && "border-brand/50 bg-brand/5")}>
                  <input type="radio" name="pair" checked={pair === null} onChange={() => setPair(null)} />
                  <span>{matches.length ? "Keep the other entry" : "No matching entry: just create the transfer"}</span>
                </label>
              )}
            </fieldset>
            <p className="rounded-lg bg-muted/60 p-2.5 text-xs text-muted-foreground">
              Result: transfer of <span className="amount font-medium text-foreground">{money(t.amount)}</span> from {from} to {to}.{" "}
              {pair ? "Both accounts keep their balances." : `${name(t.accountId)} keeps its balance; ${name(other)} ${isExpense ? "goes up" : "goes down"} by this amount, because there was no entry for it there.`}
            </p>
          </div>
        )}

        <FormError>{error}</FormError>
        <DialogFooter>
          <DialogClose render={<Button type="button" variant="outline" />}>Cancel</DialogClose>
          <Button type="button" disabled={pending || (mode === "transfer" && !other)} onClick={submit}>
            {pending ? "Saving…" : mode === "opening" ? "Move to starting balance" : "Convert to transfer"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
