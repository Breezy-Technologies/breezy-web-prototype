// Signal pin colours: one colour family per kind of signal (review decision,
// replaces the colour-route exploration and its switcher).
//   Red    = alert related (price drops, …)
//   Yellow = Underbuilt
//   Green  = ROI
//   Blue   = status related (withdrawn, expired, stale, foreclosure, …)
//   Purple = Comps
// Colours match the mobile app (Figma 1455:96194): a vertical gradient from a light tint
// to the base, a 24% ink edge, a white icon. Selected is always black with a white icon. White price pills never change.
import type { OppType } from "./fake";

export type RGB = [number, number, number];
export type PinFamily = "alert" | "ub" | "roi" | "status" | "comps";
type Shade = { light: RGB; base: RGB; ring: RGB; icon: string };

export const PIN_FAMILIES: Record<PinFamily, Shade & { label: string }> = {
  // Matched to the mobile app (13 Nov, Figma "Onboarding redesign" 1455:96194): each pin is a
  // top-to-bottom gradient from a light tint to a deep base, with a white icon on every colour.
  alert: { label: "Alerts", light: [224, 143, 136], base: [195, 65, 55], ring: [18, 18, 18], icon: "rgb(253,252,252)" },
  ub: { label: "Underbuilt", light: [249, 219, 180], base: [173, 116, 10], ring: [18, 18, 18], icon: "rgb(253,252,252)" },
  roi: { label: "ROI", light: [153, 203, 177], base: [70, 155, 112], ring: [18, 18, 18], icon: "rgb(253,252,252)" },
  status: { label: "Status", light: [136, 189, 218], base: [44, 136, 181], ring: [18, 18, 18], icon: "rgb(253,252,252)" },
  comps: { label: "Comps", light: [237, 181, 207], base: [105, 76, 113], ring: [18, 18, 18], icon: "rgb(253,252,252)" },
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
    // As the mobile markers: a vertical gradient, light at the top, with a 24% ink edge.
    background: `linear-gradient(180deg, ${rgb(f.light)} 0%, ${rgb(f.base)} 100%)`,
    ring: `inset 0 0 0 ${ringW}px ${rgb(f.ring, 0.24)}`,
    icon: f.icon, rgb: f.base,
  };
}

/** Pulse ring colour (onboarding pins). */
export const pulseColor = (type: OppType, a = 0.45) => rgb(PIN_FAMILIES[familyOf(type)].base, a);
