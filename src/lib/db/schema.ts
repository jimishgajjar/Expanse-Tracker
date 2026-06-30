import { pgTable, pgEnum, primaryKey, text, numeric, date, timestamp, integer, boolean, index, unique, jsonb } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

// Shared enum for the two flavours of money movement.
export const txKind = pgEnum("tx_kind", ["income", "expense"]);

const ws = () =>
  text("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" });

// A place money lives: cash, a bank account, a card, a wallet, savings, etc.
export const accounts = pgTable(
  "accounts",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    workspaceId: ws(),
    name: text("name").notNull(),
    type: text("type").notNull().default("bank"),
    icon: text("icon").notNull().default("wallet"),
    color: text("color").notNull().default("#6366f1"),
    initialBalance: numeric("initial_balance", { precision: 14, scale: 2 }).notNull().default("0"),
    archived: boolean("archived").notNull().default(false),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [index("acc_ws_idx").on(t.workspaceId)],
);

// A label for a transaction, scoped to income OR expense, with its own icon+colour.
export const categories = pgTable(
  "categories",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    workspaceId: ws(),
    name: text("name").notNull(),
    kind: txKind("kind").notNull(),
    icon: text("icon").notNull().default("tag"),
    color: text("color").notNull().default("#64748b"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [index("cat_ws_idx").on(t.workspaceId)],
);

// A single income or expense entry.
export const transactions = pgTable(
  "transactions",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    workspaceId: ws(),
    type: txKind("type").notNull(),
    amount: numeric("amount", { precision: 14, scale: 2 }).notNull(),
    date: date("date", { mode: "string" }).notNull(),
    note: text("note").notNull().default(""),
    accountId: text("account_id").references(() => accounts.id, { onDelete: "cascade" }),
    categoryId: text("category_id").references(() => categories.id, { onDelete: "set null" }),
    createdBy: text("created_by").references(() => users.id, { onDelete: "set null" }), // who entered it
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [index("tx_ws_date_idx").on(t.workspaceId, t.date), index("tx_type_idx").on(t.type)],
);

// Money moved between two accounts (not income or expense).
export const transfers = pgTable(
  "transfers",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    workspaceId: ws(),
    fromAccountId: text("from_account_id").notNull().references(() => accounts.id, { onDelete: "cascade" }),
    toAccountId: text("to_account_id").notNull().references(() => accounts.id, { onDelete: "cascade" }),
    amount: numeric("amount", { precision: 14, scale: 2 }).notNull(),
    date: date("date", { mode: "string" }).notNull(),
    note: text("note").notNull().default(""),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [index("transfer_ws_date_idx").on(t.workspaceId, t.date)],
);

// Monthly spending budget for an expense category.
export const budgets = pgTable(
  "budgets",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    workspaceId: ws(),
    categoryId: text("category_id").notNull().unique().references(() => categories.id, { onDelete: "cascade" }),
    amount: numeric("amount", { precision: 14, scale: 2 }).notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [index("budget_ws_idx").on(t.workspaceId)],
);

// A template that auto-creates transactions on a schedule.
export const recurring = pgTable(
  "recurring",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    workspaceId: ws(),
    type: txKind("type").notNull(),
    amount: numeric("amount", { precision: 14, scale: 2 }).notNull(),
    note: text("note").notNull().default(""),
    accountId: text("account_id").references(() => accounts.id, { onDelete: "cascade" }),
    categoryId: text("category_id").references(() => categories.id, { onDelete: "set null" }),
    frequency: text("frequency").notNull(),
    nextDate: date("next_date", { mode: "string" }).notNull(),
    endDate: date("end_date", { mode: "string" }), // stop generating after this date
    maxOccurrences: integer("max_occurrences"), // …or after this many have been created
    occurrenceCount: integer("occurrence_count").notNull().default(0),
    alertsEnabled: boolean("alerts_enabled").notNull().default(false),
    remindDaysBefore: integer("remind_days_before").notNull().default(1), // reminder lead time
    lastRemindedFor: date("last_reminded_for", { mode: "string" }), // dedups "upcoming" reminders
    commitmentType: text("commitment_type").notNull().default("other"), // subscription | bill | emi | other
    autoPost: boolean("auto_post").notNull().default(true), // false = remind to log (variable bills)
    totalAmount: numeric("total_amount", { precision: 14, scale: 2 }), // optional EMI total
    // Append-only log of price changes — each entry is the amount that became
    // effective at `at` (ISO). Additive column; existing rows default to [].
    priceHistory: jsonb("price_history").$type<{ amount: number; at: string }[]>().notNull().default([]),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [index("recurring_ws_idx").on(t.workspaceId)],
);

// Per-workspace settings (currency, etc.).
export const appSettings = pgTable("app_settings", {
  workspaceId: text("workspace_id").primaryKey().references(() => workspaces.id, { onDelete: "cascade" }),
  currencyCode: text("currency_code").notNull().default("INR"),
  lastDigestMonth: text("last_digest_month"), // YYYY-MM of the last monthly digest sent
  digestEnabled: boolean("digest_enabled").notNull().default(true),
});

// A shared-expense IOU between two members: debtor owes creditor `amount`.
export const splits = pgTable(
  "splits",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    workspaceId: ws(),
    note: text("note").notNull().default(""),
    creditorId: text("creditor_id").notNull().references(() => users.id, { onDelete: "cascade" }), // is owed
    debtorId: text("debtor_id").notNull().references(() => users.id, { onDelete: "cascade" }), // owes
    amount: numeric("amount", { precision: 14, scale: 2 }).notNull(),
    settledAt: timestamp("settled_at"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [index("split_ws_idx").on(t.workspaceId)],
);

// A savings target with progress.
export const goals = pgTable(
  "goals",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    workspaceId: ws(),
    name: text("name").notNull(),
    targetAmount: numeric("target_amount", { precision: 14, scale: 2 }).notNull(),
    savedAmount: numeric("saved_amount", { precision: 14, scale: 2 }).notNull().default("0"),
    color: text("color").notNull().default("#047857"),
    deadline: date("deadline", { mode: "string" }),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [index("goal_ws_idx").on(t.workspaceId)],
);

// Dedup store so a budget threshold (80%/100%) only alerts once per category per month.
export const budgetAlerts = pgTable(
  "budget_alerts",
  {
    workspaceId: ws(),
    categoryId: text("category_id").notNull().references(() => categories.id, { onDelete: "cascade" }),
    period: text("period").notNull(), // YYYY-MM
    threshold: integer("threshold").notNull(), // 80 | 100
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.workspaceId, t.categoryId, t.period, t.threshold] })],
);

