import {
  CartesianGrid,
  Legend,
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
        background: tokens.tooltipBg,
        border: `1px solid ${tokens.borderDefault}`,
        borderRadius: 8,
        padding: "8px 10px",
        fontSize: 14,
        boxShadow: tokens.tooltipShadow,
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
  // A legend whenever there is more than one line. Without it a reader sees
  // three coloured lines and has no way to learn which is which — the chart
  // becomes decoration. A single series needs none: the card title names it.
  const showLegend = series.length > 1;
  // Three entries will not fit on one line in a narrow column, so reserve two.
  // Reserving one made the second line land on top of the top y-axis label.
  const legendLines = series.length > 2 ? 2 : 1;
  const legendHeight = legendLines * 20 + 6;
  // interval={0} forced every batch label to render, and sixteen of them
  // collided into an unreadable smear ("W22Su22W23Su23"). Recharts drops
  // labels as needed with this, always keeping the first and last.
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ top: showLegend ? legendHeight + 8 : 8, right: 12, bottom: 4, left: -18 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={tokens.grid} vertical={false} />
        <XAxis
          dataKey="label"
          tick={{ fontSize: 12, fill: tokens.textMuted }}
          axisLine={false}
          tickLine={false}
          interval="preserveStartEnd"
          minTickGap={18}
        />
        <YAxis tick={{ fontSize: 12, fill: tokens.textMuted }} axisLine={false} tickLine={false} />
        <Tooltip content={<TrendTooltip unit={unit} />} />
        {showLegend && (
          <Legend
            verticalAlign="top"
            align="left"
            height={legendHeight}
            layout="horizontal"
            iconType="plainline"
            iconSize={14}
            wrapperStyle={{ fontSize: 12, color: tokens.textSecondary, paddingLeft: 26, lineHeight: "18px" }}
          />
        )}
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
