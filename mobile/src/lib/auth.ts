import { create } from "zustand";
import { getItem, setItem, deleteItem } from "./storage";
import { api, setAuthToken, setUnauthorizedHandler } from "./api";
import { registerForPush } from "./push";
import type { Workspace } from "./types";

const TOKEN_KEY = "et_session_token";

export type User = { id: string; email: string; name: string; emailVerified?: boolean };
type AuthResp = { token: string; user: User; workspaces: Workspace[]; activeWorkspaceId: string | null };

type AuthState = {
  hydrated: boolean;
  token: string | null;
  user: User | null;
  workspaces: Workspace[];
  activeWorkspaceId: string | null;
  hydrate: () => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, name: string) => Promise<void>;
  signOut: () => Promise<void>;
  setActiveWorkspace: (id: string) => void;
};

export const useAuth = create<AuthState>((set) => {
  async function apply(res: AuthResp) {
    await setItem(TOKEN_KEY, res.token);
    setAuthToken(res.token);
    set({ token: res.token, user: res.user, workspaces: res.workspaces, activeWorkspaceId: res.activeWorkspaceId });
    registerForPush().catch(() => {});
  }

  return {
    hydrated: false,
    token: null,
    user: null,
    workspaces: [],
    activeWorkspaceId: null,

    hydrate: async () => {
      try {
        const token = await getItem(TOKEN_KEY);
        if (token) {
          setAuthToken(token);
          const me = await api<{ user: User; workspaces: Workspace[]; activeWorkspaceId: string | null }>("/me");
          set({ token, user: me.user, workspaces: me.workspaces, activeWorkspaceId: me.activeWorkspaceId });
          registerForPush().catch(() => {});
        }
      } catch {
        // Token missing/expired — start signed out.
        await deleteItem(TOKEN_KEY);
        setAuthToken(null);
        set({ token: null, user: null });
      } finally {
        set({ hydrated: true });
      }
    },

    signIn: async (email, password) => {
      await apply(await api<AuthResp>("/auth/login", { method: "POST", body: { email, password } }));
    },
    signUp: async (email, password, name) => {
      await apply(await api<AuthResp>("/auth/signup", { method: "POST", body: { email, password, name } }));
    },
    signOut: async () => {
      try {
        await api("/auth/logout", { method: "POST" });
      } catch {
        /* best-effort */
      }
      await deleteItem(TOKEN_KEY);
      setAuthToken(null);
      set({ token: null, user: null, workspaces: [], activeWorkspaceId: null });
    },
    setActiveWorkspace: (id) => set({ activeWorkspaceId: id }),
  };
});

// Any 401 from the API (expired/invalid token) signs the user out → login.
setUnauthorizedHandler(() => {
  void useAuth.getState().signOut();
});
