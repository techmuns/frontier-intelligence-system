import { tokens, categoryColors, type CategoryKey } from "../lib/theme";

interface StatTileProps {
  label: string;
  value: string;
  category: CategoryKey;
  hint?: string;
}

export function StatTile({ label, value, category, hint }: StatTileProps) {
  const c = categoryColors[category];
  return (
    <div
      style={{
        flex: "1 1 0",
        minWidth: 130,
        background: tokens.cardBackground,
        border: `1px solid ${tokens.borderDefault}`,
        borderRadius: 10,
        padding: "12px 14px",
      }}
    >
      <div
        style={{
          display: "inline-block",
          fontSize: 10,
          fontWeight: 700,
          letterSpacing: 0.4,
          textTransform: "uppercase",
          color: c.text,
          background: c.bg,
          border: `1px solid ${c.border}`,
          borderRadius: 999,
          padding: "2px 8px",
          marginBottom: 8,
        }}
      >
        {label}
      </div>
      <div style={{ fontSize: 24, fontWeight: 700, color: tokens.textPrimary, lineHeight: 1.1 }}>
        {value}
      </div>
      {hint && (
        <div style={{ fontSize: 11, color: tokens.textHint, marginTop: 4 }}>{hint}</div>
      )}
    </div>
  );
}
