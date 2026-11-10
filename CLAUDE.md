# Breezy web prototype: context for Claude

Claude Code reads this file at the start of every session. It describes what the prototype does today, how it's built, and the rules the design reviews have settled. Keep it current: when a behaviour changes, update this file in the same commit.

## What this is

Breezy is a property-intelligence app for real-estate agents. It surfaces opportunities on a map: underbuilt lots, high ROI, price drops, and expired / withdrawn / stale listings (plus foreclosures in onboarding).

This repo is a standalone Next.js 15 + React 19 + TypeScript app. It shows two things:

- the **V5 onboarding and activation flow** (`/onboarding`, also the `/` redirect);
- the **Home Web** core experience it hands off to (`/home`).

Both routes share **one Mapbox GL map** that lives in the root layout (`components/map/MapProvider.tsx`). Camera, layers and the chosen area carry over with no reload. `window.__bzMap` exposes the map in the browser console. A ResizeObserver keeps the canvas the size of its container (any change, not only window resizes).

**Source of truth for the UI:** the Claude Design canvas, pages "Home Web" and "Home Web V5 Prototype". A runnable copy lives in `design-reference/` (see its README). Before building any Home Web UI, find the matching handlers in `design-reference/project/Home Web.dc.html` and port from there. `design-reference/PORTING.md` tracks what's done. The canvas's Mapbox token sits in the gitignored `design-reference/project/local-config.js`, never in the committed file.

## Data sources and their status

| Layer | Source | Status |
|---|---|---|
| Base map | **Breezy light / dark** (default): Mapbox Standard, Pedro's `dev-breezy/cmgfg4m3e007y01re4uq6bz83` (`NEXT_PUBLIC_MAPBOX_BREEZY_STYLE`) with runtime presets in `lib/map/breezyTheme.ts` (spec: `docs/map-theme.md`). Also `streets-v12` ("Streets", the old base) and `satellite-streets-v12`, all on the dev-breezy **production public token** | Live. Keep the token to prototypes. Our layers go in Standard's `middle` slot with emissive strength 1. Breezy dark: `monochrome` + `night`; land colour isn't configurable, so it needs the Studio style. `lib/map/theme.ts` (old Breezy palette) only applies to `light-v11`. |
| Parcels | Regrid vector tiles, source layer `parcels`, `promoteId: ll_uuid`, fields `owner, address, parcelnumb, path…` | Live on a **trial token: Dallas County only, expires 4 Dec 2026**, ~10k tiles. LA comes back empty, so demo around 32.7767, -96.7970. Tiles carry no lot size or specs, so those stay fake. Without the token, `lib/map/layers.ts` generates demo parcels. |
| Area outlines | US Census TIGERweb through `app/api/boundary/route.ts` (city, ZIP, county, state) | Live. Outer rings come back **clockwise** and enclave holes **anticlockwise** (`lib/geo.ts`). The inner-glow edge depends on that: a positive `line-offset` means inside. `pointInRings` is even-odd, so holes count as outside. |
| Search | Mapbox Geocoding v6 (`searchPlaces` / `searchPlacesStrict` in `lib/places.ts`) | Live. The hand-drawn gazetteer (Beverly Hills, Silver Lake, Dallas…) is the offline fallback. |
| Coverage | `isCovered()` in `lib/places.ts` | California + Dallas. Outside that, the app shows an "unsupported area" state. |
| Silver Lake lots | Pedro's `pd-bittencourt/underbuilt-roi` (`src/mocks/data/lots.json`) → `scripts/extract-silverlake.mjs` → `lib/data/silverlake.json`, read by `lib/silverlake.ts` | **The demo's anchor.** 2,018 real Silver Lake + Echo Park lots: cadastral outline, address, zoning, lot / house figures, listed / sold. ROI = his loader's per-lot target (his model is calibrated to hit it), Underbuilt = 1 − built / by-right ft². They are the parcels there (`bz-lots` source), the pins (listed / sold lots, fixed rank) and the hex averages. Photos, owner, opportunity copy stay fake (seeded per lot). |
| Breezy data | `lib/fake.ts` | **Fake and deterministic per place / box:** listings, opportunity types, owners, quick estimates (on **every** property; `noQe`, no estimate, is only set by the Dev menu preview), ROI (24–90; real per-lot figures in the Silver Lake lot zone) and Underbuilt heat, listing detail. Each generator will be swapped for a real service: the listings API, JD's heat-map service, the owner data service, and Justin's quick-estimate endpoint. |
| Offline mode | No Mapbox token, a style error, or a 4 s timeout | Uses the georeferenced static images in `public/map/` (Beverly Hills, Silver Lake, plus a fake-satellite `sat-*` set). **Keep it working for demos without network.** |

