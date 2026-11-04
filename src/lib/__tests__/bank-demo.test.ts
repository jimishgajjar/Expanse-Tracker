import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import {
  applyCommand,
  candidates,
  commandSchema,
  initialState,
  ledgerBalance,
  type Command,
  type DemoState,
} from "../bank-demo/model";
import { bankDemoEnabled } from "../bank-demo/config";
import { DemoStore } from "../bank-demo/store";

const now = "2026-10-13T12:00:00.000Z";
const step = (state: DemoState, command: Command) =>
  applyCommand(state, command, now);
function connected() {
  let state = initialState();
  state = step(state, {
    type: "connect",
    bank: "rbc",
    account: "chequing",
    cutoff: "2026-10-13",
    confirmCad: true,
  });
  state = step(state, {
    type: "connect",
    bank: "td",
    account: "savings",
    cutoff: "2026-10-13",
    confirmCad: true,
  });
  state = step(state, { type: "sync", bank: "rbc" });
  return step(state, { type: "sync", bank: "td" });
}
const approve = (id: string, distinct = false): Command => ({
  type: "approve",
  id,
  category: "Other",
  distinct,
});

describe("bank demo safety and reconciliation", () => {
  it("fails closed in production, Vercel and any remote database environment", () => {
    const valid = {
      NODE_ENV: "development",
      BANK_SYNC_MODE: "demo",
      BANK_TOOLS_ENABLED: "1",
      PGLITE_PATH: ".pglite-preview",
    } as NodeJS.ProcessEnv;
    expect(bankDemoEnabled(valid)).toBe(true);
    for (const patch of [
      { NODE_ENV: "production" },
      { VERCEL: "1" },
      { DATABASE_URL: "postgresql://example" },
      { BANK_SYNC_MODE: "live" },
      { BANK_TOOLS_ENABLED: undefined },
      { PGLITE_PATH: "" },
    ])
      expect(bankDemoEnabled({ ...valid, ...patch } as NodeJS.ProcessEnv)).toBe(
        false,
      );
    expect(bankDemoEnabled({} as NodeJS.ProcessEnv)).toBe(false);
  });
  it("validates commands and never accepts arbitrary account IDs or unconfirmed setup", () => {
    expect(
      commandSchema.safeParse({
        type: "connect",
        bank: "rbc",
        account: "live-account",
        cutoff: "2026-10-13",
        confirmCad: true,
      }).success,
    ).toBe(false);
    expect(
      commandSchema.safeParse({
        type: "connect",
        bank: "rbc",
        account: "chequing",
        cutoff: "2026-10-13",
        confirmCad: false,
      }).success,
    ).toBe(false);
    expect(
      commandSchema.safeParse({
        type: "connect",
        bank: "rbc",
        account: "chequing",
        cutoff: "2026-99-99",
        confirmCad: true,
      }).success,
    ).toBe(false);
  });
  it("repeated sync changes no ledger entries, balances or feed identities", () => {
    const first = connected();
    const again = step(step(first, { type: "sync", bank: "rbc" }), {
      type: "sync",
      bank: "td",
    });
    expect(again.feed).toEqual(first.feed);
    expect(again.ledger).toEqual(initialState().ledger);
    expect(ledgerBalance(again, "chequing")).toBe(149350);
  });
  it("imports a reviewed payment exactly once with cent precision and selected category", () => {
    const first = connected();
    const next = step(first, {
      type: "approve",
      id: "rbc-grocery",
      category: "Groceries",
      distinct: false,
    });
    expect(next.ledger).toHaveLength(3);
    expect(ledgerBalance(next, "chequing")).toBe(140708);
    expect(next.ledger.at(-1)?.category).toBe("Groceries");
    expect(() => step(next, approve("rbc-grocery"))).toThrow(
      /already been reviewed/,
    );
    expect(first.ledger).toHaveLength(2);
  });
  it("matches existing manual and scheduled entries without inserting a duplicate", () => {
    let state = connected();
    expect(() => step(state, approve("rbc-coffee"))).toThrow(
      /Possible duplicate/,
    );
    state = step(state, {
      type: "match",
      id: "rbc-coffee",
      targetId: "manual-coffee",
    });
    state = step(state, {
      type: "match",
      id: "td-hydro",
      targetId: "scheduled-hydro",
    });
    expect(state.ledger).toEqual(initialState().ledger);
    expect(state.feed.filter((row) => row.review === "handled")).toHaveLength(
      2,
    );
    expect(() =>
      step(connected(), {
        type: "match",
        id: "rbc-coffee",
        targetId: "scheduled-hydro",
      }),
    ).toThrow(/valid match/);
  });
  it("allows a deliberate distinct payment despite duplicate suggestion", () => {
    const state = step(connected(), approve("rbc-coffee", true));
    expect(state.ledger).toHaveLength(3);
    expect(state.events[0].message).toContain("confirmed separate");
  });
  it("excludes amount/sign/account/date mismatches from suggested matches", () => {
    const state = connected();
    const coffee = state.feed.find((row) => row.id === "rbc-coffee")!;
    expect(candidates(state, coffee)).toHaveLength(1);
    expect(candidates(state, { ...coffee, cents: -650 })).toHaveLength(0);
    expect(candidates(state, { ...coffee, bank: "td" })).toHaveLength(0);
    expect(candidates(state, { ...coffee, date: "2026-10-17" })).toHaveLength(
      0,
    );
  });
  it.each(["rbc-pending", "rbc-usd", "rbc-old", "rbc-refund", "rbc-transfer"])(
    "blocks inappropriate ordinary import: %s",
    (id) => {
      const state = connected();
      expect(() => step(state, approve(id))).toThrow();
      expect(state.ledger).toEqual(initialState().ledger);
    },
  );
  it("turns both bank sides into one transfer, with no income or expense", () => {
    const state = step(connected(), {
      type: "transfer",
      id: "rbc-transfer",
      otherId: "td-transfer",
    });
    expect(state.transfers).toHaveLength(1);
    expect(state.ledger).toEqual(initialState().ledger);
    expect(ledgerBalance(state, "chequing")).toBe(119350);
    expect(ledgerBalance(state, "savings")).toBe(422500);
    expect(
      state.feed.filter((row) => row.targetId?.startsWith("transfer:")),
    ).toHaveLength(2);
    expect(() =>
      step(state, {
        type: "transfer",
        id: "rbc-transfer",
        otherId: "td-transfer",
      }),
    ).toThrow();
    expect(() =>
      step(connected(), {
        type: "transfer",
        id: "rbc-transfer",
        otherId: "rbc-coffee",
      }),
    ).toThrow();
  });
  it("handles pending-to-posted replacement without two importable rows", () => {
    const state = step(connected(), { type: "advance", bank: "rbc" });
    expect(state.feed.find((row) => row.id === "rbc-pending")?.status).toBe(
      "removed",
    );
    expect(state.feed.find((row) => row.id === "rbc-posted")?.status).toBe(
      "posted",
    );
    expect(step(state, approve("rbc-posted")).ledger).toHaveLength(3);
    expect(() => step(state, approve("rbc-pending"))).toThrow();
  });
  it("keeps ignored payments ignored when posted or corrected", () => {
    let state = step(connected(), { type: "ignore", id: "rbc-pending" });
    state = step(state, { type: "ignore", id: "rbc-grocery" });
    state = step(state, { type: "advance", bank: "rbc" });
    expect(state.feed.find((row) => row.id === "rbc-posted")?.review).toBe(
      "ignored",
    );
    state = step(state, { type: "advance", bank: "rbc" });
    expect(state.feed.find((row) => row.id === "rbc-grocery")?.review).toBe(
      "ignored",
    );
    state = step(state, { type: "restore", id: "rbc-posted" });
    expect(state.feed.find((row) => row.id === "rbc-posted")?.review).toBe(
      "review",
    );
  });
  it("flags provider corrections/removals without modifying approved ledger or balances", () => {
    let state = step(
      step(connected(), approve("rbc-grocery")),
      approve("rbc-pay"),
    );
    const ledger = structuredClone(state.ledger);
    const balance = ledgerBalance(state, "chequing");
    state = step(step(state, { type: "advance", bank: "rbc" }), {
      type: "advance",
      bank: "rbc",
    });
    expect(
      state.feed
        .filter((row) => row.review === "changed")
        .map((row) => row.id)
        .sort(),
    ).toEqual(["rbc-grocery", "rbc-pay"]);
    expect(state.ledger).toEqual(ledger);
    expect(ledgerBalance(state, "chequing")).toBe(balance);
    expect(() => step(state, { type: "ignore", id: "rbc-pay" })).toThrow(
      /correction/,
    );
    state = step(state, { type: "keep-ledger", id: "rbc-grocery" });
    state = step(state, { type: "sync", bank: "rbc" });
    expect(state.feed.find((row) => row.id === "rbc-grocery")?.review).toBe(
      "handled",
    );
    expect(state.ledger).toEqual(ledger);
  });
  it("applies batch all-or-nothing, including duplicate detection within a batch", () => {
    const state = connected();
    expect(() =>
      step(state, { type: "batch", ids: ["rbc-grocery", "rbc-coffee"] }),
    ).toThrow(/duplicate/);
    expect(state.ledger).toHaveLength(2);
    expect(
      step(state, { type: "batch", ids: ["rbc-grocery", "rbc-pay"] }).ledger,
    ).toHaveLength(4);
    expect(() =>
      step(state, { type: "batch", ids: ["rbc-pay", "rbc-pay"] }),
    ).toThrow(/once/);
  });
  it("preserves imports through reconnect and disconnect and locks used mappings", () => {
    let state = step(connected(), approve("rbc-pay"));
    state = step(state, { type: "expire", bank: "rbc" });
    expect(() => step(state, approve("rbc-grocery"))).toThrow(/Reconnect/);
    expect(() => step(state, { type: "sync", bank: "rbc" })).toThrow(
      /reconnect/,
    );
    state = step(state, { type: "reconnect", bank: "rbc" });
    state = step(state, { type: "disconnect", bank: "rbc" });
    expect(state.ledger).toHaveLength(3);
    expect(() =>
      step(state, {
        type: "connect",
        bank: "rbc",
        account: "chequing",
        cutoff: "2026-10-01",
        confirmCad: true,
      }),
    ).toThrow(/original mapping/);
    state = step(state, {
      type: "connect",
      bank: "rbc",
      account: "chequing",
      cutoff: "2026-10-13",
      confirmCad: true,
    });
    expect(step(state, { type: "sync", bank: "rbc" }).ledger).toHaveLength(3);
  });
});

