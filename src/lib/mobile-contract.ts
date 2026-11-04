/** JSON shared by native capture and its authenticated endpoint. */
export type DeviceEntry = {
  type: "income" | "expense"; amount: string; date: string; note: string;
  accountId: string; categoryId: string | null; tagIds: string[];
};
export type DeviceScope = { actor: string; workspace: string };
export type LedgerTotals = {income:number;expense:number;net:number;balance:number};
// Archived accounts can still contain money and remain part of the recorded ledger.
export function recordedBalance(accounts:ReadonlyArray<{balance:number}>) {
  return accounts.reduce((sum,a)=>sum+Math.round(a.balance*100),0)/100;
}
export type DeviceReceipt = { requestId: string; transactionId: string; replayed: boolean };
export type MobilePosition = {
  report: string | null;
  position: {cash:string|null; debt:string|null; worth:string|null; missing:string[]; native:Record<string,string>} | null;
  flows: {income:string; spending:string; missing:number};
};
