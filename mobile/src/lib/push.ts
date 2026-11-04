import Constants, { ExecutionEnvironment } from "expo-constants";
import { AppState, Linking, Platform } from "react-native";
import { apiBase, bindApi } from "./api";
import { householdNotificationLink } from "./notification-link";
import { useAuth } from "./auth";

// expo-notifications removed remote-push from Expo Go (SDK 53+) — and even
// *importing* the module there throws. So it is never imported at the top level:
// we only pull it in (dynamically) inside a real device / development build,
// guarded by this Expo Go check.
const isExpoGo = Constants.executionEnvironment === ExecutionEnvironment.StoreClient;

export function listenForHouseholdTaps(open: (url:string,workspace?:string)=>Promise<unknown> = url=>Linking.openURL(url)) {
  let active = true;
  let cleanup: (()=>void) | undefined;
  if (!isExpoGo && Platform.OS !== "web") {
    void import("expo-notifications").then(notifications => {
      if (!active) return;
      let handled = "";
      const handle = (response: import("expo-notifications").NotificationResponse | null) => {
        if (!response || response.actionIdentifier !== notifications.DEFAULT_ACTION_IDENTIFIER) return;
        const {identifier,content} = response.notification.request;
        if (identifier === handled) return;
        const link = householdNotificationLink(content.data?.url,apiBase());
        if (!link) return;
        handled = identifier;
        const workspace=content.data?.workspace;
        void open(link,typeof workspace==="string"?workspace:undefined).then(() => {
          if (notifications.getLastNotificationResponse()?.notification.request.identifier === identifier)
            notifications.clearLastNotificationResponse();
        }).catch(() => { handled = ""; });
      };
      const subscription = notifications.addNotificationResponseReceivedListener(handle);
      cleanup = () => subscription.remove();
      handle(notifications.getLastNotificationResponse());
    }).catch(() => {});
  }
  return () => { active = false; cleanup?.(); };
}

/** Ask permission, get the Expo push token, and register it with the backend.
    Returns null (never throws) in Expo Go or if anything is unavailable. */
export async function registerForPush(askPermission = true): Promise<string | null> {
  const {token:session,viewKey} = useAuth.getState();
  if (!session || !viewKey || isExpoGo || Platform.OS === "web") return null;
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

    if (Platform.OS === "android") {
      await Notifications.setNotificationChannelAsync("default", {
        name: "Default", importance: Notifications.AndroidImportance.DEFAULT,
      });
    }
    const existing = await Notifications.getPermissionsAsync();
    let status = existing.status;
    if (status !== "granted" && askPermission) {
      status = (await Notifications.requestPermissionsAsync()).status;
    }
    if (status !== "granted") return null;

    const projectId =
      (Constants.expoConfig?.extra as { eas?: { projectId?: string } } | undefined)?.eas?.projectId ??
      (Constants as { easConfig?: { projectId?: string } }).easConfig?.projectId;
    if (!projectId) return null;

    const token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
    // Permission prompts can background the app and invalidate the original request scope.
    if (AppState.currentState !== "active" || useAuth.getState().token !== session) return null;
    await useAuth.getState().verify();
    const current = useAuth.getState();
    if (current.locked || current.token !== session || current.viewKey !== viewKey) return null;
    await bindApi()("/push/register", { method: "POST", body: { token, platform: Platform.OS } });
    return token;
  } catch {
    return null;
  }
}
