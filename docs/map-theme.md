# Breezy map theme: light and dark

Engineering handoff for design point 3 (basemap hierarchy). The goal is for the heat map and pins to dominate, with roads, highways and greens stepping back.

**Status:** live in the prototype as runtime presets (`lib/map/breezyTheme.ts`). It is not yet a duplicated Studio style with its own ID. That step is in "To finish" below.

## Base style

| | |
|---|---|
| Style | `mapbox://styles/dev-breezy/cmgfg4m3e007y01re4uq6bz83` (BZYREPORT-LIGHTTHEME, Pedro's) |
| Type | Mapbox Standard, imported as `basemap` |
| Font | Akkurat LL (dev-breezy account fonts). The account has no Medium cut, so rewrite Medium glyph requests to Regular. |
| Data layers | Add heat, parcels and outlines in the `middle` slot (above roads, below labels), with `*-emissive-strength: 1` so the night preset doesn't tint them. |

Apply the values below as Standard config, `map.setConfigProperty("basemap", key, value)`, or bake them into the duplicated style.

## Shared (light and dark)

| Key | Value | Why |
|---|---|---|
| `font` | Akkurat LL | Brand type |
| `show3dObjects` | false | Flat map. 3D competes with parcels. |
| `showPointOfInterestLabels` | false | POIs compete with pins |
| `showTransitLabels` | false | |
| `showAdminBoundaries` | false | |
| `showPedestrianRoads` | false | |
| `showPlaceLabels` | true | |

## Light

| Key | Breezy light | Pedro's value | Change |
|---|---|---|---|
| `theme` | faded | faded | |
| `lightPreset` | day | day | |
| `colorRoads` | #e2d9d3 | #dacbc3 | Lighter, less red, so streets sit under the parcels |
| `colorTrunks` | #e7e2df | #e5dfdc | |
| `colorMotorways` | #e4e0de | #e3dfde | Highways read as wide quiet bands, not orange lines |
| `colorGreenspace` | #d2dcc9 | #c2d6b4 | Desaturated, so parks don't compete with the cool heat band |
| `colorWater` | hsl(190, 22%, 82%) | hsl(177, 33%, 80%) | Greyer, still clearly water |
| `colorRoadLabels` | hsl(20, 4%, 52%) | hsl(0, 0%, 44%) | Lighter and warm-neutral |
| `colorPlaceLabels` | hsl(20, 5%, 38%) | hsl(0, 0%, 40%) | |

The style's own layers: `housenum-label` text hsl(20, 5%, 46%) with a paper halo; `building` #e8e3de.

## Dark

| Key | Breezy dark | Production (`navigation-night-v1`) |
|---|---|---|
| `theme` | monochrome | n/a |
| `lightPreset` | night | n/a |
| `colorRoads` | #3a3634 | primary roads #343434 |
| `colorTrunks` | #403b39 | |
| `colorMotorways` | #45403d | |
| `colorGreenspace` | #2f3b31 | #405e44 (desaturated here) |
| `colorWater` | #1f3638 | #234447 (desaturated here) |
| `colorRoadLabels` | hsl(20, 6%, 58%) | |
| `colorPlaceLabels` | hsl(20, 8%, 74%) | |

The style's own layers: `housenum-label` text hsl(20, 6%, 66%) with a dark halo; `building` #2c2827.

**Limitation:** this Standard version has no config for land, buildings or land use. Production's landmass is #221d1b. The closest config allows is `monochrome` under `night`, a neutral dark grey. Land colour has to be set in the duplicated Studio style.

## Heat on dark

A pale palette band (the sand "neutral") reads as a grey veil on a dark map. In dark mode, the prototype blends each band toward the land (rgb 36,32,30) in proportion to its lightness: strong slate and clay keep their hue, while pale bands mostly disappear. See `forDark` in `lib/heat/index.ts`.

## To finish (needs Mapbox Studio access)

1. In the dev-breezy account, duplicate BZYREPORT-LIGHTTHEME twice: **Breezy Light** and **Breezy Dark**.
2. Set the config values above on each, plus the dark land colour (#221d1b) on Breezy Dark.
3. Publish both, and put the style IDs in `NEXT_PUBLIC_MAPBOX_BREEZY_STYLE` (light). The dark ID goes in a new variable, or keep one style and switch presets.
4. Confirm with Ann and Jeff that these are the bases engineering should use.
