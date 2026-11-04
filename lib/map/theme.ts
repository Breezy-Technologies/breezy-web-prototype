import type { Map as MbMap } from "mapbox-gl";

// Interim Breezy look for the live map, layered over Mapbox light-v11 until
// the real Breezy style (dev-breezy account) is available. Warm paper land,
// white roads, quiet labels and no POI clutter, so price pins and heat read
// first. It only touches stock Mapbox light styles: once
// NEXT_PUBLIC_MAPBOX_STYLE points at a custom style, this is a no-op.
const C = {
  land: "rgb(243,240,236)",
  park: "rgb(230,232,221)",
  landuse: "rgb(237,233,227)",
  water: "rgb(212,221,225)",
  waterLine: "rgb(198,210,215)",
  building: "rgb(232,227,221)",
  buildingLine: "rgb(221,214,207)",
  road: "rgb(253,252,252)",
  roadMajor: "rgb(255,255,255)",
  roadCase: "rgb(229,223,217)",
  path: "rgb(226,219,212)",
  rail: "rgb(219,212,205)",
  admin: "rgb(196,186,178)",
  label: "rgb(129,117,111)",
  labelStrong: "rgb(73,67,65)",
  waterLabel: "rgb(128,146,154)",
  halo: "rgb(243,240,236)",
};

const set = (m: MbMap, id: string, prop: string, value: unknown) => {
  if (m.getLayer(id)) m.setPaintProperty(id, prop as any, value);
};
const hide = (m: MbMap, id: string) => {
  if (m.getLayer(id)) m.setLayoutProperty(id, "visibility", "none");
};

export function isStockLightStyle(m: MbMap) {
  return /^mapbox:\/\/sprites\/mapbox\/light-/.test(String(m.getStyle()?.sprite ?? ""));
}

export function applyBreezyTheme(m: MbMap) {
  if (!isStockLightStyle(m)) return;
  set(m, "land", "background-color", C.land);
  set(m, "national-park", "fill-color", C.park);
  set(m, "landuse", "fill-color", ["match", ["get", "class"], ["park", "pitch", "grass", "cemetery", "wood", "scrub"], C.park, C.landuse]);
  set(m, "water", "fill-color", C.water);
  set(m, "waterway", "line-color", C.waterLine);
  set(m, "land-structure-polygon", "fill-color", C.land);
  set(m, "land-structure-line", "line-color", C.land);
  set(m, "aeroway-polygon", "fill-color", C.landuse);
  set(m, "aeroway-line", "line-color", C.roadMajor);
  set(m, "building", "fill-color", C.building);
  set(m, "building", "fill-outline-color", C.buildingLine);

  const roadColor = ["match", ["get", "class"], ["motorway", "trunk", "primary"], C.roadMajor, C.road];
  for (const id of ["road-simple", "bridge-simple", "tunnel-simple"]) set(m, id, "line-color", roadColor);
  set(m, "bridge-case-simple", "line-color", C.roadCase);
  for (const p of ["tunnel", "road", "bridge"]) {
    for (const k of ["path-trail", "path-cycleway-piste", "path", "steps", "pedestrian"]) set(m, `${p}-${k}`, "line-color", C.path);
  }
  set(m, "road-rail", "line-color", C.rail);
  set(m, "bridge-rail", "line-color", C.rail);
  for (const id of ["admin-0-boundary", "admin-1-boundary", "admin-0-boundary-disputed"]) set(m, id, "line-color", C.admin);
  for (const id of ["admin-0-boundary-bg", "admin-1-boundary-bg"]) set(m, id, "line-color", C.land);

  for (const id of ["road-label-simple", "natural-line-label", "natural-point-label", "settlement-subdivision-label", "airport-label"]) {
    set(m, id, "text-color", C.label);
    set(m, id, "text-halo-color", C.halo);
  }
  for (const id of ["settlement-minor-label", "settlement-major-label", "state-label", "country-label"]) {
    set(m, id, "text-color", C.labelStrong);
    set(m, id, "text-halo-color", C.halo);
  }
  for (const id of ["waterway-label", "water-line-label", "water-point-label"]) {
    set(m, id, "text-color", C.waterLabel);
    set(m, id, "text-halo-color", C.halo);
  }
  // POIs compete with price pins and opportunity markers.
  hide(m, "poi-label");
}
