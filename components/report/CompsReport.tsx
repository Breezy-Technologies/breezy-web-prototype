"use client";
// The Comps tab of the report sheet: the comps review screen, ported from the
// canvas (`Home Web.dc.html`, `resIsComps` + `_cmVals`) and brought up to the
// Breezy app's version (breezy repo, app/(dashboard)/comps: CompsView,
// CompsResultCompsColumn, AnalyticsOverlay, CompsTable):
//  - left: the subject's photos with "Show analytics" (Sold / Active, four
//    averages, comps as bars) and a map thumbnail, the subject card, and the
//    Home price card ("Lot price estimate" switches to lot size);
//  - right: "n Comps to review", Sold / Active counts, Add comps / Hide excluded /
//    View table, then the Sold and Active cards with their match %, history and an
//    Included switch; excluded comps drop out of every average;
//  - top: n Comps · Average, and Set Your Estimate.
// Comps are real lots (lib/comps.ts); list prices, dates, days on market and
// garages are seeded (compDetail).
import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Listing, fullPrice, shortPrice } from "@/lib/fake";
import { type Comp, compDetail, compPool, compsFor, shortDate } from "@/lib/comps";
import { config, isLiveMap } from "@/lib/config";
import { hashStr } from "@/lib/geo";
import { LOTS } from "@/lib/silverlake";

export const INK = "rgb(18,18,18)", MUTED = "rgb(98,90,89)", SOLD = "rgb(153,92,77)", ACTIVE = "rgb(56,128,104)", GREEN = "rgb(13,87,57)", PURPLE = "rgb(108,72,180)";
export const SPARK = (c: string, s = 11) => <svg width={s} height={s} viewBox="0 0 24 24" fill={c} aria-hidden><path d="M12 0c.8 6.4 5.6 11.2 12 12-6.4.8-11.2 5.6-12 12-.8-6.4-5.6-11.2-12-12C6.4 11.2 11.2 6.4 12 0z" /></svg>;
const k = (n: number) => n.toLocaleString("en-US");
export const avg = (a: number[]) => { const b = a.filter(v => v > 0); return b.length ? b.reduce((s, v) => s + v, 0) / b.length : 0; };
// Estimates the user set, per property, for the session.
export const myEstimates = new Map<string, number>();

function Carousel({ photos, h, radius, children, onClickPhoto }: { photos: string[]; h: number | string; radius: number; children?: React.ReactNode; onClickPhoto?: () => void }) {
  const [i, setI] = useState(0);
  const n = photos.length;
  const go = (d: number) => (e: React.MouseEvent) => { e.stopPropagation(); setI(v => (v + d + n) % n); };
  return (
    <div className="cr-photo" onClick={onClickPhoto} style={{ position: "relative", height: h, borderRadius: radius, overflow: "hidden", background: `rgb(241,231,228) url('${photos[i]}') center/cover no-repeat` }}>
      {n > 1 && <>
        <button className="cr-nav" onClick={go(-1)} aria-label="Previous photo" style={{ ...navBtn, left: 10 }}><i className="ph-bold ph-caret-left" /></button>
        <button className="cr-nav" onClick={go(1)} aria-label="Next photo" style={{ ...navBtn, right: 10 }}><i className="ph-bold ph-caret-right" /></button>
        <span style={{ position: "absolute", left: 0, right: 0, bottom: 12, display: "flex", justifyContent: "center", gap: 5, pointerEvents: "none" }}>
          {photos.map((_, j) => <span key={j} style={{ width: j === i ? 14 : 6, height: 6, borderRadius: 9999, background: j === i ? "rgb(253,252,252)" : "rgba(253,252,252,.6)", transition: "width .2s" }} />)}
        </span>
      </>}
      {children}
    </div>
  );
}
const navBtn: React.CSSProperties = { position: "absolute", top: "50%", transform: "translateY(-50%)", width: 32, height: 32, border: "none", borderRadius: 9999, background: "rgba(253,252,252,.9)", color: INK, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14 };

export function Switch({ on, onClick, label }: { on: boolean; onClick: () => void; label: string }) {
  return (
    <button onClick={onClick} aria-pressed={on} aria-label={label} style={{ position: "relative", flex: "none", width: 46, height: 28, padding: 0, border: "none", borderRadius: 9999, cursor: "pointer", transition: "background .2s", background: on ? INK : "rgb(222,218,215)" }}>
      <span style={{ position: "absolute", top: 3, left: on ? 21 : 3, width: 22, height: 22, borderRadius: 9999, background: "rgb(253,252,252)", boxShadow: "0 1px 3px rgba(0,0,0,.2)", transition: "left .2s cubic-bezier(.2,.8,.2,1)" }} />
    </button>
  );
}

function Cell({ k: label, v, strong, tone }: { k: string; v: React.ReactNode; strong?: boolean; tone?: string }) {
  return (
    <span style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
      <span style={{ font: "400 13px/16px var(--font-sans)", color: MUTED }}>{label}</span>
      <span style={{ font: `${strong ? 700 : 400} 16px/21px var(--font-sans)`, color: tone || INK, whiteSpace: "nowrap" }}>{v}</span>
    </span>
  );
}

