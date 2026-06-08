import { Redirect } from "expo-router";

// Demo route from the scaffold — redirect into the app so it isn't bundled.
export default function Explore() {
  return <Redirect href="/home" />;
}
