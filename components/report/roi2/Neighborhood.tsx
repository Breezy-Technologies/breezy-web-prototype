"use client";
import { N } from '@/lib/roi';
import type { Parcel } from './parcel';
import { HoodArt } from './HoodArt';

interface Props {
  parcel: Parcel;
  onComps: () => void;
}

/**
 * v2 "Neighborhood insights" (Figma ROI handoff · 03, desktop and iOS). Four
 * figures, no more: v1's permits and underbuilt-lots tiles are gone. On a
 * wide screen the figures sit 2 × 2 beside the comps card; on a phone (as on
 * iOS) the card becomes a "See comps →" link under them. Hidden until its
 * data arrives.
 */
export function Neighborhood({ parcel, onComps }: Props) {
  /* Breezy: the figures come with the parcel (lib/comps hoodStats + the comps' DOM). */
  const s = parcel.hoodData, home = { name: s.name }, tracked = s.tracked, rank = s.rank - 1;

  return (
    <section className="rp-card rp-hood v2-hood">
      <div className="head">
        <h2>Neighborhood insights</h2>
        <span>{parcel.addr}, {home.name} vs. nearby ZIPs</span>
      </div>
      <p className="intro">
        {rank === 0
          ? <>{home.name} shows the strongest return potential among {tracked} nearby neighborhoods.</>
          : <>{home.name} ranks number {rank + 1} for return potential among {tracked} nearby neighborhoods.</>}{' '}
        {s.underbuiltShare >= 0.5
          ? 'Strong resale values and a high share of underbuilt lots support renovation and addition opportunities.'
          : 'Fewer underbuilt lots nearby means fewer projects to learn from, so lean on the comps.'}
      </p>

      <div className="grid">
        <div className="stats">
          <div><em>Median resale</em><p><b>${N(s.resalePsf)}</b><span>/ft<sup>2</sup></span></p></div>
          <div><em>Average DOM</em><p><b>{s.dom}</b><span>DAYS</span></p></div>
          <div><em>Comparable home size</em><p><b>~{N(Math.round(s.compSize / 100) * 100)}</b><span>ft<sup>2</sup></span></p></div>
          {/* the model's own "largest home nearby", so this matches the build-size note */}
          <div><em>Largest nearby comp</em><p><b>{N(parcel.Snbhd)}</b><span>ft<sup>2</sup></span></p></div>
        </div>
        <button type="button" className="comps" onClick={onComps}>
          <HoodArt />
          See comps →
        </button>
      </div>
    </section>
  );
}
