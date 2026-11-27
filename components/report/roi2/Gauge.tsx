"use client";
import { useId } from 'react';

import { gaugeReading } from './roiScale';
/* the caption and number styles (.ub-gauge .txt) */
import './RoiGauge.css';

/**
 * Figma roi/gauge (5954:4234), the v2 gauge shared by web and iOS: 17 bars on
 * the map colour scale, blue → yellow → red, and a needle on the last lit bar.
 * Bars past the needle sit at 30%. v1 keeps its 13-bar RoiGauge.
 *
 * "Bars lit" is round(position × 16) + 1, with the position from
 * scalePosition() (the component's own description), which is what
 * gaugeReading() returns. Below 0% it is 1; above the top band, 17.
 *
 * The caption and the number below are v1's (RoiGauge), unchanged.
 */

/** Each bar's colour, left to right, as the component paints it. */
const COLORS = [
  '#2C7BB6', '#468AB5', '#6199B5', '#7BA8B4', '#96B7B4', '#B0C5B3', '#CAD4B2', '#E5E3B2', '#FFF2B1',
  '#FAD79E', '#F5BC8C', '#F0A079', '#EB8567', '#E66A54', '#E14F41', '#DC332F', '#D7181C',
];
const BARS = COLORS.length;
/** Degrees between two bars: half a turn over 16 gaps. */
const STEP = 180 / (BARS - 1);

/* The arc's centre, where the bars fan out and the needle turns. */
const CX = 115.5, CY = 119.5;

/** The needle standing upright, foot on the centre (variant "Bars lit=9"). */
const NEEDLE = 'M112.513 12.8914C112.59 11.2979 113.905 10.0454 115.5 10.0454C117.095 10.0454 118.41 11.2979 118.487 12.8914L123.636 119.51C123.86 124.157 120.153 128.048 115.5 128.048C110.847 128.048 107.14 124.157 107.364 119.51L112.513 12.8914Z';

/** Desktop is 231 × 132; Mobile is the same drawing at 162 × 93. */
const SIZES = { desktop: 1, mobile: 162.12 / 231 } as const;
const W = 231, H = 132;

interface Props {
  /** Whole percent. `null` before there is a sale price: every bar at 30%, no needle, "—" (Figma No comparable sales, step 1). */
  pct: number | null;
  months: number;
  /** Pass '' for no caption. */
  cap?: string;
  size?: keyof typeof SIZES;
}

export function Gauge17({ pct, months, cap, size = 'desktop' }: Props) {
  const lit = pct === null ? 0 : gaugeReading(pct, BARS).lit;
  const label = cap ?? `Estimated ROI over ${months} months`;
  const ink = `${useId()}-needle`;
  const k = SIZES[size];

  return (
    <div className={`ub-gauge v2-gauge ${size}`}>
      <svg
        viewBox={`0 0 ${W} ${H}`} width={W * k} height={H * k}
        role="img" aria-label={pct === null ? 'No return yet: add a sale price' : `${pct}% estimated return over ${months} months`}
      >
        <defs>
          <linearGradient id={ink} x1={CX} y1={10.05} x2={CX} y2={128.05} gradientUnits="userSpaceOnUse">
            <stop stopColor="#4A2E27" />
            <stop offset="1" stopColor="#271A16" />
          </linearGradient>
        </defs>
        {/* bar 1 lies flat on the left; each next one turns 11.25° clockwise about the centre */}
        {COLORS.map((fill, i) => (
          <rect
            key={fill} x={2} y={115.5} width={29} height={8} rx={4} fill={fill}
            opacity={i < lit ? undefined : 0.3}
            transform={i ? `rotate(${i * STEP} ${CX} ${CY})` : undefined}
          />
        ))}
        {/* upright is bar 9; the needle turns from there to the last lit bar */}
        {lit > 0 && <path d={NEEDLE} fill={`url(#${ink})`} transform={`rotate(${(lit - 1) * STEP - 90} ${CX} ${CY})`} />}
      </svg>
      <div className="txt">
        {label && <p className="cap">{label}</p>}
        {pct === null
          ? <p className="val none">—</p>
          : <p className="val">{pct < 0 ? `−${-pct}` : pct}<span>%</span></p>}
      </div>
    </div>
  );
}
