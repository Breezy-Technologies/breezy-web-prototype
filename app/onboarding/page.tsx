"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useMapCtx } from "@/components/map/MapProvider";
import { useApp } from "@/components/AppState";
import { OppPins } from "@/components/onboarding/OppPins";
import { MapOverlay } from "@/components/map/Overlay";
import { Place, GAZETTEER, searchPlaces } from "@/lib/places";
import { Listing, OPP, OPP_TYPES, OppType, fullPrice, shortPrice } from "@/lib/fake";
import { ringBBox } from "@/lib/geo";

const STEPS = ["where", "radar", "comps", "ub", "roi", "heat", "alerts", "signup", "cards"] as const;
type Step = (typeof STEPS)[number];
const PANEL = 420, PAD = 24;

const FREE: Record<"comps" | "ub" | "roi", { kick: string; title: string; body: string; opp?: OppType; right: string }> = {
  comps: { kick: "AI comps", title: "See how much it's worth", body: "Our AI surfaces the strongest comps. You review them and set the price.", right: "How this comp scores" },
  ub: { kick: "Underbuilt score", title: "Know what you can build", body: "Zoning, setbacks, and buildable sqft decoded in seconds, not days.", opp: "ub", right: "What you could build" },
  roi: { kick: "ROI impact", title: "See tomorrow's price today", body: "Get profit estimates and compare investment opportunities for each home.", opp: "roi", right: "How the deal pencils out" },
};

const CARDS: { k: OppType | "fc"; ic: string; lb: string; q: string; plain: string; ph: string; tag: string; soon?: boolean }[] = [
  { k: "exp", ic: "hourglass-low", lb: "Recently expired", q: "Homes whose listing just ended without selling", plain: "The owner wanted to sell and still might. You can be the next agent they hear from.", ph: "prop-b", tag: "Listing ended · 9 days ago" },
  { k: "wd", ic: "sign-out", lb: "Withdrawn", q: "Homes taken off the market before they sold", plain: "Often the price or the agent wasn't right. A fresh plan can bring the owner back.", ph: "prop-c", tag: "Off market · 6 days ago" },
  { k: "stale", ic: "clock-countdown", lb: "Stale listing", q: "Homes for sale more than 160 days", plain: "Long listings wear sellers down. They're usually open to a new approach.", ph: "prop-d", tag: "On market · 170 days" },
  { k: "ub", ic: "hammer", lb: "Underbuilt lot", q: "Homes with room to build a lot more", plain: "The house is small for its lot. Zoning allows more, so the land is worth more than owners think.", ph: "hero-property", tag: "1,800 ft² built · 6,080 ft² allowed" },
  { k: "roi", ic: "trend-up", lb: "High ROI", q: "Homes where a rebuild makes good money", plain: "ROI is the profit after buying and rebuilding, as a share of the cost. High ROI draws investors.", ph: "prop-e", tag: "59% ROI · $1.8m profit" },
  { k: "fc", ic: "gavel", lb: "Foreclosure", q: "Owners behind on mortgage payments", plain: "These owners may need to sell quickly and will want help.", ph: "prop-f", tag: "Notice filed", soon: true },
  { k: "drop", ic: "arrow-down", lb: "Price drop", q: "Homes that cut their price 10% or more", plain: "A big recent cut usually means a seller ready to move.", ph: "prop-g", tag: "$1.65m → $1.5m" },
];

const panel: React.CSSProperties = { position: "fixed", left: PAD, top: PAD, bottom: PAD, width: PANEL, zIndex: 40, display: "flex", flexDirection: "column", gap: 24, padding: 32, borderRadius: 28, background: "var(--paper)", boxShadow: "0 0 0 .5px rgba(13,12,12,.06),0 24px 60px rgba(30,18,12,.16)", overflowY: "auto" };
const kickS: React.CSSProperties = { font: "700 12px/16px var(--font-sans)", letterSpacing: ".08em", textTransform: "uppercase", color: "var(--clay-dark)" };
const titleS: React.CSSProperties = { font: "300 34px/40px var(--font-sans)", letterSpacing: "-.02em", textWrap: "balance" } as React.CSSProperties;
const bodyS: React.CSSProperties = { font: "400 16px/23px var(--font-sans)", color: "var(--fg-2)" };

