import { config, isLiveMap } from "./config";
import { BBox, LngLat, Ring, anticlockwise, clockwise, closeRing, ringBBox } from "./geo";

// "area": a map viewport searched with "Search this area" (no boundary, bbox only).
export type PlaceKind = "place" | "postcode" | "region" | "district" | "neighborhood" | "locality" | "address" | "area";

export type Place = {
  id: string;
  name: string; // "Beverly Hills"
  label: string; // "Beverly Hills, CA"
  sub: string; // "City" / "ZIP" / "Neighborhood"...
  kind: PlaceKind;
  center: LngLat;
  bbox?: BBox;
  rings?: Ring[]; // offline outline when no boundary service is reachable
};

// Offline gazetteer. Outlines are hand-drawn approximations used only when the
// Census boundary service can't be reached (e.g. inside a sandbox).
const BH: Ring = [[-118.427,34.083],[-118.43,34.0905],[-118.425,34.0985],[-118.414,34.106],[-118.4,34.109],[-118.392,34.101],[-118.3895,34.093],[-118.3905,34.086],[-118.388,34.079],[-118.383,34.07],[-118.389,34.059],[-118.399,34.056],[-118.41,34.059],[-118.418,34.064],[-118.4235,34.0675],[-118.427,34.072],[-118.429,34.078]];
const WEHO: Ring = [[-118.3895,34.093],[-118.37,34.0985],[-118.345,34.1],[-118.344,34.09],[-118.353,34.082],[-118.37,34.078],[-118.383,34.075],[-118.388,34.079],[-118.3905,34.086]];
const SL: Ring = [[-118.285,34.074],[-118.286,34.086],[-118.276,34.099],[-118.264,34.108],[-118.253,34.102],[-118.256,34.09],[-118.26,34.079],[-118.27,34.074]];

const mk = (id: string, name: string, label: string, sub: string, kind: PlaceKind, center: LngLat, ring?: Ring, bbox?: BBox): Place => {
  const rings = ring ? [clockwise(closeRing(ring))] : undefined;
  return { id, name, label, sub, kind, center, rings, bbox: bbox || (rings ? ringBBox(rings) : undefined) };
};

export const GAZETTEER: Place[] = [
  mk("bh", "Beverly Hills", "Beverly Hills, CA", "City", "place", [-118.4004, 34.0736], BH),
  mk("90210", "90210", "90210, Beverly Hills, CA", "ZIP", "postcode", [-118.4065, 34.0901], BH),
  mk("weho", "West Hollywood", "West Hollywood, CA", "City", "place", [-118.3617, 34.09], WEHO),
  mk("sl", "Silver Lake", "Silver Lake, Los Angeles", "Neighborhood", "neighborhood", [-118.2701, 34.0869], SL),
  // Echo Park / Los Feliz: the canvas "Recent searches" seeds, so they resolve offline too.
  mk("ep", "Echo Park", "Echo Park, Los Angeles", "Neighborhood", "neighborhood", [-118.2606, 34.0782], undefined, [-118.272, 34.067, -118.245, 34.09]),
  mk("lf", "Los Feliz", "Los Feliz, Los Angeles", "Neighborhood", "neighborhood", [-118.2923, 34.1063], undefined, [-118.31, 34.095, -118.275, 34.125]),
  mk("la", "Los Angeles", "Los Angeles, CA", "City", "place", [-118.2437, 34.0522], undefined, [-118.67, 33.7, -118.15, 34.34]),
  mk("sm", "Santa Monica", "Santa Monica, CA", "City", "place", [-118.4912, 34.0195], undefined, [-118.52, 33.99, -118.44, 34.05]),
  mk("pas", "Pasadena", "Pasadena, CA", "City", "place", [-118.1445, 34.1478], undefined, [-118.2, 34.11, -118.06, 34.25]),
  mk("cc", "Culver City", "Culver City, CA", "City", "place", [-118.3965, 34.0211], undefined, [-118.43, 33.98, -118.37, 34.04]),
  mk("ca", "California", "California", "State", "region", [-119.4179, 36.7783], undefined, [-124.48, 32.53, -114.13, 42.01]),
  // Dallas: where the Regrid trial has parcel coverage. Outline comes live from Census.
  mk("dallas", "Dallas", "Dallas, TX", "City", "place", [-96.797, 32.7767], undefined, [-97.0, 32.62, -96.55, 33.02]),
];

