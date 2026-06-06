"use client";

import { useState, useTransition, type ReactElement } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Check, Plus, Trash2 } from "lucide-react";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { useFormat } from "@/components/settings-provider";
import { createSplit, deleteSplit, settleUp } from "@/lib/actions";
import { cn } from "@/lib/utils";
import type { SplitData } from "@/lib/queries";

type Member = { id: string; name: string };

export function SplitManager({ trigger, data }: { trigger: ReactElement; data: SplitData }) {
  const { money } = useFormat();
  const { meId, otherMembers } = data;

  return (
    <Sheet>
      <SheetTrigger render={trigger} />
      <SheetContent className="flex w-full flex-col gap-0 p-0 sm:max-w-md">
        <SheetHeader className="border-b p-4">
          <SheetTitle>Shared expenses</SheetTitle>
          <SheetDescription>Track who owes whom and settle up — no more manual &ldquo;split clear&rdquo;.</SheetDescription>
        </SheetHeader>
        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4">
          {otherMembers.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">Invite someone to your tracker (via Sharing) to split expenses with them.</p>
          ) : (
            <>
              <div className="space-y-2">
                {data.balances.length === 0 && (
                  <div className="rounded-xl border bg-card p-4 text-center text-sm text-muted-foreground">All settled up 🎉</div>
                )}
                {data.balances.map((b) => (
                  <div key={b.userId} className="flex items-center justify-between rounded-xl border bg-card p-3">
                    <div className="min-w-0">
                      <div className="truncate text-sm">
                        {b.net > 0 ? <><span className="font-medium">{b.name}</span> owes you</> : <>You owe <span className="font-medium">{b.name}</span></>}
                      </div>
                      <div className={cn("amount text-lg font-semibold", b.net > 0 ? "text-positive" : "text-negative")}>{money(Math.abs(b.net))}</div>
                    </div>
                    <SettleButton userId={b.userId} name={b.name} />
                  </div>
                ))}
              </div>

              <AddForm meId={meId} otherMembers={otherMembers} />

              {data.splits.length > 0 && (
                <div className="space-y-1.5">
                  <div className="px-0.5 text-xs font-semibold text-muted-foreground">Open items · {data.splits.length}</div>
                  {data.splits.map((s) => <SplitRow key={s.id} split={s} meId={meId} otherMembers={otherMembers} />)}
                </div>
              )}
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

function SettleButton({ userId, name }: { userId: string; name: string }) {
  const router = useRouter();
  async function settle() {
    const res = await settleUp(userId);
    if (res.ok) { toast.success(`Settled up with ${name}`); router.refresh(); }
    else toast.error(res.error);
  }
  return (
    <ConfirmDialog
      trigger={<Button size="sm" variant="outline"><Check className="size-3.5" /> Settle up</Button>}
      title={`Settle up with ${name}?`}
      description="Marks all open items between you two as settled."
      confirmLabel="Settle up"
      onConfirm={settle}
    />
  );
}

function AddForm({ meId, otherMembers }: { meId: string; otherMembers: Member[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [note, setNote] = useState("");
  const [amount, setAmount] = useState("");
  const [otherId, setOtherId] = useState(otherMembers[0]?.id ?? "");
  const [dir, setDir] = useState<"owesMe" | "iOwe">("owesMe");
  const otherName = otherMembers.find((m) => m.id === otherId)?.name ?? "them";

  function add(e: React.FormEvent) {
    e.preventDefault();
    if (!amount || !otherId) return;
    start(async () => {
      const creditorId = dir === "owesMe" ? meId : otherId;
      const debtorId = dir === "owesMe" ? otherId : meId;
      const res = await createSplit({ note, amount: Number(amount), creditorId, debtorId });
      if (res.ok) { toast.success("Added"); setNote(""); setAmount(""); router.refresh(); }
      else toast.error(res.error);
    });
  }

  return (
    <form onSubmit={add} className="space-y-2.5 rounded-lg border p-2.5">
      <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="What for? (e.g. Groceries split)" />
      <div className="grid grid-cols-2 gap-2">
        <Input type="number" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="Amount owed" required />
        {otherMembers.length > 1 ? (
          <Select value={otherId} onValueChange={(v) => setOtherId(v as string)} items={otherMembers.map((m) => ({ value: m.id, label: m.name }))}>
            <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
            <SelectContent>{otherMembers.map((m) => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}</SelectContent>
          </Select>
        ) : (
          <div className="flex h-8 items-center truncate rounded-lg border px-2.5 text-sm text-muted-foreground">{otherName}</div>
        )}
      </div>
      <div className="grid grid-cols-2 gap-1 rounded-lg bg-muted p-1">
        {(["owesMe", "iOwe"] as const).map((d) => (
          <button key={d} type="button" onClick={() => setDir(d)}
            className={cn("truncate rounded-md py-1 text-xs font-medium transition-colors", dir === d ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}>
            {d === "owesMe" ? `${otherName} owes me` : `I owe ${otherName}`}
          </button>
        ))}
      </div>
      <Button type="submit" size="sm" className="w-full" disabled={pending}><Plus className="size-4" /> Add</Button>
    </form>
  );
}

function SplitRow({ split, meId, otherMembers }: { split: SplitData["splits"][number]; meId: string; otherMembers: Member[] }) {
  const router = useRouter();
  const { money } = useFormat();
  const nameOf = (id: string) => (id === meId ? "You" : otherMembers.find((m) => m.id === id)?.name ?? "Member");
  async function remove() {
    const res = await deleteSplit(split.id);
    if (res.ok) router.refresh();
    else toast.error(res.error);
  }
  return (
    <div className="flex items-center gap-2 rounded-lg border px-2.5 py-2">
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm">{split.note || "Shared expense"}</div>
        <div className="text-xs text-muted-foreground">{nameOf(split.debtorId)} → {nameOf(split.creditorId)}</div>
      </div>
      <span className="amount shrink-0 text-sm font-medium">{money(split.amount)}</span>
      <ConfirmDialog trigger={<Button size="icon-sm" variant="ghost" aria-label="Delete"><Trash2 className="size-3.5" /></Button>} title="Remove this item?" onConfirm={remove} />
    </div>
  );
}
