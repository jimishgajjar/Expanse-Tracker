// Notion database IDs + property names for the money-tracker template.
//
// Database IDs are NOT secrets — only the integration TOKEN (kept in .env) is.
// Every ID below can be overridden by an environment variable of the same
// SCREAMING_SNAKE name (e.g. DB_EXPENSES=...) without editing this file, which
// is handy if your databases differ from the bundled template.

const env = (key, fallback) => process.env[key] || fallback;

export const DB = {
  expenses:          env("DB_EXPENSES",           "3286ea3a233681b78b1ee36132602541"),
  incomes:           env("DB_INCOMES",            "3286ea3a2336818b9380c7b71936f20d"),
  accounts:          env("DB_ACCOUNTS",           "3286ea3a233681338601d28cec426eb5"),
  expenseCategories: env("DB_EXPENSE_CATEGORIES", "3286ea3a233681d698a0df37e6664725"),
  incomeCategories:  env("DB_INCOME_CATEGORIES",  "3286ea3a2336810493e6f06ab5b449d4"),
};

// Property names exactly as they appear in the Notion template.
export const PROP = {
  expense: { title: "Transaction", amount: "Amount", date: "Date", category: "Category", account: "Payment Method" },
  income:  { title: "Transaction", amount: "Amount", date: "Date", category: "Source",   account: "Accounts" },
  accountTitle: "Name",
  expenseCatTitle: "Catigories", // (the template really does spell it this way)
  incomeCatTitle: "Name",
};

// Stable colour palette assigned to categories in order, so a category keeps
// the same colour across charts and legends.
export const PALETTE = [
  "#60a5fa", "#f472b6", "#34d399", "#fbbf24", "#a78bfa", "#fb7185",
  "#22d3ee", "#facc15", "#4ade80", "#f97316", "#818cf8", "#2dd4bf",
  "#e879f9", "#94a3b8",
];
