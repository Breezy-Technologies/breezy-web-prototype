# Breezy web prototype — context for Claude

This file carries over the context from the design + build sessions in Claude (Cowork). Claude Code reads `CLAUDE.md` automatically at the start of every session in this repo.

## What this is

A standalone Next.js 15 + React 19 + TypeScript app that showcases Breezy's **V5 onboarding and activation flow** (`/onboarding`) handing off seamlessly into the **Home Web** core experience (`/home`). Both routes share **one Mapbox GL map instance** that lives in the root layout (`components/map/MapProvider.tsx`), so camera, layers and the chosen area carry over with no reload.

Breezy is a property-intelligence app for real-estate agents. It surfaces opportunities on a map: underbuilt lots, high ROI, price drops, expired / withdrawn / stale listings.

The source of truth for the UI design is the Claude Design canvas (pages "Home Web" and "Home Web V5 Prototype"). This repo is the coded version of it. A runnable copy of both pages lives in `design-reference/` (see its README). **Before building any Home Web UI, find the matching handlers in `design-reference/project/Home Web.dc.html` and port from there.** `design-reference/PORTING.md` tracks what is done.

## Decisions already made

- **Map provider: Mapbox.** The devs already use it in production (dev.breezy.com). Not Google Maps.
- **Parcels: Regrid** vector tiles (token pending). Until then, demo parcels are generated in `lib/map/layers.ts`.
- **City / ZIP / county / state outlines: US Census TIGERweb**, free, via the server route `app/api/boundary/route.ts`. Mapbox Geocoding v6 handles search. The hand-drawn gazetteer in `lib/places.ts` is the offline fallback only.
- **Breezy's own data stays fake** for now (`lib/fake.ts`): listings, opportunity types, owners, quick estimates, ROI / Underbuilt heat. It's deterministic per place. Each generator will later be swapped for a real service: listings API, JD's heat-map service, the owner data service, and Justin's quick-estimate endpoint.
- Offline mode (no Mapbox token) uses georeferenced Mapbox light-v11 static images for Beverly Hills and Silver Lake (`public/map/*.jpg`), plus a generated fake-satellite set (`sat-*.jpg`). Keep it working for demos without network.

## Current priority: get the live map right before more UI work

1. Add `NEXT_PUBLIC_MAPBOX_TOKEN` to `.env.local` and confirm the live style loads. The app falls back to offline after a 4 s timeout or a style error. Then set `NEXT_PUBLIC_MAPBOX_STYLE` to the Breezy custom style (dev-breezy account) so it matches production. *Status (4 Nov): done. Production doesn't use a custom style: it's stock `mapbox://styles/mapbox/streets-v12` (light) and `mapbox://styles/mapbox/navigation-night-v1` (dark), on the dev-breezy production public token (keep it to prototypes). Dark mode recolours landmass #221d1b, water #234447, greenspace #405e44 and primary roads #343434. The prototype has no dark mode yet. `lib/map/theme.ts` (a Breezy palette over light-v11) is only active if the style is set back to light-v11.*
2. Verify Mapbox search (`searchPlaces` in `lib/places.ts`) for city, ZIP, neighbourhood, county, state and address.
3. Verify `/api/boundary` returns Census outlines for each search type. Check the layer-name matching against the live TIGERweb service metadata and tune `maxAllowableOffset` for large states. Make sure rings come back clockwise, because the inner-glow edge relies on a positive `line-offset`.
4. When the Regrid token arrives: check the tile URL, `source-layer` name, the `promoteId` (`ll_uuid`) and the property fields used on hover (`address`, `owner`). Parcel hover / lift / click must work on real parcels. Building footprints can be added later. *Status (4 Nov): token added and checked. The tile URL template is right (confirmed via the TileJSON at `tiles.regrid.com/api/v1/parcels?token=`). Source layer `parcels` has fields `ll_uuid, owner, parcelnumb, address, path, fid, ogc_fid`, and hover shows the real address and owner. Limits: the token expires 4 Dec 2026, and its coverage is currently **Dallas only**, so LA (Silver Lake / Beverly Hills) parcels come back empty. Test around 32.7767, -96.7970 until LA County is added. Tiles carry no lot size or specs, so those stay fake.*
5. Replace the viewport-generated fake heat hexes with something stable (e.g. H3 cells) so they don't shift between pans. Still fake values.
6. Pins should come from a single listings source per area and refresh on "search this area" (see open design items).

None of the external services (Mapbox, Regrid, Census) could be reached from the sandbox where this was built. So everything above is **wired but untested live**: expect small fixes on first run.

## Design rules (from review feedback; keep them)

