"use client";
// Progress for the Create flows that run on the map (agent feedback, 23 Nov: "show a progress
// indicator, allow Back and Cancel"). New buyer search has its own wizard (BuyerWizard); these two
// happen on the map itself, so a slim bar sits at the top of the map while they run:
//   New comp               1 Subject property (search an address or click a home) → 2 Comp settings → 3 Run
//   New underbuilt report  1 Address or parcel → 2 Run report
// The help line under the steps stays until the flow has been finished once, or "Don't show again".
import { TipFlow, useTipVisible } from "../HelpTip";

export type CreateRun = { kind: "comps" | "underbuilt"; step: number };

const FLOWS: Record<CreateRun["kind"], { title: string; steps: string[]; hints: string[] }> = {
  comps: {
    title: "New comp",
    steps: ["Subject property", "Comp settings", "Run"],
    hints: ["Search the address, or click a home or parcel on the map.", "Check the home's details, then let Breezy pick the comps or pick them yourself.", "Breezy is finding and scoring the closest sales."],
  },
  underbuilt: {
    title: "New underbuilt report",
    steps: ["Address or parcel", "Run report"],
    hints: ["Search the address, or click a parcel on the map. Search an area instead to scan all its lots.", "The report shows what the zoning allows on this lot."],
  },
};

export function TaskBar({ run, left, onBack, onCancel }: { run: CreateRun; left: number; onBack?: () => void; onCancel: () => void }) {
  const f = FLOWS[run.kind];
  const tip = useTipVisible(run.kind as TipFlow);
  return (
    <div role="status" style={{ position: "fixed", top: 12, left: `calc(${left}px + (100vw - ${left}px) / 2)`, transform: "translateX(-50%)", zIndex: 95, display: "flex", flexDirection: "column", gap: 6, padding: "8px 8px 8px 16px", borderRadius: 20, background: "rgb(253,252,252)", boxShadow: "0 0 0 1px rgba(13,12,12,.1),0 10px 28px rgba(30,18,12,.16)", pointerEvents: "auto", animation: "panelDrop .25s cubic-bezier(.2,.8,.2,1) both", maxWidth: `calc(100vw - ${left + 32}px)` }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <span style={{ flex: "none", font: "700 14px/18px var(--font-sans)", color: "var(--ink)", whiteSpace: "nowrap" }}>{f.title}</span>
        <span style={{ flex: "none", width: 1, height: 20, background: "rgba(13,12,12,.12)" }} />
        <ol aria-label="Progress" style={{ display: "flex", alignItems: "center", gap: 6, margin: 0, padding: 0, listStyle: "none", minWidth: 0 }}>
          {f.steps.map((s, i) => {
            const done = i < run.step, cur = i === run.step;
            return (
              <li key={s} aria-current={cur ? "step" : undefined} style={{ display: "flex", alignItems: "center", gap: 6, whiteSpace: "nowrap" }}>
                {i > 0 && <span style={{ width: 14, height: 1.5, background: done || cur ? "var(--ink)" : "rgba(13,12,12,.16)" }} />}
                <span style={{ width: 20, height: 20, borderRadius: 9999, display: "flex", alignItems: "center", justifyContent: "center", font: "700 11px/1 var(--font-sans)", background: done || cur ? "var(--ink)" : "rgba(13,12,12,.08)", color: done || cur ? "var(--paper)" : "rgb(98,90,89)" }}>
                  {done ? <i className="ph-bold ph-check" style={{ fontSize: 11 }} /> : i + 1}
                </span>
                <span style={{ font: `${cur ? 700 : 400} 13px/18px var(--font-sans)`, color: cur || done ? "var(--ink)" : "rgb(98,90,89)" }}>{s}</span>
              </li>
            );
          })}
        </ol>
        <span style={{ flex: 1 }} />
        {onBack && <button onClick={onBack} className="btn-soft" style={{ height: 32, padding: "0 12px", font: "700 13px/18px var(--font-sans)" }}>Back</button>}
        <button onClick={onCancel} className="btn-ghost" title="Cancel" style={{ height: 32, padding: "0 12px", font: "700 13px/18px var(--font-sans)" }}>Cancel</button>
      </div>
      {tip && <span style={{ font: "400 12px/16px var(--font-sans)", color: "rgb(98,90,89)", paddingRight: 8 }}><i className="ph-fill ph-lightbulb" style={{ fontSize: 12, color: "rgb(44,136,181)", marginRight: 6 }} />{f.hints[Math.min(run.step, f.hints.length - 1)]}</span>}
    </div>
  );
}
