"use client";

import { Pencil, Plus, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/icon";
import { AccountDialog } from "@/components/account-dialog";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { deleteAccount } from "@/lib/actions";
import { useFormat } from "@/components/settings-provider";
import { cn } from "@/lib/utils";
import type { AccountDTO } from "@/lib/queries";

export function AccountsSection({ accounts }: { accounts: AccountDTO[] }) {
  const router = useRouter();
  const { balanceMoney } = useFormat();
  const total = accounts.reduce((s, a) => s + a.balance, 0);

  async function remove(id: string) {
    const res = await deleteAccount(id);
    if (res.ok) { toast.success("Account deleted"); router.refresh(); }
    else toast.error(res.error);
  }

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="flex items-baseline gap-2 text-sm font-semibold text-muted-foreground">
          All accounts
          <span className="font-mono text-base text-foreground">{balanceMoney(total)}</span>
        </h2>
        <AccountDialog trigger={<Button variant="outline" size="sm"><Plus className="size-4" /> Add account</Button>} />
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {accounts.map((a) => (
          <Card key={a.id} className="group relative gap-0 p-4">
            <div className="flex items-center gap-2.5">
              <span className="grid size-9 shrink-0 place-items-center rounded-lg" style={{ backgroundColor: `${a.color}22`, color: a.color }}>
                <Icon name={a.icon} size={18} />
              </span>
              <div className="min-w-0">
                <div className="truncate font-medium">{a.name}</div>
                <div className="text-xs text-muted-foreground capitalize">{a.type}</div>
              </div>
              <div className="ml-auto flex shrink-0 opacity-100 transition sm:opacity-0 sm:focus-within:opacity-100 sm:group-hover:opacity-100">
                <AccountDialog account={a} trigger={<Button size="icon-sm" variant="ghost" aria-label="Edit account"><Pencil className="size-3.5" /></Button>} />
                <ConfirmDialog
                  trigger={<Button size="icon-sm" variant="ghost" aria-label="Delete account"><Trash2 className="size-3.5" /></Button>}
                  title={`Delete "${a.name}"?`}
                  description="Its transactions will be deleted too. This can't be undone."
                  onConfirm={() => remove(a.id)}
                />
              </div>
            </div>
            <div className={cn("mt-3 font-mono text-xl font-semibold tracking-tight", a.balance < 0 && "text-negative")}>
              {balanceMoney(a.balance)}
            </div>
          </Card>
        ))}
        {accounts.length === 0 && <p className="text-sm text-muted-foreground">No accounts yet — add one to get started.</p>}
      </div>
    </section>
  );
}
