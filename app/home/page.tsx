"use client";
import { BuyerWizard, BuyerResult } from "@/components/home/BuyerWizard";
import { CreateRun, TaskBar } from "@/components/home/TaskBar";
import { resetCreateIntro } from "@/components/home/CreateMenu";
import { resetTips, tipDone } from "@/components/HelpTip";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useMapCtx } from "@/components/map/MapProvider";
import { useApp } from "@/components/AppState";
import { SideNav, NAV_W, DevAction } from "@/components/home/SideNav";
import { SearchBar, previewSearchState } from "@/components/home/SearchBar";
import { ResultsPanel, SortMenu } from "@/components/home/LeftPanel";
import { AllFiltersPanel, FilterBar, FilterDropdown, useFilterState } from "@/components/home/Filters";
import { HomeCard } from "@/components/home/HomeCard";
import { Toast, useToast } from "@/components/home/Toast";
import { PricePins } from "@/components/home/PricePins";
import { HoverCard } from "@/components/home/HoverCard";
import { ParcelLift, ParcelHit } from "@/components/home/ParcelLift";
import { DetailPanel } from "@/components/home/DetailPanel";
import { MapControls } from "@/components/home/MapControls";
import { AreaCompsPreview } from "@/components/home/CompsFlow";
import { FlowKind, ReportFlow } from "@/components/report/ReportFlow";
import { frameLot } from "@/lib/map/frame";
import { useComps, compLngLat, isCompsManual, setCompsManual, setSubjectSpecs, subjectSpecs, asReviewed } from "@/components/comps/useComps";
import { AreaDraw, AreaToggle } from "@/components/comps/CompArea";
import { CompsReview } from "@/components/home/CompsFlow";
import { CompsChoice } from "@/components/comps/CompsChoice";
import { MINI_W, SubjectMini } from "@/components/comps/SubjectMini";
import { CompsSide } from "@/components/comps/CompsSide";
import { CompPins } from "@/components/comps/CompPins";
import { CompRadius, RadiusChip } from "@/components/comps/CompRadius";
import { CompsExport } from "@/components/comps/CompsExport";
import { compsFor } from "@/lib/comps";
import { SavedSheet, searchCriteria, seedFilters, useAlerts, useSearchSheet } from "@/components/home/Saved";
import { SavedSearch, propKey, useSaved } from "@/components/SavedState";
import { ShareModal, useShare } from "@/components/home/Share";
import { AreaReport, ReportsSheet, useReports } from "@/components/home/Reports";
import { Listing, OppType, listingForAddress } from "@/lib/fake";
import { Filters, SortKey, fDef, fDims, homeOk, migrateF, sortListings } from "@/lib/filters";
import { askNotifyOnFirstAlert, eventSummary, searchEvents } from "@/lib/searchAlerts";
import { Area, Place, areaSq, isCovered, resolveArea, searchPlaces, viewportPlace } from "@/lib/places";
import { BBox, LngLat, hashStr, pointInRings, ringBBox } from "@/lib/geo";
import { accessNow, billing, paywall, reportKey, spend, trialLength, useEntitlements } from "@/lib/billing";
import { PROFILE, TRIAL_STATES, handoffProfile, profileLastViewed, profilePlace, profileSaved, useHandoff } from "@/lib/handoff/profile";
import { DeskChecklist, TrialBanner, endTip, firstCompTips, tourSteps } from "@/components/home/Handoff";
import { BillingHost } from "@/components/billing/Paywall";
import { getStarted, taskOf, useGetStarted, type Task } from "@/lib/getStarted";
import { Checklist, Coach, CoachStep, EarnedToast } from "@/components/home/GetStarted";

const GAP = 12;
// Results column width per layout (1 / 2 / 3 columns of cards); Home and 1 column stay 388.
const COL_W = [388, 388, 664, 940];
// Window width needed for 2 and 3 columns (the map still keeps ~800 px next to them).
const colsFit = (w: number) => (w >= 2100 ? 3 : w >= 1600 ? 2 : 1);
const COLS_KEY = "bz-results-cols";
// Top of the visible map below the filter bar (search-this-area pill and viewport box).
const BAR_BOTTOM = 70;

// Camera zoom when a property's panel opens or a parcel is selected (review feedback: parcel-level view).

