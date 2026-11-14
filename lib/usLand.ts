// The 50 states' land (Census outlines, public/data/us-states.json, scripts/fetch-us-outline.mjs),
// loaded once on demand. Shared by the US-wide heat (lib/map/usHeat.ts) and the listing grid
// ("Search this area" on a wide view keeps its pins on land, lib/fake.ts).
type State = { bb: [number, number, number, number]; ring: number[][] };
let states: State[] | null = null, loading: Promise<void> | null = null;

export function loadUsLand(): Promise<void> {
  return loading ||= fetch("/data/us-states.json").then(r => r.json()).then((d: Record<string, number[][][]>) => {
    states = Object.values(d).flat().map(ring => {
      let w = 180, s = 90, e = -180, n = -90;
      for (const [x, y] of ring) { if (x < w) w = x; if (x > e) e = x; if (y < s) s = y; if (y > n) n = y; }
      return { bb: [w, s, e, n], ring };
    });
  }).catch(() => { states = []; });
}
export const usLandReady = () => states !== null;

/** Inside a state outline. Before the outlines load (or offline), everything counts as land. */
export function onUsLand(x: number, y: number) {
  if (!states) { void loadUsLand(); return true; }
  if (!states.length) return true;
  for (const st of states) {
    const [w, s, e, n] = st.bb;
    if (x < w || x > e || y < s || y > n) continue;
    let inside = false;
    const r = st.ring;
    for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
      const [xi, yi] = r[i], [xj, yj] = r[j];
      if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
    }
    if (inside) return true;
  }
  return false;
}
