import type { StyleSpecification } from "mapbox-gl";
import { config, isLiveMap } from "../config";

export type MapMode = "light" | "satellite";

// Offline base map: georeferenced Mapbox light-v11 static images (and a
// generated aerial stand-in) for Beverly Hills and Silver Lake. Used whenever
// no Mapbox token is configured, so the demo still works on a plane.
const box = (w: number, n: number, e: number, s: number): [[number, number], [number, number], [number, number], [number, number]] => [[w, n], [e, n], [e, s], [w, s]];
const IMAGES: [string, ReturnType<typeof box>, boolean][] = [
  ["bh-overview", box(-118.435248, 34.103194, -118.349052, 34.031791), false],
  ["silverlake", box(-118.287349, 34.108894, -118.244251, 34.073202), false],
  ["bh-sw", box(-118.424983, 34.087774, -118.397517, 34.065024), true],
  ["bh-se", box(-118.407483, 34.087774, -118.380017, 34.065024), true],
  ["bh-nw", box(-118.424983, 34.094973, -118.397517, 34.072225), true],
  ["bh-ne", box(-118.407483, 34.094973, -118.380017, 34.072225), true],
];

export function offlineStyle(mode: MapMode): StyleSpecification {
  const sat = mode === "satellite";
  const abs = (u: string) => (typeof window === "undefined" ? u : new URL(u, window.location.href).href);
  const sources: StyleSpecification["sources"] = {};
  const layers: StyleSpecification["layers"] = [
    { id: "bz-bg", type: "background", paint: { "background-color": sat ? "rgb(84,88,70)" : "rgb(243,240,236)" } },
  ];
  IMAGES.forEach(([f, coords, detail]) => {
    sources[f] = { type: "image", url: abs(`/map/${sat ? "sat-" : ""}${f}.jpg`), coordinates: coords };
    layers.push({
      id: "bz-base-" + f, type: "raster", source: f,
      paint: detail ? { "raster-fade-duration": 0, "raster-opacity": ["interpolate", ["linear"], ["zoom"], 13.9, 0, 14.4, 1] } : { "raster-fade-duration": 0 },
    });
  });
  return { version: 8, sources, layers } as StyleSpecification;
}

export function styleFor(mode: MapMode): string | StyleSpecification {
  if (!isLiveMap()) return offlineStyle(mode);
  return mode === "satellite" ? config.mapboxSatelliteStyle : config.mapboxStyle;
}
