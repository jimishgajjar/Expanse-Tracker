import { Image, StyleSheet, Text, View } from "react-native";
import { colors } from "@/lib/theme";

/** Branded loading screen shown while auth hydrates. In Expo Go the native
    splash is Expo Go's own, so this is what actually shows the logo there; it
    also matches the native splash (white bg + logo) for a seamless hand-off. */
export function Splash() {
  return (
    <View style={styles.container}>
      <Image source={require("../../assets/images/logo.png")} style={styles.logo} resizeMode="contain" />
      <Text style={styles.name}>Expense Tracker</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#ffffff",
    alignItems: "center",
    justifyContent: "center",
    gap: 18,
    zIndex: 100,
  },
  logo: { width: 100, height: 100, borderRadius: 22 },
  name: { fontSize: 17, fontWeight: "700", color: colors.ink, letterSpacing: -0.2 },
});