export function CompCard({ c, n, of, on, vacant, onToggle, compact }: { c: Comp; n: number; of: number; on: boolean; vacant: boolean; onToggle: () => void; compact?: boolean }) {
  const d = compDetail(c);
  const [hist, setHist] = useState(false);
  const sold = c.st === "S";
  const row: React.CSSProperties = { display: "grid", gridTemplateColumns: "1fr 1fr 64px", gap: 8, padding: "10px 0", boxShadow: "inset 0 -.5px 0 rgba(13,12,12,.12)" };
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12, padding: "6px 6px 14px", borderRadius: 24, background: "rgb(253,252,252)", boxShadow: "inset 0 0 0 1px rgb(236,231,228),0 8px 24px rgba(30,18,12,.05)", transition: "opacity .3s", opacity: on ? 1 : 0.72 }}>
      <div style={{ filter: on ? "none" : "grayscale(1)", transition: "filter .3s" }}>
        <Carousel photos={d.photos} h={compact ? 150 : 210} radius={18}>
          <span style={{ position: "absolute", left: 10, top: 10, display: "flex", alignItems: "center", gap: 5, height: 28, padding: "0 10px", borderRadius: 9999, background: "rgba(253,252,252,.92)", font: "400 13px/16px var(--font-sans)", color: PURPLE }}>{SPARK("currentColor")}{c.score}% Match</span>
        </Carousel>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10, padding: "0 10px" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          <span style={{ font: compact ? "700 17px/22px var(--font-sans)" : "700 19px/24px var(--font-sans)", color: INK }}>{c.addr}</span>
          <span style={{ font: "400 14px/20px var(--font-sans)", color: MUTED }}>
            {vacant ? <><b style={{ color: INK, fontWeight: 400 }}>{k(c.lot)}</b> ft² lot · {c.mi < 0.1 ? "<0.1" : c.mi.toFixed(1)} mi</>
              : <><b style={{ color: INK, fontWeight: 400 }}>{c.beds}</b> bed <b style={{ color: INK, fontWeight: 400 }}>{c.baths}</b> bath <b style={{ color: INK, fontWeight: 400 }}>{k(c.sqft)}</b> ft² <b style={{ color: INK, fontWeight: 400 }}>{k(c.lot)}</b> ft² lot · {c.mi < 0.1 ? "<0.1" : c.mi.toFixed(1)} mi</>}
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          {c.year > 0 && <span style={chip}>Built {c.year}</span>}
          {d.garage > 0 && <span style={chip}><i className="ph ph-car-simple" style={{ fontSize: 14 }} />{d.garage}</span>}
        </div>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ ...row, alignItems: "end" }}>
            <Cell k="listed for" v={fullPrice(d.listed)} />
            <Cell k={sold ? "sold for" : "status"} v={sold ? fullPrice(d.sold!) : "Active"} strong />
            <span style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 4 }}>
              <span style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                <i className={`ph ph-trend-${d.diff < 0 ? "down" : "up"}`} style={{ fontSize: 14, color: MUTED }} />
                <span style={{ font: "400 15px/20px var(--font-sans)", color: d.diff > 0 ? ACTIVE : d.diff < 0 ? SOLD : MUTED }}>{d.diff > 0 ? "+" : ""}{d.diff}%</span>
              </span>
              <button onClick={() => setHist(h => !h)} title="Listing history" style={{ flex: "none", width: 32, height: 32, border: "none", borderRadius: 9999, background: hist ? PURPLE : INK, color: "rgb(253,252,252)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}><i className="ph-bold ph-clock-counter-clockwise" style={{ fontSize: 15 }} /></button>
            </span>
          </div>
          {hist && (
            <div style={{ display: "flex", flexDirection: "column", gap: 6, padding: "10px 12px", margin: "8px 0 2px", borderRadius: 14, background: "rgb(247,246,245)", font: "400 13px/18px var(--font-sans)", color: INK, animation: "fadeIn .2s ease both" }}>
              <span style={{ display: "flex", justifyContent: "space-between" }}><span>Listed</span><span>{shortDate(d.listedOn)} · {fullPrice(d.listed)}</span></span>
              {sold && <span style={{ display: "flex", justifyContent: "space-between" }}><span>Sold</span><span>{shortDate(d.soldOn!)} · {fullPrice(d.sold!)}</span></span>}
              <span style={{ color: MUTED }}>Listing history is sample data until the listings service is connected.</span>
            </div>
          )}
          <div style={row}>
            <Cell k="price per ft²" v={c.sqft ? `$${k(c.ppsf)}` : "—"} />
            <Cell k="per ft² lot" v={d.perLot ? `$${k(d.perLot)}` : "—"} />
            <Cell k="DOM" v={d.dom} />
          </div>
          <div style={{ ...row, boxShadow: "none" }}>
            <Cell k="listed on" v={shortDate(d.listedOn)} />
            <Cell k="sold on" v={d.soldOn ? shortDate(d.soldOn) : "—"} />
            <span />
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, paddingTop: 2 }}>
          <span style={{ flex: "none", width: 12, height: 12, borderRadius: 9999, background: sold ? SOLD : ACTIVE }} />
          <span style={{ flex: 1, minWidth: 0, font: "700 14px/18px var(--font-sans)", color: INK, whiteSpace: "nowrap" }}>{sold ? "Sold" : "Active"} {n} of {of}</span>
          <span style={{ font: "700 13px/16px var(--font-sans)", color: INK }}>{on ? "Included" : "Excluded"}</span>
          <Switch on={on} onClick={onToggle} label={on ? "Exclude this comp" : "Include this comp"} />
        </div>
      </div>
    </div>
  );
}
export const chip: React.CSSProperties = { flex: "none", display: "flex", alignItems: "center", gap: 4, height: 28, padding: "0 10px", borderRadius: 9999, boxShadow: "inset 0 0 0 1px rgba(18,18,18,.18)", font: "400 13px/16px var(--font-sans)", color: INK, whiteSpace: "nowrap" };

