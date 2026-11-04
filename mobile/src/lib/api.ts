import Constants from "expo-constants";

// Talks to the same backend as the website. Override in app.json →
// expo.extra.apiBase for local dev (e.g. http://192.168.x.x:3000/api/mobile).
const API_BASE: string =
  process.env.EXPO_PUBLIC_API_BASE ??
  (Constants.expoConfig?.extra as { apiBase?: string } | undefined)?.apiBase ??
  "https://expensetracker.jimishgajjar.com/api/mobile";

let authToken: string | null = null;
let activeView: string | null = null;
let generation = 0;
export function setRequestScope(token: string | null, view: string | null) {
  authToken = token;
  activeView = view;
  generation++;
}

// Called when the server rejects our token (401) so the app can sign out.
let onUnauthorized: (() => void) | null = null;
export function setUnauthorizedHandler(fn: () => void) {
  onUnauthorized = fn;
}
export function apiBase() {
  return API_BASE;
}

type Options = { method?: string; body?: unknown };

// Capture at render time. An old confirm dialog or delayed picker callback
// cannot acquire the credentials of the user's next tracker.
export function bindApi() {
  const expected = generation;
  return <T = unknown>(path: string, opts: Options = {}) => api<T>(path, opts, expected);
}

export class ApiError extends Error {
  constructor(message: string, readonly status: number, readonly code?: string) { super(message); }
}
export class NetworkUnavailable extends Error {}

export async function api<T = unknown>(
  path: string,
  opts: Options = {},
  expected = generation,
): Promise<T> {
  const checkingAccess = path.split("?")[0] === "/me";
  const scoped = !checkingAccess && !path.startsWith("/auth/");
  if (expected !== generation || (scoped && !activeView)) throw Error("Reopen this tracker to continue.");
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), checkingAccess ? 8000 : 25000);
  let res: Response;
  let text: string;
  try {
    res = await fetch(API_BASE + path, {
      cache: "no-store",
      signal: controller?.signal,
      method: opts.method ?? "GET",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
        ...(scoped && activeView ? { "x-tracker-view": activeView } : {}),
      },
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
    });
    text = await res.text();
  } catch {
    throw new NetworkUnavailable("Connection interrupted. Check your connection and retry.");
  } finally {
    clearTimeout(timeout);
  }
  if (expected !== generation) throw Error("The tracker changed during this request.");
  let json: unknown = {};
  try {
    json = text ? JSON.parse(text) : {};
  } catch {
    /* non-JSON response */
  }
  if (res.status === 401 && scoped && authToken) {
    onUnauthorized?.();
  }
  if (!res.ok) {
    const msg = (json as { error?: string })?.error || `Request failed (${res.status})`;
    throw new ApiError(msg, res.status, (json as {code?:string})?.code);
  }
  return json as T;
}