export default function Onboarding() {
  const router = useRouter();
  const { map, ready, setInset, setHeat, setAreaRings } = useMapCtx();
  const app = useApp();
  const [step, setStep] = useState<Step>("where");
  const si = STEPS.indexOf(step);
  const go = (s: Step) => setStep(s);
  const next = () => setStep(STEPS[Math.min(STEPS.length - 1, si + 1)]);
  const prev = () => setStep(STEPS[Math.max(0, si - 1)]);

  useEffect(() => { setInset({ left: 0, top: 0, radius: 0 }); }, [setInset]);

  // Opportunities = the first 24 listings, ordered by angle so the radar sweep reveals them clockwise.
  const opps = useMemo(() => {
    const L = app.listings.slice(0, 24), c = app.place.center;
    return L.map(l => ({ l, a: (Math.atan2(l.lng - c[0], l.lat - c[1]) * 180) / Math.PI + 360 }))
      .sort((a, b) => (a.a % 360) - (b.a % 360)).map(x => x.l);
  }, [app.listings, app.place]);

  // ---- camera per step ----
  const fitArea = (padLeft = PAD + PANEL + 40, duration = 1200) => {
    if (!map) return;
    const bb = app.rings && app.rings.length ? ringBBox(app.rings) : app.place.bbox;
    if (bb) map.fitBounds([[bb[0], bb[1]], [bb[2], bb[3]]], { padding: { left: padLeft, right: 80, top: 90, bottom: 60 }, duration, maxZoom: 14.2 });
    else map.flyTo({ center: app.place.center, zoom: 13.4, duration });
  };
  const freeL = (k: "comps" | "ub" | "roi"): Listing => {
    const o = FREE[k].opp;
    return (o && opps.find(l => l.opp === o)) || opps[k === "comps" ? 0 : 3] || app.listings[0];
  };
  useEffect(() => {
    if (!map || !ready) return;
    setAreaRings(["radar", "heat", "alerts", "signup", "cards"].includes(step) ? app.rings : null);
    setHeat(step === "heat" ? "roi" : step === "alerts" || step === "signup" ? "ub" : "none");
    if (step === "where") map.flyTo({ center: app.place.center, zoom: 12.8, offset: [(PAD + PANEL) / 2, 0], duration: 1200 });
    else if (step === "comps" || step === "ub" || step === "roi") {
      const l = freeL(step);
      map.flyTo({ center: [l.lng, l.lat], zoom: 16.2, offset: [PAD + PANEL + 110 - map.getContainer().clientWidth / 2, -60], duration: 1400 });
    } else fitArea();
  }, [step, ready, app.rings, app.place.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // ---- radar reveal ----
  const [rN, setRN] = useState(0);
  const [rSel, setRSel] = useState<Listing | null>(null);
  useEffect(() => {
    if (step !== "radar") return;
    setRN(0); setRSel(null);
    const ids = opps.map((_, i) => setTimeout(() => setRN(i + 1), 500 + (i / opps.length) * 3400));
    return () => ids.forEach(clearTimeout);
  }, [step, opps]);
  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    opps.slice(0, step === "radar" ? rN : opps.length).forEach(l => { c[l.opp] = (c[l.opp] || 0) + 1; });
    return c;
  }, [opps, rN, step]);

  // ---- personalisation cards ----
  const [ci, setCi] = useState(0);
  const [ans, setAns] = useState<Record<string, boolean>>({});
  const [swipe, setSwipe] = useState<"L" | "R" | null>(null);
  const answer = (yes: boolean) => {
    if (swipe) return;
    setSwipe(yes ? "R" : "L");
    setTimeout(() => { setAns(a => ({ ...a, [CARDS[ci].k]: yes })); setCi(i => i + 1); setSwipe(null); }, 280);
  };
  const answered = Object.keys(ans).length, minMet = answered >= 5;
  const matchN = opps.filter(l => answered === 0 || ans[l.opp]).length;
  const finish = (skip = false) => {
    app.setPicks(skip ? {} : ans);
    app.finishOnboarding();
    router.push("/home");
  };

  return (
    <>
      {/* Step counter */}
      <div style={{ position: "fixed", left: "50%", top: 20, transform: "translateX(-50%)", zIndex: 45, display: "flex", alignItems: "center", gap: 10, height: 36, padding: "0 14px", borderRadius: 9999, background: "var(--paper)", boxShadow: "0 6px 18px rgba(30,18,12,.12)" }}>
        <span style={{ width: 20, height: 16, background: "linear-gradient(180deg,rgb(191,160,151),rgb(175,127,113))", WebkitMask: "url(/brand/brandmark.svg) center/contain no-repeat", mask: "url(/brand/brandmark.svg) center/contain no-repeat" }} />
        <span style={{ font: "700 13px/16px var(--font-sans)", fontVariantNumeric: "tabular-nums" }}>Step {si + 1} of {STEPS.length}</span>
        <span style={{ display: "flex", gap: 3 }}>{STEPS.map((_, k) => <span key={k} style={{ width: 14, height: 4, borderRadius: 9999, background: k < si ? "var(--ink)" : k === si ? "var(--clay)" : "rgba(18,18,18,.12)", transition: "background .3s" }} />)}</span>
        <button onClick={() => finish(true)} className="btn-ghost" style={{ height: 26, padding: "0 10px", font: "400 12px/16px var(--font-sans)", color: "var(--fg-2)" }}>Skip to app</button>
      </div>

      {step === "where" && <Where onPick={async p => { await app.choosePlace(p); go("radar"); }} />}

      {step === "radar" && <>
        <RadarSweep active={rN < opps.length} />
        <OppPins items={opps} shown={(_, i) => i < rN} selId={rSel?.id} onPick={setRSel} />
        <div style={panel}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={{ font: "700 13px/16px var(--font-sans)", color: "var(--clay-dark)" }}>{app.place.label}</span>
            <span style={{ display: "flex", alignItems: "center", gap: 6, height: 24, padding: "0 10px", borderRadius: 9999, background: rN >= opps.length ? "rgb(221,237,232)" : "rgb(247,238,234)", font: "700 12px/24px var(--font-sans)" }}>
              <span style={{ width: 7, height: 7, borderRadius: 9999, background: rN >= opps.length ? "rgb(49,140,96)" : "var(--clay)" }} />{rN >= opps.length ? "Live" : "Scanning"}
            </span>
          </div>
          <div style={{ display: "flex", alignItems: "flex-end", gap: 14 }}>
            <span style={{ font: "300 72px/1 var(--font-sans)", letterSpacing: "-2px", fontVariantNumeric: "tabular-nums" }}>{rN}</span>
            <span style={{ paddingBottom: 6, font: "400 20px/24px var(--font-sans)" }}>opportunities<br />unlocked</span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <span style={{ height: 6, borderRadius: 9999, background: "rgba(13,12,12,.06)", overflow: "hidden" }}><span style={{ display: "block", height: "100%", width: `${(rN / opps.length) * 100}%`, background: "var(--clay)", transition: "width .3s" }} /></span>
            <span style={{ font: "400 14px/20px var(--font-sans)", color: "var(--fg-2)" }}>{rN >= opps.length ? "Found in the last 30 days, across 2,418 homes." : "Scanning 2,418 homes for deals other agents miss…"}</span>
          </div>
          <div style={{ display: "flex", flexDirection: "column" }}>
            {OPP_TYPES.map(t => (
              <div key={t} style={{ display: "flex", alignItems: "center", gap: 12, height: 44, boxShadow: "inset 0 -1px 0 rgba(13,12,12,.06)" }}>
                <span style={{ width: 28, height: 28, borderRadius: 9999, background: "rgb(255,209,41)", boxShadow: `0 0 0 2.5px rgb(${OPP[t].col})`, display: "flex", alignItems: "center", justifyContent: "center" }}><i className={`ph-bold ph-${OPP[t].ic}`} style={{ fontSize: 15 }} /></span>
                <span style={{ flex: 1, font: "400 15px/20px var(--font-sans)" }}>{OPP[t].pl}</span>
                <span style={{ font: "700 17px/20px var(--font-sans)", fontVariantNumeric: "tabular-nums" }}>{counts[t] || 0}</span>
              </div>
            ))}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, padding: 14, borderRadius: 16, background: "rgb(247,244,242)" }}>
            <i className="ph-bold ph-cursor-click" style={{ fontSize: 20 }} /><span style={{ font: "400 14px/19px var(--font-sans)" }}>Click any pin to see why it&apos;s worth a call today.</span>
          </div>
          <span style={{ flex: 1 }} />
          <button className="btn-dark" onClick={next}>See what we found<i className="ph-bold ph-arrow-right" /></button>
        </div>
        {rSel && <PinWhy l={rSel} onClose={() => setRSel(null)} onMore={() => go("comps")} />}
      </>}

      {(step === "comps" || step === "ub" || step === "roi") && <Freebie k={step} l={freeL(step)} onBack={prev} onNext={next} />}

      {(step === "heat" || step === "alerts") && <>
        {step === "alerts" && <OppPins items={opps} shown={l => l.opp === "drop" || l.opp === "exp" || l.isNew} labels />}
        <div style={{ ...panel, top: "auto", bottom: PAD, gap: 14 }}>
          <span style={kickS}>{step === "heat" ? "Heatmap layers" : "Market alerts"}</span>
          <span style={titleS}>{step === "heat" ? "Spot the upside fast" : "Your next lead won't wait"}</span>
          <span style={{ ...bodyS, color: "rgb(48,42,40)" }}>{step === "heat" ? "Compare build potential and ROI across neighborhoods to spot where the upside is." : "Stay on top of new leads and market updates, so you know when it's time to make the call."}</span>
          <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
            <button className="btn-soft" onClick={prev}>Back</button>
            <span style={{ flex: 1 }} />
            <button className="btn-dark" onClick={next}>{step === "heat" ? "Next" : "Keep me in the know"}</button>
          </div>
        </div>
      </>}

      {step === "signup" && <>
        <div style={{ position: "fixed", inset: 0, zIndex: 41, background: "rgba(247,246,246,.5)", animation: "fadeIn .3s ease both" }} />
        <div style={{ position: "fixed", left: "50%", top: "50%", transform: "translate(-50%,-50%)", zIndex: 42, width: 440, display: "flex", flexDirection: "column", gap: 18, padding: 32, borderRadius: 28, background: "var(--paper)", boxShadow: "0 24px 60px rgba(30,18,12,.22)", animation: "fadeIn .35s ease both" }}>
          <span style={{ font: "300 30px/36px var(--font-sans)", letterSpacing: "-.02em" }}>{opps.length} opportunities are waiting in {app.place.name}</span>
          <span style={bodyS}>Create your free account to save them and get alerts when new ones appear.</span>
          <div style={{ display: "flex", alignItems: "center", gap: 12, padding: 12, borderRadius: 16, boxShadow: "inset 0 0 0 1px rgba(13,12,12,.1)" }}>
            <span style={{ width: 40, height: 40, borderRadius: 9999, background: "url(/photos/avatar.jpg) center/cover" }} />
            <span style={{ flex: 1, display: "flex", flexDirection: "column" }}><span style={{ font: "700 15px/20px var(--font-sans)" }}>{app.user.name}</span><span style={{ font: "400 13px/18px var(--font-sans)", color: "rgb(98,90,89)" }}>{app.user.email}</span></span>
            <span style={{ display: "flex", alignItems: "center", gap: 6, font: "400 12px/16px var(--font-sans)", color: "rgb(98,90,89)" }}><i className="ph-bold ph-google-logo" />Detected</span>
          </div>
          <button className="btn-dark" onClick={next}>Continue as {app.user.name.split(" ")[0]}</button>
          <span style={{ font: "400 12px/16px var(--font-sans)", color: "rgb(98,90,89)", textAlign: "center" }}>Pre-filled from your Google sign-in · Not you? <u>Use another account</u></span>
        </div>
      </>}

      {step === "cards" && <>
        <OppPins items={opps} shown={() => true} lit={l => answered === 0 || !!ans[l.opp]} />
        <div style={{ ...panel, gap: 18 }}>
          <span style={{ font: "700 12px/16px var(--font-sans)", color: "var(--fg-3)" }}>Step 9 of 9 · Personalise</span>
          <span style={{ font: "300 30px/36px var(--font-sans)", letterSpacing: "-.02em" }}>What should Breezy look out for?</span>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <span style={{ flex: 1, height: 6, borderRadius: 9999, background: "rgba(18,18,18,.08)", overflow: "hidden" }}><span style={{ display: "block", height: "100%", width: `${Math.min(1, answered / 5) * 100}%`, background: minMet ? "rgb(49,140,96)" : "var(--clay)", transition: "width .3s" }} /></span>
            <span style={{ font: "700 13px/18px var(--font-sans)" }}>{Math.min(answered, CARDS.length)} / {CARDS.length}</span>
          </div>
          <span style={{ marginTop: -10, font: "400 13px/18px var(--font-sans)", color: "var(--fg-2)" }}>{minMet ? "Nice — that's enough to build your feed." : `Answer at least ${5 - answered} more to tune your feed.`}</span>
          {ci < CARDS.length ? <>
            <div key={ci} style={{ flex: "none", borderRadius: 24, overflow: "hidden", background: "#fff", boxShadow: "0 12px 30px rgba(30,18,12,.14)", animation: swipe ? `cardSwipe${swipe} .28s ease-in both` : "riseIn .3s ease both" }}>
              <div style={{ position: "relative", height: 170, background: `url(/photos/${CARDS[ci].ph}.jpg) center/cover` }}>
                <span style={{ position: "absolute", left: 16, bottom: 16, display: "flex", alignItems: "center", gap: 8, height: 30, padding: "0 12px 0 4px", borderRadius: 9999, background: "rgba(253,252,252,.94)", font: "700 12px/30px var(--font-sans)" }}>
                  <span style={{ width: 24, height: 24, borderRadius: 9999, background: "rgb(255,209,41)", display: "flex", alignItems: "center", justifyContent: "center" }}><i className={`ph-bold ph-${CARDS[ci].ic}`} /></span>{CARDS[ci].tag}
                </span>
                {CARDS[ci].soon && <span style={{ position: "absolute", right: 12, top: 12, height: 24, padding: "0 10px", borderRadius: 9999, background: "rgba(18,18,18,.7)", font: "400 11px/24px var(--font-sans)", color: "#fff" }}>New dataset · may launch later</span>}
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8, padding: "18px 20px 20px" }}>
                <span style={{ font: "700 12px/16px var(--font-sans)", color: "rgb(98,90,89)" }}>{CARDS[ci].lb}</span>
                <span style={{ font: "400 20px/27px var(--font-sans)", letterSpacing: "-.2px" }}>{CARDS[ci].q}</span>
                <span style={{ font: "400 15px/21px var(--font-sans)", color: "rgb(48,42,40)" }}>{CARDS[ci].plain}</span>
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 20 }}>
              <button onClick={() => answer(false)} title="Not for me" style={{ width: 64, height: 64, border: "none", borderRadius: 9999, background: "#fff", boxShadow: "0 0 0 1px rgba(13,12,12,.1),0 6px 16px rgba(30,18,12,.12)", cursor: "pointer", fontSize: 24 }}><i className="ph-bold ph-x" /></button>
              <span style={{ display: "flex", flexDirection: "column", alignItems: "center", minWidth: 120 }}><span style={{ font: "700 13px/16px var(--font-sans)" }}>Interested?</span><span style={{ font: "400 12px/16px var(--font-sans)", color: "var(--fg-3)" }}>Swipe or tap</span></span>
              <button onClick={() => answer(true)} title="Yes, show me" style={{ width: 64, height: 64, border: "none", borderRadius: 9999, background: "var(--ink)", color: "var(--paper)", cursor: "pointer", fontSize: 24 }}><i className="ph-bold ph-check" /></button>
            </div>
            <span style={{ flex: 1 }} />
            <div style={{ display: "flex", alignItems: "flex-end", gap: 12 }}>
              <span style={{ font: "300 44px/1 var(--font-sans)" }}>{matchN}</span>
              <span style={{ paddingBottom: 3, font: "400 15px/19px var(--font-sans)" }}>opportunities<br />match your picks</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
              <button onClick={() => { setAns({}); setCi(0); }} className="btn-ghost" style={{ height: 40, padding: "0 12px", font: "700 14px/18px var(--font-sans)" }}><i className="ph-bold ph-arrow-counter-clockwise" /> Restart</button>
              {!minMet && <button className="btn-soft" style={{ height: 40, fontSize: 14 }} onClick={() => finish(true)}>Skip for now, show me everything</button>}
            </div>
            {minMet && <button className="btn-dark" onClick={() => finish()}><i className="ph-bold ph-sparkle" />Build my feed</button>}
          </> : (
            <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 10, textAlign: "center" }}>
              <span style={{ font: "300 96px/1 var(--font-sans)", letterSpacing: "-3px", animation: "countUp .6s cubic-bezier(.2,.8,.2,1) both" }}>{matchN}</span>
              <span style={{ font: "400 18px/24px var(--font-sans)" }}>opportunities match your picks</span>
              <span style={{ maxWidth: 320, font: "400 14px/20px var(--font-sans)", color: "rgb(98,90,89)" }}>They&apos;re lit up on the map. We&apos;ll build your feed around them.</span>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10, marginTop: 20, animation: "fadeIn .4s ease .4s both" }}>
                <button className="btn-dark" onClick={() => finish()}><i className="ph-bold ph-sparkle" />Build my feed</button>
                <button onClick={() => { setAns({}); setCi(0); }} className="btn-ghost" style={{ height: 40, padding: "0 12px", font: "700 14px/18px var(--font-sans)" }}><i className="ph-bold ph-arrow-counter-clockwise" /> Restart</button>
              </div>
            </div>
          )}
        </div>
      </>}
    </>
  );
}

