"use client";

import Link from "next/link";
import { CreditCard, X } from "lucide-react";
import { useSyncExternalStore } from "react";
import { useFormat } from "./settings-provider";
import type { CategoryDTO, TransactionDTO } from "@/lib/queries";
import { cardBillShare } from "@/lib/card-bill";

const dismissKey = (workspace: string) => `card-bill-advice:${workspace}`;
const listeners = new Set<() => void>();
const subscribe = (fn: () => void) => { listeners.add(fn); return () => { listeners.delete(fn); }; };
function readDismissed(workspace: string) {
  try { return localStorage.getItem(dismissKey(workspace)) === "1"; } catch { return false; }
}

/**
 * When a big share of spending sits in a "Credit Card Bill" style category, explain why
 * that hides where money went and point at the fix (card account + statement import +
 * transfers). Display only: it never changes entries.
 */
export function CardBillAdvice({
  workspace, categories, transactions, canEdit,
}: {
  workspace: string;
  categories: CategoryDTO[];
  transactions: TransactionDTO[];
  canEdit: boolean;
}) {
  const { money } = useFormat();
  const dismissed = useSyncExternalStore(subscribe, () => readDismissed(workspace), () => true);
  const found = dismissed ? null : cardBillShare(categories, transactions);
  if (!found) return null;
  const { share, billTotal, name } = found;

  function dismiss() {
    try { localStorage.setItem(dismissKey(workspace), "1"); } catch { /* Still hide for this view. */ }
    listeners.forEach((fn) => fn());
  }

  return (
    <section aria-labelledby="card-bill-advice" className="dashboard-panel relative p-4 sm:p-5">
      <button type="button" onClick={dismiss} aria-label="Hide this tip"
        className="absolute right-2 top-2 grid size-8 place-items-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground">
        <X className="size-4" />
      </button>
      <div className="flex gap-3 pr-8">
        <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-muted text-muted-foreground"><CreditCard className="size-4" aria-hidden /></span>
        <div className="min-w-0 space-y-2">
          <h2 id="card-bill-advice" className="text-sm font-semibold">
            {share}% of this period’s spending is “{name}” <span className="amount font-normal text-muted-foreground">· {money(billTotal)}</span>
          </h2>
          <p className="text-sm text-muted-foreground">
            A card bill isn’t new spending: the purchases already happened on the card, so this hides where the money actually went.
            To see the real categories, add your card as an account, import its statement (categories are suggested from your history),
            and record each bill payment as a transfer from your bank to the card.
          </p>
          {canEdit && (
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
              <Link href="/imports" className="text-link">Import a card statement</Link>
              <Link href="/?tab=accounts" className="text-link">Add a card account</Link>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
