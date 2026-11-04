# Breezy web prototype

A standalone Next.js app that runs the **V5 onboarding and activation flow** and hands off into the **Home Web** experience. Both use the same Mapbox map instance: the camera, layers and selected area carry over with no reload.

## Run it

```bash
npm install
cp .env.example .env.local   # optional; the app runs without any keys
npm run dev                  # http://localhost:3000 → /onboarding
```

- `/onboarding` covers area picker, radar scan, AI comps / Underbuilt / ROI cards, heat map, alerts, sign-up and personalisation cards. "Build my feed" goes to Home Web.
- `/home` is Home Web: side nav, search, For you / Searches / Properties, results, price pins with cluster pills, pin preview, parcel lift, detail panel, layers, and the comps flow.

## Keys and data sources

Everything is optional. Without keys the app runs **offline**: bundled Beverly Hills / Silver Lake map images, generated parcels and a small place list.

| Variable | Used for | Without it |
|---|---|---|
| `NEXT_PUBLIC_MAPBOX_TOKEN` | Live Mapbox base map, satellite and place search (Geocoding v6) | Offline images + built-in place list |
| `NEXT_PUBLIC_MAPBOX_STYLE` | Base style. Can be swapped for the Breezy style, e.g. `mapbox://styles/dev-breezy/<id>` | `mapbox/light-v11` |
| `NEXT_PUBLIC_MAPBOX_SATELLITE_STYLE` | Satellite toggle | `mapbox/satellite-streets-v12` |
| `NEXT_PUBLIC_REGRID_TOKEN` | Real parcel lines (Regrid vector tiles). Hover / lift / click use them | Generated demo parcels |
| `NEXT_PUBLIC_REGRID_TILE_URL`, `NEXT_PUBLIC_REGRID_SOURCE_LAYER` | Regrid tile endpoint and layer name | See `.env.example` |
| `TIGERWEB_URL` | City / ZIP / county / state outlines from the US Census (server route `/api/boundary`, no key) | Hand-drawn outlines for Beverly Hills, West Hollywood, Silver Lake |

Lock the Mapbox token to the prototype's domain in the Mapbox account before sharing a link. Regrid's tile URL and field names (`ll_uuid`, `address`, `owner`) should be confirmed against your Regrid plan. The parcel code reads them defensively.

## Breezy data is fake on purpose

`lib/fake.ts` generates listings, opportunity types, owners, quick estimates, ROI and Underbuilt heat values per area. The values are seeded, so each place is stable between visits. Replace those functions with real API calls as the services come online:

- listings / pins → listings API
- `heatValue` → JD's heat-map service
- `owner` → owner data service
- `qe` → Justin's quick-estimate endpoint

## Where things live

```
app/layout.tsx              root layout; holds the one shared map (MapProvider)
app/onboarding/page.tsx     V5 onboarding + activation
app/home/page.tsx           Home Web
app/api/boundary/route.ts   Census TIGERweb boundary lookup
components/map/             MapProvider (shared map, inset, heat, area), overlay portal
components/home/            side nav, search, panels, pins, hover card, parcel lift, detail, layers, comps
components/onboarding/      opportunity pins
lib/map/                    styles (live / offline) and Breezy layers (heat hexes, parcels, area glow)
lib/places.ts               search + boundaries (Mapbox → Census → offline gazetteer)
lib/fake.ts                 demo data
```

## Deploy

Works on Vercel or any Node host: `npm run build && npm start`. Set the env vars in the host's dashboard.
