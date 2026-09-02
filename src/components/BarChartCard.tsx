import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { chartColorRotation, tokens } from "../lib/theme";

export interface BarDatum {
  name: string;
  value: number;
  fullName?: string; // untruncated label, shown in the tooltip when name is shortened for axis space
  flag?: string; // e.g. "partial" — shown in tooltip, dims the bar
}

interface BarChartCardProps {
  data: BarDatum[];
  layout?: "horizontal" | "vertical"; // "horizontal" = bars run left-to-right (categories on Y)
  height?: number | string;
  valueLabel?: string;
}

function CustomTooltip({ active, payload, valueLabel }: any) {
  if (!active || !payload?.length) return null;
  const d: BarDatum = payload[0].payload;
  return (
    <div
      style={{
        background: "#ffffff",
        border: `1px solid ${tokens.borderDefault}`,
        borderRadius: 8,
        padding: "8px 10px",
        fontSize: 14,
        boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
      }}
    >
      <div style={{ fontWeight: 700, color: tokens.textPrimary }}>{d.fullName ?? d.name}</div>
      <div style={{ color: tokens.textSecondary }}>
        {d.value.toLocaleString()} {valueLabel ?? ""}
      </div>
      {d.flag && (
        <div style={{ color: tokens.textHint, marginTop: 2, fontSize: 13 }}>{d.flag}</div>
      )}
    </div>
  );
}

export function BarChartCard({ data, layout = "vertical", height = 220, valueLabel }: BarChartCardProps) {
  const isHorizontal = layout === "horizontal";
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart
        data={data}
        layout={isHorizontal ? "vertical" : "horizontal"}
        margin={{ top: 4, right: 12, bottom: 0, left: isHorizontal ? 8 : 0 }}
        barCategoryGap={isHorizontal ? "24%" : "28%"}
      >
        <CartesianGrid
          strokeDasharray="3 3"
          stroke={tokens.borderDefault}
          horizontal={!isHorizontal}
          vertical={isHorizontal}
        />
        {isHorizontal ? (
          <>
            <XAxis type="number" tick={{ fontSize: 13, fill: tokens.textMuted }} axisLine={false} tickLine={false} />
            <YAxis
              type="category"
              dataKey="name"
              width={108}
              tick={{ fontSize: 13, fill: tokens.textSecondary }}
              axisLine={false}
              tickLine={false}
            />
          </>
        ) : (
          <>
            <XAxis
              dataKey="name"
              tick={{ fontSize: 13, fill: tokens.textSecondary }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis tick={{ fontSize: 13, fill: tokens.textMuted }} axisLine={false} tickLine={false} />
          </>
        )}
        <Tooltip cursor={{ fill: "rgba(79,70,229,0.06)" }} content={<CustomTooltip valueLabel={valueLabel} />} />
        <Bar dataKey="value" radius={isHorizontal ? [0, 6, 6, 0] : [6, 6, 0, 0]} maxBarSize={38}>
          {data.map((d, i) => (
            <Cell
              key={d.name}
              fill={chartColorRotation[i % chartColorRotation.length]}
              opacity={d.flag ? 0.45 : 1}
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
