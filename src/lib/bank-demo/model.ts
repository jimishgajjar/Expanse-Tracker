import { z } from "zod";

export const banks = ["rbc", "td"] as const;
export type Bank = (typeof banks)[number];
export type Review = "review" | "handled" | "ignored" | "changed";
export type FeedRow = {
  id: string;
  bank: Bank;
  description: string;
  date: string;
  cents: number;
  currency: string;
  category: string;
  kind: "payment" | "transfer" | "refund";
  status: "posted" | "pending" | "removed";
  revision: number;
  review: Review;
  pendingId?: string;
  targetId?: string;
};
export type LedgerRow = {
  id: string;
  account: string;
  date: string;
  description: string;
  cents: number;
  category: string;
  source: "manual" | "scheduled" | "bank";
};
export type Connection = {
  status: "disconnected" | "connected" | "reconnect";
  account: string;
  cutoff: string;
  stage: number;
  lastSync: string | null;
};
export type DemoState = {
  version: number;
  connections: Record<Bank, Connection>;
  feed: FeedRow[];
  ledger: LedgerRow[];
  transfers: {
    id: string;
    from: string;
    to: string;
    cents: number;
    date: string;
  }[];
  events: { id: string; at: string; message: string }[];
};

export const demoAccounts = [
  { id: "chequing", name: "Everyday chequing", openingCents: 150000 },
  { id: "savings", name: "Rainy-day savings", openingCents: 400000 },
] as const;
export const categories = [
  "Groceries",
  "Dining",
  "Salary",
  "Bills",
  "Shopping",
  "Other",
];
export const bankNames: Record<Bank, string> = { rbc: "RBC", td: "TD" };
const bankSchema = z.enum(banks);
const id = z.string().min(1).max(100);
const date = z.iso.date();
export const commandSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("connect"),
    bank: bankSchema,
    account: z.enum(["chequing", "savings"]),
    cutoff: date,
    confirmCad: z.literal(true),
  }),
  z.object({ type: z.literal("sync"), bank: bankSchema }),
  z.object({ type: z.literal("advance"), bank: bankSchema }),
  z.object({ type: z.literal("disconnect"), bank: bankSchema }),
  z.object({ type: z.literal("expire"), bank: bankSchema }),
  z.object({ type: z.literal("reconnect"), bank: bankSchema }),
  z.object({
    type: z.literal("approve"),
    id,
    category: z.enum(categories as [string, ...string[]]),
    distinct: z.boolean().default(false),
  }),
  z.object({ type: z.literal("match"), id, targetId: id }),
  z.object({ type: z.literal("transfer"), id, otherId: id }),
  z.object({ type: z.literal("ignore"), id }),
  z.object({ type: z.literal("restore"), id }),
  z.object({ type: z.literal("keep-ledger"), id }),
  z.object({ type: z.literal("batch"), ids: z.array(id).min(1).max(25) }),
  z.object({ type: z.literal("reset") }),
]);
export type Command = z.infer<typeof commandSchema>;
export class DemoError extends Error {}

export function initialState(): DemoState {
  const connection = (): Connection => ({
    status: "disconnected",
    account: "",
    cutoff: "2026-10-13",
    stage: 0,
    lastSync: null,
  });
  return {
    version: 0,
    connections: { rbc: connection(), td: connection() },
    feed: [],
    transfers: [],
    events: [],
    ledger: [
      {
        id: "manual-coffee",
        account: "chequing",
        date: "2026-10-13",
        description: "Coffee (already entered)",
        cents: 650,
        category: "Dining",
        source: "manual",
      },
      {
        id: "scheduled-hydro",
        account: "savings",
        date: "2026-10-13",
        description: "Hydro (scheduled bill)",
        cents: 7500,
        category: "Bills",
        source: "scheduled",
      },
    ],
  };
}

// Provider-sign convention: positive is money out, negative is money in.
// All fixtures are invented; these are not Plaid responses or coverage evidence.
export function sampleFeed(bank: Bank, stage: number): FeedRow[] {
  const row = (
    id: string,
    description: string,
    cents: number,
    category: string,
    extra: Partial<FeedRow> = {},
  ): FeedRow => ({
    id,
    bank,
    description,
    cents,
    category,
    currency: "CAD",
    date: "2026-10-13",
    kind: "payment",
    status: "posted",
    revision: 1,
    review: "review",
    ...extra,
  });
  if (bank === "td")
    return [
      row("td-transfer", "Transfer from chequing", -30000, "Other", {
        kind: "transfer",
      }),
      row("td-hydro", "City hydro", 7500, "Bills"),
    ];
  return [
    row(
      "rbc-pay",
      "Sample employer payroll",
      -220000,
      "Salary",
      stage > 1 ? { status: "removed", revision: 2 } : {},
    ),
    row("rbc-coffee", "Neighbourhood coffee", 650, "Dining"),
    row(
      "rbc-grocery",
      "Weekend groceries",
      stage > 1 ? 9042 : 8642,
      "Groceries",
      { revision: stage > 1 ? 2 : 1 },
    ),
    row(
      stage > 0 ? "rbc-posted" : "rbc-pending",
      "Corner shop",
      2430,
      "Shopping",
      stage > 0 ? { pendingId: "rbc-pending" } : { status: "pending" },
    ),
    row("rbc-transfer", "Transfer to savings", 30000, "Other", {
      kind: "transfer",
    }),
    row("rbc-usd", "Foreign-currency purchase", 1400, "Shopping", {
      currency: "USD",
    }),
    row("rbc-refund", "Retailer refund", -1999, "Shopping", { kind: "refund" }),
    row("rbc-old", "Older grocery purchase", 4321, "Groceries", {
      date: "2026-10-01",
    }),
  ];
}