- **Side nav:** collapse toggle at the top, with the Breezy wordmark next to it when expanded and only the toggle when collapsed. Items: Map (active, dark pill), Comps, Underbuilt, AI Notes, Assistant, all 3D-style icons in `public/nav`. The footer has Upgrade to team, Reports, Settings and the avatar. No News item.
- **Price pins:** white pills with a soft drop shadow so overlaps read. Pins that would overlap a higher-priority pin collapse into small blank pills underneath, and hover reveals the price. Priority order: selected / hovered first, then price drops, then new.
- **Pin hover preview:** opens after ~220 ms and dismisses on hover-out. It has a scrollable photo carousel (arrows, dots, n/total), address, price per ft², specs, an **owner** row and a **quick estimate** chip, with "Get comps" shown as distinct from the quick estimate.
- **Parcel hover (zoom ≥ 15.4):** the parcel lifts off the map as a solid slab with a drop shadow, stacked sides, an **opaque** top and the house number. With the heat map on, the slab keeps the parcel's **heat colour**; with it off, it's neutral. In satellite: the rest of the map dims, the slab has a yellow edge, and there are no colour washes.
- **Detail panel:** photo carousel, address, specs row, and sticky tabs (Summary / Specs / Records / Owners). Summary only: a floating **Quick estimate** card with the big number and a "Get comps" button. Max build + Profit potential tiles. A separate **Owner** section titled "Owner" with "View history" on the right and a 56 px avatar. Then the listing description. "View more" buttons have no arrows. The footer is alert + share icons with a primary **Contact owner** button (no "1 credit" text); after reveal it becomes Call owner + an email icon.
- **Search field:** when a property is open it shows the address with an × that deselects it.
- **Get comps:** first "Review the subject property data", then the full-screen "Let AI do the work" takeover, then the analysis, then results.
- **Searched area outline:** option 04 "inner glow edge". A thin clay line (rgb 147,89,75) plus a soft clay gradient inside the boundary; nothing is drawn outside. The glow widens with zoom; the line stays a fixed width.
- **Map controls:** bottom-right column, from the bottom up: Layers (84 px card with thumbnail), zoom, my location, info. Layers and info panels open to the left.
- Colours: ink rgb(18,18,18), paper rgb(253,252,252), clay rgb(175,127,113), nav background rgb(245,243,243). Font: Akkurat LL (`public/fonts`). Icons: Phosphor (`public/vendor/phosphor`).

## Open design items (from the 30 Oct End of Sprint Demo)

- "Search this area" button and the draw-area tool. The trigger fires when the viewport is roughly 50% empty of pins; William is sharing the zone diagram from Figma. The draw tool's placement is still to be decided.
- The "No property found" toast should use a neutral black info icon, not a checkmark.
- Make saved reports easier to reach, like on mobile.
- Welcome-panel polish: rounder corners, no bottom padding between list items, and piece-by-piece skeleton loading.
- A comps result that has already been run should open straight away (cached).
- The "New match" badge should clear on first interaction.
- Onboarding and activation designs are due 7 Nov to unblock the China team; the full engineering handoff is end of November.

## Map

```
app/layout.tsx              root layout → AppStateProvider → MapProvider (shared map)
app/onboarding/page.tsx     V5 flow: where → radar → comps → ub → roi → heat → alerts → signup → cards
app/home/page.tsx           Home Web
app/api/boundary/route.ts   Census TIGERweb lookup
components/AppState.tsx     place, outline rings, listings, picks, onboarded (sessionStorage)
components/map/             MapProvider (inset, mode, heat, area), Overlay (portal into the map)
components/home/            SideNav, SearchBar, LeftPanel, PricePins, HoverCard, ParcelLift, DetailPanel, MapControls, CompsFlow
components/onboarding/      OppPins
lib/map/style.ts            live vs offline styles
lib/map/theme.ts            optional Breezy palette over light-v11 (inactive on streets-v12)
lib/map/layers.ts           heat hexes, parcels (Regrid or demo), area inner-glow layers
lib/places.ts               search + boundaries + offline gazetteer
lib/fake.ts                 demo data
```

`window.__bzMap` exposes the map instance in the browser console for debugging.

## Reviewing and comments

- Repo: `Breezy-Technologies/breezy-web-prototype`, linked to the Vercel project `breezy-web-prototype` (team `breezy18`). Env keys live in Vercel project settings, never in git.
- `main` is the demo: https://breezy-web-prototype.vercel.app (public, comment toolbar off).
- Each change goes on its own branch. Vercel builds a preview at `breezy-web-prototype-git-<branch>-breezy18.vercel.app`; it needs a Vercel sign-in, and the comment toolbar is on.
- Reviewers comment on the preview with the Vercel toolbar. Claude reads the open threads (Vercel MCP `list_toolbar_threads`), fixes the issues on the branch, replies in each thread and resolves it. Merge to `main` once the branch is approved.

## Working agreements

- Keep the offline demo path working whenever live services are added.
- Keep env keys in `.env.local` only, never committed. Lock the Mapbox token to the prototype's domain.
- Match the canvas designs. When something isn't specified there, follow the rules above rather than inventing a new pattern.
