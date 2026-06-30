import { Pressable, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { IconBubble, Pill } from "./ui";
import { colors } from "@/lib/theme";
import type { Transaction } from "@/lib/types";

export function TxRow({ tx, fmt }: { tx: Transaction; fmt: { signed: (n: number) => string } }) {
  const router = useRouter();
  const positive = tx.type === "income";
  const tint = tx.category?.color || tx.account?.color || colors.inkSoft;
  const title = tx.note || tx.category?.name || (positive ? "Income" : "Expense");
  const sub = [tx.category?.name, tx.account?.name].filter(Boolean).join("  ·  ");

  return (
    <Pressable
      onPress={() => router.push(`/add?id=${tx.id}`)}
      style={({ pressed }) => ({
        flexDirection: "row",
        alignItems: "center",
        paddingVertical: 11,
        paddingHorizontal: 12,
        gap: 12,
        backgroundColor: pressed ? colors.hover : "transparent",
      })}
    >
      {tx.categoryId ? (
        <Pressable onPress={() => router.push(`/category/${tx.categoryId}`)} hitSlop={6}>
          <IconBubble icon={tx.category?.icon ?? tx.account?.icon} label={tx.category?.name || tx.account?.name || "?"} color={tint} />
        </Pressable>
      ) : (
        <IconBubble icon={tx.category?.icon ?? tx.account?.icon} label={tx.category?.name || tx.account?.name || "?"} color={tint} />
      )}
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={{ fontSize: 15, fontWeight: "600", color: colors.ink }} numberOfLines={1}>
          {title}
        </Text>
        {sub ? (
          <Text style={{ fontSize: 13, color: colors.inkSoft, marginTop: 1 }} numberOfLines={1}>
            {sub}
          </Text>
        ) : null}
        {tx.tags?.length ? (
          <View style={{ flexDirection: "row", gap: 5, marginTop: 4 }}>
            {tx.tags.slice(0, 3).map((t) => (
              <Pressable key={t.id} onPress={() => router.push(`/tag/${t.id}`)} hitSlop={4}>
                <Pill label={t.name} color={t.color} />
              </Pressable>
            ))}
          </View>
        ) : null}
      </View>
      <Text style={{ fontSize: 15, fontWeight: "700", color: positive ? colors.green : colors.red }}>
        {fmt.signed(positive ? tx.amount : -tx.amount)}
      </Text>
    </Pressable>
  );
}