export function candidates(state: DemoState, row: FeedRow): LedgerRow[] {
  const account = state.connections[row.bank].account;
  if (
    row.currency !== "CAD" ||
    row.kind !== "payment" ||
    row.status !== "posted"
  )
    return [];
  return state.ledger.filter(
    (l) =>
      l.account === account &&
      l.cents === row.cents &&
      Math.abs(Date.parse(l.date) - Date.parse(row.date)) <= 3 * 86400000 &&
      !state.feed.some((f) => f.targetId === l.id),
  );
}

export function blockedReason(state: DemoState, row: FeedRow): string | null {
  if (row.review !== "review") return "This entry has already been reviewed.";
  if (state.connections[row.bank].status !== "connected")
    return "Reconnect this demo bank to review entries.";
  if (!state.connections[row.bank].account) return "Map an account first.";
  if (row.status !== "posted")
    return row.status === "pending"
      ? "Pending payments cannot be imported."
      : "The bank removed this entry.";
  if (row.currency !== "CAD")
    return "Foreign-currency accounting is not supported in this demo.";
  if (row.date < state.connections[row.bank].cutoff)
    return "Before your import start date. Kept out of your ledger.";
  if (row.kind === "refund")
    return "Refund needs a link to its original expense. Leave it for manual review.";
  return null;
}

export function transferCandidates(state: DemoState, row: FeedRow): FeedRow[] {
  if (row.kind !== "transfer" || blockedReason(state, row)) return [];
  return state.feed.filter(
    (other) =>
      other.id !== row.id &&
      other.kind === "transfer" &&
      !blockedReason(state, other) &&
      other.cents === -row.cents &&
      state.connections[other.bank].account !==
        state.connections[row.bank].account &&
      Math.abs(Date.parse(other.date) - Date.parse(row.date)) <= 3 * 86400000,
  );
}

export function ledgerBalance(state: DemoState, account: string): number {
  const opening = demoAccounts.find((a) => a.id === account)?.openingCents ?? 0;
  return (
    opening -
    state.ledger
      .filter((l) => l.account === account)
      .reduce((sum, l) => sum + l.cents, 0) +
    state.transfers.reduce(
      (sum, t) =>
        sum +
        (t.to === account ? t.cents : 0) -
        (t.from === account ? t.cents : 0),
      0,
    )
  );
}

