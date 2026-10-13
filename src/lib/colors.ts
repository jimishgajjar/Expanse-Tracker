// Curated color harmonies for accounts & categories
export interface ColorHarmony {
  id: string;
  name: string;
  colors: string[];
}

export const COLOR_HARMONIES: ColorHarmony[] = [
  {
    id: "fintech",
    name: "Modern Fintech",
    colors: [
      "#10b981", // Emerald
      "#14b8a6", // Mint
      "#0d9488", // Teal
      "#06b6d4", // Cyan
      "#0ea5e9", // Sky
      "#3b82f6", // Royal Blue
      "#6366f1", // Indigo
      "#8b5cf6", // Violet
      "#a855f7", // Purple
    ],
  },
  {
    id: "warm",
    name: "Warm & Vibrant",
    colors: [
      "#ef4444", // Red
      "#f43f5e", // Rose
      "#ec4899", // Pink
      "#d946ef", // Fuchsia
      "#f97316", // Tangerine
      "#ea580c", // Rust
      "#f59e0b", // Amber
      "#eab308", // Golden
      "#fb7185", // Coral
    ],
  },
  {
    id: "earth",
    name: "Earth & Nature",
    colors: [
      "#059669", // Forest
      "#22c55e", // Grass
      "#84cc16", // Lime
      "#65a30d", // Olive
      "#d97706", // Ochre
      "#b45309", // Bronze
      "#c2410c", // Terracotta
      "#713f12", // Coffee
      "#78716c", // Stone
    ],
  },
  {
    id: "pastel",
    name: "Pastel & Soft",
    colors: [
      "#34d399", // Soft Mint
      "#38bdf8", // Soft Sky
      "#818cf8", // Soft Lavender
      "#c084fc", // Soft Lilac
      "#f472b6", // Soft Pink
      "#fb923c", // Soft Apricot
      "#facc15", // Soft Butter
      "#a3e635", // Soft Sage
      "#67e8f9", // Soft Cyan
    ],
  },
  {
    id: "editorial",
    name: "Sleek & Editorial",
    colors: [
      "#64748b", // Slate
      "#475569", // Steel
      "#52525b", // Zinc
      "#334155", // Charcoal
      "#1e293b", // Obsidian
      "#1e1b4b", // Midnight Indigo
      "#14532d", // Deep Spruce
      "#831843", // Deep Berry
      "#581c87", // Deep Violet
    ],
  },
];

// Flat unique list of all curated palette colors
export const COLORS: string[] = Array.from(
  new Set(COLOR_HARMONIES.flatMap((h) => h.colors)),
);

// Returns modern background, border and text styles for any category/account color
export function getColorCombo(color: string) {
  return {
    background: `${color}18`,
    border: `${color}35`,
    text: color,
    glow: `0 0 16px ${color}25`,
  };
}

// Recommended preset category combinations for rapid styling
export const RECOMMENDED_CATEGORY_PRESETS = [
  { name: "Groceries", icon: "shopping-basket", color: "#10b981", kind: "expense" },
  { name: "Dining & Drinks", icon: "utensils", color: "#f97316", kind: "expense" },
  { name: "Coffee & Cafes", icon: "coffee", color: "#b45309", kind: "expense" },
  { name: "Housing & Rent", icon: "house", color: "#3b82f6", kind: "expense" },
  { name: "Bills & Utilities", icon: "zap", color: "#0ea5e9", kind: "expense" },
  { name: "Transportation", icon: "car", color: "#6366f1", kind: "expense" },
  { name: "Shopping", icon: "shopping-bag", color: "#ec4899", kind: "expense" },
  { name: "Health & Medical", icon: "heart-pulse", color: "#f43f5e", kind: "expense" },
  { name: "Fitness & Gym", icon: "dumbbell", color: "#14b8a6", kind: "expense" },
  { name: "Entertainment", icon: "film", color: "#8b5cf6", kind: "expense" },
  { name: "Travel & Vacations", icon: "plane", color: "#06b6d4", kind: "expense" },
  { name: "Tech & Subscriptions", icon: "laptop", color: "#475569", kind: "expense" },
  { name: "Salary & Wages", icon: "banknote", color: "#059669", kind: "income" },
  { name: "Investments & Dividends", icon: "trending-up", color: "#10b981", kind: "income" },
  { name: "Freelance & Consulting", icon: "briefcase", color: "#3b82f6", kind: "income" },
  { name: "Gifts & Cash Back", icon: "gift", color: "#d946ef", kind: "income" },
] as const;

// Deterministic fallback colour when something has none.
export function colorFor(seed: string): string {
  let h = 7;
  for (const ch of seed) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return COLORS[h % COLORS.length];
}
