import { AppState, Platform } from "react-native";
import { authenticateAsync } from "expo-local-authentication";

export async function authenticatePhone() {
  if (Platform.OS === "web") throw Error("Phone unlock is available in the native app.");
  const result = await authenticateAsync({
    promptMessage: "Unlock Expense Tracker", fallbackLabel: "Use device passcode",
    disableDeviceFallback: false, biometricsSecurityLevel: "strong",
  });
  if (!result.success) throw Error("Unlock cancelled or unavailable. Use your device PIN or unlock method to continue.");
  // Android's system credential activity and the iOS prompt can finish just
  // before our window becomes active. Never reveal a tracker behind them.
  if (AppState.currentState !== "active") await new Promise<void>((resolve,reject)=>{
    const timer=setTimeout(()=>{subscription.remove();reject(Error("Return to the tracker and unlock again."));},1500);
    const subscription=AppState.addEventListener("change",state=>{
      if(state==="active"){clearTimeout(timer);subscription.remove();resolve();}
    });
  });
}
