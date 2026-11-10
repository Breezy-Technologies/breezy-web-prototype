import type { Map as MbMap } from "mapbox-gl";

// Breezy basemap theme (design point 3): light and dark presets of one Mapbox
// Standard style, so the heat map and pins dominate and roads / highways step
// back. Engineering applies the same values as Standard config properties
// (map.setConfigProperty("basemap", key, value)) or bakes them into the
// duplicated Studio style. Spec and rationale: docs/map-theme.md.
//
// Starting point: Pedro's BZYREPORT-LIGHTTHEME (faded theme, Akkurat). Light
// tones its roads, highways and greens down one more step; dark is the same
// style on the night preset with production's navigation-night palette,
// desaturated the same way.
export type ThemeConfig = Record<string, string | boolean>;

const SHARED: ThemeConfig = {
  theme: "faded",
  font: "Akkurat LL",
  show3dObjects: false,
  showPointOfInterestLabels: false,
  showTransitLabels: false,
  showAdminBoundaries: false,
  showPedestrianRoads: false,
  showPlaceLabels: true,
};

export const BREEZY_LIGHT: ThemeConfig = {
  ...SHARED,
  lightPreset: "day",
  colorRoads: "#e2d9d3", // Pedro #dacbc3: lighter, less red, so streets sit under parcels
  colorTrunks: "#e7e2df", // Pedro #e5dfdc
  colorMotorways: "#e4e0de", // Pedro #e3dfde: highways read as wide quiet bands, not orange lines
  colorGreenspace: "#d2dcc9", // Pedro #c2d6b4: desaturated so parks don't compete with the cool heat band
  colorWater: "hsl(190, 22%, 82%)", // Pedro hsl(177, 33%, 80%): greyer, still clearly water
  colorRoadLabels: "hsl(20, 4%, 52%)",
  colorPlaceLabels: "hsl(20, 5%, 38%)",
};

export const BREEZY_DARK: ThemeConfig = {
  ...SHARED,
  // Land, buildings and land use aren't config properties in this Standard
  // version, so "monochrome" (neutral grey) under night light is the closest to
  // production's warm-neutral dark; the exact land colour needs the Studio style.
  theme: "monochrome",
  lightPreset: "night",
  colorRoads: "#3a3634", // production primary roads #343434, warmed to the land
  colorTrunks: "#403b39",
  colorMotorways: "#45403d",
  colorGreenspace: "#2f3b31", // production #405e44, desaturated
  colorWater: "#1f3638", // production #234447, desaturated
  colorRoadLabels: "hsl(20, 6%, 58%)",
  colorPlaceLabels: "hsl(20, 8%, 74%)",
};

/** Whether the loaded style is Mapbox Standard (an imported basemap fragment). */
export const isStandardStyle = (m: MbMap) => !!(m.getStyle() as any)?.imports?.length;

/* Pedro's style adds its own house-number and building layers on top of the
   basemap; they aren't driven by config, so they're recoloured here. */
const OWN: Record<"light" | "dark", { text: string; halo: string; building: string }> = {
  light: { text: "hsl(20, 5%, 46%)", halo: "rgba(253,252,252,.9)", building: "#e8e3de" },
  dark: { text: "hsl(20, 6%, 66%)", halo: "rgba(24,22,21,.9)", building: "#2c2827" },
};

/** Applies the light or dark preset. A no-op on classic styles (streets, satellite). */
export function applyBreezyBasemap(m: MbMap, dark: boolean) {
  if (!isStandardStyle(m)) return;
  for (const [k, v] of Object.entries(dark ? BREEZY_DARK : BREEZY_LIGHT)) {
    try { m.setConfigProperty("basemap", k, v); } catch { /* property not in this Standard version */ }
  }
  const o = OWN[dark ? "dark" : "light"];
  for (const l of m.getStyle()?.layers || []) {
    try {
      if (l.type === "symbol" && /housenum/.test(l.id)) { m.setPaintProperty(l.id, "text-color", o.text); m.setPaintProperty(l.id, "text-halo-color", o.halo); }
      if (l.type === "fill" && l.id === "building") m.setPaintProperty(l.id, "fill-color", o.building);
    } catch { /* not paintable */ }
  }
}

/* The style asks for an Akkurat Medium cut the account doesn't have, so those
   labels 404 and fall back to Arial. Point them at Regular, as Pedro's build does. */
const MEDIUM = /Akkurat(%20| )LL(%20| )Medium/;
export const breezyTransformRequest = (url: string, kind?: string) =>
  kind === "Glyphs" && MEDIUM.test(url) ? { url: url.replace(MEDIUM, m => m.replace("Medium", "Regular")) } : { url };
