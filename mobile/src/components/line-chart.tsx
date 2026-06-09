import { useState } from "react";
import { View } from "react-native";
import Svg, { Path } from "react-native-svg";
import { colors } from "@/lib/theme";

export function LineChart({ data, height = 110, color = colors.green }: { data: number[]; height?: number; color?: string }) {
  const [w, setW] = useState(0);
  return (
    <View onLayout={(e) => setW(e.nativeEvent.layout.width)} style={{ height }}>
      {w > 1 && data.length >= 2 ? <Chart data={data} width={w} height={height} color={color} /> : null}
    </View>
  );
}

function Chart({ data, width, height, color }: { data: number[]; width: number; height: number; color: string }) {
  const max = Math.max(...data);
  const min = Math.min(...data, 0);
  const range = max - min || 1;
  const pad = 6;
  const w = width - pad * 2;
  const h = height - pad * 2;
  const pts = data.map((v, i) => {
    const x = pad + (i / (data.length - 1)) * w;
    const y = pad + h - ((v - min) / range) * h;
    return [x, y] as const;
  });
  const line = pts.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`).join(" ");
  const area = `${line} L${pts[pts.length - 1][0].toFixed(1)} ${height - pad} L${pts[0][0].toFixed(1)} ${height - pad} Z`;
  return (
    <Svg width={width} height={height}>
      <Path d={area} fill={color + "18"} />
      <Path d={line} stroke={color} strokeWidth={2.5} fill="none" strokeLinejoin="round" strokeLinecap="round" />
    </Svg>
  );
}
