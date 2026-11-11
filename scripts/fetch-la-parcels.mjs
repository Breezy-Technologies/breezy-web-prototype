// Real parcels for the whole Silver Lake heat circle, from LA County's public
// assessor parcel service (open data, no key):
//   https://public.gis.lacounty.gov/public/rest/services/LACounty_Cache/LACounty_Parcel/MapServer/0
//
//   node scripts/fetch-la-parcels.mjs
//
// Pedro's 2,018 lots stay as they are (lib/data/silverlake.json); this adds every
// other parcel inside HEAT_AREA (3 km round the lots), so parcels cover the whole
// heat surface. Writes:
//  - public/data/sl-parcels.json  outlines + a few figures, loaded by Mapbox on demand
//  - lib/data/sl-heat.json        per-H3 (res 8) averages over all parcels, and the
//                                 Underbuilt band cut points (data quintiles)
//
// Outline, address, use, beds / baths, built ft², year and lot area are the
// county's. Underbuilt follows Pedro's formula, 1 − built / by-right ft², with
// by-right from an assumed FAR per use (no zoning in this source: single family
// 0.45, 2–4 units 1.0, 5+ units and commercial 1.5). ROI is made up: Pedro's
// Silver Lake tier mix, leaning toward the higher tiers where a lot is underbuilt.
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { latLngToCell } from "h3-js";

const ROOT = path.join(path.dirname(new URL(import.meta.url).pathname), "..");
const SVC = "https://public.gis.lacounty.gov/public/rest/services/LACounty_Cache/LACounty_Parcel/MapServer/0/query";
const CENTER = [-118.2685, 34.0845], RADIUS = 3000; // lib/silverlake.ts HEAT_AREA
const FIELDS = ["OBJECTID", "AIN", "SitusAddress", "SitusZIP", "UseType", "UseDescription", "Units1",
  "Bedrooms1", "Bathrooms1", "SQFTmain1", "SQFTmain2", "SQFTmain3", "SQFTmain4", "SQFTmain5", "YearBuilt1",
  "Roll_LandValue", "Roll_ImpValue"];

async function get(params) {
  for (let k = 0; k < 4; k++) {
    try {
      const r = await fetch(SVC, { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: new URLSearchParams(params) });
      if (r.ok) return await r.json();
    } catch {}
    await new Promise(res => setTimeout(res, 1500 * (k + 1)));
  }
  throw new Error("query failed: " + JSON.stringify(params).slice(0, 200));
}

const circle = { geometry: `${CENTER[0]},${CENTER[1]}`, geometryType: "esriGeometryPoint", inSR: "4326", distance: String(RADIUS), units: "esriSRUnit_Meter", spatialRel: "esriSpatialRelIntersects" };
const ids = (await get({ where: "1=1", ...circle, returnIdsOnly: "true", f: "json" })).objectIds.sort((a, b) => a - b);
console.log(ids.length, "parcels in the circle");

const pedro = JSON.parse(readFileSync(path.join(ROOT, "lib/data/silverlake.json"), "utf8"));
// Pedro's ids are City of LA map-sheet PINs, not county AINs, so his lots are matched
// by geometry: a county parcel whose centre lies in one of his lots is his.
const inRing = ([x, y], r) => { let h = false; for (let i = 0, j = r.length - 1; i < r.length; j = i++) { const [xi, yi] = r[i], [xj, yj] = r[j]; if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) h = !h; } return h; };
const G = 0.002, grid = new Map();
pedro.forEach(l => { const k = Math.floor(l.c[0] / G) + ":" + Math.floor(l.c[1] / G); (grid.get(k) || grid.set(k, []).get(k)).push(l.ring); });
const isPedros = ([x, y]) => { for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) for (const r of grid.get((Math.floor(x / G) + dx) + ":" + (Math.floor(y / G) + dy)) || []) if (inRing([x, y], r)) return true; return false; };
let skipped = 0;

const r6 = v => Math.round(v * 1e6) / 1e6;
const title = s => s.toLowerCase().replace(/\b[a-z]/g, c => c.toUpperCase()).replace(/\b(Ave|Blvd|St|Dr|Pl|Ter|Way|Ln|Rd|Ct|Cir)\b/g, m => m);
function hash(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619); return h >>> 0; }
const FAR = d => /^single/i.test(d) ? 0.45 : /^(two|three|four) units/i.test(d) || /double|duplex|triplex/i.test(d) ? 1.0 : 1.5;
const TIERS = [{ share: 0.4, lo: -8, hi: 9.4 }, { share: 0.48, lo: 10, hi: 29.4 }, { share: 0.12, lo: 30, hi: 55 }];

