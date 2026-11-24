"use client";
// The lot on the Build guidelines page (Figma "un/map/on-page", e.g. 6032:30752): the
// lot's own outline with its buildable area hatched, the house as it stands (white), the
// neighbouring lots greyed with their house numbers, and a "Buildable area" tag. Under it:
// Streets (the drawn plan), 3D (the plan tilted), Satellite (Mapbox Static under the
// outline) and Fullscreen. The slope case lays a terrain grid over the satellite view.
//
// Real outlines for Pedro's Silver Lake lots (and his building footprints, loaded on
// demand); elsewhere a lot-sized rectangle stands in. Offline, satellite falls back to
// the plan.
import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import type { Listing } from "@/lib/fake";
import { LOTS, lotOfId } from "@/lib/silverlake";
import { config } from "@/lib/config";
import { rng, hashStr } from "@/lib/geo";

type Pt = [number, number];
type Mode = "streets" | "3d" | "satellite";
const W = 800, H = 418;
const M_LAT = 110_540;

let bldgs: Pt[][] | null = null, bldgsP: Promise<Pt[][]> | null = null;
const loadBldgs = () => (bldgsP ??= fetch("/data/silverlake-bldgs.json").then(r => r.json())
  .then((g: { features: { geometry: { coordinates: Pt[][] } }[] }) => (bldgs = g.features.map(f => f.geometry.coordinates[0])))
  .catch(() => (bldgs = [])));

/** Even-odd ray cast: is the point inside the ring? */
const inside = (p: Pt, r: Pt[]) => {
  let o = false;
  for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
    const [xi, yi] = r[i], [xj, yj] = r[j];
    if ((yi > p[1]) !== (yj > p[1]) && p[0] < ((xj - xi) * (p[1] - yi)) / (yj - yi) + xi) o = !o;
  }
  return o;
};
const centroid = (r: Pt[]): Pt => { let x = 0, y = 0; for (const p of r) { x += p[0]; y += p[1]; } return [x / r.length, y / r.length]; };

export function LotPlan({ l, lotFt, lotW, lotD, buildable, house, slope, satellite: satDefault, setbacks }: {
  l: Listing; lotFt: number; lotW: number; lotD: number; buildable: number; house: boolean; slope?: boolean; satellite?: boolean;
  setbacks: { F: number; Sd: number; Rr: number };
}) {
  const [mode, setMode] = useState<Mode>(satDefault || slope ? "satellite" : "streets");
  const [full, setFull] = useState(false);
  useEffect(() => { setMode(satDefault || slope ? "satellite" : "streets"); }, [satDefault, slope]);
  useEffect(() => {
    if (!full) return;
    const k = (e: KeyboardEvent) => { if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); setFull(false); } };
    window.addEventListener("keydown", k, true);
    return () => window.removeEventListener("keydown", k, true);
  }, [full]);

  const map = <Plan l={l} lotFt={lotFt} lotW={lotW} lotD={lotD} buildable={buildable} house={house} slope={slope} mode={mode} setbacks={setbacks} />;
  const modes: [Mode | "full", string, string][] = [["streets", "Streets", "streets"], ["3d", "3D", "3d"], ["satellite", "Satellite", "sat"], ["full", "Fullscreen", "full"]];
  const bar = (
    <div className="bg-modes" role="group" aria-label="Map view">
      {modes.map(([k, label, ic]) => (
        <button key={k} type="button" aria-pressed={k === mode || (k === "full" && full)} className={k === mode ? "on" : undefined}
          onClick={() => (k === "full" ? setFull(f => !f) : setMode(k))}>
          <span className={`ic ${ic}`} aria-hidden="true" />{k === "full" && full ? "Exit fullscreen" : label}
        </button>
      ))}
    </div>
  );
  return (
    <div className="bg-map">
      {map}
      {bar}
      {full && createPortal(
        <div className="bg-full" role="dialog" aria-label="Lot map, fullscreen" onClick={e => { if (e.target === e.currentTarget) setFull(false); }}>
          <div className="box">
            {map}
            {bar}
          </div>
        </div>, document.body)}
    </div>
  );
}