// ---------------------------------------------------------------------------

function Where({ onPick }: { onPick: (p: Place) => void }) {
  const [q, setQ] = useState("");
  const [res, setRes] = useState<Place[]>([]);
  const [busy, setBusy] = useState(false);
  const t = useRef<any>(null);
  useEffect(() => { clearTimeout(t.current); if (!q.trim()) { setRes([]); return; } t.current = setTimeout(() => searchPlaces(q).then(setRes), 180); }, [q]);
  const chips = ["sl", "bh", "90210", "weho"].map(id => GAZETTEER.find(p => p.id === id)!);
  return (
    <div style={{ ...panel, justifyContent: "center", gap: 22 }}>
      <span style={{ display: "flex", alignItems: "center", gap: 10, position: "absolute", top: 32, left: 32 }}>
        <span style={{ width: 70, height: 24, background: "var(--ink)", WebkitMask: "url(/brand/splash-wordmark.svg) left center/contain no-repeat", mask: "url(/brand/splash-wordmark.svg) left center/contain no-repeat" }} />
      </span>
      <span style={{ font: "300 38px/44px var(--font-sans)", letterSpacing: "-.02em" }}>Where do you mainly work?</span>
      <span style={bodyS}>We&apos;ll scan the area you sell in for deals other agents miss, not just where you are right now.</span>
      <div style={{ display: "flex", alignItems: "center", gap: 10, height: 56, padding: "0 16px", borderRadius: 9999, boxShadow: "inset 0 0 0 1.5px var(--ink)" }}>
        <i className="ph-bold ph-magnifying-glass" style={{ fontSize: 20, color: "var(--fg-2)" }} />
        <input autoFocus value={q} onChange={e => setQ(e.target.value)} onKeyDown={e => { if (e.key === "Enter" && res[0]) onPick(res[0]); }} placeholder="Enter a ZIP code or city" style={{ flex: 1, border: "none", outline: "none", background: "none", font: "400 16px/22px var(--font-sans)" }} />
      </div>
      {res.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", padding: 6, borderRadius: 20, boxShadow: "inset 0 0 0 1px rgba(13,12,12,.08)", marginTop: -10 }}>
          {res.map(r => (
            <button key={r.id} onClick={() => onPick(r)} className="hover-row" style={{ display: "flex", alignItems: "center", gap: 12, minHeight: 52, padding: "4px 10px", border: "none", borderRadius: 14, background: "none", textAlign: "left", cursor: "pointer" }}>
              <span style={{ width: 32, height: 32, borderRadius: 9999, background: "rgba(18,18,18,.06)", display: "flex", alignItems: "center", justifyContent: "center" }}><i className="ph-bold ph-map-pin" /></span>
              <span style={{ flex: 1, display: "flex", flexDirection: "column" }}><span style={{ font: "700 15px/20px var(--font-sans)" }}>{r.label}</span><span style={{ font: "400 13px/17px var(--font-sans)", color: "var(--fg-3)" }}>{r.sub}</span></span>
              <i className="ph-bold ph-arrow-right" />
            </button>
          ))}
        </div>
      )}
      {!q && <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>{chips.map(c => <button key={c.id} onClick={() => onPick(c)} style={{ height: 36, padding: "0 14px", border: "none", borderRadius: 9999, background: "rgba(18,18,18,.06)", font: "400 14px/18px var(--font-sans)", cursor: "pointer" }}>{c.label}</button>)}</div>}
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}><span style={{ flex: 1, height: 1, background: "rgba(13,12,12,.1)" }} /><span style={{ font: "400 13px/16px var(--font-sans)", color: "rgb(98,90,89)" }}>or</span><span style={{ flex: 1, height: 1, background: "rgba(13,12,12,.1)" }} /></div>
      <button className="btn-dark" onClick={() => { setBusy(true); setTimeout(() => onPick(chips[0]), 900); }}>
        {busy ? <span style={{ width: 16, height: 16, borderRadius: 9999, border: "2px solid rgba(255,255,255,.3)", borderTopColor: "#fff", animation: "spin .8s linear infinite" }} /> : <i className="ph-bold ph-navigation-arrow" />}
        {busy ? "Finding you…" : "Use my current location"}
      </button>
    </div>
  );
}

