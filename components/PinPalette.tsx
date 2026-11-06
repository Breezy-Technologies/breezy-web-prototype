"use client";
// Special-pin colour exploration: `SignalDot` (every yellow circle in the app
// renders through it) and `PinRouteSwitcher` (floating prototype control to
// compare the colour routes, with the ramp and the rationale).
import { useState } from "react";
import { OPP, OppType } from "@/lib/fake";
import { PIN_ROUTES, pinFill, rampCss, routeOrder, setPinRoute, usePinRoute } from "@/lib/pinColors";

export function SignalDot({ type, size, icon, selected, ring = "rgb(18,18,18)", ringW = 1.5, shadow }: {
  type: OppType; size: number; icon?: number; selected?: boolean; ring?: string; ringW?: number; shadow?: string;
}) {
  const route = usePinRoute();
  const f = pinFill(type, route, selected);
  return (
    <span style={{ flex: "none", width: size, height: size, borderRadius: 9999, background: f.background, boxShadow: `0 0 0 ${ringW}px ${ring}${shadow ? "," + shadow : ""}, inset 0 -1px 2px rgba(0,0,0,.12)`, display: "flex", alignItems: "center", justifyContent: "center", transition: "background .25s, width .2s, height .2s" }}>
      <i className={`ph-bold ph-${OPP[type].ic}`} style={{ fontSize: icon ?? Math.round(size * 0.52), color: f.icon }} />
    </span>
  );
}

// Pulse ring colour for a pin under the current route.
export function usePulseColor() {
  const route = usePinRoute();
  return (type: OppType, a = 0.45) => `rgba(${pinFill(type, route).rgb.join(",")},${a})`;
}

export function PinRouteSwitcher({ style }: { style?: React.CSSProperties }) {
  const route = usePinRoute();
  const [open, setOpen] = useState(false);
  const cur = PIN_ROUTES.find(r => r.k === route)!;
  return (
    <div style={{ position: "fixed", zIndex: 70, display: "flex", flexDirection: "column", gap: 8, alignItems: "flex-start", pointerEvents: "auto", ...style }}>
      {open && (
        <div style={{ width: 290, display: "flex", flexDirection: "column", gap: 10, padding: 14, borderRadius: 18, background: "var(--paper)", boxShadow: "0 0 0 .5px rgba(13,12,12,.12),0 14px 34px rgba(30,18,12,.18)", animation: "panelDrop .2s cubic-bezier(.2,.8,.2,1) both" }}>
          <span style={{ font: "700 12px/16px var(--font-sans)", letterSpacing: ".06em", textTransform: "uppercase", color: "rgb(129,117,111)" }}>Pin colour route</span>
          <div style={{ display: "flex", gap: 4, padding: 3, borderRadius: 9999, background: "rgba(13,12,12,.06)" }}>
            {PIN_ROUTES.map(r => (
              <button key={r.k} onClick={() => setPinRoute(r.k)} style={{ flex: 1, height: 30, border: "none", borderRadius: 9999, cursor: "pointer", font: "700 12px/16px var(--font-sans)", whiteSpace: "nowrap", background: route === r.k ? "var(--ink)" : "none", color: route === r.k ? "var(--paper)" : "var(--ink)" }}>{r.lb}</button>
            ))}
          </div>
          <span style={{ font: "400 12px/17px var(--font-sans)", color: "var(--fg-2)" }}>{cur.sub}</span>
          {route !== "yellow" && <span style={{ height: 8, borderRadius: 9999, background: rampCss(route) }} />}
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {routeOrder(route).map((t, i, a) => (
              <div key={t} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <SignalDot type={t} size={24} />
                <span style={{ flex: 1, font: "400 13px/18px var(--font-sans)" }}>{OPP[t].lb}</span>
                {route === "heat" && (i === 0 || i === a.length - 1) && <span style={{ font: "700 11px/14px var(--font-sans)", color: "var(--fg-3)" }}>{i === 0 ? "HOT" : "COLD"}</span>}
              </div>
            ))}
          </div>
          {route === "heat" && <span style={{ font: "400 11px/15px var(--font-sans)", color: "var(--fg-3)" }}>Price drop = active listing that just changed · ROI / Underbuilt = live opportunities · Stale = active but stagnant · Expired / Withdrawn = off the market.</span>}
        </div>
      )}
      <button onClick={() => setOpen(o => !o)} title="Pin colour route" style={{ display: "flex", alignItems: "center", gap: 8, height: 34, padding: "0 12px 0 6px", border: "none", borderRadius: 9999, background: "var(--paper)", boxShadow: "0 0 0 .5px rgba(13,12,12,.12),0 6px 16px rgba(30,18,12,.14)", cursor: "pointer", font: "700 12px/16px var(--font-sans)", color: "var(--ink)" }}>
        <span style={{ width: 22, height: 22, borderRadius: 9999, background: route === "yellow" ? pinFill("ub", "yellow").background : rampCss(route) }} />
        Pins: {cur.lb}
        <i className={`ph-bold ph-caret-${open ? "down" : "up"}`} style={{ fontSize: 11 }} />
      </button>
    </div>
  );
}
