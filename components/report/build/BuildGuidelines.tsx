"use client";
// Build guidelines tab (Figma Project Nimbus (Core) › "Build Guidelines · Cases (desktop)"
// 6032:30599, rules in "Build guidelines · Scenario matrix" 7872:5910). Replaces the
// recorded Underbuilt report: the property panel on the left (as on the ROI page), then
//   hero: "This property has {band} build potential" + the Underbuilt ring, or, without a
//         max build, the case's title and line;
//   callouts: Verified (Tier 1) or AI Score (Tier 2), terrain (slope), "What this score is
//         based on" (SFR score), multiple code regulations; the opt-in callouts of the cases
//         without a max build;
//   tiles: Existing / Addition & Remodel / Teardown & Rebuild, each with Get Comps;
//   the lot map; the Build Guidelines card (summary, then one row per rule, View Details).
// Every Get Comps starts the detail panel's Get comps. A scenario switcher (prototype
// tool) steps through every case; /home?report=ub&scenario=<id> opens one.
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { Listing } from "@/lib/fake";
import { LAMC_URL, ZIMAS_URL } from "@/lib/zoning/la";
import { PropertyPanel } from "../upside/PropertyPanel";
import { ScenarioBar } from "../upside/ScenarioBar";
import { useAiWrite } from "../aiWrite";
import "../upside.css";
import "../upside-scenarios.css";
import "../report-tabs.css";
import { LotPlan } from "./LotPlan";
import {
  BASIS_NAME, BASIS_WHY, BAND_WORD, BG_SCENARIOS, CITY_URL, JURISDICTION, PERMITS_URL,
  analyse, bgScenario, noMaxCopy, subline, type Bg, type Tile,
} from "./scenarios";

const SCEN_KEY = "bz-bg-scenario";
function initialScenario(): string {
  if (typeof window === "undefined") return "live";
  const q = new URLSearchParams(window.location.search);
  const s = q.get("scenario");
  if (q.get("report") === "ub" && s && bgScenario(s).id === s) return s;
  try { const v = sessionStorage.getItem(SCEN_KEY); return v && bgScenario(v).id === v ? v : "live"; } catch { return "live"; }
}
const f = (n: number) => Math.round(n).toLocaleString("en-US");
const Ft = () => <span className="u">ft<sup>2</sup></span>;

export function BuildGuidelines({ l, onComps, write, onToast }: {
  l: Listing; onComps: () => void; write?: boolean;
  onToast?: (text: string, tone?: "positive" | "neutral" | "negative") => void;
}) {
  const [scenId, setScenId] = useState(initialScenario);
  const def = bgScenario(scenId);
  const b = useMemo(() => analyse(l, def), [l, def]);
  const [modal, setModal] = useState(!!def.modal);
  const [notified, setNotified] = useState(false);
  const [detail, setDetail] = useState<Rule | null>(null);
  const scroller = useRef<HTMLDivElement>(null);
  useAiWrite(scroller, scroller, !!write, true);
  const choose = (id: string) => {
    const d = bgScenario(id);
    setScenId(d.id);
    try { sessionStorage.setItem(SCEN_KEY, d.id); } catch {}
    setModal(!!d.modal); setNotified(false); setDetail(null);
    scroller.current?.scrollTo({ top: 0 });
  };
  const shown = b.kase === "nolot" ? { ...l, lotAc: 0 } : l;
  const sonar = b.kase === "sonar";

  return (
    <div className="bz-up bz-bg" style={{ position: "relative", flex: 1, minHeight: 0, display: "flex" }}>
      <aside className="bz-up-left" aria-label="Property"><PropertyPanel l={shown} /></aside>
      <div className="bz-up-col">
        <div ref={scroller} className="rp-main no-scrollbar" style={{ overflowY: "auto", overscrollBehavior: "contain" }}>
          <div className="bg-page">
            {sonar ? <Sonar onChat={() => onToast?.("Chat with our team · a teammate will reply here in a few minutes", "neutral")} />
              : b.hasMax ? <Hero b={b} /> : <NoMax b={b} notified={notified} onNotify={() => { setNotified(true); onToast?.("We’ll let you know when it’s available", "positive"); }} />}
            {b.hasMax && <Callouts b={b} />}
            {b.hasMax && b.kase === "multi" && (
              <div className="bg-basis">
                <h3>Score based on: {BASIS_NAME[b.def.basis ?? "coverage"]}</h3>
                <p>{BASIS_WHY[b.def.basis ?? "coverage"]}</p>
              </div>
            )}
            {b.hasMax && <Tiles tiles={b.tiles} onComps={onComps} />}
            {b.other && (
              <>
                <div className="bg-basis other"><h3>Other scenario based on: {BASIS_NAME[b.other.basis]}</h3></div>
                <Tiles tiles={b.other.tiles} onComps={onComps} offset />
              </>
            )}
            <div className="bg-sec">
              <LotPlan l={l} lotFt={b.lot} lotW={b.site.lotW} lotD={b.site.lotD} buildable={b.hasMax ? b.Smax : b.site.Smax}
                house={b.kase !== "vacant"} slope={b.kase === "slope"} satellite={b.kase === "satellite" || b.kase === "vacant"} setbacks={b.zone.yards} />
            </div>
            {!sonar && <Guidelines b={b} onDetail={setDetail} />}
          </div>
        </div>
        <ScenarioBar id={scenId} onChange={choose} list={BG_SCENARIOS} title="Build guidelines scenarios" matrix="7872-5910" />
      </div>
      {modal && b.other && <MultiModal b={b} onClose={() => setModal(false)} />}
      {detail && <RuleModal r={detail} zone={b.zone.code} onClose={() => setDetail(null)} />}
    </div>
  );
}

