export type MerchantRule = {
  name: string; aliases: string[]; categoryId: string | null; tagIds: string[]; priority: number; enabled: boolean;
};
export type RuleRevision = MerchantRule & { id: string; version: number };

// Token boundaries let "Tim Hortons" match "TIM HORTONS #104" without matching "Tim Hortonsville".
export function normalizeMerchant(note: string) {
  return note.normalize("NFKC").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
}
export function matchingAlias(rule: MerchantRule, note: string) {
  const text = " " + normalizeMerchant(note) + " ";
  return [rule.name,...rule.aliases].find(alias => {
    const words = normalizeMerchant(alias);
    return words.length > 0 && text.includes(" " + words + " ");
  });
}
export function currentRules(history: RuleRevision[]) {
  const latest = new Map<string,RuleRevision>();
  for (const row of history) {
    if ((latest.get(row.id)?.version ?? 0) < row.version) latest.set(row.id,row);
  }
  return [...latest.values()].sort((a,b)=>b.priority-a.priority || a.id.localeCompare(b.id));
}
