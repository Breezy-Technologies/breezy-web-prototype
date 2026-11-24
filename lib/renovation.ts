// Renovation comps (Figma Project Nimbus (Core) "Comps · Positive ROI · high confidence"
// 7137:46640): the comps behind the ROI. Two sets of sales:
//   - pre-renovation: the usual comps for the house as it stands (compsFor), whose median
//     $/ft² × today's size is today's value;
//   - post-renovation: renovated homes sold nearby, close to the size the ROI model
//     recommends building; their median $/ft² × that size is the after-build value.
// A sold lot counts as renovated when it was built (or rebuilt) since 2000, or carries a
// stable demo "remodel" flag (hashed, ~30%), until the listings service says which were.
import type { Listing } from "./fake";
import { LOTS } from "./silverlake";
import { compsFor, milesBetween, type Comp } from "./comps";
import { lotListing } from "./fake";
import { hashStr } from "./geo";
import { upsideOf } from "./roi";

export type RenoComp = Comp & { remodel: boolean; style: string };
export type Renovation = {
  /** Today: pre-renovation comps, median $/ft², size, value (lots: per ft² of lot). */
  pre: { n: number; ppsf: number; size: number; value: number; lot: boolean };
  /** After the build: the target size, the post-renovation comps, median $/ft², value. */
  post: { comps: RenoComp[]; ppsf: number; size: number; value: number };
};

const STYLES = ["Traditional", "Contemporary", "Spanish", "Craftsman", "Mid century", "Modern"];
const median = (xs: number[]) => {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b), m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

const cache = new Map<string, Renovation>();
export function renovationOf(l: Listing): Renovation {
  const key = `${l.id}|${l.addr}`, hit = cache.get(key);
  if (hit) return hit;
  const { p, sc } = upsideOf(l);
  const pre = compsFor(l).sold;
  const lotFt = Math.max(1, Math.round(l.lotAc * 43560));
  const vacant = !(l.sqft > 0);
  const prePpsf = vacant ? median(pre.map(c => (c.lot ? c.price / c.lot : 0)).filter(Boolean)) : median(pre.map(c => c.ppsf));
  const preSize = vacant ? lotFt : l.sqft;
  const size = Math.max(sc.rec.S, vacant ? 1200 : l.sqft);
  // post-renovation: renovated sales within 1.5 mi, ranked by size (close to the target),
  // distance and how near their $/ft² sits to the model's sale price (p.C_RB)
  const at: [number, number] = [l.lng, l.lat];
  const cands: RenoComp[] = [];
  LOTS.forEach((lt, i) => {
    if (lt.st !== "S" || lt.apn === l.apn || !(lt.sqft > 0)) return;
    const mi = milesBetween(at, lt.c);
    if (mi > 1.5 || mi < 0.003) return;
    const h = hashStr("reno:" + lt.apn) >>> 0;
    const remodel = lt.year < 2000 && h % 100 < 30;
    if (lt.year < 2000 && !remodel) return;
    const sz = 1 - Math.min(1, Math.abs(lt.sqft - size) / size);
    const pr = 1 - Math.min(1, Math.abs(lt.ppsf - p.C_RB) / Math.max(1, p.C_RB));
    const near = 1 - mi / 1.5;
    const score = Math.round(100 * (0.4 * sz + 0.3 * near + 0.3 * pr));
    cands.push({
      i, addr: lt.addr, price: lt.price, ppsf: lt.ppsf, sqft: lt.sqft, beds: lt.beds, baths: lt.baths, lot: lt.lot, year: lt.year,
      mi, score, st: "S", sm: lt.sm, photo: lotListing(lt, i).photos[0], remodel, style: STYLES[Math.floor(h / 8) % STYLES.length],
    });
  });
  const comps = cands.sort((a, b) => b.score - a.score).slice(0, 4);
  const postPpsf = median(comps.map(c => c.ppsf));
  const out: Renovation = {
    pre: { n: pre.length, ppsf: Math.round(prePpsf), size: preSize, value: Math.round((prePpsf * preSize) / 1000) * 1000, lot: vacant },
    post: { comps, ppsf: Math.round(postPpsf), size, value: Math.round(postPpsf * size) },
  };
  cache.set(key, out);
  return out;
}
