import { pgTable, pgEnum, primaryKey, text, numeric, date, timestamp, integer, boolean, index, unique, jsonb, check, foreignKey } from "drizzle-orm/pg-core";
import { relations, sql } from "drizzle-orm";
import type { MerchantRule } from "../merchant-rule-model";
import type { DeliveryChannel, HouseholdTopic } from "../notification-options";

// Shared enum for the two flavours of money movement.
export const txKind = pgEnum("tx_kind", ["income", "expense"]);

const ws = () =>
  text("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" });

export const merchantRuleVersions = pgTable("merchant_rule_versions", {
  workspaceId: ws(), accountId: text("account_id").notNull(), kind: txKind("kind").notNull(),
  id: text("id").notNull(), version: integer("version").notNull(),
  definition: jsonb("definition").$type<MerchantRule>().notNull(),
  actorId: text("actor_id").notNull(), createdAt: timestamp("created_at").notNull().defaultNow(),
}, t=>[primaryKey({columns:[t.workspaceId,t.accountId,t.kind,t.id,t.version]})]);

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
  (t) => [index("tx_ws_date_idx").on(t.workspaceId, t.date), index("transactions_activity_order").on(t.workspaceId,t.date.desc(),t.createdAt.desc(),t.id.desc()), index("tx_type_idx").on(t.type)],
);

