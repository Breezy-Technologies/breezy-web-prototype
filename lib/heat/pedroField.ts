// Pedro's placeholder ROI surface, ported as-is from pd-bittencourt/underbuilt-roi
// @ 48039b0 (src/mocks/heat.ts `roiAt`, the sea outline and the covered box), so our
// LA hexes tell the same story as his map: Beverly Hills is the hotspot, the warm
// country around it cools off over ~10 km, and the rest of Los Angeles gets gentle
// hills and hollows every few kilometres. Values are ROI %.

/** The area Pedro's heat layers cover: past Thousand Oaks to beyond Downtown. */
export const LA_BOX = { west: -119.08, south: 33.86, east: -118.05, north: 34.28 };
/** [lat, lng] ring for h3's polygonToCells. */
export const LA_BOX_LATLNG = [[LA_BOX.north, LA_BOX.west], [LA_BOX.north, LA_BOX.east], [LA_BOX.south, LA_BOX.east], [LA_BOX.south, LA_BOX.west]];
export const inLaBox = (lng: number, lat: number) => lng >= LA_BOX.west && lng <= LA_BOX.east && lat >= LA_BOX.south && lat <= LA_BOX.north;

/** The middle of the Beverly Hills flats, between Sunset and Olympic. */
const BH = { lat: 34.0712, lon: -118.4035 };
const KM_PER_DEG_LAT = 111.0;
const KM_PER_DEG_LON = 111.32 * Math.cos((34.07 * Math.PI) / 180);

/* The Pacific inside the covered area, traced by hand from Point Mugu round Santa
   Monica Bay to Redondo Beach. Keeps values off the water; the map clips the colour
   to the basemap's exact coastline (water drawn again over the heat). */
const SEA: [number, number][] = [
  [-119.2, 34.14], [-119.1, 34.1], [-119.061, 34.085], [-119.015, 34.071], [-118.99, 34.064],
  [-118.934, 34.044], [-118.87, 34.029], [-118.822, 34.015], [-118.812, 34.005], [-118.806, 34.0],
  [-118.787, 34.019], [-118.75, 34.029], [-118.73, 34.034], [-118.681, 34.032], [-118.65, 34.036],
  [-118.62, 34.037], [-118.582, 34.038], [-118.555, 34.038], [-118.54, 34.034], [-118.52, 34.025],
  [-118.497, 34.009], [-118.48, 33.99], [-118.47, 33.978], [-118.458, 33.962], [-118.44, 33.93],
  [-118.428, 33.915], [-118.412, 33.884], [-118.402, 33.862], [-118.392, 33.84], [-118.394, 33.815],
  [-118.4, 33.6], [-119.2, 33.6],
];
export function inSea(lat: number, lon: number) {
  let hit = false;
  for (let i = 0, j = SEA.length - 1; i < SEA.length; j = i++) {
    const [xi, yi] = SEA[i], [xj, yj] = SEA[j];
    if ((yi > lat) !== (yj > lat) && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) hit = !hit;
  }
  return hit;
}

/* ---- smooth value noise ---- */
function hash(ix: number, iy: number, seed: number) {
  let h = Math.imul(ix, 374761393) ^ Math.imul(iy, 668265263) ^ Math.imul(seed, 2147483647);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}
const fade = (t: number) => t * t * t * (t * (t * 6 - 15) + 10);
function noise(x: number, y: number, seed: number) {
  const ix = Math.floor(x), iy = Math.floor(y);
  const fx = fade(x - ix), fy = fade(y - iy);
  const a = hash(ix, iy, seed), b = hash(ix + 1, iy, seed);
  const c = hash(ix, iy + 1, seed), d = hash(ix + 1, iy + 1, seed);
  return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy;
}
/** Four octaves, 0–1, mean near 0.5. */
function fbm(x: number, y: number, seed: number) {
  let sum = 0, amp = 0.5, norm = 0, f = 1;
  for (let o = 0; o < 4; o++) {
    sum += amp * noise(x * f, y * f, seed + o * 17);
    norm += amp;
    amp *= 0.5;
    f *= 2.03;
  }
  return sum / norm;
}

/** Pedro's placeholder ROI %, anywhere (it's defined everywhere, tuned for LA). */
export function roiAt(lat: number, lon: number): number {
  const x = (lon - BH.lon) * KM_PER_DEG_LON;
  const y = (lat - BH.lat) * KM_PER_DEG_LAT;
  // the rest of the city: gentle hills and hollows every few kilometres
  const base = -4 + 26 * fbm(x / 7 + 40, y / 7 + 40, 1);
  // warp distance a little so the hotspot's edge is organic, not a circle
  const wx = x + 1.4 * (fbm(x / 3, y / 3, 7) - 0.5);
  const wy = y + 1.4 * (fbm(x / 3, y / 3, 11) - 0.5);
  // Beverly Hills itself: a plateau over the flats, about 5 by 4 km
  const r = Math.hypot(wx / 2.6, wy / 2.1);
  const core = Math.exp(-(r ** 4));
  // and the warm country around it, cooling over ~10 km
  const d = Math.hypot(wx, wy);
  const region = Math.exp(-((d / 8.5) ** 2));
  return base * (1 - 0.6 * core) + 24 * region + 44 * core;
}

/** Distance in km from a point to the LA box (0 inside). */
export function kmFromLaBox(lng: number, lat: number) {
  const dx = Math.max(LA_BOX.west - lng, 0, lng - LA_BOX.east) * 111.32 * Math.cos((lat * Math.PI) / 180);
  const dy = Math.max(LA_BOX.south - lat, 0, lat - LA_BOX.north) * KM_PER_DEG_LAT;
  return Math.hypot(dx, dy);
}
