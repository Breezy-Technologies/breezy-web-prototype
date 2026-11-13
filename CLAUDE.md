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
| Base map | **Breezy light / dark** (default): Mapbox Standard, Pedro's `dev-breezy/cmgfg4m3e007y01re4uq6bz83` (`NEXT_PUBLIC_MAPBOX_BREEZY_STYLE`) with runtime presets in `lib/map/breezyTheme.ts` (spec: `docs/map-theme.md`). Also `streets-v12` ("Streets", the old base) and `satellite-streets-v12`, all on the dev-breezy **production public token** | Live. **The current Breezy light theme is approved (William, 11 Nov).** Keep the token to prototypes. Our layers go in Standard's `middle` slot with emissive strength 1. Breezy dark: `monochrome` + `night`; land colour isn't configurable, so it needs the Studio style. `lib/map/theme.ts` (old Breezy palette) only applies to `light-v11`. |
| Parcels | Regrid vector tiles, source layer `parcels`, `promoteId: ll_uuid`, fields `owner, address, parcelnumb, path…` | Live on a **trial token: Dallas County only, expires 4 Dec 2026**, ~10k tiles. LA comes back empty, so demo around 32.7767, -96.7970. Tiles carry no lot size or specs, so those stay fake. Without the token, `lib/map/layers.ts` generates demo parcels. |
| Area outlines | US Census TIGERweb through `app/api/boundary/route.ts` (city, ZIP, county, state) | Live. Outer rings come back **clockwise** and enclave holes **anticlockwise** (`lib/geo.ts`). The inner-glow edge depends on that: a positive `line-offset` means inside. `pointInRings` is even-odd, so holes count as outside. |
| Search | Mapbox Geocoding v6 (`searchPlaces` / `searchPlacesStrict` in `lib/places.ts`) | Live. The hand-drawn gazetteer (Beverly Hills, Silver Lake, Dallas…) is the offline fallback. |
| Coverage | `isCovered()` in `lib/places.ts` | California + Dallas. Outside that, the app shows an "unsupported area" state. |
| Silver Lake lots | Pedro's `pd-bittencourt/underbuilt-roi` (`src/mocks/data/lots.json`) → `scripts/extract-silverlake.mjs` → `lib/data/silverlake.json`, read by `lib/silverlake.ts` | **The demo's anchor.** 2,018 real Silver Lake + Echo Park lots: cadastral outline, address, zoning, lot / house figures, listed / sold. ROI = his loader's per-lot target (his model is calibrated to hit it), Underbuilt = 1 − built / by-right ft². They are the parcels there (`bz-lots` source), the pins (listed / sold lots, fixed rank) and the hex averages. Photos, owner, opportunity copy stay fake (seeded per lot). |
| Silver Lake parcels (wide) | LA County assessor parcels, public ArcGIS service (`public.gis.lacounty.gov/…/LACounty_Parcel/MapServer/0`, no key) → `scripts/fetch-la-parcels.mjs` → `public/data/sl-parcels.json` (source `bz-la`, ~10 MB, 1.4 MB gzipped, loaded on demand) + `lib/data/sl-heat.json` | **Real** outlines for every parcel in the 3 km heat circle (24,164; Pedro's 1,898 matched lots are skipped by geometry, his ids are City PINs not AINs): address, use, beds / baths, built ft², year, lot area. Underbuilt = 1 − built / (lot × assumed FAR: single family 0.45, 2–4 units 1.0, else 1.5). ROI is made up (Pedro's tier mix, leaning up where underbuilt). Parks, streets, schools carry no value and draw as outlines. Listing for a hover / click: `countyListing` in `lib/fake.ts`. About 15% of built homes get a stable demo status (listed / sold, `countyStatus`); those outside Pedro's lot zone (`lib/data/sl-homes.json`, `scripts/build-sl-homes.mjs`) are pinned, so **every search inside the heat circle pins real homes** (Pedro's lots + county homes, one fixed rank); generated listings only appear outside the circle. Re-run the scripts to refresh. |
| US-wide heat | `lib/map/usHeat.ts`, outline `public/data/us-states.json` (`scripts/fetch-us-outline.mjs`, Census states, loaded on demand) | **Dummy (12 Nov).** Outside the Silver Lake circle, every US state has hexes on the fixed H3 grid, one resolution per zoom band (res 4 below z 6.5, 5 to 9, 7 to 11.5, then res 8, the Silver Lake grid). Listed per viewport after each move and cached: a drawn cell never changes. Values from `heatValue` (three scales: regions, metros, streets), the same field the demo parcels read. |
| Listing photos | `lib/photos.ts`, `public/photos/l/` (51 daylight MLS-style photos generated with fal FLUX.2 pro) | Fake. A gallery per listing: the front (LA styles; the luxury set from $3m; other US styles outside California; an empty lot for vacant lots), then living room, kitchen, bedroom, bathroom, yard / dining. Seeded per listing. |
| Breezy data | `lib/fake.ts` | **Fake and deterministic per place / box:** listings, opportunity types, owners, quick estimates (on **every** property; `noQe`, no estimate, is only set by the Dev menu preview), ROI (24–90; real per-lot figures in the Silver Lake lot zone) and Underbuilt heat, listing detail. Each generator will be swapped for a real service: the listings API, JD's heat-map service, the owner data service, and Justin's quick-estimate endpoint. Beverly Hills and around (Bel Air, West Hollywood, Beverlywood) is denser: 2.5× the generated pins (`pinDensity`). |
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
- **For you:** the V5 feed (`ForYouFeed.tsx`), with a signal filter dropdown and `SignalDot` badges.
  - **Read state (decided 10 Nov):** an item is **seen when it's opened** (clicked); hover doesn't count. Each opportunity is dated by when Breezy found it (fake, 0–3 days ago) and the feed is grouped under bold date dividers ("Today · November 11", "Yesterday · …"); a divider shows "n new" while anything under it is unread (no red dot: 13 Nov review). Unread cards carry a red **"New"** label (the bell read as an alert someone set up); opened cards carry no label (review: no "Seen" label needed).
  - **Unread toggle** (11 Nov review: one button like Apple Mail, styled like Slack's "Unread messages"): right-aligned on the signal filter's row, an "Unread" button with the notification icon in Breezy's secondary style (grey pill, `btn-soft`), ink when on like the type filter. No red dot on it. No result count on For you. A card opened while filtering by Unread stays listed until the filter is switched. When nothing is unread: "You're all caught up" (with "Show all" in the Unread view).
  - The feed follows the same 1 / 2 / 3 column setting as Results (toggle top-right of the Home card, For you only); each day's cards form a grid.
  - **Special pins** (yellow signal circles) appear on the map **only while For you is the visible tab**. They follow the feed's signal filter.
  - **Market radar pins (decided 11 Nov, Figma "Onboarding redesign" 2CKvKeUl6XgruMBITGkHbt node 1520:65016):** `components/home/RadarPin.tsx`. A teardrop marker in the signal's colour with its icon (the design's own SVGs in `public/pins/`) on a white label pill with the price pins' shadow (review: not the design's frosted glass) that states the signal (`radarLabel`): "12% price drop", "Expired 3 days ago", "Withdrawn 14 days ago", "170 DOM", "58% Underbuilt", "$1.5m ROI" (the Upside profit, as the detail tile), and in the design "$1.5m price estimate" / "Foreclosed" (assets ready, no listings use them yet). Hovered or selected: black marker, white icon. The pill sits on the property's point, the marker above it. Unseen pins pulse softly from the marker's head; once opened the pin reverts to a plain white price pill. No red unread dot on pins any more.
  - The "+" on a card picks the property. Picked properties show in the `PickedFooter`, and their thumbnails open the Saved sheet.
