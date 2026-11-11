"use client";
// "Neighborhood insights" (Figma 234:73367), ported from Pedro's
// underbuilt-roi src/routes/-report/Neighborhood.tsx + HoodArt.tsx.
// His figures come from a neighborhoods endpoint; ours come from real data
// (lib/comps.ts hoodStats): Pedro's sales within ¾ mile ($/ft², sales in the last
// 12 months), the comps' median size, the model's largest nearby comp (Snbhd),
// and LA County + Pedro's parcels round the property (median year built, share
// of homes 50%+ underbuilt, the ZIP's rank by that share).
import type { Listing } from "@/lib/fake";
import { compsFor, hoodStats } from "@/lib/comps";
import { N, type Params } from "@/lib/roi";

const PIECES: { src: string; x: number; y: number; w: number; h: number; o?: number }[] = [
  { src: "/report/hood/ring-1.png", x: 10.94, y: 0.42, w: 121.143, h: 121.143, o: 0.46 },
  { src: "/report/hood/pin-1.svg", x: 43.05, y: -2.2, w: 64.5, h: 64.5 },
  { src: "/report/hood/pin-2.svg", x: 75.23, y: 50.8, w: 62.62, h: 62.62 },
  { src: "/report/hood/ring-2.png", x: 31.13, y: 20.61, w: 80.762, h: 80.762 },
  { src: "/report/hood/ring-3.png", x: 51.32, y: 40.8, w: 40.381, h: 40.381 },
  { src: "/report/hood/wedge.png", x: -18.53, y: 38.87, w: 121.649, h: 121.285 },
  { src: "/report/hood/pin-3.svg", x: 3.3, y: 43.23, w: 68.3, h: 68.3 },
];

function HoodArt() {
  return (
    <span className="rp-hoodart" aria-hidden="true">
      {PIECES.map((p, i) => (
        <img key={i} src={p.src} alt="" width={p.w} height={p.h}
          style={{ left: `${p.x}px`, top: `${p.y}px`, width: `${p.w}px`, height: `${p.h}px`, opacity: p.o }} />
      ))}
    </span>
  );
}

export function Neighborhood({ p, l, onComps }: { p: Params; l: Listing; onComps: () => void }) {
  const h = hoodStats(l.lat, l.lng);
  const comps = compsFor(l).sold;
  const compSize = comps.length ? [...comps].sort((a, b) => a.sqft - b.sqft)[comps.length >> 1].sqft : h.medianSqft;
  const ub = Math.round(h.ub50Share * 100);
  return (
    <section className="rp-card rp-hood">
      <div className="head">
        <h2>Neighborhood insights</h2>
        <span>{p.addr}{h.zip ? `, ${h.zip}` : ""} vs. nearby ZIPs</span>
      </div>
      <p className="intro">
        {h.zipRank === 1
          ? <>{h.zip} has the highest share of underbuilt homes among {h.zipCount} nearby ZIPs.</>
          : h.zipRank > 1 ? <>{h.zip} ranks number {h.zipRank} of {h.zipCount} nearby ZIPs for its share of underbuilt homes.</> : null}{" "}
        {ub >= 50
          ? "A high share of underbuilt lots nearby supports renovation and addition opportunities."
          : "Fewer underbuilt lots nearby means fewer projects to learn from, so lean on the comps."}
      </p>
      <div className="grid">
        <button type="button" className="comps" onClick={onComps}>
          <HoodArt />
          See comps →
        </button>
        <div className="stats">
          <div><em>Median resale</em><p><b>${N(h.resalePsf)}</b><span>/ft<sup>2</sup></span></p></div>
          <div><em>Sales nearby, 12 mo</em><p><b>{h.salesN}</b></p></div>
          <div><em>Comparable home size</em><p><b>~{N(Math.round(compSize / 100) * 100)}</b><span>ft<sup>2</sup></span></p></div>
          <div><em>Largest nearby comp</em><p><b>{N(p.Snbhd)}</b><span>ft<sup>2</sup></span></p></div>
          <div><em>Median year built</em><p><b>{h.medianYear || "–"}</b></p></div>
          <div><em>Highly underbuilt lots</em><p><b>{ub}</b><span>%</span></p></div>
        </div>
      </div>
    </section>
  );
}
