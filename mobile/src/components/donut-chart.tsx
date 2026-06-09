import Svg, { Circle, G } from "react-native-svg";
import { Text, View } from "react-native";
import { colors } from "@/lib/theme";

export function DonutChart({
  data,
  size = 150,
  strokeWidth = 22,
  centerValue,
  centerLabel,
}: {
  data: { value: number; color: string }[];
  size?: number;
  strokeWidth?: number;
  centerValue?: string;
  centerLabel?: string;
}) {
  const total = data.reduce((sum, d) => sum + d.value, 0);
  const radius = (size - strokeWidth) / 2;
  const circ = 2 * Math.PI * radius;
  let offset = 0;

  return (
    <View style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }}>
      <Svg width={size} height={size} style={{ position: "absolute" }}>
        <G rotation={-90} origin={`${size / 2}, ${size / 2}`}>
          <Circle cx={size / 2} cy={size / 2} r={radius} stroke={colors.hover} strokeWidth={strokeWidth} fill="none" />
          {total > 0 &&
            data.map((d, i) => {
              const dash = (d.value / total) * circ;
              const node = (
                <Circle
                  key={i}
                  cx={size / 2}
                  cy={size / 2}
                  r={radius}
                  stroke={d.color}
                  strokeWidth={strokeWidth}
                  fill="none"
                  strokeDasharray={`${dash} ${circ - dash}`}
                  strokeDashoffset={-offset}
                />
              );
              offset += dash;
              return node;
            })}
        </G>
      </Svg>
      <View style={{ alignItems: "center" }}>
        {centerValue ? <Text style={{ fontSize: 16, fontWeight: "800", color: colors.ink }}>{centerValue}</Text> : null}
        {centerLabel ? <Text style={{ fontSize: 10, color: colors.inkSoft, marginTop: 1 }}>{centerLabel}</Text> : null}
      </View>
    </View>
  );
}
