import { useEffect, useState } from "react";
import { Alert, Button, Linking, ScrollView, Text } from "react-native";
import { Stack, useRouter } from "expo-router";
import { usePeriod } from "@/lib/period";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { DeviceDrafts } from "@/components/device-drafts";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { AppProvider } from "@/lib/store";
import { useAuth } from "@/lib/auth";
import { listenForHouseholdTaps } from "@/lib/push";
import { Splash } from "@/components/splash";
import { colors } from "@/lib/theme";

// Hold the native splash until React paints, then hand off to the in-app splash.
SplashScreen.preventAutoHideAsync().catch(() => {});

function Root() {
  const { hydrated, locked, deviceLocked, offlineScope, unlockPhone, error, token, viewKey, activeWorkspaceId, workspaces, switchTracker, signOut, verify } = useAuth();
  const [openDrafts,setOpenDrafts]=useState(false);
  const [unlockError,setUnlockError]=useState("");
  const [prompting,setPrompting]=useState(false);
  const router=useRouter();
  useEffect(() => {
    if (locked || !viewKey || !activeWorkspaceId) return;
    return listenForHouseholdTaps(async (link,workspace)=>{
      const current=useAuth.getState();
      if(current.locked || current.viewKey!==viewKey) throw Error("Reopen the tracker.");
      const url=new URL(link), tab=url.searchParams.get("tab");
      if (tab!=="settings" && workspace && workspace!==current.activeWorkspaceId) {
        Alert.alert("Choose the matching tracker","Switch trackers in Settings to review this notification.");
        throw Error("Notification belongs to another tracker.");
      }
      if(!workspace && tab!=="settings" && !url.searchParams.has("thread")) {
        router.navigate("/settings");
        return;
      }
      if (!tab) router.navigate("/home");
      else if (tab==="transactions" && !url.searchParams.has("thread")) router.navigate("/activity");
      else if (tab==="analytics") {
        const date=url.searchParams.get("date");
        if(date) usePeriod.getState().openMonth(date);
        router.navigate("/insights");
      } else await Linking.openURL(link);
    });
  },[locked,viewKey,activeWorkspaceId,router]);
  useEffect(()=>{if (!offlineScope) setOpenDrafts(false);},[offlineScope]);
  const offlineUntil=useAuth(s=>s.offlineUntil);
  useEffect(()=>{
    if (!offlineScope) return;
    const timeout=setTimeout(()=>{useAuth.getState().suspend();void verify();},Math.max(0,offlineUntil-Date.now()));
    return ()=>clearTimeout(timeout);
  },[offlineScope,offlineUntil,verify]);

  useEffect(() => {
    // Drop the native splash on the first frame — the in-app <Splash/> (same
    // logo on white) takes over instantly, so there's never a blank flash.
    SplashScreen.hideAsync().catch(() => {});
  }, []);

  if (!hydrated) return <Splash/>;
  if (deviceLocked) return <SafeAreaView style={{flex:1}}><ScrollView contentContainerStyle={{flexGrow:1,justifyContent:"center",padding:24,gap:16}}>
    <Text accessibilityRole="header" style={{fontSize:22,fontWeight:"600"}}>Tracker locked</Text>
    <Text>Use your phone’s unlock method to continue.</Text>
    {unlockError && <Text accessibilityRole="alert">{unlockError}</Text>}
    <Button title="Unlock tracker" disabled={prompting} onPress={()=>{setPrompting(true);setUnlockError("");
      void unlockPhone().catch(e=>setUnlockError(e.message)).finally(()=>setPrompting(false));}}/>
    <Button title="Sign out" onPress={()=>void signOut()}/>
  </ScrollView></SafeAreaView>;
  if (locked && !error) return <Splash />;
  if (offlineScope && openDrafts) return <DeviceDrafts key={offlineScope.workspace} scope={offlineScope} accounts={[]} offline onClose={()=>setOpenDrafts(false)}/>;
  if (error || (token && !activeWorkspaceId)) return (
    <SafeAreaView style={{flex:1}}><ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: "center", padding: 24, gap: 12 }}>
      <Text>{error ?? "Choose a tracker you still have access to."}</Text>
      {error && !offlineScope && <Text>Offline capture requires phone lock and a recent online check of your editing access.</Text>}
      {offlineScope && <Button title="Open offline drafts" onPress={()=>setOpenDrafts(true)}/>}
      {error ? <Button title="Check access again" onPress={() => void (token ? verify() : useAuth.getState().hydrate())} />
        : workspaces.map(w => <Button key={w.id} title={w.name} onPress={() => void switchTracker(w.id).catch(() => verify())} />)}
      <Button title="Sign out" onPress={() => void signOut()} />
    </ScrollView></SafeAreaView>
  );
  return (
    <>
      <Stack key={viewKey ?? "signed-out"} screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }}>
        <Stack.Protected guard={!!token && !!viewKey && !!activeWorkspaceId}>
          <Stack.Screen name="add" options={{ presentation: "modal" }} />
          {["(tabs)","device-drafts","account-form","account/[id]","categories","category-form","category/[id]",
            "change-password","explore","goal-form","goals","members","recurring-form","settings","split","subscriptions","tag/[id]"]
            .map(name=><Stack.Screen key={name} name={name}/>)}
        </Stack.Protected>
      </Stack>
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
