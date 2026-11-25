/**
 * New transactions captured while the phone has no connection. They wait in this
 * browser's storage, private to the person and tracker that made them, and are sent
 * again with their original request id. The server keeps a receipt per request id,
 * so a retry after a lost response never creates a duplicate entry.
 */
export type OutboxItem = {
  requestId: string;
  queuedAt: string;
  /** The exact createTransaction input, minus the request id. */
  payload: {
    type: "income" | "expense";
    amount: number;
    date: string;
    note: string;
    accountId: string;
    categoryId: string | null;
    tagIds: string[];
    allocations?: unknown[];
  };
  /** Last server refusal, kept so the person can fix or discard it. */
  error?: string;
};

const key = (workspace: string, actor: string) => `offline-outbox:${workspace}:${actor}`;
const listeners = new Set<() => void>();
const snapshots = new Map<string, { raw: string | null; items: OutboxItem[] }>();
const EMPTY: OutboxItem[] = [];

export function readOutbox(workspace: string, actor: string): OutboxItem[] {
  let raw: string | null = null;
  try { raw = localStorage.getItem(key(workspace, actor)); } catch { return EMPTY; }
  const hit = snapshots.get(key(workspace, actor));
  if (hit && hit.raw === raw) return hit.items;
  let items: OutboxItem[] = EMPTY;
  try { const parsed = raw ? JSON.parse(raw) : []; if (Array.isArray(parsed)) items = parsed; } catch { /* Corrupt: treat as empty. */ }
  snapshots.set(key(workspace, actor), { raw, items });
  return items;
}

function write(workspace: string, actor: string, items: OutboxItem[]) {
  try {
    if (items.length) localStorage.setItem(key(workspace, actor), JSON.stringify(items));
    else localStorage.removeItem(key(workspace, actor));
  } catch { /* Storage full or blocked. */ }
  listeners.forEach((fn) => fn());
}

/** Returns false when this browser cannot store it, so the caller can keep the form open. */
export function queueOffline(workspace: string, actor: string, item: Omit<OutboxItem, "queuedAt">): boolean {
  const items = readOutbox(workspace, actor).filter((i) => i.requestId !== item.requestId);
  write(workspace, actor, [...items, { ...item, queuedAt: new Date().toISOString() }]);
  return readOutbox(workspace, actor).some((i) => i.requestId === item.requestId);
}

export function updateOutbox(workspace: string, actor: string, requestId: string, change: Partial<OutboxItem> | null) {
  const items = readOutbox(workspace, actor);
  write(workspace, actor, change === null
    ? items.filter((i) => i.requestId !== requestId)
    : items.map((i) => (i.requestId === requestId ? { ...i, ...change } : i)));
}

export function subscribeOutbox(fn: () => void) {
  listeners.add(fn);
  window.addEventListener("storage", fn);
  return () => { listeners.delete(fn); window.removeEventListener("storage", fn); };
}

/** A failed fetch while the browser reports no connection. */
export function looksOffline() {
  return typeof navigator !== "undefined" && navigator.onLine === false;
}