Env keys are listed in `.env.example`, set locally in `.env.local`, and stored for deploys in the Vercel project settings. They are never committed. `lib/config.ts` reads them.

## Onboarding (`/onboarding`): V5 flow, 8 steps

`STEPS = where → radar → comps → ub → roi → heat → signup → cards`

1. **where**: pick an area (search, or the Silver Lake / Echo Park chips: the demo is anchored there). The outline draws with the inner-glow edge.
2. **radar**: scan the area. Special opportunity pins (`OppPins`) pop in with a wave delay and a double pulse ring.
3. **comps / ub / roi**: three "freebie" cards, each with its art (`FreebieArt`): the sparkle GIF for comps, the build render for Underbuilt, a graduated gauge for ROI. Flip cards show "Learn more".
4. **heat**: heat map and market alerts are **merged** into one step, and the hexes reveal in a wave (`heatWave` / `heatWaveEnd`).
5. **signup**: brand modal (bold clay count, centred text) with Google sign-in.
6. **cards**: personalisation. One swipe card per signal (`OppCard`):
   - Each card has an isometric render (`public/iso/card-*.png`) and a background tinted to match it.
   - Art and text enter on a stagger. The card has a fixed height (330–540 px).
   - Pointer-drag to swipe (110 px threshold). The footer stays pinned with Restart and Skip / Build my feed.
   - Pins keep pulsing.

The picks are saved in `AppState` (sessionStorage) and seed Home's For you feed.

## Home Web (`/home`)

**Layout**
- Side nav on the left, then the left column (Home card or Results), the detail panel (420 px) when a property is open, and the map behind everything.
- Map controls sit bottom-right.

**Home card** (`HomeCard.tsx`), always full height, with three tabs:
- **For you:** the V5 feed (`ForYouFeed.tsx`), sorted by signal, with a signal filter dropdown and `SignalDot` badges.
  - **Special pins** (yellow signal circles) appear on the map **only while For you is the visible tab**. They follow the feed's signal filter.
  - A pin reverts to a plain white price pill once its detail has been opened ("seen").
  - The "+" on a card picks the property. Picked properties show in the `PickedFooter`, and their thumbnails open the Saved sheet.
