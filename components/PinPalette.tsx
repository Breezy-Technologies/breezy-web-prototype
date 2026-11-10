"use client";
// Signal circles. Every coloured opportunity circle in the app (map pins, feed
// badges, cards, legends) renders through `SignalDot`, coloured by its family
// in lib/pinColors.ts: red alerts, yellow Underbuilt, green ROI, blue status,
// purple comps.
import { Listing, OPP, OppType } from "@/lib/fake";
import { pinFill, pulseColor } from "@/lib/pinColors";

// `ring` / `ringW` add an outer outline (e.g. white on the map for contrast); none by default.
// `l` is accepted for call-site compatibility (colours no longer vary per listing).
export function SignalDot({ type, size, icon, selected, ring, ringW = 0, shadow }: {
  type: OppType; size: number; icon?: number; selected?: boolean; ring?: string; ringW?: number; shadow?: string; l?: Listing;
}) {
  const f = pinFill(type, selected, size);
  const outer = ring && ringW ? `0 0 0 ${ringW}px ${ring}` : "";
  return (
    <span style={{ flex: "none", width: size, height: size, borderRadius: 9999, background: f.background, boxShadow: [f.ring, outer, shadow].filter(Boolean).join(","), display: "flex", alignItems: "center", justifyContent: "center", transition: "background .25s, width .2s, height .2s" }}>
      <i className={`ph-bold ph-${OPP[type].ic}`} style={{ fontSize: icon ?? Math.round(size * 0.52), color: f.icon }} />
    </span>
  );
}

// Pulse ring colour for a pin.
export function usePulseColor() {
  return (type: OppType, a = 0.45, _l?: Listing) => pulseColor(type, a);
}
