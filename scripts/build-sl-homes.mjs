// The county homes that are "on the market" in the demo, so that searches inside
// the heat circle but outside Pedro's lot zone (Los Feliz, east of the reservoir,
// Elysian Valley…) pin real parcels instead of made-up points.
//
//   node scripts/build-sl-homes.mjs
//
// Reads public/data/sl-parcels.json (scripts/fetch-la-parcels.mjs) and writes
// lib/data/sl-homes.json (bundled): every built, valued home outside the lot zone
// whose demo status is listed or sold. The status is a hash of the parcel id,
// the same rule as `countyStatus` in lib/fake.ts, so a pin and its parcel's hover
// card always agree. Rows: [id, lng, lat, addr, zip, use, lot ft², ft², beds, baths, year, ub, roi].
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const ROOT = path.join(path.dirname(new URL(import.meta.url).pathname), "..");
const county = JSON.parse(readFileSync(path.join(ROOT, "public/data/sl-parcels.json"), "utf8")).features;
const pedro = JSON.parse(readFileSync(path.join(ROOT, "lib/data/silverlake.json"), "utf8"));

// lib/geo.ts hashStr
const hashStr = s => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };
// lib/fake.ts countyStatus
const status = id => { const v = hashStr("market:" + id) % 100; return v < 9 ? "L" : v < 15 ? "S" : "O"; };
// lib/silverlake.ts LOT_ZONE: the lots' box padded 120 m
let w = 180, s = 90, e = -180, n = -90;
for (const l of pedro) for (const [x, y] of l.ring) { w = Math.min(w, x); e = Math.max(e, x); s = Math.min(s, y); n = Math.max(n, y); }
const px = 120 / (111320 * Math.cos((34.08 * Math.PI) / 180)), py = 120 / 110540;
const zone = [w - px, s - py, e + px, n + py];

const r6 = v => Math.round(v * 1e6) / 1e6;
const rows = [];
for (const f of county) {
  const p = f.properties;
  if (p.ub == null || !p.s || status(f.id) === "O") continue;
  const r = f.geometry.coordinates[0], k = r.length - 1;
  const x = r.slice(0, k).reduce((a, q) => a + q[0], 0) / k, y = r.slice(0, k).reduce((a, q) => a + q[1], 0) / k;
  if (x >= zone[0] && x <= zone[2] && y >= zone[1] && y <= zone[3]) continue; // Pedro's lots there
  rows.push([f.id, r6(x), r6(y), p.a, p.z, p.t, p.lf, p.s, p.b, p.ba, p.y, p.ub, p.roi]);
}
writeFileSync(path.join(ROOT, "lib/data/sl-homes.json"), JSON.stringify(rows));
console.log(rows.length, "county homes listed or sold → lib/data/sl-homes.json");
