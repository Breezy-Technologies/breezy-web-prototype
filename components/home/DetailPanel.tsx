"use client";
// Property detail column, ported from the canvas (Home Web.dc.html, `isDetailCol`):
// hero gallery, address + stats, sticky tabs (Summary / Specs / Records / Owners)
// with the compact header that appears once the hero scrolls away (`dHdr`,
// `onBackSummary`), and the alert / share / Contact owner footer.
import { useEffect, useMemo, useRef, useState } from "react";
import { Listing, fullPrice, listingDetail, shortPrice } from "@/lib/fake";
import { F_TYPES } from "@/lib/filters";
import { css } from "@/lib/css";
import { hashStr } from "@/lib/geo";
import { ledger, siteOf, upsideOf } from "@/lib/roi";
import { BellButton } from "./Saved";
import { CompsEstimate } from "../comps/CompsEstimate";
import type { CompsSession } from "../comps/useComps";
import { accessNow, billing, paywall, reportKey, useEntitlements } from "@/lib/billing";
import { PRICING, money, sku } from "@/lib/pricing.config";
import { UsageChip } from "../billing/Paywall";

const TABS = ["Summary", "Specs", "Records", "Owners"] as const;
type Tab = (typeof TABS)[number];
const INK = "rgb(18,18,18)", PURPLE = "rgb(127,90,144)", GREEN_D = "rgb(41,105,74)";

// Canvas icon set: stroked 24px paths used as CSS masks so they take any colour.
const P: Record<string, string> = {
  bed: '<path d="M3 18v-6h18v6M3 18v2M21 18v2M3 12V7M6 12V9.5h5V12"/>',
  bath: '<path d="M3 12h18v3a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4zM6 12V6.5A2.5 2.5 0 0 1 8.5 4c1.2 0 2.2.9 2.4 2"/>',
  plan: '<rect x="3.5" y="3.5" width="17" height="17" rx="1.5"/><path d="M3.5 11h7V3.5M10.5 15v5.5M14 11h6.5"/>',
  lot: '<path d="M4 4h16v16H4zM4 12l8-8M9 20l11-11M4 17l13-13"/>',
  hoa: '<path d="M6 3.5h9l3 3V20.5H6zM9 9h6M9 13h6M9 17h4"/>',
  cal: '<rect x="4" y="5" width="16" height="15" rx="1.5"/><path d="M4 9.5h16M8 3v4M16 3v4M9.5 13.5l5 5M14.5 13.5l-5 5"/>',
  garage: '<path d="M3 20V9l9-5 9 5v11M6.5 20v-8h11v8M6.5 15h11"/>',
  db: '<ellipse cx="12" cy="6" rx="7" ry="2.8"/><path d="M5 6v6c0 1.5 3.1 2.8 7 2.8s7-1.3 7-2.8V6M5 12v6c0 1.5 3.1 2.8 7 2.8s7-1.3 7-2.8v-6"/>',
  pen: '<path d="M15 4.5l4.5 4.5L9 19.5H4.5V15z"/>',
  cam: '<path d="M4 8h3l1.5-2.5h7L17 8h3v11H4z"/><circle cx="12" cy="13" r="3.2"/>',
  camAi: '<path d="M3 9h3l1.5-2.5h5M21 13v6H3V9"/><circle cx="11" cy="14" r="3.2"/><path d="M18 2.5l.8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8z"/>',
  plus: '<circle cx="12" cy="12" r="8.5"/><path d="M12 8v8M8 12h8"/>',
  x: '<circle cx="12" cy="12" r="9" fill="#000" stroke="none"/><path d="M9 9l6 6M15 9l-6 6" stroke="#fff" stroke-width="2"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  addC: '<rect x="5" y="3.5" width="14" height="16" rx="1"/><circle cx="12" cy="10" r="2.6"/><path d="M8 16c.6-2 2.1-3 4-3s3.4 1 4 3M3.5 7h3M3.5 11h3M3.5 15h3M18 19.5h5M20.5 17v5"/>',
};
const svgUrl = (p: string, sw = 1.5) => "url(\"data:image/svg+xml," + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#000" stroke-width="' + sw + '" stroke-linecap="round" stroke-linejoin="round">' + p + "</svg>") + "\")";
const ico = (k: string, sz: number, col = INK, sw = 1.5) => css("flex:none;display:block;width:" + sz + "px;height:" + sz + "px;background:" + col + ";-webkit-mask:" + svgUrl(P[k], sw) + " center/contain no-repeat;mask:" + svgUrl(P[k], sw) + " center/contain no-repeat");
const maskIco = (src: string, sz: number, col: string) => css(`flex:none;width:${sz}px;height:${sz}px;background:${col};-webkit-mask:url('${src}') center/contain no-repeat;mask:url('${src}') center/contain no-repeat`);
const TILE = css("flex:none;width:36px;height:36px;border-radius:8px;display:flex;align-items:center;justify-content:center;background:rgb(245,240,238);box-shadow:inset 0 0 0 1px rgba(13,12,12,.06)");
const thumb = (src: string) => css(`flex:none;width:36px;height:36px;border-radius:8px;background:url('${src}') center/cover no-repeat`);
const ROW = css("display:flex;align-items:center;gap:14px;min-height:56px;padding:10px 0;border-bottom:1px dashed rgba(13,12,12,.14)");
const H17 = "font:700 17px/22px var(--font-sans);color:rgb(18,18,18)";
const SECTION = css("margin-top:28px;padding-top:24px;border-top:1px solid rgba(13,12,12,.1);" + H17);

type Feat = { l: string; img?: string; ai?: boolean };
const FEATS: Feat[] = [
  { l: "Clawfoot tub", img: "/photos/amen-clawfoot.jpg", ai: true }, { l: "Cinema room", img: "/photos/amen-cinema.jpg", ai: true },
  { l: "Air con" }, { l: "Marble kitchen", img: "/photos/amen-kitchen.jpg" }, { l: "Outdoor dining", img: "/photos/amen-dining.jpg" },
  { l: "EV charger" }, { l: "Security" },
];