// A free-form label attachable to many transactions — independent of the single
// category (which still drives analytics). Tags are for grouping / filtering.
export const tags = pgTable(
  "tags",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    workspaceId: ws(),
    name: text("name").notNull(),
    color: text("color").notNull().default("#64748b"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [index("tag_ws_idx").on(t.workspaceId), unique("tag_ws_name_uq").on(t.workspaceId, t.name)],
);

export const transactionTags = pgTable(
  "transaction_tags",
  {
    transactionId: text("transaction_id").notNull().references(() => transactions.id, { onDelete: "cascade" }),
    tagId: text("tag_id").notNull().references(() => tags.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.transactionId, t.tagId] }), index("txtag_tag_idx").on(t.tagId)],
);

export const transactionsRelations = relations(transactions, ({ one }) => ({
  account: one(accounts, { fields: [transactions.accountId], references: [accounts.id] }),
  category: one(categories, { fields: [transactions.categoryId], references: [categories.id] }),
  creator: one(users, { fields: [transactions.createdBy], references: [users.id] }),
}));

// ── auth + workspaces ────────────────────────────────────
export const users = pgTable("users", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  email: text("email").notNull().unique(),
  name: text("name").notNull().default(""),
  passwordHash: text("password_hash").notNull(),
  emailVerifiedAt: timestamp("email_verified_at"), // null until they confirm via email link
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// A "tracker" — a personal one per user, shareable with others.
export const workspaces = pgTable("workspaces", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  name: text("name").notNull(),
  ownerId: text("owner_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const workspaceMembers = pgTable(
  "workspace_members",
  {
    workspaceId: text("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
    userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    role: text("role").notNull().default("member"), // owner | member
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.workspaceId, t.userId] }), index("wm_user_idx").on(t.userId)],
);

export const sessions = pgTable("sessions", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  workspaceId: text("workspace_id").references(() => workspaces.id, { onDelete: "set null" }), // active workspace
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const passwordResets = pgTable("password_resets", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  expiresAt: timestamp("expires_at").notNull(),
});

// Single-use tokens emailed to confirm a new account owns its address.
export const emailVerifications = pgTable("email_verifications", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  expiresAt: timestamp("expires_at").notNull(),
});

// Fixed-window counters for throttling auth attempts (brute force / spam).
export const rateLimits = pgTable("rate_limits", {
  key: text("key").primaryKey(),
  count: integer("count").notNull().default(0),
  expiresAt: timestamp("expires_at").notNull(),
});

// Web Push (browser/phone notification) subscriptions, one row per device/browser.
export const pushSubscriptions = pgTable(
  "push_subscriptions",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    endpoint: text("endpoint").notNull().unique(),
    p256dh: text("p256dh").notNull(),
    auth: text("auth").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [index("push_user_idx").on(t.userId)],
);

// Pending invites to a specific workspace, keyed by email.
export const invitations = pgTable(
  "invitations",
  {
    workspaceId: text("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
    email: text("email").notNull(),
    role: text("role").notNull().default("member"), // member | viewer
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.workspaceId, t.email] }), index("invite_email_idx").on(t.email)],
);

export type Account = typeof accounts.$inferSelect;
export type Category = typeof categories.$inferSelect;
export type Transaction = typeof transactions.$inferSelect;
export type AppSettings = typeof appSettings.$inferSelect;
export type Budget = typeof budgets.$inferSelect;
export type Transfer = typeof transfers.$inferSelect;
export type Recurring = typeof recurring.$inferSelect;
export type Goal = typeof goals.$inferSelect;
export type Split = typeof splits.$inferSelect;
export type Tag = typeof tags.$inferSelect;
export type User = typeof users.$inferSelect;
export type Workspace = typeof workspaces.$inferSelect;
export type PushSubscription = typeof pushSubscriptions.$inferSelect;
