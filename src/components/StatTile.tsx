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
        padding: "7px 12px",
        display: "flex",
        alignItems: "center",
        gap: 10,
      }}
    >
      <div
        style={{
          flexShrink: 0,
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: 0.3,
          textTransform: "uppercase",
          color: c.text,
          background: c.bg,
          border: `1px solid ${c.border}`,
          borderRadius: 999,
          padding: "2px 7px",
        }}
      >
        {label}
      </div>
      <div style={{ fontSize: 20, fontWeight: 700, color: tokens.textPrimary, lineHeight: 1.1 }}>
        {value}
      </div>
      {hint && (
        <div style={{ fontSize: 12, color: tokens.textHint, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          {hint}
        </div>
      )}
    </div>
  );
}