// Footer bell: `onBell` opens the Alerts panel; with alerts set it turns green with the count.
// Footer share: `onShare` (canvas `onShareProp`) opens the Share modal for this property.
// No quick estimate (`l.noQe`): a slim banner (illustration, label, "Get price estimate")
// replaces the estimate card. The CTA runs a short estimate, then reveals the card and
// raises a positive snackbar via `onToast`. Estimated properties stay revealed this session.
const estimated = new Set<string>();
export function DetailPanel({ l, onClose, onGetComps, onFlow, alertN = 0, onBell, onShare, onToast, comps }: { comps?: CompsSession | null; l: Listing; onClose: () => void; onGetComps: () => void; onFlow?: (k: "ub" | "roi") => void; alertN?: number; onBell?: () => void; onShare?: () => void; onToast?: (text: string, tone?: "positive" | "neutral" | "negative") => void }) {
  const d = useMemo(() => listingDetail(l), [l]);
  const qeKey = `${l.addr}|${l.lng.toFixed(5)},${l.lat.toFixed(5)}`;
  const [qeState, setQeState] = useState<"none" | "loading" | "ready">(() => !l.noQe || estimated.has(qeKey) ? "ready" : "none");
  const getEstimate = () => {
    if (qeState !== "none") return;
    setQeState("loading");
    setTimeout(() => { estimated.add(qeKey); setQeState("ready"); onToast?.("Quick estimate ready", "positive"); }, 1600);
  };
  const [tab, setTab] = useState<Tab>("Summary");
  const ownerKey = l.apn || l.addr;
  // Owner contacts are metered (Nimbus): 25 a month, then purchased contact credits.
  const ent = useEntitlements();
  const cAcc = ent.access("contacts", ownerKey);
  const [revealed, setRevealed] = useState(() => unlockedOwners.has(ownerKey) || cAcc === "owned");
  const pk = reportKey(l);
  const tileAcc = { ub: ent.access("maxBuild", pk), roi: ent.access("roi", pk) };
  const ownerRef = useRef<HTMLDivElement>(null);
  // Contact owner reveals the contact lines and scrolls the Owner section into view,
  // just under the compact header and the sticky tabs (review feedback).
  // Then, once the scroll has settled, the phone, email and address are revealed
  // with a soft gradient sweep (review feedback): "wait" keeps them invisible but in
  // place (so the scroll target is exact), "play" runs the reveal, "done" is plain text.
  const [reveal, setReveal] = useState<"wait" | "play" | "done">("done");
  const contactOwner = () => {
    // One contact per owner, spent on the tap itself (no confirmation step, 10 Nov review);
    // reopening an unlocked owner is free. Nothing left: the contacts upsell, then unlock.
    if (!unlockedOwners.has(ownerKey)) {
      const a = accessNow("contacts", ownerKey);
      if (a === "plan") { paywall.open({ kind: "offer", feature: "contacts" }); return; }
      if (a === "locked") { paywall.open({ kind: "upsell", feature: "contacts", then: contactOwner }); return; }
      const spent = ent.spend("contacts", ownerKey);
      unlockedOwners.add(ownerKey);
      if (spent === "allowance") onToast?.(`Owner unlocked · ${Math.max(0, PRICING.allowance.contacts - billing.get().used.contacts)} of ${PRICING.allowance.contacts} contacts left this month`, "positive");
      else if (spent === "credit") onToast?.(`Owner unlocked · 1 contact credit used`, "positive");
      else if (spent !== "owned") onToast?.("Owner unlocked", "positive");
    }
    setRevealed(true);
    setReveal("wait");
    if (tab !== "Summary") setTab("Summary");
    requestAnimationFrame(() => requestAnimationFrame(() => {
      const sc = scroller.current, el = ownerRef.current;
      if (!sc || !el) { setReveal("play"); return; }
      const top = el.getBoundingClientRect().top - sc.getBoundingClientRect().top + sc.scrollTop;
      const sticky = 64 + (tabBar.current?.offsetHeight ?? 64); // compact header (shows past 210 px) + tab bar
      const to = Math.max(0, Math.min(top - sticky - 8, sc.scrollHeight - sc.clientHeight));
      if (Math.abs(to - sc.scrollTop) < 2) { setReveal("play"); return; }
      let fired = false;
      const go = () => { if (fired) return; fired = true; sc.removeEventListener("scrollend", go); setReveal("play"); };
      sc.addEventListener("scrollend", go);
      setTimeout(go, 900); // browsers without scrollend
      sc.scrollTo({ top: to, behavior: "smooth" });
    }));
  };
  useEffect(() => {
    if (reveal !== "play") return;
    const t = setTimeout(() => setReveal("done"), 1700);
    return () => clearTimeout(t);
  }, [reveal]);
  const [gi, setGi] = useState(0);
  const [descOpen, setDescOpen] = useState(false);
  const [hdr, setHdr] = useState(false);
  const [revd, setRevd] = useState<Record<string, boolean>>({});
  const [feats, setFeats] = useState<Feat[]>(FEATS);
  const [recSeg, setRecSeg] = useState<"Listings" | "Tax Records" | "Mortgage">("Listings");
  const [added, setAdded] = useState<Record<string, boolean>>({});
  const gal = useRef<HTMLDivElement>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const tabBar = useRef<HTMLDivElement>(null);
  // The same figures the reports they open show: Build guidelines' Underbuilt % and the
  // Upside analysis' estimated profit for its recommended build (lib/roi, Pedro's model).
  const { maxBuild, profit } = useMemo(() => {
    const { p, sc } = upsideOf(l);
    return { maxBuild: siteOf(l).ub, profit: ledger(p, sc.rec, {}).profit };
  }, [l]);
  const n = l.photos.length;
  const galStep = (dir: number) => gal.current?.scrollBy({ left: dir * (gal.current.clientWidth + 4), behavior: "smooth" });

  // Canvas `detailTabs[].pick`: switch tab and, if the tab bar hasn't reached the
  // top yet, scroll so it sticks under the compact header.
  const pickTab = (t: Tab) => {
    setTab(t);
    const el = scroller.current, bar = tabBar.current;
    if (!el || !bar) return;
    const prev = bar.style.position; bar.style.position = "relative";
    const y = bar.offsetTop; bar.style.position = prev;
    const target = Math.max(0, y - 64 + 1);
    if (el.scrollTop < target) requestAnimationFrame(() => el.scrollTo({ top: Math.max(target, 211), behavior: "smooth" }));
  };

  const stats: [string, string, number][] = [[String(l.beds), "Bed", 56], [String(l.baths), "Bath", 64], [l.sqft.toLocaleString("en-US"), "ft² Home", 72], [String(l.lotAc), "/ac Lot", 72], ["$" + d.hoa, "/mo HOA", 72]];
  const tiles: [string, string, string, string][] = [[`${maxBuild}%`, "Max\nbuild", "rgb(147,89,75)", "/ui/act-target.svg"], [profit > 0 ? shortPrice(profit) : "None", "Profit\npotential", "rgb(13,87,57)", "/ui/act-chart.svg"]];
  const typeImg = (F_TYPES.find(([k]) => k === l.ptype) || F_TYPES[0])[1];

  type SpecRow = { k: string; label: string; value: string; sub?: string; img?: string; ai?: string };
  const specRows: SpecRow[] = [
    { k: "bed", label: "Bedrooms", value: String(l.beds) }, { k: "bath", label: "Bathrooms", value: String(l.baths) },
    { k: "plan", label: "Home size, ft²", value: l.sqft.toLocaleString("en-US") }, { k: "lot", label: "Lot size, ft²", value: Math.round(l.lotAc * 43560).toLocaleString("en-US") },
    { k: "hoa", label: "HOA fees", value: `$${d.hoa} monthly`, sub: `$${(d.hoa * 12).toLocaleString("en-US")} billed annually` }, { k: "cal", label: "Year built", value: String(l.built) },
    { k: "", label: "Property type", value: l.ptype, img: `/ui/types/${typeImg}.png` },
    { k: "", label: "Style", value: l.pstyle, img: l.photos[0] },
    { k: "", label: "Condition", value: d.condition, img: "/photos/amen-kitchen.jpg", ai: "cond" },
    { k: "", label: "View", value: d.view, img: "/photos/amen-cinema.jpg", ai: "view" },
    { k: "garage", label: "Garage spaces", value: String(d.garage) },
  ];
  const nbhd = l.city.split(",")[0] || "Los Angeles";
  const fullAddr = l.addr + (l.city ? ", " + l.city : "");
  const person = (id: string, name: string, ini: string, img?: string) => {
    const on = !!added[id];
    return (
      <div key={id} style={css("display:flex;align-items:center;gap:16px;padding:12px 14px 12px 12px;border-radius:16px;background:rgb(245,240,238);box-shadow:inset 0 0 0 1px rgb(234,215,210)")}>
        <span style={css(img ? `flex:none;width:52px;height:52px;border-radius:9999px;background:url('${img}') center/cover no-repeat` : "flex:none;width:52px;height:52px;border-radius:9999px;display:flex;align-items:center;justify-content:center;background:radial-gradient(circle at 50% 45%,rgb(253,235,222),rgb(247,222,214));font:italic 400 17px/1 Georgia,serif;color:rgb(206,142,128)")}>{img ? "" : ini}</span>
        <span style={css("flex:1;min-width:0;display:flex;flex-direction:column;gap:2px")}>
          <span style={css("font:400 16px/21px var(--font-sans);color:rgb(18,18,18)")}>{name}</span>
          <span style={css("font:400 14px/19px var(--font-sans);color:" + (on ? GREEN_D : "rgb(98,90,89)"))}>{on ? "Added to contacts" : "Add to contacts"}</span>
        </span>
        <button className="dt-contact" onClick={() => setAdded(a => ({ ...a, [id]: !on }))} title="Add to contacts" style={css("flex:none;width:40px;height:40px;border:none;border-radius:9999px;background:none;cursor:pointer;display:flex;align-items:center;justify-content:center")}>
          <span style={ico(on ? "check" : "addC", 24, on ? GREEN_D : INK, 1.2)} />
        </button>
      </div>
    );
  };

  return (
    <div style={{ position: "relative", width: 420, height: "100%", display: "flex", flexDirection: "column", overflow: "hidden", borderRadius: 24, background: "var(--paper)", boxShadow: "inset 0 0 0 1px rgb(245,240,238),0 14px 36px rgba(40,26,20,.14)", pointerEvents: "auto", animation: "panelDrop .26s cubic-bezier(.2,.8,.2,1) backwards" }}>
      {/* In comps mode the comps panel's × closes comps; the panel itself has no close (review). */}
      {!comps && <div style={css("position:absolute;right:20px;top:20px;z-index:10;display:flex;align-items:center;gap:8px")}>
        <button className="dt-white" onClick={onClose} title="Close" style={css("width:32px;height:32px;border:none;border-radius:9999px;background:rgb(253,252,252);cursor:pointer;display:flex;align-items:center;justify-content:center")}>
          <span style={maskIco("/ui/x.svg", 13, "rgb(17,16,16)")} />
        </button>
      </div>}
      {hdr && (
        <div style={css("position:absolute;left:0;right:0;top:0;z-index:12;height:64px;box-sizing:border-box;display:flex;align-items:center;gap:12px;padding:0 12px;background:rgb(253,252,252);animation:bzPanelDrop .2s cubic-bezier(.2,.8,.2,1) both")}>
          {tab !== "Summary"
            ? <button className="dt-round" onClick={() => setTab("Summary")} title="Back to summary" style={css("flex:none;width:40px;height:40px;border:none;border-radius:9999px;background:rgba(13,12,12,.06);color:rgb(17,16,16);cursor:pointer;display:flex;align-items:center;justify-content:center")}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5M11 6l-6 6 6 6" /></svg>
              </button>
            : <span style={{ flex: "none", width: 40 }} />}
          <span style={css("flex:1;min-width:0;text-align:center;font:700 16px/22px var(--font-sans);color:rgb(18,18,18);white-space:nowrap;overflow:hidden;text-overflow:ellipsis")}>{l.addr}</span>
          {comps ? <span style={{ flex: "none", width: 40 }} /> : <button className="dt-round" onClick={onClose} title="Close" style={css("flex:none;width:40px;height:40px;border:none;border-radius:9999px;background:rgba(13,12,12,.06);color:rgb(17,16,16);cursor:pointer;display:flex;align-items:center;justify-content:center")}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
          </button>}
        </div>
      )}
      <div ref={scroller} className="no-scrollbar" onScroll={e => { const on = e.currentTarget.scrollTop > 210; if (on !== hdr) setHdr(on); }} style={{ flex: 1, minHeight: 0, overflowY: "auto" }}>
        {/* Hero gallery: `onGalPrev` / `onGalNext` / `onGalScroll` */}
        <div style={css("position:relative;flex:none;height:240px;background:rgb(241,231,228)")}>
          <div ref={gal} className="no-scrollbar" onScroll={e => { const el = e.currentTarget, i = Math.round(el.scrollLeft / (el.clientWidth + 4)); if (i !== gi) setGi(i); }} style={css("position:absolute;inset:0;display:flex;gap:4px;overflow-x:auto;scroll-snap-type:x mandatory;scroll-behavior:smooth;scrollbar-width:none")}>
            {l.photos.map((p, k) => <span key={k} style={css(`flex:none;width:100%;height:100%;scroll-snap-align:start;background:url('${p}') center/cover no-repeat`)} />)}
          </div>
          {gi > 0 && (
            <button className="dt-white" onClick={() => galStep(-1)} title="Previous photo" style={css("position:absolute;left:12px;top:50%;z-index:3;transform:translateY(-50%);width:36px;height:36px;border:none;border-radius:9999px;background:rgba(253,252,252,.94);cursor:pointer;display:flex;align-items:center;justify-content:center;box-shadow:0 4px 14px rgba(23,21,20,.2)")}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="rgb(17,16,16)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 6l-6 6 6 6" /></svg>
            </button>
          )}
          {gi < n - 1 && (
            <button className="dt-white" onClick={() => galStep(1)} title="Next photo" style={css("position:absolute;right:12px;top:50%;z-index:3;transform:translateY(-50%);width:36px;height:36px;border:none;border-radius:9999px;background:rgba(253,252,252,.94);cursor:pointer;display:flex;align-items:center;justify-content:center;box-shadow:0 4px 14px rgba(23,21,20,.2)")}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="rgb(17,16,16)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 6l6 6-6 6" /></svg>
            </button>
          )}
          <span style={css("position:absolute;left:16px;top:16px;z-index:2;display:flex;align-items:center;padding:5.333px 10.667px;border-radius:9999px;background:rgba(18,18,18,.72);backdrop-filter:blur(8px);font:400 14px/1.26 var(--font-sans);color:rgb(249,249,249)")}>{l.status}</span>
          <span style={css("position:absolute;right:20px;bottom:20px;z-index:2;display:flex;align-items:center;gap:4px;padding:5.333px 10.667px;border-radius:9999px;background:rgba(18,18,18,.72);backdrop-filter:blur(12px);font:400 14px/1.26 var(--font-sans);color:rgb(249,249,249)")}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgb(249,249,249)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ flex: "none", display: "block" }}><rect x="3" y="4.5" width="18" height="15" rx="2.5" /><circle cx="8.5" cy="9.5" r="1.6" /><path d="M21 15.5l-5-5-9 9" /></svg>
            {gi + 1} / {n}
          </span>
        </div>
        <div style={css("display:flex;flex-direction:column;gap:12px;padding:16px 16px 0")}>
          <div style={css("display:flex;flex-direction:column")}>
            <span style={css("font:400 14px/1.48 var(--font-sans);letter-spacing:.25px;color:rgb(18,18,18)")}>{nbhd}</span>
            <span style={css("font:300 26px/1.26 var(--font-sans);letter-spacing:-.5px;color:rgb(18,18,18);text-wrap:pretty")}>{fullAddr}</span>
          </div>
          <div style={css("display:flex;gap:4px")}>
            {stats.map(([v, k, w]) => (
              <span key={k} style={css(`flex:none;width:${w}px;display:flex;flex-direction:column;gap:2px`)}>
                <span style={css("font:400 16px/1.48 var(--font-sans);color:rgb(18,18,18)")}>{v}</span>
                <span style={css("font:400 12px/1.48 var(--font-sans);letter-spacing:.5px;color:rgb(73,67,65);white-space:nowrap")}>{k}</span>
              </span>
            ))}
          </div>
        </div>
        <div ref={tabBar} style={css(`position:sticky;top:${hdr ? 64 : 0}px;z-index:9;display:flex;flex-direction:column;padding:12px 0 16px;background:rgb(253,252,252);box-shadow:inset 0 -1px 0 rgb(245,240,238)`)}>
          <div className="no-scrollbar" style={css("display:flex;gap:8px;overflow-x:auto;scrollbar-width:none;padding:0 16px;scroll-padding:0 16px")}>
            {TABS.map(t => (
              <button key={t} onClick={() => pickTab(t)} style={css("flex:none;height:36px;padding:0 16px;border:none;border-radius:9999px;cursor:pointer;white-space:nowrap;font:400 15px/20px var(--font-sans);transition:background .16s,color .16s;"
                + (tab === t ? "background:rgb(18,18,18);color:rgb(249,249,249);" : "background:rgba(18,18,18,.06);color:rgb(18,18,18);"))}>{t}</button>
            ))}
          </div>
        </div>

        {tab === "Summary" && <>
          {/* Quick estimate (floating card) + Get comps */}
          <div style={css("display:flex;flex-direction:column;padding:16px 16px 0")}>
            {comps ? <CompsEstimate cs={comps} l={l} locked={!ent.planOn} /> : qeState !== "ready" ? (
              // No quick estimate: the full-width CTA route (review decision): text with the
              // illustration on the right, full-width outline "Get price estimate" underneath.
                <div style={css("display:flex;flex-direction:column;gap:16px;padding:20px;border-radius:20px;background:rgb(243,240,238)")}>
                  <div style={css("display:flex;align-items:center;gap:16px")}>
                    <span style={css("flex:1;min-width:0;display:flex;flex-direction:column;gap:6px")}>
                      <span style={css("font:700 16px/21px var(--font-sans);color:rgb(18,18,18)")}>No quick estimate yet</span>
                      <span style={css("font:400 14px/20px var(--font-sans);color:rgb(73,67,65)")}>{qeState === "loading" ? "Checking nearby sales…" : "Too few nearby sales to price this home automatically."}</span>
                    </span>
                    <img src="/iso/no-estimate.png" alt="" style={css("flex:none;width:104px;height:auto;display:block")} />
                  </div>
                  <button className="dt-press qe-outline" onClick={getEstimate} disabled={qeState === "loading"} style={css("display:flex;align-items:center;justify-content:center;gap:8px;height:48px;border:none;border-radius:9999px;background:none;box-shadow:inset 0 0 0 1.5px rgb(18,18,18);font:700 15px/20px var(--font-sans);color:rgb(18,18,18);cursor:pointer")}>
                    {qeState === "loading" && <i className="ph-bold ph-circle-notch" style={{ fontSize: 15, animation: "spin .8s linear infinite" }} />}
                    {qeState === "loading" ? "Estimating" : "Get price estimate"}
                  </button>
                </div>
            ) : (
            <div style={css("display:flex;align-items:flex-end;gap:12px;padding:16px;border-radius:20px;background:rgb(255,255,255);box-shadow:0 0 0 .5px rgba(13,12,12,.08),0 10px 28px rgba(40,26,20,.12);" + (l.noQe ? "animation:fadeIn .3s ease both" : ""))}>
              <span style={css("flex:1;min-width:0;display:flex;flex-direction:column;gap:2px")}>
                <span style={css("display:flex;align-items:center;gap:5px;font:700 11px/14px var(--font-sans);letter-spacing:.08em;text-transform:uppercase;color:rgb(129,117,111)")}><svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor" style={{ flex: "none", display: "block" }}><path d="M13.5 2 4 13.5h6.5L9.5 22 20 9.5h-6.5z" /></svg>Quick estimate</span>
                <span style={css("font:300 36px/1.1 var(--font-sans);letter-spacing:-1px;color:rgb(18,18,18);white-space:nowrap")}>~{shortPrice(l.qe.value)}</span>
                <span style={css("font:400 12px/16px var(--font-sans);color:rgb(98,90,89);white-space:nowrap;overflow:hidden;text-overflow:ellipsis")}>{shortPrice(l.qe.lo)} – {shortPrice(l.qe.hi)} · from 6 nearby sales</span>
              </span>
              <button className="fb-dark dt-press" onClick={onGetComps} title="Full AI analysis + write-up" style={css("flex:none;display:flex;align-items:center;gap:6px;height:40px;padding:0 16px;border:none;border-radius:9999px;background:rgb(18,18,18);font:700 14px/18px var(--font-sans);color:rgb(249,249,249);cursor:pointer;white-space:nowrap")}>
                <span style={maskIco("/ui/act-files.svg", 15, "currentColor")} />Get comps
              </button>
            </div>
            )}
          </div>
          {/* Max build + Profit potential tiles (canvas `detailTiles`): open the Underbuilt / ROI report flows */}
          <div style={css("position:relative;z-index:7;display:flex;gap:8px;padding:16px 16px 0")}>
            {tiles.map(([v, k, c, ic]) => {
              // Usage on the tile (Nimbus): "3 left", credits, or a lock. In the "Locked tile"
              // lock style the figure itself is hidden until the report is unlocked.
              const fk = k.startsWith("Max") ? "ub" : "roi", a = tileAcc[fk];
              const hide = ent.s.lockStyle === "tile" && (a === "locked" || a === "plan" || a === "credit");
              return (
              <button key={k} className="dt-tile" onClick={() => onFlow?.(fk)} title={k.startsWith("Max") ? "Underbuilt analysis" : "Upside analysis"} style={css("flex:1;min-width:0;height:88px;box-sizing:border-box;display:flex;flex-direction:column;align-items:flex-start;padding:8px;border:none;border-radius:8px;cursor:pointer;text-align:left;transition:box-shadow .3s ease,background .3s ease;background:rgb(245,240,238);box-shadow:none")}>
                <span style={css("align-self:stretch;height:24px;display:flex;align-items:center;gap:4px")}>
                  <span style={maskIco(ic, 16, c)} />
                  <span style={{ ...css("font:400 16px/1.48 var(--font-sans);white-space:nowrap;color:" + c), ...(hide ? { filter: "blur(6px)", userSelect: "none" } : {}) }}>{hide ? (fk === "ub" ? "00%" : "$0.0m") : v}</span>
                  <span style={{ flex: 1 }} />
                  <UsageChip access={a} feature={fk === "ub" ? "maxBuild" : "roi"} />
                </span>
                <span style={css("flex:1;align-self:stretch;font:400 12px/1.48 var(--font-sans);letter-spacing:.25px;color:rgb(73,67,65);text-align:left;white-space:pre-line")}>{k}</span>
              </button>
              );
            })}
          </div>
          {/* Owner: `onOwnersTab` (View history), contact lines unlock with Contact owner (`onOwnerReveal`) */}
          <div ref={ownerRef} style={css("display:flex;flex-direction:column;gap:12px;padding:24px 16px 8px")}>
            <div style={css("display:flex;align-items:center;justify-content:space-between;gap:12px")}>
              <span style={css(H17)}>Owner</span>
              <button className="dt-ghost" onClick={() => setTab("Owners")} style={css("flex:none;height:32px;padding:0 10px;margin-right:-10px;border:none;border-radius:9999px;background:none;font:700 14px/18px var(--font-sans);color:rgb(17,16,16);cursor:pointer;white-space:nowrap")}>View history</button>
            </div>
            <div style={css("display:flex;align-items:center;gap:14px")}>
              <span style={css("flex:none;width:56px;height:56px;border-radius:9999px;background:rgb(228,214,208);display:flex;align-items:center;justify-content:center;font:700 18px/1 var(--font-sans);color:rgb(18,18,18)")}>{l.owner.ini}</span>
              <span style={css("flex:1;min-width:0;display:flex;flex-direction:column;gap:2px")}>
                <span style={css("font:700 17px/22px var(--font-sans);color:rgb(18,18,18);text-wrap:pretty")}>{l.owner.name}</span>
                <span style={css("font:400 14px/20px var(--font-sans);color:rgb(98,90,89)")}>{l.owner.sub}</span>
              </span>
            </div>
            {revealed
              // Canvas lists the lines with a 6px gap at 70px indent; the copy rows carry 8px padding, so 62px lines the text up.
              ? <div style={{ position: "relative", display: "flex", flexDirection: "column", gap: 0, paddingLeft: 62, font: "400 14px/20px var(--font-sans)", color: INK }}>
                  {/* one faint warm sheen passes behind the lines as they appear */}
                  {reveal === "play" && <span aria-hidden style={{ position: "absolute", left: 54, right: 0, top: -4, bottom: -4, borderRadius: 12, overflow: "hidden", pointerEvents: "none" }}>
                    <span style={{ position: "absolute", inset: 0, background: "linear-gradient(100deg,rgba(174,106,91,0) 0%,rgba(174,106,91,.10) 35%,rgba(186,160,251,.12) 55%,rgba(186,160,251,0) 80%)", animation: "revealSheen 1.5s cubic-bezier(.3,.7,.3,1) both" }} />
                  </span>}
                  <CopyLine text={l.owner.phone} reveal={reveal} delay={0} verified={isVerified(l.owner.phone, 0.7)} /><CopyLine text={l.owner.email} reveal={reveal} delay={160} verified={isVerified(l.owner.email, 0.55)} /><CopyLine text={l.owner.mail} muted reveal={reveal} delay={320} verified={isVerified(l.owner.mail, 0.8)} />
                  {cAcc !== "unlimited" && <CreditLine text={`Contact unlocked · ${ent.left("contacts")} of ${PRICING.allowance.contacts} left this month${ent.s.credits.contacts ? ` · ${ent.s.credits.contacts} credits` : ""}`} used />}
                </div>
              // Locked: the lines keep their shape, masked, so it's clear what unlocks.
              : <div style={css("padding-left:70px;display:flex;flex-direction:column;gap:6px")}>
                  {[mask(l.owner.phone, "phone"), mask(l.owner.email, "email"), "Mailing address"].map(t => (
                    <span key={t} style={css("display:flex;align-items:center;gap:8px;height:22px;font:400 14px/20px var(--font-sans);color:rgb(129,117,111)")}>
                      <i className="ph-bold ph-lock-simple" style={{ fontSize: 13, color: "rgb(147,89,75)" }} />{t}
                    </span>
                  ))}
                  <CreditLine text={cAcc === "allowance" ? `Uses 1 contact · ${ent.left("contacts")} of ${PRICING.allowance.contacts} left this month`
                    : cAcc === "credit" ? `Uses 1 contact credit · ${ent.s.credits.contacts} left`
                    : cAcc === "locked" ? `No contacts left this month · ${sku("ct-10").label} for ${money(sku("ct-10").price)}`
                    : cAcc === "plan" ? `Owner contacts are part of ${PRICING.plan.name}` : "Unlimited (internal)"} />
                </div>}
          </div>
          <div style={css("display:flex;flex-direction:column;gap:24px;padding:24px 16px 0")}>
            {/* Listing description: `onDescToggle` */}
            <div style={css("display:flex;flex-direction:column;gap:12px;padding:16px 16px 12px;border-radius:16px;background:rgb(243,241,239) repeating-linear-gradient(135deg,rgba(13,12,12,.018) 0 2px,transparent 2px 5px)")}>
              <div style={css("display:flex;align-items:center;justify-content:space-between;gap:12px")}>
                <span style={css(H17)}>Listing description</span>
                <span style={css("flex:none;display:flex;align-items:center;height:24px;padding:0 10px;border-radius:9999px;background:rgb(13,87,57);font:700 13px/24px var(--font-sans);color:rgb(249,249,249)")}>{l.status}</span>
              </div>
              <span style={css("font:400 15px/22px var(--font-sans);color:rgb(18,18,18);text-wrap:pretty")}>{descOpen ? d.desc : d.descShort}</span>
              <span style={css("font:400 14px/20px var(--font-sans);letter-spacing:.2px;color:rgb(98,90,89);white-space:pre-line")}>{`Listed by: ${d.agent}\n${d.brokerage}\nSource: ${d.source}`}</span>
              <button className="dt-green" onClick={() => setDescOpen(v => !v)} style={css("align-self:center;display:flex;align-items:center;gap:8px;height:36px;padding:0 12px;border:none;border-radius:9999px;background:none;font:700 14px/18px var(--font-sans);color:rgb(49,140,96);cursor:pointer")}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flex: "none", transition: "transform .2s ease", transform: `rotate(${descOpen ? 180 : 0}deg)` }}><path d="M6 9l6 6 6-6" /></svg>
                {descOpen ? "Show less" : "Show more"}
              </button>
            </div>
            {/* Listing history */}
            <div style={css("display:flex;flex-direction:column;gap:8px")}>
              <div style={css("height:32px;display:flex;align-items:center;justify-content:space-between;gap:8px")}>
                <span style={css("font:400 18px/1.26 var(--font-sans);letter-spacing:-.25px;color:rgb(18,18,18)")}>Listing history</span>
                <button className="dt-more" onClick={() => pickTab("Records")} style={css("flex:none;display:flex;align-items:center;gap:6px;height:32px;padding:0 4px;border:none;background:none;font:700 14px/18px var(--font-sans);color:rgb(17,16,16);cursor:pointer")}>View more</button>
              </div>
              <div style={css("border-radius:16px;padding:14px 16px;background:rgb(234,244,238);box-shadow:inset 0 0 0 .5px rgb(70,155,112);display:flex;flex-direction:column;gap:14px")}>
                <div style={css("display:flex;gap:8px")}>
                  {[["Listed for", fullPrice(l.price)], ["Per /ft² Home", "$" + Math.round(l.price / l.sqft).toLocaleString("en-US")], ["Per/ac Lot", shortPrice(l.price / l.lotAc)]].map(([k, v]) => (
                    <span key={k} style={css("flex:1;min-width:0;display:flex;flex-direction:column;gap:3px")}>
                      <span style={css("font:400 12px/16px var(--font-sans);color:rgb(77,71,69)")}>{k}</span>
                      <span style={css("font:400 16px/21px var(--font-sans);color:rgb(18,18,18)")}>{v}</span>
                    </span>
                  ))}
                </div>
                <div style={css("display:flex;gap:8px;align-items:flex-end")}>
                  {[["Listed on", d.listedOn], ["DOM", String(l.dom)]].map(([k, v]) => (
                    <span key={k} style={css("flex:1;min-width:0;display:flex;flex-direction:column;gap:3px")}>
                      <span style={css("font:400 12px/16px var(--font-sans);color:rgb(77,71,69)")}>{k}</span>
                      <span style={css("font:400 16px/21px var(--font-sans);color:rgb(18,18,18)")}>{v}</span>
                    </span>
                  ))}
                  <span style={css("flex:none;display:flex;align-items:center;gap:6px;height:26px;padding:0 10px;border-radius:9999px;box-shadow:inset 0 0 0 .5px rgb(70,155,112);font:400 12px/16px var(--font-sans);color:rgb(41,105,74)")}>More</span>
                </div>
              </div>
            </div>
            {/* Features */}
            <div style={css("display:flex;flex-direction:column;gap:8px")}>
              <div style={css("height:32px;display:flex;align-items:center;justify-content:space-between;gap:8px")}>
                <span style={css("font:400 18px/1.26 var(--font-sans);letter-spacing:-.25px;color:rgb(18,18,18)")}>Features</span>
                <button className="dt-more" onClick={() => pickTab("Specs")} style={css("flex:none;display:flex;align-items:center;gap:6px;height:32px;padding:0 4px;border:none;background:none;font:700 14px/18px var(--font-sans);color:rgb(17,16,16);cursor:pointer")}>View more</button>
              </div>
              <div style={css("display:flex;flex-wrap:wrap;gap:6px")}>
                {[l.ptype, l.pstyle, ...l.feats, "More →"].map(f => (
                  <span key={f} style={css("display:flex;align-items:center;height:26px;padding:0 10px;border-radius:9999px;box-shadow:inset 0 0 0 .5px rgb(18,18,18);font:400 12px/16px var(--font-sans);color:rgb(18,18,18);white-space:nowrap")}>{f}</span>
                ))}
              </div>
            </div>
          </div>
        </>}

        {tab === "Specs" && (
          <div style={css("display:flex;flex-direction:column;padding:20px 16px 0")}>
            <button className="dt-src" style={css("display:flex;align-items:center;gap:12px;height:52px;padding:0 18px;border:none;border-radius:9999px;background:rgb(253,252,252);box-shadow:inset 0 0 0 1px rgba(13,12,12,.18);cursor:pointer")}>
              <span style={ico("db", 20, INK, 1.4)} />
              <span style={css("flex:1;min-width:0;text-align:center;font:400 15px/20px var(--font-sans);color:rgb(18,18,18)")}>MLS Listing, {d.listedDate}</span>
              <span style={ico("pen", 18, INK, 1.4)} />
            </button>
            <div style={css("margin-top:16px;display:flex;align-items:center;gap:14px;padding:14px 16px;border-radius:14px;background:linear-gradient(90deg,rgb(241,235,245),rgb(233,227,238))")}>
              <span style={ico("camAi", 26, PURPLE, 1.3)} />
              <span style={css("flex:1;min-width:0;font:400 14px/20px var(--font-sans);color:rgb(18,18,18);text-wrap:pretty")}>AI found <b style={{ fontWeight: 700, color: PURPLE }}>6 features</b> in your photos. Review and add them to your listing.</span>
            </div>
            <div style={css("display:flex;flex-direction:column;margin-top:8px")}>
              {specRows.map(r => {
                const done = r.ai ? !!revd[r.ai] : false;
                return (
                  <div key={r.label} style={ROW}>
                    {r.img ? <span style={thumb(r.img)} /> : <span style={TILE}><span style={ico(r.k, 20, "rgb(73,67,65)", 1.3)} /></span>}
                    <span style={css("flex:none;width:120px;font:400 15px/20px var(--font-sans);color:rgb(98,90,89)")}>{r.label}</span>
                    <span style={css("flex:1;min-width:0;display:flex;flex-direction:column")}>
                      <span style={css("font:" + (r.ai && !done ? "italic " : "normal ") + "400 15px/20px var(--font-sans);color:rgb(18,18,18)")}>{r.value}</span>
                      {r.sub && <span style={css("font:400 13px/17px var(--font-sans);color:rgb(129,117,111)")}>{r.sub}</span>}
                    </span>
                    {r.ai && (
                      <button onClick={() => setRevd(v => ({ ...v, [r.ai!]: !done }))} style={css("flex:none;display:flex;align-items:center;gap:6px;height:36px;padding:0 14px;border:none;border-radius:9999px;background:none;cursor:pointer;font:400 14px/18px var(--font-sans);"
                        + (done ? "color:rgb(41,105,74);box-shadow:inset 0 0 0 1px rgba(70,155,112,.6)" : "color:" + PURPLE + ";box-shadow:inset 0 0 0 1px " + PURPLE))}>
                        <span style={ico(done ? "check" : "cam", 14, done ? GREEN_D : PURPLE, 1.6)} />
                        <span>{done ? "Confirmed" : "Review"}</span>
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
            <span style={css("margin-top:28px;" + H17)}>Features &amp; amenities</span>
            <div style={css("margin-top:16px;display:flex;flex-wrap:wrap;gap:8px")}>
              {/* "Add feature" has no handler in the canvas either */}
              <button className="dt-add" style={css("display:flex;align-items:center;gap:8px;height:40px;padding:0 14px 0 12px;border:none;border-radius:9999px;background:rgb(240,238,237);font:400 15px/20px var(--font-sans);color:rgb(18,18,18);cursor:pointer")}>
                <span style={ico("plus", 18, INK, 1.5)} />
                Add feature
              </button>
              {feats.map((f, i) => (
                // AI-suggested chips (italic, purple) are accepted on click; plain chips are removed.
                <button key={f.l} title={f.ai ? "Add to listing" : "Remove"} onClick={() => setFeats(fs => f.ai ? fs.map((g, m) => m === i ? { ...g, ai: false } : g) : fs.filter((_, m) => m !== i))}
                  style={css("display:flex;align-items:center;gap:8px;height:40px;padding:0 12px 0 " + (f.img ? 6 : 14) + "px;border:none;border-radius:9999px;cursor:pointer;"
                    + (f.ai ? "background:rgb(252,250,253);box-shadow:inset 0 0 0 1px " + PURPLE : "background:rgb(240,238,237)"))}>
                  {f.img && <span style={css(`flex:none;width:28px;height:28px;border-radius:9999px;background:url('${f.img}') center/cover no-repeat`)} />}
                  <span style={css("font:" + (f.ai ? "italic " : "") + "400 15px/20px var(--font-sans);color:" + (f.ai ? PURPLE : INK))}>{f.l}</span>
                  <span style={f.ai ? ico("cam", 15, PURPLE, 1.5) : ico("x", 13, "rgba(18,18,18,.4)", 1)} />
                </button>
              ))}
            </div>
            <span style={SECTION}>Address</span>
            <div style={css("display:flex;flex-direction:column;margin-top:4px")}>
              {[["First line", l.addr], ["Full address", fullAddr], ["Neighborhood", nbhd]].map(([k, v]) => (
                <div key={k} style={ROW}>
                  <span style={css("flex:none;width:140px;font:400 15px/20px var(--font-sans);color:rgb(98,90,89)")}>{k}</span>
                  <span style={css("flex:1;min-width:0;font:400 15px/20px var(--font-sans);color:rgb(18,18,18);text-wrap:pretty")}>{v}</span>
                </div>
              ))}
            </div>
            <span style={SECTION}>Identifiers</span>
            <div style={css("display:flex;flex-direction:column;gap:14px;margin-top:16px")}>
              {[["APN", d.apn], ["Zone", d.zone], ["MLS ID", d.mls]].map(([k, v]) => (
                <div key={k} style={css("display:flex;align-items:center;gap:14px")}>
                  <span style={css("flex:none;width:140px;font:400 15px/20px var(--font-sans);color:rgb(98,90,89)")}>{k}</span>
                  <span style={css("flex:1;min-width:0;font:400 15px/20px var(--font-sans);color:rgb(18,18,18)")}>{v}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {tab === "Records" && (
          <div style={css("display:flex;flex-direction:column;padding:20px 16px 0")}>
            <div style={css("display:flex;padding:4px;border-radius:9999px;background:rgba(13,12,12,.05)")}>
              {(["Listings", "Tax Records", "Mortgage"] as const).map(s => (
                <button key={s} onClick={() => setRecSeg(s)} style={css("flex:1;min-width:0;height:40px;border:none;border-radius:9999px;cursor:pointer;font:400 15px/20px var(--font-sans);color:rgb(18,18,18);transition:background .16s;"
                  + (recSeg === s ? "background:rgb(253,252,252);box-shadow:0 1px 4px rgba(18,18,18,.14)" : "background:none"))}>{s}</button>
              ))}
            </div>
            {recSeg === "Listings" ? (
              <div style={css("display:flex;flex-direction:column")}>
                {d.recYears.map(y => (
                  <div key={y.year} style={css("display:flex;flex-direction:column;gap:12px;margin-top:28px")}>
                    <span style={css("font:700 20px/26px var(--font-sans);color:rgb(18,18,18)")}>{y.year}</span>
                    {y.events.map((ev, i) => (
                      <div key={i} style={css("display:flex;flex-direction:column;padding:14px 16px;border-radius:16px;background:rgb(245,240,238);box-shadow:inset 0 0 0 1px rgb(234,215,210)")}>
                        <div style={css("display:flex;align-items:center;gap:8px")}>
                          <span style={css("flex:1;min-width:0;font:400 15px/20px var(--font-sans);color:rgb(18,18,18)")}>{ev.date}</span>
                          {ev.change && (
                            <span style={css("display:flex;align-items:center;gap:5px;font:400 15px/20px var(--font-sans);color:rgb(18,18,18)")}>
                              {ev.change.startsWith("-")
                                ? <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="rgb(174,106,91)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 7l6 6 4-4 8 8M15 17h6v-6" /></svg>
                                : <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="rgb(70,155,112)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 17l6-6 4 4 8-8M15 7h6v6" /></svg>}
                              {ev.change}
                            </span>
                          )}
                        </div>
                        <div style={css("display:flex;align-items:baseline;gap:8px;margin-top:6px;padding-bottom:12px;border-bottom:1px dashed rgba(13,12,12,.14)")}>
                          <span style={css("flex:1;min-width:0;font:700 15px/20px var(--font-sans);color:rgb(18,18,18)")}>{ev.title}</span>
                          <span style={css("font:700 15px/20px var(--font-sans);color:rgb(18,18,18);white-space:nowrap")}>{ev.price}</span>
                          <span style={css("font:400 14px/20px var(--font-sans);color:rgb(129,117,111);white-space:nowrap")}>/ {ev.ppsf} per ft²</span>
                        </div>
                        <div style={css("display:flex;align-items:center;gap:14px;margin-top:12px;font:400 14px/18px var(--font-sans);color:rgb(18,18,18)")}>
                          <span style={css("display:flex;align-items:center;gap:4px")}><span style={ico("bed", 15, "rgb(98,90,89)")} />{ev.beds}</span>
                          <span style={css("display:flex;align-items:center;gap:4px")}><span style={ico("bath", 15, "rgb(98,90,89)")} />{ev.baths}</span>
                          <span style={css("display:flex;align-items:center;gap:4px")}><span style={ico("plan", 15, "rgb(98,90,89)")} />{ev.sqft}</span>
                          <span style={css("display:flex;align-items:center;gap:4px")}><span style={ico("lot", 15, "rgb(98,90,89)")} />{ev.lot}</span>
                          <span style={{ flex: 1 }} />
                          {ev.update && <button style={css("border:none;background:none;padding:0;font:700 15px/20px var(--font-sans);color:rgb(174,106,91);cursor:pointer")}>Update</button>}
                        </div>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            ) : (
              <div style={css("display:flex;flex-direction:column;margin-top:12px")}>
                {(recSeg === "Tax Records" ? d.tax : d.mortgage).map(([k, v]) => (
                  <div key={k} style={css("display:flex;align-items:center;gap:14px;min-height:52px;padding:10px 0;border-bottom:1px dashed rgba(13,12,12,.14)")}>
                    <span style={css("flex:none;width:150px;font:400 15px/20px var(--font-sans);color:rgb(98,90,89)")}>{k}</span>
                    <span style={css("flex:1;min-width:0;font:400 15px/20px var(--font-sans);color:rgb(18,18,18)")}>{v}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {tab === "Owners" && (
          <div style={css("display:flex;flex-direction:column;padding:24px 16px 0")}>
            {[{ head: "Current", date: "Since " + d.ownerSince, people: [{ id: "cur", name: l.owner.name, ini: l.owner.ini, img: undefined as string | undefined }] },
              ...d.former.map((g, i) => ({ head: i === 0 ? "Former" : "", ...g }))].map(g => (
              <div key={g.date + g.head} style={css("display:flex;flex-direction:column;gap:12px;margin-bottom:24px")}>
                {g.head && <span style={css("font:700 18px/24px var(--font-sans);color:rgb(18,18,18)")}>{g.head}</span>}
                <span style={css("font:400 15px/20px var(--font-sans);color:rgb(18,18,18)")}>{g.date}</span>
                {g.people.map(p => person(p.id, p.name, p.ini, p.img))}
              </div>
            ))}
          </div>
        )}
        <div style={{ height: 80 }} />
      </div>
      <div style={css("flex:none;display:flex;align-items:center;gap:8px;padding:16px;background:rgb(253,252,252);box-shadow:inset 0 1px 0 rgb(245,240,238)")}>
        <BellButton n={alertN} onClick={() => onBell?.()} />
        <button className="btn-soft" title="Share property" onClick={onShare} style={{ flex: "none", width: 48, padding: 0 }}>
          <span style={maskIco("/ui/share.svg", 18, "rgb(17,16,16)")} />
        </button>
        {revealed ? (
          // Email is the one CTA once the owner is unlocked (11 Nov comment: no Call on web).
          <a className="btn-dark" href={`mailto:${l.owner.email}`} style={{ flex: 1, minWidth: 0, textDecoration: "none", animation: "fadeIn .25s ease backwards" }}>
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" style={{ flex: "none", display: "block" }}><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m3 7 9 6 9-6" /></svg>Email owner
          </a>
        ) : (
          <button className="btn-dark" style={{ flex: 1, minWidth: 0, whiteSpace: "nowrap" }} onClick={contactOwner}>
            {cAcc === "locked" || cAcc === "plan"
              ? <i className="ph-bold ph-lock-simple" style={{ fontSize: 16 }} />
              : <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" style={{ flex: "none", display: "block" }}><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></svg>}
            {cAcc === "locked" ? `Get ${sku("ct-10").adds.contacts} contacts · ${money(sku("ct-10").price)}` : "Contact owner"}
          </button>
        )}
      </div>
      {/* Soft fade where the scroll content meets the footer */}
      <div style={css("position:absolute;left:0;right:0;bottom:80px;z-index:8;height:72px;pointer-events:none;background:linear-gradient(to bottom,rgba(253,252,252,0) 0%,rgba(253,252,252,.8) 55%,rgb(253,252,252) 100%)")} />
    </div>
  );
}

// Owner contact line: hovering shows a copy icon; clicking copies the value to
// the clipboard and briefly shows a check (review feedback).
/* Owner contact credits (10 Nov review): show clearly that unlocking spends one
   credit and how many remain, without a confirmation step. Fake balance for the
   session; each owner is charged once. */
const unlockedOwners = new Set<string>();
// "(•••) •••-4821", "j•••@gmail.com": enough to show what unlocks, not the value.
const mask = (v: string, k: "phone" | "email") => k === "phone" ? `(•••) •••-${v.replace(/\D/g, "").slice(-4)}` : `${v[0]}•••@${v.split("@")[1] ?? "•••"}`;
function CreditLine({ text, used }: { text: string; used?: boolean }) {
  return (
    <span style={{ display: "flex", alignItems: "center", gap: 6, padding: used ? "6px 8px 0" : 0, font: "400 12px/16px var(--font-sans)", color: used ? "rgb(129,117,111)" : "rgb(98,90,89)", animation: used ? "fadeIn .4s ease .5s both" : undefined }}>
      <span style={{ flex: "none", width: 16, height: 16, borderRadius: 9999, background: "linear-gradient(180deg,rgb(255,224,120),rgb(232,184,64))", boxShadow: "inset 0 0 0 1px rgba(150,110,20,.35)", display: "flex", alignItems: "center", justifyContent: "center", font: "700 9px/1 var(--font-sans)", color: "rgb(110,78,10)" }}>1</span>
      {text}
    </span>
  );
}

// Each contact line says whether it's verified (review comment, 11 Nov). Fake and
// stable per value until the owner data service returns real verification.
const isVerified = (v: string, share: number) => (hashStr("verified:" + v) % 100) < share * 100;
function VerifyTag({ ok }: { ok: boolean }) {
  return (
    <span title={ok ? "Verified: confirmed against a recent source" : "Unverified: not yet confirmed"} style={{ flex: "none", display: "flex", alignItems: "center", gap: 4, font: "400 12px/16px var(--font-sans)", color: ok ? "rgb(46,122,84)" : "rgb(129,117,111)" }}>
      <i className={`ph-${ok ? "fill" : "bold"} ph-${ok ? "seal-check" : "seal-question"}`} style={{ fontSize: 14 }} />{ok ? "Verified" : "Unverified"}
    </span>
  );
}

// While revealing, the text is painted by a gradient (ink, a clay → violet edge,
// then transparent) that slides across it, so each line is written in left to right.
function CopyLine({ text, muted, reveal = "done", delay = 0, verified }: { text: string; muted?: boolean; reveal?: "wait" | "play" | "done"; delay?: number; verified?: boolean }) {
  const [done, setDone] = useState(false);
  const copy = () => {
    // writeText is async and rejects when the page isn't focused; swallow that.
    navigator.clipboard?.writeText(text).catch(() => {});
    setDone(true);
    setTimeout(() => setDone(false), 1400);
  };
  return (
    <button onClick={copy} title={done ? "Copied" : "Copy"} className="copy-line" style={{ display: "flex", alignItems: "center", gap: 8, height: 26, margin: 0, padding: "0 8px", border: "none", borderRadius: 8, background: "none", font: "inherit", color: muted ? "rgb(98,90,89)" : "var(--ink)", cursor: "pointer", textAlign: "left" }}>
      <span style={{ flex: 1, minWidth: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", ...(reveal === "wait" ? { opacity: 0 } : reveal === "play" ? {
        color: "transparent", WebkitBackgroundClip: "text", backgroundClip: "text", backgroundSize: "300% 100%", backgroundRepeat: "no-repeat",
        backgroundImage: `linear-gradient(100deg,${muted ? "rgb(98,90,89)" : "rgb(18,18,18)"} 0%,${muted ? "rgb(98,90,89)" : "rgb(18,18,18)"} 30%,rgb(174,106,91) 36%,rgb(186,160,251) 41%,rgba(186,160,251,0) 47%)`,
        animation: `revealText 1s cubic-bezier(.4,.1,.3,1) ${delay}ms both`,
      } : {}) }}>{text}</span>
      {verified != null && reveal !== "wait" && <span style={{ flex: "none", animation: reveal === "play" ? `fadeIn .4s ease ${delay + 700}ms both` : undefined }}><VerifyTag ok={verified} /></span>}
      <i className={`ph-bold ph-${done ? "check" : "copy"} copy-ic`} style={{ flex: "none", fontSize: 15, color: done ? "rgb(49,140,96)" : "var(--fg-2)", opacity: done ? 1 : undefined }} />
    </button>
  );
}

