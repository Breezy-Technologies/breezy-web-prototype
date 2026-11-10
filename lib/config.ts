// Central runtime configuration. Everything is optional: without keys the app
// runs offline on bundled map images, generated parcels and a small gazetteer.
export const config = {
  mapboxToken: process.env.NEXT_PUBLIC_MAPBOX_TOKEN || "",
  mapboxStyle: process.env.NEXT_PUBLIC_MAPBOX_STYLE || "mapbox://styles/mapbox/light-v11",
  // The Breezy basemap (light and dark are config presets of it, lib/map/breezyTheme.ts).
  // Default: Pedro's BZYREPORT-LIGHTTHEME in the dev-breezy account, Mapbox Standard "faded".
  // Swap for the duplicated, tuned Breezy style once it exists in Studio.
  mapboxBreezyStyle: process.env.NEXT_PUBLIC_MAPBOX_BREEZY_STYLE || "mapbox://styles/dev-breezy/cmgfg4m3e007y01re4uq6bz83",
  mapboxSatelliteStyle:
    process.env.NEXT_PUBLIC_MAPBOX_SATELLITE_STYLE || "mapbox://styles/mapbox/satellite-streets-v12",
  regridToken: process.env.NEXT_PUBLIC_REGRID_TOKEN || "",
  regridTileUrl:
    process.env.NEXT_PUBLIC_REGRID_TILE_URL ||
    "https://tiles.regrid.com/api/v1/parcels/{z}/{x}/{y}.mvt?token={token}",
  regridSourceLayer: process.env.NEXT_PUBLIC_REGRID_SOURCE_LAYER || "parcels",
};

export const isLiveMap = () => config.mapboxToken.startsWith("pk.");
export const hasRegrid = () => !!config.regridToken;
