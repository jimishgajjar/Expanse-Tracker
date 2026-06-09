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
export type Workspace = { id: string; name: string; role: string; ownerId: string };
export type Goal = { id: string; name: string; targetAmount: number; savedAmount: number; deadline: string | null; color: string };

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
