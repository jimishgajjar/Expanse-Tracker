"use client";

import { Pencil, Plus, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/icon";
import { AccountDialog } from "@/components/account-dialog";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { AccountDetailSheet } from "@/components/account-detail-sheet";
import { deleteAccount } from "@/lib/actions";
import { useFormat } from "@/components/settings-provider";
import { cn } from "@/lib/utils";
import type { AccountDTO, CategoryDTO, TransactionDTO, TransferDTO } from "@/lib/queries";

export function AccountsSection({
  accounts,
  transactions,
  transfers,
  categories,
  canEdit = true,
}: {
  accounts: AccountDTO[];
  transactions: TransactionDTO[];
  transfers: TransferDTO[];
  categories: CategoryDTO[];
  canEdit?: boolean;
}) {
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
          <span className="amount text-base font-semibold text-foreground">{balanceMoney(total)}</span>
        </h2>
        {canEdit && <AccountDialog trigger={<Button variant="outline" size="sm"><Plus className="size-4" /> Add account</Button>} />}
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {accounts.map((a) => (
          <Card key={a.id} className="group relative gap-0 overflow-hidden p-0 transition-[transform,box-shadow] duration-200 ease-out-quart hover:-translate-y-0.5 hover:ring-foreground/20">
            <AccountDetailSheet
              account={a}
              transactions={transactions}
              transfers={transfers}
              categories={categories}
              accounts={accounts}
              trigger={
                <button type="button" className="flex w-full flex-col items-start p-4 text-left transition-colors hover:bg-muted/40">
                  <div className="flex w-full items-center gap-2.5">
                    <span className="grid size-9 shrink-0 place-items-center rounded-lg" style={{ backgroundColor: `${a.color}22`, color: a.color }}>
                      <Icon name={a.icon} size={18} />
                    </span>
                    <div className="min-w-0">
                      <div className="truncate font-medium">{a.name}</div>
                      <div className="text-xs text-muted-foreground capitalize">{a.type}</div>
                    </div>
                  </div>
                  <div className={cn("amount mt-3 text-xl font-semibold", a.balance < 0 && "text-negative")}>
                    {balanceMoney(a.balance)}
                  </div>
                </button>
              }
            />
            {canEdit && (
              <div className="absolute top-2 right-2 flex opacity-100 transition sm:opacity-0 sm:group-hover:opacity-100">
                <AccountDialog account={a} trigger={<Button size="icon-sm" variant="ghost" aria-label="Edit account"><Pencil className="size-3.5" /></Button>} />
                <ConfirmDialog
                  trigger={<Button size="icon-sm" variant="ghost" aria-label="Delete account"><Trash2 className="size-3.5" /></Button>}
                  title={`Delete "${a.name}"?`}
                  description="Its transactions and transfers will be deleted too. This can't be undone."
                  onConfirm={() => remove(a.id)}
                />
              </div>
            )}
          </Card>
        ))}
        {accounts.length === 0 && <p className="text-sm text-muted-foreground">No accounts yet — add one to get started.</p>}
      </div>
    </section>
  );
}
