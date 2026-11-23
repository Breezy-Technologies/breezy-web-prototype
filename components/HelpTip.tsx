"use client";
// Help tips for the create flows (agent feedback, 23 Nov): a tip stays visible until the agent
// has finished that action once, or dismisses it with "Don't show again". localStorage
// `bz-tips` = { done: [flow…], hidden: [flow…] }. Dev menu → "Reset help tips" clears it.
import { useEffect, useState } from "react";

export type TipFlow = "buyer" | "comps" | "underbuilt";
const KEY = "bz-tips";
type TipState = { done: string[]; hidden: string[] };
const read = (): TipState => { try { return { done: [], hidden: [], ...JSON.parse(localStorage.getItem(KEY) || "{}") }; } catch { return { done: [], hidden: [] }; } };
const write = (s: TipState) => { try { localStorage.setItem(KEY, JSON.stringify(s)); window.dispatchEvent(new Event("bz-tips")); } catch {} };

/** Mark a flow finished once: its tips stop showing. */
export function tipDone(f: TipFlow) { const s = read(); if (!s.done.includes(f)) write({ ...s, done: [...s.done, f] }); }
export function resetTips() { write({ done: [], hidden: [] }); }

export function useTipVisible(f: TipFlow) {
  const [on, setOn] = useState(false);
  useEffect(() => {
    const sync = () => { const s = read(); setOn(!s.done.includes(f) && !s.hidden.includes(f)); };
    sync(); window.addEventListener("bz-tips", sync);
    return () => window.removeEventListener("bz-tips", sync);
  }, [f]);
  return on;
}

export function HelpTip({ flow, children }: { flow: TipFlow; children: React.ReactNode }) {
  const on = useTipVisible(flow);
  if (!on) return null;
  return (
    <div role="note" style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: "10px 12px", borderRadius: 14, background: "rgb(240,245,249)", boxShadow: "inset 0 0 0 1px rgba(44,136,181,.18)", animation: "fadeIn .2s ease both" }}>
      <i className="ph-fill ph-lightbulb" style={{ flex: "none", fontSize: 16, lineHeight: "18px", color: "rgb(44,136,181)" }} />
      <span style={{ flex: 1, minWidth: 0, font: "400 13px/18px var(--font-sans)", color: "rgb(36,52,64)" }}>{children}</span>
      <button onClick={() => { const s = read(); write({ ...s, hidden: [...s.hidden, flow] }); }} style={{ flex: "none", height: 22, padding: "0 4px", border: "none", background: "none", cursor: "pointer", font: "700 12px/16px var(--font-sans)", color: "rgb(44,104,140)", whiteSpace: "nowrap" }}>Don’t show again</button>
    </div>
  );
}
