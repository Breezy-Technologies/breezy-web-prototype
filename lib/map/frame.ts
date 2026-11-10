import type { Map as MbMap } from "mapbox-gl";
import { config, hasRegrid } from "../config";
import { BBox, LngLat, metersPerDegLat, metersPerDegLng } from "../geo";

// Framing a selected property or parcel (review feedback): the lot is fully
// visible, centred in the free map space between the right-most panel and the
// viewport edge (below the filter bar), with the same margin on every side;
// the zoom follows from the fit rather than a fixed level.

/** Margin kept around the lot inside the free space, px. */
export const FRAME_PAD = 64;
const MAX_ZOOM = 21; // Regrid parcel tiles go to 21; small lots can then fill the space evenly

const bboxOf = (ring: number[][]): BBox => {
  let w = Infinity, s = Infinity, e = -Infinity, n = -Infinity;
  for (const [x, y] of ring) { w = Math.min(w, x); e = Math.max(e, x); s = Math.min(s, y); n = Math.max(n, y); }
  return [w, s, e, n];
};

/** A square the size of the lot around a point, when no parcel outline is known yet. */
const lotBox = ([lng, lat]: LngLat, lotAc = 0.2): BBox => {
  const side = Math.sqrt(Math.max(0.05, lotAc) * 4046.86); // m
  const dx = side / 2 / metersPerDegLng(lat), dy = side / 2 / metersPerDegLat;
  return [lng - dx, lat - dy, lng + dx, lat + dy];
};

/** The outline of the parcel under a point, merged across tiles (parcels split at tile edges). */
function parcelBoxAt(m: MbMap, at: LngLat): BBox | null {
  if (!m.getLayer("bz-par-fill")) return null;
  const hit = m.queryRenderedFeatures(m.project(at), { layers: ["bz-par-fill"] })[0];
  if (!hit || hit.id === undefined) return null;
  const opts = hasRegrid() ? { sourceLayer: config.regridSourceLayer } : {};
  const parts = m.querySourceFeatures("bz-par", opts).filter(f => f.id === hit.id);
  let box: BBox | null = null;
  for (const f of parts.length ? parts : [hit]) {
    const g = f.geometry;
    const rings = g.type === "Polygon" ? g.coordinates : g.type === "MultiPolygon" ? g.coordinates.flat() : [];
    for (const r of rings) {
      const b = bboxOf(r as number[][]);
      box = box ? [Math.min(box[0], b[0]), Math.min(box[1], b[1]), Math.max(box[2], b[2]), Math.max(box[3], b[3])] : b;
    }
  }
  return box;
}

let frameRun = 0;

/**
 * Fit the lot into the free space. `left` is the right edge of the right-most
 * panel and `top` the bottom of the filter bar, both in map-container px.
 * With only a point (a listing), it fits a lot-sized square first, then, once
 * the parcel layer has drawn there, settles on the real parcel outline.
 */
export function frameLot(m: MbMap, opts: { ring?: number[][] | null; at: LngLat; lotAc?: number; left: number; top: number }) {
  const run = ++frameRun;
  const c = m.getContainer();
  const freeW = c.clientWidth - opts.left, freeH = c.clientHeight - opts.top;
  // keep the margin proportionate when the free space is small
  const pad = Math.max(16, Math.min(FRAME_PAD, freeW / 6, freeH / 6));
  const padding = { left: opts.left + pad, right: pad, top: opts.top + pad, bottom: pad };
  const fit = (b: BBox, duration: number) => m.fitBounds([[b[0], b[1]], [b[2], b[3]]], { padding, maxZoom: MAX_ZOOM, duration });
  if (opts.ring && opts.ring.length > 2) { fit(bboxOf(opts.ring), 800); return; }
  fit(lotBox(opts.at, opts.lotAc), 800);
  // refine on the real parcel once it is drawn (skip if the user moved meanwhile or picked again)
  m.once("idle", () => {
    if (run !== frameRun) return;
    const b = parcelBoxAt(m, opts.at);
    if (b) fit(b, 450);
  });
}