export default function HomeWeb() {
  const router = useRouter();
  const { map, ready, setInset, setAreaRings, offline, setHeat } = useMapCtx();
  const { place, rings, listings, picks, user, choosePlace, chooseAreas, areas, onboarded, restartOnboarding } = useApp();
  // Logged in from the iPhone (app/login): the first web screen in context (lib/handoff/profile.ts).
  const hs = useHandoff();
  const [navX, setNavX] = useState(false);
  const [view, setView] = useState<"home" | "results">("home");
  // Dev menu preview of saved searches / properties returning nothing or failing (BREEZY-7759).
  const [savedPreview, setSavedPreview] = useState<"empty" | "error" | null>(null);
  // Multi-column results: the user's choice (persisted), capped by what the window fits.
  const [winW, setWinW] = useState(0);
  useEffect(() => { const f = () => setWinW(window.innerWidth); f(); window.addEventListener("resize", f); return () => window.removeEventListener("resize", f); }, []);
  const [colsPref, setColsPref] = useState(1);
  useEffect(() => { try { const v = Number(localStorage.getItem(COLS_KEY)); if (v === 2 || v === 3) setColsPref(v); } catch {} }, []);
  const pickCols = (n: number) => { setColsPref(n); try { localStorage.setItem(COLS_KEY, String(n)); } catch {} };
  const maxCols = colsFit(winW);
  // One 1 / 2 / 3 setting for Results and the For you feed (11 Nov review).
  const cols = Math.min(colsPref, maxCols);
  const COL = COL_W[cols];
  const [selId, setSelId] = useState<number | null>(null);
  const [parcel, setParcel] = useState<ParcelHit | null>(null);
  const [hoverId, setHoverId] = useState<number | null>(null);
  // The report sheet (Comps / Build guidelines / Upside analysis) for a property.
  const [flow, setFlow] = useState<{ l: Listing; kind: FlowKind } | null>(null);
  // Share (picked set, share modal) and saved Reports; see Share.tsx / Reports.tsx.
  const sh = useShare();
  const rp = useReports();
  const [shareL, setShareL] = useState<Listing | null>(null);
  const [compsCached, setCompsCached] = useState(false);
  const [seen, setSeen] = useState<Set<number>>(new Set());
  const keepT = useRef<any>(null);
  const { toast, show: showToast } = useToast();
  const navW = navX ? NAV_W.expanded : NAV_W.collapsed;
  // Filters: the bar, dropdowns and "All filters" panel filter what the pins and results show.
  const fs = useFilterState();
  const shown = useMemo(() => listings.filter(l => homeOk(l, fs.f)), [listings, fs.f]);
  const [sortBy, setSortBy] = useState<SortKey>("rel");
  const [sortOpen, setSortOpen] = useState(false);
  const results = useMemo(() => sortListings(shown, sortBy), [shown, sortBy]);
  // Saved searches / properties / alerts (components/SavedState.tsx + components/home/Saved.tsx).
  const sv = useSaved();
  const [soloL, setSoloL] = useState<Listing | null>(null); // a saved home from another area
  const ss = useSearchSheet({ F: fs.f, place, areas, results, toast: showToast });
  const alerts = useAlerts({ toast: showToast });
  const [savedOpen, setSavedOpen] = useState(false);
  const [savedOut, setSavedOut] = useState(false);
  const closeSaved = () => { if (savedOut) return; setSavedOut(true); setTimeout(() => { setSavedOut(false); setSavedOpen(false); }, 190); };
  const picked = sv.props.filter(p => !p.seed);
  const active = view === "results" ? sv.active : null;
  // Search step (canvas `step === "search"`): the field's suggestion panel replaces the left column.
  const [searching, setSearching] = useState(false);
  // "Unsupported area" (`_unsupQ`): the searched area is outside Breezy's coverage, or
  // couldn't be found at all (`placed` false: no outline, camera stays put).
  const [unsup, setUnsup] = useState<{ label: string; placed: boolean } | null>(null);
  const unsupOn = view === "results" && !!unsup && !sv.active;

  useEffect(() => { setInset({ left: navW, top: 0, radius: 36 }); }, [navW, setInset]);
  useEffect(() => { if (ready) setHeat("roi"); }, [ready]); // eslint-disable-line react-hooks/exhaustive-deps

  // Outline the searched area only in results; fit the camera to it.
  const fit = (left: number) => {
    if (!map) return;
    // Several areas: fit the union of their boxes (`place.bbox` of the combined place).
    const bb = areas.length > 1 ? place.bbox : rings && rings.length ? ringBBox(rings) : place.bbox;
    if (bb) map.fitBounds([[bb[0], bb[1]], [bb[2], bb[3]]], { padding: { left: left + 40, right: 120, top: 100, bottom: 40 }, duration: 900, maxZoom: 14.4 });
    else map.flyTo({ center: place.center, zoom: 13.4, duration: 900 });
  };
  useEffect(() => { setAreaRings(view === "results" && !(unsup && !unsup.placed) ? rings : null); }, [view, rings, ready, setAreaRings, unsup]);
  const firstFit = useRef(false);
  useEffect(() => {
    if (!map || !ready) return;
    if (!firstFit.current) { firstFit.current = true; if (onboarded) return; }
    // "Search this area" searched what's on screen: the camera stays where the user put it.
    if (place.kind === "area") return;
    fit(GAP + COL + GAP);
  }, [map, ready, place.id, rings]); // eslint-disable-line react-hooks/exhaustive-deps
  // Widening / narrowing the results column keeps the same spot in the middle of the
  // visible map (programmatic pan, so it never raises "Search this area").
  const prevCol = useRef(COL);
  useEffect(() => {
    const d = COL - prevCol.current; prevCol.current = COL;
    if (map && ready && d) map.panBy([-d / 2, 0], { duration: 450 });
  }, [COL]); // eslint-disable-line react-hooks/exhaustive-deps

  const sel = selId != null ? listings.find(l => l.id === selId) || null : parcel ? parcel.listing : soloL;
  const hover = hoverId != null ? listings.find(l => l.id === hoverId) || null : null;
  const forYou = useMemo(() => {
    const on = Object.entries(picks).filter(([, v]) => v).map(([k]) => k);
    if (on.length) return listings.filter(l => on.includes(l.opp));
    // No picks: a fixed ~30% of the homes, spread over the whole search (15 Nov: a US-wide
    // search shows special pins everywhere, not just the first ten, which sat in one city).
    const some = listings.filter(l => hashStr("fy:" + l.id) % 10 < 3);
    return some.length >= 10 ? some : listings.slice(0, 10);
  }, [listings, picks]);
  // Special pins (review feedback): only while Home's "For you" tab is showing. They
  // follow the feed's signal filter, and a pin reverts to a plain white pill once its
  // detail has been opened. Picked signals also limit which pins are on the map.
  const [homeTab, setHomeTab] = useState<string>("For you");
  const [fySignals, setFySignals] = useState<OppType[]>([]);
  const fyOn = view === "home" && homeTab === "For you";
  const sigFilter = fyOn && fySignals.length > 0;
  const signalIds = useMemo(() => fyOn ? new Set(forYou.filter(l => (!sigFilter || fySignals.includes(l.opp)) && !seen.has(l.id)).map(l => l.id)) : undefined, [fyOn, sigFilter, fySignals, forYou, seen]);
  // Handoff: the homes saved on the phone are pinned even when the area's listings don't include them.
  const hoPins = useMemo(() => hs.on ? profileSaved() : [], [hs.on]);
  const hoExtra = useMemo(() => hoPins.filter(l => !listings.some(x => x.id === l.id)), [hoPins, listings]);
  const pinListings = useMemo(() => unsupOn ? [] : sigFilter ? shown.filter(l => fySignals.includes(l.opp)) : hoExtra.length ? [...shown, ...hoExtra] : shown, [unsupOn, sigFilter, fySignals, shown, hoExtra]);

  // Handoff, trial dismissed (team, 23 Nov): the map, pins, heat and hover previews stay open;
  // pressing a result (card, pin, parcel, saved home) stops on the trial offer instead of the
  // property panel. Starting the trial opens the property they pressed. Dev menu → "lock the
  // actions": the panel opens and its paid actions lock instead (blurred estimate, offers).
  const gate = (open: () => void) => {
    if (!hs.on || ent.planOn || hs.gate === "actions") return open();
    setHoverId(null);
    paywall.open({ kind: "offer", feature: "comps", kicker: "Property details are part of Agents Pro", then: open });
  };
  const openListing = (id: number) => gate(() => openListingNow(id));
  const openListingNow = (id: number): void => {
    const l = listings.find(x => x.id === id);
    if (!l) { const x = hoExtra.find(h => h.id === id); if (x) return openSavedNow(x); }
    if (id !== selId) alerts.close();
    setParcel(null); setSoloL(null); setSelId(id); setHoverId(null); setSearching(false);
    setSeen(s => new Set(s).add(id)); armRun();
    if (l) frameSel(l);
  };
  // Frame the selection in the free map space right of the detail panel (lib/map/frame.ts).
  const frameSel = (l: Listing | null, ring?: number[][], at?: [number, number]) => {
    if (!map) return;
    frameLot(map, { ring, at: at || [l!.lng, l!.lat], lotAc: l?.lotAc, left: GAP + COL + GAP + 420, top: BAR_BOTTOM });
  };
  const closeDetail = () => { alerts.close(); setSelId(null); setParcel(null); setSoloL(null); setCompsOn(false); setCompsOut(false); setExportOn(false); };
  // Create intent, set by the side nav (New buyer search / the Create button): the search
  // step asks the matching question, and what's picked next finishes the job.
  // buyer: the next area search ends on the Save search sheet.
  // underbuilt: the next area search shows results with the Underbuilt heat and "Build potential 40%+".
  // comps: the next address opens that property straight into comps.
  type Intent = "buyer" | "underbuilt" | "comps" | null;
  const intentRef = useRef<Intent>(null);
  const [intent, setIntentS] = useState<Intent>(null);
  const setIntent = (i: Intent) => { intentRef.current = i; setIntentS(i); };
  const setBuyer = (on: boolean) => setIntent(on ? "buyer" : null);
  const INTENT_PROMPT: Record<string, string> = { buyer: "Where is your buyer looking?", underbuilt: "Which lot? An address, or an area to scan", comps: "Which property do you want comps for?" };
  // Buyer-first wizard (components/home/BuyerWizard.tsx). On save: the buyer joins the contacts,
  // the criteria become the filters, the areas are searched, then the search is saved for that
  // buyer once its results are in (effect below), and the results show.
  const [buyerWiz, setBuyerWiz] = useState(false);
  const [buyerSave, setBuyerSave] = useState<BuyerResult | null>(null);
  const finishBuyer = async (r: BuyerResult) => {
    setBuyerWiz(false);
    if (r.buyer.isNew) sv.addContact(r.buyer.name);
    fs.setF({ ...fDef(), ...r.f });
    await commitAreas(r.areas);
    setBuyerSave(r);
  };
  useEffect(() => {
    const r = buyerSave;
    if (!r) return;
    setBuyerSave(null);
    const crit = searchCriteria(fs.f, place.label.split(",")[0]);
    const id = "s" + Date.now(), firstSearch = !getStarted.get().done.includes("buyer");
    sv.addSearch({
      id, name: r.name, clients: [r.buyer.name], newN: 0, th: [0, 1, 2], photos: results.slice(0, 3).map(l => l.photos[0]),
      params: crit.params, chips: crit.chips, f: fs.f, place: { ...place, rings: undefined }, sq: place.label, when: "Today", notify: r.notify, freq: r.freq,
      areas: areas.length > 1 ? areas.map(a => ({ ...a, rings: undefined })) : undefined, alertTypes: r.alertTypes,
    });
    if (r.notify) askNotifyOnFirstAlert();
    sv.setActive(id); // the results now belong to the saved search (its header in the field, no Save search)
    const first = r.buyer.name.split(" ")[0];
    // The first one completes Make Breezy yours' buyer task, whose own toast says it.
    if (!firstSearch) showToast(`Search saved for ${first} · ${results.length ? `${results.length} match${results.length === 1 ? "" : "es"}` : "no matches right now, we’ll alert you"}${r.notify ? ` · ${r.freq.toLowerCase()} alerts` : ""}${r.shareWithBuyer ? `, sent to ${first} too` : ""}`, "positive");
  }, [buyerSave]); // eslint-disable-line react-hooks/exhaustive-deps
  const afterBuyerSearch = (was: Intent) => {
    if (was === "buyer" && getStarted.get().tour?.task !== "buyer") setTimeout(() => openSheet(), 450);
    if (was === "underbuilt") { setRun(null); setHeat("ub"); fs.setF({ ...fs.f, ub: Math.max(fs.f.ub || 0, 40) }); showToast("Showing lots with 40%+ build potential", "positive"); }
  };
  // Comps intent: once the picked property is open, go straight into comps.
  const compsNext = useRef(false);
  // Create flows on the map (agent feedback, 23 Nov): New comp and New underbuilt report keep a
  // step (components/home/TaskBar.tsx). Step 0 is "pick the property": an address from the search,
  // or a home / parcel clicked on the map, both lead on.
  const [run, setRunS] = useState<CreateRun | null>(null);
  const runRef = useRef<CreateRun | null>(null);
  const setRun = (r: CreateRun | null) => { runRef.current = r; setRunS(r); };
  const ubNext = useRef(false);
  const armRun = () => { const r = runRef.current; if (r?.step !== 0) return; if (r.kind === "comps") compsNext.current = true; else ubNext.current = true; };
  const goPlace = async (p: Place) => { setAreaPill(false); closeDetail(); setSearching(false); setUnsup(null); setView("results"); await choosePlace(p); };
  // `_commitAreas`: results for the field's area(s); leaves the active saved search.
  // Each chip resolves to a Place (live geocoding / gazetteer; "Current location" via
  // geolocation), then they go to `chooseAreas` together (outlines + listings for all).
  const commitAreas = async (list: Area[]) => {
    let wasBuyer = intentRef.current; setIntent(null);
    // Make Breezy yours: the guide moves on to the results' next step.
    getStarted.step("buyer", "filters", ["search", "create"]); getStarted.step("underbuilt", "pick", ["search", "create"]);
    sv.setActive(null); closeDetail(); setSearching(false); setView("results"); setUnsup(null); setAreaPill(false);
    const ps = await Promise.all(list.map(a => resolveArea(a, place.center)));
    const ok = ps.filter((p): p is Place => !!p);
    const missed = list.filter((_, k) => !ps[k]);
    if (!ok.length) { setUnsup({ label: list[list.length - 1].label, placed: false }); return; }
    if (missed.length) showToast("No results for " + missed.map(a => a.label.split(",")[0]).join(", "), "info");
    if (!ok.some(isCovered)) { wasBuyer = null; setUnsup({ label: ok[ok.length - 1].label, placed: true }); }
    await chooseAreas(ok);
    afterBuyerSearch(wasBuyer);
  };
  // An address suggestion opens that property on its own (`_openSolo`). Outside
  // coverage there's no property data: neutral "No property found" toast (sprint item).
  const pickAddress = async (p: Place) => {
    sv.setActive(null);
    // Guided comps (18 Nov review): the property opens on its own; the guide then points at Get comps.
    compsNext.current = intentRef.current === "comps" && getStarted.get().tour?.task !== "comps"; setIntent(null);
    armRun();
    getStarted.step("comps", "run", ["search", "create"]);
    const [lng, lat] = p.center;
    // The parcel matching the address (house number + street), not just the nearest lot.
    const l = isCovered(p) ? await listingForAddress("addr:" + p.id, p.name || p.label, p.center, p.label.split(", ").slice(1, 2).join("")) : null;
    if (!l) { compsNext.current = false; ubNext.current = false; return showToast("No property found", "info"); }
    // A real lot keeps its own spot and address; a generated home takes the searched ones.
    openSavedProp(l.apn ? l : { ...l, lng, lat, addr: p.name });
  };
  // `onClearSearch` from the search step: back to Home with no area query.
  const clearSearch = () => { setAreaPill(false); sv.setActive(null); closeDetail(); setUnsup(null); setView("home"); setSortOpen(false); setSavedOpen(false); };
  const fieldAreas: Area[] = view !== "results" ? [] : unsup && !unsup.placed ? [{ label: unsup.label }] : areas.map(p => ({ label: p.label, place: p }));
  const multi = areas.length > 1;
  const areaMeta = multi ? areas.map(a => a.label.split(",")[0]).slice(0, -1).join(", ") + " & " + areas[areas.length - 1].label.split(",")[0] : place.label;
  // Saved home: open it in place when it's in this area's listings, otherwise on its own.
  const openSavedProp = (l: Listing) => gate(() => openSavedNow(l));
  const openSavedNow = (l: Listing): void => {
    const hit = listings.find(x => propKey(x) === propKey(l));
    if (hit) return openListingNow(hit.id);
    alerts.close(); setParcel(null); setSelId(null); setHoverId(null); setSoloL(l);
    frameSel(l);
  };
  // `openSearch`: results for the search's area and filters, with it as the active search.
  const openSearch = async (x: SavedSearch) => {
    sv.setActive(x.id);
    fs.setF(x.f ? migrateF({ ...fDef(), ...x.f }) : seedFilters(x.params));
    // A search over several areas reopens on all of them (agent feedback: only the last one came back).
    if (x.areas && x.areas.length > 1) { setAreaPill(false); closeDetail(); setSearching(false); setUnsup(null); setView("results"); return chooseAreas(x.areas); }
    if (x.place) return goPlace(x.place);
    const r = await searchPlaces(x.sq);
    if (r[0]) goPlace(r[0]); else { setView("results"); showToast("No results for " + x.sq, "info"); }
  };
  // `onClearActive`
  const clearActive = () => { sv.setActive(null); ss.close(); closeDetail(); setView("home"); setSortOpen(false); setSavedOpen(false); };
  // `onSaveSearch` / `onFooterSearch` / `onManageSearch`: the sheet replaces any open dropdown, panel or sort menu.
  const openSheet = (s?: SavedSearch | null) => {
    fs.setDd(null); if (fs.fd) fs.closePanel(); setSortOpen(false); setSavedOpen(false);
    if (s) ss.openManage(s); else ss.openNew();
  };

  // Share (`onShareProp` / `onSharePicked`): one property, or the picked set from the saved store.
  const shareOne = (l: Listing) => { setShareL(l); sh.shareProp(l.id); };
  const shareItems = sh.only != null ? (shareL ? [shareL] : []) : picked.map(p => p.l);
  // A comps report that has already been run reopens on its result (sprint item).
  const openFlow = (l: Listing, kind: FlowKind) => { if (kind === "roi") handoffProfile.desk("roi", reportKey(l)); setCompsCached(rp.has(l)); setFlow({ l, kind }); if (kind === "ub") getStarted.complete("underbuilt"); };
  // Paywall, "Locked tile" lock style (Dev menu): a locked Max build / Profit potential tile
  // opens the upsell (or a credit confirmation) over the map instead of a veiled report.
  const ent = useEntitlements();
  const openReport = (l: Listing, kind: "ub" | "roi") => {
    const f = kind === "ub" ? "maxBuild" as const : "roi" as const, key = reportKey(l), a = accessNow(f, key);
    if (ent.s.lockStyle !== "tile" || (a !== "locked" && a !== "plan" && a !== "credit")) return openFlow(l, kind);
    if (a === "plan") return paywall.open({ kind: "offer", feature: f });
    paywall.open({ kind: "upsell", feature: f, then: () => { spend(f, key); openFlow(l, kind); } });
  };
  const openComps = (l: Listing) => openFlow(l, "comps");

  const detailOpen = !!sel;

  // ---- Comps interaction 2.0 (Get comps in the detail panel) ----
  // The detail panel slides left over the results column and gains the comps estimate
  // (Home / Lot price, Set your estimate); the comps list slides in from the right, in
  // two columns; the map stays open in between with a pin per comp. Other entry points
  // (report tabs, saved reports) still open the report sheet.
  const [compsOn, setCompsOn] = useState(false);
  const [compsOut, setCompsOut] = useState(false);
  const [compsReveal, setCompsReveal] = useState(true);
  // Comps follow the search's own filters (fs.f): the filter bar slides left with the
  // detail panel and stays above it, so editing a filter edits the comps too.
  const cm = useComps(compsOn && sel ? sel : null, compsReveal, fs.f);
  const compsShift = compsOn && !compsOut;
  // Manual comps, still setting up: the filters hang under the compact subject card, the
  // map shows the area (radius or a drawn shape) and there's no comps panel until
  // "Find n comps".
  const setup = compsShift && !!cm.key && cm.setup;
  const sideOn = compsShift && !setup;
  // The export sheet ("Set price estimate").
  const [exportOn, setExportOn] = useState(false);
  // The subject collapsed to a compact card (SubjectMini, exploration 17 Nov). Starts
  // collapsed on windows wider than 1440, where the list gets its third column.
  const [subjMin, setSubjMin] = useState(false);
  const subjMini = compsShift && (subjMin || setup);
  // Comps list columns: 3 on windows wider than 1440 (17 Nov) while the subject is the
  // compact card (or the window fits the full panel too), 2 from 1360, else 1.
  // The comps panel's width (17 Nov review: more room for the cards, and resizable). By
  // default about half the map area (~700 px at 1470, two wide columns); dragging its
  // left edge sets it (kept in localStorage `bz-comps-w`, double-click resets). It never
  // eats the subject or the map controls. Columns follow the width: 3 from 840 px, 2 from 540.
  const [sideUser, setSideUser] = useState<number | null>(null);
  useEffect(() => { try { const v = Number(localStorage.getItem("bz-comps-w")); if (v > 0) setSideUser(v); } catch {} }, []);
  const mapW = winW - navW;
  const sideMax = Math.max(360, mapW - (GAP + (subjMin ? MINI_W : 420) + GAP) - 120 - GAP);
  const SIDE_W = Math.round(Math.min(sideMax, Math.max(360, sideUser ?? mapW * 0.5)));
  const sideCols: 1 | 2 | 3 = SIDE_W >= 840 ? 3 : SIDE_W >= 540 ? 2 : 1;
  const saveSideW = (w: number | null) => { setSideUser(w); try { if (w == null) localStorage.removeItem("bz-comps-w"); else localStorage.setItem("bz-comps-w", String(Math.round(w))); } catch {} };
  // Comps mode: the map controls sit on the left, anchored to the subject card / panel.
  const SUBJ_RIGHT = GAP + (subjMini ? MINI_W : 420) + GAP;
  const DETAIL_X = compsShift ? GAP : GAP + COL + GAP;
  // Comps mode: the detail panel (now the subject) drops under the filter bar.
  const DETAIL_TOP = compsShift && !setup ? BAR_BOTTOM : GAP;
  const fCount = useMemo(() => { const d = fDims(fs.f); return (Object.keys(d) as (keyof typeof d)[]).filter(k => d[k].on && !(k === "price" && d.status.on)).length; }, [fs.f]);
  const compCount = (F: Filters) => { if (!sel) return 0; const x = compsFor(asReviewed(sel), cm.radius, F, cm.area); return x.sold.length + x.active.length; };
  const selKey = sel ? `${sel.id}|${sel.addr}` : "";
  // Another property (pin, parcel, saved home) leaves comps.
  useEffect(() => { setCompsOn(false); setCompsOut(false); setExportOn(false); setCompsAsk(null); setSubjMin(false); }, [selKey]);
  // A resized comps panel reframes the comps once the new width has rendered.
  const [reframe, setReframe] = useState(0);
  useEffect(() => { if (reframe && compsShift && sel && cm.key) frameComps(sel); }, [reframe]); // eslint-disable-line react-hooks/exhaustive-deps
  // Collapsing / expanding the subject reframes the comps in the map space it leaves.
  useEffect(() => { if (compsShift && sel && cm.key) frameComps(sel); }, [subjMin]); // eslint-disable-line react-hooks/exhaustive-deps
  // Frame the subject and every comp in the open map between the two panels.
  const frameComps = (l: Listing) => {
    if (!map) return;
    const pts = [[l.lng, l.lat], ...cm.all.map(compLngLat), ...(cm.area || [])];
    // No comp yet (or none match): frame the radius circle instead.
    if (!cm.all.length && !cm.area) {
      const dLat = cm.radius / 69.05, dLng = dLat / Math.cos(l.lat * Math.PI / 180);
      pts.push([l.lng - dLng, l.lat - dLat], [l.lng + dLng, l.lat + dLat]);
    }
    const xs = pts.map(p => p[0]), ys = pts.map(p => p[1]);
    map.fitBounds([[Math.min(...xs), Math.min(...ys)], [Math.max(...xs), Math.max(...ys)]], {
      padding: { left: GAP + (subjMini || setup ? MINI_W + GAP + 24 : 420 + GAP + 40), right: (setup ? 0 : SIDE_W + GAP) + GAP + 40, top: setup ? 48 : 84, bottom: 96 }, maxZoom: 16.5, duration: 1100, essential: true,
    });
  };
  // First Get comps on a property, as on mobile (17 Nov): review the subject's figures
  // (CompsReview), then choose (CompsChoice): the AI picks, or set the comps up by hand.
  const [compsAsk, setCompsAsk] = useState<null | "review" | "choice">(null);
  const openCompsMode = () => {
    if (!sel) return;
    // No trial / plan: Get comps stops at the press with the Agents Pro offer (review).
    if (!ent.planOn) { paywall.open({ kind: "offer", feature: "comps" }); return; }
    if (!rp.has(sel) && !compsOn) { setCompsAsk("review"); return; }
    startComps(isCompsManual(sel));
  };
  const startComps = (manual: boolean) => {
    if (!sel) return;
    setCompsAsk(null); setCompsManual(sel, manual); setSubjMin(manual || winW > 1440);
    // Manual: the filter panel opens under the subject card, on the search's filters.
    if (manual) fs.openPanel(); else if (fs.fd) fs.closePanel();
    alerts.close(); setHoverId(null); fs.setDd(null); setSortOpen(false); setAreaPill(false);
    setCompsReveal(!rp.has(sel) && !manual); setCompsOut(false); setCompsOn(true);
  };
  // Create → Run comps: the property just picked opens, then slides into comps.
  useEffect(() => {
    // Create → New underbuilt report: the picked lot opens, then its Max build report runs.
    if (ubNext.current && sel) {
      ubNext.current = false;
      if (runRef.current) setRun({ ...runRef.current, step: 1 });
      const l = sel, t = setTimeout(() => openReport(l, "ub"), 600);
      return () => clearTimeout(t);
    }
    // Leaving the property mid-flow goes back to picking one.
    if (!sel && runRef.current && runRef.current.step > 0 && !flow) setRun({ ...runRef.current, step: 0 });
    if (!compsNext.current || !sel) return;
    compsNext.current = false;
    if (runRef.current?.kind === "comps") setRun({ kind: "comps", step: 1 });
    const t = setTimeout(openCompsMode, 600);
    return () => clearTimeout(t);
  }, [selKey]); // eslint-disable-line react-hooks/exhaustive-deps
  // New comp: settings (review / choice) → run (the comps loading) → done once they're in.
  useEffect(() => {
    const r = runRef.current;
    if (r?.kind !== "comps" || r.step === 0) return;
    if (r.step === 1 && compsOn && !compsAsk && (cm.loading || cm.setup || cm.key)) setRun({ ...r, step: 2 });
    if (r.step === 2 && compsOn && !cm.loading && !cm.setup && cm.key) { tipDone("comps"); setRun(null); }
  }, [compsOn, compsAsk, cm.loading, cm.setup, cm.key]); // eslint-disable-line react-hooks/exhaustive-deps
  // New underbuilt report: done once the report has opened and closed.
  const ubFlowWas = useRef(false);
  useEffect(() => {
    const r = runRef.current;
    if (flow?.kind === "ub") { ubFlowWas.current = true; return; }
    if (ubFlowWas.current && r?.kind === "underbuilt") { ubFlowWas.current = false; tipDone("underbuilt"); setRun(null); }
  }, [flow]); // eslint-disable-line react-hooks/exhaustive-deps
  const runBack = () => {
    const r = runRef.current; if (!r) return;
    setCompsAsk(null); setFlow(null); closeDetail(); compsNext.current = false; ubNext.current = false;
    setRun({ ...r, step: 0 }); setIntent(r.kind); setSearching(true);
  };
  const runCancel = () => { setRun(null); compsNext.current = false; ubNext.current = false; setCompsAsk(null); setIntent(null); setSearching(false); };
  // Frame once the session (and so its comps) exists.
  useEffect(() => { if (compsOn && !compsOut && sel && cm.key) frameComps(sel); }, [compsOn, cm.key]); // eslint-disable-line react-hooks/exhaustive-deps
  // New filters or radius: reframe once the new comps are known.
  const pkey = cm.radius + JSON.stringify(fs.f) + JSON.stringify(cm.area) + cm.setup;
  const firstP = useRef(pkey);
  useEffect(() => { if (firstP.current === pkey) return; firstP.current = pkey; if (compsOn && !compsOut && sel && cm.key) frameComps(sel); }, [pkey]); // eslint-disable-line react-hooks/exhaustive-deps
  const closeComps = () => {
    if (!compsOn || compsOut) return;
    setCompsOut(true); cm.setHoverC(null); if (fs.fd) fs.closePanel();
    if (sel) frameSel(sel);
    setTimeout(() => { setCompsOn(false); setCompsOut(false); }, 380);
  };
  // Escape leaves comps (a dialog inside claims Escape first, in the capture phase).
  useEffect(() => {
    if (!compsOn) return;
    const k = (e: KeyboardEvent) => { if (e.key === "Escape" && !e.defaultPrevented && !exportOn) closeComps(); };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }); // eslint-disable-line react-hooks/exhaustive-deps
  // The first run saves the comps report, like the report sheet did.
  const wasLoading = useRef(false);
  useEffect(() => {
    if (cm.loading) { wasLoading.current = true; return; }
    if (!wasLoading.current || !sel || !compsOn) return;
    wasLoading.current = false;
    if (!rp.has(sel)) { rp.save(sel); showToast("Report saved to Reports"); }
    getStarted.complete("comps");
    if (sv.isSaved(sel)) handoffProfile.desk("comps");
  }, [cm.loading]); // eslint-disable-line react-hooks/exhaustive-deps

  // ---- "Search this area" (Expedia-style pill, top centre of the map under the filter bar) ----
  // After a user pan / zoom (drag, scroll, pinch, keyboard or the zoom buttons; never the
  // app's own fitBounds / easeTo), the pill shows when the middle of the visible map has
  // left the searched area, or when more than half of the visible map has no pins
  // (CLAUDE.md open item). Clicking it searches the visible viewport: listings regenerate
  // for that box (deterministic per box), the field reads "Map area", and the outline is
  // cleared (the inner-glow edge is kept for real boundaries; a box around the whole
  // screen would just read as a vignette).
  const [areaPill, setAreaPill] = useState(false);
  const visRect = () => {
    const c = map!.getContainer();
    return { x0: GAP + COL + GAP + (detailOpen ? 420 + GAP : 0), y0: BAR_BOTTOM, x1: c.clientWidth, y1: c.clientHeight };
  };
  const needsArea = () => {
    if (!map || searching || unsupOn && !unsup?.placed) return false;
    const r = visRect();
    if (r.x1 - r.x0 < 200 || r.y1 - r.y0 < 200) return false;
    const mid = map.unproject([(r.x0 + r.x1) / 2, (r.y0 + r.y1) / 2]);
    const pt: LngLat = [mid.lng, mid.lat];
    const bb = place.bbox;
    const inArea = rings && rings.length && areas.length === 1 ? pointInRings(pt, rings)
      : bb ? pt[0] >= bb[0] && pt[0] <= bb[2] && pt[1] >= bb[1] && pt[1] <= bb[3] : true;
    if (!inArea) return true;
    // Emptiness: split the visible map into a 4 × 3 grid and count cells with no pin.
    const NX = 4, NY = 3, hit = new Set<number>();
    pinListings.forEach(l => {
      const p = map.project([l.lng, l.lat]);
      if (p.x < r.x0 || p.x >= r.x1 || p.y < r.y0 || p.y >= r.y1) return;
      hit.add(Math.floor((p.x - r.x0) / ((r.x1 - r.x0) / NX)) + NX * Math.floor((p.y - r.y0) / ((r.y1 - r.y0) / NY)));
    });
    return hit.size < (NX * NY) / 2;
  };
  const needsRef = useRef(needsArea);
  needsRef.current = needsArea;
  useEffect(() => {
    if (!map) return;
    // Drags carry `originalEvent`; scroll / pinch / keyboard zoom are eased and don't, so a
    // wheel, touch or key on the map marks the next ~600 ms of camera moves as the user's.
    let user = false, intent = 0;
    const mark = () => { intent = Date.now() + 600; };
    const el = map.getCanvasContainer();
    const start = (e: any) => { user = !!(e.originalEvent || e.bzUser) || Date.now() < intent; };
    const end = (e: any) => { if (user || e.originalEvent || e.bzUser) setAreaPill(needsRef.current()); user = false; };
    map.on("movestart", start); map.on("moveend", end);
    el.addEventListener("wheel", mark, { passive: true }); el.addEventListener("touchstart", mark, { passive: true }); el.addEventListener("keydown", mark);
    return () => {
      map.off("movestart", start); map.off("moveend", end);
      el.removeEventListener("wheel", mark); el.removeEventListener("touchstart", mark); el.removeEventListener("keydown", mark);
    };
  }, [map]);
  const searchThisArea = () => {
    if (!map) return;
    const r = visRect();
    const a = map.unproject([r.x0, r.y0]), b = map.unproject([r.x1, r.y1]);
    const bb: BBox = [Math.min(a.lng, b.lng), Math.min(a.lat, b.lat), Math.max(a.lng, b.lng), Math.max(a.lat, b.lat)];
    const p = viewportPlace(bb);
    setAreaPill(false); sv.setActive(null); closeDetail(); setSearching(false); setSortOpen(false);
    // On Home's For you tab the search stays there (review comment): the feed and its
    // special pins refresh for the newly searched area. Elsewhere it opens Results.
    if (!fyOn) setView("results");
    // A map area is searched wherever it is: the demo listings and heat cover the whole US
    // (15 Nov). Named places keep the coverage check.
    setUnsup(null);
    chooseAreas([p]);
  };

  // ---- "Create comps" (Results footer, Sold filter on): a comps report from the sold results ----
  const soldOn = !!fs.f.st["Recently sold"];
  const soldResults = useMemo(() => results.filter(l => l.status === "Sold"), [results]);
  const [areaComps, setAreaComps] = useState<AreaReport | null>(null);
  const createComps = () => {
    if (!soldResults.length) return;
    setAreaComps({ title: active ? active.name : multi ? areaMeta : place.label.split(",")[0], comps: soldResults, center: place.center });
  };
  // Sheets stacked over the results column (`depth`): the save-search sheet or "All
  // filters" on top, the saved-properties sheet under it. Each one steps the column back.
  const svOn = savedOpen && picked.length > 0 && !savedOut;
  const topOn = (view === "results" && ((!!fs.fd && !fs.panelOut) || ss.on)) || (rp.open && !rp.out);
  const depth = (svOn ? 1 : 0) + (topOn ? 1 : 0);
  const layerOn = depth > 0;
  const pillOn = areaPill && !compsOn && !detailOpen && !searching && !flow && !areaComps && !layerOn && !savedOpen;
  const layerBack = () => { if (fs.fd) fs.closePanel(); if (ss.open) ss.requestClose(); if (savedOpen) closeSaved(); if (rp.open) rp.close(); };
  // ---- Make Breezy yours (18 Nov): the mobile activation wizard, on web ----
  // Four tasks worth 10 contact credits each (lib/getStarted.ts). Each is earned whenever
  // it's done; the guided version dims the screen round the next thing to press (Coach).
  const gs = useGetStarted();
  const tour = gs.tour;
  // Earned: a new saved search, an owner contacted (comps and Max build: see openFlow / the comps save).
  const nSearches = sv.searches.length, prevSearches = useRef(nSearches);
  useEffect(() => { if (nSearches > prevSearches.current) getStarted.complete("buyer"); prevSearches.current = nSearches; }, [nSearches]);
  const nContacts = (ent.s.log || []).filter(u => u.f === "contacts").length, prevContacts = useRef(nContacts);
  useEffect(() => { if (nContacts > prevContacts.current) getStarted.complete("contact"); prevContacts.current = nContacts; }, [nContacts]);
  // The stage follows the app: a search closed without a pick goes back to Create; opening /
  // closing a property moves the underbuilt and contact guides on / back.
  useEffect(() => {
    if (searching || tour?.stage !== "search") return;
    const t = setTimeout(() => { const g = getStarted.get().tour; if (g?.stage === "search") getStarted.step(g.task, "create"); }, 120);
    return () => clearTimeout(t);
  }, [searching, tour?.stage]);
  useEffect(() => {
    if (sel) { getStarted.step("underbuilt", "maxbuild", ["pick"]); getStarted.step("contact", "contact", ["pick"]); }
    else { getStarted.step("underbuilt", "pick", ["maxbuild"]); getStarted.step("contact", "pick", ["contact"]); }
  }, [selKey]); // eslint-disable-line react-hooks/exhaustive-deps
  // Buyer criteria: once the All filters panel has been opened and closed, on to Save search.
  const fdWas = useRef(false);
  useEffect(() => {
    if (fs.fd) { fdWas.current = true; return; }
    if (fdWas.current) { fdWas.current = false; getStarted.step("buyer", "save", ["filters"]); }
  }, [fs.fd]);
  // Start a task from the wizard or the "Next step" toast.
  const startTask = (t: Task) => {
    getStarted.show(false); setSearching(false); setIntent(null); if (rp.open) rp.close();
    if (t === "contact") { if (compsOn) closeDetail(); getStarted.go("contact", sel && !compsOn ? "contact" : "pick"); return; }
    if (t === "comps" && sel && !compsOn) { getStarted.go("comps", "run"); return; }
    if (t !== "comps") closeDetail();
    getStarted.go(t, "create");
  };
  const TITLE: Record<Task, string> = { buyer: "Set up a buyer search", contact: "Contact an owner", comps: "Run your first comp", underbuilt: "Find underbuilt lots" };
  const ITEM: Partial<Record<Task, [string, string]>> = { buyer: ["Buyer search", "New buyer search"], comps: ["Comps", "New comp"], underbuilt: ["Underbuilt", "New underbuilt report"] };
  const coachSteps: CoachStep[] | null = (() => {
    if (!tour) return null;
    const T = TITLE[tour.task];
    switch (tour.stage) {
      case "create": {
        const [k, label] = ITEM[tour.task]!;
        return [
          { sel: `[data-tour="create-${k}"]`, title: `Pick ${label}`, sub: ({ buyer: "A short wizard: your buyer first, then where and what they're looking for.", comps: "You'll pick the property next, then Breezy finds its comps.", underbuilt: "You'll pick an area next, and see its lots with room to build." } as Record<string, string>)[tour.task] },
          { sel: `[data-tour="create"]`, title: "Start from Create", sub: "Every search and report you make in Breezy starts here." },
        ];
      }
      case "search": {
        // The search step (18 Nov review): the field first, then the suggestions once typed.
        const q = { buyer: ["Where is your buyer looking?", "Search the neighbourhood, city or ZIP your client wants.", "Pick the area", "Choose one; you can add more areas after."],
          underbuilt: ["Where should we look?", "Search a neighbourhood, city or ZIP.", "Pick the area", "We'll show its lots with room to build."],
          comps: ["Enter the address", "Type the address of the home you want to price.", "Select the property", "Pick its address to open the property."] } as Record<string, string[]>;
        const [t1, s1, t2, s2] = q[tour.task] || q.buyer;
        return [{ sel: `[data-tour="search-results"]`, title: t2, sub: s2 }, { sel: `[data-tour="search-field"]`, title: t1, sub: s1 }];
      }
      case "filters": return [{ sel: `[data-tour="all-filters"]`, title: "Add your client's criteria", sub: "Set their budget, beds and must-haves.", next: "Next", onNext: () => getStarted.step("buyer", "save") }];
      case "save": return [{ sel: `[data-tour="save-search"]`, title: "Save this search", sub: "Get alerted the moment new matches come up." }];
      case "pick":
        if (tour.task === "underbuilt") return [{ sel: `[data-tour-card]`, title: "Pick a lot with room to build", sub: "The Underbuilt heat is on, and only lots with 40%+ build potential show. Open one." }];
        return [
          { sel: `[data-tour-card="exp"]`, title: T, sub: "Open this expired listing to see who owns it." },
          { sel: `[data-tour-card]`, title: T, sub: "Open this listing to see who owns it." },
        ];
      case "maxbuild": return [{ sel: `[data-tour="max-build"]`, title: "See its Max build", sub: "How much more the zoning lets you build on this lot.", next: "Done", onNext: () => getStarted.complete("underbuilt") }];
      case "run": return [
        { sel: `[data-tour="comps-go"]`, title: "Let AI pick the comps", sub: "Breezy finds and scores the closest matches. The guide ends once your comps are in." },
        { sel: `[data-tour="get-comps"]`, title: "Get comps", sub: "Price this home against recent sales nearby. Breezy checks its details with you, then finds the comps." },
      ];
      case "contact": return [{ sel: `[data-tour="contact-owner"]`, title: "Contact the owner", sub: "Reveal their phone, email and mailing address, before other agents call. Uses 1 contact." }];
      default: return null;
    }
  })();
  const coachPaused = buyerWiz || (searching && tour?.stage !== "search") || !!fs.fd || !!fs.dd || !!ss.open || !!flow || savedOpen || rp.open || !!sh.open || exportOn || gs.open || !!areaComps;

  // ---- Handoff: the first web screen (lib/handoff/profile.ts, components/home/Handoff.tsx) ----
  // Land in context: the phone's last area, its saved homes pinned and saved. Trial dismissed:
  // the walkthrough. Trial users (research, 23 Nov: no tour): the last property viewed on the
  // phone opens with tooltips for a first comp; days 11–13, the "Keep your reports" paywall first.
  const [tourI, setTourI] = useState<number | null>(null);
  useEffect(() => {
    if (!hs.on || !hs.landing || !map || !ready) return;
    handoffProfile.landed();
    closeDetail(); setSearching(false); setView("home"); sv.setActive(null); setHomeTab("For you");
    const p = profilePlace();
    choosePlace(p).then(() => {
      const bb = p.rings && p.rings.length ? ringBBox(p.rings) : p.bbox;
      if (bb) map.fitBounds([[bb[0], bb[1]], [bb[2], bb[3]]], { padding: { left: GAP + COL + GAP + 40, right: 120, top: 100, bottom: 60 }, duration: 900, maxZoom: 14.6 });
    });
    profileSaved().forEach(l => { if (!sv.isSaved(l)) sv.toggleProp(l); });
    if (hs.trial === "dismissed") { if (!hs.tourDone) setTimeout(() => setTourI(0), 1200); return; }
    handoffProfile.endTour();
    const l = profileLastViewed(); if (l) setTimeout(() => openSavedNow(l), 1300);
    const b = billing.get();
    if (hs.trial === "active" && b.status === "trial" && b.trialDay >= 11 && b.trialDay < trialLength(b) && !hs.keepShown) setTimeout(() => {
      handoffProfile.keepSeen();
      paywall.open({ kind: "keep", built: [["Saved homes", PROFILE.saved.length], ["Saved searches", sv.searches.length], ["Reports", rp.list.length + PROFILE.reportsOnPhone]] });
    }, 2400);
  }, [hs.on, hs.landing, map, ready]); // eslint-disable-line react-hooks/exhaustive-deps
  const tourAll = hs.on && tourI != null ? tourSteps(hs.trial, PROFILE.saved.length) : null;
  const endTour = () => {
    setTourI(null); handoffProfile.endTour();
  };
  const nextTour = () => { if (tourI == null || !tourAll) return; if (tourI + 1 >= tourAll.length) endTour(); else setTourI(tourI + 1); };
  const tourPaused = searching || !!fs.fd || !!fs.dd || !!ss.open || !!flow || savedOpen || rp.open || !!sh.open || buyerWiz || detailOpen;
  const tourCoach = tourAll && tourI != null && tourI < tourAll.length
    ? [{ ...tourAll[tourI], count: `${tourI + 1} of ${tourAll.length}`, next: tourAll[tourI].next ?? "Next", onNext: nextTour, exit: "Skip tour" }] : null;
  // A step whose target isn't on screen (no signal pin in view, say) is skipped.
  useEffect(() => {
    if (!tourAll || tourI == null || tourPaused) return;
    const sel = tourAll[tourI].sel;
    const t = setTimeout(() => {
      const seen = Array.from(document.querySelectorAll(sel)).some(el => { const r = el.getBoundingClientRect(); return r.width > 4 && r.top >= 0 && r.top < innerHeight - 40 && r.left < innerWidth; });
      if (!seen) nextTour();
    }, 2000);
    return () => clearTimeout(t);
  }, [tourI, tourPaused]); // eslint-disable-line react-hooks/exhaustive-deps
  // Trial users: tooltips on the first property panel guide a first comp (Get comps → check the details → Let AI pick).
  const tipOn = hs.on && hs.trial !== "dismissed" && !hs.tipDone && detailOpen && !compsOn && tourI == null;
  useEffect(() => { if (compsOn && hs.on && !hs.tipDone) endTip(); }, [compsOn]); // eslint-disable-line react-hooks/exhaustive-deps
  const hoGreeting = !hs.on ? undefined : hs.trial === "active" && ent.s.status === "trial" ? `Welcome back · day ${ent.s.trialDay} of ${ent.trialLength}` : `Welcome back, ${user.name.split(" ")[0]}`;

  // Developer menu: preview each UX state on demand (snackbars, search errors / empty, no estimate).
  const devActions: DevAction[] = [
    { group: "Onboarding & activation", label: "Make Breezy yours: reset", icon: "ph-sparkle", run: () => { getStarted.reset(); getStarted.show(); } },
    { group: "Onboarding & activation", label: "Restart onboarding", icon: "ph-arrow-counter-clockwise", run: () => { restartOnboarding(); router.push("/onboarding"); } },
    { group: "Onboarding & activation", label: "Reset help tips + Create label", icon: "ph-lightbulb", run: () => { resetCreateIntro(); resetTips(); } },
    // Scan-to-link handoff (app/login, app/link): the login screen and the first web screen per trial state.
    { group: "Handoff (iPhone → web)", label: "Start: the phone and its nudge", icon: "ph-device-mobile-camera", run: () => router.push("/start") },
    { group: "Handoff (iPhone → web)", label: "Log in screen (QR)", icon: "ph-qr-code", run: () => router.push("/login") },
    { group: "Handoff (iPhone → web)", label: "Replay first web screen", icon: "ph-arrow-counter-clockwise", run: () => handoffProfile.replay() },
    ...TRIAL_STATES.map(t => ({ group: "Handoff (iPhone → web)", label: `${hs.on && hs.trial === t.id && (!t.day || hs.day === t.day) ? "● " : ""}${t.label}`, icon: "ph-device-mobile", run: () => { closeDetail(); handoffProfile.setTrial(t.id, t.day); handoffProfile.replay(); } })),
    { group: "Handoff (iPhone → web)", label: `Trial dismissed: ${hs.gate === "panel" ? "● gate the whole panel" : "gate the whole panel"}`, icon: "ph-lock", run: () => handoffProfile.setGate("panel") },
    { group: "Handoff (iPhone → web)", label: `Trial dismissed: ${hs.gate === "actions" ? "● open the panel, lock the actions" : "open the panel, lock the actions"}`, icon: "ph-lock-open", run: () => handoffProfile.setGate("actions") },
    { group: "Handoff (iPhone → web)", label: `Holiday 50% offer: ${ent.s.holiday ? "on → turn off" : "off → turn on"}`, icon: "ph-gift", run: () => billing.set({ holiday: !billing.get().holiday }) },
    { group: "Handoff (iPhone → web)", label: "Leave handoff mode", icon: "ph-sign-out", run: () => { handoffProfile.leave(); billing.preset("trial"); } },
    { group: "Snackbars", label: "Snackbar: neutral", icon: "ph-info", run: () => showToast("No property found", "neutral") },
    { group: "Snackbars", label: "Snackbar: positive", icon: "ph-check-circle", run: () => showToast("Search saved", "positive") },
    { group: "Snackbars", label: "Snackbar: negative", icon: "ph-warning-circle", run: () => showToast("Couldn't save search. Try again.", "negative") },
    { group: "Search states", label: "Search: failed to load", icon: "ph-plugs", run: () => { closeDetail(); previewSearchState("failed"); } },
    { group: "Search states", label: "Search: timed out", icon: "ph-timer", run: () => { closeDetail(); previewSearchState("timeout"); } },
    { group: "Search states", label: "Clear recent searches", icon: "ph-clock-counter-clockwise", run: () => { closeDetail(); previewSearchState("empty"); } },
    { group: "Saved data", label: "Saved: nothing saved", icon: "ph-tray", run: () => { closeDetail(); setSearching(false); setView("home"); setSavedPreview("empty"); } },
    { group: "Saved data", label: "Saved: failed to load", icon: "ph-cloud-x", run: () => { closeDetail(); setSearching(false); setView("home"); setSavedPreview("error"); } },
    { group: "Saved data", label: "Saved: back to normal", icon: "ph-arrow-counter-clockwise", run: () => setSavedPreview(null) },
    { group: "Saved data", label: "Save search: Sold within 3 months", icon: "ph-info", run: () => { closeDetail(); fs.setF({ ...fs.f, st: { "Recently sold": true }, tg: { "Recently sold": "3 months" } }); setView("results"); ss.openNew(); } },
    { group: "Property", label: "Property with no estimate", icon: "ph-lightning-slash", run: () => {
      setSearching(false);
      const l = listings.find(x => x.noQe);
      if (l) return openListing(l.id);
      // None in this area: open the first listing on its own, flagged as having no estimate.
      if (listings[0]) { alerts.close(); setParcel(null); setSelId(null); setSoloL({ ...listings[0], noQe: true }); }
    } },
  ];
  return (
    <>
      <SideNav expanded={navX} onToggle={() => setNavX(v => !v)} userName={user.name.split(" ")[0]}
        dev={devActions}
        onPick={k => {
        // Make Breezy yours: a Create item not yet earned runs its guided version.
        const gt = taskOf(k);
        if (gt) { if (!gs.isDone(gt) && !(gt === "comps" && !ent.planOn)) getStarted.go(gt, gt === "buyer" ? "wizard" : "search"); else getStarted.end(); }
        if (k === "Map") { closeDetail(); setView("home"); setSearching(false); if (rp.open) rp.close(); }
        // New buyer search (19 Nov, Jimsy): the buyer-first wizard, buyer → area → criteria → alerts.
        if (k === "Buyer search") { if (rp.open) rp.close(); sv.setActive(null); closeDetail(); setSearching(false); setBuyerWiz(true); }
        // Reports (side-nav footer) opens the saved reports sheet over the left column.
        if (k === "Reports") { if (rp.open) rp.close(); else { fs.closePanel(); rp.show(); } }
        // Nimbus: Settings opens Plan & usage; Inman News is included with the plan; the AI
        // places and Run comps need an active trial / plan.
        if (k === "Settings") paywall.open({ kind: "plan" });
        if (k === "Inman News") paywall.open({ kind: "news" });
        if (k === "AI Notes" || k === "Assistant") {
          if (!ent.planOn) paywall.open({ kind: "offer", feature: "assistant" });
          else showToast(`${k} isn't in the prototype yet`, "neutral");
        }
        // Run comps: pick a property, then comps open on it. Find underbuilt: pick an area,
        // then results with the Underbuilt heat. Both start in the search step, like buyer search.
        if (k === "Comps") {
          if (!ent.planOn) paywall.open({ kind: "offer", feature: "comps" });
          else { if (rp.open) rp.close(); sv.setActive(null); closeDetail(); setIntent("comps"); setSearching(true); setRun({ kind: "comps", step: 0 }); }
        }
        if (k === "Underbuilt") { if (rp.open) rp.close(); sv.setActive(null); closeDetail(); setIntent("underbuilt"); setSearching(true); setRun({ kind: "underbuilt", step: 0 }); }
        if (k === "Buyer search") setRun(null);
      }} />
      <BillingHost onToast={showToast} />
      {run && !buyerWiz && <TaskBar run={run} left={navW} onBack={run.step > 0 && !(run.kind === "comps" && run.step === 2) ? runBack : undefined} onCancel={runCancel} />}
      {buyerWiz && <BuyerWizard onClose={() => { setBuyerWiz(false); if (getStarted.get().tour?.task === "buyer") getStarted.step("buyer", "create", ["wizard"]); }} onDone={finishBuyer} />}
      <div data-maparea="" style={{ position: "fixed", top: 0, right: 0, bottom: 0, left: navW, pointerEvents: "none", zIndex: 30, transition: "left .45s cubic-bezier(.2,.8,.2,1),transform .7s cubic-bezier(.2,.8,.2,1)" }}>
        <div style={{ position: "absolute", left: GAP, top: GAP, bottom: GAP, width: COL, display: "flex", flexDirection: "column", gap: GAP, pointerEvents: "none", transformOrigin: "0 50%",
          transition: "opacity .45s ease,transform .55s cubic-bezier(.2,.8,.2,1),visibility 0s linear " + (compsShift ? ".55s" : "0s"),
          ...(compsShift ? { opacity: 0, transform: "translateX(-28px) scale(.97)", visibility: "hidden" as const } : {}) }}>
          <div style={{ pointerEvents: "auto" }}>
            {/* Entering the search step (`onSearchFocus`) closes dropdowns and the detail panel, as the canvas step change does. */}
            <SearchBar value={sel ? `${sel.addr}${sel.city ? ", " + sel.city : ""}` : areaSq(fieldAreas.map(a => a.label))} near={place.center}
              areas={fieldAreas} searching={searching} prompt={intent ? INTENT_PROMPT[intent] : undefined}
              onSearching={on => { setSearching(on); if (!on) setTimeout(() => setIntent(null), 0); if (on) { fs.setDd(null); setSortOpen(false); closeDetail(); } }}
              onCommit={commitAreas} onPickAddress={pickAddress} onClearAll={clearSearch}
              onClear={() => { if (detailOpen) closeDetail(); else { setView("home"); setUnsup(null); } }}
              active={detailOpen ? null : active} onManage={() => openSheet(active)} onClearActive={clearActive} />
          </div>
          {searching ? null : view === "home"
            ? <HomeCard name={user.name} area={place.label} greeting={hoGreeting} banner={hs.on && hs.trial === "active" ? <DeskChecklist hs={hs} /> : undefined} forYou={forYou} seen={seen} onOpen={openListing} onHover={setHoverId} toast={showToast}
                onOpenSearch={openSearch} onOpenProp={openSavedProp} onStart={() => (document.querySelector("input") as HTMLInputElement | null)?.focus()}
                picked={picked} onSharePicked={() => sh.sharePicked()} onTab={setHomeTab} onSignals={setFySignals} cols={cols} maxCols={maxCols} onCols={pickCols}
                onOpenSaved={() => { setSavedOut(false); setSavedOpen(true); }}
                savedState={savedPreview} onSavedRetry={() => setTimeout(() => setSavedPreview(null), 900)} />
            : (
              // The results column steps back (scale + dim) while a sheet sits on top of it.
              <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", transformOrigin: "50% 0", transition: "transform .42s cubic-bezier(.2,.8,.2,1),filter .42s ease", transform: depth > 1 ? "scale(.88)" : depth ? "scale(.94)" : "none", filter: depth > 1 ? "brightness(.93)" : depth ? "brightness(.955)" : "none" }}>
                {/* `resultsTitle` / `resultsMeta` for an active saved search */}
                <ResultsPanel title={active ? active.name : "Results"}
                  meta={active && active.newN ? `${eventSummary(searchEvents(active.id, active.newN, active.alertTypes))} since your last visit` : unsupOn ? "" : `${shown.length} ${shown.length === 1 ? "home" : "homes"} · ${active ? active.params[3] || place.label : areaMeta}`}
                  listings={unsupOn ? [] : results} seen={seen} onOpen={openListing} onHover={setHoverId}
                  unsupported={unsupOn ? unsup!.label.split(",")[0] : null} onTryArea={() => setSearching(true)}
                  sortOpen={sortOpen} onSortToggle={() => { setSortOpen(o => !o); fs.setDd(null); }}
                  onShowNearest={() => { fs.reset(); showToast("Showing nearest properties"); }} onResetFilters={fs.reset}
                  active={!!active} onManage={() => openSheet(active)} onFooterSearch={() => openSheet(active)}
                  picked={picked} onOpenSaved={() => { setSortOpen(false); setSavedOut(false); setSavedOpen(true); }} onSharePicked={() => sh.sharePicked()}
                  cols={cols} maxCols={maxCols} onCols={pickCols}
                  onCreateComps={soldOn && soldResults.length > 0 && !unsupOn ? createComps : undefined} />
              </div>
            )}
          {/* Saved properties sheet: from Results, and from Home's "+" footer (review feedback). */}
          {savedOpen && picked.length > 0 && (
            <SavedSheet picked={picked} out={savedOut} onBack={closeSaved} onOpen={p => openSavedProp(p.l)}
              onRemove={p => sv.toggleProp(p.l)} onClear={() => { sv.clearPicked(); setSavedOpen(false); }} onShare={() => sh.sharePicked()} />
          )}
          {view === "results" && ss.layers}
          <ReportsSheet rp={rp} onOpen={r => { rp.close(); if (r.kind === "area" && r.comps) setAreaComps({ title: r.title || "", comps: r.comps, center: r.center || [r.l.lng, r.l.lat] }); else openComps(r.l); }} />
          {layerOn && <div onClick={layerBack} title="Back to results" style={{ position: "absolute", left: 0, right: 0, top: 64, bottom: 0, zIndex: 3, pointerEvents: "auto", cursor: "pointer" }} />}
        </div>
        {detailOpen && (
          // The detail column steps back while the Alerts sheet sits on top of it (`dtT` / `dtF`).
          <div style={{ position: "absolute", left: DETAIL_X, top: DETAIL_TOP, bottom: GAP, zIndex: 4, transformOrigin: "50% 0", transition: "left .6s cubic-bezier(.2,.8,.2,1),top .6s cubic-bezier(.2,.8,.2,1),transform .42s cubic-bezier(.2,.8,.2,1),filter .42s ease", transform: alerts.on ? "scale(.94)" : "none", filter: alerts.on ? "brightness(.955)" : "none" }}>
            {setup ? (
              <div style={{ height: "100%", width: MINI_W, display: "flex", flexDirection: "column", gap: GAP }}>
                <SubjectMini l={sel!} cs={cm} setup onClose={closeDetail} />
                <AllFiltersPanel fs={fs} embedded title="Comps filters" listings={listings} count={compCount} cta={n => n === 0 ? "No comps match" : `Find ${n} comp${n === 1 ? "" : "s"}`}
                  onApply={() => cm.find()} />
              </div>
            ) : subjMini ? <SubjectMini l={sel!} cs={cm} onExpand={() => setSubjMin(false)} onClose={closeDetail} /> :
            <DetailPanel key={sel!.id + (parcel ? parcel.key : "")} l={sel!} onClose={closeDetail} onGetComps={openCompsMode} comps={compsOn && cm.key ? cm : null} onFlow={k => openReport(sel!, k)} onCollapse={compsShift ? () => setSubjMin(true) : undefined}
              alertN={alerts.count(sel)} onBell={() => ent.planOn ? alerts.open(sel!) : paywall.open({ kind: "offer", feature: "alerts" })} onShare={() => shareOne(sel!)} onToast={showToast} />}
          </div>
        )}
        {detailOpen && alerts.panel(DETAIL_X)}
        {compsOn && sel && cm.key && !cm.setup && (
          <div style={{ position: "absolute", right: GAP, top: GAP, bottom: GAP, zIndex: 4 }}>
            {!compsOut && <SideGrip width={SIDE_W} min={360} max={sideMax} onDrag={w => setSideUser(w)} onDone={w => { saveSideW(w); setReframe(n => n + 1); }} onReset={() => { saveSideW(null); setReframe(n => n + 1); }} />}
            <CompsSide cs={cm} width={SIDE_W} cols={sideCols} out={compsOut} onClose={closeComps} onEstimate={() => ent.planOn ? setExportOn(true) : paywall.open({ kind: "offer", feature: "comps" })}
              locked={!ent.planOn} onToast={showToast} filtered={fCount} onClearFilters={fs.reset} onAddSold={() => fs.setF({ st: { "Recently sold": true }, tg: {} })} />
          </div>
        )}
        {compsAsk === "review" && sel && <CompsReview l={sel} initial={subjectSpecs(sel)} onClose={() => setCompsAsk(null)} onConfirm={v => { setSubjectSpecs(sel, v); setCompsAsk("choice"); }} />}
        {compsAsk === "choice" && sel && <CompsChoice addr={sel.addr} onAi={() => startComps(false)} onManual={() => startComps(true)} onCancel={() => setCompsAsk(null)} />}
        {setup && sel && (
          // Where the comps come from: Radius / Custom, at the bottom of the open map, only
          // while setting up (17 Nov review: not once the comps are showing).
          <div style={{ position: "absolute", left: SUBJ_RIGHT + 64, right: 0, bottom: GAP + 8, zIndex: 3, display: "flex", justifyContent: "center", padding: "0 12px", pointerEvents: "none" }}>
            <AreaToggle cs={cm} />
          </div>
        )}
        {pillOn && (
          // "Search this area": centred over the visible map, just under the filter bar.
          <div style={{ position: "absolute", left: detailOpen ? GAP + COL + GAP + 420 + GAP : GAP + COL + GAP, right: 0, top: BAR_BOTTOM, zIndex: 2, display: "flex", justifyContent: "center", pointerEvents: "none" }}>
            <button onClick={searchThisArea} className="fb-pill" style={{ display: "flex", alignItems: "center", gap: 8, height: 40, padding: "0 18px 0 16px", border: "none", borderRadius: 9999, background: "rgb(253,252,252)", boxShadow: "0 0 0 .5px rgba(30,18,12,.06),0 1px 2px rgba(30,18,12,.10),0 6px 18px rgba(30,18,12,.18)", font: "700 14px/20px var(--font-sans)", color: "rgb(18,18,18)", cursor: "pointer", whiteSpace: "nowrap", pointerEvents: "auto", animation: "panelDrop .24s cubic-bezier(.2,.8,.2,1) both" }}>
              <i className="ph-bold ph-magnifying-glass" style={{ fontSize: 16 }} />Search this area
            </button>
          </div>
        )}
        {/* In comps mode the bar slides left with the detail panel and sits above it, led by the comps radius. */}
        <FilterBar fs={fs} left={compsShift ? GAP : detailOpen ? GAP + COL + GAP + 420 + GAP : GAP + COL + 20} right={compsShift ? SIDE_W + GAP * 2 : 10} hidden={setup}
          lead={compsShift && cm.key ? <RadiusChip miles={cm.radius} custom={cm.custom} onChange={r => { if (cm.custom) cm.setCustom(false); cm.setRadius(r); }} /> : undefined} />
        <FilterDropdown fs={fs} listings={listings} count={compsShift ? compCount : undefined} noun={compsShift ? ["comp", "comps"] : undefined} />
        {!setup && <AllFiltersPanel fs={fs} top={compsShift ? DETAIL_TOP : view === "results" ? 88 : 76} listings={listings} count={compsShift ? compCount : undefined} noun={compsShift ? "comps" : undefined}
          onApply={() => { if (view === "home" && !compsShift) { closeDetail(); setView("results"); } }} />}
        {sortOpen && view === "results" && <SortMenu value={sortBy} onPick={k => { setSortBy(k); setSortOpen(false); }} onClose={() => setSortOpen(false)} left={GAP + COL - 49} top={72} />}
        <div style={{ pointerEvents: "auto" }}><MapControls right={20} left={compsShift ? (subjMini && !setup ? GAP : SUBJ_RIGHT + 8) : undefined} onLocate={() => fit(GAP + COL + GAP)} /></div>
        {offline && (
          <span style={{ position: "absolute", right: 120, bottom: 22, height: 28, padding: "0 12px", borderRadius: 9999, background: "rgba(253,252,252,.92)", font: "400 12px/28px var(--font-sans)", color: "var(--fg-2)", pointerEvents: "auto" }} title="Add NEXT_PUBLIC_MAPBOX_TOKEN to load live Mapbox tiles">
            Offline demo map
          </span>
        )}
        {hs.on && !ent.planOn && tourI == null && !detailOpen && !compsOn && !flow && <TrialBanner days={ent.s.trialVariant} holiday={!!ent.s.holiday} left={GAP + COL + GAP} right={120} />}
        {!onboarded && (
          <button onClick={() => router.push("/onboarding")} className="btn-soft" style={{ position: "absolute", right: 20, top: 72, height: 36, fontSize: 13, background: "var(--paper)", pointerEvents: "auto", boxShadow: "0 4px 12px rgba(40,26,20,.1)" }}>
            <i className="ph-bold ph-play" />Replay onboarding
          </button>
        )}
      </div>

      {compsOn && cm.key && <CompPins cs={cm} />}
      {compsShift && sel && cm.key && <CompRadius at={[sel.lng, sel.lat]} miles={cm.radius} handle onChange={cm.setRadius} custom={cm.custom} area={cm.area} />}
      {setup && <AreaDraw cs={cm} />}
      {exportOn && sel && cm.key && <CompsExport cs={cm} l={sel} navW={navW} user={user.name} onClose={() => setExportOn(false)} onToast={(t, tone) => showToast(t, tone)}
        onSaved={() => { if (!rp.has(sel)) rp.save(sel); }} onExported={() => handoffProfile.desk("export")} />}
      <PricePins signal={signalIds} listings={compsOn ? [] : pinListings} selId={selId} hoverId={hoverId} seen={seen} onPick={openListing}
        onHover={id => { clearTimeout(keepT.current); if (id == null) keepT.current = setTimeout(() => setHoverId(null), 160); else setHoverId(id); }} />
      {hover && hoverId !== selId && !compsOn && (
        <HoverCard l={hover} onKeep={() => clearTimeout(keepT.current)} onLeave={() => { keepT.current = setTimeout(() => setHoverId(null), 160); }} onOpen={() => openListing(hover.id)} />
      )}
      <ParcelLift suppressCard={hoverId != null} selected={parcel} onOpen={p => gate(() => {
        alerts.close(); setSearching(false); setSelId(null); setSoloL(null); setParcel(p); armRun();
        // Centre the clicked parcel in the visible map, between the left column and the detail panel.
        frameSel(p.listing, p.ring, [p.cx, p.cy]);
      })} />
      {flow && <ReportFlow key={flow.l.id + flow.l.addr} l={flow.l} kind={flow.kind} navW={navW} cached={compsCached} onClose={() => setFlow(null)}
        onDone={k => { if (k !== "comps") return; if (!rp.has(flow.l)) showToast("Report saved to Reports"); rp.save(flow.l); getStarted.complete("comps"); if (sv.isSaved(flow.l)) handoffProfile.desk("comps"); }} onShare={() => shareOne(flow.l)} onToast={showToast}
        onComps={sel && sel.id === flow.l.id ? openCompsMode : undefined} />}
      {areaComps && <AreaCompsPreview key={areaComps.title + areaComps.comps.length} {...areaComps} saved={rp.hasArea(areaComps)} onClose={() => setAreaComps(null)}
        onSave={() => { rp.saveArea(areaComps); showToast("Report saved to Reports"); }} />}
      {ss.modals}
      {sh.open && <ShareModal sh={sh} items={shareItems} toast={showToast} />}
      <Toast toast={toast} />
      <Coach steps={coachSteps} task={tour?.task} paused={coachPaused} onExit={getStarted.end} />
      <Coach steps={tourCoach} paused={tourPaused} onExit={endTour} />
      <Coach steps={tipOn ? firstCompTips() : null} paused={!!flow || exportOn} onExit={endTip} />
      <Checklist left={navW + 12} onStart={startTask} />
      <EarnedToast onNext={startTask} />
    </>
  );
}