/* ---------------- hero ---------------- */

function Hero({ b }: { b: Bg }) {
  const band = BAND_WORD[b.band];
  return (
    <section className="bg-hero">
      <div className="left">
        <h1>{b.band === "max"
          ? <>This property has reached its <b>maximum build potential</b></>
          : <>This property has <b>{band} build potential</b></>}</h1>
        <p>{subline(b)}</p>
      </div>
      <Ring v={b.ub} />
    </section>
  );
}

function Ring({ v }: { v: number }) {
  const [tip, setTip] = useState(false);
  const r = 70, c = 2 * Math.PI * r, k = Math.max(0, Math.min(1, v / 100));
  return (
    <div className="bg-ring">
      <div className="chart">
        <svg viewBox="0 0 157 157" aria-hidden="true">
          <defs>
            <linearGradient id="bg-ring-g" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="#E7D3CD" /><stop offset=".55" stopColor="#C2A69F" /><stop offset="1" stopColor="#9C7E76" />
            </linearGradient>
          </defs>
          <circle cx="78.5" cy="78.5" r={r} fill="none" stroke="#EDE6E3" strokeWidth="7" />
          {k > 0 && <circle cx="78.5" cy="78.5" r={r} fill="none" stroke="url(#bg-ring-g)" strokeWidth="7" strokeLinecap="round"
            strokeDasharray={`${c * k} ${c}`} transform="rotate(-90 78.5 78.5)" />}
        </svg>
        <span className="v">{v}<sup>%</sup></span>
      </div>
      <span className="lb">
        <b>Underbuilt</b>
        <button type="button" aria-label="What Underbuilt means" aria-expanded={tip} onClick={() => setTip(t => !t)} onBlur={() => setTip(false)}>
          <img src="/ub2/info.svg" alt="" width={16} height={16} />
        </button>
        {tip && <span className="tip" role="tooltip">The share of what the city allows on this lot that isn’t built yet. 0% means the home is already as big as the zoning allows.</span>}
      </span>
    </div>
  );
}

function Callouts({ b }: { b: Bg }) {
  return (
    <div className="bg-callouts">
      {b.tier === 1 ? (
        <div className="bg-verified">
          <span className="k"><img src="/ub2/verified.svg" alt="" width={14} height={14} />Verified</span>
          <span>Our team of architects have reviewed and verified this data</span>
        </div>
      ) : (
        <div className="bg-ai">
          <span className="k"><img src="/ub2/ai.svg" alt="" width={14} height={14} />AI Score</span>
          <span>Our architects have guided the AI, but AI can make mistakes. Always verify with a zoning expert or architect.</span>
        </div>
      )}
      {b.kase === "slope" && (
        <div className="bg-note"><b>Terrain analysis required</b><span>The slope of the lot determines the maximum home size. Breezy has used highly accurate terrain data for the estimate shown.</span></div>
      )}
      {b.kase === "sfr" && (
        <div className="bg-note"><b>What this score is based on</b><span>This score shows the potential if the {b.ptype} were rebuilt as a single-family home.</span></div>
      )}
      {b.kase === "multi" && (
        <div className="bg-note"><b>We found multiple code regulations</b><span>Two zoning rules apply here with different limits. As a general rule, plan around the more restrictive scenario, it’s the safer basis for any development decision.</span></div>
      )}
    </div>
  );
}