export const DEFAULT_PLACE = GAZETTEER[3]; // Silver Lake — the onboarding default
export const findPlace = (id: string) => GAZETTEER.find(p => p.id === id);

function offlineSearch(q: string): Place[] {
  // "Echo Park, CA" (a recent search) should still find "Echo Park, Los Angeles".
  const t = q.trim().toLowerCase().replace(/,\s*(ca|california)$/, "");
  if (!t) return [];
  return GAZETTEER.filter(p => p.label.toLowerCase().includes(t) || p.name.toLowerCase().startsWith(t)).slice(0, 6);
}

const SUB: Record<string, string> = { place: "City", postcode: "ZIP", region: "State", district: "County", neighborhood: "Neighborhood", locality: "Area", address: "Address" };
// Labels without the trailing ", United States" (search is US only), closer to the canvas.
const usLabel = (s: string) => s.replace(/,\s*United States$/, "");

// Mapbox Geocoding v6 forward search (US only), falling back to the gazetteer.
export async function searchPlaces(q: string, near?: LngLat): Promise<Place[]> {
  if (!isLiveMap()) return offlineSearch(q);
  try {
    const u = new URL("https://api.mapbox.com/search/geocode/v6/forward");
    u.searchParams.set("q", q);
    u.searchParams.set("access_token", config.mapboxToken);
    u.searchParams.set("country", "us");
    u.searchParams.set("autocomplete", "true");
    u.searchParams.set("limit", "6");
    u.searchParams.set("types", "region,district,place,locality,neighborhood,postcode,address");
    if (near) u.searchParams.set("proximity", near.join(","));
    // Give up after 8 s (flaky networks) and use the offline gazetteer instead.
    const r = await fetch(u.toString(), { signal: AbortSignal.timeout(8000) });
    if (!r.ok) throw new Error(String(r.status));
    const j = await r.json();
    const res: Place[] = (j.features || []).map((f: any) => {
      const p = f.properties || {};
      const kind = (p.feature_type || "place") as PlaceKind;
      return {
        id: f.id || p.mapbox_id,
        name: p.name,
        label: usLabel(p.full_address || [p.name, p.place_formatted].filter(Boolean).join(", ")),
        sub: SUB[kind] || "Place",
        kind,
        center: f.geometry.coordinates as LngLat,
        bbox: p.bbox as BBox | undefined,
      };
    });
    return res.length ? res : offlineSearch(q);
  } catch {
    return offlineSearch(q);
  }
}

// Outline for a place: Census TIGERweb via our API route, else gazetteer ring.
export async function placeBoundary(p: Place): Promise<Ring[] | null> {
  if (p.kind === "address" || p.kind === "area") return null;
  try {
    const u = `/api/boundary?kind=${p.kind}&lng=${p.center[0]}&lat=${p.center[1]}&name=${encodeURIComponent(p.name)}`;
    const r = await fetch(u);
    if (r.ok) {
      const j = await r.json();
      // Outer rings clockwise, enclave holes anticlockwise: the inner glow then
      // always lands on the area side of the line.
      if (j.rings && j.rings.length) return [...(j.rings as Ring[]).map(rg => clockwise(closeRing(rg))), ...((j.holes || []) as Ring[]).map(rg => anticlockwise(closeRing(rg)))];
    }
  } catch {}
  // Census has no neighbourhoods: reuse the gazetteer outline for a live result of the same place (e.g. Silver Lake).
  return p.rings || GAZETTEER.find(g => g.name === p.name && g.kind === p.kind)?.rings || null;
}