- Under "Hello <name>": the user's location. **The prototype defaults to LA:** "you are here" is always Silver Lake, Los Angeles (`DEMO_LOCATION` in `lib/places.ts`; `USE_BROWSER_LOCATION` brings real geolocation back), for the greeting, "Current location" and My location. A saved session area outside LA isn't restored.
- Searches and Properties show their **whole list** (no "View all"); hover shows the delete button.
- For you cards: the photo is a carousel (up to 5 photos, dots) that swipes with a mouse drag or touch; a drag never opens the card.
- **Unread treatment (unified 11 Nov, `components/Unread.tsx`):** one red (rgb 214,53,41), two marks. `UnreadDot` (8 px) flags a place holding something unread: tabs, saved-property rows, map pins, the Unread toggle. `NewTag` (red pill) says "New" on an unread item (feed and Results cards) or "n new" for a count (saved searches, date dividers). Everything clears on **open (click)**, never hover; Results cards use the same seen set as the feed.
- **Searches:** saved searches, each with an "n new" `NewTag` until the search is **clicked** (hover doesn't count), then Active (pulsing green); and alerts.
- **Properties:** saved properties. Unviewed ones carry a red dot; opening one marks it viewed. Properties you save yourself start viewed.
- The Searches / Properties tabs show a red unread dot (no bell) only while something is unseen (a search with new matches, a property with its red dot). Price-drop pins use a down arrow, not a bell.

**Search** (`SearchBar.tsx`, the canvas search step)
- Recent searches are stored in localStorage. Several areas can be picked as chips.
- Results use `searchPlacesStrict`.
- Error rows with Retry: "Unable to load search. Please retry." and "Search service timed out".
- Empty state uses `/iso/empty-search.png` with "No recent searches".
- When a property is open, the field shows its address with an × that deselects it.

**Results** (`LeftPanel.tsx`)
- The filter bar scrolls horizontally with round arrows; the row is clipped under each arrow's centre, so chips slide under the arrows (no cut edge, no fade band).
- Filters (`Filters.tsx`, `lib/filters.ts`) default to relaxed: any status, any type. The "All filters" badge counts every active filter.
- Results cards carry the "New" `NewTag` while new and not yet opened; the status chip always shows the status.
- Sort menu, and a 1 / 2 / 3 column toggle (`ColsToggle`, shared with the For you feed). Widening the column pans the map so the same spot stays centred.
- Footer:
  - **Save search** (primary).
  - When the **Recently sold** filter is on, **Create comps** becomes primary and Save search turns into a grey secondary.
  - Once properties are picked, the footer shows only thumbnails + "Share n properties", with no Save search bell.

**Search this area** (pill at the top centre of the visible map)
- Shows only after a *user* pan / zoom, never after the app's own `easeTo` / `fitBounds`. Two triggers:
  - the centre of the visible map has left the searched area;
  - more than half of a 4 × 3 grid over the visible map has no pins.
- Clicking it searches the visible box: the field reads "Map area", the outline clears, and the camera stays put. From Home's **For you** tab it stays on For you: the feed and its special pins refresh for the new area (review comment); from anywhere else it opens Results.
- Pins already inside the box are kept (same id, same spot); the rest come from a fixed global grid of listings (~500 m cells, `areaListings` in `lib/fake.ts`), so searching overlapping boxes finds the same homes in the same places.

**Map and pins**
- **Price pins** (`PricePins.tsx`) are white pills with a soft shadow. Pins that would overlap a higher-priority pin collapse into small blank pills underneath, and hover reveals the price. Priority: **the For you feed's items** (so every feed card's pin draws in full with its signal), then price drops, then new. Hover / selection don't take part: that pin just draws full and on top, so neighbours never flip.
- **Pin performance:** the per-frame camera `tick` has its own context (`useMapTick`), read only by the overlays that re-project through React (ParcelLift, HoverCard, onboarding labels). The rest of the app, price pins included, no longer re-renders on every frame.
- **Pin stability:** every map pin (price pills, onboarding `OppPins`) is anchored with `components/map/anchors.ts`: its wrapper is moved on the map's `move` event, in the same frame the map draws (measured ≤ 0.01 px off during an animated pan / zoom). The collapse layout is recomputed only when the map comes to rest, and only once the zoom has moved half a level from the last layout (team: "map flickering" was ~1 pin in 5 popping on every small trackpad zoom step); a pin that does change fades its price in. A wheel over a pin, card or slab is handed to the map canvas (`MapProvider`), so zooming works with the pointer on a pin.
- **Pin hover preview** (`HoverCard.tsx`):
  - opens after ~220 ms and closes on hover-out;
  - photo carousel (arrows, dots, n/total), address, price per ft², specs, an **owner** row and a **quick estimate** chip (hidden for `noQe` listings);
  - "Get comps" is distinct from the quick estimate.
