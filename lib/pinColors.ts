"use client";
// Special-pin colour routes (the yellow opportunity circles only; white price
// pills don't change). Three routes so the team can compare:
//  - "yellow": today's single Breezy yellow for every type (baseline).
//  - "heat":   hot → cold by how active the listing is. A price drop is an
//              active listing that just changed (hottest); ROI and Underbuilt
//              are live opportunities; a stale listing is active but stagnant;
//              expired and withdrawn have left the market (coldest). Colours
//              run along one hue path from a hot red-orange to a cold blue.
//  - "brand":  arbitrary order, ranging from Breezy yellow to deep clay.
// Every circle gets a light gradient of its shade for extra pop. Selected
// state is always black with a white icon.
import { useEffect, useState } from "react";
import { heatColorOf, heatColors, heatPct } from "./heat";
import type { Listing, OppType } from "./fake";

export type PinRoute = "yellow" | "heat" | "brand" | "family" | "fresh" | "familyFresh" | "upside" | "layer";
export const PIN_ROUTES: { k: PinRoute; lb: string; sub: string }[] = [
  { k: "yellow", lb: "Yellow", sub: "One colour for every type" },
  { k: "heat", lb: "Hot → cold", sub: "Most active listing to least active" },
  { k: "brand", lb: "Brand range", sub: "Breezy yellow to clay" },
  { k: "family", lb: "Seller vs value", sub: "Warm = call the owner (seller signals). Cool = pitch the upside (value signals). Shade = urgency." },
  { k: "fresh", lb: "Freshness", sub: "Per pin: vivid when the signal is new, fading as it ages. The icon still tells the type." },
  { k: "familyFresh", lb: "Family + freshness", sub: "Seller / value colour, with strength set by how recent the signal is." },
  { k: "upside", lb: "Upside $", sub: "Per pin: shaded by estimated profit, from small (pale) to big (deep green)." },
  { k: "layer", lb: "Match heat layer", sub: "Per pin: the ROI heat-map colour under the pin, so pins and hexes share one scale." },
];
// Routes coloured per pin (need the listing); others are per type.
export const PER_PIN: PinRoute[] = ["fresh", "familyFresh", "upside", "layer"];

// Hot → cold order and brand order.
export const HEAT_ORDER: OppType[] = ["drop", "roi", "ub", "stale", "exp", "wd"];
const BRAND_ORDER: OppType[] = ["ub", "roi", "drop", "stale", "exp", "wd"];

type RGB = [number, number, number];
const hsl = (h: number, s: number, l: number): RGB => {
  s /= 100; l /= 100;
  const k = (n: number) => (n + h / 30) % 12, a = s * Math.min(l, 1 - l);
  const f = (n: number) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return [Math.round(f(0) * 255), Math.round(f(8) * 255), Math.round(f(4) * 255)];
};
const mix = (a: RGB, b: RGB, t: number): RGB => [0, 1, 2].map(i => Math.round(a[i] + (b[i] - a[i]) * t)) as RGB;
const YELLOW: RGB = [255, 209, 41];

// Heat: hue 10° (hot red-orange) → 215° (cold blue), going through amber/green.
export const HEAT_HOT = hsl(10, 82, 58), HEAT_COLD = hsl(215, 55, 58);
const heatAt = (t: number) => hsl(10 + 205 * t, 82 - 27 * t, 58);
// Brand: Breezy yellow → deep clay rgb(147,89,75) (via clay rgb(175,127,113)).
export const BRAND_FROM = YELLOW, BRAND_TO: RGB = [147, 89, 75];
const brandAt = (t: number) => (t < 0.5 ? mix(YELLOW, [214, 150, 92], t * 2) : mix([214, 150, 92], BRAND_TO, (t - 0.5) * 2));

// Seller signals (warm, by urgency) vs value signals (cool).
const SELLER: OppType[] = ["drop", "stale", "exp", "wd"], VALUE: OppType[] = ["roi", "ub"];
const SELLER_RGB: RGB[] = [[230, 92, 52], [236, 140, 64], [238, 182, 84], [226, 204, 150]];
const VALUE_RGB: RGB[] = [[40, 146, 136], [118, 176, 128]];
const familyRGB = (t: OppType): RGB => (VALUE.includes(t) ? VALUE_RGB[VALUE.indexOf(t)] : SELLER_RGB[Math.max(0, SELLER.indexOf(t))]);
export const isValueSignal = (t: OppType) => VALUE.includes(t);
// Freshness 1 (new) → 0 (old); days on market stands in for signal age in the fake data.
export const freshness = (l?: Listing) => (l ? Math.max(0, Math.min(1, 1 - l.dom / 150)) : 0.8);
const FADED: RGB = [228, 222, 212];
const UP_LO: RGB = [244, 230, 176], UP_HI: RGB = [24, 128, 88];
const upsideT = (l?: Listing) => (l ? Math.max(0, Math.min(1, ((l.price * l.roi) / 100 - 300000) / 1700000)) : 0.55);
// The ROI heat colour under the pin, from the same scale as the hexes and parcels.
const layerRGB = (l?: Listing): RGB => {
  const h = heatColorOf("roi", l ? heatPct("roi", l.lng, l.lat) : 20, heatColors("roi"));
  return [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16)) as RGB;
};

