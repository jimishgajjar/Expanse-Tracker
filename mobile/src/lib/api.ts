import Constants from "expo-constants";

// Talks to the same backend as the website. Override in app.json →
// expo.extra.apiBase for local dev (e.g. http://192.168.x.x:3000/api/mobile).
const API_BASE: string =
  (Constants.expoConfig?.extra as { apiBase?: string } | undefined)?.apiBase ??
  "https://expensetracker.jimishgajjar.com/api/mobile";

let authToken: string | null = null;
export function setAuthToken(t: string | null) {
  authToken = t;
}
export function apiBase() {
  return API_BASE;
}

export async function api<T = unknown>(
  path: string,
  opts: { method?: string; body?: unknown } = {},
): Promise<T> {
  const res = await fetch(API_BASE + path, {
    method: opts.method ?? "GET",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
    },
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
  });
  const text = await res.text();
  let json: unknown = {};
  try {
    json = text ? JSON.parse(text) : {};
  } catch {
    /* non-JSON response */
  }
  if (!res.ok) {
    const msg = (json as { error?: string })?.error || `Request failed (${res.status})`;
    throw new Error(msg);
  }
  return json as T;
}
