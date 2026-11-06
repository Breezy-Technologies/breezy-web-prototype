"use client";
import { useCallback, useRef, useState } from "react";

// Bottom-centre snackbar from the canvas (`showToast`, `toastText`, `bzToastIn`).
// Three tones:
//   positive — the canvas green check on a soft green fill ("success" is kept as an alias),
//   neutral  — the black info icon on paper (sprint item: "No property found"; alias "info"),
//   negative — a red exclamation on a soft red fill, for failures ("error" alias).
export type ToastTone = "positive" | "neutral" | "negative" | "success" | "info" | "error";
type Kind = "positive" | "neutral" | "negative";
type T = { text: string; tone: Kind; k: number };
const norm = (t: ToastTone): Kind => (t === "success" ? "positive" : t === "info" ? "neutral" : t === "error" ? "negative" : t);

export function useToast() {
  const [toast, setToast] = useState<T | null>(null);
  const timer = useRef<any>(null);
  const show = useCallback((text: string, tone: ToastTone = "positive") => {
    clearTimeout(timer.current);
    const kind = norm(tone);
    setToast(t => ({ text, tone: kind, k: (t?.k || 0) + 1 }));
    // Errors stay up a little longer so they can be read.
    timer.current = setTimeout(() => setToast(null), kind === "negative" ? 4200 : 2800);
  }, []);
  return { toast, show };
}

const TONE: Record<Kind, { bg: string; fg: string }> = {
  positive: { bg: "rgb(221,237,232)", fg: "rgb(17,16,16)" },
  neutral: { bg: "rgb(253,252,252)", fg: "rgb(17,16,16)" },
  negative: { bg: "rgb(248,229,225)", fg: "rgb(17,16,16)" },
};

export function ToastIcon({ tone, size = 20 }: { tone: Kind; size?: number }) {
  const s = { flex: "none", display: "block" } as const;
  if (tone === "neutral") return <svg width={size} height={size} viewBox="0 0 24 24" style={s}><circle cx="12" cy="12" r="10" fill="rgb(18,18,18)" /><path d="M12 11v5.5" stroke="rgb(253,252,252)" strokeWidth="1.8" strokeLinecap="round" /><circle cx="12" cy="7.8" r="1.1" fill="rgb(253,252,252)" /></svg>;
  if (tone === "negative") return <svg width={size} height={size} viewBox="0 0 24 24" style={s}><circle cx="12" cy="12" r="10" fill="rgb(180,52,40)" /><path d="M12 6.8v6.2" stroke="rgb(253,252,252)" strokeWidth="1.8" strokeLinecap="round" /><circle cx="12" cy="16.4" r="1.1" fill="rgb(253,252,252)" /></svg>;
  return <svg width={size} height={size} viewBox="0 0 24 24" style={s}><circle cx="12" cy="12" r="10" fill="rgb(49,104,89)" /><path d="M7.5 12.3l3 3 6-6.3" fill="none" stroke="rgb(221,237,232)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}

export function Toast({ toast }: { toast: T | null }) {
  if (!toast) return null;
  const c = TONE[toast.tone];
  return (
    <div key={toast.k} role={toast.tone === "negative" ? "alert" : "status"} style={{ position: "fixed", left: "50%", bottom: 28, zIndex: 220, minWidth: 308, boxSizing: "border-box", display: "flex", alignItems: "center", gap: 8, height: 48, padding: "8px 16px", borderRadius: 16, background: c.bg, backdropFilter: "blur(23px)", boxShadow: "inset 0 0 0 .5px rgba(13,12,12,.16),0 3px 10px rgba(0,0,0,.07)", pointerEvents: "none", animation: "bzToastIn .26s cubic-bezier(.2,.8,.2,1) both" }}>
      <ToastIcon tone={toast.tone} />
      <span style={{ font: "400 15px/20px var(--font-sans)", color: c.fg, whiteSpace: "nowrap" }}>{toast.text}</span>
    </div>
  );
}