function RadarSweep({ active }: { active: boolean }) {
  return (
    <MapOverlay>
      <div style={{ position: "absolute", left: `calc(50% + ${(PAD + PANEL) / 2}px)`, top: "50%", width: 900, height: 900, transform: "translate(-50%,-50%)", pointerEvents: "none", opacity: active ? 1 : 0, transition: "opacity .8s" }}>
        <div style={{ position: "absolute", left: "50%", top: "50%", width: "100%", height: "100%", borderRadius: "50%", background: "conic-gradient(from 0deg, rgba(175,127,113,0) 0deg, rgba(175,127,113,0) 300deg, rgba(175,127,113,.28) 360deg)", animation: "sweep 3.4s linear infinite", transform: "translate(-50%,-50%)" }} />
        {[0, 1, 2].map(k => <span key={k} style={{ position: "absolute", left: "50%", top: "50%", width: 300, height: 300, borderRadius: "50%", border: "1.5px solid rgba(175,127,113,.5)", animation: `ping 3s ease-out ${k}s infinite` }} />)}
      </div>
    </MapOverlay>
  );
}

function PinWhy({ l, onClose, onMore }: { l: Listing; onClose: () => void; onMore: () => void }) {
  const { map, tick } = useMapCtx();
  void tick;
  if (!map) return null;
  const p = map.project([l.lng, l.lat]);
  return (
    <MapOverlay>
      <div style={{ position: "absolute", left: p.x, top: p.y - 26, transform: "translate(-50%,-100%)", width: 300, borderRadius: 20, overflow: "hidden", background: "var(--paper)", boxShadow: "0 18px 40px rgba(30,18,12,.22)", pointerEvents: "auto", animation: "hvPop .22s ease both" }}>
        <div style={{ position: "relative", height: 120, background: `url(${l.photos[0]}) center/cover` }}>
          <span style={{ position: "absolute", left: 12, top: 12, display: "flex", alignItems: "center", gap: 6, height: 28, padding: "0 10px 0 4px", borderRadius: 9999, background: "rgba(253,252,252,.94)", font: "700 12px/28px var(--font-sans)" }}>
            <span style={{ width: 20, height: 20, borderRadius: 9999, background: "rgb(255,209,41)", display: "flex", alignItems: "center", justifyContent: "center" }}><i className={`ph-bold ph-${OPP[l.opp].ic}`} style={{ fontSize: 12 }} /></span>{OPP[l.opp].lb}
          </span>
          <button onClick={onClose} title="Close" style={{ position: "absolute", right: 10, top: 10, width: 28, height: 28, border: "none", borderRadius: 9999, background: "var(--paper)", cursor: "pointer" }}><i className="ph-bold ph-x" /></button>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8, padding: "14px 16px 16px" }}>
          <span style={{ font: "700 17px/22px var(--font-sans)" }}>{l.oppWhy}</span>
          <span style={{ font: "400 13px/18px var(--font-sans)", color: "var(--fg-2)" }}>{shortPrice(l.price)} · {l.addr}</span>
          <button className="btn-dark" style={{ height: 40, fontSize: 14 }} onClick={onMore}>See how we score it<i className="ph-bold ph-arrow-right" /></button>
        </div>
      </div>
    </MapOverlay>
  );
}