const features = [];
for (let i = 0; i < ids.length; i += 400) {
  const page = await get({ objectIds: ids.slice(i, i + 400).join(","), outFields: FIELDS.join(","), returnGeometry: "true", outSR: "4326", geometryPrecision: "6", f: "geojson" });
  for (const f of page.features) {
    const p = f.properties;
    const g = f.geometry;
    if (!g) continue;
    const ring = g.type === "Polygon" ? g.coordinates[0] : g.type === "MultiPolygon" ? g.coordinates[0][0] : null;
    if (!ring || ring.length < 4) continue;
    const m = ring.length - 1, ctr = [ring.slice(0, m).reduce((s, q) => s + q[0], 0) / m, ring.slice(0, m).reduce((s, q) => s + q[1], 0) / m];
    if (isPedros(ctr)) { skipped++; continue; } // drawn from Pedro's data
    // lot area (m², then ft²) from the ring
    const [x0, y0] = ring[0], kx = 111320 * Math.cos(y0 * Math.PI / 180), ky = 110540;
    let a = 0;
    for (let j = 0; j < ring.length - 1; j++) a += ((ring[j][0] - x0) * kx) * ((ring[j + 1][1] - y0) * ky) - ((ring[j + 1][0] - x0) * kx) * ((ring[j][1] - y0) * ky);
    const lotFt = Math.round(Math.abs(a / 2) * 10.7639);
    const built = [p.SQFTmain1, p.SQFTmain2, p.SQFTmain3, p.SQFTmain4, p.SQFTmain5].reduce((s, v) => s + (v || 0), 0);
    const use = p.UseType || "";
    // Value only where a home could be built: residential and commercial lots, not
    // streets, parks, schools, utilities (those draw as plain outlines).
    const valued = /residential|commercial/i.test(use) && lotFt > 800;
    let ub = null, roi = null;
    if (valued) {
      const byright = lotFt * FAR(p.UseDescription || "");
      ub = Math.round(Math.max(0, Math.min(1, 1 - built / byright)) * 100);
      const ain = String(p.AIN);
      let u = 0.5 * (hash(ain + ":tier") % 1000) / 1000 + 0.5 * (ub / 100) * 0.9 + 0.05 * (hash(ain + ":lean") % 1000) / 1000;
      const tier = TIERS.find(t => (u -= t.share) < 0) ?? TIERS[TIERS.length - 1];
      roi = Math.round(tier.lo + (hash(ain + ":roi") % 1001) / 1000 * (tier.hi - tier.lo));
    }
    const props = { a: title((p.SitusAddress || "").trim()), z: (p.SitusZIP || "").slice(0, 5), t: use.slice(0, 3), lf: lotFt };
    if (built) Object.assign(props, { s: built, b: p.Bedrooms1 || 0, ba: p.Bathrooms1 || 0, y: +p.YearBuilt1 || 0 });
    if (valued) Object.assign(props, { ub, roi });
    features.push({ type: "Feature", id: features.length, properties: props, geometry: { type: "Polygon", coordinates: [ring.map(([x, y]) => [r6(x), r6(y)])] } });
  }
  process.stdout.write(`\r${Math.min(i + 400, ids.length)} / ${ids.length}`);
}
console.log();

const out = path.join(ROOT, "public/data/sl-parcels.json");
writeFileSync(out, JSON.stringify({ type: "FeatureCollection", features }));
console.log(features.length, "parcels →", out, `(${skipped} left to Pedro's lots)`);

// Hex averages (res 8, the heat grid) over Pedro's lots and the county parcels together.
const cells = new Map();
const add = (lng, lat, roi, ub) => { const c = latLngToCell(lat, lng, 8); const a = cells.get(c) || [0, 0, 0]; a[0] += roi; a[1] += ub; a[2]++; cells.set(c, a); };
for (const l of pedro) add(l.c[0], l.c[1], l.roi, l.ub);
const ubAll = pedro.map(l => l.ub);
for (const f of features) {
  if (f.properties.ub == null) continue;
  const r = f.geometry.coordinates[0], n = r.length - 1;
  add(r.slice(0, n).reduce((s, p) => s + p[0], 0) / n, r.slice(0, n).reduce((s, p) => s + p[1], 0) / n, f.properties.roi, f.properties.ub);
  ubAll.push(f.properties.ub);
}
// A hex averages dozens of lots, so its values bunch in the middle (UB hex quintiles
// came out 45–56%: one or two bands, the "not varied" feedback). Each hex keeps its
// rank, and is shown at the lot value of the same rank: the hex map keeps the true
// order but spreads over the bands the way the lots do.
const ok = [...cells].filter(([, a]) => a[2] > 3).map(([c, [roi, ub, n]]) => ({ c, roi: roi / n, ub: ub / n }));
const roiAll = [...pedro.map(l => l.roi), ...features.filter(f => f.properties.roi != null).map(f => f.properties.roi)].sort((a, b) => a - b);
const ubLots = [...pedro.map(l => l.ub), ...features.filter(f => f.properties.ub != null).map(f => f.properties.ub)].sort((a, b) => a - b);
const spread = (k, all) => { const by = ok.slice().sort((a, b) => a[k] - b[k]); by.forEach((h, i) => { h[k + "S"] = all[Math.min(all.length - 1, Math.floor(((i + 0.5) / by.length) * all.length))]; }); };
spread("roi", roiAll); spread("ub", ubLots);
const hex = {};
for (const h of ok) hex[h.c] = [h.roiS, h.ubS, Math.round(h.roi * 10) / 10, Math.round(h.ub * 10) / 10];
// Underbuilt cut points from the data: quintiles (5 bands) and sevenths (7 bands),
// so each colour holds a similar share of lots (team: UB heat wasn't varied).
ubAll.sort((a, b) => a - b);
const q = k => ubAll[Math.floor(ubAll.length * k)];
const uniq = a => a.map((v, i) => (i && v <= a[i - 1] ? a[i - 1] + 1 : v));
// Hex averages are smoother than single lots, so their spread is checked too.
const hv = Object.values(hex).map(v => v[3]).sort((a, b) => a - b);
const heat = { note: "hex: [roi shown, ub shown, roi mean, ub mean]; shown = lot value of the same rank", hex, ubBands5: uniq([0.2, 0.4, 0.6, 0.8].map(q)), ubBands7: uniq([1, 2, 3, 4, 5, 6].map(k => q(k / 7))), hexUbQuint: [0.2, 0.4, 0.6, 0.8].map(k => hv[Math.floor(hv.length * k)]) };
writeFileSync(path.join(ROOT, "lib/data/sl-heat.json"), JSON.stringify(heat));
console.log(Object.keys(hex).length, "hex cells; UB bands 5:", heat.ubBands5, "7:", heat.ubBands7, "hex UB quintiles:", heat.hexUbQuint);