/** Pure, atomic transition: a rejected command never mutates the caller's state. */
export function applyCommand(
  input: DemoState,
  command: Command,
  now: string,
): DemoState {
  const state = structuredClone(input);
  const log = (message: string) =>
    state.events.unshift({
      id: `${input.version + 1}:${state.events.length}`,
      at: now,
      message,
    });
  const get = (id: string) => {
    const row = state.feed.find((f) => f.id === id);
    if (!row) throw new DemoError("Entry not found. Refresh the demo.");
    return row;
  };
  const reviewable = (row: FeedRow) => {
    const reason = blockedReason(state, row);
    if (reason) throw new DemoError(reason);
  };
  const approve = (row: FeedRow, category: string, distinct: boolean) => {
    reviewable(row);
    if (row.kind !== "payment")
      throw new DemoError("Review this as a transfer, not income or spending.");
    if (candidates(state, row).length && !distinct)
      throw new DemoError(
        "Possible duplicate: match the existing entry or explicitly confirm a separate payment.",
      );
    const targetId = `import:${row.id}`;
    if (state.ledger.some((l) => l.id === targetId))
      throw new DemoError("This payment is already in the demo ledger.");
    state.ledger.push({
      id: targetId,
      account: state.connections[row.bank].account,
      date: row.date,
      description: row.description,
      cents: row.cents,
      category,
      source: "bank",
    });
    row.targetId = targetId;
    row.review = "handled";
    log(
      `Imported ${row.description}${distinct ? " — confirmed separate from the suggested match" : ""}.`,
    );
  };
  switch (command.type) {
    case "reset":
      return { ...initialState(), version: input.version + 1 };
    case "connect": {
      const connection = state.connections[command.bank];
      if (connection.status !== "disconnected")
        throw new DemoError("This demo bank is already connected.");
      if (
        banks.some(
          (b) =>
            b !== command.bank &&
            state.connections[b].account === command.account,
        )
      )
        throw new DemoError(
          "That demo ledger account is already mapped to another bank.",
        );
      if (
        state.feed.some((f) => f.bank === command.bank && f.targetId) &&
        (connection.account !== command.account ||
          connection.cutoff !== command.cutoff)
      )
        throw new DemoError(
          "Keep the original mapping and start date after importing or matching entries.",
        );
      Object.assign(connection, {
        status: "connected",
        account: command.account,
        cutoff: command.cutoff,
      });
      log(
        `Connected ${bankNames[command.bank]} sample account. No real bank was contacted.`,
      );
      break;
    }
    case "sync":
    case "advance": {
      const connection = state.connections[command.bank];
      if (connection.status !== "connected")
        throw new DemoError("Connect or reconnect this demo bank first.");
      if (command.type === "advance")
        connection.stage = Math.min(connection.stage + 1, 2);
      const rows = sampleFeed(command.bank, connection.stage);
      for (const incoming of rows) {
        if (incoming.pendingId) {
          const pending = state.feed.find((f) => f.id === incoming.pendingId);
          if (pending) {
            if (pending.review === "ignored" && pending.status !== "removed")
              incoming.review = "ignored";
            pending.status = "removed";
            pending.review = "ignored";
          }
        }
        const existing = state.feed.find((f) => f.id === incoming.id);
        if (!existing) state.feed.push(incoming);
        else if (incoming.revision > existing.revision) {
          const review = existing.targetId ? "changed" : existing.review;
          Object.assign(existing, incoming, {
            review,
            targetId: existing.targetId,
          });
        }
      }
      connection.lastSync = now;
      log(
        `${bankNames[command.bank]} sample feed checked${command.type === "advance" ? `: scenario ${connection.stage}` : ""}. Ledger unchanged.`,
      );
      break;
    }
    case "expire":
    case "reconnect":
    case "disconnect": {
      const connection = state.connections[command.bank];
      if (command.type === "reconnect" && connection.status !== "reconnect")
        throw new DemoError("This connection does not need reconnection.");
      if (command.type === "expire" && connection.status !== "connected")
        throw new DemoError("Connect the demo bank first.");
      connection.status =
        command.type === "expire"
          ? "reconnect"
          : command.type === "disconnect"
            ? "disconnected"
            : "connected";
      log(
        `${bankNames[command.bank]} demo connection ${connection.status}. Ledger retained.`,
      );
      break;
    }
    case "approve":
      approve(get(command.id), command.category, command.distinct);
      break;
    case "batch": {
      if (new Set(command.ids).size !== command.ids.length)
        throw new DemoError("Select each entry only once.");
      for (const id of command.ids) {
        const row = get(id);
        approve(row, row.category, false);
      }
      break;
    }
    case "match": {
      const row = get(command.id);
      reviewable(row);
      if (!candidates(state, row).some((l) => l.id === command.targetId))
        throw new DemoError("That existing entry is no longer a valid match.");
      row.targetId = command.targetId;
      row.review = "handled";
      log(
        `Matched ${row.description} to an existing entry. No new transaction.`,
      );
      break;
    }
    case "transfer": {
      const row = get(command.id);
      reviewable(row);
      const other = transferCandidates(state, row).find(
        (f) => f.id === command.otherId,
      );
      if (!other)
        throw new DemoError(
          "Choose the matching opposite side of this transfer.",
        );
      const outgoing = row.cents > 0 ? row : other;
      const incoming = row.cents < 0 ? row : other;
      const targetId = `transfer:${outgoing.id}:${incoming.id}`;
      state.transfers.push({
        id: targetId,
        from: state.connections[outgoing.bank].account,
        to: state.connections[incoming.bank].account,
        cents: outgoing.cents,
        date: outgoing.date,
      });
      row.targetId = other.targetId = targetId;
      row.review = other.review = "handled";
      log(
        "Linked both bank entries to one demo transfer. Income and spending unchanged.",
      );
      break;
    }
    case "ignore": {
      const row = get(command.id);
      if (row.targetId)
        throw new DemoError(
          "An imported entry must go through correction review.",
        );
      row.review = "ignored";
      log(`Ignored ${row.description}.`);
      break;
    }
    case "restore": {
      const row = get(command.id);
      if (row.review !== "ignored" || row.status === "removed")
        throw new DemoError("This entry cannot be restored for review.");
      row.review = "review";
      log(`Returned ${row.description} to review.`);
      break;
    }
    case "keep-ledger": {
      const row = get(command.id);
      if (row.review !== "changed" || !row.targetId)
        throw new DemoError("No bank correction to review.");
      row.review = "handled";
      log(
        `Reviewed bank correction for ${row.description}; explicitly kept the existing ledger entry.`,
      );
      break;
    }
  }
  state.version = input.version + 1;
  state.events = state.events.slice(0, 100);
  return state;
}
