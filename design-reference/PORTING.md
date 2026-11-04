# Porting checklist: canvas → Next.js

Source: `design-reference/project/Home Web.dc.html`. Handler names are grep anchors into that file. Port **one area per session**, matching the canvas pixel for pixel, then tick it off here. Keep the rules in `CLAUDE.md` (they override the canvas where they differ, e.g. no News nav item).

Status: ✅ ported · 🟡 partial · ⬜ not started

## Already in the app (verify against canvas)

- ✅ Side nav collapse / wordmark — `onNavToggle`, `onToggleRail`
- 🟡 Search field + suggestions — `onClearSearch`, `sg.pick`, `onFooterSearch`, `onUseMyLoc`, `onUseCurLoc`, `onLocPill`, `onLocClose`
- 🟡 Price pins, collapse pills, hover card — `p.enter`, `p.pick`, `onHoverKeep`, `onHoverOpen`, `hvCar.next/prev`, `onPillLeft/Right`
- 🟡 Detail panel — `onCloseDetail`, `onCloseSel`, `onGalNext/Prev`, `onFlipHero`, `onDescToggle`, `onOwnersTab`, `onOwnerReveal`, `onDetGetComps`, `onViewProperty`
- 🟡 Map controls + layers — `onZoomIn/Out`, `onRecenter`, `onInfoToggle`, `onToggleLayers`, `onLayersEnter`, `onLayerBack`, `lt.pick`, `ml.pick`, `mt.pick`
- 🟡 Comps flow — `onGetComps`, `onReviewClose`, `onReviewConfirm`, `r.onReview`, `onBackSummary`, `onCompsBack`, `onCompSelf`, `onResultBack`, `onResultComps`, `onResultEdit`, `gcPause`

## Not yet ported

### Home panel (For you / Searches / Properties) — `components/home/HomeCard.tsx`
- ✅ Tabs + saved searches list with "n new" badges, avatars, chips — `t.pick`, `ss.open`, `ss.enter`, `ss.del`, `onHcViewAll` (opening a search clears its "n new")
- ✅ Saved properties list, sort, delete confirm, "All updates" full view — `pp.open`, `pp.enter`, `pp.del`, `onHcSortToggle`, `onHcDelCancel`, `onHcDelOk`, `onHcStart`, `onHcBack`. Delete is only offered in the full view, as in the canvas.
- ✅ "New match" badge clears on first interaction (hover or open) (sprint item)
- ⬜ `onManageSearch` (active saved-search header in the search field) and `pp.add` (save from detail): belong to the search field and detail panel areas
- ⬜ Thumbnail hover preview — `onThHoverOpen`, `onThHoverKeep`, `thGal.next/prev`. This is the hover card for the small dot pins on the map, not the lists; port it with the price pins.
- Note: "For you" keeps the V5 onboarding hand-off list (the canvas compact card shows nothing under that tab) and stays the default tab, so the onboarding flow lands on the matches.

### Filters
- ⬜ Filter bar dropdowns: All filters, ROI, Build potential, Status & price, Type — `onOpenPanel`, `onPanelClose`, `onPanelApply`, `onFilterReset`, `onDdClose`, `ddClear`, `fs.*.toggle`, `fd.inc/dec`, `rt.pick`, `rc.pick`, `rz.pick`, `op.pick`, `ds.toggle`, `pr.toggle`, `sp.toggle`, `sp.focus`, `onSpCollapse`
- ⬜ Active filter chips — `ch.remove`, `onClearActive`
- ⬜ Results sort — `onSortToggle`, `onSortClose`, `o.pick`

### Saved searches & alerts
- ⬜ Save search sheet (name, notify, assign contact) — `onSsSave`, `onSsClose`, `onSsNotify`, `onSsRemove`, `onSsSearchContact`, `onSsNewContact`, `sn.pick`
- ⬜ New contact form — `onContactAdd`, `onContactCreate`, `onContactCancel`, `c.*`
- ⬜ Alerts panel — `onBell`, `onAlertSave`, `onAlertClose`, `onAlertReset`, `alAny.toggle`, `ar.toggle`
- ⬜ Unsaved-changes guard — `onUnsavedSave`, `onUnsavedDiscard`, `onUnsavedCancel`
- ⬜ Remove confirm — `onRemoveConfirm`, `onRemoveCancel`

### Area search
- ⬜ "Search this area" pill (trigger when viewport ~50% empty of pins) + draw area — `onTryArea`, `onAddArea`, `onShowNearest`, `onPickedClear`
- 🟡 "No property found" toast with neutral black info icon (sprint item): `Toast` has the `info` tone; wire it when area search lands

### Share
- ⬜ Share property / picked set, link sheet, quick copy, share to contact — `onShareProp`, `onSharePicked`, `onShLinkOpen`, `onShLinkCopy`, `onShLinkClose`, `onShQuickCopy`, `onShContact`, `onShClose`, `sv.*`

### Monetisation
- ⬜ Trial banner, upsell card, paywall, plan picker, payment, done — `onUpgrade`, `onUpsellClose`, `onPaywallClose`, `onUnlockRoi`, `onPayConfirm`, `onPayDone`, `u.pick`, `a.pick`, `b.pick`

### Reports & tags
- ⬜ Saved reports access (make it as easy as mobile — sprint item) — `onOpenSaved`, `onCloseSaved`, `rw.edit`
- ⬜ Tags flow — `onTagsGo`, `tc.pick`

### Onboarding helpers inside Home
- ⬜ Splash, tour tips, peek states — `onSplashSkip`, `onTourNext`, `onTourDismiss`, `onTourCta`, `onClosePeek`
- ⬜ Lightbox — `onLbNext`, `onLbPrev`, `onLbClose`
- ⬜ Comps result cached on reopen (sprint item)

## V5 onboarding

`Home Web V5 Prototype.dc.html` is the reference for `app/onboarding/page.tsx`. Diff the step sequence and each step's copy and motion against it.

## Prompt to use in Cursor

> Read `design-reference/README.md` and `PORTING.md`. Port the **<area>** section from `design-reference/project/Home Web.dc.html` into the Next.js app. Find each listed handler in the canvas file, reproduce its template markup (exact styles) and state logic as React components under `components/home/`, use `lib/fake.ts` for data, and keep the shared map in `MapProvider`. Then run the app, compare against the canvas page served locally, and update the checklist.