export function pinRGB(type: OppType, route: PinRoute, l?: Listing): RGB {
  if (route === "family") return familyRGB(type);
  if (route === "fresh") return mix(FADED, [255, 186, 20], freshness(l));
  if (route === "familyFresh") return mix(FADED, familyRGB(type), 0.25 + 0.75 * freshness(l));
  if (route === "upside") return mix(UP_LO, UP_HI, upsideT(l));
  if (route === "layer") return layerRGB(l);
  if (route === "heat") return heatAt(Math.max(0, HEAT_ORDER.indexOf(type)) / (HEAT_ORDER.length - 1));
  if (route === "brand") return brandAt(Math.max(0, BRAND_ORDER.indexOf(type)) / (BRAND_ORDER.length - 1));
  return YELLOW;
}
export const rampCss = (route: PinRoute) => {
  const g = (a: RGB, b: RGB) => `linear-gradient(90deg,rgb(${a.join(",")}),rgb(${b.join(",")}))`;
  if (route === "fresh") return g([255, 186, 20], FADED);
  if (route === "familyFresh") return `linear-gradient(90deg,rgb(${SELLER_RGB[0].join(",")}),rgb(${FADED.join(",")}) 50%,rgb(${VALUE_RGB[0].join(",")}))`;
  if (route === "upside") return g(UP_LO, UP_HI);
  if (route === "layer") return `linear-gradient(90deg,${heatColors("roi").join(",")})`;
  if (route === "family") return `linear-gradient(90deg,${[...SELLER_RGB, ...VALUE_RGB].map(c => `rgb(${c.join(",")})`).join(",")})`;
  const order = route === "brand" ? BRAND_ORDER : HEAT_ORDER;
  return `linear-gradient(90deg,${order.map((t, i) => `rgb(${pinRGB(t, route).join(",")}) ${Math.round((i / (order.length - 1)) * 100)}%`).join(",")})`;
};
export const routeOrder = (route: PinRoute) => (route === "brand" ? BRAND_ORDER : route === "family" || route === "familyFresh" ? [...SELLER, ...VALUE] : HEAT_ORDER);

const lum = ([r, g, b]: RGB) => (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
const light = (c: RGB, t: number): RGB => mix(c, [255, 255, 255], t);

// Fill (light gradient of the shade) + icon colour for a circle.
export function pinFill(type: OppType, route: PinRoute, selected = false, l?: Listing) {
  if (selected) return { background: "radial-gradient(circle at 32% 28%, rgb(70,66,64), rgb(18,18,18) 72%)", icon: "rgb(253,252,252)", rgb: [18, 18, 18] as RGB };
  const c = pinRGB(type, route, l);
  return {
    background: `radial-gradient(circle at 32% 28%, rgb(${light(c, 0.55).join(",")}) 0%, rgb(${c.join(",")}) 62%, rgb(${mix(c, [0, 0, 0], 0.12).join(",")}) 100%)`,
    icon: lum(c) > 0.56 ? "rgb(18,18,18)" : "rgb(253,252,252)",
    rgb: c,
  };
}

// Shared, persisted route selection.
const KEY = "bz-pin-route";
export function setPinRoute(r: PinRoute) {
  try { localStorage.setItem(KEY, r); } catch {}
  window.dispatchEvent(new CustomEvent(KEY, { detail: r }));
}
export function usePinRoute(): PinRoute {
  const [r, setR] = useState<PinRoute>("yellow");
  useEffect(() => {
    try { const v = localStorage.getItem(KEY) as PinRoute | null; if (v && PIN_ROUTES.some(x => x.k === v)) setR(v); } catch {}
    const on = (e: Event) => setR((e as CustomEvent).detail);
    window.addEventListener(KEY, on);
    return () => window.removeEventListener(KEY, on);
  }, []);
  return r;
}
