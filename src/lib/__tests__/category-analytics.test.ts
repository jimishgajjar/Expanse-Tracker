import { describe, expect, it } from "vitest";
import { getColorCombo, COLOR_HARMONIES } from "../colors";
import { ICON_NAMES, ICON_SEARCH_TAGS, ICON_CATEGORY_GROUPS } from "@/components/icon";

describe("Category Styling & Icon System", () => {
  it("provides comprehensive icon catalogue and search mapping", () => {
    expect(ICON_NAMES.length).toBeGreaterThanOrEqual(240);
    expect(Object.keys(ICON_CATEGORY_GROUPS).length).toBe(10);
    expect(ICON_SEARCH_TAGS.coffee).toContain("cafe");
    expect(ICON_SEARCH_TAGS.plane).toContain("flight");
    expect(ICON_SEARCH_TAGS.dumbbell).toContain("gym");
  });

  it("calculates contrast-safe color combinations and harmonies", () => {
    expect(COLOR_HARMONIES.length).toBe(5);
    const combo = getColorCombo("#10b981");
    expect(combo.background).toBe("#10b98118");
    expect(combo.border).toBe("#10b98135");
    expect(combo.text).toBe("#10b981");
    expect(combo.glow).toContain("#10b98125");
  });
});
