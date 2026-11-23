"use client";
// The first web screen after the scan-to-link handoff (app/login → /home), per trial state
// (lib/handoff/profile.ts):
// - every state: a short walkthrough of the map (search, feed, signal pins, price pins,
//   heat layer, saved homes), on the Coach overlay used by Make Breezy yours;
// - dismissed: property panels are gated (the trial offer opens when a result is pressed)
//   and a slim "trial still available" banner sits over the map;
// - active: "Welcome back · day 4 of 14", a 3-item desk checklist, one tooltip on the
//   first property panel;
// - subscribed_apple: no checkout anywhere (components/billing: the App Store sheet).
import React, { useState } from "react";
import { CoachStep } from "@/components/home/GetStarted";
import { DESK_TASKS, HandoffState, TrialState, deskDone, handoffProfile } from "@/lib/handoff/profile";
import { paywall } from "@/lib/billing";

const INK = "rgb(18,18,18)", MUTED = "rgb(98,90,89)", PAPER = "rgb(253,252,252)";

/** Walkthrough steps, one at a time (the Coach shows the first visible target). */
export function tourSteps(trial: TrialState, nSaved: number): Omit<CoachStep, "onNext" | "count">[] {
  return [
    { sel: `[data-tour="search-field"]`, title: "Search anywhere", sub: "A city, ZIP or address. You're on Silver Lake, the area you last searched on your phone." },
    { sel: `[data-tour="home-card"]`, title: "Your feed, from the app", sub: "Opportunities Breezy found around you, newest first. Same feed, same read state as your iPhone." },
    { sel: `[data-pin-kind="radar"]`, title: "Signal pins", sub: "Coloured markers are opportunities: price drops, expired or withdrawn listings, underbuilt lots, high ROI. The label says why." },
    { sel: `[data-pin-kind="price"]`, title: "Price pins", sub: "Every other home. The letter is its status (A active, P pending, S sold), then the price. Hover any pin for a preview." },
    { sel: `[data-tour="layers"]`, title: "Heat map", sub: "Colour the map by ROI or Underbuilt to see where the upside is, block by block. Free on every plan." },
    { sel: `[data-tour="tab-Properties"]`, title: "Saved on your phone", sub: `The ${nSaved} homes you saved on your iPhone are here and on the map.`,
      next: trial === "dismissed" ? "Start exploring" : "Done" },
  ];
}

/** dismissed: "Your 14-day free trial is still available". */
export function TrialBanner({ days, left, right }: { days: number; left: number; right: number }) {
  return (
    <div style={{ position: "absolute", left, right, bottom: 20, display: "flex", justifyContent: "center", pointerEvents: "none" }}>
      <div role="region" aria-label="Free trial" style={{ display: "flex", alignItems: "center", gap: 12, height: 44, padding: "0 6px 0 16px", borderRadius: 9999, background: INK, boxShadow: "0 10px 28px rgba(18,15,14,.28)", pointerEvents: "auto", animation: "bzToastIn .35s cubic-bezier(.2,.8,.2,1) both" }}>
        <i className="ph-fill ph-sparkle" style={{ fontSize: 16, color: "rgb(255,209,41)" }} />
        <span style={{ font: "400 14px/18px var(--font-sans)", color: PAPER, whiteSpace: "nowrap" }}>Your {days}-day free trial is still available</span>
        <button onClick={() => paywall.open({ kind: "offer" })} style={{ height: 32, padding: "0 14px", border: "none", borderRadius: 9999, background: PAPER, font: "700 13px/16px var(--font-sans)", color: INK, cursor: "pointer", whiteSpace: "nowrap" }}>Start free trial</button>
      </div>
    </div>
  );
}

/** active: three things that are better at a desk, under the Home card's tabs. */
export function DeskChecklist({ hs }: { hs: HandoffState }) {
  const [open, setOpen] = useState(true);
  const done = deskDone(hs);
  const n = Object.values(done).filter(Boolean).length;
  if (n === DESK_TASKS.length) return null;
  return (
    <div style={{ borderRadius: 18, background: "rgb(248,245,243)", padding: open ? "12px 14px 6px" : "10px 14px", animation: "fadeIn .3s ease both" }}>
      <button onClick={() => setOpen(o => !o)} aria-expanded={open} style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", padding: 0, border: "none", background: "none", cursor: "pointer", textAlign: "left" }}>
        <i className="ph-bold ph-desktop" style={{ fontSize: 16, color: INK }} />
        <span style={{ flex: 1, font: "700 13px/18px var(--font-sans)", color: INK }}>Best done at your desk</span>
        <span style={{ font: "400 12px/16px var(--font-sans)", color: MUTED }}>{n} of {DESK_TASKS.length}</span>
        <i className={`ph-bold ph-caret-${open ? "up" : "down"}`} style={{ fontSize: 12, color: MUTED }} />
      </button>
      {open && DESK_TASKS.map(t => {
        const ok = done[t.k];
        return (
          <div key={t.k} style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: "8px 0", borderTop: "1px solid rgba(18,18,18,.06)", marginTop: 8 }}>
            <span style={{ flex: "none", width: 22, height: 22, marginTop: 1, borderRadius: 9999, display: "flex", alignItems: "center", justifyContent: "center", background: ok ? "rgb(49,140,96)" : PAPER, boxShadow: ok ? "none" : "inset 0 0 0 1.5px rgba(18,18,18,.18)" }}>
              {ok ? <i className="ph-bold ph-check" style={{ fontSize: 12, color: "#fff" }} /> : <i className={`ph-bold ph-${t.icon}`} style={{ fontSize: 11, color: MUTED }} />}
            </span>
            <span style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
              <span style={{ font: "700 13px/18px var(--font-sans)", color: ok ? MUTED : INK, textDecoration: ok ? "line-through" : "none" }}>
                {t.title}{t.k === "roi" && !ok && hs.desk.roi.length === 1 ? " · 1 of 2" : ""}
              </span>
              {!ok && <span style={{ font: "400 12px/16px var(--font-sans)", color: MUTED }}>{t.sub}</span>}
            </span>
          </div>
        );
      })}
    </div>
  );
}

/** active: one tooltip on the first property panel opened after the walkthrough. */
export const firstPanelTip: Omit<CoachStep, "onNext"> = {
  sel: `[data-tour="get-comps"]`, title: "Start with comps", sub: "Comps are roomier here: pick and exclude comps, then export a client-ready report. It ticks off your first desk task.",
  next: "Got it", exit: "Skip",
};

export const endTip = () => handoffProfile.endTip();
