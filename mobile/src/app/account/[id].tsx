import { useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useApp } from "@/lib/store";
import { api } from "@/lib/api";
import { Card, IconBubble, Loading } from "@/components/ui";
import { TxRow } from "@/components/tx-row";
import { colors, radius } from "@/lib/theme";

export default function AccountDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data, money, reload } = useApp();
  const router = useRouter();
  const [search, setSearch] = useState("");

  const account = data?.accounts.find((a) => a.id === id);
  const txns = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (data?.transactions ?? []).filter((t) => {
      if (t.accountId !== id) return false;
      if (q) {
        const hay = `${t.note} ${t.category?.name ?? ""} ${(t.tags ?? []).map((tg) => tg.name).join(" ")}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [data, id, search]);

  if (!data) return <Loading />;
  if (!account) {
    return (
      <SafeAreaView style={s.missing}>
        <Text style={{ color: colors.inkSoft }}>Account not found.</Text>
        <Pressable onPress={() => router.back()}>
          <Text style={{ color: colors.green, marginTop: 8 }}>Go back</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  const acc = account;
  async function toggleArchive() {
    await api(`/accounts/${acc.id}/archive`, { method: "POST", body: { archived: !acc.archived } });
    await reload();
  }
  async function removeAccount() {
    await api(`/accounts/${acc.id}`, { method: "DELETE" });
    await reload();
    router.back();
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={["top"]}>
      <View style={[s.head, { justifyContent: "space-between" }]}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Feather name="chevron-left" size={26} color={colors.ink} />
        </Pressable>
        <View style={{ flexDirection: "row", gap: 20 }}>
          <Pressable onPress={() => router.push(`/account-form?id=${acc.id}`)} hitSlop={10}>
            <Feather name="edit-2" size={19} color={colors.ink} />
          </Pressable>
          <Pressable onPress={toggleArchive} hitSlop={10}>
            <Feather name={acc.archived ? "rotate-ccw" : "archive"} size={19} color={colors.inkSoft} />
          </Pressable>
          <Pressable onPress={removeAccount} hitSlop={10}>
            <Feather name="trash-2" size={19} color={colors.red} />
          </Pressable>
        </View>
      </View>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 16 }}>
          <IconBubble icon={account.icon} label={account.name} color={account.color} size={44} />
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={s.name} numberOfLines={1}>
              {account.name}
            </Text>
            <Text style={s.type}>{account.type}</Text>
          </View>
        </View>

        <Card style={{ marginBottom: 16 }}>
          <Text style={s.cardLabel}>Balance</Text>
          <Text style={[s.balance, account.balance < 0 && { color: colors.red }]}>{money.balance(account.balance)}</Text>
          <View style={{ flexDirection: "row", gap: 24, marginTop: 14 }}>
            <View>
              <Text style={s.statLabel}>In · all time</Text>
              <Text style={[s.stat, { color: colors.green }]}>{money.money(account.income)}</Text>
            </View>
            <View>
              <Text style={s.statLabel}>Out · all time</Text>
              <Text style={[s.stat, { color: colors.red }]}>{money.money(account.expense)}</Text>
            </View>
          </View>
        </Card>

        <View style={s.searchWrap}>
          <Feather name="search" size={16} color={colors.inkFaint} />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Search note, category, tag…"
            placeholderTextColor={colors.inkFaint}
            style={s.searchInput}
            autoCapitalize="none"
            returnKeyType="search"
          />
          {search ? (
            <Pressable onPress={() => setSearch("")} hitSlop={8}>
              <Feather name="x" size={16} color={colors.inkSoft} />
            </Pressable>
          ) : null}
        </View>

        <Text style={s.section}>This month · {txns.length}</Text>
        <Card style={{ padding: 0 }}>
          {txns.length === 0 ? (
            <Text style={s.empty}>{search ? "No transactions match your search." : "No transactions this month."}</Text>
          ) : (
            txns.map((t, i) => (
              <View key={t.id} style={i > 0 ? s.divider : undefined}>
                <TxRow tx={t} fmt={money} />
              </View>
            ))
          )}
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  missing: { flex: 1, backgroundColor: colors.bg, alignItems: "center", justifyContent: "center" },
  head: { paddingHorizontal: 12, paddingVertical: 4 },
  name: { fontSize: 20, fontWeight: "700", color: colors.ink },
  type: { fontSize: 14, color: colors.inkSoft, textTransform: "capitalize" },
  cardLabel: { fontSize: 13, color: colors.inkSoft },
  balance: { fontSize: 30, fontWeight: "800", color: colors.ink, letterSpacing: -0.6, marginTop: 4 },
  statLabel: { fontSize: 12, color: colors.inkFaint },
  stat: { fontSize: 16, fontWeight: "700", marginTop: 2 },
  section: { fontSize: 12, fontWeight: "700", color: colors.inkSoft, textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 10 },
  searchWrap: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: colors.hover, borderRadius: radius.md, paddingHorizontal: 12, paddingVertical: 9, marginBottom: 16 },
  searchInput: { flex: 1, fontSize: 15, color: colors.ink, padding: 0 },
  divider: { borderTopWidth: 1, borderTopColor: colors.border },
  empty: { color: colors.inkSoft, fontSize: 14, padding: 16 },
});
