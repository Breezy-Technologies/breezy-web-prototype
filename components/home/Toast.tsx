"use client";
import { useCallback, useRef, useState } from "react";

// Bottom-centre toast from the canvas (`showToast`). "success" is the canvas
// green check; "info" is the neutral black info icon (sprint item: used for
// "No property found" instead of a checkmark).
export type ToastTone = "success" | "info";
type T = { text: string; tone: ToastTone; k: number };

export function useToast() {
  const [toast, setToast] = useState<T | null>(null);
  const timer = useRef<any>(null);
  const show = useCallback((text: string, tone: ToastTone = "success") => {
    clearTimeout(timer.current);
    setToast(t => ({ text, tone, k: (t?.k || 0) + 1 }));
    timer.current = setTimeout(() => setToast(null), 2800);
  }, []);
  return { toast, show };
}

export function Toast({ toast }: { toast: T | null }) {
  if (!toast) return null;
  const info = toast.tone === "info";
  return (
    <div key={toast.k} style={{ position: "fixed", left: "50%", bottom: 28, zIndex: 220, minWidth: 308, boxSizing: "border-box", display: "flex", alignItems: "center", gap: 8, height: 48, padding: "8px 16px", borderRadius: 16, background: info ? "rgb(253,252,252)" : "rgb(221,237,232)", backdropFilter: "blur(23px)", boxShadow: "inset 0 0 0 .5px rgba(13,12,12,.16),0 3px 10px rgba(0,0,0,.07)", pointerEvents: "none", animation: "bzToastIn .26s cubic-bezier(.2,.8,.2,1) both" }}>
      {info
        ? <svg width="20" height="20" viewBox="0 0 24 24" style={{ flex: "none", display: "block" }}><circle cx="12" cy="12" r="10" fill="rgb(18,18,18)" /><path d="M12 11v5.5" stroke="rgb(253,252,252)" strokeWidth="1.8" strokeLinecap="round" /><circle cx="12" cy="7.8" r="1.1" fill="rgb(253,252,252)" /></svg>
        : <svg width="20" height="20" viewBox="0 0 24 24" style={{ flex: "none", display: "block" }}><circle cx="12" cy="12" r="10" fill="rgb(49,104,89)" /><path d="M7.5 12.3l3 3 6-6.3" fill="none" stroke="rgb(221,237,232)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>}
      <span style={{ font: "400 15px/20px var(--font-sans)", color: "rgb(17,16,16)", whiteSpace: "nowrap" }}>{toast.text}</span>
    </div>
  );
}