function Freebie({ k, l, onBack, onNext }: { k: "comps" | "ub" | "roi"; l: Listing; onBack: () => void; onNext: () => void }) {
  const { map, tick } = useMapCtx();
  void tick;
  const D = FREE[k], i = ["comps", "ub", "roi"].indexOf(k);
  const p = map ? map.project([l.lng, l.lat]) : { x: 0, y: 0 };
  const bar = (v: number) => <span style={{ flex: 1, height: 8, borderRadius: 15, background: "rgba(13,12,12,.08)", padding: 2 }}><span style={{ display: "block", height: 4, width: v + "%", borderRadius: 17, background: v >= 70 ? "rgb(96,201,172)" : v >= 40 ? "rgb(221,171,71)" : "rgb(226,110,88)" }} /></span>;
  const hero = k === "comps" ? fullPrice(l.qe.value) : k === "ub" ? `${l.ub}% underbuilt` : `${shortPrice((l.price * l.roi) / 100)} profit`;
  return <>
    <div style={{ ...panel, top: "auto", bottom: PAD, gap: 14 }}>
      <div style={{ display: "flex", gap: 5 }}>{[0, 1, 2].map(d => <span key={d} style={{ height: 4, width: d === i ? 22 : 16, borderRadius: 9999, background: d === i ? "var(--clay-dark)" : "rgba(147,89,75,.25)" }} />)}</div>
      <span style={kickS}>{D.kick}</span>
      <span style={titleS}>{D.title}</span>
      <span style={bodyS}>{D.body}</span>
      <div style={{ display: "flex", gap: 8, marginTop: 10 }}><button className="btn-soft" onClick={onBack}>Back</button><span style={{ flex: 1 }} /><button className="btn-dark" onClick={onNext}>Next<i className="ph-bold ph-arrow-right" /></button></div>
    </div>
    <MapOverlay>
      <span style={{ position: "absolute", left: p.x, top: p.y, width: 64, height: 64, transform: "translate(-50%,-50%)", borderRadius: 14, border: "3px solid var(--paper)", boxShadow: "0 0 0 2px rgb(199,146,131),0 10px 24px rgba(30,18,12,.3)", background: `url(${l.photos[0]}) center/cover` }} />
      <div key={k} style={{ position: "absolute", left: p.x + 60, top: p.y, transform: "translateY(-50%)", width: 600, display: "flex", borderRadius: 24, background: "var(--paper)", boxShadow: "0 24px 60px rgba(30,18,12,.22)", pointerEvents: "auto", animation: "riseIn .5s cubic-bezier(.2,.8,.2,1) .4s both" }}>
        <div style={{ flex: "none", width: 260, display: "flex", flexDirection: "column", padding: "10px 10px 18px" }}>
          <div style={{ position: "relative", height: 170, borderRadius: 16, background: `url(${l.photos[0]}) center/cover` }}>
            <span style={{ position: "absolute", left: 10, top: 10, height: 26, padding: "0 10px", borderRadius: 9999, background: "rgba(253,252,252,.94)", font: "700 12px/26px var(--font-sans)" }}>{k === "comps" ? "Strongest comp · 1 of 6" : l.oppWhy.split(" · ")[0]}</span>
          </div>
          <span style={{ marginTop: 12, padding: "0 4px", font: "700 15px/20px var(--font-sans)" }}>{l.addr}</span>
          <span style={{ marginTop: 2, padding: "0 4px", font: "400 13px/18px var(--font-sans)", color: "var(--fg-2)" }}>{l.beds} bd · {l.baths} ba · {l.sqft.toLocaleString()} ft² · built {l.built}</span>
          <span style={{ marginTop: 16, textAlign: "center", font: "400 12px/17px var(--font-sans)", color: "var(--fg-2)" }}>{k === "comps" ? "Price estimate based on strongest comps" : k === "ub" ? "Room to grow" : "Estimated profit over 18 months"}</span>
          <span style={{ textAlign: "center", font: "700 20px/25px var(--font-sans)", color: k === "ub" ? "#93594B" : "#469B70" }}>{hero}</span>
        </div>
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 10, padding: "20px 20px 20px 8px" }}>
          <span style={{ font: "700 11px/14px var(--font-sans)", letterSpacing: ".08em", textTransform: "uppercase", color: "var(--fg-3)" }}>{D.right}</span>
          {k === "comps" && [["Overall standard", 82], ["Condition", 74], ["Interior finishes", 46], ["Outdoor living", 71], ["Location", 86], ["Market trajectory", 81]].map(([lb, v]) => (
            <div key={String(lb)} style={{ display: "flex", alignItems: "center", gap: 8 }}><span style={{ width: 120, font: "400 12px/16px var(--font-sans)" }}>{lb}</span>{bar(Number(v))}<span style={{ width: 24, textAlign: "right", font: "400 12px/16px var(--font-sans)", color: "var(--fg-2)" }}>{v}</span></div>
          ))}
          {k !== "comps" && (k === "ub"
            ? [["Existing home", `${l.sqft.toLocaleString()} ft²`], ["Addition & remodel", `${Math.round(l.sqft * 2.1).toLocaleString()} ft²`], ["Teardown & rebuild", `${Math.round(l.sqft * 3.4).toLocaleString()} ft²`]]
            : [["Buy", shortPrice(l.price)], ["Improve", shortPrice(l.price * 0.9)], ["Sell", shortPrice(l.price * (1.9 + l.roi / 100))], ["Profit", shortPrice((l.price * l.roi) / 100)]]
          ).map(([lb, v], j, arr) => (
            <div key={lb} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "11px 12px", borderRadius: 10, background: "rgb(247,243,241)" }}>
              <span style={{ font: "400 14px/19px var(--font-sans)" }}>{lb}</span>
              <span style={{ font: "300 20px/1.26 var(--font-sans)", color: k === "roi" && j === arr.length - 1 ? "rgb(70,155,112)" : "var(--ink)" }}>{v}</span>
            </div>
          ))}
        </div>
      </div>
    </MapOverlay>
  </>;
}
