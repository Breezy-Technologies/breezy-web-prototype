// Neighbourhood figures for the Upside report's "Neighborhood insights", from real
// parcels: Pedro's lots (lib/data/silverlake.json) and the county parcels
// (public/data/sl-parcels.json, from scripts/fetch-la-parcels.mjs).
//
//   node scripts/build-hood-stats.mjs
//
// Writes lib/data/sl-hood.json (small, bundled):
//  - cells: per H3 res-8 cell (the heat grid): homes, highly underbuilt homes
//    (Underbuilt ≥ 50%, the same figure the map paints), median year built,
//    median living area, and the cell's most common ZIP;
//  - zips: the same per ZIP, for "ranks n among nearby ZIPs".
// Sales ($/ft², recent sales, comps) come from Pedro's sold / listed lots at run time.
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { latLngToCell } from "h3-js";

const ROOT = path.join(path.dirname(new URL(import.meta.url).pathname), "..");
const pedro = JSON.parse(readFileSync(path.join(ROOT, "lib/data/silverlake.json"), "utf8"));
const county = JSON.parse(readFileSync(path.join(ROOT, "public/data/sl-parcels.json"), "utf8")).features;

const homes = [];
for (const l of pedro) homes.push({ x: l.c[0], y: l.c[1], ub: l.ub, year: l.year, sqft: l.sqft, zip: l.zip });
for (const f of county) {
  const p = f.properties;
  if (p.ub == null || !p.s) continue; // homes only: valued and built
  const r = f.geometry.coordinates[0], n = r.length - 1;
  homes.push({ x: r.slice(0, n).reduce((s, q) => s + q[0], 0) / n, y: r.slice(0, n).reduce((s, q) => s + q[1], 0) / n, ub: p.ub, year: p.y || 0, sqft: p.s, zip: p.z || "" });
}

const median = a => { const b = a.filter(v => v > 0).sort((p, q) => p - q); return b.length ? b[b.length >> 1] : 0; };
function summarize(list) {
  const zips = {};
  for (const h of list) if (h.zip) zips[h.zip] = (zips[h.zip] || 0) + 1;
  return {
    n: list.length, ub50: list.filter(h => h.ub >= 50).length,
    year: median(list.map(h => h.year)), sqft: median(list.map(h => h.sqft)),
    zip: Object.entries(zips).sort((a, b) => b[1] - a[1])[0]?.[0] || "",
  };
}
const byCell = new Map(), byZip = new Map();
for (const h of homes) {
  const c = latLngToCell(h.y, h.x, 8);
  (byCell.get(c) || byCell.set(c, []).get(c)).push(h);
  if (h.zip) (byZip.get(h.zip) || byZip.set(h.zip, []).get(h.zip)).push(h);
}
const cells = Object.fromEntries([...byCell].map(([c, l]) => [c, summarize(l)]));
const zips = Object.fromEntries([...byZip].filter(([, l]) => l.length >= 150).map(([z, l]) => { const s = summarize(l); delete s.zip; return [z, s]; }));
writeFileSync(path.join(ROOT, "lib/data/sl-hood.json"), JSON.stringify({ cells, zips }));
console.log(homes.length, "homes,", Object.keys(cells).length, "cells,", Object.keys(zips).length, "ZIPs:", Object.entries(zips).map(([z, s]) => `${z} ${Math.round(100 * s.ub50 / s.n)}%`).join(", "));
