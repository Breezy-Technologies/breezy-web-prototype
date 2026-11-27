"use client";
const ring1Url = "/report/hood/ring-1.png";
const ring2Url = "/report/hood/ring-2.png";
const ring3Url = "/report/hood/ring-3.png";
const wedgeUrl = "/report/hood/wedge.png";
const pin1Url = "/report/hood/pin-1.svg";
const pin2Url = "/report/hood/pin-2.svg";
const pin3Url = "/report/hood/pin-3.svg";

/**
 * Figma 234:73377 — the comps illustration: rings around the subject with
 * three markers on it. Every piece is the export, placed on the design's
 * 132.5px square in its paint order, so nothing here is drawn by hand.
 */
const PIECES: { src: string; x: number; y: number; w: number; h: number; o?: number }[] = [
  { src: ring1Url, x: 10.94, y: 0.42, w: 121.143, h: 121.143, o: 0.46 },
  { src: pin1Url, x: 43.05, y: -2.2, w: 64.5, h: 64.5 },
  { src: pin2Url, x: 75.23, y: 50.8, w: 62.62, h: 62.62 },
  { src: ring2Url, x: 31.13, y: 20.61, w: 80.762, h: 80.762 },
  { src: ring3Url, x: 51.32, y: 40.8, w: 40.381, h: 40.381 },
  { src: wedgeUrl, x: -18.53, y: 38.87, w: 121.649, h: 121.285 },
  { src: pin3Url, x: 3.3, y: 43.23, w: 68.3, h: 68.3 },
];

export function HoodArt() {
  return (
    <span className="rp-hoodart" aria-hidden="true">
      {PIECES.map((p, i) => (
        <img
          key={i} src={p.src} alt="" width={p.w} height={p.h}
          style={{ left: `${p.x}px`, top: `${p.y}px`, width: `${p.w}px`, height: `${p.h}px`, opacity: p.o }}
        />
      ))}
    </span>
  );
}
