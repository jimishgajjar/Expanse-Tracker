import { describe, expect, it } from "vitest";
import { canNavigate, getRange, shiftAnchor } from "@/lib/dates";
import { makeFormatters } from "@/lib/format";
import { bucketize } from "@/lib/buckets";

describe("date ranges", () => {
  it("month range is [1st, next 1st)", () => {
    const r = getRange("month", "2026-06-15");
    expect(r.start).toBe("2026-06-01");
    expect(r.end).toBe("2026-07-01");
  });

  it("year range spans the calendar year", () => {
    const r = getRange("year", "2026-06-15");
    expect(r.start).toBe("2026-01-01");
    expect(r.end).toBe("2027-01-01");
  });

  it("all-time range covers everything", () => {
    const r = getRange("all", "2026-06-15");
    expect(r.start < "2000-01-01").toBe(true);
    expect(r.end > "2100-01-01").toBe(true);
  });

  it("shiftAnchor moves a month forward and back", () => {
    expect(shiftAnchor("month", "2026-06-15", 1)).toBe("2026-07-15");
    expect(shiftAnchor("month", "2026-06-15", -1)).toBe("2026-05-15");
  });

  it("only 'all' cannot navigate", () => {
    expect(canNavigate("all")).toBe(false);
    expect(canNavigate("month")).toBe(true);
  });
});

describe("money formatting", () => {
  const { money, signedMoney, balanceMoney } = makeFormatters("$", "en-US");

  it("rounds whole amounts", () => expect(money(1234.56)).toBe("$1,235"));
  it("keeps decimals when asked", () => expect(money(1234.5, { decimals: true })).toBe("$1,234.5"));
  it("signs transactions", () => {
    expect(signedMoney(100)).toBe("+$100");
    expect(signedMoney(-100)).toBe("−$100");
  });
  it("shows a minus only for negative balances", () => {
    expect(balanceMoney(-50)).toBe("−$50");
    expect(balanceMoney(50)).toBe("$50");
  });
});

describe("trend buckets", () => {
  it("buckets a month by day and sums income/expense", () => {
    const txns = [
      { type: "expense" as const, amount: 100, date: "2026-06-05" },
      { type: "income" as const, amount: 200, date: "2026-06-05" },
      { type: "expense" as const, amount: 50, date: "2026-06-10" },
    ];
    const buckets = bucketize(txns, "month", "2026-06-01", "2026-07-01");
    expect(buckets.length).toBe(30); // June
    const d5 = buckets.find((b) => b.label === "5 Jun");
    expect(d5?.expense).toBe(100);
    expect(d5?.income).toBe(200);
    expect(buckets.find((b) => b.label === "10 Jun")?.expense).toBe(50);
  });
});
