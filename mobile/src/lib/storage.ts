import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";

// expo-secure-store has no native module on web — fall back to localStorage
// there, and use the secure keychain/keystore on iOS + Android.
function webStorage(): { getItem(k: string): string | null; setItem(k: string, v: string): void; removeItem(k: string): void } | null {
  try {
    return (globalThis as { localStorage?: ReturnType<typeof webStorage> }).localStorage ?? null;
  } catch {
    return null;
  }
}

export async function getItem(key: string): Promise<string | null> {
  if (Platform.OS === "web") return webStorage()?.getItem(key) ?? null;
  return SecureStore.getItemAsync(key);
}

export async function setItem(key: string, value: string): Promise<void> {
  if (Platform.OS === "web") {
    webStorage()?.setItem(key, value);
    return;
  }
  await SecureStore.setItemAsync(key, value);
}

export async function deleteItem(key: string): Promise<void> {
  if (Platform.OS === "web") {
    webStorage()?.removeItem(key);
    return;
  }
  await SecureStore.deleteItemAsync(key);
}
