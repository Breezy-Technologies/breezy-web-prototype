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
  // Muted (review: the first set read too garish): same hues, lower saturation, a softer top light.
  alert: { label: "Alerts", light: [214, 128, 112], base: [192, 98, 84], ring: [160, 80, 68], icon: "rgb(253,252,252)" },
  ub: { label: "Underbuilt", light: [234, 204, 140], base: [216, 178, 104], ring: [180, 146, 82], icon: "rgb(18,18,18)" },
  roi: { label: "ROI", light: [124, 168, 132], base: [94, 144, 106], ring: [74, 116, 84], icon: "rgb(253,252,252)" },
  status: { label: "Status", light: [132, 164, 196], base: [100, 138, 176], ring: [80, 112, 144], icon: "rgb(253,252,252)" },
  comps: { label: "Comps", light: [164, 146, 184], base: [138, 118, 160], ring: [112, 94, 132], icon: "rgb(253,252,252)" },
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
    ring: `inset 0 0 0 ${ringW}px ${rgb(f.ring, 0.6)}`,
    icon: f.icon, rgb: f.base,
  };
}

/** Pulse ring colour (onboarding pins). */
export const pulseColor = (type: OppType, a = 0.45) => rgb(PIN_FAMILIES[familyOf(type)].base, a);