function Plan({ l, lotFt, lotW, lotD, buildable, house, slope, mode, setbacks }: {
  l: Listing; lotFt: number; lotW: number; lotD: number; buildable: number; house: boolean; slope?: boolean; mode: Mode;
  setbacks: { F: number; Sd: number; Rr: number };
}) {
  const real = lotOfId(l.id);
  const [, force] = useState(0);
  useEffect(() => { if (real && !bldgs) loadBldgs().then(() => force(n => n + 1)); }, [real]);
  const [satOk, setSatOk] = useState(true);

  const g = useMemo(() => {
    const c: Pt = real ? real.c : [l.lng, l.lat];
    const kx = Math.cos((c[1] * Math.PI) / 180) * 111_320;
    const toM = (p: Pt): Pt => [(p[0] - c[0]) * kx, -(p[1] - c[1]) * M_LAT];
    // the lot in metres, centred on its centroid
    let ring: Pt[];
    if (real && real.ring.length > 3) ring = real.ring.map(toM);
    else {
      const w = (lotW || Math.sqrt(lotFt / 2)) * 0.3048, d = (lotD || Math.sqrt(lotFt * 2)) * 0.3048;
      ring = [[-w / 2, -d / 2], [w / 2, -d / 2], [w / 2, d / 2], [-w / 2, d / 2], [-w / 2, -d / 2]];
    }
    const mc = centroid(ring.slice(0, -1));
    ring = ring.map(p => [p[0] - mc[0], p[1] - mc[1]] as Pt);
    const xs = ring.map(p => p[0]), ys = ring.map(p => p[1]);
    const span = Math.max((Math.max(...xs) - Math.min(...xs)) / (W * 0.42), (Math.max(...ys) - Math.min(...ys)) / (H * 0.7));
    const mpp = Math.max(span, 0.05); // metres per pixel
    const px = (p: Pt): Pt => [W / 2 + p[0] / mpp, H / 2 + p[1] / mpp];
    const shift = (p: Pt): Pt => px([p[0] - mc[0], p[1] - mc[1]]);
    const lotPx = ring.map(px);
    // buildable area: the lot shrunk toward its centre to the share the setbacks leave
    const wFt = lotW || Math.sqrt(lotFt / 2), dFt = lotD || Math.sqrt(lotFt * 2);
    const share = Math.max(0.15, Math.min(0.92, ((wFt - 2 * setbacks.Sd) * (dFt - setbacks.F - setbacks.Rr)) / Math.max(1, wFt * dFt)));
    const k = Math.sqrt(share);
    const build = ring.map(p => px([p[0] * k, p[1] * k + (setbacks.Rr - setbacks.F) * 0.3048 * 0.5]));
    // neighbours (Pedro's lots near this one) with their house numbers
    const near: { r: Pt[]; n: string; at: Pt }[] = [];
    if (real) {
      for (const o of LOTS) {
        if (o === real || Math.abs(o.c[0] - c[0]) > 0.0012 || Math.abs(o.c[1] - c[1]) > 0.0009) continue;
        near.push({ r: o.ring.map(p => shift(toM(p))), n: (o.addr.match(/^\d+/) || [""])[0], at: shift(toM(o.c)) });
      }
    }
    // the house: Pedro's footprint inside the lot, else a footprint-sized block
    let homes: Pt[][] = [];
    if (house && real && bldgs) {
      homes = bldgs.filter(b => inside(centroid(b), real.ring)).map(b => b.map(p => shift(toM(p))));
    }
    if (house && !homes.length) {
      const s = Math.sqrt(share) * 0.62;
      homes = [ring.map(p => px([p[0] * s * 0.95, p[1] * s * 0.7 - 2]))];
    }
    // street: along the front (the lowest edge on screen)
    const R = rng(hashStr("plan:" + l.id));
    const slopeCells: { x: number; y: number; v: number }[] = [];
    if (slope) {
      const n = 26, m = Math.round((n * H) / W), cw = W / n, ch = H / m;
      const a = R() * 6, b = R() * 6;
      for (let i = 0; i < n; i++) for (let j = 0; j < m; j++) {
        const v = 0.5 + 0.28 * Math.sin(i * 0.42 + a + j * 0.18) + 0.22 * Math.cos(j * 0.55 + b - i * 0.21) + (R() - 0.5) * 0.18;
        slopeCells.push({ x: i * cw, y: j * ch, v: Math.max(0, Math.min(1, v)) });
      }
    }
    const zoom = Math.log2((78271.517 * Math.cos((c[1] * Math.PI) / 180)) / mpp);
    const cLng = c[0] + mc[0] / kx, cLat = c[1] - mc[1] / M_LAT;
    return { lotPx, build, near, homes, slopeCells, zoom, cLng, cLat, mpp, cellW: W / 26, cellH: H / Math.round((26 * H) / W) };
  }, [real, l.id, l.lng, l.lat, lotFt, lotW, lotD, setbacks.F, setbacks.Sd, setbacks.Rr, house, slope, bldgs]); // eslint-disable-line react-hooks/exhaustive-deps

  const sat = mode === "satellite" && satOk && !!config.mapboxToken;
  const satUrl = sat ? `https://api.mapbox.com/styles/v1/mapbox/satellite-streets-v12/static/${g.cLng.toFixed(6)},${g.cLat.toFixed(6)},${Math.min(22, g.zoom).toFixed(2)}/${W}x${H}@2x?access_token=${config.mapboxToken}&attribution=false&logo=false` : "";
  const path = (r: Pt[]) => "M" + r.map(p => `${p[0].toFixed(1)},${p[1].toFixed(1)}`).join("L") + "Z";
  const lowest = g.lotPx.reduce((a, p) => (p[1] > a[1] ? p : a), g.lotPx[0]);
  const tag: Pt = [Math.max(80, Math.min(W - 80, lowest[0])), Math.min(H - 40, lowest[1] - 34)];
  const mid = (a: Pt, b: Pt): Pt => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  const bp = g.build;
  const tips: [Pt, string][] = bp.length > 4 ? [[mid(bp[0], bp[1]), `Rear setback · ${setbacks.Rr} ft`], [mid(bp[1], bp[2]), `Side setback · ${setbacks.Sd} ft`], [mid(bp[2], bp[3]), `Front setback · ${setbacks.F} ft`]] : [];
  const slopeCol = (v: number) => (v < 0.3 ? "#2f7fa8" : v < 0.5 ? "#45a86a" : v < 0.68 ? "#9fcf4a" : v < 0.82 ? "#f2c230" : "#e0592f");
  const buildableFt = Math.round(buildable).toLocaleString("en-US");

  return (
    <div className={`bg-plan ${mode}`} style={{ aspectRatio: `${W} / ${H}` }}>
      <div className="tilt">
        {sat && <img className="sat" src={satUrl} alt="" onError={() => setSatOk(false)} />}
        <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Lot plan: buildable area ${buildableFt} ft²`}>
          <defs>
            <pattern id="bg-hatch" width="9" height="9" patternUnits="userSpaceOnUse" patternTransform="rotate(-20)">
              <rect width="9" height="9" fill={sat ? "rgba(253,252,252,.08)" : "#ebe3e0"} />
              <line x1="0" y1="0" x2="0" y2="9" stroke={sat ? "rgba(253,252,252,.75)" : "#8e7d77"} strokeWidth="3.4" />
            </pattern>
            <pattern id="bg-hatch-n" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
              <rect width="5" height="5" fill="#e9e1de" /><line x1="0" y1="0" x2="0" y2="5" stroke="#d9cdc9" strokeWidth="1" />
            </pattern>
          </defs>
          {!sat && <rect width={W} height={H} fill="#ede6e3" />}
          {!sat && g.near.map((n, i) => <path key={i} d={path(n.r)} fill="url(#bg-hatch-n)" stroke="#cfc3bf" strokeWidth="1" />)}
          {!sat && g.near.map((n, i) => n.n && <text key={"t" + i} x={n.at[0]} y={n.at[1]} className="num">{n.n}</text>)}
          {slope && sat && g.slopeCells.map((s, i) => <rect key={i} x={s.x} y={s.y} width={g.cellW + 0.5} height={g.cellH + 0.5} fill={slopeCol(s.v)} opacity=".55" />)}
          <path d={path(g.lotPx)} fill={sat ? "none" : "#f3eeec"} stroke={sat ? "#121212" : "#625a59"} strokeWidth={sat ? 2.5 : 2} />
          {!slope && <path d={path(bp)} fill="url(#bg-hatch)" />}
          {g.homes.map((h, i) => <path key={"h" + i} d={path(h)} fill="#fdfcfc" stroke={sat ? "none" : "#fdfcfc"} />)}
          {!slope && tips.map(([p, t], i) => (
            <g key={"p" + i} className="pin" tabIndex={0} aria-label={t}>
              <circle cx={p[0]} cy={p[1]} r="11" fill="rgba(98,90,89,.22)" />
              <circle cx={p[0]} cy={p[1]} r="7" fill="#fdfcfc" stroke="#625a59" strokeWidth="2" />
              <title>{t}</title>
            </g>
          ))}
        </svg>
        {!slope && (
          <span className="tag" style={{ left: `${(tag[0] / W) * 100}%`, top: `${(tag[1] / H) * 100}%` }}>
            Buildable area<b>{buildableFt} ft²</b>
          </span>
        )}
      </div>
    </div>
  );
}
