import { NextRequest, NextResponse } from "next/server";

// Boundary lookup through the US Census TIGERweb service (free, no key).
// Layer ids are discovered from the service metadata by name, so the route keeps
// working when the Census renumbers layers between vintages.
const BASE = process.env.TIGERWEB_URL || "https://tigerweb.geo.census.gov/arcgis/rest/services/TIGERweb/tigerWMS_Current/MapServer";

const LAYER_NAMES: Record<string, string[]> = {
  region: ["States"],
  district: ["Counties"],
  place: ["Incorporated Places", "Census Designated Places"],
  locality: ["Incorporated Places", "Census Designated Places"],
  postcode: ["ZIP Code Tabulation Areas"],
};

let layerCache: { id: number; name: string }[] | null = null;
const resultCache = new Map<string, { rings: number[][][]; holes: number[][][] }>();

async function layers() {
  if (layerCache) return layerCache;
  const r = await fetch(`${BASE}?f=json`, { next: { revalidate: 86400 } });
  if (!r.ok) throw new Error("tigerweb metadata " + r.status);
  const j = await r.json();
  layerCache = (j.layers || []).map((l: any) => ({ id: l.id, name: String(l.name) }));
  return layerCache!;
}

function outerRings(geom: any): number[][][] {
  if (!geom) return [];
  if (geom.type === "Polygon") return [geom.coordinates[0]];
  if (geom.type === "MultiPolygon") return geom.coordinates.map((p: number[][][]) => p[0]);
  return [];
}

// Interior rings: enclaves such as Highland Park / University Park inside Dallas.
function holeRings(geom: any): number[][][] {
  if (!geom) return [];
  const polys: number[][][][] = geom.type === "Polygon" ? [geom.coordinates] : geom.type === "MultiPolygon" ? geom.coordinates : [];
  return polys.flatMap(p => p.slice(1));
}

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const kind = sp.get("kind") || "place";
  const lng = Number(sp.get("lng")), lat = Number(sp.get("lat"));
  const names = LAYER_NAMES[kind];
  if (!names || !isFinite(lng) || !isFinite(lat)) return NextResponse.json({ rings: [] }, { status: 404 });
  const key = `${kind}:${lng.toFixed(4)},${lat.toFixed(4)}`;
  if (resultCache.has(key)) return NextResponse.json({ ...resultCache.get(key), cached: true });
  try {
    const all = await layers();
    for (const want of names) {
      const layer = all.find(l => l.name.includes(want));
      if (!layer) continue;
      const q = new URLSearchParams({
        geometry: `${lng},${lat}`,
        geometryType: "esriGeometryPoint",
        inSR: "4326",
        spatialRel: "esriSpatialRelIntersects",
        outFields: "NAME,BASENAME,GEOID",
        returnGeometry: "true",
        outSR: "4326",
        maxAllowableOffset: kind === "region" ? "0.005" : "0.0002",
        f: "geojson",
      });
      const r = await fetch(`${BASE}/${layer.id}/query?${q}`, { next: { revalidate: 86400 } });
      if (!r.ok) continue;
      const j = await r.json();
      const f = (j.features || [])[0];
      const rings = outerRings(f && f.geometry), holes = holeRings(f && f.geometry);
      if (rings.length) {
        resultCache.set(key, { rings, holes });
        return NextResponse.json({ rings, holes, name: f.properties?.NAME, layer: layer.name });
      }
    }
    return NextResponse.json({ rings: [] }, { status: 404 });
  } catch (e) {
    return NextResponse.json({ rings: [], error: String(e) }, { status: 502 });
  }
}
