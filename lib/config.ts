// Central runtime configuration. Everything is optional: without keys the app
// runs offline on bundled map images, generated parcels and a small gazetteer.
export const config = {
  mapboxToken: process.env.NEXT_PUBLIC_MAPBOX_TOKEN || "",
  mapboxStyle: process.env.NEXT_PUBLIC_MAPBOX_STYLE || "mapbox://styles/mapbox/light-v11",
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
