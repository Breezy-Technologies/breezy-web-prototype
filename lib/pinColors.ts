// Signal pin colours: one colour family per kind of signal (review decision,
// replaces the colour-route exploration and its switcher).
//   Red    = alert related (price drops, …)
//   Yellow = Underbuilt
//   Green  = ROI
//   Blue   = status related (withdrawn, expired, stale, foreclosure, …)
//   Purple = Comps
// Each circle is lit from the top (light → base) with a darker ring of its own
// shade. Selected is always black with a white icon. White price pills never change.
import type { OppType } from "./fake";

export type RGB = [number, number, number];
export type PinFamily = "alert" | "ub" | "roi" | "status" | "comps";
type Shade = { light: RGB; base: RGB; ring: RGB; icon: string };

export const PIN_FAMILIES: Record<PinFamily, Shade & { label: string }> = {
  alert: { label: "Alerts", light: [236, 104, 84], base: [214, 72, 58], ring: [172, 52, 42], icon: "rgb(253,252,252)" },
  ub: { label: "Underbuilt", light: [244, 200, 96], base: [228, 172, 62], ring: [184, 136, 44], icon: "rgb(18,18,18)" },
  roi: { label: "ROI", light: [84, 170, 104], base: [58, 144, 80], ring: [40, 106, 58], icon: "rgb(253,252,252)" },
  status: { label: "Status", light: [92, 164, 220], base: [62, 132, 192], ring: [44, 98, 146], icon: "rgb(253,252,252)" },
  comps: { label: "Comps", light: [158, 128, 184], base: [130, 101, 158], ring: [98, 74, 124], icon: "rgb(253,252,252)" },
};

export const familyOf = (t: OppType): PinFamily =>
  t === "drop" ? "alert" : t === "ub" ? "ub" : t === "roi" ? "roi" : "status";

const rgb = (c: RGB, a?: number) => (a === undefined ? `rgb(${c.join(",")})` : `rgba(${c.join(",")},${a})`);

/** Fill, ring and icon colour for a circle; `size` sets the ring width. */
export function pinFill(type: OppType | PinFamily, selected = false, size = 22) {
  const fam = (type in PIN_FAMILIES ? type : familyOf(type as OppType)) as PinFamily;
  const f = PIN_FAMILIES[fam];
  const ringW = Math.max(1.5, Math.round(size * 0.08 * 2) / 2);
  if (selected) return {
    background: "radial-gradient(circle at 50% 30%, rgb(70,66,64), rgb(18,18,18) 72%)",
    ring: `inset 0 0 0 ${ringW}px rgba(0,0,0,.55)`, icon: "rgb(253,252,252)", rgb: [18, 18, 18] as RGB,
  };
  return {
    background: `radial-gradient(circle at 50% 28%, ${rgb(f.light)} 0%, ${rgb(f.base)} 68%)`,
    ring: `inset 0 0 0 ${ringW}px ${rgb(f.ring, 0.85)}`,
    icon: f.icon, rgb: f.base,
  };
}

/** Pulse ring colour (onboarding pins). */
export const pulseColor = (type: OppType, a = 0.45) => rgb(PIN_FAMILIES[familyOf(type)].base, a);
