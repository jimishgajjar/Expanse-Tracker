import { QueryClient } from "@tanstack/react-query";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 30_000, retry: 1, refetchOnWindowFocus: false },
  },
});

// Query keys — one per entity so mutations can invalidate precisely.
export const qk = {
  bootstrap: (range = "month", date = "") => ["bootstrap", range, date] as const,
  transactions: (range = "month", date = "") => ["transactions", range, date] as const,
  tags: () => ["tags"] as const,
  recurring: () => ["recurring"] as const,
  goals: () => ["goals"] as const,
  split: () => ["split"] as const,
  members: () => ["members"] as const,
  budgets: () => ["budgets"] as const,
  netWorth: () => ["net-worth"] as const,
};