describe("isolated demo persistence", () => {
  let client: PGlite;
  let store: DemoStore;
  beforeAll(() => {
    client = new PGlite();
    store = new DemoStore(client);
  });
  afterAll(async () => {
    await client.close();
  });
  it("persists only its own table and separates workspaces", async () => {
    await store.read("a");
    const state = await store.change("a", 0, {
      type: "connect",
      bank: "rbc",
      account: "chequing",
      cutoff: "2026-10-13",
      confirmCad: true,
    });
    expect((await store.read("a")).version).toBe(state.version);
    expect((await store.read("b")).connections.rbc.status).toBe("disconnected");
    const tables = await client.query<{ tablename: string }>(
      "SELECT tablename FROM pg_tables WHERE schemaname='public'",
    );
    expect(tables.rows.map((row) => row.tablename)).toEqual(["demo_sessions"]);
  }, 60000);
  it("allows only one concurrent approval at the same revision", async () => {
    await store.read("race");
    await store.change("race", 0, {
      type: "connect",
      bank: "rbc",
      account: "chequing",
      cutoff: "2026-10-13",
      confirmCad: true,
    });
    await store.change("race", 1, { type: "sync", bank: "rbc" });
    const attempts = await Promise.allSettled([
      store.change("race", 2, approve("rbc-pay")),
      store.change("race", 2, approve("rbc-pay")),
    ]);
    expect(
      attempts.filter((result) => result.status === "fulfilled"),
    ).toHaveLength(1);
    expect(
      (await store.read("race")).ledger.filter(
        (row) => row.id === "import:rbc-pay",
      ),
    ).toHaveLength(1);
    await expect(
      store.change("race", 2, approve("rbc-grocery")),
    ).rejects.toThrow(/another tab/);
  });
  it("reset cannot make an old request version valid again", async () => {
    const previous = await store.read("race");
    const reset = await store.change("race", previous.version, {
      type: "reset",
    });
    expect(reset.version).toBe(previous.version + 1);
    expect(reset.ledger).toEqual(initialState().ledger);
    await expect(store.change("race", 0, { type: "reset" })).rejects.toThrow();
  });
});