/* "Show analytics" (breezy AnalyticsOverlay): Sold / Active, four averages, and the
   comps as bars sorted by the picked average. */
type Metric = "sales" | "home" | "lot" | "dom";
export function Analytics({ sold, active, onHide, embedded }: { sold: Comp[]; active: Comp[]; onHide?: () => void; embedded?: boolean }) {
  const [tab, setTab] = useState<"sold" | "active">("sold");
  const [metric, setMetric] = useState<Metric>("sales");
  const [hover, setHover] = useState(-1);
  const list = tab === "sold" ? sold : active;
  const val = (c: Comp, m: Metric) => { const d = compDetail(c); return m === "sales" ? (d.sold ?? d.listed) : m === "home" ? (c.sqft ? c.ppsf : 0) : m === "lot" ? d.perLot : d.dom; };
  const fmt = (v: number, m: Metric) => m === "sales" ? shortPrice(v) : m === "dom" ? String(Math.round(v)) : `$${k(Math.round(v))}`;
  const tiles: [Metric, string, string][] = [
    ["sales", tab === "sold" ? "Sales" : "Listings", list.length ? shortPrice(avg(list.map(c => val(c, "sales")))) : "—"],
    ["home", "Home", list.length ? `$${k(Math.round(avg(list.map(c => val(c, "home")))))}/ft²` : "—"],
    ["lot", "Lot", list.length ? `$${k(Math.round(avg(list.map(c => val(c, "lot")))))}/ft²` : "—"],
    ["dom", "Days on Market", list.length ? String(Math.round(avg(list.map(c => val(c, "dom"))))) : "—"],
  ];
  const bars = list.map(c => ({ c, v: val(c, metric) })).filter(b => b.v > 0).sort((a, b) => b.v - a.v);
  const max = Math.max(1, ...bars.map(b => b.v)) * 1.15;
  const ticks = [0.25, 0.5, 0.75, 1].map(f => max * f);
  return (
    <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", gap: 14, padding: 20, borderRadius: 24, background: "rgb(253,252,252)", boxShadow: "inset 0 0 0 1px rgb(236,231,228)", animation: "fadeIn .25s ease both" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        {!embedded && <button onClick={onHide} style={{ display: "flex", alignItems: "center", gap: 8, height: 40, padding: "0 16px", border: "none", borderRadius: 9999, background: INK, font: "700 14px/18px var(--font-sans)", color: "rgb(253,252,252)", cursor: "pointer" }}><i className="ph-bold ph-images" style={{ fontSize: 16 }} />Show photos</button>}
        <span style={{ flex: 1 }} />
        <div role="radiogroup" aria-label="Listing status" style={{ display: "flex", gap: 2, padding: 3, borderRadius: 9999, background: "rgba(18,18,18,.06)" }}>
          {(["sold", "active"] as const).map(t => (
            <button key={t} role="radio" aria-checked={tab === t} onClick={() => { setTab(t); setHover(-1); }} style={{ height: 32, padding: "0 14px", border: "none", borderRadius: 9999, cursor: "pointer", font: `${tab === t ? 700 : 400} 13px/16px var(--font-sans)`, color: INK, background: tab === t ? "rgb(253,252,252)" : "none", boxShadow: tab === t ? "0 1px 3px rgba(30,18,12,.14)" : "none" }}>{t === "sold" ? `Sold ${sold.length}` : `Active ${active.length}`}</button>
          ))}
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(120px,1fr))", gap: 8 }}>
        {tiles.map(([id, label, v]) => (
          <button key={id} onClick={() => { setMetric(id); setHover(-1); }} style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 2, padding: "10px 12px", border: "none", borderRadius: 16, cursor: "pointer", textAlign: "left", background: metric === id ? INK : "rgb(247,246,245)", color: metric === id ? "rgb(253,252,252)" : INK }}>
            <span style={{ font: "400 12px/16px var(--font-sans)", opacity: 0.75 }}>Avg. {label}</span>
            <span style={{ font: "400 18px/24px var(--font-sans)", whiteSpace: "nowrap" }}>{v}</span>
          </button>
        ))}
      </div>
      <div style={{ position: "relative", flex: 1, minHeight: 0, display: "flex", gap: 8 }}>
        <div style={{ flex: "none", width: 48, position: "relative" }}>
          {ticks.map(t => <span key={t} style={{ position: "absolute", right: 0, bottom: `calc(${(t / max) * 100}% - 8px)`, font: "400 11px/16px var(--font-sans)", color: MUTED }}>{fmt(t, metric)}</span>)}
        </div>
        <div style={{ position: "relative", flex: 1, display: "flex", alignItems: "flex-end", gap: 6, paddingTop: 8 }} onMouseLeave={() => setHover(-1)}>
          {ticks.map(t => <span key={t} style={{ position: "absolute", left: 0, right: 0, bottom: `${(t / max) * 100}%`, height: 1, background: "rgba(13,12,12,.07)" }} />)}
          {bars.length === 0 && <span style={{ margin: "auto", font: "400 14px/20px var(--font-sans)", color: MUTED }}>No {tab} comps included.</span>}
          {bars.map((b, i) => (
            <span key={b.c.i} onMouseEnter={() => setHover(i)} style={{ position: "relative", flex: "1 1 0", maxWidth: 34, height: `${(b.v / max) * 100}%`, borderRadius: 9999, cursor: "default", transition: "height .35s cubic-bezier(.2,.8,.2,1),background .15s", background: hover === i ? INK : tab === "sold" ? SOLD : ACTIVE, opacity: hover === -1 || hover === i ? 1 : 0.55 }}>
              {hover === i && (
                <span style={{ position: "absolute", left: "50%", bottom: "calc(100% + 8px)", transform: "translateX(-50%)", zIndex: 2, display: "flex", flexDirection: "column", gap: 1, padding: "8px 10px", borderRadius: 12, background: INK, color: "rgb(253,252,252)", whiteSpace: "nowrap", font: "400 12px/16px var(--font-sans)", pointerEvents: "none" }}>
                  <b style={{ font: "700 14px/18px var(--font-sans)" }}>{fmt(b.v, metric)}{metric === "home" || metric === "lot" ? "/ft²" : metric === "dom" ? " days" : ""}</b>{b.c.addr}
                </span>
              )}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

export function Table({ rows, isOn, onToggle }: { rows: { c: Comp; n: number; of: number }[]; isOn: (c: Comp) => boolean; onToggle: (c: Comp) => void }) {
  const th: React.CSSProperties = { position: "sticky", top: 0, padding: "10px 8px", background: "rgb(247,246,245)", font: "700 12px/16px var(--font-sans)", color: MUTED, textAlign: "left", whiteSpace: "nowrap" };
  const td: React.CSSProperties = { padding: "10px 8px", font: "400 14px/19px var(--font-sans)", color: INK, whiteSpace: "nowrap", boxShadow: "inset 0 -.5px 0 rgba(13,12,12,.12)" };
  return (
    <div style={{ overflowX: "auto", borderRadius: 18, boxShadow: "inset 0 0 0 1px rgb(236,231,228)" }}>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead><tr>{["", "Address", "Status", "Price", "$/ft²", "Beds / baths", "ft²", "Lot ft²", "Distance", "DOM", "Match"].map(h => <th key={h} style={th}>{h}</th>)}</tr></thead>
        <tbody>
          {rows.map(({ c }) => {
            const d = compDetail(c), on = isOn(c);
            return (
              <tr key={c.i} style={{ opacity: on ? 1 : 0.5 }}>
                <td style={td}><input type="checkbox" checked={on} onChange={() => onToggle(c)} aria-label={`Include ${c.addr}`} style={{ accentColor: INK, width: 16, height: 16, cursor: "pointer" }} /></td>
                <td style={{ ...td, fontWeight: 700 }}>{c.addr}</td>
                <td style={td}><span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><span style={{ width: 9, height: 9, borderRadius: 9999, background: c.st === "S" ? SOLD : ACTIVE }} />{c.st === "S" ? `Sold ${c.sm || ""} mo ago` : "Active"}</span></td>
                <td style={td}>{fullPrice(d.sold ?? d.listed)}</td>
                <td style={td}>{c.sqft ? `$${k(c.ppsf)}` : "—"}</td>
                <td style={td}>{c.beds} / {c.baths}</td>
                <td style={td}>{k(c.sqft)}</td>
                <td style={td}>{k(c.lot)}</td>
                <td style={td}>{c.mi < 0.1 ? "<0.1" : c.mi.toFixed(1)} mi</td>
                <td style={td}>{d.dom}</td>
                <td style={{ ...td, color: PURPLE }}>{c.score}%</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/* Progressive disclosure (review): no loading screen. The subject and its estimate show
   at once; the comps then arrive one by one, each fading in with a slight lift, as if
   estimated in turn. `reveal` plays it (first run); a report that has run opens whole. */
const REVEAL_MS = 420;
export function CompsReport({ l, reveal = false }: { l: Listing; reveal?: boolean }) {
  const base = useMemo(() => compsFor(l), [l]);
  const pool = useMemo(() => compPool(l), [l]);
  const [added, setAdded] = useState<Comp[]>([]);
  const [excl, setExcl] = useState<Set<number>>(new Set());
  const [hideExcl, setHideExcl] = useState(false);
  const [table, setTable] = useState(false);
  const [analytics, setAnalytics] = useState(false);
  const [mapView, setMapView] = useState(false);
  const [byLot, setByLot] = useState(false);
  const [adding, setAdding] = useState(false);
  const [estOpen, setEstOpen] = useState(false);
  const key = `${l.id}|${l.addr}`;
  const [mine, setMine] = useState<number | undefined>(() => myEstimates.get(key));
  const vacant = !(l.sqft > 0);
  const lotFt = Math.round(l.lotAc * 43560);

  const sold = [...base.sold, ...added.filter(c => c.st === "S")];
  const active = [...base.active, ...added.filter(c => c.st === "L")];
  const isOn = (c: Comp) => !excl.has(c.i);
  const toggle = (c: Comp) => setExcl(s => { const n = new Set(s); if (n.has(c.i)) n.delete(c.i); else n.add(c.i); return n; });
  const incSold = sold.filter(isOn), incAll = [...incSold, ...active.filter(isOn)];
  // Home price: the included sold comps' average $/ft² × the subject's size (or lot $/ft² × lot).
  const homePsf = avg(incSold.filter(c => c.sqft > 0).map(c => c.ppsf)), lotPsf = avg(incSold.map(c => compDetail(c).perLot));
  const lotMode = byLot || vacant;
  const homePrice = lotMode ? lotPsf * lotFt : homePsf * l.sqft;
  const average = avg(incAll.map(c => compDetail(c).sold ?? compDetail(c).listed));
  const candidates = [...pool.sold, ...pool.active].filter(c => ![...sold, ...active].some(x => x.i === c.i)).slice(0, 8);

  const total = sold.length + active.length;
  const [ready, setReady] = useState(reveal ? 0 : Infinity);
  useEffect(() => {
    if (ready >= total) return;
    const t = setTimeout(() => setReady(n => n + 1), ready === 0 ? 650 : REVEAL_MS);
    return () => clearTimeout(t);
  }, [ready, total]);
  const loading = ready < total;
  const order = [...sold, ...active].map(c => c.i);
  const isReady = (c: Comp) => order.indexOf(c.i) < ready;
  const shown = (list: Comp[]) => list.map((c, j) => ({ c, n: j + 1, of: list.length })).filter(x => (!hideExcl || isOn(x.c)) && isReady(x.c));
  const R = hashStr("last-sold:" + key);
  const lastSold = shortDate(new Date(2008 + (R % 16), (R >> 4) % 12, 1 + ((R >> 8) % 27)));
  const city = (l.city || "Los Angeles").split(",")[0];
  const staticMap = (w: number, h: number, pins: boolean) => {
    if (!isLiveMap()) return null;
    const overlays = [`pin-l-home+121212(${l.lng},${l.lat})`, ...(pins ? [...incSold.slice(0, 12).map(c => `pin-s+995C4D(${LOT(c)})`), ...active.filter(isOn).slice(0, 6).map(c => `pin-s+388068(${LOT(c)})`)] : [])];
    return `https://api.mapbox.com/styles/v1/mapbox/light-v11/static/${overlays.join(",")}/${pins ? "auto" : `${l.lng},${l.lat},15`}/${w}x${h}@2x?${pins ? "padding=60&" : ""}access_token=${config.mapboxToken}&attribution=false&logo=false`;
  };
  const thumb = staticMap(64, 64, false), bigMap = staticMap(640, 400, true);

  return (
    <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", animation: "flowRise .6s cubic-bezier(.2,.8,.2,1) both" }}>
      <style>{`.cr-nav{opacity:0;transition:opacity .15s}.cr-photo:hover .cr-nav{opacity:1}.cr-act:hover{background:rgb(228,225,223)!important}
@keyframes crIn{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:none}}.cr-in{animation:crIn .55s cubic-bezier(.2,.8,.2,1) both}
@keyframes crShim{from{background-position:120% 0}to{background-position:-20% 0}}.cr-skel{background:linear-gradient(100deg,rgb(244,241,239) 30%,rgb(250,248,247) 50%,rgb(244,241,239) 70%) 0 0/250% 100%;animation:crShim 1.4s linear infinite}`}</style>
      <div style={{ flex: 1, minHeight: 0, display: "flex", gap: 20, padding: "16px 12px 0 24px" }}>
        {/* Left: subject */}
        <div className="no-scrollbar" style={{ flex: "1 1 0", minWidth: 540, maxWidth: 720, display: "flex", flexDirection: "column", gap: 12, overflowY: "auto", paddingBottom: 16 }}>
          <div style={{ position: "relative", flex: "none", height: 420 }}>
            {analytics ? <Analytics sold={incSold} active={active.filter(isOn)} onHide={() => setAnalytics(false)} />
              : mapView && bigMap ? (
                <div style={{ position: "relative", height: "100%", borderRadius: 24, overflow: "hidden", background: `rgb(240,236,232) url('${bigMap}') center/cover` }}>
                  <button onClick={() => setMapView(false)} style={pillDark}><i className="ph-bold ph-images" style={{ fontSize: 16 }} />Show photos</button>
                  <span style={{ position: "absolute", left: 16, bottom: 16, display: "flex", gap: 14, padding: "8px 12px", borderRadius: 9999, background: "rgba(253,252,252,.92)", font: "400 13px/16px var(--font-sans)" }}>
                    <span style={{ display: "flex", alignItems: "center", gap: 6 }}><span style={{ width: 10, height: 10, borderRadius: 9999, background: SOLD }} />Sold</span>
                    <span style={{ display: "flex", alignItems: "center", gap: 6 }}><span style={{ width: 10, height: 10, borderRadius: 9999, background: ACTIVE }} />Active</span>
                  </span>
                </div>
              ) : (
                <Carousel photos={l.photos} h="100%" radius={24}>
                  <button onClick={e => { e.stopPropagation(); setAnalytics(true); }} style={pillDark}><i className="ph-bold ph-chart-bar" style={{ fontSize: 16 }} />Show analytics</button>
                  {thumb && <button onClick={e => { e.stopPropagation(); setMapView(true); }} title="Show the comps on a map" style={{ position: "absolute", left: 18, bottom: 18, width: 64, height: 64, padding: 0, border: "none", borderRadius: 12, cursor: "pointer", background: `rgb(240,236,232) url('${thumb}') center/cover`, boxShadow: "0 0 0 2px rgb(253,252,252)" }} />}
                  <span style={{ position: "absolute", right: 16, bottom: 16, height: 28, padding: "0 10px", borderRadius: 9999, background: "rgba(18,18,18,.6)", font: "400 13px/28px var(--font-sans)", color: "rgb(253,252,252)" }}>{l.photos.length} photos</span>
                </Carousel>
              )}
          </div>
          <div style={{ flex: "none", display: "flex", gap: 12 }}>
            <div style={{ flex: "1 1 0", minWidth: 0, display: "flex", flexDirection: "column", gap: 14, padding: "20px 24px" }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <span style={{ font: "400 14px/18px var(--font-sans)", color: INK }}>{city}</span>
                <span style={{ font: "300 28px/1.2 var(--font-sans)", letterSpacing: "-.4px", color: INK }}>{l.addr}</span>
              </div>
              <div style={{ display: "flex", gap: 28 }}>
                {[[l.beds, "bed"], [l.baths, "bath"], [k(l.sqft), "ft²"], [k(lotFt), "ft² lot"]].map(([v, t]) => (
                  <span key={t} style={{ display: "flex", flexDirection: "column", gap: 2 }}><span style={{ font: "400 22px/26px var(--font-sans)", color: INK }}>{v}</span><span style={{ font: "400 14px/18px var(--font-sans)", color: MUTED }}>{t}</span></span>
                ))}
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {l.built > 0 && <span style={chip}>Built {l.built}</span>}
                {l.feats.slice(0, 4).map(f => <span key={f} style={chip}>{SPARK("rgb(120,82,196)", 10)}{f}</span>)}
              </div>
              <div style={{ display: "flex", gap: 24, paddingTop: 4 }}>
                <span style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 2 }}><span style={{ font: "400 13px/16px var(--font-sans)", color: MUTED }}>Owner</span><span style={{ font: "400 16px/21px var(--font-sans)", color: INK, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{l.owner.name}</span></span>
                <span style={{ width: 1, background: "rgba(13,12,12,.12)" }} />
                <span style={{ flex: 1, display: "flex", flexDirection: "column", gap: 2 }}><span style={{ font: "400 13px/16px var(--font-sans)", color: MUTED }}>Last sold</span><span style={{ font: "400 16px/21px var(--font-sans)", color: INK }}>{lastSold}</span></span>
              </div>
            </div>
            <div style={{ flex: "none", width: 236, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16, padding: "20px 16px", boxSizing: "border-box", borderRadius: 24, background: "rgb(240,237,235)", textAlign: "center" }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <span style={{ font: "700 14px/18px var(--font-sans)", color: INK }}>{mine ? "Your estimate" : lotMode ? "Lot price" : "Home price"}</span>
                <span style={{ font: "400 13px/17px var(--font-sans)", color: INK, textWrap: "balance" } as React.CSSProperties}>{mine ? "Set by you. Comps and averages stay as they are." : lotMode ? "Based on lot size averages from selected comps" : "Based on home size averages from selected comps"}</span>
              </div>
              <span style={{ font: "300 40px/1 var(--font-sans)", letterSpacing: "-.02em", color: GREEN }}>{mine ? fullPrice(mine) : homePrice > 0 ? fullPrice(Math.round(homePrice / 1000) * 1000) : "—"}</span>
              {!vacant && !mine && (
                <button className="btn-soft" onClick={() => setByLot(v => !v)} style={{ height: 44, padding: "0 18px", gap: 8, font: "700 15px/20px var(--font-sans)" }}>
                  <i className="ph-bold ph-arrows-left-right" style={{ fontSize: 16 }} />{byLot ? "Home price estimate" : "Lot price estimate"}
                </button>
              )}
              {mine && <button className="btn-soft" onClick={() => { myEstimates.delete(key); setMine(undefined); }} style={{ height: 44, padding: "0 18px", font: "700 15px/20px var(--font-sans)" }}>Use comps estimate</button>}
              <button onClick={() => setEstOpen(true)} style={{ height: 32, padding: "0 4px", border: "none", background: "none", font: "700 14px/18px var(--font-sans)", color: INK, textDecoration: "underline", textUnderlineOffset: 3, cursor: "pointer" }}>{mine ? "Edit your estimate" : "Set your estimate"}</button>
            </div>
          </div>
        </div>

        {/* Right: the comps */}
        <div style={{ flex: "1 1 0", minWidth: 340, overflowY: "auto", display: "flex", flexDirection: "column", gap: 20, padding: "8px 12px 32px", scrollbarWidth: "thin" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <span style={{ font: "400 30px/36px var(--font-sans)", letterSpacing: "-.02em", color: INK }}>{loading ? <>Estimating comps <span style={{ color: MUTED }}>{Math.min(ready, total)} of {total}</span></> : `${total} Comps to review`}</span>
            <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "6px 20px" }}>
              {[[`${sold.filter(isReady).length} Sold`, SOLD], [`${active.filter(isReady).length} Active`, ACTIVE]].map(([t, c]) => <span key={t} style={{ display: "flex", alignItems: "center", gap: 8, font: "400 17px/22px var(--font-sans)", color: INK }}><span style={{ width: 10, height: 10, borderRadius: 9999, background: c }} />{t}</span>)}
              {!loading && average > 0 && <span style={{ font: "400 17px/22px var(--font-sans)", color: INK }}>Average <b style={{ color: GREEN }}>{fullPrice(Math.round(average / 1000) * 1000)}</b></span>}
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3,minmax(0,1fr))", gap: 10 }}>
            {([["Add comps", "plus-circle", () => setAdding(true), false], [hideExcl ? "Show excluded" : "Hide excluded", "eye-closed", () => setHideExcl(v => !v), hideExcl], [table ? "View cards" : "View table", "table", () => setTable(v => !v), table]] as [string, string, () => void, boolean][]).map(([t, ic, fn, on]) => (
              <button key={ic} onClick={fn} className={on ? undefined : "cr-act"} style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, height: 52, border: "none", borderRadius: 9999, background: on ? INK : "rgb(236,234,233)", font: "700 16px/20px var(--font-sans)", color: on ? "rgb(253,252,252)" : INK, cursor: "pointer", whiteSpace: "nowrap" }}>
                <i className={`ph-bold ph-${ic}`} style={{ fontSize: 17 }} />{t}
              </button>
            ))}
          </div>
          {loading && ready === 0 && <div className="cr-skel" style={{ height: 520, borderRadius: 24 }} />}
          {table
            ? <Table rows={[...shown(sold), ...shown(active)]} isOn={isOn} onToggle={toggle} />
            : ([["S", sold, SOLD, "Sold"], ["L", active, ACTIVE, "Active"]] as [string, Comp[], string, string][]).map(([st, list, color, label]) => list.some(isReady) && (
              <div key={st} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 16, padding: "8px 0" }}>
                  <span style={{ flex: 1, height: 1, background: "rgba(13,12,12,.1)" }} />
                  <span className="cr-in" style={{ height: 40, padding: "0 20px", borderRadius: 9999, background: color, font: "700 16px/40px var(--font-sans)", color: "rgb(253,252,252)" }}>{list.filter(isReady).length} {label}</span>
                  <span style={{ flex: 1, height: 1, background: "rgba(13,12,12,.1)" }} />
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(300px,1fr))", gap: 14 }}>
                  {shown(list).map(({ c, n, of }) => <div key={c.i} className="cr-in"><CompCard c={c} n={n} of={of} on={isOn(c)} vacant={vacant} onToggle={() => toggle(c)} /></div>)}
                  {/* the next comp being estimated */}
                  {loading && list.some(c => !isReady(c)) && list.some(isReady) && <div className="cr-skel" style={{ height: 520, borderRadius: 24 }} />}
                </div>
              </div>
            ))}
          <span style={{ font: "400 12px/17px var(--font-sans)", color: MUTED }}>Comps are real nearby homes (address, size, beds, baths, lot, year, $/ft², distance, month sold). Prices are value estimates; list prices, dates, days on market and garages are sample data until the listings service is connected.</span>
        </div>
      </div>

      {adding && (
        <Modal title="Add comps" onClose={() => setAdding(false)}>
          <span style={{ font: "400 14px/20px var(--font-sans)", color: MUTED }}>The next closest matches nearby.</span>
          <div style={{ display: "flex", flexDirection: "column", maxHeight: 380, overflowY: "auto" }}>
            {candidates.length === 0 && <span style={{ padding: "16px 0", color: MUTED }}>No more comps nearby.</span>}
            {candidates.map(c => (
              <div key={c.i} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 0", boxShadow: "inset 0 -.5px 0 rgba(13,12,12,.12)" }}>
                <span style={{ flex: "none", width: 48, height: 48, borderRadius: 10, background: `url('${c.photo}') center/cover` }} />
                <span style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
                  <span style={{ font: "700 15px/20px var(--font-sans)" }}>{c.addr}</span>
                  <span style={{ font: "400 13px/18px var(--font-sans)", color: MUTED }}>{c.st === "S" ? "Sold" : "Active"} · {shortPrice(c.price)} · {k(c.sqft)} ft² · {c.mi.toFixed(1)} mi · {c.score}% match</span>
                </span>
                <button className="btn-soft" onClick={() => setAdded(a => [...a, c])} style={{ height: 36, padding: "0 14px", font: "700 13px/16px var(--font-sans)" }}>Add</button>
              </div>
            ))}
          </div>
        </Modal>
      )}
      {estOpen && <EstimateModal start={mine ?? Math.round((homePrice || l.qe.value) / 1000) * 1000} lo={Math.round(l.qe.lo * 0.8 / 1000) * 1000} hi={Math.round(l.qe.hi * 1.25 / 1000) * 1000} onClose={() => setEstOpen(false)} onSave={v => { myEstimates.set(key, v); setMine(v); setEstOpen(false); }} />}
    </div>
  );
}
const LOT = (c: Comp) => { const lt = compLatLng(c); return `${lt[0]},${lt[1]}`; };
const compLatLng = (c: Comp) => LOTS[c.i].c;
const pillDark: React.CSSProperties = { position: "absolute", left: 16, top: 16, display: "flex", alignItems: "center", gap: 8, height: 40, padding: "0 16px", border: "none", borderRadius: 9999, background: INK, font: "700 14px/18px var(--font-sans)", color: "rgb(253,252,252)", cursor: "pointer" };

export function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  // Escape closes this dialog, not the whole report sheet (capture phase, claimed).
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); onClose(); } };
    window.addEventListener("keydown", k, true);
    return () => window.removeEventListener("keydown", k, true);
  }, [onClose]);
  // Portalled to <body>: the report's entry animation leaves a transform on its
  // ancestors, which would make `fixed` relative to the sheet instead of the screen.
  return createPortal(
    <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 400, background: "rgba(23,17,16,.28)", display: "flex", alignItems: "center", justifyContent: "center", animation: "fadeIn .2s ease both" }}>
      <div onClick={e => e.stopPropagation()} style={{ width: 480, maxWidth: "calc(100% - 32px)", display: "flex", flexDirection: "column", gap: 12, padding: 24, borderRadius: 28, background: "rgb(253,252,252)", boxShadow: "0 24px 60px rgba(30,18,12,.22)", animation: "riseIn .26s cubic-bezier(.2,.8,.2,1) both" }}>
        <div style={{ display: "flex", alignItems: "center" }}>
          <span style={{ flex: 1, font: "300 26px/1.2 var(--font-sans)", letterSpacing: "-.4px" }}>{title}</span>
          <button onClick={onClose} aria-label="Close" className="btn-ghost" style={{ width: 36, height: 36, display: "flex", alignItems: "center", justifyContent: "center" }}><i className="ph-bold ph-x" /></button>
        </div>
        {children}
      </div>
    </div>,
    document.body,
  );
}