function Tiles({ tiles, onComps, offset }: { tiles: Tile[]; onComps: () => void; offset?: boolean }) {
  return (
    <div className={`bg-tiles n${tiles.length}${offset ? " offset" : ""}`}>
      {offset && <div aria-hidden="true" />}
      {tiles.map(t => (
        <div key={t.title} className="tile">
          <p className="big">{f(t.size)}<Ft /></p>
          <p className="t">{t.title}</p>
          <p className="d">{t.line}</p>
          <button type="button" className="gc" onClick={onComps}>Get Comps<img src="/ub2/arrow.svg" alt="" width={16} height={16} /></button>
        </div>
      ))}
    </div>
  );
}

/* ---------------- without a max build ---------------- */

function NoMax({ b, notified, onNotify }: { b: Bg; notified: boolean; onNotify: () => void }) {
  const { title, sub } = noMaxCopy(b);
  const notify = (
    <button type="button" className="bg-btn" onClick={onNotify} disabled={notified}>
      <img src="/ub2/bell.svg" alt="" width={20} height={20} />{notified ? "We’ll let you know" : b.kase === "unsup-type" ? "Get updates" : "Get notified"}
    </button>
  );
  const zoneTag = <span className="ztag">Zone: {b.zone.code}</span>;
  let call: React.ReactNode;
  switch (b.kase) {
    case "nozone":
      call = <><p className="t">Confirm the zoning with {JURISDICTION}</p><a className="bg-btn" href={PERMITS_URL} target="_blank" rel="noreferrer">Visit {JURISDICTION} Permits <span aria-hidden="true">↗</span></a></>;
      break;
    case "nozone-confirmed": case "unsup-zone":
      call = <><p className="t">For more information, support@breezy.com</p><a className="bg-btn" href={CITY_URL} target="_blank" rel="noreferrer">View City Website <span aria-hidden="true">→</span></a></>;
      break;
    case "unsup-type":
      call = <><div className="txt">{zoneTag}<b>Max build scoring for a {b.ptype} is still being developed. Get notified once it’s available.</b><span>A summary is available below.</span></div>{notify}</>;
      break;
    case "nolot":
      call = <><div className="txt">{zoneTag}<b>Lot size isn’t available for this property</b><span>Get notified when we have the lot size and can calculate max build.</span></div>{notify}</>;
      break;
    default:
      call = <><div className="txt">{zoneTag}<b>Reports for {b.zone.code} properties are not available</b><span>Be the first to know when we add this zone.</span></div>{notify}</>;
  }
  return (
    <>
      <section className="bg-hero plain">
        <div className="left"><h1>{title}</h1><p>{sub}</p></div>
      </section>
      <div className="bg-optin">{call}</div>
    </>
  );
}

function Sonar({ onChat }: { onChat: () => void }) {
  return (
    <section className="bg-sonar">
      <img src="/iso/empty-search.png" alt="" width={96} height={96} />
      <h2>Max build isn’t available yet</h2>
      <p>This zone is currently under review. Email <a href="mailto:support@breezy.com">support@breezy.com</a> or chat with our team.</p>
      <button type="button" onClick={onChat}><i className="ph ph-chats-circle" aria-hidden="true" />Live chat</button>
    </section>
  );
}

/* ---------------- the Build Guidelines card ---------------- */

type Rule = { key: string; icon: string; name: string; rows: { v?: React.ReactNode; h?: string; t: string }[]; cite?: string; more: string };

