// Builds lib/data/silverlake.json from Pedro's real Silver Lake / Echo Park lots
// (pd-bittencourt/underbuilt-roi, src/mocks/data/lots.json).
//
//   node scripts/extract-silverlake.mjs ../underbuilt-roi/src/mocks/data/lots.json
//
// The outlines, addresses, zoning, lot sizes and house figures are his data.
// ROI and Underbuilt follow his model's results without running it:
//  - ROI: his loader tunes each lot so the model's recommended ROI lands on a
//    target, drawn per lot from its neighbourhood's tier mix by a hash of the
//    APN (src/mocks/parcels.ts, targetOf + MIXES). We take that target.
//  - Underbuilt: ubPct(p, 'legal') = 1 − built ft² / by-right ft² (lib/roi/model.ts).
// Beverly Hills is left out: the prototype demos one small circle of LA.
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";

const src = process.argv[2];
if (!src) { console.error("usage: node scripts/extract-silverlake.mjs <lots.json>"); process.exit(1); }
const lots = JSON.parse(readFileSync(src, "utf8"));

// parcels.ts pick(): stable 0..n-1 from an id
function pick(id, n) {
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) h = Math.imul(h ^ id.charCodeAt(i), 16777619);
  return (h >>> 0) % n;
}
const MIXES = {
  "Silver Lake": [{ share: 0.4, lo: -8, hi: 9.4 }, { share: 0.48, lo: 10, hi: 29.4 }, { share: 0.12, lo: 30, hi: 55 }],
  "Echo Park": [{ share: 0.45, lo: -8, hi: 9.4 }, { share: 0.45, lo: 10, hi: 29.4 }, { share: 0.1, lo: 30, hi: 55 }],
};
function targetOf(l, apn) {
  const mix = MIXES[l.hood];
  const at = pick(`${apn}:roi`, 1001) / 1000;
  let u = pick(`${apn}:tier`, 1000) / 1000;
  const tier = mix.find(t => (u -= t.share) < 0) ?? mix[mix.length - 1];
  return tier.lo + at * (tier.hi - tier.lo);
}

const r6 = n => Math.round(n * 1e6) / 1e6;
const out = lots
  .filter(l => MIXES[l.hood] && l.ring && l.ring.length > 3)
  .map(l => {
    const apn = l.id.replace(/[\s-]/g, "");
    return {
      apn, addr: l.addr, zip: l.zip, hood: l.hood, zone: l.zone,
      c: [r6(l.lon), r6(l.lat)],
      ring: l.ring.map(p => [r6(p[0]), r6(p[1])]),
      lot: l.lot, beds: l.beds, baths: l.baths, sqft: l.built, year: l.year,
      price: l.vnow, ppsf: l.ppsf,
      st: l.listed ? "L" : l.sold ? "S" : "O",
      roi: Math.round(targetOf(l, apn)),
      ub: l.byright > 0 ? Math.round(Math.max(0, 1 - l.built / l.byright) * 100) : 0,
    };
  });

const dest = path.join(path.dirname(new URL(import.meta.url).pathname), "..", "lib", "data", "silverlake.json");
mkdirSync(path.dirname(dest), { recursive: true });
writeFileSync(dest, JSON.stringify(out));
const by = k => out.reduce((a, l) => ((a[l[k]] = (a[l[k]] || 0) + 1), a), {});
console.log(`${out.length} lots →`, dest, by("hood"), by("st"));

// Building footprints (buildings.json next to lots.json): every footprint in the
// lots' box, as Pedro draws them over the lots. Served from public/ and loaded
// by Mapbox on demand, so it stays out of the JS bundle.
let w = 180, s = 90, e = -180, n = -90;
for (const l of out) for (const [x, y] of l.ring) { w = Math.min(w, x); e = Math.max(e, x); s = Math.min(s, y); n = Math.max(n, y); }
const rings = JSON.parse(readFileSync(path.join(path.dirname(src), "buildings.json"), "utf8"))
  .filter(r => r.length > 3 && r.every(([x, y]) => x >= w && x <= e && y >= s && y <= n));
const bdest = path.join(path.dirname(dest), "..", "..", "public", "data", "silverlake-bldgs.json");
mkdirSync(path.dirname(bdest), { recursive: true });
writeFileSync(bdest, JSON.stringify({ type: "FeatureCollection", features: rings.map(r => ({ type: "Feature", properties: {}, geometry: { type: "Polygon", coordinates: [r.map(p => [r6(p[0]), r6(p[1])])] } })) }));
console.log(`${rings.length} building footprints →`, bdest);
