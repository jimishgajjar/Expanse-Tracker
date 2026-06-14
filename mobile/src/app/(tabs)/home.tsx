import { useMemo, useState } from "react";
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useApp } from "@/lib/store";
import { useAuth } from "@/lib/auth";
import { api } from "@/lib/api";
import { Card, ErrorView, IconBubble, Loading } from "@/components/ui";
import { TxRow } from "@/components/tx-row";
import { PeriodBar } from "@/components/period-bar";
import { DonutChart } from "@/components/donut-chart";
import { tapLight } from "@/lib/haptics";
import { colors, radius } from "@/lib/theme";

export default function Home() {
  const { data, loading, error, reload, money, signOut } = useApp();
  const user = useAuth((st) => st.user);
  const router = useRouter();

  const summary = useMemo(() => {
    const txns = data?.transactions ?? [];
    const income = txns.filter((t) => t.type === "income").reduce((s, t) => s + t.amount, 0);
    const expense = txns.filter((t) => t.type === "expense").reduce((s, t) => s + t.amount, 0);
    const balance = (data?.accounts ?? []).filter((a) => !a.archived).reduce((s, a) => s + a.balance, 0);
    return { income, expense, net: income - expense, balance };
  }, [data]);

  const spending = useMemo(() => {
    const cats = new Map<string, { name: string; color: string; amount: number }>();
    for (const t of data?.transactions ?? []) {
      if (t.type !== "expense") continue;
      const name = t.category?.name ?? "Uncategorized";
      const color = t.category?.color ?? "#9b9a97";
      const cur = cats.get(name) ?? { name, color, amount: 0 };
      cur.amount += t.amount;
      cats.set(name, cur);
    }
    return [...cats.values()].sort((a, b) => b.amount - a.amount);
  }, [data]);

  if (!data) {
    if (error) return <ErrorView message={error} onRetry={reload} onSignOut={signOut} />;
    return <Loading />;
  }

  const accounts = data.accounts.filter((a) => !a.archived);
  const recent = data.transactions.slice(0, 8);
  const workspaceName = data.workspaces.find((w) => w.id === data.activeWorkspaceId)?.name ?? "Personal";

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={["top"]}>
      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: 110 }}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={reload} tintColor={colors.green} />}
      >
        {user?.emailVerified === false ? <VerifyBanner /> : null}
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

        <View style={{ marginBottom: 18 }}>
          <PeriodBar />
        </View>

        <View style={s.grid}>
          <SummaryCard label="Total balance" value={money.balance(summary.balance)} hint={`across ${accounts.length} accounts`} />
          <SummaryCard label="Income" value={money.money(summary.income)} tone={colors.green} />
          <SummaryCard label="Expenses" value={money.money(summary.expense)} tone={colors.red} />
          <SummaryCard label="Net" value={money.signed(summary.net)} tone={summary.net >= 0 ? colors.green : colors.red} />
        </View>

        {spending.length > 0 ? (
          <Card style={{ marginTop: 16 }}>
            <Text style={s.cardTitle}>Spending by category</Text>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 16, marginTop: 12 }}>
              <DonutChart
                data={spending.map((c) => ({ value: c.amount, color: c.color }))}
                centerValue={money.money(summary.expense)}
                centerLabel="spent"
              />
              <View style={{ flex: 1, gap: 9 }}>
                {spending.slice(0, 5).map((c) => (
                  <View key={c.name} style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                    <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: c.color }} />
                    <Text style={{ flex: 1, fontSize: 13, color: colors.ink }} numberOfLines={1}>
                      {c.name}
                    </Text>
                    <Text style={{ fontSize: 13, fontWeight: "600", color: colors.ink }}>{money.money(c.amount)}</Text>
                  </View>
                ))}
              </View>
            </View>
          </Card>
        ) : null}

        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 24, marginBottom: 10 }}>
          <Text style={[s.section, { marginTop: 0, marginBottom: 0 }]}>Accounts</Text>
          <Pressable onPress={() => router.push("/account-form")} hitSlop={8} style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
            <Feather name="plus" size={16} color={colors.green} />
            <Text style={{ color: colors.green, fontSize: 13, fontWeight: "600" }}>Add</Text>
          </Pressable>
        </View>
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

      <Pressable style={s.fab} onPress={() => { tapLight(); router.push("/add"); }} accessibilityLabel="Add transaction">
        <Feather name="plus" size={26} color="#fff" />
      </Pressable>
    </SafeAreaView>
  );
}

function VerifyBanner() {
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  async function resend() {
    setBusy(true);
    try {
      await api("/auth/resend-verification", { method: "POST" });
      setSent(true);
    } catch {
      /* ignore */
    } finally {
      setBusy(false);
    }
  }
  return (
    <View style={s.banner}>
      <Feather name="mail" size={15} color={colors.yellow} />
      <Text style={s.bannerText}>{sent ? "Verification email sent." : "Verify your email to unlock sharing."}</Text>
      {!sent ? (
        <Pressable onPress={resend} disabled={busy} hitSlop={6}>
          <Text style={s.bannerAction}>{busy ? "…" : "Resend"}</Text>
        </Pressable>
      ) : null}
    </View>
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
  cardTitle: { fontSize: 15, fontWeight: "700", color: colors.ink },
  accountCard: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 10 },
  accountName: { fontSize: 15, fontWeight: "600", color: colors.ink },
  accountType: { fontSize: 13, color: colors.inkSoft, textTransform: "capitalize" },
  accountBalance: { fontSize: 16, fontWeight: "700", color: colors.ink },
  divider: { borderTopWidth: 1, borderTopColor: colors.border },
  empty: { color: colors.inkSoft, fontSize: 14, padding: 16 },
  fab: {
    position: "absolute",
    right: 20,
    bottom: 104,
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
  banner: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: colors.yellow + "18", borderRadius: radius.md, padding: 12, marginBottom: 14 },
  bannerText: { flex: 1, fontSize: 13, color: colors.ink },
  bannerAction: { fontSize: 13, fontWeight: "700", color: colors.yellow },
});