function rulesOf(b: Bg): Rule[] {
  const z = b.zone, { F, Sd, Rr } = z.yards;
  const acres = (b.lot / 43560).toFixed(2);
  const missingLot = b.kase === "nolot";
  const multi = z.cls !== "R1";
  const park = (z.parking.match(/^\d+/) || ["2"])[0];
  return [
    { key: "lot", icon: "lot", name: "Lot Size", cite: "LA County Assessor",
      rows: [{ v: missingLot ? "—" : <>{f(b.lot)}<Ft /></>, t: missingLot ? "Lot size isn’t available for this property yet" : `(${acres} acres)` }],
      more: missingLot ? "The assessor’s record for this parcel has no lot area, so the rules that depend on it (floor area, density) can’t be worked out yet." : `The lot area on the LA County assessor’s record: ${f(b.lot)} ft², about ${b.site.lotW} ft wide by ${b.site.lotD} ft deep.` },
    { key: "home", icon: "home", name: "Max Home Size", cite: z.farCite,
      rows: [{ v: z.cls === "R1" ? "0.45" : "3:1", t: `${z.farLabel}${b.hasMax ? `, about ${f(b.Smax)} ft² on this lot` : ""}. Floor area is measured to the outside of the walls.` }],
      more: z.cls === "R1" ? "In the R1 zone, a home’s residential floor area can be at most 45% of the lot area (the Baseline Mansionization Ordinance). Covered parking, porches and some basement space are partly exempt." : "Floor area is capped at three times the buildable area of the lot (Height District 1). The parcel’s Q or D conditions can lower it." },
    { key: "height", icon: "height", name: "Max Height", cite: z.heightCite,
      rows: [{ v: z.height ? <>{z.height}<span className="u">ft</span></> : "—", t: z.height ? (z.flat !== z.height ? `(${z.flat} ft with a flat roof)` : `(${z.stories.toLowerCase()})`) : "No height limit in Height District 1" }],
      more: z.heightRule },
    { key: "stories", icon: "stories", name: "Max Stories", cite: z.heightCite,
      rows: [{ v: z.stories.match(/\d/) ? z.stories.match(/\d+/)![0] : "—", t: `${z.stories} in ${z.code} (${z.heightCite}). Verify with the city for hillside and overlay limits.` }],
      more: z.cls === "R1" ? "The R1 zone limits height, not the number of stories; two stories fit under 33 ft. Hillside areas add their own limits." : z.heightRule },
    { key: "setbacks", icon: "setbacks", name: "Setbacks", cite: z.yardCite,
      rows: [
        { v: <>{F}<span className="u">ft</span></>, h: "Front", t: `minimum for ${z.code} lots (${z.yardCite}). Verify with the city for your exact lot dimensions.` },
        { v: <>{Sd}<span className="u">ft</span></>, h: "Sides", t: `minimum for ${z.code} lots (${z.yardCite}), plus 1 ft for each storey above the second.` },
        { v: <>{Rr}<span className="u">ft</span></>, h: "Rear", t: `minimum for ${z.code} lots (${z.yardCite}). ADUs can sit 4 ft from the side and rear lines.` },
      ],
      more: `Front ${F} ft, sides ${Sd} ft, rear ${Rr} ft in ${z.code}. Corner lots and lots on a prevailing setback street can need more in front.` },
    { key: "parking", icon: "parking", name: "Parking Required", cite: "§12.21 A.4",
      rows: [{ v: park, t: `${z.parking}${multi ? "" : " for the home"}. None for an ADU within half a mile of transit (AB 2097).` }],
      more: "Covered spaces for the main home; state law (AB 2097) removes parking minimums within half a mile of major transit." },
    { key: "adu", icon: "adu", name: "ADU Allowed", cite: "§12.22 A.33",
      rows: [{ v: <span className="yes">Yes<img src="/ub2/check.svg" alt="" width={20} height={20} /></span>, t: "up to 1,200 ft² detached, with 4 ft side and rear setbacks, plus a junior ADU inside the house (state ADU law)." }],
      more: "California ADU law allows one ADU and one junior ADU on a single-family lot by right, approved in 60 days, whatever the local floor-area limits." },
    { key: "garage", icon: "garage", name: "Garage Exemption", cite: "§12.03",
      rows: [{ t: z.cls === "R1" ? "Up to 400 ft² of a required covered garage doesn’t count toward residential floor area. Verify with the city for detached garages." : "Parking areas don’t count toward floor area. Verify with the city for any garage-exemption provisions." }],
      more: "Residential floor area (LAMC §12.03) leaves out up to 400 ft² of required covered parking, plus 200 ft² more when the garage is detached." },
    { key: "basement", icon: "basement", name: "Basement", cite: "§12.03",
      rows: [{ t: "A basement doesn’t count toward floor area while its ceiling sits 3 ft or less above grade. Verify with the city for any below-grade-area rules." }],
      more: "Basement space counts as floor area once the ceiling is more than 3 ft above the finished or natural grade, whichever is lower." },
  ];
}

function summaryOf(b: Bg): string[] {
  const z = b.zone;
  const home = z.cls === "R1" ? "A single-family detached home" : z.cls === "R2" ? "A single-family home or a duplex" : z.cls === "PF" ? "A public facility" : "Apartments or a single-family home";
  return [
    `Your property is zoned ${z.code} (${z.name}) in the City of Los Angeles, California.`,
    `${z.intent} The zone’s rules are in ${z.section} of the LA Municipal Code.`,
    `${home} is permitted by right, with no special permit required under the base zoning, though any project must still meet the city’s development standards, including height, floor area, yards and parking.`,
    "The property is also subject to state accessory dwelling unit (ADU) law, which may allow an ADU even where local standards are restrictive, and may be shaped by site factors such as hillside rules or a historic overlay (HPOZ) that further limit height and massing.",
    "Beyond the main home, the zone also permits home occupations and accessory buildings such as a garage, shed or pool, provided they meet the yard and height rules.",
  ];
}

