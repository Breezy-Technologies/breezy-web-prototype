import { config, isLiveMap } from "./config";
import { BBox, LngLat, Ring, anticlockwise, clockwise, closeRing, ringBBox } from "./geo";

export type PlaceKind = "place" | "postcode" | "region" | "district" | "neighborhood" | "locality" | "address";

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
  const t = q.trim().toLowerCase();
  if (!t) return [];
  return GAZETTEER.filter(p => p.label.toLowerCase().includes(t) || p.name.toLowerCase().startsWith(t)).slice(0, 6);
}

const SUB: Record<string, string> = { place: "City", postcode: "ZIP", region: "State", district: "County", neighborhood: "Neighborhood", locality: "Area", address: "Address" };

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
    const r = await fetch(u.toString());
    if (!r.ok) throw new Error(String(r.status));
    const j = await r.json();
    const res: Place[] = (j.features || []).map((f: any) => {
      const p = f.properties || {};
      const kind = (p.feature_type || "place") as PlaceKind;
      return {
        id: f.id || p.mapbox_id,
        name: p.name,
        label: p.full_address || [p.name, p.place_formatted].filter(Boolean).join(", "),
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
  if (p.kind === "address") return null;
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
  return p.rings || null;
}
