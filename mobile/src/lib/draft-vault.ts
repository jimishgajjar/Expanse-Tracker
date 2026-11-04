import type { DeviceEntry, DeviceScope } from "../../../src/lib/mobile-contract";
export type DraftBody = DeviceEntry;
export type Draft = { id: string; revision: number; pending: boolean; body: DraftBody; conflict?: "different" | "deleted" };
export type DraftScope = DeviceScope;
export interface VaultStorage {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  deleteItem(key: string): Promise<void>;
}

// The manifest is the commit point. A process killed mid-write sees the previous
// snapshot. Each piece fits Apple's small Keychain value limit even with emoji.
export function draftVault(store: VaultStorage) {
  let tail = Promise.resolve();
  function serial<T>(action: () => Promise<T>) {
    const result = tail.then(action);
    tail = result.then(() => {}, () => {});
    return result;
  }
  async function read(key: string) {
    const header = await store.getItem(key);
    if (header === null) return { bank: 1, count: 0, rows: [] as Draft[] };
    const { bank, count } = JSON.parse(header);
    if (![0, 1].includes(bank) || !Number.isInteger(count) || count < 1 || count > 512)
      throw Error("Device draft storage could not be read.");
    const parts = await Promise.all(Array.from({ length: count }, (_, i) => store.getItem(key + "." + bank + "." + i)));
    if (parts.includes(null)) throw Error("A saved draft is unavailable. Retry before making changes.");
    const rows: Draft[] = JSON.parse(parts.join(""));
    return { bank: Number(bank), count: Number(count), rows };
  }
  function change<T>(key: string, guard: () => void, update: (rows: Draft[]) => T) {
    return serial(async () => {
      guard();
      const { bank, count, rows } = await read(key);
      const result = update(rows);
      const parts = JSON.stringify(rows).match(/[\s\S]{1,400}/gu)!;
      if (parts.length > 512) throw Error("Your device draft storage is full.");
      const next = 1 - bank;
      for (let i = 0; i < parts.length; i++) await store.setItem(key + "." + next + "." + i, parts[i]);
      guard();
      await store.setItem(key, JSON.stringify({ bank: next, count: parts.length }));
      await Promise.allSettled(Array.from({ length: count }, (_, i) => store.deleteItem(key + "." + bank + "." + i)));
      return result;
    });
  }
  function find(rows: Draft[], id: string, revision: number) {
    const item = rows.find(row => row.id === id);
    if (!item || item.revision !== revision) throw Error("This draft changed. Reopen the latest copy.");
    return item;
  }
  return {
    list: (key: string, guard: () => void) => serial(async () => {
      guard(); const { rows } = await read(key); guard(); return rows;
    }),
    save: (key: string, guard: () => void, id: string, revision: number, body: DraftBody) =>
      change(key, guard, rows => {
        if (!revision && !rows.some(row => row.id === id)) {
          if (rows.length >= 20) throw Error("Review your 20 saved drafts before adding another.");
          const item = { id, revision: 1, pending: false, body };
          rows.push(item); return item;
        }
        const item = find(rows, id, revision);
        if (item.pending || item.conflict) throw Error("Retry the original save to check its receipt before editing.");
        item.body = body; item.revision++; return item;
      }),
    mark: (key: string, guard: () => void, draft: Draft, pending: boolean) =>
      change(key, guard, rows => {
        const item = find(rows, draft.id, draft.revision);
        if (item.conflict) throw Error("Review the existing receipt before continuing.");
        if (item.pending !== pending) { item.pending = pending; item.revision++; }
        return item;
      }),
    conflict: (key: string, guard: () => void, draft: Draft, reason: "different" | "deleted") =>
      change(key,guard,rows=>{
        const item=find(rows,draft.id,draft.revision);
        item.conflict=reason;item.pending=false;item.revision++;
      }),
    remove: (key: string, guard: () => void, draft: Draft, confirmed = false) =>
      change(key, guard, rows => {
        const item = find(rows, draft.id, draft.revision);
        if (item.pending && !confirmed) throw Error("Check the original save before removing this draft.");
        rows.splice(rows.indexOf(item), 1);
      }),
  };
}
