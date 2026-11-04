/** Only household notification destinations may open the configured web app.
 * Rebuild the path instead of trusting a URL supplied by a push provider. */
export function householdNotificationLink(path:unknown, api:string):string|null {
  if (typeof path !== "string" || (path!=="/" && !path.startsWith("/?"))) return null;
  try {
    const base = new URL(api);
    if (base.protocol !== "https:" || base.username || base.password) return null;
    const input = new URL(path,base);
    if (input.origin !== base.origin || input.pathname !== "/" || input.hash) return null;
    const tab = input.searchParams.get("tab");
    if (path==="/") return base.origin + "/";
    if (tab==="analytics") {
      const date=input.searchParams.get("date");
      if(input.searchParams.get("range")==="month" && date && /^\d{4}-\d{2}-01$/.test(date) && Number.isFinite(Date.parse(date)))
        return base.origin + "/?tab=analytics&range=month&date="+date;
      return base.origin + "/?tab=analytics";
    }
    if (tab==="planning") return base.origin + "/?tab=planning";
    if (tab==="transactions" && !input.searchParams.has("thread") && !input.searchParams.has("household"))
      return base.origin + "/?tab=transactions";
    if (tab === "settings") return base.origin + "/?tab=settings";
    const thread = input.searchParams.get("thread"), household = input.searchParams.get("household");
    if (tab !== "transactions" || !thread || !household || thread.length > 128 || household.length > 128) return null;
    return base.origin + "/?" + new URLSearchParams({tab,thread,household});
  } catch { return null; }
}
