import { describe, expect, it } from "vitest";
import { parseBudgetInput } from "../budget-input";
import { presetDates } from "../date-presets";

describe("budget input safety", () => {
  it.each(["0", "-1", "abc", "NaN", "Infinity", "1e", "1e999"])(
    "rejects %s without requesting removal",
    (value) => {
      expect(parseBudgetInput(value).ok).toBe(false);
    },
  );
  it("removes a limit only when the field is explicitly cleared", () => {
    expect(parseBudgetInput(" ")).toEqual({ ok: true, amount: null });
    expect(parseBudgetInput("12.50")).toEqual({ ok: true, amount: 12.5 });
  });
});

describe("inclusive local calendar date presets", () => {
  it("keeps today and seven-day ranges inclusive across a year boundary", () => {
    expect(presetDates("today", "2026-01-03")).toEqual({
      from: "2026-01-03",
      to: "2026-01-03",
    });
    expect(presetDates("last7", "2026-01-03")).toEqual({
      from: "2025-12-28",
      to: "2026-01-03",
    });
  });
  it("handles leap months and previous year months", () => {
    expect(presetDates("month", "2024-02-15")).toEqual({
      from: "2024-02-01",
      to: "2024-02-29",
    });
    expect(presetDates("lastMonth", "2024-03-31")).toEqual({
      from: "2024-02-01",
      to: "2024-02-29",
    });
    expect(presetDates("lastMonth", "2026-01-31")).toEqual({
      from: "2025-12-01",
      to: "2025-12-31",
    });
  });
});
