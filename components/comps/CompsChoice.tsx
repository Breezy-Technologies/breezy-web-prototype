"use client";
// The choice before comps open (brought back from the report sheet's "Let AI do the
// work" stage, as a modal over the map): the AI picks the strongest comps, or the agent
// comps by hand. "Get comps" runs by itself after AUTO_MS unless the pointer rests on
// it (the fill shows the countdown and pauses with it). Escape / the backdrop cancel.
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

const AUTO_MS = 6700;

export function CompsChoice({ addr, onAi, onManual, onCancel }: { addr: string; onAi: () => void; onManual: () => void; onCancel: () => void }) {
  const [paused, setPaused] = useState(false);
  const left = useRef(AUTO_MS), at = useRef(0);
  const done = useRef(false);
  const go = (f: () => void) => { if (done.current) return; done.current = true; f(); };
  useEffect(() => {
    if (paused) return;
    at.current = Date.now();
    const t = setTimeout(() => go(onAi), left.current);
    return () => { clearTimeout(t); left.current = Math.max(0, left.current - (Date.now() - at.current)); };
  }, [paused]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); go(onCancel); } };
    window.addEventListener("keydown", k, true);
    return () => window.removeEventListener("keydown", k, true);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return createPortal(
    <div onClick={() => go(onCancel)} style={{ position: "fixed", inset: 0, zIndex: 400, background: "rgba(23,17,16,.28)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16, animation: "fadeIn .2s ease both" }}>
      <style>{`@keyframes ccFill{from{transform:scaleX(0)}to{transform:scaleX(1)}}`}</style>
      <div role="dialog" aria-label="How do you want to comp?" onClick={e => e.stopPropagation()}
        style={{ position: "relative", width: 520, maxWidth: "100%", display: "flex", flexDirection: "column", alignItems: "center", gap: 24, padding: "36px 32px 32px", borderRadius: 28, background: "rgb(253,252,252)", boxShadow: "0 24px 60px rgba(30,18,12,.22)", animation: "riseIn .26s cubic-bezier(.2,.8,.2,1) both" }}>
        <button onClick={() => go(onCancel)} aria-label="Close" className="btn-ghost" style={{ position: "absolute", right: 16, top: 16, width: 36, height: 36, display: "flex", alignItems: "center", justifyContent: "center" }}><i className="ph-bold ph-x" /></button>
        <span style={{ flex: "none", width: 120, height: 120, borderRadius: 8, background: "url('/iso/sparkle.gif') center/cover no-repeat" }} />
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10, textAlign: "center" }}>
          <span style={{ font: "300 34px/42px var(--font-sans)", letterSpacing: "-.01em", color: "rgb(17,16,16)" }}>Let AI do the work</span>
          <span style={{ maxWidth: 400, font: "400 16px/22px var(--font-sans)", color: "rgb(77,71,69)", textWrap: "balance" } as React.CSSProperties}>
            Get the strongest comps our data suggests for <b style={{ fontWeight: 700, color: "rgb(17,16,16)" }}>{addr}</b>. You can refine them after.
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", justifyContent: "center" }}>
          <button onClick={() => go(onManual)} className="btn-soft" style={{ width: 200, height: 48, padding: "0 20px", border: "none", borderRadius: 9999, background: "rgb(245,240,238)", font: "700 15px/20px var(--font-sans)", color: "rgb(17,16,16)", cursor: "pointer", whiteSpace: "nowrap" }}>I&apos;ll comp myself</button>
          <button onClick={() => go(onAi)} onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}
            style={{ position: "relative", width: 200, height: 48, overflow: "hidden", border: "none", borderRadius: 9999, background: "rgb(18,18,18)", font: "700 15px/20px var(--font-sans)", color: "rgb(253,252,252)", cursor: "pointer", whiteSpace: "nowrap" }}>
            {/* auto-run countdown fill */}
            <span style={{ position: "absolute", inset: 0, transformOrigin: "0 50%", background: "linear-gradient(89.442deg,rgb(84,55,157) 0.06%,rgb(142,67,158) 97.94%)", animation: `ccFill ${AUTO_MS}ms linear both`, animationPlayState: paused ? "paused" : "running" }} />
            <span style={{ position: "relative", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0c.8 6.4 5.6 11.2 12 12-6.4.8-11.2 5.6-12 12-.8-6.4-5.6-11.2-12-12C6.4 11.2 11.2 6.4 12 0z" /></svg>Get comps
            </span>
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
