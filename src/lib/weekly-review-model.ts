export type ReviewChoice = "reviewed" | "deferred";
export type ReviewDecision = { revision: string; choice: ReviewChoice; until: string | null };
export type ReviewDecisions = Record<string, ReviewDecision>;
export type WeeklyReviewSource = {
  key: string;
  revision: string;
  kind: "bill" | "reimbursement" | "goal";
  title: string;
  detail: string;
  amount: string;
  currency: string;
  href: string;
  due: string | null;
  relevant: boolean;
};
export type WeeklyReviewItem = WeeklyReviewSource & {
  status: "pending" | ReviewChoice;
  changed: boolean;
  until: string | null;
};
export type WeeklyReviewReceipt = {
  id: string;
  at: string;
  items: { key: string; title: string; href: string; choice: "pending" | ReviewChoice; changed: boolean }[];
};
export type WeeklyReviewData = {
  available: true;
  version: number;
  digest: string;
  today: string;
  canEdit: boolean;
  items: WeeklyReviewItem[];
  receipts: WeeklyReviewReceipt[];
};

/** Previously reviewed sources reappear when their facts change. Deferred items wake after seven days. */
export function reviewItems(sources: WeeklyReviewSource[], decisions: ReviewDecisions, today: string): WeeklyReviewItem[] {
  return sources.filter(source => source.relevant || decisions[source.key]).map(source => {
    const previous = decisions[source.key];
    const changed = !!previous && previous.revision !== source.revision;
    const deferred = previous?.choice === "deferred" && !!previous.until && previous.until > today;
    const status = !previous || changed || (previous.choice === "deferred" && !deferred) ? "pending" : previous.choice;
    return { ...source, status, changed, until: status === "deferred" ? previous.until : null };
  });
}
