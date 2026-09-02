import type { ReactNode } from "react";
import { tokens } from "../lib/theme";

interface CardProps {
  title: string;
  subtitle?: string;
  children: ReactNode;
  bodyStyle?: React.CSSProperties;
}

export function Card({ title, subtitle, children, bodyStyle }: CardProps) {
  return (
    <div
      style={{
        background: tokens.cardBackground,
        border: `1px solid ${tokens.borderDefault}`,
        borderRadius: 12,
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        minHeight: 0,
      }}
    >
      <div
        style={{
          background: tokens.cardHeader,
          borderBottom: `1px solid ${tokens.borderDefault}`,
          padding: "6px 12px",
          flexShrink: 0,
          display: "flex",
          alignItems: "baseline",
          gap: 6,
        }}
      >
        <div style={{ fontSize: 14, fontWeight: 700, color: tokens.textPrimary }}>{title}</div>
        {subtitle && <div style={{ fontSize: 12, color: tokens.textHint }}>{subtitle}</div>}
      </div>
      <div
        style={{
          background: tokens.cardBodyBg,
          padding: 8,
          flex: 1,
          minHeight: 0,
          ...bodyStyle,
        }}
      >
        {children}
      </div>
    </div>
  );
}
