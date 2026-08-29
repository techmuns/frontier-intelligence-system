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
          padding: "10px 14px",
          flexShrink: 0,
        }}
      >
        <div style={{ fontSize: 13, fontWeight: 700, color: tokens.textPrimary }}>{title}</div>
        {subtitle && (
          <div style={{ fontSize: 11, color: tokens.textHint, marginTop: 1 }}>{subtitle}</div>
        )}
      </div>
      <div
        style={{
          background: tokens.cardBodyBg,
          padding: 12,
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
