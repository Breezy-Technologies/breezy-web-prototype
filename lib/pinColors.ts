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
import type { OppType } from "./fake";

export type PinRoute = "yellow" | "heat" | "brand";
export const PIN_ROUTES: { k: PinRoute; lb: string; sub: string }[] = [
  { k: "yellow", lb: "Yellow", sub: "One colour for every type" },
  { k: "heat", lb: "Hot → cold", sub: "Most active listing to least active" },
  { k: "brand", lb: "Brand range", sub: "Breezy yellow to clay" },
];

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

export function pinRGB(type: OppType, route: PinRoute): RGB {
  if (route === "heat") return heatAt(Math.max(0, HEAT_ORDER.indexOf(type)) / (HEAT_ORDER.length - 1));
  if (route === "brand") return brandAt(Math.max(0, BRAND_ORDER.indexOf(type)) / (BRAND_ORDER.length - 1));
  return YELLOW;
}
export const rampCss = (route: PinRoute) => {
  const order = route === "brand" ? BRAND_ORDER : HEAT_ORDER;
  return `linear-gradient(90deg,${order.map((t, i) => `rgb(${pinRGB(t, route).join(",")}) ${Math.round((i / (order.length - 1)) * 100)}%`).join(",")})`;
};
export const routeOrder = (route: PinRoute) => (route === "brand" ? BRAND_ORDER : HEAT_ORDER);

const lum = ([r, g, b]: RGB) => (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
const light = (c: RGB, t: number): RGB => mix(c, [255, 255, 255], t);

// Fill (light gradient of the shade) + icon colour for a circle.
export function pinFill(type: OppType, route: PinRoute, selected = false) {
  if (selected) return { background: "radial-gradient(circle at 32% 28%, rgb(70,66,64), rgb(18,18,18) 72%)", icon: "rgb(253,252,252)", rgb: [18, 18, 18] as RGB };
  const c = pinRGB(type, route);
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
