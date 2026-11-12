// The 50 states + DC as simplified outer rings, for the US-wide demo heat
// (lib/map/usHeat.ts keeps its hexes on land). From the Census TIGERweb States
// layer, ~1 km tolerance.
//
//   node scripts/fetch-us-outline.mjs
//
// Writes public/data/us-states.json: { ST: [[ [lng, lat], … ], …] } (outer rings only).
import { writeFileSync } from "node:fs";
import path from "node:path";

const ROOT = path.join(path.dirname(new URL(import.meta.url).pathname), "..");
const BASE = process.env.TIGERWEB_URL || "https://tigerweb.geo.census.gov/arcgis/rest/services/TIGERweb/tigerWMS_Current/MapServer";
const meta = await (await fetch(`${BASE}?f=json`)).json();
const id = meta.layers.find(l => l.name === "States").id;
const q = new URLSearchParams({ where: "1=1", outFields: "STUSAB", returnGeometry: "true", outSR: "4326", maxAllowableOffset: "0.01", geometryPrecision: "3", f: "geojson" });
const gj = await (await fetch(`${BASE}/${id}/query?${q}`)).json();
const SKIP = new Set(["PR", "VI", "GU", "MP", "AS"]);
const out = {};
for (const f of gj.features) {
  const st = f.properties.STUSAB;
  if (SKIP.has(st)) continue;
  const g = f.geometry, polys = g.type === "Polygon" ? [g.coordinates] : g.coordinates;
  // Keep islands bigger than ~25 km² (drops reefs and slivers).
  const rings = polys.map(p => p[0]).filter(r => {
    let a = 0; for (let i = 0; i < r.length - 1; i++) a += r[i][0] * r[i + 1][1] - r[i + 1][0] * r[i][1];
    return Math.abs(a / 2) * 111 * 111 * Math.cos(r[0][1] * Math.PI / 180) > 25;
  });
  if (rings.length) out[st] = rings;
}
writeFileSync(path.join(ROOT, "public/data/us-states.json"), JSON.stringify(out));
console.log(Object.keys(out).length, "states,", Object.values(out).flat().length, "rings,", Object.values(out).flat(2).length, "points");
