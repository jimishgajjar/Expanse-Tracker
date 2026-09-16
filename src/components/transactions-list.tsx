"use client";

import { startTransition, useMemo, useOptimistic } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { format, parseISO } from "date-fns";
import {
  ArrowDownLeft,
  ArrowUpRight,
  ArrowRightLeft,
  Pencil,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { MoreActions } from "./more-actions";
import { DropdownMenuItem } from "./ui/dropdown-menu";
import { Icon } from "@/components/icon";
import { TransactionDialog } from "@/components/transaction-dialog";
import { ConfirmDialog } from "@/components/confirm-dialog";
import {
  createTransaction,
  createTransfer,
  deleteTransaction,
  deleteTransfer,
} from "@/lib/actions";
import { useFormat } from "@/components/settings-provider";
import type { ActivityEntry } from "@/lib/activity";
import { cn } from "@/lib/utils";
import type {
  AccountDTO,
  CategoryDTO,
  TransactionDTO,
  TransferDTO,
} from "@/lib/queries";

type Props = {
  transactions: TransactionDTO[];
  accounts: AccountDTO[];
  categories: CategoryDTO[];
  canEdit?: boolean;
  showAuthors?: boolean;
  emptyMessage?: string;
  showDateHeader?: boolean;
  /** The full (unpaginated) filtered set. Daily nets are summed from this, so a
      day split across two pages still shows its true total on both. */
  allTransactions?: TransactionDTO[];
};

/** Presentational list: groups the given transactions by date and renders compact rows. */
export function TransactionRows({
  transactions,
  accounts,
  categories,
  canEdit = true,
  showAuthors = false,
  emptyMessage = "No transactions match these filters.",
  allTransactions,
  showDateHeader = true,
}: Props) {
  const router = useRouter();
  const { money } = useFormat();
  const [optimistic, removeOptimistic] = useOptimistic(
    transactions,
    (state: TransactionDTO[], id: string) => state.filter((t) => t.id !== id),
  );

  const groups = useMemo(() => {
    const m = new Map<string, TransactionDTO[]>();
    for (const t of optimistic) {
      const arr = m.get(t.date);
      if (arr) arr.push(t);
      else m.set(t.date, [t]);
    }
    return [...m.entries()].sort((a, b) => b[0].localeCompare(a[0]));
  }, [optimistic]);

  const netSource = allTransactions ?? optimistic;
  const dayNets = useMemo(() => {
    const m = new Map<string, number>();
    for (const t of netSource)
      m.set(
        t.date,
        (m.get(t.date) ?? 0) + (t.type === "income" ? t.amount : -t.amount),
      );
    return m;
  }, [netSource]);

  function remove(t: TransactionDTO) {
    startTransition(async () => {
      removeOptimistic(t.id); // vanish immediately
      const res = await deleteTransaction(t.id);
      if (!res.ok) {
        toast.error(res.error);
        router.refresh();
        return;
      }
      router.refresh();
      toast.success("Transaction deleted", {
        action: {
          label: "Undo",
          onClick: async () => {
            const r = await createTransaction({
              type: t.type,
              amount: t.amount,
              date: t.date,
              note: t.note,
              accountId: t.accountId,
              categoryId: t.categoryId,
              tagIds: t.tags.map((tag) => tag.id),
            });
            if (r.ok) {
              toast.success("Transaction restored");
              router.refresh();
            } else toast.error(r.error);
          },
        },
      });
    });
  }

  if (!optimistic.length) {
    return (
      <p className="py-12 text-center text-sm text-muted-foreground">
        {emptyMessage}
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {groups.map(([date, rows]) => {
        const net =
          dayNets.get(date) ??
          rows.reduce(
            (s, t) => s + (t.type === "income" ? t.amount : -t.amount),
            0,
          );
        return (
          <div key={date}>
            {showDateHeader && (
              <div className="mb-1 flex items-center justify-between px-0.5 text-xs text-muted-foreground">
                <span className="font-medium">
                  {format(parseISO(date), "EEE, d MMM yyyy")}
                </span>
                <span className="amount">
                  {net < 0 ? "−" : "+"}
                  {money(Math.abs(net))}
                </span>
              </div>
            )}
            <div className="divide-y divide-border">
              {rows.map((t) => (
                <Row
                  key={t.id}
                  t={t}
                  accounts={accounts}
                  categories={categories}
                  onDelete={remove}
                  money={money}
                  canEdit={canEdit}
                  showAuthors={showAuthors}
                />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function Row({
  t,
  accounts,
  categories,
  onDelete,
  money,
  canEdit,
  showAuthors,
}: {
  t: TransactionDTO;
  accounts: AccountDTO[];
  categories: CategoryDTO[];
  onDelete: (t: TransactionDTO) => void;
  money: (n: number) => string;
  canEdit: boolean;
  showAuthors: boolean;
}) {
  const isIncome = t.type === "income";
  const color = t.category?.color ?? "#9b9a97";
  return (
    <div className="group -mx-2 grid grid-cols-[2.25rem_minmax(0,1fr)_auto] items-start gap-x-3 gap-y-1 rounded-lg px-2 py-3.5 transition-colors hover:bg-hover sm:flex sm:items-center">
      <span
        className="row-span-2 grid size-9 shrink-0 place-items-center rounded-lg"
        style={{ backgroundColor: `${color}22`, color }}
      >
        <Icon name={t.category?.icon ?? "circle-help"} size={14} />
      </span>
      <div className="min-w-0 flex-1 leading-relaxed">
        <div className="break-words text-sm font-medium [overflow-wrap:anywhere]">
          {t.note || t.category?.name || "Transaction"}
        </div>
        <div className="flex flex-wrap items-center gap-x-1 text-xs text-muted-foreground">
          {/* When there's no note the title already shows the category — don't repeat it here. */}
          {t.note ? (
            <>
              {t.categoryId && t.category ? (
                <Link
                  href={`/categories/${t.categoryId}`}
                  className="transition hover:text-foreground hover:underline"
                >
                  {t.category.name}
                </Link>
              ) : (
                "Uncategorised"
              )}
              {" · "}
            </>
          ) : null}
          {t.accountId ? (
            <Link
              href={`/accounts/${t.accountId}`}
              className="hover:text-foreground hover:underline"
            >
              {t.account?.name ?? "Account"}
            </Link>
          ) : (
            "No account"
          )}
          {showAuthors && t.createdByName ? ` · ${t.createdByName}` : ""}
        </div>
        {t.tags.length > 0 && (
          <div className="mt-0.5 flex flex-wrap gap-1">
            {t.tags.map((tag) => (
              <Link
                key={tag.id}
                href={`/tags/${tag.id}`}
                className="inline-flex items-center rounded-full px-1.5 text-xs font-medium leading-4 transition hover:brightness-110"
                style={{ backgroundColor: `${tag.color}22`, color: tag.color }}
              >
                {tag.name}
              </Link>
            ))}
          </div>
        )}
      </div>
      <div
        className={cn(
          "col-start-2 row-start-2 flex items-center gap-1.5 text-sm font-semibold sm:ml-auto sm:justify-end",
          isIncome ? "text-positive" : "text-negative",
        )}
      >
        {isIncome ? (
          <ArrowDownLeft className="size-3.5 shrink-0" aria-hidden />
        ) : (
          <ArrowUpRight className="size-3.5 shrink-0" aria-hidden />
        )}
        <span className="sr-only">{isIncome ? "Income" : "Expense"}: </span>
        <span className="amount break-all sm:min-w-28 sm:text-right">
          {isIncome ? "+" : "−"}
          {money(t.amount)}
        </span>
      </div>
      {canEdit && (
        <div className="col-start-3 row-span-2 row-start-1 self-center">
          <MoreActions
            label={`Actions for ${t.note || t.category?.name || "transaction"}`}
          >
            <TransactionDialog
              transaction={t}
              accounts={accounts}
              categories={categories}
              trigger={
                <DropdownMenuItem
                  closeOnClick={false}
                  nativeButton
                  render={<button type="button" />}
                >
                  <Pencil />
                  Edit transaction
                </DropdownMenuItem>
              }
            />
            <ConfirmDialog
              trigger={
                <DropdownMenuItem
                  variant="destructive"
                  closeOnClick={false}
                  nativeButton
                  render={<button type="button" />}
                >
                  <Trash2 />
                  Delete transaction
                </DropdownMenuItem>
              }
              title="Delete transaction?"
              description={`${t.note || t.category?.name || "This transaction"} · ${money(t.amount)}`}
              onConfirm={() => onDelete(t)}
            />
          </MoreActions>
        </div>
      )}
    </div>
  );
}

/** Compact list of transfers, grouped by date. */
export function TransferRows({
  transfers,
  accounts,
  canEdit = true,
  showDateHeader = true,
}: {
  transfers: TransferDTO[];
  accounts: AccountDTO[];
  canEdit?: boolean;
  showDateHeader?: boolean;
}) {
  const router = useRouter();
  const { money } = useFormat();
  const nameOf = (id: string) => accounts.find((a) => a.id === id);

  const groups = useMemo(() => {
    const m = new Map<string, TransferDTO[]>();
    for (const t of transfers) {
      const arr = m.get(t.date);
      if (arr) arr.push(t);
      else m.set(t.date, [t]);
    }
    return [...m.entries()].sort((a, b) => b[0].localeCompare(a[0]));
  }, [transfers]);

  async function remove(t: TransferDTO) {
    const res = await deleteTransfer(t.id);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    router.refresh();
    // Same safety net as transactions: deletion is undoable.
    toast.success("Transfer deleted", {
      action: {
        label: "Undo",
        onClick: async () => {
          const r = await createTransfer({
            amount: t.amount,
            date: t.date,
            note: t.note,
            fromAccountId: t.fromAccountId,
            toAccountId: t.toAccountId,
          });
          if (r.ok) {
            toast.success("Transfer restored");
            router.refresh();
          } else toast.error(r.error);
        },
      },
    });
  }

  if (!transfers.length) {
    return (
      <p className="py-12 text-center text-sm text-muted-foreground">
        No transfers match these filters.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {groups.map(([date, rows]) => (
        <div key={date}>
          {showDateHeader && (
            <div className="mb-1 px-0.5 text-xs font-medium text-muted-foreground">
              {format(parseISO(date), "EEE, d MMM yyyy")}
            </div>
          )}
          <div className="divide-y divide-border">
            {rows.map((t) => {
              const from = nameOf(t.fromAccountId);
              const to = nameOf(t.toAccountId);
              return (
                <div
                  key={t.id}
                  className="group -mx-2 grid grid-cols-[2.25rem_minmax(0,1fr)_auto] items-start gap-x-3 gap-y-1 rounded-lg px-2 py-3.5 transition-colors hover:bg-hover sm:flex sm:items-center"
                >
                  <span className="row-span-2 grid size-9 shrink-0 place-items-center rounded-lg bg-muted text-muted-foreground">
                    <ArrowRightLeft className="size-3.5" />
                  </span>
                  <div className="min-w-0 flex-1 leading-relaxed">
                    <div className="break-words text-sm font-medium [overflow-wrap:anywhere]">
                      {t.note || "Transfer"}
                    </div>
                    <div className="flex flex-wrap items-center gap-x-1 text-xs text-muted-foreground">
                      {from?.name ?? "—"} → {to?.name ?? "—"}
                    </div>
                  </div>
                  <div className="amount col-start-2 row-start-2 break-all text-sm font-semibold sm:ml-auto sm:min-w-28 sm:text-right">
                    {money(t.amount)}
                  </div>
                  {canEdit && (
                    <div className="col-start-3 row-span-2 row-start-1 self-center">
                      <ConfirmDialog
                        trigger={
                          <Button
                            size="icon"
                            className="size-11 text-muted-foreground"
                            variant="ghost"
                            aria-label="Delete transfer"
                          >
                            <Trash2 className="size-4" />
                          </Button>
                        }
                        title="Delete transfer?"
                        description={`${from?.name ?? ""} → ${to?.name ?? ""} · ${money(t.amount)}`}
                        onConfirm={() => remove(t)}
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

export function ActivityRows({
  entries,
  accounts,
  categories,
  canEdit,
  showAuthors,
}: {
  entries: ActivityEntry[];
  accounts: AccountDTO[];
  categories: CategoryDTO[];
  canEdit: boolean;
  showAuthors: boolean;
}) {
  const dates = [...new Set(entries.map((entry) => entry.item.date))];
  return (
    <div className="space-y-5">
      {dates.map((date) => (
        <section key={date}>
          <h3 className="mb-2 border-b pb-2 text-xs font-medium text-muted-foreground">
            {format(parseISO(date), "EEE, d MMM yyyy")}
          </h3>
          <div className="divide-y">
            {entries
              .filter((entry) => entry.item.date === date)
              .map((entry) => (
                <div key={entry.kind + entry.item.id}>
                  {entry.kind === "transaction" ? (
                    <TransactionRows
                      transactions={[entry.item]}
                      accounts={accounts}
                      categories={categories}
                      canEdit={canEdit}
                      showAuthors={showAuthors}
                      showDateHeader={false}
                    />
                  ) : (
                    <TransferRows
                      transfers={[entry.item]}
                      accounts={accounts}
                      canEdit={canEdit}
                      showDateHeader={false}
                    />
                  )}
                </div>
              ))}
          </div>
        </section>
      ))}
    </div>
  );
}
