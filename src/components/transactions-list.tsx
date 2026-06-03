"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { format, parseISO } from "date-fns";
import { Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/icon";
import { TransactionDialog } from "@/components/transaction-dialog";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { createTransaction, deleteTransaction } from "@/lib/actions";
import { useFormat } from "@/components/settings-provider";
import { cn } from "@/lib/utils";
import type { AccountDTO, CategoryDTO, TransactionDTO } from "@/lib/queries";

type Props = { transactions: TransactionDTO[]; accounts: AccountDTO[]; categories: CategoryDTO[] };

/** Presentational list: groups the given transactions by date and renders compact rows. */
export function TransactionRows({ transactions, accounts, categories }: Props) {
  const router = useRouter();
  const { money } = useFormat();

  const groups = useMemo(() => {
    const m = new Map<string, TransactionDTO[]>();
    for (const t of transactions) {
      const arr = m.get(t.date);
      if (arr) arr.push(t);
      else m.set(t.date, [t]);
    }
    return [...m.entries()].sort((a, b) => b[0].localeCompare(a[0]));
  }, [transactions]);

  async function remove(t: TransactionDTO) {
    const res = await deleteTransaction(t.id);
    if (!res.ok) { toast.error(res.error); return; }
    router.refresh();
    toast.success("Transaction deleted", {
      action: {
        label: "Undo",
        onClick: async () => {
          const r = await createTransaction({
            type: t.type, amount: t.amount, date: t.date, note: t.note,
            accountId: t.accountId, categoryId: t.categoryId,
          });
          if (r.ok) { toast.success("Transaction restored"); router.refresh(); }
          else toast.error(r.error);
        },
      },
    });
  }

  if (!transactions.length) {
    return <p className="py-12 text-center text-sm text-muted-foreground">No transactions match these filters.</p>;
  }

  return (
    <div className="space-y-4">
      {groups.map(([date, rows]) => {
        const net = rows.reduce((s, t) => s + (t.type === "income" ? t.amount : -t.amount), 0);
        return (
          <div key={date}>
            <div className="mb-1 flex items-center justify-between px-0.5 text-[11px] text-muted-foreground">
              <span className="font-medium">{format(parseISO(date), "EEE, d MMM yyyy")}</span>
              <span className="font-mono tabular-nums">{net < 0 ? "−" : "+"}{money(Math.abs(net))}</span>
            </div>
            <div className="divide-y overflow-hidden rounded-lg border">
              {rows.map((t) => (
                <Row key={t.id} t={t} accounts={accounts} categories={categories} onDelete={remove} money={money} />
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
}: {
  t: TransactionDTO;
  accounts: AccountDTO[];
  categories: CategoryDTO[];
  onDelete: (t: TransactionDTO) => void;
  money: (n: number) => string;
}) {
  const isIncome = t.type === "income";
  const color = t.category?.color ?? "#94a3b8";
  return (
    <div className="group flex items-center gap-2.5 px-2.5 py-1.5">
      <span className="grid size-7 shrink-0 place-items-center rounded-md" style={{ backgroundColor: `${color}22`, color }}>
        <Icon name={t.category?.icon ?? "circle-help"} size={14} />
      </span>
      <div className="min-w-0 flex-1 leading-tight">
        <div className="truncate text-[13px] font-medium">{t.note || t.category?.name || "Transaction"}</div>
        <div className="truncate text-[11px] text-muted-foreground">
          {t.category?.name ?? "Uncategorised"} · {t.account?.name ?? "—"}
        </div>
      </div>
      <div className={cn("shrink-0 font-mono text-[13px] font-semibold tabular-nums", isIncome ? "text-positive" : "text-negative")}>
        {isIncome ? "+" : "−"}{money(t.amount)}
      </div>
      <div className="-mr-1 flex shrink-0 opacity-100 transition sm:opacity-0 sm:focus-within:opacity-100 sm:group-hover:opacity-100">
        <TransactionDialog
          transaction={t}
          accounts={accounts}
          categories={categories}
          trigger={<Button size="icon-xs" variant="ghost" aria-label="Edit transaction"><Pencil className="size-3" /></Button>}
        />
        <ConfirmDialog
          trigger={<Button size="icon-xs" variant="ghost" aria-label="Delete transaction"><Trash2 className="size-3" /></Button>}
          title="Delete transaction?"
          description={`${t.note || t.category?.name || "This transaction"} · ${money(t.amount)}`}
          onConfirm={() => onDelete(t)}
        />
      </div>
    </div>
  );
}
