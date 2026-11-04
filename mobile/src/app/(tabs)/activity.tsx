import { useMemo, useState } from "react";
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useApp } from "@/lib/store";
import { Loading } from "@/components/ui";
import { colors, radius } from "@/lib/theme";
import { activityGroups, type EntryFilter } from "@/lib/activity-list";
import { EntryFilters, LedgerList } from "@/components/ledger-list";
import { FinancialPosition } from "@/components/financial-position";



export default function Activity() {
  const { data, loading, reload, money } = useApp();
  const [filter, setFilter] = useState<EntryFilter>("all");
  const [original,setOriginal]=useState(false);
  const [search, setSearch] = useState("");

  const groups = useMemo(()=>activityGroups(data?.transactions??[],data?.transfers??[],data?.accounts??[],filter,search),[data,filter,search]);

  if (!data) return <Loading />;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={["top"]}>
      <View style={s.head}>
        <Text style={s.title}>Activity</Text>
        <EntryFilters value={filter} onChange={setFilter}/>
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
      </View>
      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={reload} tintColor={colors.green} />}
      >
        {data.finance && <FinancialPosition finance={data.finance} original={original} toggle={()=>setOriginal(!original)}/>}
        {(!data.finance?.report || original) && <LedgerList groups={groups} money={money}/>}
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  head: { paddingHorizontal: 16, paddingTop: 8 },
  title: { fontSize: 24, fontWeight: "700", color: colors.ink, letterSpacing: -0.5, marginBottom: 12 },
  filters: { flexDirection: "row", backgroundColor: colors.cardAlt, borderRadius: radius.md, padding: 3, gap: 3, marginBottom: 10 },
  searchWrap: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: 12, paddingVertical: 9, marginBottom: 4 },
  searchInput: { flex: 1, fontSize: 14, color: colors.ink, padding: 0 },
  filter: { flex: 1, minHeight: 36, justifyContent: "center", borderRadius: radius.sm, alignItems: "center" },
  filterActive: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border },
  filterText: { fontSize: 12, fontWeight: "600", color: colors.inkSoft },
  filterTextActive: { color: colors.green },
  dayHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 6, paddingHorizontal: 2 },
  dayLabel: { fontSize: 13, fontWeight: "600", color: colors.inkSoft },
  dayNet: { fontSize: 13, fontWeight: "700" },
  divider: { borderTopWidth: 1, borderTopColor: colors.border },
  empty: { color: colors.inkSoft, fontSize: 14, textAlign: "center", marginTop: 48 },
});
