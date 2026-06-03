import { pgTable, pgEnum, text, numeric, date, timestamp, index } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

// Shared enum for the two flavours of money movement.
export const txKind = pgEnum("tx_kind", ["income", "expense"]);

// A place money lives: cash, a bank account, a card, a wallet, savings, etc.
export const accounts = pgTable("accounts", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  name: text("name").notNull(),
  type: text("type").notNull().default("bank"), // cash | bank | card | wallet | savings | investment
  icon: text("icon").notNull().default("wallet"),
  color: text("color").notNull().default("#6366f1"),
  // Opening balance so a new account can start with money already in it.
  initialBalance: numeric("initial_balance", { precision: 14, scale: 2 }).notNull().default("0"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// A label for a transaction, scoped to income OR expense, with its own icon+colour.
export const categories = pgTable(
  "categories",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    name: text("name").notNull(),
    kind: txKind("kind").notNull(),
    icon: text("icon").notNull().default("tag"),
    color: text("color").notNull().default("#64748b"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [index("cat_kind_idx").on(t.kind)],
);

// A single income or expense entry.
export const transactions = pgTable(
  "transactions",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    type: txKind("type").notNull(),
    amount: numeric("amount", { precision: 14, scale: 2 }).notNull(),
    date: date("date", { mode: "string" }).notNull(), // 'YYYY-MM-DD', timezone-free
    note: text("note").notNull().default(""),
    accountId: text("account_id").references(() => accounts.id, { onDelete: "cascade" }),
    categoryId: text("category_id").references(() => categories.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [index("tx_date_idx").on(t.date), index("tx_type_idx").on(t.type)],
);

export const accountsRelations = relations(accounts, ({ many }) => ({
  transactions: many(transactions),
}));
export const categoriesRelations = relations(categories, ({ many }) => ({
  transactions: many(transactions),
}));
export const transactionsRelations = relations(transactions, ({ one }) => ({
  account: one(accounts, { fields: [transactions.accountId], references: [accounts.id] }),
  category: one(categories, { fields: [transactions.categoryId], references: [categories.id] }),
}));

// Single-row application settings (currency, etc.).
export const appSettings = pgTable("app_settings", {
  id: text("id").primaryKey().default("app"),
  currencyCode: text("currency_code").notNull().default("INR"),
});

// Monthly spending budget for an expense category.
export const budgets = pgTable("budgets", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  categoryId: text("category_id").notNull().unique().references(() => categories.id, { onDelete: "cascade" }),
  amount: numeric("amount", { precision: 14, scale: 2 }).notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Money moved between two accounts (not income or expense).
export const transfers = pgTable(
  "transfers",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    fromAccountId: text("from_account_id").notNull().references(() => accounts.id, { onDelete: "cascade" }),
    toAccountId: text("to_account_id").notNull().references(() => accounts.id, { onDelete: "cascade" }),
    amount: numeric("amount", { precision: 14, scale: 2 }).notNull(),
    date: date("date", { mode: "string" }).notNull(),
    note: text("note").notNull().default(""),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [index("transfer_date_idx").on(t.date)],
);

// A template that auto-creates transactions on a schedule.
export const recurring = pgTable("recurring", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  type: txKind("type").notNull(),
  amount: numeric("amount", { precision: 14, scale: 2 }).notNull(),
  note: text("note").notNull().default(""),
  accountId: text("account_id").references(() => accounts.id, { onDelete: "cascade" }),
  categoryId: text("category_id").references(() => categories.id, { onDelete: "set null" }),
  frequency: text("frequency").notNull(), // weekly | monthly | yearly
  nextDate: date("next_date", { mode: "string" }).notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type Account = typeof accounts.$inferSelect;
export type Category = typeof categories.$inferSelect;
export type Transaction = typeof transactions.$inferSelect;
export type AppSettings = typeof appSettings.$inferSelect;
export type Budget = typeof budgets.$inferSelect;
export type Transfer = typeof transfers.$inferSelect;
export type Recurring = typeof recurring.$inferSelect;
