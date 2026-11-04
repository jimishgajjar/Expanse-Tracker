import { create } from "zustand";
import { getItem, setItem, deleteItem } from "./storage";
import { api, apiBase, ApiError, NetworkUnavailable, bindApi, setRequestScope, setUnauthorizedHandler } from "./api";
import type { DraftScope } from "./draft-vault";
import { queryClient } from "./query";
import type { Workspace } from "./types";

const TOKEN_KEY = "et_session_token";
export type User = { id: string; email: string; name: string; emailVerified?: boolean };
type Me = { user: User; workspaces: Workspace[]; activeWorkspaceId: string | null; viewKey: string; expiresAt?: string };
type AuthState = {
  phoneLock: boolean; deviceLocked: boolean; offlineScope: DraftScope | null;
  offlineUntil:number;
  unlockPhone: () => Promise<void>; configureLock: (enabled: boolean) => Promise<void>;
  recheckAccess: () => Promise<void>;
  hydrated: boolean; locked: boolean; error: string | null;
  token: string | null; user: User | null; workspaces: Workspace[]; activeWorkspaceId: string | null; viewKey: string | null;
  hydrate: () => Promise<void>; suspend: () => void; verify: () => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, name: string) => Promise<void>;
  signOut: () => Promise<void>; switchTracker: (id: string) => Promise<void>;
};

const empty = { user: null, workspaces: [], activeWorkspaceId: null, viewKey: null };
export const useAuth = create<AuthState>((set, get) => {
  let revision = 0;
  let foreground = true;
  let lockGeneration = 0;
  let lastWriter: DraftScope | null = null;
  let storageTail = Promise.resolve();
  function persist() {
    const { token, phoneLock, offlineUntil } = get();
    const value = token && JSON.stringify({ token, phoneLock, offlineUntil, writer: lastWriter, origin: apiBase() });
    const write = storageTail.then(() => value ? setItem(TOKEN_KEY, value) :
      deleteItem(TOKEN_KEY).catch(()=>setItem(TOKEN_KEY,'{"signedOut":true}')));
    storageTail = write.catch(() => {});
    return write;
  }
  function clear(token: string | null) {
    revision++;
    setRequestScope(token, null);
    set({ ...empty, token, locked: !!token, error: null, offlineScope: null });
    queryClient.clear();
  }
  async function verify() {
    const { token } = get();
    if (!foreground || !token || get().deviceLocked) return;
    let request = ++revision;
    try {
      const previous = get().viewKey;
      if (previous) {
        const probe = await api<{ viewKey: string }>("/me?check=1");
        if (request !== revision || probe.viewKey === previous) return;
        lastWriter = null;
        clear(token);
        request = revision;
        await persist();
        if (request !== revision) return;
      }
      const me = await api<Me>("/me");
      if (request !== revision) return;
      if (!me.viewKey) throw Error("Tracker verification is unavailable. Please retry after updating the server.");
      if (get().viewKey !== me.viewKey) {
        clear(token);
        request = revision;
        setRequestScope(token, me.viewKey);
      }
      const member = me.workspaces.find(w => w.id === me.activeWorkspaceId);
      lastWriter = member && ["owner","member"].includes(member.role)
        ? { actor: me.user.id, workspace: member.id } : null;
      set({offlineUntil:Math.min(Date.parse(me.expiresAt ?? "") || 0,Date.now()+7*86400000)});
      await persist();
      if (request !== revision) return;
      set({ ...me, locked: false, error: null });
    } catch (error) {
      if (request !== revision) return;
      if (error instanceof ApiError && error.status === 401) {
        lastWriter = null;
        clear(null);
        set({phoneLock:false, deviceLocked:false});
        await persist();
      } else {
        clear(token);
        const offline = error instanceof NetworkUnavailable;
        if (!offline) { lastWriter=null; await persist(); if (get().token!==token) return; }
        set({ error: offline ? "Connect to the internet to reopen your tracker." : "Tracker access could not be verified.",
          offlineScope: offline && get().phoneLock && Date.now()<get().offlineUntil ? lastWriter : null });
      }
    }
  }
  async function enter(token: string) {
    lockGeneration++;
    lastWriter = null;
    set({phoneLock:false, deviceLocked:false});
    clear(token);
    await persist();
    await verify();
    if (get().viewKey) void import("./push").then(({registerForPush}) => registerForPush(false)).catch(() => {});
  }
  return {
    phoneLock:false, deviceLocked:false, offlineScope:null, offlineUntil:0,
    recheckAccess: async () => {
      lastWriter=null;clear(get().token);
      await persist();
      await verify();
    },
    unlockPhone: async () => {
      const epoch = lockGeneration;
      const {token} = get();
      if (!token || !get().deviceLocked) return;
      await (await import("./phone-unlock")).authenticatePhone();
      if (epoch !== lockGeneration || token !== get().token) throw Error("Unlock again to continue.");
      set({deviceLocked:false});
      await verify();
    },
    configureLock: async enabled => {
      const { token } = get();
      const epoch = lockGeneration;
      if (!token || !get().viewKey) throw Error("Reopen the tracker first.");
      await (await import("./phone-unlock")).authenticatePhone();
      if (token !== get().token || epoch !== lockGeneration) throw Error("Reopen the tracker and try again.");
      set({phoneLock:enabled,deviceLocked:false});
      try { await persist(); } catch { set({phoneLock:!enabled}); throw Error("Could not save your phone lock setting."); }
      await verify();
    },
    ...empty, token: null, hydrated: false, locked: false, error: null,
    hydrate: async () => {
      const request=revision;
      try {
        const raw = await getItem(TOKEN_KEY);
        if(request!==revision) return;
        set({error:null});
        if (raw) {
          const stored = raw.startsWith("{") ? JSON.parse(raw) : { token:raw };
          if(typeof stored.token!=="string" || !stored.token) return;
          if ((stored.origin ?? "https://expensetracker.jimishgajjar.com/api/mobile") !== apiBase()) return;
          lastWriter = stored.writer ?? null;
          clear(stored.token);
          set({phoneLock:!!stored.phoneLock,deviceLocked:!!stored.phoneLock,offlineUntil:Number(stored.offlineUntil)||0});
          await verify();
        }
      } catch {
        if (request!==revision) return;
        clear(null);
        set({error:"Could not read the saved session securely. Unlock your phone and retry."});
      } finally { set({ hydrated: true }); }
    },
    suspend: () => {
      foreground = false; clear(get().token); set({deviceLocked:get().phoneLock});
    },
    verify: () => { foreground = true; return verify(); },
    signIn: async (email, password) => {
      const { token } = await api<{token: string}>("/auth/login", { method: "POST", body: { email, password } });
      await enter(token);
    },
    signUp: async (email, password, name) => {
      const { token } = await api<{token: string}>("/auth/signup", { method: "POST", body: { email, password, name } });
      await enter(token);
    },
    signOut: async () => {
      const revoke = api("/auth/logout", { method: "POST" }).catch(() => {});
      lockGeneration++; lastWriter = null;
      clear(null);
      set({phoneLock:false,deviceLocked:false});
      await persist();
      await revoke;
    },
    switchTracker: async (id) => {
      lockGeneration++;
      const request = bindApi();
      const {token} = get();
      lastWriter = null;
      await persist();
      try { await request("/workspace/switch", { method: "POST", body: { workspaceId: id } }); }
      finally { if (get().token === token) { clear(token); await verify(); } }
    },
  };
});
setUnauthorizedHandler(() => {
  void useAuth.getState().recheckAccess().catch(()=>{});
});
