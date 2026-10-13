"use client";

import { useId, useState } from "react";
import Link from "next/link";
import {
  Archive,
  ArchiveRestore,
  ArrowRightLeft,
  ChevronDown,
  ChevronRight,
  Minus,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { MoreActions } from "./more-actions";
import { DropdownMenuItem, DropdownMenuSeparator } from "./ui/dropdown-menu";
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
  showTotal = true,
}: {
  accounts: AccountDTO[];
  categories: CategoryDTO[];
  canEdit?: boolean;
  showTotal?: boolean;
}) {
  const router = useRouter();
  const headingId = useId();
  const { balanceMoney } = useFormat();
  const [showArchived, setShowArchived] = useState(false);

  const total = accounts.reduce((s, a) => s + a.balance, 0);
  const active = accounts.filter((a) => !a.archived);
  const archived = accounts.filter((a) => a.archived);
  const archivedTotal = archived.reduce((s, a) => s + a.balance, 0);

  async function remove(id: string) {
    const res = await deleteAccount(id);
    if (res.ok) {
      toast.success("Account deleted");
      router.refresh();
    } else toast.error(res.error);
  }
  async function setArchived(id: string, value: boolean) {
    const res = await setAccountArchived(id, value);
    if (res.ok) {
      toast.success(value ? "Account archived" : "Account restored");
      router.refresh();
    } else toast.error(res.error);
  }

  const shared = {
    accounts,
    categories,
    canEdit,
    balanceMoney,
    onRemove: remove,
    onArchive: setArchived,
  };

  return (
    <section aria-labelledby={headingId} className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h2 id={headingId} className="text-sm font-semibold tracking-tight text-foreground">
              Your accounts
            </h2>
            <span className="rounded-md bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
              {active.length} active
            </span>
          </div>
          {showTotal && <p className="text-xs text-muted-foreground mt-0.5">
            Total across accounts:{" "}
            <span className="font-mono font-semibold text-foreground">
              {balanceMoney(total)}
            </span>
          </p>}
        </div>
        {canEdit && (
          <AccountDialog
            trigger={
              <Button variant="ghost" size="sm" className="h-9 rounded-lg px-2 text-xs font-medium gap-1.5 hover:bg-muted/60">
                <Plus className="size-3.5" /> Add account
              </Button>
            }
          />
        )}
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {active.map((a) => (
          <AccountCard key={a.id} account={a} {...shared} />
        ))}
        {accounts.length === 0 && (
          <p className="text-sm text-muted-foreground col-span-full py-4 text-center">
            No accounts yet — add one to get started.
          </p>
        )}
      </div>

      {archived.length > 0 && (
        <div className="space-y-3 pt-2">
          <button
            type="button"
            onClick={() => setShowArchived((v) => !v)}
            aria-expanded={showArchived}
            className="flex min-h-10 items-center gap-2 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground cursor-pointer"
          >
            <ChevronDown
              className={cn(
                "size-3.5 transition-transform",
                showArchived ? "" : "-rotate-90",
              )}
            />
            Archived accounts ({archived.length})
            <span className="font-mono text-muted-foreground/80">
              · {balanceMoney(archivedTotal)}
            </span>
          </button>
          {showArchived && (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {archived.map((a) => (
                <AccountCard key={a.id} account={a} {...shared} />
              ))}
            </div>
          )}
        </div>
      )}
    </section>
  );
}