// A withdrawn comment retains only a retry marker. Live comments protect the
// transaction from deletion, including deletion through its parent account.
export const transactionComments = pgTable("transaction_comments", {
  id: text("id").primaryKey(),
  transactionId: text("transaction_id").references(() => transactions.id, { onDelete: "restrict" }),
  authorId: text("author_id").references(() => users.id, { onDelete: "set null" }),
  body: text("body"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, t => [
  index("transaction_comment_page").on(t.transactionId, t.createdAt, t.id),
  check("transaction_comment_content", sql`(${t.body} IS NULL AND ${t.transactionId} IS NULL) OR
    (${t.body} IS NOT NULL AND ${t.transactionId} IS NOT NULL AND char_length(trim(${t.body})) BETWEEN 1 AND 1000)`),
]);

// Money moved between two accounts (not income or expense).
export const purchaseAllocations = pgTable("purchase_allocations", {
  transactionId: text("transaction_id").notNull().references(()=>transactions.id,{onDelete:"cascade"}),
  categoryId: text("category_id").notNull().references(()=>categories.id,{onDelete:"restrict"}),
  amount: numeric("amount",{precision:14,scale:2}).notNull(),
}, t=>[primaryKey({columns:[t.transactionId,t.categoryId]}),index("allocation_category_idx").on(t.categoryId)]);

export const refundLinks=pgTable("refund_links",{
  id:text("id").primaryKey(),workspaceId:ws(),actorId:text("actor_id").notNull(),
  creditId:text("credit_id").notNull().unique().references(()=>transactions.id,{onDelete:"restrict"}),
  purchaseId:text("purchase_id").notNull().references(()=>transactions.id,{onDelete:"restrict"}),
  portions:jsonb("portions").$type<{categoryId:string|null;amount:string}[]>().notNull(),
  createdAt:timestamp("created_at").notNull().defaultNow(),
},t=>[index("refund_purchase_idx").on(t.workspaceId,t.purchaseId)]);

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
  (t) => [index("transfer_ws_date_idx").on(t.workspaceId, t.date), index("transfers_activity_order").on(t.workspaceId,t.date.desc(),t.createdAt.desc(),t.id.desc())],
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
    tagIds: jsonb("tag_ids").$type<string[]>().notNull().default([]),
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

// The reviewed IOUs and request identity survive a reversal. Reopening releases
// the payment link but never removes the payment from the ledger.
export const reimbursements = pgTable("reimbursements", {
  id: text("id").primaryKey(), workspaceId: ws(), actorId: text("actor_id").notNull(),
  peerId: text("peer_id").notNull(), kind: txKind("kind").notNull(),
  amount: numeric("amount", {precision:14, scale:2}).notNull(),
  method: text("method").notNull(), splitIds: text("split_ids").array().notNull(),
  requestHash: text("request_hash").notNull(),
  transactionId: text("transaction_id").unique().references(() => transactions.id, {onDelete:"restrict"}),
  transferId: text("transfer_id").unique().references(() => transfers.id, {onDelete:"restrict"}),
  createdAt: timestamp("created_at", {withTimezone:true}).defaultNow().notNull(),
  reopenedAt: timestamp("reopened_at", {withTimezone:true}),
}, t => [
  index("reimbursement_household_idx").on(t.workspaceId, t.createdAt),
  check("reimbursement_terms", sql`${t.actorId} <> ${t.peerId} AND ${t.amount} > 0 AND cardinality(${t.splitIds}) > 0
    AND ${t.method} IN ('link','record','outside') AND num_nonnulls(${t.transactionId},${t.transferId}) =
    CASE WHEN ${t.reopenedAt} IS NOT NULL OR ${t.method}='outside' THEN 0 ELSE 1 END`),
]);

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

// A new, isolated ledger inside a household; no row means ordinary shared tracker.
// Data remains in the existing ledger tables, without mixing household/private balances.
export const personalLedgers = pgTable("personal_ledgers", {
  ledgerId: text("ledger_id").primaryKey().references(() => workspaces.id, {onDelete:"cascade"}),
  householdId: text("household_id").notNull().references(() => workspaces.id, {onDelete:"restrict"}),
  personId: text("person_id").notNull().references(() => users.id, {onDelete:"restrict"}),
}, t => [
  unique("personal_ledger_per_member").on(t.householdId,t.personId),
  check("personal_ledger_distinct",sql`${t.ledgerId} <> ${t.householdId}`),
]);

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

// Each row is an explicit opt-in. Leaving a household also removes its opt-ins.
export const notificationPreferences = pgTable("notification_preferences", {
  workspaceId: text("workspace_id").notNull(),
  userId: text("user_id").notNull(),
  topic: text("topic").$type<HouseholdTopic>().notNull(),
  channel: text("channel").$type<DeliveryChannel>().notNull(),
}, t => [
  primaryKey({columns:[t.workspaceId,t.userId,t.topic,t.channel]}),
  foreignKey({columns:[t.workspaceId,t.userId],foreignColumns:[workspaceMembers.workspaceId,workspaceMembers.userId]}).onDelete("cascade"),
  check("notification_household_only", sql`${t.workspaceId} NOT LIKE 'personal:%'`),
  check("notification_topic", sql`${t.topic} IN ('upcoming','posted','budget','monthly','mention')`),
  check("notification_channel", sql`${t.channel} IN ('email','push')`),
]);

export const invitationPreferences = pgTable("invitation_preferences", {
  userId: text("user_id").notNull().references(() => users.id, {onDelete:"cascade"}),
  channel: text("channel").$type<DeliveryChannel>().notNull(),
}, t => [
  primaryKey({columns:[t.userId,t.channel]}),
  check("invitation_channel", sql`${t.channel} IN ('email','push')`),
]);

export const commentMentions = pgTable("comment_mentions", {
  commentId: text("comment_id").notNull().references(() => transactionComments.id, {onDelete:"cascade"}),
  workspaceId: text("workspace_id").notNull(),
  userId: text("user_id").notNull(),
}, t => [
  primaryKey({columns:[t.commentId,t.userId]}),
  foreignKey({columns:[t.workspaceId,t.userId],foreignColumns:[workspaceMembers.workspaceId,workspaceMembers.userId]}).onDelete("cascade"),
  check("mention_household_only", sql`${t.workspaceId} NOT LIKE 'personal:%'`),
]);

// A null report is a revoked share. Retaining its revision invalidates old previews.
export const accountShares = pgTable("account_shares", {
  id: text("id").primaryKey(),
  ledgerId: text("ledger_id").notNull().references(() => personalLedgers.ledgerId, {onDelete:"cascade"}),
  accountId: text("account_id").notNull().references(() => accounts.id, {onDelete:"cascade"}),
  householdId: text("household_id").notNull(),
  ownerId: text("owner_id").notNull(),
  recipientId: text("recipient_id").notNull(),
  revision: text("revision").notNull(),
  report: jsonb("report"),
  updatedAt: timestamp("updated_at", {withTimezone:true}).defaultNow().notNull(),
}, t => [
  unique("account_share_recipient").on(t.accountId, t.recipientId),
  foreignKey({columns:[t.householdId,t.ownerId],foreignColumns:[workspaceMembers.workspaceId,workspaceMembers.userId]}).onDelete("cascade"),
  foreignKey({columns:[t.householdId,t.recipientId],foreignColumns:[workspaceMembers.workspaceId,workspaceMembers.userId]}).onDelete("cascade"),
  check("account_share_other_member", sql`${t.ownerId} <> ${t.recipientId}`),
  index("account_share_inbox").on(t.householdId, t.recipientId),
]);

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

// Immutable creation/edit snapshots. `create:<sha256>` IDs also retain retry
// receipts after transaction deletion; do not prune them or add a transaction FK
// cascade without designing a replacement idempotency retention policy.
export const transactionHistory = pgTable("transaction_history", {
  id: text("id").primaryKey(), workspaceId: ws(), transactionId: text("transaction_id").notNull(),
  actorId: text("actor_id").references(() => users.id, {onDelete: "set null"}),
  actorName: text("actor_name").notNull(), before: jsonb("before").$type<Record<string,unknown>>().notNull(),
  after: jsonb("after").$type<Record<string,unknown>>().notNull(), createdAt: timestamp("created_at").notNull().defaultNow(),
}, t => [index("history_ws_tx_idx").on(t.workspaceId,t.transactionId,t.createdAt)]);
export const backupReports = pgTable("backup_reports", {
  workspaceId: text("workspace_id").primaryKey().references(() => workspaces.id,{onDelete:"cascade"}),
  verifiedAt: timestamp("verified_at").notNull(), rowCount: integer("row_count").notNull(),
  destination: text("destination").notNull().default("Encrypted local files"),
});

// Statement evidence is separate from the ledger. No account FK: retain saved
// evidence after an account is deleted; reads then mark the review as changed.
export const reconciliationSessions = pgTable("reconciliation_sessions", {
  id: text("id").primaryKey(), workspaceId: ws(), accountId: text("account_id").notNull(),
  startDate: date("start_date", {mode:"string"}).notNull(), endDate: date("end_date", {mode:"string"}).notNull(),
  closingBalance: numeric("closing_balance", {precision:14,scale:2}).notNull(),
  snapshot: jsonb("snapshot").notNull(), decisions: jsonb("decisions").notNull().default({}),
  duplicatesReviewed: boolean("duplicates_reviewed").notNull().default(false),
  status: text("status").notNull().default("draft"), version: integer("version").notNull().default(1),
  actorId: text("actor_id").references(()=>users.id,{onDelete:"set null"}), actorName: text("actor_name").notNull(),
  events: jsonb("events").notNull().default([]),
  createdAt: timestamp("created_at").notNull().defaultNow(), completedAt: timestamp("completed_at"),
}, t=>[index("reconciliation_ws_account_idx").on(t.workspaceId,t.accountId,t.createdAt)]);

// No foreign key to resulting ledger entries: retain import receipts even after a correction.
export const fileImports = pgTable("file_imports", {
  id: text("id").primaryKey(), workspaceId: ws(), fileHash: text("file_hash").notNull(),
  filename: text("filename").notNull(), headers: jsonb("headers").notNull(), mapping: jsonb("mapping").notNull(),
  currency: text("currency").notNull(), rows: jsonb("rows").notNull(), receipt: jsonb("receipt"),
  version: integer("version").notNull().default(1), stagedBy: text("staged_by").notNull(),
  approvedBy: text("approved_by"), approvedAt: timestamp("approved_at"), createdAt: timestamp("created_at").notNull().defaultNow(),
}, t=>[unique("import_ws_file_key").on(t.workspaceId,t.fileHash)]);

// One normalized receipt image per transaction. Remove it explicitly before deleting its parent.
export const receiptImages = pgTable("receipt_images", {
  transactionId:text("transaction_id").primaryKey().references(()=>transactions.id,{onDelete:"restrict"}),
  id:text("id").notNull().unique(), jpeg:text("jpeg").notNull(), bytes:integer("bytes").notNull(),
  createdAt:timestamp("created_at").notNull().defaultNow(),
});
export const captureDrafts = pgTable("capture_drafts", {
  workspaceId:ws(), userId:text("user_id").notNull().references(()=>users.id,{onDelete:"cascade"}),
  id:text("id").notNull(),version:integer("version").notNull(),payload:jsonb("payload").notNull(),
  updatedAt:timestamp("updated_at").notNull().defaultNow(),
},t=>[primaryKey({columns:[t.workspaceId,t.userId,t.id]})]);

export const monthlyPlans = pgTable("monthly_plans",{
  workspaceId:ws(),categoryId:text("category_id").notNull().references(()=>categories.id,{onDelete:"restrict"}),
  month:date("month").notNull(),amount:numeric("amount",{precision:14,scale:2}).notNull(),
  rollover:boolean("rollover").notNull(),version:integer("version").notNull().default(1),
},t=>[primaryKey({columns:[t.workspaceId,t.categoryId,t.month]})]);

export const goalReservations = pgTable("goal_reservations",{
  id:text("id").primaryKey(), workspaceId:ws(),actorId:text("actor_id").notNull(),
  goalId:text("goal_id").notNull().references(()=>goals.id,{onDelete:"restrict"}),
  accountId:text("account_id").notNull().references(()=>accounts.id,{onDelete:"restrict"}),
  delta:numeric("delta",{precision:14,scale:2}).notNull(),createdAt:timestamp("created_at").notNull().defaultNow(),
},t=>[index("goal_reservation_account_idx").on(t.workspaceId,t.accountId)]);

export const payPeriodPlans=pgTable("pay_period_plans",{
  workspaceId:ws(),accountId:text("account_id").notNull().references(()=>accounts.id,{onDelete:"restrict"}),
  start:date("start_date").notNull(),next:date("next_date").notNull(),cadence:text("cadence").notNull(),
  expected:numeric("expected",{precision:14,scale:2}).notNull(),limit:numeric("spending_limit",{precision:14,scale:2}).notNull(),
  version:integer("version").notNull().default(1),
},t=>[primaryKey({columns:[t.workspaceId,t.accountId,t.start]})]);
export const annualGoalPlans=pgTable("annual_goal_plans",{
  workspaceId:ws(),goalId:text("goal_id").notNull().references(()=>goals.id,{onDelete:"restrict"}),
  due:date("due").notNull(),version:integer("version").notNull().default(1),
},t=>[primaryKey({columns:[t.workspaceId,t.goalId]})]);

export const budgetMoves = pgTable("budget_moves", {
  id:text("id").primaryKey(), workspaceId:ws(), month:date("month").notNull(),
  fromCategory:text("from_category").notNull().references(()=>categories.id,{onDelete:"restrict"}),
  toCategory:text("to_category").notNull().references(()=>categories.id,{onDelete:"restrict"}),
  amount:numeric("amount",{precision:14,scale:2}).notNull(), note:text("note").notNull().default(""),
  actorId:text("actor_id").notNull(), createdAt:timestamp("created_at").notNull().defaultNow(),
},t=>[index("budget_move_month_idx").on(t.workspaceId,t.month),
  check("budget_move_valid",sql`${t.amount}>0 AND ${t.fromCategory}<>${t.toCategory} AND extract(day from ${t.month})=1`)]);

export const goalOpeningReviews = pgTable("goal_opening_reviews", {
  id:text("id").primaryKey(), workspaceId:ws(),
  goalId:text("goal_id").notNull().references(()=>goals.id,{onDelete:"restrict"}),
  version:integer("version").notNull(), actorId:text("actor_id").notNull(),
  opening:numeric("opening",{precision:14,scale:2}).notNull(),
  reserved:numeric("reserved",{precision:16,scale:2}).notNull(),
  outside:numeric("outside",{precision:14,scale:2}).notNull(),
  createdAt:timestamp("created_at").notNull().defaultNow(),
},t=>[unique("goal_opening_review_version").on(t.workspaceId,t.goalId,t.version),
  check("goal_opening_review_amount",sql`${t.outside}>=0 AND ${t.outside}<=${t.opening} AND ${t.version}>0`)]);

export const forecastScenarios = pgTable("forecast_scenarios", {
  workspaceId:ws(), accountId:text("account_id").notNull().references(()=>accounts.id,{onDelete:"cascade"}),
  scenario:text("scenario").notNull(), daily:numeric("daily",{precision:14,scale:2}).notNull(),
  buffer:numeric("buffer",{precision:14,scale:2}).notNull(),version:integer("version").notNull(),
},t=>[primaryKey({columns:[t.workspaceId,t.accountId,t.scenario]}),
  check("forecast_scenario_values",sql`${t.scenario} IN ('base','conservative') AND ${t.daily}>=0 AND ${t.buffer}>=0 AND ${t.version}>0`)]);

export const householdSetup=pgTable("household_setup",{
  workspaceId:ws().primaryKey(),timezone:text("timezone").notNull(),
  billsSkipped:boolean("bills_skipped").notNull().default(false),inviteSkipped:boolean("invite_skipped").notNull().default(false),
});
export const openingCutoffs=pgTable("opening_cutoffs",{
  workspaceId:ws(),accountId:text("account_id").primaryKey().references(()=>accounts.id,{onDelete:"cascade"}),
  throughDate:date("through_date").notNull(),statementBalance:numeric("statement_balance",{precision:14,scale:2}).notNull(),
});
export const pilotFeedback=pgTable("pilot_feedback",{
  id:text("id").primaryKey(),workspaceId:ws(),actor:text("actor").notNull().references(()=>users.id,{onDelete:"cascade"}),
  severity:text("severity").notNull(),message:text("message").notNull(),status:text("status").notNull().default("received"),
  createdAt:timestamp("created_at",{withTimezone:true}).notNull().defaultNow(),
},t=>[index("pilot_feedback_member").on(t.workspaceId,t.actor,t.createdAt.desc())]);

// Debt reviews and currency bookings are additive. The SQL migrations also
// guard edits to booked ledger amounts and coordinate old and new refund flows.
export const financeAccounts=pgTable("finance_accounts",{
  workspaceId:ws(),accountId:text("account_id").notNull().references(()=>accounts.id,{onDelete:"restrict"}),
  role:text("role").notNull(),reviewedBalance:numeric("reviewed_balance").notNull(),adjustment:numeric("adjustment").notNull(),
  interpretation:text("interpretation").notNull(),reviewer:text("reviewer").notNull(),
  reviewedAt:timestamp("reviewed_at",{withTimezone:true}).notNull().defaultNow(),
},t=>[primaryKey({columns:[t.workspaceId,t.accountId]})]);

export const debtStatements=pgTable("debt_statements",{
  workspaceId:text("workspace_id").notNull(),accountId:text("account_id").notNull(),starts:date("starts").notNull(),
  ends:date("ends").notNull(),due:date("due").notNull(),closing:numeric("closing").notNull(),minimum:numeric("minimum").notNull(),
},t=>[primaryKey({columns:[t.workspaceId,t.accountId,t.ends]}),foreignKey({columns:[t.workspaceId,t.accountId],
  foreignColumns:[financeAccounts.workspaceId,financeAccounts.accountId]}).onDelete("cascade")]);

export const loanTerms=pgTable("loan_terms",{
  workspaceId:text("workspace_id").notNull(),accountId:text("account_id").notNull(),apr:numeric("apr").notNull(),
  payment:numeric("payment").notNull(),monthlyFee:numeric("monthly_fee").notNull(),variable:boolean("variable").notNull(),
},t=>[primaryKey({columns:[t.workspaceId,t.accountId]}),foreignKey({columns:[t.workspaceId,t.accountId],
  foreignColumns:[financeAccounts.workspaceId,financeAccounts.accountId]}).onDelete("cascade")]);

export const financeBooks=pgTable("finance_books",{
  workspaceId:text("workspace_id").primaryKey().references(()=>workspaces.id,{onDelete:"cascade"}),currency:text("currency").notNull(),
});
const bookId=()=>text("workspace_id").notNull().references(()=>financeBooks.workspaceId,{onDelete:"cascade"});
export const accountDenominations=pgTable("account_denominations",{
  workspaceId:bookId(),accountId:text("account_id").notNull(),currency:text("currency").notNull(),
},t=>[primaryKey({columns:[t.workspaceId,t.accountId]}),foreignKey({columns:[t.workspaceId,t.accountId],
  foreignColumns:[financeAccounts.workspaceId,financeAccounts.accountId]}).onDelete("cascade")]);
export const valuationQuotes=pgTable("valuation_quotes",{
  workspaceId:bookId(),currency:text("currency").notNull(),asOf:timestamp("as_of",{withTimezone:true}).notNull(),
  rate:numeric("rate").notNull(),source:text("source").notNull(),
},t=>[primaryKey({columns:[t.workspaceId,t.currency,t.asOf]})]);
export const financeOperations=pgTable("finance_operations",{
  id:text("id").primaryKey(),workspaceId:bookId(),actor:text("actor").notNull(),fingerprint:text("fingerprint").notNull(),
});
export const financeBookings=pgTable("finance_bookings",{
  id:text("id").primaryKey(),operationId:text("operation_id").notNull().references(()=>financeOperations.id,{onDelete:"restrict"}),
  workspaceId:bookId(),transactionId:text("transaction_id").unique().references(()=>transactions.id,{onDelete:"restrict"}),
  transferId:text("transfer_id").unique().references(()=>transfers.id,{onDelete:"restrict"}),refundOf:text("refund_of").references(()=>transactions.id,{onDelete:"restrict"}),
  kind:text("kind").notNull(),originalAmount:numeric("original_amount").notNull(),originalCurrency:text("original_currency").notNull(),
  originalRate:numeric("original_rate").notNull(),accountAmount:numeric("account_amount").notNull(),accountCurrency:text("account_currency").notNull(),
  reportingAmount:numeric("reporting_amount"),reportingCurrency:text("reporting_currency").notNull(),bookedRate:numeric("booked_rate"),
  source:text("source").notNull(),asOf:timestamp("as_of",{withTimezone:true}).notNull(),received:numeric("received"),
  destinationCurrency:text("destination_currency"),exchangeRate:numeric("exchange_rate"),residual:numeric("residual"),
  principalPaid:numeric("principal_paid"),interestPaid:numeric("interest_paid"),feesPaid:numeric("fees_paid"),
},t=>[index("finance_bookings_workspace").on(t.workspaceId),index("finance_refunds_purchase").on(t.workspaceId,t.refundOf).where(sql`${t.refundOf} IS NOT NULL`)]);
