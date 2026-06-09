export type Account = {
  id: string; name: string; type: string; icon: string; color: string;
  initialBalance: number; income: number; expense: number; balance: number; archived: boolean;
};
export type Category = { id: string; name: string; kind: "income" | "expense"; icon: string; color: string };
export type Ref = { name: string; icon: string; color: string } | null;
export type Tag = { id: string; name: string; color: string; count?: number };
export type Transaction = {
  id: string; type: "income" | "expense"; amount: number; date: string; note: string;
  accountId: string | null; categoryId: string | null; account: Ref; category: Ref;
  createdByName: string | null; tags: Tag[];
};
export type Transfer = { id: string; amount: number; date: string; note: string; fromAccountId: string; toAccountId: string };
export type Settings = { currencyCode: string; currency: string; locale: string };
export type Budget = { categoryId: string; name: string; icon: string; color: string; budget: number; spent: number };
export type NetWorthPoint = { key: string; value: number };
export type Workspace = { id: string; name: string; role: string; ownerId: string };
export type Member = { id: string; email: string; name: string; role: string };
export type SplitBalance = { userId: string; name: string; net: number };
export type SplitItem = { id: string; note: string; creditorId: string; debtorId: string; amount: number };
export type SplitData = { meId: string; otherMembers: { id: string; name: string }[]; balances: SplitBalance[]; splits: SplitItem[] };
export type Goal = { id: string; name: string; targetAmount: number; savedAmount: number; deadline: string | null; color: string };
export type Recurring = {
  id: string;
  type: "income" | "expense";
  amount: number;
  note: string;
  accountId: string | null;
  categoryId: string | null;
  frequency: string;
  nextDate: string;
  endDate: string | null;
  maxOccurrences: number | null;
  occurrenceCount: number;
  alertsEnabled: boolean;
  remindDaysBefore: number;
  commitmentType: string;
  autoPost: boolean;
  totalAmount: number | null;
};

export type Bootstrap = {
  user: { id: string; email: string; name: string };
  workspaces: Workspace[];
  activeWorkspaceId: string | null;
  settings: Settings;
  range: { type: string; anchor: string; start: string; end: string };
  accounts: Account[];
  categories: Category[];
  tags: Tag[];
  transactions: Transaction[];
  transfers: Transfer[];
};
