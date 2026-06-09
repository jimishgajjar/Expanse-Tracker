import Constants, { ExecutionEnvironment } from "expo-constants";
import { Platform } from "react-native";
import { api } from "./api";

// expo-notifications removed remote-push from Expo Go (SDK 53+) — and even
// *importing* the module there throws. So it is never imported at the top level:
// we only pull it in (dynamically) inside a real device / development build,
// guarded by this Expo Go check.
const isExpoGo = Constants.executionEnvironment === ExecutionEnvironment.StoreClient;

/** Ask permission, get the Expo push token, and register it with the backend.
    Returns null (never throws) in Expo Go or if anything is unavailable. */
export async function registerForPush(): Promise<string | null> {
  if (isExpoGo) return null;
  try {
    const Notifications = await import("expo-notifications");
    const Device = await import("expo-device");
    if (!Device.isDevice) return null;

    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
      }),
    });

    const existing = await Notifications.getPermissionsAsync();
    let status = existing.status;
    if (status !== "granted") {
      status = (await Notifications.requestPermissionsAsync()).status;
    }
    if (status !== "granted") return null;

    if (Platform.OS === "android") {
      await Notifications.setNotificationChannelAsync("default", {
        name: "Default",
        importance: Notifications.AndroidImportance.DEFAULT,
      });
    }

    const projectId =
      (Constants.expoConfig?.extra as { eas?: { projectId?: string } } | undefined)?.eas?.projectId ??
      (Constants as { easConfig?: { projectId?: string } }).easConfig?.projectId;
    if (!projectId) return null;

    const token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
    await api("/push/register", { method: "POST", body: { token, platform: Platform.OS } });
    return token;
  } catch {
    return null;
  }
}
