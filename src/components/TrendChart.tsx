import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { chartColorRotation, tokens } from "../lib/theme";

export interface TrendSeries {
  key: string;
  label: string;
}

interface TrendChartProps {
  data: Record<string, unknown>[];
  series: TrendSeries[];
  /** Number of px, or "100%" to fill a card that already has a definite height. */
  height?: number | string;
  unit?: string;
}

function TrendTooltip({ active, payload, label, unit }: any) {
  if (!active || !payload?.length) return null;
  const row = payload[0].payload;
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
      <div style={{ fontWeight: 700, color: tokens.textPrimary }}>{row.batch ?? label}</div>
      {payload.map((p: any) => (
        <div key={p.dataKey} style={{ color: p.stroke }}>
          {p.name}: {p.value ?? "—"}
          {p.value != null ? unit ?? "" : ""}
        </div>
      ))}
      {row.lowCoverage && (
        <div style={{ color: tokens.textHint, fontSize: 12, marginTop: 3, maxWidth: 190 }}>
          Only {row.taggedCount} of {row.total} companies tagged — thin evidence.
        </div>
      )}
      {row.partial && (
        <div style={{ color: tokens.textHint, fontSize: 12, marginTop: 3, maxWidth: 190 }}>
          Batch still filling — not a final count.
        </div>
      )}
    </div>
  );
}

export function TrendChart({ data, series, height = 170, unit = "%" }: TrendChartProps) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ top: 6, right: 10, bottom: 0, left: -18 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={tokens.borderDefault} vertical={false} />
        <XAxis
          dataKey="label"
          tick={{ fontSize: 12, fill: tokens.textMuted }}
          axisLine={false}
          tickLine={false}
          interval={0}
        />
        <YAxis tick={{ fontSize: 12, fill: tokens.textMuted }} axisLine={false} tickLine={false} />
        <Tooltip content={<TrendTooltip unit={unit} />} />
        {series.map((s, i) => (
          <Line
            key={s.key}
            type="monotone"
            dataKey={s.key}
            name={s.label}
            stroke={chartColorRotation[i % chartColorRotation.length]}
            strokeWidth={2}
            dot={{ r: 2.5 }}
            activeDot={{ r: 4.5 }}
            connectNulls={false}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}
