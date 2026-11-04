import { Platform } from "react-native";
import { digestStringAsync, CryptoDigestAlgorithm, randomUUID } from "expo-crypto";
import { ApiError, apiBase, bindApi } from "./api";
import { useAuth } from "./auth";
import { draftVault, type Draft, type DraftBody, type DraftScope } from "./draft-vault";
import * as storage from "./storage";
import type { DeviceReceipt } from "../../../src/lib/mobile-contract";

const vault = draftVault(storage);
export { randomUUID as newDraftId };

export function currentDraftScope(): DraftScope | null {
  const auth = useAuth.getState();
  if (Platform.OS === "web" || !auth.token || auth.deviceLocked) return null;
  if (auth.offlineScope) return Date.now()<auth.offlineUntil ? auth.offlineScope : null;
  const tracker = auth.workspaces.find(w => w.id === auth.activeWorkspaceId);
  return auth.viewKey && auth.user && tracker && ["member","owner"].includes(tracker.role)
    ? {actor:auth.user.id,workspace:tracker.id} : null;
}

export function openDeviceDrafts(scope: DraftScope) {
  const {token} = useAuth.getState();
  const request = bindApi();
  const guard = () => {
    const active = currentDraftScope();
    if (useAuth.getState().token !== token || active?.actor !== scope.actor || active.workspace !== scope.workspace)
      throw Error("Reopen your original tracker to access its drafts.");
  };
  guard();
  const key = digestStringAsync(CryptoDigestAlgorithm.SHA256, JSON.stringify([apiBase(),scope.actor,scope.workspace]))
    .then(hash => "et.drafts." + hash);
  return {
    list: async () => vault.list(await key, guard),
    save: async (id:string, revision:number, body:DraftBody) => vault.save(await key,guard,id,revision,body),
    discard: async (draft:Draft) => vault.remove(await key,guard,draft),
    post: async (draft:Draft) => {
      guard();
      if (!useAuth.getState().viewKey) throw Error("Reconnect and check tracker access before posting.");
      const path = await key;
      const pending = await vault.mark(path,guard,draft,true);
      let receipt: DeviceReceipt;
      try {
        guard();
        receipt = await request<DeviceReceipt>("/device-drafts",{method:"POST",body:{
          ...scope,requestId:pending.id,entry:pending.body,
        }});
      } catch (error) {
        if (error instanceof ApiError && error.status===404)
          throw Error("This server does not support device draft receipts yet. Your phone has kept the draft for a later retry.");
        if (error instanceof ApiError && error.status === 422 && error.code === "invalid")
          await vault.mark(path,guard,pending,false);
        if (error instanceof ApiError && error.status === 409 && (error.code==="deleted" || error.code==="different"))
          await vault.conflict(path,guard,pending,error.code);
        throw error;
      }
      if (receipt.requestId !== pending.id || !receipt.transactionId || typeof receipt.replayed !== "boolean")
        throw Error("No matching receipt. Keep this draft and retry.");
      await vault.remove(path,guard,pending,true);
      return receipt;
    },
  };
}