/** The comps panel's resize grip, on its left edge: drag to widen / narrow the panel
 *  (17 Nov review), double-click for the default width. */
function SideGrip({ width, min, max, onDrag, onDone, onReset }: { width: number; min: number; max: number; onDrag: (w: number) => void; onDone: (w: number) => void; onReset: () => void }) {
  const drag = useRef<{ x: number; w: number } | null>(null);
  const [on, setOn] = useState(false);
  const at = (e: React.PointerEvent) => Math.max(min, Math.min(max, drag.current!.w + (drag.current!.x - e.clientX)));
  return (
    <div role="separator" aria-orientation="vertical" aria-label="Resize the comps panel" aria-valuenow={width} aria-valuemin={min} aria-valuemax={max} title="Drag to resize · double-click to reset"
      onPointerDown={e => { (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); drag.current = { x: e.clientX, w: width }; setOn(true); }}
      onPointerMove={e => { if (drag.current) onDrag(at(e)); }}
      onPointerUp={e => { if (!drag.current) return; const w = at(e); drag.current = null; setOn(false); onDone(w); }}
      onDoubleClick={onReset}
      className="cs-grip"
      style={{ position: "absolute", left: -10, top: 24, bottom: 24, width: 20, zIndex: 6, cursor: "ew-resize", pointerEvents: "auto", touchAction: "none", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <style>{`.cs-grip>span{opacity:0;transition:opacity .16s}.cs-grip:hover>span,.cs-grip[data-on]>span{opacity:1}`}</style>
      <span style={{ width: 5, height: 56, borderRadius: 9999, background: on ? "rgb(18,18,18)" : "rgb(160,150,146)", boxShadow: "0 0 0 2px rgba(253,252,252,.9)", ...(on ? { opacity: 1 } : {}) }} />
    </div>
  );
}
