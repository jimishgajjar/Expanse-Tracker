import { useEffect } from "react";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { AppProvider, useApp } from "@/lib/store";
import { Splash } from "@/components/splash";
import { colors } from "@/lib/theme";

// Hold the native splash until React paints, then hand off to the in-app splash.
SplashScreen.preventAutoHideAsync().catch(() => {});

function Root() {
  const { ready } = useApp();

  useEffect(() => {
    // Drop the native splash on the first frame — the in-app <Splash/> (same
    // logo on white) takes over instantly, so there's never a blank flash.
    SplashScreen.hideAsync().catch(() => {});
  }, []);

  return (
    <>
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }}>
        <Stack.Screen name="add" options={{ presentation: "modal" }} />
      </Stack>
      {!ready ? <Splash /> : null}
    </>
  );
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <AppProvider>
          <StatusBar style="dark" />
          <Root />
        </AppProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
