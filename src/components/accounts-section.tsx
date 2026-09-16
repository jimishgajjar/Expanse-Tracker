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
    <section aria-labelledby={headingId} className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2.5">
            <h2 id={headingId} className="text-base font-semibold">
              All accounts
            </h2>
            <span className="rounded-md bg-muted px-2 py-1 text-xs text-muted-foreground">
              {active.length} active
            </span>
          </div>
          <p className="mt-1.5 text-xs text-muted-foreground">
            Combined balance{" "}
            <span className="amount ml-1 font-medium text-foreground">
              {balanceMoney(total)}
            </span>
          </p>
        </div>
        {canEdit && (
          <AccountDialog
            trigger={
              <Button variant="outline" className="min-h-11 rounded-lg">
                <Plus className="size-4" /> Add account
              </Button>
            }
          />
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {active.map((a) => (
          <AccountCard key={a.id} account={a} {...shared} />
        ))}
        {accounts.length === 0 && (
          <p className="text-sm text-muted-foreground">
            No accounts yet — add one to get started.
          </p>
        )}
      </div>

      {archived.length > 0 && (
        <div className="space-y-3 pt-1">
          <button
            type="button"
            onClick={() => setShowArchived((v) => !v)}
            aria-expanded={showArchived}
            className="flex min-h-11 items-center gap-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            <ChevronDown
              className={cn(
                "size-3.5 transition-transform",
                showArchived ? "" : "-rotate-90",
              )}
            />
            Archived · {archived.length}
            <span className="amount text-foreground/70">
              {balanceMoney(archivedTotal)}
            </span>
          </button>
          {showArchived && (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
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
    // Keep account management separate from the linked balance and title.
    <Card
      className={cn(
        "group relative gap-0 overflow-hidden rounded-2xl p-0 transition-colors hover:border-brand/40 focus-within:border-brand/50",
        a.archived && "opacity-65 hover:opacity-100",
      )}
    >
      <Link
        href={`/accounts/${a.id}`}
        aria-label={`Open ${a.name}, balance ${balanceMoney(a.balance)}`}
        className="block flex-1 p-5 text-left transition-colors hover:bg-muted/20 focus-visible:outline-offset-[-4px]"
      >
        <div
          className={cn("flex w-full items-center gap-3", canEdit && "pr-9")}
        >
          <span
            className="grid size-11 shrink-0 place-items-center rounded-xl"
            style={{ backgroundColor: `${a.color}18`, color: a.color }}
          >
            <Icon name={a.icon} size={21} />
          </span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="break-words font-semibold leading-snug [overflow-wrap:anywhere]">
                {a.name}
              </span>
              {a.archived && (
                <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                  Archived
                </span>
              )}
            </div>
            <div className="mt-1 text-xs text-muted-foreground capitalize">
              {a.type}
            </div>
          </div>
        </div>
        <div className="mt-5 flex items-end justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground">Current balance</p>
            <p
              className={cn(
                "amount mt-1 break-all text-2xl font-semibold leading-tight",
                a.balance < 0 && "text-negative",
              )}
            >
              {balanceMoney(a.balance)}
            </p>
          </div>
          <span
            className="mb-0.5 grid size-8 shrink-0 place-items-center rounded-full bg-muted/60 text-muted-foreground transition-colors group-hover:bg-brand/10 group-hover:text-brand"
            aria-hidden
          >
            <ChevronRight className="size-4" />
          </span>
        </div>
      </Link>
      {canEdit && (
        <div className="absolute top-3 right-3">
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
        </div>
      )}
      {canEdit && !a.archived && (
        <div className="grid grid-cols-3 gap-2 border-t bg-muted/10 p-3 text-xs font-medium">
          <TransactionDialog
            accounts={accounts}
            categories={categories}
            defaultAccountId={a.id}
            defaultType="income"
            trigger={
              <button
                type="button"
                aria-label={`Add income to ${a.name}`}
                className="flex min-h-11 items-center justify-center gap-1.5 rounded-lg bg-positive/5 px-1 py-2 text-positive transition-colors hover:bg-positive/15"
              >
                <Plus className="size-3.5" /> Income
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
                className="flex min-h-11 items-center justify-center gap-1.5 rounded-lg bg-negative/5 px-1 py-2 text-negative transition-colors hover:bg-negative/15"
              >
                <Minus className="size-3.5" /> Expense
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
                className="flex min-h-11 items-center justify-center gap-1.5 rounded-lg bg-muted/60 px-1 py-2 text-foreground transition-colors hover:bg-muted"
              >
                <ArrowRightLeft className="size-3.5" /> Transfer
              </button>
            }
          />
        </div>
      )}
    </Card>
  );
}
