# design-reference

The **source-of-truth design prototypes** exported from the Claude Design canvas, unchanged except that React and Babel are vendored so they run offline.

- `project/Home Web.dc.html` — full Home Web prototype (~7.4k lines: template + `class Component` logic). Every interaction, state and copy string is in here.
- `project/Home Web V5 Prototype.dc.html` — V5 onboarding + activation flow.
- `project/support.js` — the canvas runtime (renders `<x-dc>` templates with React). Points at `vendor/react/` instead of unpkg.
- `project/assets`, `fonts`, `vendor` — everything the pages reference.

## Run it

The Mapbox token is not committed. Create `project/local-config.js` (gitignored) containing:

```js
window.BZ_MAPBOX_TOKEN = "pk.…"; // same value as NEXT_PUBLIC_MAPBOX_TOKEN in .env.local
```


```bash
npx serve design-reference/project      # or: cd design-reference/project && python3 -m http.server 5055
```

Open `http://localhost:3000/Home%20Web.dc.html` (or `.../Home%20Web%20V5%20Prototype.dc.html`). Click through it side by side with the Next.js app at `localhost:3000/home` (run serve on another port, e.g. `npx serve -l 5055 design-reference/project`).

## How to read a .dc.html file

- **Template**: the `<x-dc>` block. `{{ expr }}` holes, `<sc-if value="{{ cond }}">` for conditional UI, `<sc-for>` for lists. Inline styles are the exact spacing / colours / radii to match.
- **Logic**: `class Component extends DCLogic` near the bottom. `state` holds every UI state; `renderVals()` derives what the template reads; `onXxx` methods are the handlers wired in the template (`onClick="{{ onGetComps }}"`).
- Searching for a handler name (e.g. `onSsSave`) finds both its template wiring and its logic.

This folder is reference only: don't import from it in the app. See `PORTING.md` for what still needs porting.
