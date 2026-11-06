"use client";
import { MapOverlay } from "../map/Overlay";
import { useMapCtx } from "../map/MapProvider";
import { Listing, OPP } from "@/lib/fake";
import { SignalDot, usePulseColor } from "../PinPalette";

// Opportunity pins used during onboarding: a yellow disc with the type icon,
// ringed in the type colour. `lit` controls which are shown at full strength;
// the rest fade. The fade-in animation only fills backwards so it doesn't pin
// opacity at 1 and override the fade.
// Onboarding pins are larger than in the core app (review feedback); `pulse` turns on the
// stronger double ring used during the radar scan and the personalisation step.
export function OppPins({ items, shown, lit, selId, onPick, labels, delay, pulse }: { items: Listing[]; shown: (l: Listing, i: number) => boolean; lit?: (l: Listing) => boolean; selId?: number | null; onPick?: (l: Listing) => void; labels?: boolean; delay?: (l: Listing) => number; pulse?: boolean }) {
  const { map, tick } = useMapCtx();
  const pc = usePulseColor();
  void tick;
  if (!map) return null;
  return (
    <MapOverlay>
      {items.map((l, i) => {
        if (!shown(l, i)) return null;
        const p = map.project([l.lng, l.lat]);
        const on = lit ? lit(l) : true, sel = selId === l.id;
        return (
          <button key={l.id} onClick={e => { e.stopPropagation(); onPick?.(l); }}
            style={{ position: "absolute", left: p.x, top: p.y, transform: "translate(-50%,-50%)", zIndex: sel ? 30 : 20, display: "flex", alignItems: "center", gap: 6, padding: 0, border: "none", background: "none", cursor: onPick ? "pointer" : "default", pointerEvents: "auto", opacity: on ? 1 : 0.3, filter: on ? "none" : "saturate(.4)", transition: "opacity .3s, filter .3s", animation: delay ? `wavePop .55s cubic-bezier(.2,.8,.2,1) ${delay(l)}ms backwards` : "fadeIn .35s ease backwards" }}>
            <span style={{ position: "relative", width: 48, height: 48, display: "flex", alignItems: "center", justifyContent: "center" }}>
              {on && !sel && <span style={{ position: "absolute", inset: 6, borderRadius: 9999, background: pc(l.opp, pulse ? 0.6 : 0.4), animation: `pulse ${pulse ? 1.8 : 2.4}s ease-out infinite` }} />}
              {on && !sel && pulse && <span style={{ position: "absolute", inset: 6, borderRadius: 9999, background: pc(l.opp, 0.45), animation: "pulse 1.8s ease-out .9s infinite" }} />}
              <span style={{ position: "relative", display: "flex" }}>
                <SignalDot type={l.opp} size={sel ? 44 : 38} icon={sel ? 21 : 19} selected={sel} ring="rgb(253,252,252)" ringW={2.5} shadow="0 6px 14px rgba(30,18,12,.28)" />
              </span>
            </span>
            {labels && on && <span style={{ height: 26, padding: "0 10px", borderRadius: 9999, background: "var(--paper)", boxShadow: "0 4px 10px rgba(30,18,12,.18)", font: "700 12px/26px var(--font-sans)", whiteSpace: "nowrap" }}>{l.oppWhy.split(" · ")[0]}</span>}
          </button>
        );
      })}
    </MapOverlay>
  );
}
