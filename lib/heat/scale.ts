/**
 * Ported from pd-bittencourt/underbuilt-roi @ 48039b0, src/components/roiScale.ts.
 * Change from the original: bandIndex / roiColor / scalePosition take an
 * optional `bands` (default BANDS) so the Underbuilt layer can share the
 * palettes and maths with its own cut points.
 *
 * The ROI colour scale. One definition read by the heatmap layers, the
 * legend, the ranked list and RoiGauge, so the ring on a card and the hex it
 * came from are always the same colour.
 */

/* ROI bands, cut on the spread the report's model actually produces across
   the city: a quarter of lots do not pencil at all, the median lands near 9%,
   and 45%+ is the top twentieth. Whole percentages. */
export const BANDS = [0, 5, 10, 20, 30, 45] as const;
export type Bands = readonly number[];

export const PALETTES = {
  reds: {
    name: 'Red shades',
    c: ['#FEE3D8', '#FCC1AC', '#FB9272', '#F26A4B', '#DC3B2B', '#B3151B', '#7F0009'],
  },
  ylrd: {
    name: 'Light yellow → Red',
    c: ['#FFF9B8', '#FEDE75', '#FEB24C', '#FD8D3C', '#F4471F', '#D01218', '#8E0022'],
  },
  byr: {
    name: 'Blue → Yellow → Red',
    c: ['#2C7BB6', '#74ADD1', '#ABD9E9', '#FFF2B0', '#FDAE61', '#F0643C', '#D7191C'],
  },
  bgyr: {
    name: 'Blue → Green → Yellow → Red',
    c: ['#2C7BB6', '#00A6CA', '#4FC28C', '#B4E06B', '#FFD24D', '#F97E30', '#D7191C'],
  },
  rygn: {
    name: 'Red → Yellow → Green',
    c: ['#D73027', '#F46D43', '#FDAE61', '#FEE08B', '#C4E06B', '#77C35C', '#12833C'],
  },
  teal: {
    name: 'Sand → Teal',
    c: ['#FBF3E4', '#D9E9DA', '#A9D6CE', '#6FBEBE', '#3E9CA6', '#1F7285', '#0B4A5C'],
  },
  brand: {
    name: 'Lilac → Wine (brand)',
    c: ['#EFE7FA', '#D8C7F5', '#B9A3E8', '#E8C9D6', '#EE8F7E', '#C7466A', '#8E1F45'],
  },
  purp: {
    name: 'Purple shades',
    c: ['#F1EAFB', '#D9C7F2', '#BB9CE6', '#9B72D6', '#7B4FC0', '#5B319E', '#3A1970'],
  },
  virid: {
    name: 'Viridis (colour-safe)',
    c: ['#440154', '#414487', '#2A788E', '#22A884', '#7AD151', '#BDDF26', '#FDE725'],
  },
  magma: {
    name: 'Magma',
    c: ['#FCFDBF', '#FEC287', '#F1785C', '#B63679', '#721F81', '#3B0F70', '#140E36'],
  },
} as const satisfies Record<string, { name: string; c: readonly string[] }>;

export type PaletteId = keyof typeof PALETTES;
export type Colors = readonly string[];

export const DEFAULT_PALETTE: PaletteId = 'byr';

/** The first band the value falls under. 0…BANDS.length. */
export function bandIndex(v: number, bands: Bands = BANDS): number {
  for (let i = 0; i < bands.length; i++) if (v < bands[i]) return i;
  return bands.length;
}

export const roiColor = (v: number, colors: Colors, bands: Bands = BANDS): string => colors[bandIndex(v, bands)];

/**
 * Where a value sits along the scale, 0 at the low end and 1 at the high end.
 * Each band gets an equal share, exactly as the legend gives each band an
 * equal swatch, and the value interpolates inside its own band, so a gauge
 * needle reads continuously without inventing a second scale.
 */
export function scalePosition(v: number, bands: Bands = BANDS): number {
  const b = bands, n = b.length + 1, i = bandIndex(v, b);
  let lo: number, hi: number;
  if (i === 0) { hi = b[0]; lo = b[0] - Math.max(b[1] - b[0], 1); }
  else if (i === b.length) { lo = b[b.length - 1]; hi = lo + Math.max(lo - b[b.length - 2], 1); }
  else { lo = b[i - 1]; hi = b[i]; }
  const f = Math.max(0, Math.min(1, (v - lo) / Math.max(hi - lo, 1e-6)));
  return (i + f) / n;
}

const rgbOf = (c: string): [number, number, number] =>
  [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16)];

/**
 * The palette's colour at a point along the scale (0…1), blended the way the
 * heat surface paints it: each colour at the centre of its legend swatch,
 * straight lines between, held flat past the first and last.
 */
export function rampAt(pos: number, colors: Colors): [number, number, number] {
  const n = colors.length;
  const at = Math.max(0, Math.min(n - 1, pos * n - 0.5));
  const i = Math.min(n - 2, Math.floor(at)), f = at - i;
  const a = rgbOf(colors[i]), b = rgbOf(colors[i + 1]);
  return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f];
}

/* RoiGauge's needle rests a little past its end bars: −76.9° and +76.4° off
   upright in the two Figma frames (441:33533). */
const SWEEP = 76.6;

/**
 * Where RoiGauge's needle points, in degrees counter-clockwise from 3 o'clock,
 * and how many of its `bars` are lit. Off the top or bottom of the scale it
 * rests at the end.
 */
export function gaugeReading(pct: number, bars: number) {
  const pos = Math.max(0, Math.min(1, scalePosition(pct)));
  return {
    deg: 90 + SWEEP - pos * 2 * SWEEP,
    lit: Math.round(pos * (bars - 1)) + 1,
  };
}

/* One verdict per colour band, so the words and the hue always move together. */
const VERDICTS = [
  'Weak investment opportunity',
  'Marginal investment opportunity',
  'Modest investment opportunity',
  'Moderate investment opportunity',
  'Good investment opportunity',
  'Solid investment opportunity',
  'Strong investment opportunity',
];

export function verdictOf(roi: number, viable: boolean): string {
  if (!viable) return 'Already at its ceiling';
  if (roi <= 0) return 'Doesn’t pencil today';
  return VERDICTS[bandIndex(roi)];
}

/* Some palettes run pale in the middle bands (byr's #FFF2B0 on white is
   invisible as text). The ring keeps the true band colour; the words get
   darkened just enough to stay readable. */
export function readable(hex: string): string {
  const m = /^#([0-9a-f]{6})$/i.exec(hex);
  if (!m) return hex;
  const n = parseInt(m[1], 16);
  const r = n >> 16, g = (n >> 8) & 255, b = n & 255;
  const lum = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  if (lum <= 0.55) return hex;
  const k = 0.55 / lum; // scale down to the legibility floor
  const h = (v: number) => Math.round(v * k).toString(16).padStart(2, '0');
  return `#${h(r)}${h(g)}${h(b)}`;
}
