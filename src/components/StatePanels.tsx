import { tokens } from "../lib/theme";

const base: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  textAlign: "center",
  padding: 20,
  gap: 6,
  height: "100%",
  minHeight: 90,
};

export function LoadingState({ label = "Loading…" }: { label?: string }) {
  return (
    <div style={base}>
      <div
        style={{
          width: 18,
          height: 18,
          borderRadius: "50%",
          border: `2px solid ${tokens.primaryBorder}`,
          borderTopColor: tokens.primary,
          animation: "frontier-spin 0.7s linear infinite",
        }}
      />
      <div style={{ fontSize: 14, color: tokens.textHint }}>{label}</div>
    </div>
  );
}

export function EmptyState({ message, hint }: { message: string; hint?: string }) {
  return (
    <div style={base}>
      <div style={{ fontSize: 14, fontWeight: 600, color: tokens.textMuted }}>{message}</div>
      {hint && <div style={{ fontSize: 13, color: tokens.textHint }}>{hint}</div>}
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div style={base}>
      <div
        style={{
          width: 26,
          height: 26,
          borderRadius: "50%",
          background: tokens.errorBg,
          color: tokens.errorRed,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 17,
          fontWeight: 700,
        }}
      >
        !
      </div>
      <div style={{ fontSize: 14, fontWeight: 600, color: tokens.textSecondary }}>{message}</div>
      {onRetry && (
        <button
          onClick={onRetry}
          style={{
            fontSize: 13,
            fontWeight: 600,
            color: tokens.primaryText,
            background: tokens.primaryLight,
            border: `1px solid ${tokens.primaryBorder}`,
            borderRadius: 6,
            padding: "4px 10px",
            cursor: "pointer",
          }}
        >
          Retry
        </button>
      )}
    </div>
  );
}

export function WaitingForSession() {
  return (
    <div style={{ padding: 16, textAlign: "center", color: tokens.textHint, fontSize: 14 }}>
      Waiting for session…
    </div>
  );
}
