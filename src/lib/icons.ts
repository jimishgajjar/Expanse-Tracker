// Curated set of lucide icon names (kebab-case) offered in the icon picker for
// accounts and categories. Rendered via the <Icon> component (lucide DynamicIcon),
// so adding a name here is all that's needed — no imports to wire up.
export const ICON_NAMES = [
  // money / accounts
  "wallet", "banknote", "landmark", "credit-card", "piggy-bank", "coins", "hand-coins", "vault",
  // food
  "utensils", "coffee", "pizza", "shopping-basket", "beer", "wine", "apple",
  // home / bills
  "house", "receipt", "plug", "lightbulb", "droplet", "flame", "wifi", "zap",
  // transport
  "car", "bus", "fuel", "plane", "train-front", "bike",
  // shopping / lifestyle
  "shopping-bag", "shopping-cart", "shirt", "gift", "scissors", "smartphone",
  // health / fitness
  "heart-pulse", "stethoscope", "pill", "dumbbell", "activity",
  // fun / education
  "clapperboard", "film", "music", "gamepad-2", "graduation-cap", "book", "tv",
  // work / income
  "briefcase", "laptop", "trending-up", "badge-dollar-sign", "building-2",
  // misc
  "tag", "star", "heart", "dog", "baby", "wrench", "phone",
] as const;

export type IconChoice = (typeof ICON_NAMES)[number];

export const DEFAULT_ACCOUNT_ICON = "wallet";
export const DEFAULT_CATEGORY_ICON = "tag";

// Icon shown for transactions whose category was deleted.
export const UNCATEGORIZED_ICON = "circle-help";