function AccountCard({
  account: a,
  accounts,
  categories,
  canEdit,
  balanceMoney,
  onRemove,
  onArchive,
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
    <div
      className={cn(
        "account-card group relative flex min-w-0 flex-col justify-between rounded-xl border border-border bg-card p-4 transition-colors hover:border-brand/35",
        a.archived && "opacity-70 hover:opacity-100",
      )}
    >
      <div>
        {/* Top Header: Account Icon + Type Badge + More Actions */}
        <div className="absolute right-2 top-2 z-10">
          {canEdit && (
            <MoreActions label={`More actions for ${a.name}`}>
              {a.archived ? (
                <DropdownMenuItem onClick={() => onArchive(a.id, false)}>
                  <ArchiveRestore />
                  Restore account
                </DropdownMenuItem>
              ) : (
                <>
                  <AccountDialog
                    account={a}
                    trigger={
                      <DropdownMenuItem
                        closeOnClick={false}
                        nativeButton
                        render={<button type="button" />}
                      >
                        <Pencil />
                        Edit account
                      </DropdownMenuItem>
                    }
                  />
                  <DropdownMenuItem onClick={() => onArchive(a.id, true)}>
                    <Archive />
                    Archive account
                  </DropdownMenuItem>
                </>
              )}
              <DropdownMenuSeparator />
              <ConfirmDialog
                trigger={
                  <DropdownMenuItem
                    variant="destructive"
                    closeOnClick={false}
                    nativeButton
                    render={<button type="button" />}
                  >
                    <Trash2 />
                    Delete account
                  </DropdownMenuItem>
                }
                title={`Delete "${a.name}"?`}
                description="Its transactions and transfers will be deleted too. This can't be undone. Archive instead to keep the history."
                onConfirm={() => onRemove(a.id)}
              />
            </MoreActions>
          )}
        </div>

        {/* Account Details & Link */}
        <Link
          href={`/accounts/${a.id}`}
          aria-label={`Open ${a.name}, balance ${balanceMoney(a.balance)}`}
          className="account-card-link block rounded-md focus-visible:outline-offset-4"
        >
          <div className="account-card-name flex min-w-0 items-center gap-2.5 pr-7">
            <span className="grid size-9 shrink-0 place-items-center rounded-lg" style={{ backgroundColor: `${a.color}15`, color: a.color }}>
              <Icon name={a.icon} size={18} />
            </span>
            <div className="min-w-0">
              <h3 className="truncate text-sm font-medium text-foreground transition-colors group-hover:text-brand" title={a.name}>{a.name}</h3>
              <p className="mt-0.5 text-[11px] capitalize text-muted-foreground">{a.type}{a.archived ? " · Archived" : ""}</p>
            </div>
          </div>

          <div className="account-card-balance mt-4 flex items-end justify-between gap-2">
            <div className="min-w-0">
            <p className="text-[11px] text-muted-foreground">Current balance</p>
            <p
              className={cn(
                "amount break-words text-xl font-semibold tracking-tight mt-0.5",
                a.balance < 0 ? "text-negative" : "text-foreground",
              )}
            >
              {balanceMoney(a.balance)}
            </p>
            </div>
            <ChevronRight className="mb-1 size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" aria-hidden />
          </div>
        </Link>
      </div>

      {/* Quick Action Footer */}
      {canEdit && !a.archived && (
        <div className="mt-3 pt-2 border-t border-border/60 grid grid-cols-3 gap-1">
          <TransactionDialog
            accounts={accounts}
            categories={categories}
            defaultAccountId={a.id}
            defaultType="income"
            trigger={
              <button
                type="button"
                aria-label={`Add income to ${a.name}`}
                className="flex min-h-11 items-center justify-center gap-1 rounded-md px-1 py-1 text-xs font-medium text-positive transition-colors hover:bg-positive/10 sm:min-h-8"
              >
                <Plus className="size-3" /> Income
              </button>
            }
          />
          <TransactionDialog
            accounts={accounts}
            categories={categories}
            defaultAccountId={a.id}
            defaultType="expense"
            trigger={
              <button
                type="button"
                aria-label={`Add expense to ${a.name}`}
                className="flex min-h-11 items-center justify-center gap-1 rounded-md px-1 py-1 text-xs font-medium text-negative transition-colors hover:bg-negative/10 sm:min-h-8"
              >
                <Minus className="size-3" /> Expense
              </button>
            }
          />
          <TransactionDialog
            accounts={accounts}
            categories={categories}
            defaultAccountId={a.id}
            defaultType="transfer"
            trigger={
              <button
                type="button"
                aria-label={`Transfer from ${a.name}`}
                className="flex min-h-11 items-center justify-center gap-1 rounded-md px-1 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground sm:min-h-8"
              >
                <ArrowRightLeft className="size-3" /> Transfer
              </button>
            }
          />
        </div>
      )}
    </div>
  );
}
