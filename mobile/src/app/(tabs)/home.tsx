import { useMemo } from "react";
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useApp } from "@/lib/store";
import { Card, IconBubble, Loading } from "@/components/ui";
import { TxRow } from "@/components/tx-row";
import { colors, radius } from "@/lib/theme";

export default function Home() {
  const { data, loading, reload, money } = useApp();
  const router = useRouter();

  const summary = useMemo(() => {
    const txns = data?.transactions ?? [];
    const income = txns.filter((t) => t.type === "income").reduce((s, t) => s + t.amount, 0);
    const expense = txns.filter((t) => t.type === "expense").reduce((s, t) => s + t.amount, 0);
    const balance = (data?.accounts ?? []).filter((a) => !a.archived).reduce((s, a) => s + a.balance, 0);
    return { income, expense, net: income - expense, balance };
  }, [data]);

  if (!data) return <Loading />;

  const accounts = data.accounts.filter((a) => !a.archived);
  const recent = data.transactions.slice(0, 8);
  const workspaceName = data.workspaces.find((w) => w.id === data.activeWorkspaceId)?.name ?? "Personal";

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={["top"]}>
      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: 110 }}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={reload} tintColor={colors.green} />}
      >
        <View style={s.header}>
          <View style={s.logo}>
            <Text style={s.logoText}>E</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.brand}>Expense Tracker</Text>
            <Text style={s.ws} numberOfLines={1}>
              {workspaceName}
            </Text>
          </View>
        </View>

        <View style={s.grid}>
          <SummaryCard label="Total balance" value={money.balance(summary.balance)} hint={`across ${accounts.length} accounts`} />
          <SummaryCard label="Income" value={money.money(summary.income)} tone={colors.green} />
          <SummaryCard label="Expenses" value={money.money(summary.expense)} tone={colors.red} />
          <SummaryCard label="Net" value={money.signed(summary.net)} tone={summary.net >= 0 ? colors.green : colors.red} />
        </View>

        <Text style={s.section}>Accounts</Text>
        {accounts.map((a) => (
          <Pressable key={a.id} onPress={() => router.push(`/account/${a.id}`)}>
            <Card style={s.accountCard}>
              <IconBubble icon={a.icon} label={a.name} color={a.color} />
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={s.accountName} numberOfLines={1}>
                  {a.name}
                </Text>
                <Text style={s.accountType}>{a.type}</Text>
              </View>
              <Text style={[s.accountBalance, a.balance < 0 && { color: colors.red }]}>{money.balance(a.balance)}</Text>
            </Card>
          </Pressable>
        ))}

        <Text style={s.section}>Recent</Text>
        <Card style={{ padding: 0 }}>
          {recent.length === 0 ? (
            <Text style={s.empty}>No transactions this month yet.</Text>
          ) : (
            recent.map((t, i) => (
              <View key={t.id} style={i > 0 ? s.divider : undefined}>
                <TxRow tx={t} fmt={money} />
              </View>
            ))
          )}
        </Card>
      </ScrollView>

      <Pressable style={s.fab} onPress={() => router.push("/add")} accessibilityLabel="Add transaction">
        <Feather name="plus" size={26} color="#fff" />
      </Pressable>
    </SafeAreaView>
  );
}

function SummaryCard({ label, value, hint, tone }: { label: string; value: string; hint?: string; tone?: string }) {
  return (
    <Card style={s.summaryCard}>
      <Text style={s.summaryLabel}>{label}</Text>
      <Text style={[s.summaryValue, tone ? { color: tone } : null]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
        {value}
      </Text>
      {hint ? <Text style={s.summaryHint}>{hint}</Text> : null}
    </Card>
  );
}

const s = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 18 },
  logo: { width: 40, height: 40, borderRadius: radius.md, backgroundColor: colors.green, alignItems: "center", justifyContent: "center" },
  logoText: { color: "#fff", fontSize: 20, fontWeight: "800" },
  brand: { fontSize: 19, fontWeight: "700", color: colors.ink, letterSpacing: -0.3 },
  ws: { fontSize: 13, color: colors.inkSoft },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  summaryCard: { width: "47%", flexGrow: 1, padding: 14, gap: 3 },
  summaryLabel: { fontSize: 13, color: colors.inkSoft },
  summaryValue: { fontSize: 21, fontWeight: "700", color: colors.ink, letterSpacing: -0.4 },
  summaryHint: { fontSize: 12, color: colors.inkFaint },
  section: { fontSize: 12, fontWeight: "700", color: colors.inkSoft, textTransform: "uppercase", letterSpacing: 0.6, marginTop: 24, marginBottom: 10 },
  accountCard: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 10 },
  accountName: { fontSize: 15, fontWeight: "600", color: colors.ink },
  accountType: { fontSize: 13, color: colors.inkSoft, textTransform: "capitalize" },
  accountBalance: { fontSize: 16, fontWeight: "700", color: colors.ink },
  divider: { borderTopWidth: 1, borderTopColor: colors.border },
  empty: { color: colors.inkSoft, fontSize: 14, padding: 16 },
  fab: {
    position: "absolute",
    right: 20,
    bottom: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.green,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOpacity: 0.18,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 5,
  },
});