function Guidelines({ b, onDetail }: { b: Bg; onDetail: (r: Rule) => void }) {
  const rules = rulesOf(b);
  const tip = b.kase === "nozone";
  return (
    <section className="bg-card">
      <h2>Build Guidelines</h2>
      <div className="sum">
        <p className="hd"><img src="/ub2/sparkle.svg" alt="" width={24} height={24} />Summary</p>
        <div className="txt">{summaryOf(b).map((p, i) => <p key={i}>{p}</p>)}</div>
      </div>
      <div className="rules">
        {rules.map(r => (
          <div key={r.key} className="rule">
            <p className="name"><img src={`/ub2/${r.icon}.svg`} alt="" width={22} height={22} />{r.name}</p>
            <div className="rows">
              {r.rows.map((x, i) => (
                <div key={i} className="row">
                  <span className="v">{x.v ?? ""}</span>
                  <span className="t">{x.h && <b>{x.h}</b>}{x.t}</span>
                </div>
              ))}
            </div>
            <button type="button" className="vd" onClick={() => onDetail(r)}>View Details</button>
          </div>
        ))}
      </div>
      {tip && <p className="tipline"><b>One more helpful tip:</b> building standards are specific to each property and zoning district. For the exact numbers on your plans, your local planning department can confirm what applies to your lot.</p>}
    </section>
  );
}

/* ---------------- dialogs ---------------- */

function useEscape(onClose: () => void) {
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); onClose(); } };
    window.addEventListener("keydown", k, true);
    return () => window.removeEventListener("keydown", k, true);
  }, [onClose]);
}

function MultiModal({ b, onClose }: { b: Bg; onClose: () => void }) {
  useEscape(onClose);
  const basis = b.def.basis ?? "coverage";
  return createPortal(
    <div className="bz-up bg-modal-bg" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-modal" role="dialog" aria-modal="true" aria-labelledby="bg-multi-t">
        <h2 id="bg-multi-t">We found multiple code regulations</h2>
        <p className="lede">Two zoning rules apply here with different limits. As a general rule, plan around the more restrictive scenario, it’s the safer basis for any development decision.</p>
        <div className="opt main">
          <span className="k">Score based on</span><b>{BASIS_NAME[basis]}</b>
          <span className="big">{f(b.Smax)} ft²</span>
          <span className="d">Max home size if you tear down and rebuild. The score uses this, the more restrictive rule.</span>
        </div>
        <div className="opt">
          <span className="k">Other scenario based on</span><b>{BASIS_NAME[b.other!.basis]}</b>
          <span className="big">{f(b.other!.Smax)} ft²</span>
          <span className="d">Max home size under {b.other!.basis === "far" ? "the floor area ratio" : b.other!.basis === "coverage" ? "lot coverage and stories" : "setbacks and stories"}.</span>
        </div>
        <button type="button" className="ok" onClick={onClose} autoFocus>Got it</button>
      </div>
    </div>, document.body);
}

function RuleModal({ r, zone, onClose }: { r: Rule; zone: string; onClose: () => void }) {
  useEscape(onClose);
  return createPortal(
    <div className="bz-up bg-modal-bg" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-modal rule" role="dialog" aria-modal="true" aria-labelledby="bg-rule-t">
        <p className="eyebrow"><img src={`/ub2/${r.icon}.svg`} alt="" width={22} height={22} />{zone}</p>
        <h2 id="bg-rule-t">{r.name}</h2>
        <p className="lede">{r.more}</p>
        {r.rows.map((x, i) => (
          <p key={i} className="line">{x.v != null && x.v !== "" && <b className="v">{x.v}</b>}{x.h && <b>{x.h} · </b>}{x.t}</p>
        ))}
        <p className="src">{r.cite && <>Source: {r.cite.startsWith("§") ? `LA Municipal Code ${r.cite}` : r.cite}. </>}A plain-English summary, not a quotation. Overlays (hillside, HPOZ, specific plans, Q / D conditions) can change it.</p>
        <div className="acts">
          <a href={LAMC_URL} target="_blank" rel="noreferrer">LA Municipal Code ↗</a>
          <a href={ZIMAS_URL} target="_blank" rel="noreferrer">Check the parcel on ZIMAS ↗</a>
          <button type="button" className="ok" onClick={onClose} autoFocus>Got it</button>
        </div>
      </div>
    </div>, document.body);
}
