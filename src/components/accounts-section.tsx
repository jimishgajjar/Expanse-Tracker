"use client";

import { useState } from "react";
import Link from "next/link";
import { Archive, ArchiveRestore, ChevronDown, Minus, Pencil, Plus, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/icon";
import { AccountDialog } from "@/components/account-dialog";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { TransactionDialog } from "@/components/transaction-dialog";
import { deleteAccount, setAccountArchived } from "@/lib/actions";
import { useFormat } from "@/components/settings-provider";
import { cn } from "@/lib/utils";
import type { AccountDTO, CategoryDTO } from "@/lib/queries";

export function AccountsSection({
  accounts,
  categories,
  canEdit = true,
}: {
  accounts: AccountDTO[];
  categories: CategoryDTO[];
  canEdit?: boolean;
}) {
  const router = useRouter();
  const { balanceMoney } = useFormat();
  const [showArchived, setShowArchived] = useState(false);

  const total = accounts.reduce((s, a) => s + a.balance, 0);
  const active = accounts.filter((a) => !a.archived);
  const archived = accounts.filter((a) => a.archived);
  const archivedTotal = archived.reduce((s, a) => s + a.balance, 0);

  async function remove(id: string) {
    const res = await deleteAccount(id);
    if (res.ok) { toast.success("Account deleted"); router.refresh(); }
    else toast.error(res.error);
  }
  async function setArchived(id: string, value: boolean) {
    const res = await setAccountArchived(id, value);
    if (res.ok) { toast.success(value ? "Account archived" : "Account restored"); router.refresh(); }
    else toast.error(res.error);
  }

  const shared = { accounts, categories, canEdit, balanceMoney, onRemove: remove, onArchive: setArchived };

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
        {active.map((a) => <AccountCard key={a.id} account={a} {...shared} />)}
        {accounts.length === 0 && <p className="text-sm text-muted-foreground">No accounts yet — add one to get started.</p>}
      </div>

      {archived.length > 0 && (
        <div className="space-y-3 pt-1">
          <button
            type="button"
            onClick={() => setShowArchived((v) => !v)}
            className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            <ChevronDown className={cn("size-3.5 transition-transform", showArchived ? "" : "-rotate-90")} />
            Archived · {archived.length}
            <span className="amount text-foreground/70">{balanceMoney(archivedTotal)}</span>
          </button>
          {showArchived && (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {archived.map((a) => <AccountCard key={a.id} account={a} {...shared} />)}
            </div>
          )}
        </div>
      )}
    </section>
  );
}

function AccountCard({
  account: a, accounts, categories, canEdit, balanceMoney, onRemove, onArchive,
}: {
  account: AccountDTO;
  accounts: AccountDTO[];
  categories: CategoryDTO[];
  canEdit: boolean;
  balanceMoney: (n: number) => string;
  onRemove: (id: string) => void;
  onArchive: (id: string, value: boolean) => void;
}) {
  return (
    <Card className={cn("group relative gap-0 overflow-hidden p-0 transition-[transform,box-shadow] duration-200 ease-out-quart hover:-translate-y-0.5 hover:ring-foreground/20", a.archived && "opacity-65 hover:opacity-100")}>
      <Link href={`/accounts/${a.id}`} className="flex w-full flex-col items-start p-4 text-left transition-colors hover:bg-muted/40">
        <div className="flex w-full items-center gap-2.5">
          <span className="grid size-9 shrink-0 place-items-center rounded-lg" style={{ backgroundColor: `${a.color}22`, color: a.color }}>
            <Icon name={a.icon} size={18} />
          </span>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="truncate font-medium">{a.name}</span>
              {a.archived && <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">Archived</span>}
            </div>
            <div className="text-xs text-muted-foreground capitalize">{a.type}</div>
          </div>
        </div>
        <div className={cn("amount mt-3 text-xl font-semibold", a.balance < 0 && "text-negative")}>
          {balanceMoney(a.balance)}
        </div>
      </Link>
      {canEdit && (
        <div className="absolute top-2 right-2 flex opacity-100 transition sm:opacity-0 sm:group-hover:opacity-100">
          {a.archived ? (
            <Button size="icon-sm" variant="ghost" aria-label="Restore account" title="Restore" onClick={() => onArchive(a.id, false)}>
              <ArchiveRestore className="size-3.5" />
            </Button>
          ) : (
            <>
              <AccountDialog account={a} trigger={<Button size="icon-sm" variant="ghost" aria-label="Edit account"><Pencil className="size-3.5" /></Button>} />
              <Button size="icon-sm" variant="ghost" aria-label="Archive account" title="Archive (hide, keep history)" onClick={() => onArchive(a.id, true)}>
                <Archive className="size-3.5" />
              </Button>
            </>
          )}
          <ConfirmDialog
            trigger={<Button size="icon-sm" variant="ghost" aria-label="Delete account"><Trash2 className="size-3.5" /></Button>}
            title={`Delete "${a.name}"?`}
            description="Its transactions and transfers will be deleted too. This can't be undone. (Tip: Archive instead to keep the history.)"
            onConfirm={() => onRemove(a.id)}
          />
        </div>
      )}
      {canEdit && !a.archived && (
        <div className="flex border-t text-xs font-medium">
          <TransactionDialog
            accounts={accounts} categories={categories} defaultAccountId={a.id} defaultType="income"
            trigger={<button type="button" aria-label={`Add income to ${a.name}`} className="flex flex-1 items-center justify-center gap-1.5 py-2 text-positive transition-colors hover:bg-positive/10"><Plus className="size-3.5" /> Income</button>}
          />
          <TransactionDialog
            accounts={accounts} categories={categories} defaultAccountId={a.id} defaultType="expense"
            trigger={<button type="button" aria-label={`Add expense to ${a.name}`} className="flex flex-1 items-center justify-center gap-1.5 border-l py-2 text-negative transition-colors hover:bg-negative/10"><Minus className="size-3.5" /> Expense</button>}
          />
        </div>
      )}
    </Card>
  );
}