- Under "Hello <name>": the user's location (browser geolocation, reverse-geocoded to "Neighbourhood, City", cached for the session), falling back to the first area of the session (the onboarding market).
- Searches and Properties show their **whole list** (no "View all"); hover shows the delete button.
- For you cards: the photo is a carousel (up to 5 photos, dots) that swipes with a mouse drag or touch; a drag never opens the card.
- **Searches:** saved searches, each with an "n new" badge (red) until the search is **clicked** (hover doesn't count), then Active (pulsing green); and alerts.
- **Properties:** saved properties. Unviewed ones carry a red dot; opening one marks it viewed. Properties you save yourself start viewed.
- The Searches / Properties tab bells show only while something is unseen (a search with new matches, a property with its red dot).

**Search** (`SearchBar.tsx`, the canvas search step)
- Recent searches are stored in localStorage. Several areas can be picked as chips.
- Results use `searchPlacesStrict`.
- Error rows with Retry: "Unable to load search. Please retry." and "Search service timed out".
- Empty state uses `/iso/empty-search.png` with "No recent searches".
- When a property is open, the field shows its address with an × that deselects it.

**Results** (`LeftPanel.tsx`)
- The filter bar scrolls horizontally with round arrows; the row is clipped under each arrow's centre, so chips slide under the arrows (no cut edge, no fade band).
- Filters (`Filters.tsx`, `lib/filters.ts`) default to relaxed: any status, any type. The "All filters" badge counts every active filter.
- Sort menu, and a 1 / 2 / 3 column toggle (`ColsToggle`). Widening the column pans the map so the same spot stays centred.
- Footer:
  - **Save search** (primary).
  - When the **Recently sold** filter is on, **Create comps** becomes primary and Save search turns into a grey secondary.
  - Once properties are picked, the footer shows only thumbnails + "Share n properties", with no Save search bell.

**Search this area** (pill at the top centre of the visible map)
- Shows only after a *user* pan / zoom, never after the app's own `easeTo` / `fitBounds`. Two triggers:
  - the centre of the visible map has left the searched area;
  - more than half of a 4 × 3 grid over the visible map has no pins.
- Clicking it searches the visible box: the field reads "Map area", the outline clears, and the camera stays put.
- Pins already inside the box are kept (same id, same spot); the rest come from a fixed global grid of listings (~500 m cells, `areaListings` in `lib/fake.ts`), so searching overlapping boxes finds the same homes in the same places.

**Map and pins**
- **Price pins** (`PricePins.tsx`) are white pills with a soft shadow. Pins that would overlap a higher-priority pin collapse into small blank pills underneath, and hover reveals the price. Priority: price drops, then new. Hover / selection don't take part: that pin just draws full and on top, so neighbours never flip.
- **Pin performance:** the per-frame camera `tick` has its own context (`useMapTick`), read only by the overlays that re-project through React (ParcelLift, HoverCard, onboarding labels). The rest of the app, price pins included, no longer re-renders on every frame.
- **Pin stability:** every map pin (price pills, onboarding `OppPins`) is anchored with `components/map/anchors.ts`: its wrapper is moved on the map's `move` event, in the same frame the map draws (measured ≤ 0.01 px off during an animated pan / zoom). The collapse layout is recomputed only when the map comes to rest.
- **Pin hover preview** (`HoverCard.tsx`):
  - opens after ~220 ms and closes on hover-out;
  - photo carousel (arrows, dots, n/total), address, price per ft², specs, an **owner** row and a **quick estimate** chip (hidden for `noQe` listings);
  - "Get comps" is distinct from the quick estimate.
- **Heat layers** (`lib/heat`, `lib/map/layers.ts`), matched like for like to Pedro's build (`pd-bittencourt/underbuilt-roi`, the benchmark):
  - Hexes sit on the fixed **H3** grid and are **built once**, only inside `HEAT_AREA` (a 3 km circle round the Silver Lake lots, `lib/silverlake.ts`; review: fake heat across all of LA broke the behaviour, and hexes rebuilt per viewport kept redrawing and changing size). City cells (res 7) crossfade into submarket cells (res 8) between zoom 11.9 and 13; submarket cells fade out 15 → 16. No hex outlines. A cell with more than 3 lots averages them (Pedro's derive.ts); other cells read the fake field. Each hex carries both `roi` and `ub`, so a layer switch is a repaint, never a `setData`.
  - **Parcels are coloured on load**, fading in 15.6 → 16.2 and strengthening to 17, with thin warm-grey lot lines (#8A7A72). Each lot has its own value (area value plus a fixed per-lot offset), so parcel zoom reads as a mosaic; hexes keep the area value.
  - Pedro's lots (`bz-lots`) carry their own `roi` / `ub`. Live Regrid parcels (Dallas) get their value as feature state `v` (keyed by `ll_uuid`) as tiles load; demo parcels carry it as a property and are left out of the lot zone.
  - Everything is translucent: each palette has a tuned layer opacity (Pedro's is 25%), so streets read through.
  - Switching layer (ROI ↔ Underbuilt ↔ none) fades the old one out and the new one in (`fadeHeatTo`, ~0.6 s); it used to flick.
  - One colour scale for hexes, parcels, the lifted slab, the map key and the "Match heat layer" pin route. Values are real percentages; the 0–1 fake field is spread along the bands (ROI 0/5/10/20/30/45; 5-colour palettes use 0/10/20/35).
- **Parcel hover, zoom ≥ 15.4** (`ParcelLift.tsx`):
  - The parcel lifts off the map as a solid slab: drop shadow, stacked sides, an **opaque** top and the house number, with a dashed outline on the ground.
  - With the heat map on, the slab keeps its parcel's band colour (softened 60% toward paper, since the slab is opaque); with it off, it's neutral.
  - In satellite: the rest of the map dims, the slab top is the satellite image (Mapbox Static) with a yellow edge, and there are no colour washes.
- **Selection framing** (`lib/map/frame.ts`): opening a property (pin, card, saved property, address) or clicking a parcel fits the **whole lot** into the free map space between the detail panel and the viewport edge, below the filter bar, centred, with an even 64 px margin. The frame keeps at least 70 m of ground across and stops at zoom 19 (review: the zoom was too tight), so the street and neighbours stay in view. A real lot uses its own outline. A parcel uses its outline; a listing fits a lot-sized square first, then settles on the parcel under it once drawn.
- **Searched-area outline:** option 04, "inner glow edge". A thin clay line (rgb 147,89,75) plus a soft clay gradient inside the boundary; nothing outside. The glow widens with zoom while the line keeps a fixed width.
- **Map controls**, bottom-right, from the bottom up: Layers (84 px card with thumbnail), zoom, my location, info. The Layers and info panels open to the left. Layers cover the data layer (ROI / Underbuilt / none) and the map type: Breezy light, Breezy dark, Streets, Satellite. Light ↔ dark switches presets in place; on dark, pale heat bands are blended toward the land so "neutral" doesn't read as a grey veil.

**Detail panel** (`DetailPanel.tsx`)
- Photo carousel, address, specs row, then sticky tabs: **Summary / Specs / Records / Owners**.
- Summary only:
  - A floating **Quick estimate** card with the big number and a **Get comps** button.
  - Max build + Profit potential tiles.
  - An **Owner** section (56 px avatar, "View history" on the right), then the listing description. Owner contact lines copy on click.
- **No estimate (`noQe`):** only reachable from the Dev menu ("Property with no estimate"; every property has an estimate). The full-width CTA layout (decided): title and one-line explanation with the illustration on the right, a full-width outline "Get price estimate" underneath; it loads, then shows the estimate and a positive toast.
- "View more" buttons have no arrows.
- Footer: alert + share icons and a primary **Contact owner** (no "1 credit" text). Pressing it scrolls the panel to the Owner section (switching to Summary if needed); once the scroll settles, the phone, email and address are written in left to right by a soft clay → violet gradient edge (staggered 160 ms, a faint sheen behind), then settle to plain copyable text; the footer becomes Call owner + an email icon.

**Flows and sheets**
- **Report sheet** (`components/report/ReportFlow.tsx`, canvas `rptLayer` / `_wsTilt` / `_runFlow`): opened by **Get comps**, the **Max build** tile (Underbuilt) and the **Profit potential** tile (ROI).
  - The workspace (map + map-area panels) tilts back (perspective, rotateX 9°, scale .9, `html[data-flow]` in `globals.css`) and dims, while a white sheet rises from the bottom in perspective over everything right of the side nav (0.7 s).
  - Loading stage per flow: progress bar in the flow's colour (comps purple, UB clay, ROI green), radar GIF (UB) or sparkle, "Analyzing …", one shimmering step every 700 ms, then the done title for 1.5 s.
  - Comps first confirms the subject property (review modal), then "Let AI do the work" inside the sheet (auto-runs after 6.7 s unless the pointer rests on Get comps).
  - Report header: Back to map, tabs **Upside analysis / Build guidelines / Comps** (a tab that hasn't run starts its flow), Share. A report that has run reopens on its result.
  - **Build guidelines** = `UBReport.tsx`: version D ("Property") main column of the Underbuilt Report Versions design, no property card, spread to the full sheet width on white (review feedback) like the Comps result. Recorded from `design-reference/underbuilt-report/` by `scripts/extract-ub-report.mjs` into `public/ub-report/`; modals, expandable rules, build options (option × plan/section × roof), dots rail, glossary drawer and "Get Comps" links all work. Sample data (418 Wren Hollow Lane).
  - **Upside analysis** body is a placeholder until Pedro's UB ROI variants are ported. **Comps** body is the existing comps result.
  - Area comps come from Create comps (`AreaCompsPreview`, still the older full-screen view).
- **Saved** (`Saved.tsx`, `SavedState.tsx`): save-search sheet, `SaveToggle`, the Saved sheet (opens from Home and Results).
- **Alerts panel**, "Set custom alerts":
  - "Any activity" with an Active / Turn on pill.
  - Price drop / bump use a % stepper ("Alert when · Price drops N% below current price").
  - One Save button.
- **Share** (`Share.tsx`): share one property or the picked set.
- **Reports** (`Reports.tsx`): comps and area reports.
- **Toasts** (`Toast.tsx`), bottom centre, tones neutral / positive / negative. "No property found" uses the neutral black info icon.

**Developer menu** (side nav), to preview states on demand:
- Restart onboarding
- Snackbars (neutral / positive / negative)
- Search failed / timed out / no recents
- Property with no estimate

## Heat palette (exploration, not yet decided)

A floating **"Heat: …" switcher** (`components/HeatPaletteSwitcher.tsx`) sits above the Pins switcher on both routes. It picks a palette per layer (ROI / Underbuilt) and can override the opacity. Saved in localStorage (`bz-heat-palette`); the map repaints in place. Palettes live in `lib/heat/index.ts`; Pedro's scale maths is ported as-is in `lib/heat/scale.ts`.

| Palette | Bands | Notes |
|---|---|---|
| Breezy · slate → clay (default ROI) | 5 | Diverging: dusty slate, sand, Breezy clay. No yellow, so yellow pins stay distinct. Top two bands softened toward clay (review: high ROI read too red). |
| Breezy · sand → deep clay (default UB) | 5 | Single brand hue. Calmest, but neighbouring bands blur at parcel zoom. |
| Pedro, reduced | 5 | Pedro's blue → yellow → red cut to 5. |
| Pedro's set (Blue → Yellow → Red is his shipped default, etc.) | 7 | The benchmark for balance. |

Done when Ann signs the palette off as on-brand and Jimsy agrees it keeps Pedro's legibility; then remove the switcher.

## Signal pin colours (decided)

Every coloured opportunity circle (`SignalDot` in `components/PinPalette.tsx`: map pins, feed badges, cards, legends) takes its colour from one family, in `lib/pinColors.ts`:

| Family | Signals | Base |
|---|---|---|
| Red | Alert related: price drops | rgb(192,98,84) |
| Yellow | Underbuilt | rgb(216,178,104) |
| Green | ROI | rgb(94,144,106) |
| Blue | Status related: withdrawn, expired, stale, foreclosure | rgb(100,138,176) |
| Purple | Comps | rgb(138,118,160) |

Muted in the 10 Nov review (the first set read too garish): same hues, lower saturation, softer ring.

- Each circle is lit from the top (a lighter tint fading to the base) with a darker ring of its own shade. The icon is white, dark on yellow. **Selected is always black with a white icon.** White price pills never change; the price-drop bell uses the alert red.
- Onboarding pins are 38 px (44 px selected) with a white outline and a pulse ring in the family colour. On Home they are 22 px and pulse softly too (staggered), until seen or selected.
- The colour-route switcher is gone.

## Design rules (from review feedback; keep them)

- **Side nav:**
  - Collapse toggle at the top, with the Breezy wordmark next to it when expanded.
  - Items: Map, Comps, Underbuilt, AI Notes, Assistant. **No News.**
  - Icons are transparent isometric PNG / SVG in `public/nav` (`map-iso`, `comps-iso`, `radar`, `ai-notes-new`, `assistant`), optically equalised by `ICON_SCALE`.
  - The active item has a **dark pill**. Icons never fade.
  - Footer: Upgrade to team, Reports, Settings, Dev menu, avatar.
- **Illustrations:** isometric "skeuomorphic" scenes in the Breezify Core Figma style (file `N81mxdVxHzi9rmqU2qw0xn`, node 7612:60), in `public/iso/`. Full-resolution copies for the team are in `~/Downloads/Breezy-isometric-illustrations/`.
- **Colours:** ink rgb(18,18,18), paper rgb(253,252,252), clay rgb(175,127,113), deep clay rgb(147,89,75), nav background rgb(245,243,243), Breezy yellow rgb(255,209,41).
- **Type and icons:** Akkurat LL (`public/fonts`); Phosphor icons (`public/vendor/phosphor`).
- Match the canvas. When something isn't specified there, follow these rules rather than inventing a new pattern.

## Open items

- **Report sheet:** port Pedro's UB ROI page variants into Upside analysis; feed Build guidelines from the selected property instead of the sample report.
- Draw-area tool: placement still undecided. The "Search this area" zone diagram is coming from William's Figma.
- Make saved reports easier to reach, as on mobile.
- Welcome-panel polish: rounder corners, no bottom padding between list items, skeleton loading piece by piece.
- "New match" badge should clear on first interaction.
- **Heat palette:** pick one with Ann and Jimsy and remove the switcher. Underbuilt band cut points are placeholders until JD's service defines them.
- Pedro's smooth heat surface (canvas image + water clip) is not ported yet.
- Pins: inside the lot zone, every search shows real lots (`lotListing`, fixed rank); elsewhere named places still generate their own listings and only "Search this area" uses the fixed grid.
- Regrid: ask for LA County coverage before the trial ends (4 Dec 2026).
- **Breezy map theme:** duplicate Pedro's style in Studio as Breezy Light / Dark with the values in `docs/map-theme.md` (plus dark land #221d1b), then confirm with Ann and Jeff. Needs Mapbox access.
- Dark map only: the app UI and the lifted parcel slab are still light.
- Onboarding and activation designs were due 7 Nov to unblock the China team. The full engineering handoff is end of November.

## Code map

```
app/layout.tsx              root layout → AppStateProvider → SavedProvider → MapProvider (shared map)
app/page.tsx                redirects to /onboarding
app/onboarding/page.tsx     V5 flow (8 steps), OppCard swipe cards, FreebieArt, signup modal
app/home/page.tsx           Home Web: layout, views (home / results), search this area, detail zoom, Dev menu
app/api/boundary/route.ts   Census TIGERweb lookup (winding + holes)
components/AppState.tsx     place / areas, outline rings, listings, picks, onboarded (sessionStorage)
components/SavedState.tsx   saved searches + properties, alert definitions
components/PinPalette.tsx   SignalDot, pulse colour
components/HeatPaletteSwitcher.tsx  heat palette / opacity exploration control
components/map/             MapProvider (inset, mode, heat, area), Overlay (portal into the map)
components/home/            SideNav (+DevMenu), SearchBar, HomeCard, ForYouFeed, LeftPanel, Filters,
                            PricePins, HoverCard, ParcelLift, DetailPanel, MapControls, CompsFlow (review modal, comps result, area comps),
                            Saved, Share, Reports, Toast
components/report/          ReportFlow (report sheet + flows), UBReport (Underbuilt analysis)
components/onboarding/      OppPins
lib/config.ts               env-driven config, isLiveMap / hasRegrid
lib/map/style.ts            live vs offline styles
lib/map/layers.ts           heat hexes (+ wave reveal), parcels (Regrid or demo), area inner-glow layers
lib/map/theme.ts            optional Breezy palette over light-v11 (inactive)
lib/places.ts               search, boundaries, gazetteer, viewportPlace, isCovered
lib/geo.ts                  ring winding, bbox, point-in-rings
lib/fake.ts                 demo data (listings, detail, owners, estimates, heat); lotListing / listingAt for real lots
lib/silverlake.ts           Pedro's Silver Lake lots (lib/data/silverlake.json), HEAT_AREA circle, lot zone
lib/filters.ts              filter model and defaults
lib/pinColors.ts            signal pin colour families
lib/heat/                   heat colour scale (scale.ts ported from underbuilt-roi), palettes, bands, values
lib/css.ts                  converts canvas style strings to React styles
```

## Workflow

- **Repo:** `Breezy-Technologies/breezy-web-prototype`, linked to the Vercel project `breezy-web-prototype` (team `breezy18`).
- **`main` is the demo:** https://breezy-web-prototype.vercel.app. William has asked for **changes to go straight to `main`**. Use a branch only for larger explorations (Vercel then builds `breezy-web-prototype-git-<branch>-breezy18.vercel.app`). Deployment protection (Vercel Authentication) is **off** for the project since 10 Nov 2026, so branch and deployment URLs are public like production; share them freely with the team.
- **Review loop:**
  1. William comments with the Vercel toolbar.
  2. Claude reads the open threads (Vercel MCP `list_toolbar_threads`), fixes the issues, and pushes.
  3. Claude replies in each thread with the commit, then resolves it. Threads waiting on a decision stay open.
- Before committing, run `npx tsc --noEmit` (ignore stale `.next/` type errors).
- Dev server: `npx next dev -p 3000`.

## Working agreements

- Keep the offline demo path working whenever live services are added.
- Env keys stay in `.env.local` and the Vercel settings, never in git. The Mapbox token is production's public token: use it for prototypes only, locked to the prototype's domain.
- Breezy's own data stays fake until the real services are ready. Swap one generator at a time.
- Update this file when product logic or the prototype's state changes.
