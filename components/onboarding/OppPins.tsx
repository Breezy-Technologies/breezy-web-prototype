"use client";
import { MapOverlay } from "../map/Overlay";
import { useMapCtx } from "../map/MapProvider";
import { Listing, OPP } from "@/lib/fake";
import { RadarPin, radarLabel } from "../home/RadarPin";
import { ANCHOR_STYLE, useAnchors } from "../map/anchors";

// Opportunity pins used during onboarding: the market radar marker
// (components/home/RadarPin.tsx, same as Home's special pins), 25% larger here,
// with its label pill when the step shows labels. `lit` controls which are shown at full strength;
// the rest fade. The fade-in animation only fills backwards so it doesn't pin
// opacity at 1 and override the fade.
// Onboarding pins are larger than in the core app (review feedback); `pulse` turns on the
// stronger double ring used during the radar scan and the personalisation step.
export function OppPins({ items, shown, lit, selId, onPick, labels, delay, pulse }: { items: Listing[]; shown: (l: Listing, i: number) => boolean; lit?: (l: Listing) => boolean; selId?: number | null; onPick?: (l: Listing) => void; labels?: boolean; delay?: (l: Listing) => number; pulse?: boolean }) {
  // Anchored like the price pins (components/map/anchors.ts): they move in the
  // same frame as the map, so they don't swim during the scan's camera moves.
  const { map } = useMapCtx();
  const anchor = useAnchors();
  if (!map) return null;
  return (
    <MapOverlay>
      {items.map((l, i) => {
        if (!shown(l, i)) return null;
        const on = lit ? lit(l) : true, sel = selId === l.id;
        return (
          <div key={l.id} ref={anchor(l.id, [l.lng, l.lat])} style={{ ...ANCHOR_STYLE, zIndex: sel ? 30 : 20 }}>
          <button onClick={e => { e.stopPropagation(); onPick?.(l); }}
            style={{ position: "absolute", left: 0, top: 0, transform: labels && on ? "translate(-50%,calc(-100% + 12px))" : "translate(-50%,-100%)", display: "flex", alignItems: "center", gap: 6, padding: 0, border: "none", background: "none", cursor: onPick ? "pointer" : "default", pointerEvents: "auto", opacity: on ? 1 : 0.3, filter: on ? "none" : "saturate(.4)", transition: "opacity .3s, filter .3s", animation: delay ? `wavePop .55s cubic-bezier(.2,.8,.2,1) ${delay(l)}ms backwards` : "fadeIn .35s ease backwards" }}>
            <span style={{ display: "flex", transform: "scale(1.25)", transformOrigin: "50% 100%" }}>
              <RadarPin l={l} kind={l.opp} label={labels && on ? radarLabel(l) : ""} dark={sel} pulse={on && !sel} />
            </span>
          </button>
          </div>
        );
      })}
    </MapOverlay>
  );
}