export function EstimateModal({ start, lo, hi, onClose, onSave }: { start: number; lo: number; hi: number; onClose: () => void; onSave: (v: number) => void }) {
  const [v, setV] = useState(start);
  return (
    <Modal title="Set your estimate" onClose={onClose}>
      <span style={{ font: "400 14px/20px var(--font-sans)", color: MUTED }}>Your own value for this home, next to what the comps say.</span>
      <span style={{ font: "300 44px/1.1 var(--font-sans)", color: GREEN, textAlign: "center", padding: "8px 0" }}>{fullPrice(v)}</span>
      <input type="range" min={lo} max={hi} step={1000} value={v} onChange={e => setV(+e.target.value)} style={{ width: "100%", accentColor: INK }} aria-label="Estimate" />
      <div style={{ display: "flex", justifyContent: "space-between", font: "400 12px/16px var(--font-sans)", color: MUTED }}><span>{shortPrice(lo)}</span><span>{shortPrice(hi)}</span></div>
      <div style={{ display: "flex", gap: 10, paddingTop: 8 }}>
        <button className="btn-soft" onClick={onClose} style={{ flex: 1, height: 48 }}>Cancel</button>
        <button onClick={() => onSave(v)} style={{ flex: 1, height: 48, border: "none", borderRadius: 9999, background: INK, font: "700 15px/20px var(--font-sans)", color: "rgb(253,252,252)", cursor: "pointer" }}>Save estimate</button>
      </div>
    </Modal>
  );
}
