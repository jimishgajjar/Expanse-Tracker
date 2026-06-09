import { useState } from "react";
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { api } from "@/lib/api";
import { qk } from "@/lib/query";
import { Card, IconBubble, Loading } from "@/components/ui";
import { colors, radius } from "@/lib/theme";
import type { Member } from "@/lib/types";

export default function Members() {
  const router = useRouter();
  const me = useAuth((s) => s.user);
  const q = useQuery({ queryKey: qk.members(), queryFn: () => api<{ members: Member[]; invites: string[] }>("/members") });
  const members = q.data?.members ?? [];
  const invites = q.data?.invites ?? [];

  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"member" | "viewer">("member");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function invite() {
    if (!email.trim()) return;
    setBusy(true);
    setError(null);
    try {
      await api("/members", { method: "POST", body: { email: email.trim(), role } });
      setEmail("");
      await q.refetch();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't invite.");
    } finally {
      setBusy(false);
    }
  }
  async function remove(id: string) {
    await api(`/members/${id}`, { method: "DELETE" });
    await q.refetch();
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={["top"]}>
      <View style={s.head}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Feather name="chevron-left" size={26} color={colors.ink} />
        </Pressable>
        <Text style={s.title}>Sharing</Text>
        <View style={{ width: 26 }} />
      </View>
      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={q.isFetching} onRefresh={() => q.refetch()} tintColor={colors.green} />}
      >
        <Text style={s.section}>Invite someone</Text>
        <Card style={{ marginBottom: 18, gap: 12 }}>
          <TextInput
            style={s.input}
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            inputMode="email"
            placeholder="their@email.com"
            placeholderTextColor={colors.inkFaint}
          />
          <View style={s.roleToggle}>
            {(["member", "viewer"] as const).map((r) => (
              <Pressable key={r} onPress={() => setRole(r)} style={[s.roleBtn, role === r && s.roleActive]}>
                <Text style={[s.roleText, role === r && s.roleTextActive]}>{r === "member" ? "Can edit" : "View only"}</Text>
              </Pressable>
            ))}
          </View>
          {error ? <Text style={s.error}>{error}</Text> : null}
          <Pressable style={[s.invite, busy && { opacity: 0.6 }]} onPress={invite} disabled={busy}>
            {busy ? <ActivityIndicator color="#fff" /> : <Text style={s.inviteText}>Send invite</Text>}
          </Pressable>
        </Card>

        <Text style={s.section}>People · {members.length}</Text>
        <Card style={{ padding: 0 }}>
          {q.isLoading ? (
            <View style={{ padding: 24 }}>
              <Loading />
            </View>
          ) : (
            members.map((m, i) => (
              <View key={m.id} style={[s.row, i > 0 && s.divider]}>
                <IconBubble label={m.name || m.email} color={colors.blue} size={36} />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={s.name} numberOfLines={1}>
                    {m.name || m.email}
                    {m.id === me?.id ? " (you)" : ""}
                  </Text>
                  <Text style={s.sub} numberOfLines={1}>
                    {m.email} · {m.role}
                  </Text>
                </View>
                {m.id !== me?.id && m.role !== "owner" ? (
                  <Pressable onPress={() => remove(m.id)} hitSlop={8}>
                    <Feather name="x" size={18} color={colors.inkFaint} />
                  </Pressable>
                ) : null}
              </View>
            ))
          )}
        </Card>

        {invites.length > 0 ? (
          <>
            <Text style={[s.section, { marginTop: 18 }]}>Pending invites</Text>
            <Card style={{ padding: 0 }}>
              {invites.map((e, i) => (
                <View key={e} style={[s.row, i > 0 && s.divider]}>
                  <Feather name="clock" size={16} color={colors.inkFaint} style={{ marginLeft: 4 }} />
                  <Text style={s.sub}>{e}</Text>
                </View>
              ))}
            </Card>
          </>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  head: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 12, paddingVertical: 8 },
  title: { fontSize: 18, fontWeight: "700", color: colors.ink },
  section: { fontSize: 12, fontWeight: "700", color: colors.inkSoft, textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 8 },
  input: { borderWidth: 1, borderColor: colors.borderStrong, borderRadius: radius.md, paddingHorizontal: 14, paddingVertical: 12, fontSize: 16, color: colors.ink },
  roleToggle: { flexDirection: "row", backgroundColor: colors.hover, borderRadius: radius.md, padding: 3, gap: 3 },
  roleBtn: { flex: 1, paddingVertical: 8, borderRadius: radius.sm, alignItems: "center" },
  roleActive: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border },
  roleText: { fontSize: 13, fontWeight: "600", color: colors.inkSoft },
  roleTextActive: { color: colors.ink },
  invite: { backgroundColor: colors.green, borderRadius: radius.md, paddingVertical: 12, alignItems: "center" },
  inviteText: { color: "#fff", fontSize: 15, fontWeight: "600" },
  row: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 11, paddingHorizontal: 12 },
  divider: { borderTopWidth: 1, borderTopColor: colors.border },
  name: { fontSize: 15, fontWeight: "600", color: colors.ink },
  sub: { fontSize: 13, color: colors.inkSoft, marginTop: 1 },
  error: { color: colors.red, fontSize: 13 },
});
