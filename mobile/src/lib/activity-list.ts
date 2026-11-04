import type { Account, Transaction, Transfer } from "./types";
export const filters = ["all","expense","income","transfer"] as const;
export type EntryFilter = typeof filters[number];
type Row = {kind:"entry";value:Transaction} | {kind:"transfer";value:Transfer;from:string;to:string};
export function activityGroups(transactions:Transaction[], transfers:Transfer[], accounts:Account[],
  filter:EntryFilter, search:string, account?:string) {
  const needle=search.trim().toLowerCase();
  const days=new Map<string,Row[]>();
  function add(row:Row, words:string) {
    if (!words.toLowerCase().includes(needle)) return;
    const day=row.value.date;
    const list=days.get(day)??[];list.push(row);days.set(day,list);
  }
  for(const tx of transactions) {
    if ((account && tx.accountId!==account) || (filter!=="all" && filter!==tx.type)) continue;
    add({kind:"entry",value:tx},[tx.note,tx.category?.name,tx.account?.name,...tx.tags.map(t=>t.name)].join(" "));
  }
  if(filter==="all" || filter==="transfer") {
    const names=new Map(accounts.map(a=>[a.id,a.name]));
    for(const tx of transfers) {
      if(account && tx.fromAccountId!==account && tx.toAccountId!==account) continue;
      const from=names.get(tx.fromAccountId)??"Unavailable account",to=names.get(tx.toAccountId)??"Unavailable account";
      add({kind:"transfer",value:tx,from,to},[tx.note,from,to,"transfer"].join(" "));
    }
  }
  return [...days.entries()].sort(([a],[b])=>b.localeCompare(a));
}
