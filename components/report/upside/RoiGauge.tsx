"use client";
// Pedro's RoiGauge (underbuilt-roi src/components/RoiGauge.tsx, Figma 441:33533):
// an arc of tapered bars, a needle on the value, the caption and number below.
// Breezy change: the bars take the map's ROI palette and bands (lib/heat, the
// Heat switcher's current pick), so the gauge reads in the same colours as the
// ROI hexes and parcels.
import { useId } from "react";
import { HEAT_PALETTES, bandsFor, useHeatPrefs } from "@/lib/heat";
import { rampAt, scalePosition } from "@/lib/heat/scale";

const BAR = "M104.703 9.45286C104.197 4.39171 108.172 0 113.258 0C118.344 0 122.319 4.3917 121.813 9.45285L119.305 34.5273C118.995 37.6341 116.38 40 113.258 40C110.136 40 107.521 37.6341 107.211 34.5273L104.703 9.45286Z";
const NEEDLE = "M4.6195 2.54117C4.68821 1.11832 5.86184 0 7.28635 0C8.71086 0 9.88449 1.11832 9.9532 2.54117L14.5644 98.023C14.7573 102.017 11.5711 105.361 7.57253 105.361H7.00016C3.00159 105.361 -0.184563 102.017 0.00831821 98.023L4.6195 2.54117Z";
const NEEDLE_PX = 7.29, NEEDLE_PY = 98.07, NEEDLE_LEN = 105.361;
const N_BARS = 13;
const OX = 5.36, OY = 0.43, CX = 113.26, CY = 116, FIRST = 162.3, LAST = 18.3, PIVOT_Y = 108.4;
const W = 238.225, H = 118.268;
const SWEEP = 76.6;

export function RoiGauge({ pct, months, cap }: { pct: number; months: number; cap?: string }) {
  const prefs = useHeatPrefs();
  const colors = HEAT_PALETTES[prefs.roi].c;
  const bands = bandsFor("roi", colors.length);
  const pos = Math.max(0, Math.min(1, scalePosition(pct, bands)));
  const deg = 90 + SWEEP - pos * 2 * SWEEP, lit = Math.round(pos * (N_BARS - 1)) + 1;
  const bars = Array.from({ length: N_BARS }, (_, i) => `rgb(${rampAt(i / (N_BARS - 1), colors).map(Math.round).join(" ")})`);
  const label = cap ?? `Estimated ROI over ${months} months`;
  const ink = `${useId().replace(/:/g, "")}-needle`;
  return (
    <div className="ub-gauge">
      <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} role="img" aria-label={`${pct}% estimated return over ${months} months`}>
        <defs>
          <linearGradient id={ink} x1={NEEDLE_PX} y1={0} x2={NEEDLE_PX} y2={NEEDLE_LEN} gradientUnits="userSpaceOnUse">
            <stop stopColor="#4A2E27" />
            <stop offset="1" stopColor="#271A16" />
          </linearGradient>
        </defs>
        <g transform={`translate(${OX} ${OY})`}>
          {bars.map((fill, i) => (
            <path key={i} d={BAR} fill={fill} opacity={i < lit ? undefined : 0.3}
              transform={`rotate(${90 - (FIRST - i * ((FIRST - LAST) / (N_BARS - 1)))} ${CX} ${CY})`} />
          ))}
          <path d={NEEDLE} fill={`url(#${ink})`}
            transform={`translate(${CX} ${PIVOT_Y}) rotate(${90 - deg}) translate(${-NEEDLE_PX} ${-NEEDLE_PY})`} />
        </g>
      </svg>
      <div className="txt">
        {label && <p className="cap">{label}</p>}
        <p className="val">{pct < 0 ? `−${-pct}` : pct}<span>%</span></p>
      </div>
    </div>
  );
}
