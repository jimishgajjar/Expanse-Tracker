import { afterEach, expect, it, vi } from "vitest";
import { useAuth } from "./auth";
import { bindApi } from "./api";
import { queryClient } from "./query";

vi.mock("expo-constants", () => ({ default: { expoConfig: { extra: { apiBase: "http://local.test" } } } }));
vi.mock("./storage", () => ({ getItem: async () => null, setItem: async () => {}, deleteItem: async () => {} }));
vi.mock("./push", () => ({ registerForPush: async () => null }));
afterEach(async () => { await useAuth.getState().signOut(); vi.unstubAllGlobals(); });

it("discards cached money, pending reads and an old confirm dialog across background, revocation and sign-out", async () => {
  let view: string | null = "original";
  let offline = false;
  let writes = 0;
  let finishRead!: (res: Response) => void;
  vi.stubGlobal("fetch", async (url: string, options: RequestInit) => {
    if (url.endsWith("/auth/login")) return Response.json({ token: "synthetic" });
    if (url.endsWith("/auth/logout")) return Response.json({});
    if (url.endsWith("/me?check=1")) return Response.json({ viewKey: view ?? "removed" });
    if (url.endsWith("/me")) {
      if (offline) throw Error("offline");
      return Response.json({ viewKey: view ?? "removed", activeWorkspaceId: view ? "private" : null, workspaces: [], user: { id: "person" } });
    }
    expect(new Headers(options.headers).get("x-tracker-view")).toBe(view);
    if (options.method === "POST") writes++;
    return new Promise<Response>(resolve => { finishRead = resolve; });
  });
  const auth = () => useAuth.getState();
  await auth().signIn("test@example.test", "synthetic");
  const beforeDowngrade = bindApi();
  queryClient.setQueryData(["bootstrap"], { balance: 23 });
  await auth().verify();
  expect(queryClient.getQueryData(["bootstrap"])).toEqual({ balance: 23 });
  view = "downgrade";
  await auth().verify();
  expect(queryClient.getQueryData(["bootstrap"])).toBeUndefined();
  await expect(beforeDowngrade("/accounts", { method: "POST" })).rejects.toThrow("Reopen");
  const oldForm = bindApi();
  queryClient.setQueryData(["bootstrap"], { balance: 99 });
  const pending = oldForm("/bootstrap");
  auth().suspend();
  expect(queryClient.getQueryData(["bootstrap"])).toBeUndefined();
  expect(auth().user).toBeNull();
  finishRead(Response.json({ balance: 99 }));
  await expect(pending).rejects.toThrow("changed");
  offline = true;
  await auth().verify();
  expect(auth().locked).toBe(true);
  offline = false;
  view = null;
  await auth().verify();
  expect(auth().activeWorkspaceId).toBeNull();
  await expect(oldForm("/accounts", { method: "POST" })).rejects.toThrow("Reopen");
  expect(writes).toBe(0);
  const beforeLogout = bindApi();
  await auth().signOut();
  await expect(beforeLogout("/bootstrap")).rejects.toThrow("Reopen");
  expect(auth().token).toBeNull();
});
