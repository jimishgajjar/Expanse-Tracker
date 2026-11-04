import { addDays, format, parseISO } from "date-fns";
import { isActive } from "./commitments";
import type { GoalDTO, RecurringDTO, SplitData } from "./queries";

function openReimbursements(split: SplitData) {
  const names = new Map(split.otherMembers.map(member => [member.id, member.name]));
  const pairs = new Map<string, { first: string; second: string; cents: number }>();
  for (const { creditorId, debtorId, amount } of split.splits) {
    if (creditorId === debtorId) continue;
    const [first, second] = creditorId < debtorId ? [creditorId, debtorId] : [debtorId, creditorId];
    const key = JSON.stringify([first, second]);
    const pair = pairs.get(key) ?? { first, second, cents: 0 };
    pair.cents += (creditorId === first ? 1 : -1) * Math.round(amount * 100);
    pairs.set(key, pair);
  }

  return Array.from(pairs, ([key, { first, second, cents }]) => {
    const [creditor, debtor] = cents > 0 ? [first, second] : [second, first];
    const owedToYou = creditor === split.meId;
    const youOwe = debtor === split.meId;
    const creditorName = names.get(creditor) || "Member";
    const debtorName = names.get(debtor) || "Member";
    const label = youOwe ? `You owe ${creditorName}` : `${debtorName} owes ${owedToYou ? "you" : creditorName}`;
    return { key, label, amount: Math.abs(cents) / 100, involvesYou: owedToYou || youOwe };
  }).filter(pair => pair.amount > 0)
    .sort((a, b) => Number(b.involvesYou) - Number(a.involvesYou)
      || b.amount - a.amount || a.key.localeCompare(b.key));
}

export function weeklyHouseholdCheckIn(workspace: string, today: string, split: SplitData, schedules: RecurringDTO[], goals: GoalDTO[]) {
  // Only the authenticated household preview supplies this tracker-specific capability.
  if (!workspace || split.reimbursementWorkspace !== workspace) return null;
  const through = format(addDays(parseISO(today), 6), "yyyy-MM-dd");
  const activeBills = schedules.filter(rule => rule.type === "expense" && isActive(rule, today)
    && (!rule.endDate || rule.nextDate <= rule.endDate));
  const bills = activeBills.filter(rule => rule.nextDate >= today && rule.nextDate <= through)
    .sort((a, b) => a.nextDate.localeCompare(b.nextDate) || a.note.localeCompare(b.note) || a.id.localeCompare(b.id));
  const openGoals = goals.filter(goal => goal.savedAmount < goal.targetAmount)
    .sort((a, b) => Number(!a.deadline) - Number(!b.deadline) || (a.deadline ?? "").localeCompare(b.deadline ?? "")
      || a.name.localeCompare(b.name) || a.id.localeCompare(b.id));

  return {
    today, through, reimbursements: openReimbursements(split), bills,
    pastSchedules: activeBills.filter(rule => rule.nextDate < today).length,
    goals: openGoals, completedGoals: goals.length - openGoals.length,
  };
}

export type WeeklyHouseholdCheckIn = NonNullable<ReturnType<typeof weeklyHouseholdCheckIn>>;