// Breezy's data coverage (canvas `_unsupQ`: LA / California). California plus
// Dallas, where the Regrid trial has parcels. Anything else is "Unsupported area".
const COVERAGE: BBox[] = [[-124.48, 32.53, -114.13, 42.01], [-97.0, 32.62, -96.55, 33.02]];
export const isCovered = (p: Place) => COVERAGE.some(([w, s, e, n]) => p.center[0] >= w && p.center[0] <= e && p.center[1] >= s && p.center[1] <= n);

// "Search this area": the visible map viewport as a searchable place. The id is the
// bbox rounded to ~100 m, so the same view always gives the same fake listings.
export const MAP_AREA = "Map area";
export function viewportPlace(bb: BBox): Place {
  const r = (v: number) => v.toFixed(3);
  return { id: "map:" + bb.map(r).join(","), name: MAP_AREA, label: MAP_AREA, sub: "Map area", kind: "area", center: [(bb[0] + bb[2]) / 2, (bb[1] + bb[3]) / 2], bbox: bb };
}

// Search-field area labels (canvas `_areaSq`): "A", "A, B", "A, B +1 more".
export function areaSq(labels: string[]): string {
  if (!labels.length) return "";
  const nm = labels.map(c => c.split(",")[0]);
  return labels.length === 1 ? labels[0] : nm.length === 2 ? nm.join(", ") : nm.slice(0, 2).join(", ") + " +" + (nm.length - 2) + " more";
}

// Nearest neighbourhood / city for a point (Mapbox reverse geocoding, else the closest gazetteer place).
export async function reversePlace(c: LngLat): Promise<Place> {
  const d = (p: Place) => Math.hypot(p.center[0] - c[0], p.center[1] - c[1]);
  const nearest = () => GAZETTEER.filter(p => p.kind !== "region").reduce((a, b) => (d(a) <= d(b) ? a : b));
  if (!isLiveMap()) return nearest();
  try {
    const u = new URL("https://api.mapbox.com/search/geocode/v6/reverse");
    u.searchParams.set("longitude", String(c[0]));
    u.searchParams.set("latitude", String(c[1]));
    u.searchParams.set("access_token", config.mapboxToken);
    u.searchParams.set("types", "neighborhood,locality,place");
    u.searchParams.set("limit", "1");
    const r = await fetch(u.toString(), { signal: AbortSignal.timeout(8000) });
    if (!r.ok) throw new Error(String(r.status));
    const f = (await r.json()).features?.[0];
    if (!f) return nearest();
    const p = f.properties || {}, kind = (p.feature_type || "place") as PlaceKind;
    return { id: f.id || p.mapbox_id, name: p.name, label: usLabel(p.full_address || [p.name, p.place_formatted].filter(Boolean).join(", ")), sub: SUB[kind] || "Place", kind, center: c, bbox: p.bbox as BBox | undefined };
  } catch {
    return nearest();
  }
}

// The browser's position, falling back to `fallback` (the map centre) when it's denied or slow.
export function currentPosition(fallback: LngLat): Promise<LngLat> {
  return new Promise(res => {
    if (typeof navigator === "undefined" || !navigator.geolocation) return res(fallback);
    const t = setTimeout(() => res(fallback), 6000);
    navigator.geolocation.getCurrentPosition(
      p => { clearTimeout(t); res([p.coords.longitude, p.coords.latitude]); },
      () => { clearTimeout(t); res(fallback); },
      { timeout: 5500, maximumAge: 60000 });
  });
}

// An area chip in the search field: a label, resolved to a Place when known.
export type Area = { label: string; place?: Place };
export const CURRENT_LOCATION = "Current location";

// Resolve a chip to a Place: "Current location" via geolocation + reverse
// geocoding; other labels through the same search the field uses.
export async function resolveArea(a: Area, near?: LngLat): Promise<Place | null> {
  if (a.place) return a.place;
  if (a.label === CURRENT_LOCATION) {
    const c = await currentPosition(near || DEFAULT_PLACE.center);
    return { ...(await reversePlace(c)), label: CURRENT_LOCATION };
  }
  const r = await searchPlaces(a.label, near);
  return r.find(p => p.kind !== "address") || null;
}