- **Heat layers** (`lib/heat`, `lib/map/layers.ts`), matched like for like to Pedro's build (`pd-bittencourt/underbuilt-roi`, the benchmark):
  - Hexes sit on the fixed **H3** grid and are **built once**, only inside `HEAT_AREA` (a 3 km circle round the Silver Lake lots, `lib/silverlake.ts`; review: fake heat across all of LA broke the behaviour, and hexes rebuilt per viewport kept redrawing and changing size). **One continuous grid** (res 8) at every zoom: no city-tier crossfade, no snapping; zooming only scales the cells (source `tolerance: 0`). They fade out 15 → 16 into the parcels. No hex outlines. Every cell is real: the average over Pedro's lots and the county parcels inside it, **spread by rank** onto the lots' own range (`lib/data/sl-heat.json`; plain averages bunched UB into 45–56%, one or two bands: team said the UB heat wasn't varied). Each hex carries both `roi` and `ub`, so a layer switch is a repaint, never a `setData`. **Outside the circle (12 Nov): dummy hexes across the US** (`lib/map/usHeat.ts`): fixed H3 cells, coarser when zoomed out (res 4 / 5 / 7, then res 8 from z 11.5, meeting the Silver Lake grid); listed per viewport and cached, so a drawn cell never changes; same opacity ramps and palettes.
  - **Parcels are coloured on load**, fading in 15.6 → 16.2 and strengthening to 17, with thin warm-grey lot lines (#8A7A72). Each lot has its own value (area value plus a fixed per-lot offset), so parcel zoom reads as a mosaic; hexes keep the area value.
  - Pedro's lots (`bz-lots`) and the county parcels (`bz-la`, underneath) carry their own `roi` / `ub`; his building footprints (`bz-bldgs`, `public/data/silverlake-bldgs.json`, loaded on demand) draw over them from 15.6, with his colours. Live Regrid parcels (Dallas) get their value as feature state `v` (keyed by `ll_uuid`) as tiles load; demo parcels carry it as a property and are left out of the lot zone.
  - Everything is translucent: each palette has a tuned layer opacity (Pedro's is 25%), so streets read through.
  - Switching layer (ROI ↔ Underbuilt ↔ none) fades the old one out and the new one in (`fadeHeatTo`, ~0.6 s); it used to flick.
  - One colour scale for hexes, parcels, the lifted slab, the map key and the "Match heat layer" pin route. Values are real percentages; the 0–1 fake field is spread along the bands (ROI 0/5/10/20/30/45; 5-colour palettes use 0/10/20/35).
- **Parcel hover, zoom ≥ 15.4** (`ParcelLift.tsx`). Drawn once per camera rest relative to the parcel's centre, then moved / scaled / rotated on the map's `move` event, so the hovered or selected slab stays on its parcel while the map eases (team: it slid when selecting):
  - The parcel lifts off the map as a solid slab: drop shadow, stacked sides, an **opaque** top and the house number, with a dashed outline on the ground.
  - No opacity change on hover (12 Nov review: crossing a road between parcels pulsed the whole map): the light veil round the parcel shows only for a selected parcel, with no fade; the slab just lifts.
  - With the heat map on, the slab keeps its parcel's band colour (softened 60% toward paper, since the slab is opaque); with it off, it's neutral.
  - In satellite: the rest of the map dims, the slab top is the satellite image (Mapbox Static) with a yellow edge, and there are no colour washes.
- **Selection framing** (`lib/map/frame.ts`): opening a property (pin, card, saved property, address) or clicking a parcel fits the **whole lot** into the free map space between the detail panel and the viewport edge, below the filter bar, centred, with an even 64 px margin. The frame keeps at least 70 m of ground across and stops at zoom 19 (review: the zoom was too tight), so the street and neighbours stay in view. A real lot uses its own outline. A parcel uses its outline; a listing fits a lot-sized square first, then settles on the parcel under it once drawn.
- **Searched-area outline:** option 04, "inner glow edge". A thin clay line (rgb 147,89,75) plus a soft clay gradient inside the boundary; nothing outside. The glow widens with zoom while the line keeps a fixed width.
- **Map controls**, bottom-right, from the bottom up: Layers (84 px card with thumbnail), zoom, my location, info. The Layers and info panels open to the left. Layers cover the data layer (ROI / Underbuilt / none) and the map type: Breezy light, Breezy dark, Streets, Satellite. Light ↔ dark switches presets in place; on dark, pale heat bands are blended toward the land so "neutral" doesn't read as a grey veil.

**Detail panel** (`DetailPanel.tsx`)
- Photo carousel, address, specs row, then sticky tabs: **Summary / Specs / Records / Owners**.
- Summary only:
  - A floating **Quick estimate** card with the big number and a **Get comps** button.
  - Max build + Profit potential tiles: the same figures as the reports they open (Build guidelines' Underbuilt %, Upside's estimated profit; "None" when no build pays).
  - An **Owner** section (56 px avatar, "View history" on the right), then the listing description. Owner contact lines copy on click, and each says **Verified** (green seal) or **Unverified** (11 Nov comment; fake, stable per value).
- **No estimate (`noQe`):** only reachable from the Dev menu ("Property with no estimate"; every property has an estimate). The full-width CTA layout (decided): title and one-line explanation with the illustration on the right, a full-width outline "Get price estimate" underneath; it loads, then shows the estimate and a positive toast.
- "View more" buttons have no arrows.
- Footer: alert + share icons and a primary **Contact owner** (no "1 credit" text on the button). Once unlocked it becomes one primary **Email owner** (`mailto:`); no Call on web (12 Nov comment).
- **Contacts (10 Nov review, metered since the paywall):** the Owner section shows the lines masked and "Uses 1 contact · 18 of 25 left this month" before unlocking, "Contact unlocked · 17 of 25 left this month" after, plus an "Owner unlocked · …" toast. No confirmation step; each owner is charged once per period (mock billing, see Paywall). Pressing it scrolls the panel to the Owner section (switching to Summary if needed); once the scroll settles, the phone, email and address are written in left to right by a soft clay → violet gradient edge (staggered 160 ms, a faint sheen behind), then settle to plain copyable text; the footer becomes Email owner.

**Flows and sheets**
- **Report sheet** (`components/report/ReportFlow.tsx`, canvas `rptLayer` / `_wsTilt` / `_runFlow`): opened by **Get comps**, the **Max build** tile (Underbuilt) and the **Profit potential** tile (ROI).
  - The workspace (map + map-area panels) tilts back (perspective, rotateX 9°, scale .9, `html[data-flow]` in `globals.css`) and dims, while a white sheet rises from the bottom in perspective over everything right of the side nav (0.7 s).
  - **No loading stage (12 Nov review): the report is written in front of the user.** Slowed down 13 Nov ("a moment of delight"): a ~1.1 s beat with every skeleton shimmering, then the pieces arrive one by one (~0.24 s apart, each fading in over ~0.9 s). Max build (Build guidelines) and Profit potential (Upside) open straight on the report (`components/report/aiWrite.ts`, `useAiWrite`): every component (paragraph, heading, card, chart) starts as a clay → violet AI-gradient skeleton drawn on its own text lines and images, then fades in with a 12 px lift. Above the fold resolves top to bottom after the loading beat; the rest as it scrolls into view, after a short writing beat; anything jumped past just appears. Only the first open: a report that has run reopens whole. (The old loading stage code, `run` / `done`, is unused.)
  - Comps first confirms the subject property (review modal), then "Let AI do the work" inside the sheet (auto-runs after 6.7 s unless the pointer rests on Get comps).
  - Report header: Back to map, tabs **Upside analysis / Build guidelines / Comps** (a tab that hasn't run starts its flow), Share. A report that has run reopens on its result.
  - **Build guidelines** = `UBReport.tsx`: version D ("Property") main column of the Underbuilt Report Versions design, no property card, spread to the full sheet width on white (review feedback) like the Comps result. Margins match the Upside analysis (12 Nov review): 1280 px column, 80 px sides (Upside's `--wrap-pad` steps), 80 px above. Recorded from `design-reference/underbuilt-report/` by `scripts/extract-ub-report.mjs` into `public/ub-report/`; modals, expandable rules, build options (option × plan/section × roof), dots rail, glossary drawer and "Get Comps" links all work. No drop shadows on this page (review): cards get a 1 px light grey outline (`--breezy-shadow-xs/sm/md` overridden on `.ubr`); dialogs keep their shadow. The recorded sample is rewritten per property in one pass (address, lot area / width × depth, living area, by-right max and Underbuilt %, coverage, ADU sizes, every build option's figures; yards, height, floor area, density by zone). The rules are **Los Angeles's for the lot's zone** (`lib/zoning/la.ts`: R1 / R2 / RD / R3 / R4 / C / PF, height district from the suffix, e.g. 1VL = 45 ft, 3 stories; R1 = 33 ft pitched / 28 ft flat, residential floor area 0.45 × lot): LAMC section citations with plain-English summaries in the § modals (link to the code), the uses cards rebuilt per zone (ADU / junior ADU by right, SB 9 in R1, conditional uses via Zoning Administrator), state ADU rules, parking (AB 2097), fences. The "verified by our architects" banner is replaced: a note says these are summaries and points to ZIMAS for overlays (hillside, HPOZ, specific plans, Q / D conditions), which aren't applied.
  - **Upside analysis** = Pedro's Upside tab (`components/report/upside/`, CSS scoped under `.bz-up` in `upside.css`, art in `public/report/`), run by his model copied unchanged into `lib/roi/` (one change: no remodel / ADU jobs on a vacant lot). Pedro agreed to his code and data being in this repo and on the public preview (11 Nov). Inputs from the Listing via `lib/roi/property.ts`: real lot outline / zone / house figures for his lots and county parcels; by-right = sqft / (1 − ub), bonus and largest-nearby seeded. Like his `calibrate.ts`, the sale price per ft² is tuned so the recommended build's return equals `l.roi`, so the gauge agrees with the map. Hero + gauge (in the current ROI palette), Buy → Improve → Sell → Profit, build size chart + slider, ledger, scenarios, neighbourhood (fake stats), live "Adjust assumptions" panel. Neighbourhood insights are real (`hoodStats` in `lib/comps.ts`, `lib/data/sl-hood.json` from `scripts/build-hood-stats.mjs`): median $/ft² and sales in the last 12 months from Pedro's sales within ¾ mile, comps' median size, largest nearby home (Pedro's `nb` for his lots, else the largest within ½ mile on a similar lot), median year built and share of homes 50%+ underbuilt around the property (county + Pedro's parcels), and the ZIP's rank by that share.
  - **Comps** = `components/report/CompsReport.tsx`, the comps review screen (canvas `resIsComps` / `_cmVals`, brought up to the Breezy app's version in the breezy repo, `app/(dashboard)/comps`). **No loading screen (review, progressive disclosure):** after "Let AI do the work" the report opens at once on the subject and its estimate, and the comps arrive one by one ("Estimating comps n of N", a shimmering placeholder for the next, each card fading in with a 16 px lift, ~0.4 s apart); a report that has run reopens whole. Left, the subject's photos with **Show analytics** (Sold / Active, Avg. Sales / Home $/ft² / Lot $/ft² / Days on Market, comps as bars sorted by the picked average, hover for the address) and a static-map thumbnail that opens the comps on a map, the subject card (stats, Built + AI feature chips, owner, last sold) and the Home price card, always side by side (included sold comps' average $/ft² × size; **Lot price estimate** switches to lot $/ft² × lot; vacant lots use lot; **Set your estimate** under it opens a slider dialog and "Your estimate" then replaces the price for the session); right, the comps in two columns that drop to one on narrower screens, "n Comps to review", Sold / Active counts and the included comps' average, Add comps (next best candidates) / Hide excluded / View table, then Sold and Active sections of cards (match %, photos, Built + garage chips, listed for / sold for / change, history, $/ft², per ft² lot, DOM, listed on / sold on, Included switch). Excluding a comp greys it and drops it from every average. Comps from `compsFor` / `compPool` in `lib/comps.ts` (up to 12 sold + 6 active of Pedro's lots, ranked by distance, size, beds, recency): address, size, beds / baths, lot, year, $/ft², distance and month sold are real; list prices, dates, DOM and garages are seeded (`compDetail`). The same list sets the loading title and Upside's "Based on n comps".
  - **Comps interaction 2.0 (branch `comps-interaction-2.0`, 13 Nov):** **Get comps in the detail panel** no longer opens the report sheet. The detail panel slides left over the left column (which fades back), the comps list slides in from the right, and the map stays open between them with a pin per comp (`components/comps/`).
    - Shared state: `useComps` (one session per property; exclusions, added comps, Hide excluded and Home / Lot are kept for the session). Comps arrive one by one (0.9 s, then one every 0.38 s), in the list and on the map together; the first run saves the report ("Report saved to Reports").
    - Left (`CompsEstimate`): the quick estimate card becomes the comps estimate. A Home / Lot switch, the price worked out live from the included sold comps with the sum shown ($/ft² × ft²), the quick estimate for reference, and Set your estimate (Edit / Use comps once set).
    - Right (`CompsSide`): "n Comps to review", Sold / Active counts, average. A **Cards / Table / Analytics** switch keeps the table and analytics one tap away. Hovering an analytics bar lights its comp's pin on the map, and hovering a pin lights its bar. **Hide excluded** (eye) and **Add comps** sit next to it. Cards come in two columns (≥ 1360 px window, 580 px panel), else one (360 px). × or Escape closes comps and the panel slides back.
    - Map (`CompPins`): the subject is a dark pill with a house and the estimate; comps are white price pills with a Sold (clay) / Active (green) dot. Excluded pills are struck through and grey. Pins that would overlap fold into dots. Hovering a pin lights its card and the reverse; clicking a pin scrolls to its card. The camera fits the subject and all comps between the panels. Regular price pins, the filter bar and Search this area are hidden; map controls and the heat switcher move left of the panel.
    - **Comps follow the search filters (13 Nov, William: continuity over a separate comps search; Figma "Web experience 1.9" k2nWEKJfDyT6wf3i7zVETq, 7785:20106 had its own parameters).** When comps open, the search's own filter bar slides left with the detail panel and stays above it (the panel drops under it, `DETAIL_TOP`), stopping before the comps panel. Editing a filter edits the comps (`compsFor(l, radius, F)` in `lib/comps.ts`): status (Sold → sold comps, its "Sold within" tag → months; Active / Pending → active comps), price, ROI, build potential, type / style / features, beds, baths, size, lot. Dropdown and All filters CTAs count comps ("Show 14 comps"). The filters stay set after comps close, so the search keeps them. A **"Within 1 mile"** chip leads the row (`RadiusChip`, ¼–5 mi) and the radius draws on the map as a dashed clay circle with a drag handle on its edge (`CompRadius`, `bz-comp-r`). The comps panel notes "Comps follow your search filters (n on) · Clear filters"; if the status filter leaves out sold homes it warns there's nothing to estimate from, with **Show sold**; no match → Clear filters / Widen to 2 miles.
    - **Set price estimate (export, 13 Nov, same Figma section):** the comps panel's footer shows the comps count and estimate with a primary **Set price estimate**. It raises an export sheet from the bottom (workspace tilts like the report sheet; `components/comps/CompsExport.tsx`): header with back + address, the stepper **Price estimate → Adjust comps → Customize**, Save (draft to Reports) and Continue / Download report. Left the step: (1) Single / Range, High / Estimate / Low rows with $/ft² and inline edit (the estimate is the session's "Your estimate", shared with the detail panel), Home / Lot, price legend toggle, "You're in control" tip; (2) subject card with Edit and the comps (Sold / Active tabs, included comps only), each with an edit modal (Specs / Features / Records) and a comment (1600 characters); (3) Full report / Table view, Paper / Breezy / Branded (locked: Elite), include a client (search a sample list or add new), sections to include. Right: the client report, redrawn live and scrolled to the part the step is about (changed parts pulse). Download report prints that page (browser "Save as PDF"). Edits are kept per property for the session.
    - The report tabs and saved reports still open the old Comps report sheet.
  - Area comps come from Create comps (`AreaCompsPreview`, still the older full-screen view).
- **Saved** (`Saved.tsx`, `SavedState.tsx`): save-search sheet, `SaveToggle`, the Saved sheet (opens from Home and Results).
- **Alerts panel**, "Set custom alerts":
  - "Any activity" with an Active / Turn on pill.
  - Price drop / bump use a % stepper ("Alert when · Price drops N% below current price").
  - One Save button.
- **Share** (`Share.tsx`): share one property or the picked set.
- **Reports** (`Reports.tsx`): comps and area reports.
- **Toasts** (`Toast.tsx`), bottom centre, tones neutral / positive / negative. "No property found" uses the neutral black info icon.

**Paywall: Nimbus pricing (branch `paywall`, 13 Nov; launch January 2027)**
- **One plan, Agents Pro** ($24.90/month, shown as a special offer over ~~$39.90~~, single seat). Included: comps & notes, AI assistant, Market Radar alerts (unlimited), Inman News; **5 Max Build reports, 5 ROI reports, 25 owner contacts a month**. Overages are bought as credits (single vs 5-pack, ~20% saving; Max Build + ROI bundle; 10 contacts for $5). No customer unlimited plan, no tier picker. Trials and win-back by segment; $9.90/month save offer on cancel.
- **Every price, allowance, pack, trial and offer lives in `lib/pricing.config.ts`.** Components never hard-code one.
- **Entitlements (`lib/billing.ts`, mock, localStorage `bz-billing`):** `useEntitlements()` gives `access(feature, key)` = unlimited / owned / allowance / credit / locked / plan / open, and `spend`. Allowance first, then credits, then the upsell. An item unlocked this period (per property, `reportKey`) reopens free. `paywall.open({ kind })` opens a sheet from anywhere (upsell, offer, plan, winback, news), rendered by `BillingHost`.
- **Lock at the point of need, never hidden (`components/billing/Paywall.tsx`):**
  - Max build / Profit potential tiles carry a usage chip ("3 left", credits, lock). Opening a report spends from the allowance with a toast ("ROI report · 2 of 5 left this month").
  - Past the allowance, the report still writes its top part, and `LockVeil` blurs the rest with a credit confirmation ("Use 1 credit") or the upsell (single vs 5-pack side by side). Buying unlocks at once.
  - Contacts: locked lines show masked ("(•••) •••-4821"); Contact owner spends one contact (no confirmation, 10 Nov rule); none left → "Get 10 contacts · $5" → upsell, then unlock.
  - No trial / plan (expired, churned): reports and Contact owner show the Agents Pro offer; comps still arrive with a veil after the first cards and a blurred estimate; Set price estimate and the alerts bell open the offer; AI Notes, Assistant, Inman News and Run comps show a small lock in the nav.
  - **Heat layers stay free** (the hook).
- **Surfaces:** the trial card in the side nav footer (days left, bar; replaces "Upgrade to team"; teams are out of scope), Settings → Plan & usage (plan, renewal, a meter per metered feature, purchased credits, Buy more, Cancel plan → save offer), win-back sheet for Breezy 1.0 segments (60 / 30 days free, card required; paying 1.0 users: "billing starts 14 days after install"), Inman News sheet (sample placeholders until the feed is connected).
- **Dev menu:** "Plan state…" (user state presets: trial day 3 of 14 / 27 of 30, active, some used, allowance used up, has credits, trial expired, 1.0 segments; **lock style**: partial report / full blur / locked tile; new-user trial A/B 14 / 30) and **"Unlimited (internal)"** on / off (bypasses all metering; never a customer plan).

**Developer menu** (side nav), to preview states on demand:
- Restart onboarding
- Snackbars (neutral / positive / negative)
- Search failed / timed out / no recents
- Property with no estimate
- Plan state… and Unlimited (internal) (paywall, see above)

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
- Onboarding pins (`components/onboarding/OppPins.tsx`) use the same market radar marker, 25% larger, with the label pill on steps that show labels; they pulse until selected.
- The colour-route switcher is gone.

## Design rules (from review feedback; keep them)

- **Side nav:**
  - Collapse toggle at the top, with the Breezy wordmark next to it when expanded.
  - Items: Map, Comps, Underbuilt, AI Notes, Assistant, **Inman News** (13 Nov: added as the entry point for the news included in Agents Pro; it replaces the earlier "No News" rule).
  - **Exploring (10 Nov review): actions version, on by default.** Comps and Underbuilt become actions at the top, like Claude's "New chat" / "Search": "Run comps", "Find underbuilt", and **"New buyer search"** (12 Nov review, so agents find search: it opens the search step with "Where is your buyer looking?", and once an area is picked the Save search sheet opens), plain rows in regular weight with their existing icons and no selected pill. A hairline, then the places (Map, AI Notes, Assistant) in regular weight, keeping the dark pill. The Dev menu switches "Side nav: classic / actions" (localStorage `bz-nav-style`). Run comps / Find underbuilt aren't wired to flows yet.
  - Icons are transparent isometric PNG / SVG in `public/nav` (`map-iso`, `comps-iso`, `radar`, `ai-notes-new`, `assistant`), optically equalised by `ICON_SCALE`.
  - The active item has a **dark pill**. Icons never fade.
  - Footer: the trial / plan card, Reports, Settings (opens Plan & usage), Dev menu, avatar. "Upgrade to team" is gone (single-seat plan).
- **Illustrations:** isometric "skeuomorphic" scenes in the Breezify Core Figma style (file `N81mxdVxHzi9rmqU2qw0xn`, node 7612:60), in `public/iso/`. Full-resolution copies for the team are in `~/Downloads/Breezy-isometric-illustrations/`.
- **Colours:** ink rgb(18,18,18), paper rgb(253,252,252), clay rgb(175,127,113), deep clay rgb(147,89,75), nav background rgb(245,243,243), Breezy yellow rgb(255,209,41).
- **Type and icons:** Akkurat LL (`public/fonts`); Phosphor icons (`public/vendor/phosphor`).
- Match the canvas. When something isn't specified there, follow these rules rather than inventing a new pattern.

## Open items

- **Report sheet:** Build guidelines' LA rules are summaries without parcel overlays (hillside, HPOZ, specific plans, Q / D conditions) until the Underbuilt service covers LA; comp prices are Pedro's value figures, not recorded sale prices.
- Draw-area tool: placement still undecided. The "Search this area" zone diagram is coming from William's Figma.
- Make saved reports easier to reach, as on mobile.
- Welcome-panel polish: rounder corners, no bottom padding between list items, skeleton loading piece by piece.
- Read state on Searches / market alerts: same pattern as the feed (dated, "New", red dot until opened) still to apply there.
- **Heat palette:** pick one with Ann and Jimsy and remove the switcher. Underbuilt band cut points are the parcels' quantiles (5 bands 25/44/59/74) until JD's service defines them.
- Pedro's smooth heat surface (canvas image + water clip) is not ported yet.
- Real heat and real parcels cover only the 3 km circle round Silver Lake; the rest of the US has dummy hexes and demo parcels. Growing the real circle means re-running `scripts/fetch-la-parcels.mjs` with a bigger radius (the parcel file grows with it).
- Regrid: ask for LA County coverage before the trial ends (4 Dec 2026).
- **Breezy map theme:** the current light theme is approved. Optional later: duplicate Pedro's style in Studio as Breezy Light / Dark with the values in `docs/map-theme.md` (plus dark land #221d1b) so it no longer depends on his style. Needs Mapbox access.
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
components/report/          ReportFlow (report sheet + flows), UBReport (Underbuilt analysis), aiWrite (AI-writing reveal)
components/comps/           comps interaction 2.0: useComps (session, follows the search filters), CompsSide, CompPins,
                            CompsEstimate, CompRadius (circle + RadiusChip), CompsExport (Set price estimate sheet)
components/billing/         Paywall: OfferCard, UpsellOptions, LockVeil, UsageChip, BillingHost (plan & usage, cancel,
                            win-back, news), TrialCard, BillingDevPanel
components/onboarding/      OppPins
lib/config.ts               env-driven config, isLiveMap / hasRegrid
lib/map/style.ts            live vs offline styles
lib/map/layers.ts           heat hexes (+ wave reveal), parcels (Regrid or demo), area inner-glow layers
lib/map/usHeat.ts           US-wide demo heat hexes (H3 tier per zoom, per-viewport, cached)
lib/map/theme.ts            optional Breezy palette over light-v11 (inactive)
lib/photos.ts               listing photo galleries (public/photos/l)
lib/places.ts               search, boundaries, gazetteer, viewportPlace, isCovered
lib/geo.ts                  ring winding, bbox, point-in-rings
lib/fake.ts                 demo data (listings, detail, owners, estimates, heat); lotListing / listingAt for real lots
lib/silverlake.ts           Pedro's Silver Lake lots (lib/data/silverlake.json), HEAT_AREA circle, lot zone
lib/filters.ts              filter model and defaults
lib/pinColors.ts            signal pin colour families
lib/pricing.config.ts       Nimbus pricing: plan, allowances, SKUs, segments, save offer
lib/billing.ts              mock billing state, presets, useEntitlements, paywall requests
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
