"use client";
// The confidence chip and Confidence details (Figma "ROI · 02 Confidence
// indicator", option D, chosen: 5 pills and the level only, node 6768:53357;
// details modal 6714:48385). The whole chip opens the details; "Based on your
// numbers" (the user's own sale price) has no details and no info icon.
import { useEffect } from "react";
import { createPortal } from "react-dom";
import { Ic } from "./Ic";
import { LEVEL_NAME, LEVEL_PILLS, type Level } from "./scenarios";

export function ConfidenceChip({ level, onOpen }: { level: Level; onOpen?: () => void }) {
  if (level === "yours") return <span className="rp-conf yours">{LEVEL_NAME.yours}</span>;
  const lit = LEVEL_PILLS[level];
  return (
    <button type="button" className="rp-conf" onClick={onOpen} aria-haspopup="dialog">
      <span className="pills" aria-hidden="true">
        {[0, 1, 2, 3, 4].map(i => <i key={i} className={i < lit ? "on" : undefined} />)}
      </span>
      {LEVEL_NAME[level]} confidence
      <Ic n="info" s={16} />
    </button>
  );
}

type Criterion = { name: string; value: string; strong: boolean };

/** What sets the level (02, "How the level is set · draft, to confirm with JD"). */
function criteria(level: Level, comps: number): Criterion[] {
  const n = `${comps} sale${comps === 1 ? "" : "s"}`;
  switch (level) {
    case "vhigh": return [
      { name: "Comparable sales", value: n, strong: true },
      { name: "Distance", value: "All within 0.5 mi", strong: true },
      { name: "Size", value: "Within ±15% of the planned build", strong: true },
      { name: "Sale date", value: "All in the last 6 months", strong: true },
    ];
    case "high": return [
      { name: "Comparable sales", value: n, strong: true },
      { name: "Distance", value: "All within 1 mi", strong: true },
      { name: "Size", value: "Within ±15% of the planned build", strong: true },
      { name: "Sale date", value: "All in the last 12 months", strong: true },
    ];
    case "med": return [
      { name: "Comparable sales", value: `${n}, fewer than usual`, strong: false },
      { name: "Distance", value: "All within 1 mi", strong: true },
      { name: "Size", value: "Within ±15% of the planned build", strong: true },
      { name: "Sale date", value: "All in the last 12 months", strong: true },
    ];
    default: return [
      { name: "Comparable sales", value: `Only ${n}`, strong: false },
      { name: "Distance", value: "Within 2 mi", strong: false },
      { name: "Size", value: "Within ±35% of the planned build", strong: false },
      { name: "Sale date", value: "All in the last 12 months", strong: true },
    ];
  }
}

export function ConfidenceDetails({ level, comps, onClose, onSetPrice }: { level: Level; comps: number; onClose: () => void; onSetPrice: () => void }) {
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); onClose(); } };
    window.addEventListener("keydown", k, true);
    return () => window.removeEventListener("keydown", k, true);
  }, [onClose]);
  return createPortal(
    <div className="bz-up rp-conf-veil" onClick={onClose}>
      <div className="rp-conf-dlg" role="dialog" aria-modal="true" aria-labelledby="conf-title" onClick={e => e.stopPropagation()}>
        <div className="top">
          <h2 id="conf-title">{LEVEL_NAME[level]} confidence</h2>
          <button type="button" className="x" onClick={onClose} aria-label="Close"><Ic n="x" s={20} /></button>
        </div>
        <p className="lede">How well nearby sales back this estimate. Four things set the level.</p>
        <div className="crit">
          {criteria(level, comps).map(c => (
            <div key={c.name}>
              <span><b>{c.name}</b><small>{c.value}</small></span>
              <em className={c.strong ? "ok" : "low"}>{c.strong ? "Strong" : "Lowers the level"}</em>
            </div>
          ))}
        </div>
        <p className="fine">Sales older than 12 months are not used.</p>
        <div className="act">
          <button type="button" className="got" onClick={onClose}>Got it</button>
          <button type="button" className="own" onClick={onSetPrice}>Set your own sale price →</button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
