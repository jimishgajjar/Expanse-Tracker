/** Keep notification return paths on the local Activity page, even after signing in or switching trackers. */
export function commentLink(thread: unknown, household: unknown): string | null {
  if (typeof thread !== "string" || !thread || thread.length > 128 ||
      typeof household !== "string" || !household || household.length > 128) return null;
  return "/?" + new URLSearchParams({tab:"transactions", thread, household});
}
