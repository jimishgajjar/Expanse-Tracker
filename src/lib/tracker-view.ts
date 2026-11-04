// A view identifier is only used to reject stale requests. Membership is
// always checked separately by the server.
export const VIEW_HEADER = "x-tracker-view";
export const REQUIRED_HEADER = "x-tracker-view-required";
export const SCOPE_CHECK_PATH = "/api/tracker-view";

export function requiresTrackerView(path: string, method: string) {
  if (path.startsWith("/api/mobile/")) {
    return path !== "/api/mobile/me" && !path.startsWith("/api/mobile/auth/");
  }
  if (method === "GET" || method === "HEAD" || method === "OPTIONS") return false;
  if (path.startsWith("/api/cron/")) return false;
  return !["/login", "/signup", "/forgot", "/reset", "/verify"].includes(path);
}
