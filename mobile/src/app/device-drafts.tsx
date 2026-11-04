import { Redirect, useRouter } from "expo-router";
import { DeviceDrafts } from "../components/device-drafts";
import { currentDraftScope } from "../lib/device-drafts";
import { useApp } from "../lib/store";

export default function DraftScreen() {
  const {data,reload}=useApp();
  const router=useRouter();
  const scope=currentDraftScope();
  if (!scope) return <Redirect href="/"/>;
  return <DeviceDrafts scope={scope} accounts={(data?.accounts??[]).filter(a=>!a.archived)}
    categories={data?.categories} tags={data?.tags}
    onPost={()=>void reload()} onClose={()=>router.canGoBack()?router.back():router.replace("/home")}/>;
}
