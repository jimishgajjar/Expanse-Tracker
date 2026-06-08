import { Redirect } from "expo-router";
import { useApp } from "@/lib/store";
import { Loading } from "@/components/ui";

export default function Index() {
  const { ready, token } = useApp();
  if (!ready) return <Loading />;
  return <Redirect href={token ? "/home" : "/login"} />;
}
