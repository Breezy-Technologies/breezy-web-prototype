"use client";
// "Neighborhood insights" (Figma 234:73367), ported from Pedro's
// underbuilt-roi src/routes/-report/Neighborhood.tsx + HoodArt.tsx.
// His figures come from a neighborhoods endpoint; ours are fake, seeded per
// neighborhood (lib/geo rng), except "Largest nearby comp", which is the
// model's own Snbhd so it matches the build-size note.
import { hashStr, rng } from "@/lib/geo";
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

export function Neighborhood({ p, onComps }: { p: Params; onComps: () => void }) {
  const R = rng(hashStr("hood:" + p.hood));
  const tracked = 8 + Math.floor(R() * 7), rank = Math.floor(R() * 4);
  const s = {
    resalePsf: Math.round((p.Ex > 0 ? p.Aq / p.Ex : p.C_RB) * (0.92 + R() * 0.12)),
    dom: Math.round(18 + R() * 40),
    compSize: Math.max(900, p.Ex * (0.9 + R() * 0.3) || p.Smax * 0.6),
    permits: Math.round(40 + R() * 140),
    underbuiltShare: 0.35 + R() * 0.35,
  };
  return (
    <section className="rp-card rp-hood">
      <div className="head">
        <h2>Neighborhood insights</h2>
        <span>{p.addr}, {p.hood} vs. nearby ZIPs</span>
      </div>
      <p className="intro">
        {rank === 0
          ? <>{p.hood} shows the strongest return potential among {tracked} nearby neighborhoods.</>
          : <>{p.hood} ranks number {rank + 1} for return potential among {tracked} nearby neighborhoods.</>}{" "}
        {s.underbuiltShare >= 0.5
          ? "Strong resale values and a high share of underbuilt lots support renovation and addition opportunities."
          : "Fewer underbuilt lots nearby means fewer projects to learn from, so lean on the comps."}
      </p>
      <div className="grid">
        <button type="button" className="comps" onClick={onComps}>
          <HoodArt />
          See comps →
        </button>
        <div className="stats">
          <div><em>Median resale</em><p><b>${N(s.resalePsf)}</b><span>/ft<sup>2</sup></span></p></div>
          <div><em>Average DOM</em><p><b>{s.dom}</b><span>DAYS</span></p></div>
          <div><em>Comparable home size</em><p><b>~{N(Math.round(s.compSize / 100) * 100)}</b><span>ft<sup>2</sup></span></p></div>
          <div><em>Largest nearby comp</em><p><b>{N(p.Snbhd)}</b><span>ft<sup>2</sup></span></p></div>
          <div><em>Permits, last 12 mo</em><p><b>{s.permits}</b></p></div>
          <div><em>Highly underbuilt lots</em><p><b>{Math.round(s.underbuiltShare * 100)}</b><span>%</span></p></div>
        </div>
      </div>
    </section>
  );
}
