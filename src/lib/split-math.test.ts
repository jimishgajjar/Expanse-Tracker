import { describe, it, expect } from "vitest";
import { computeBalances } from "./split-math";

describe("computeBalances", () => {
  it("nets what others owe me against what I owe them", () => {
    const me = "jimish", hani = "hani";
    const net = computeBalances(me, [
      { creditorId: me, debtorId: hani, amount: 100 }, // Hani owes me 100
      { creditorId: me, debtorId: hani, amount: 50 },  // Hani owes me 50
      { creditorId: hani, debtorId: me, amount: 30 },  // I owe Hani 30
    ]);
    expect(net.get(hani)).toBe(120); // 150 - 30 → Hani owes me 120
  });

  it("is negative when I owe more than I'm owed", () => {
    const net = computeBalances("a", [{ creditorId: "b", debtorId: "a", amount: 40 }]);
    expect(net.get("b")).toBe(-40);
  });

  it("ignores IOUs that don't involve me", () => {
    const net = computeBalances("me", [{ creditorId: "x", debtorId: "y", amount: 10 }]);
    expect(net.size).toBe(0);
  });

  it("keeps separate balances per member", () => {
    const me = "me";
    const net = computeBalances(me, [
      { creditorId: me, debtorId: "x", amount: 20 },
      { creditorId: "y", debtorId: me, amount: 15 },
    ]);
    expect(net.get("x")).toBe(20);
    expect(net.get("y")).toBe(-15);
  });
});
