"use client";
// The report sheet: Comps, Underbuilt (Build guidelines) and ROI (Upside
// analysis), ported from the canvas (`Home Web.dc.html`: `rptLayer`,
// `_wsTilt`, `wsShade`, `_runFlow`, `rptTabs`).
//
// Opening a flow tilts the workspace back (map + panels: perspective, rotateX
// 9°, scale .9, html[data-flow] in globals.css) and dims it, while a white
// sheet rises from the bottom in perspective (translateY 70%, rotateX -18°)
// over everything right of the side nav. Inside: the flow's loading stage
// (progress bar in the flow's colour, radar / sparkle, "Analyzing …", one
// shimmering step at a time, then the done title), then the report with
// "Back to map" and the three tabs. A report that has run opens straight on
// its result. Comps first confirms the subject property (review modal over
// the map), then offers "Let AI do the work" inside the sheet.
import { useEffect, useMemo, useRef, useState } from "react";
import { Listing, shortPrice } from "@/lib/fake";
import { css } from "@/lib/css";
import { CompsReview } from "../home/CompsFlow";
import { CompsReport } from "./CompsReport";
import { UBReport } from "./UBReport";
import { compsFor } from "@/lib/comps";
import { UpsideReport } from "./upside/UpsideReport";
import { upsideOf } from "@/lib/roi";
import { reportKey, useEntitlements } from "@/lib/billing";
import { PRICING } from "@/lib/pricing.config";
import { LockVeil } from "../billing/Paywall";

export type FlowKind = "comps" | "ub" | "roi";

const STEPS: Record<FlowKind, string[]> = {
  comps: ["Analyzing the subject property", "Finding potential comps", "Scoring the comps", "Researching the neighborhood", "Enriching the comp analysis", "Ranking the comps by match", "Preparing your results"],
  ub: ["Calculating lot coverage and floor area", "Checking height limit, parking and access", "Measuring front, rear and side setbacks", "Running slope check and density allowed", "Researching the neighborhood", "Analysing maximum size and buildable area", "Preparing your UnderBuilt score"],
  roi: ["Analyzing the subject property", "Finding comparable sales", "Calculating build scenarios", "Projecting return value", "Optimizing build sizes", "Modeling your investment", "Preparing your results"],
};
const THEME: Record<FlowKind, { bar: string; glow: string; dot: string }> = {
  comps: { bar: "linear-gradient(89.442deg,rgb(84,55,157) 0.06%,rgb(142,67,158) 97.94%)", glow: "rgb(206,196,218)", dot: "rgb(186,160,251)" },
  ub: { bar: "linear-gradient(180deg,rgba(234,215,210,.24) 0%,rgba(234,215,210,.44) 100%),linear-gradient(180deg,rgb(227,202,196) 0%,rgb(174,106,91) 100%)", glow: "rgb(227,202,196)", dot: "rgb(174,106,91)" },
  roi: { bar: "linear-gradient(89.442deg,rgb(13,87,57) 0.06%,rgb(70,155,112) 97.94%)", glow: "rgb(196,222,207)", dot: "rgb(70,155,112)" },
};
// No Comps tab (review, 13 Nov): comps live in the split view (comps interaction 2.0). A saved
// comps report still opens here on its own, with these two tabs to move on.
const TABS: [FlowKind, string, string][] = [["roi", "Upside analysis", "act-chart"], ["ub", "Build guidelines", "act-target"]];
const EASE = "cubic-bezier(.2,.8,.2,1)";
const STEP_MS = 700, AUTO_MS = 6700;

// Reports that have run, per property and flow (canvas `got`): they reopen on their result.
const got = new Set<string>();
const gotKey = (l: Listing, k: FlowKind) => `${k}:${l.addr}|${l.lng.toFixed(5)},${l.lat.toFixed(5)}`;

type Phase = "review" | "choose" | "run" | "done" | "report";

export function ReportFlow({ l, kind: kind0, navW, cached, onClose, onDone, onShare, onToast, onComps }: {
  l: Listing; kind: FlowKind; navW: number; cached?: boolean;
  onClose: () => void; onDone?: (k: FlowKind) => void; onShare?: () => void;
  onToast?: (text: string, tone?: "positive" | "neutral" | "negative") => void;
  /** "See comps" in a report: drop the sheet and open the comps split view instead. */
  onComps?: () => void;
}) {
  if (cached) got.add(gotKey(l, "comps"));
  // Max build and Profit potential open straight on the report, written in front of the
  // user (useAiWrite) instead of the loading stage (12 Nov review). "run" is no longer used.
  const start = (k: FlowKind): Phase => (got.has(gotKey(l, k)) ? "report" : k === "comps" ? "review" : "report");
  const fresh = (k: FlowKind) => k !== "comps" && !got.has(gotKey(l, k));
  const [write, setWrite] = useState(() => fresh(kind0));
  const [kind, setKind] = useState<FlowKind>(kind0);
  useEffect(() => { if (write && kind !== "comps") { got.add(gotKey(l, kind)); onDone?.(kind); } }, [write, kind]); // eslint-disable-line react-hooks/exhaustive-deps
  const [phase, setPhase] = useState<Phase>(() => start(kind0));
  const [step, setStep] = useState(0);
  const [up, setUp] = useState(false); // the sheet is risen (drives the transition)
  const [raised, setRaised] = useState(false); // it has been up: a review from the Comps tab sits over it
  const [leaving, setLeaving] = useState(false);
  const prev = useRef<{ kind: FlowKind; phase: Phase } | null>(null);
  const [gcPaused, setGcPaused] = useState(false);
  const gcLeft = useRef(AUTO_MS), gcAt = useRef(0);
  const short = l.addr.split(",")[0];
  // The sheet is up once we're past the review modal, until it closes.
  const tilt = (phase !== "review" || raised) && !leaving;

  // Rise on the next frame so the transition runs; tilt the workspace with it.
  useEffect(() => {
    if (!tilt) { document.documentElement.removeAttribute("data-flow"); return; }
    const id = requestAnimationFrame(() => { setUp(true); setRaised(true); document.documentElement.setAttribute("data-flow", ""); });
    return () => cancelAnimationFrame(id);
  }, [tilt]);
  useEffect(() => () => document.documentElement.removeAttribute("data-flow"), []);

  const close = () => {
    if (leaving) return;
    setLeaving(true); setUp(false);
    document.documentElement.removeAttribute("data-flow");
    setTimeout(onClose, raised ? 700 : 0);
  };
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === "Escape" && !e.defaultPrevented && phase !== "review") close(); };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  });

  // Run: one step every 700 ms, then the done title for 1.5 s, then the report (canvas `_runFlow`).
  useEffect(() => {
    if (phase !== "run") return;
    setStep(0);
    const n = STEPS[kind].length;
    const ids = STEPS[kind].map((_, i) => setTimeout(() => setStep(i + 1), STEP_MS * (i + 1)));
    ids.push(setTimeout(() => setPhase("done"), STEP_MS * n + 300));
    return () => ids.forEach(clearTimeout);
  }, [phase, kind]);
  useEffect(() => {
    if (phase !== "done") return;
    const id = setTimeout(() => { got.add(gotKey(l, kind)); setPhase("report"); onDone?.(kind); }, 1500);
    return () => clearTimeout(id);
  }, [phase, kind]); // eslint-disable-line react-hooks/exhaustive-deps

  // "Let AI do the work" runs by itself after 6.7 s unless the pointer rests on Get comps (`_gcArm`, `gcPause`).
  useEffect(() => {
    if (phase !== "choose" || gcPaused) return;
    gcAt.current = Date.now();
    const id = setTimeout(() => compsNow(), gcLeft.current);
    return () => { clearTimeout(id); gcLeft.current = Math.max(0, gcLeft.current - (Date.now() - gcAt.current)); };
  }, [phase, gcPaused]);

  // Comps skip the loading stage (review: progressive disclosure): the report opens on
  // the subject and its estimate, and the comps arrive one by one (CompsReport reveal).
  const [reveal, setReveal] = useState(false);
  const compsNow = () => { got.add(gotKey(l, "comps")); setReveal(true); setPhase("report"); onDone?.("comps"); };
  const pick = (k: FlowKind) => {
    if (k === kind && phase === "report") return;
    prev.current = { kind, phase };
    setWrite(fresh(k));
    setKind(k); gcLeft.current = AUTO_MS; setGcPaused(false);
    setPhase(start(k));
  };

  const th = THEME[kind], steps = STEPS[kind], n = steps.length;
  const done = phase === "done";
  const prog = phase === "report" ? 1 : phase === "run" ? 0.06 + 0.86 * Math.min(step, n) / n : done ? 1 : 0;
  const rows = steps.concat(["Opening your report"]);
  const ri = done ? rows.length - 1 : Math.min(step, n - 1);
  const upGross = useMemo(() => (kind === "roi" ? upsideOf(l).sc.rec.gross : 0), [l, kind]);
  const cps = compsFor(l);
  const doneTitle = { comps: `${cps.sold.length} sold and ${cps.active.length} active\nproperties found`, ub: "Your report is ready", roi: `This property could\nbe worth ${shortPrice(upGross)}` }[kind];
  const loading = phase === "run" || phase === "done";

  // Paywall (Nimbus): Max Build / ROI reports are metered per property. Opening one spends
  // from the monthly allowance (with a usage toast); past that, the report still writes its
  // top part in front of the user and a veil offers a credit or the upsell. Comps only need
  // an active trial / plan. "Lock style" (Dev menu) sets how much shows: partial or full blur.
  const ent = useEntitlements();
  const pk = reportKey(l);
  const feat = kind === "ub" ? "maxBuild" as const : kind === "roi" ? "roi" as const : null;
  const acc = feat ? ent.access(feat, pk) : ent.access("comps");
  const locked = acc === "credit" || acc === "locked" || acc === "plan";
  useEffect(() => {
    if (phase !== "report" || !feat || acc !== "allowance") return;
    ent.spend(feat, pk);
    const n = ent.left(feat) - 1;
    onToast?.(`${PRICING.names[feat]} · ${n} of ${PRICING.allowance[feat]} left this month`, "neutral");
  }, [phase, kind, acc]); // eslint-disable-line react-hooks/exhaustive-deps
  const toComps = () => { if (onComps) { close(); onComps(); } else pick("comps"); };
  const unlock = () => {
    if (!feat) return;
    const was = ent.access(feat, pk);
    const a = ent.spend(feat, pk);
    if (a === "credit" || was === "credit") onToast?.(`${PRICING.names[feat]} unlocked · 1 credit used`, "positive");
  };

  return (
    <>
      {/* The workspace shade (canvas `wsShade`): tilts with the map area, see globals.css. */}
      <div data-ws-shade="" style={{ position: "fixed", top: 0, right: 0, bottom: 0, left: navW, zIndex: 150, pointerEvents: "none", borderRadius: 36, background: "rgb(245,243,243)", opacity: tilt && up ? 0.6 : 0, transition: "opacity .6s ease" }} />

      {/* The sheet (canvas `rptLayer`). */}
      <div style={{
        position: "fixed", top: 12, right: 0, bottom: 0, left: navW, zIndex: 160, borderRadius: "24px 24px 0 0", overflow: "hidden", background: "rgb(255,255,255)",
        transformOrigin: "50% 100%", boxShadow: "0 -10px 40px rgba(30,18,12,.10),0 0 0 .5px rgba(13,12,12,.08)",
        transition: `transform .7s ${EASE},opacity .35s ease,left .45s ${EASE}`,
        ...(up && tilt ? { transform: "none", opacity: 1, pointerEvents: "auto" } : { transform: "perspective(1800px) translateY(70%) rotateX(-18deg) scale(.96)", opacity: 0, pointerEvents: "none" }),
      }}>
        {/* Loading stage + "Let AI do the work" */}
        {(phase === "choose" || loading) && (
          <div style={{ position: "absolute", inset: 0, background: "rgb(255,255,255)" }}>
            <div style={{ position: "absolute", left: 18, right: 18, top: 0, zIndex: 2, height: 6, borderRadius: 9999, overflow: "hidden", background: "rgba(13,12,12,.04)", boxShadow: "inset 0px -2px 4px 0px rgba(13,12,12,.08)", transition: "opacity .45s ease", opacity: loading ? 1 : 0 }}>
              <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, borderRadius: 9999, background: th.bar, boxShadow: `0px 1px 5px 0px ${th.glow}`, width: `${(prog * 100).toFixed(2)}%`, transition: done ? `width .5s ${EASE}` : "width .7s linear" }} />
            </div>
            <BackToMap onClick={close} style={{ position: "absolute", left: 20, top: 16, zIndex: 3 }} />
            {phase === "choose" && (
              <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 32, padding: "0 24px", animation: `flowRise .7s ${EASE} .45s both` }}>
                <span style={{ flex: "none", width: 140, height: 140, borderRadius: 8, background: "url('/iso/sparkle.gif') center/cover no-repeat" }} />
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10, maxWidth: 460, textAlign: "center" }}>
                  <span style={{ font: "300 40px/48px var(--font-sans)", letterSpacing: "-.01em", color: "rgb(17,16,16)" }}>Let AI do the work</span>
                  <span style={{ font: "400 16px/22px var(--font-sans)", color: "rgb(77,71,69)", textWrap: "balance" as any }}>Get the strongest comps that our data suggests. You can further refine these.</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <button onClick={() => { got.add(gotKey(l, "comps")); setPhase("report"); onDone?.("comps"); }} className="btn-soft" style={css("width:200px;height:48px;padding:0 20px;border:none;border-radius:9999px;background:rgb(245,240,238);font:700 15px/20px var(--font-sans);color:rgb(17,16,16);cursor:pointer;white-space:nowrap")}>I&apos;ll comp myself</button>
                  <button onClick={() => compsNow()} onMouseEnter={() => setGcPaused(true)} onMouseLeave={() => setGcPaused(false)}
                    style={css("position:relative;width:200px;height:48px;overflow:hidden;border:none;border-radius:9999px;background:rgb(18,18,18);font:700 15px/20px var(--font-sans);color:rgb(253,252,252);cursor:pointer;white-space:nowrap")}>
                    {/* auto-run countdown fill (`gcRing`) */}
                    <span style={{ position: "absolute", inset: 0, transformOrigin: "0 50%", background: "linear-gradient(89.442deg,rgb(84,55,157) 0.06%,rgb(142,67,158) 97.94%)", animation: `gcFill ${AUTO_MS}ms linear both`, animationPlayState: gcPaused ? "paused" : "running" }} />
                    <span style={{ position: "relative", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0c.8 6.4 5.6 11.2 12 12-6.4.8-11.2 5.6-12 12-.8-6.4-5.6-11.2-12-12C6.4 11.2 11.2 6.4 12 0z" /></svg>Get comps
                    </span>
                  </button>
                </div>
              </div>
            )}
            {loading && (
              <div key={kind} style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 28, padding: "0 24px", animation: `flowRise .7s ${EASE} .5s both` }}>
                <span style={{ flex: "none", display: "block", ...(kind === "ub"
                  ? { width: 96, height: 96, borderRadius: 48, background: "url('/iso/radar.gif') 50% 50%/112.5% 112.5% no-repeat" }
                  : { width: 140, height: 140, borderRadius: 8, background: "url('/iso/sparkle.gif') center/cover no-repeat" }) }} />
                <div style={{ alignSelf: "stretch", display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
                  <span key={done ? "d" : "a"} style={{ display: "block", alignSelf: "stretch", animation: `stepIn .5s ${EASE} both`, font: "300 31px/40px var(--font-sans)", textAlign: "center", whiteSpace: "pre-line", textWrap: "balance" as any, color: "rgb(17,16,16)" }}>{done ? doneTitle : `Analyzing ${short}`}</span>
                  <div style={{ alignSelf: "stretch", height: 40, padding: "8px 0", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
                    <div key={ri} style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, height: 24, animation: `stepIn .45s ${EASE} both` }}>
                      <span style={{ flex: "none", width: 24, height: 24, display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <span style={{ width: 10, height: 10, borderRadius: 9999, background: th.dot, animation: done ? undefined : "ub-pulse 1.1s cubic-bezier(.4,0,.6,1) infinite" }} />
                      </span>
                      <span style={{ font: "400 15px/20px var(--font-sans)", whiteSpace: "nowrap", ...(done ? { color: "rgb(17,16,16)" } : {
                        color: "transparent", WebkitBackgroundClip: "text", backgroundClip: "text", backgroundSize: "250% 100%", backgroundRepeat: "no-repeat", animation: "lineShimmer 1.5s linear infinite",
                        backgroundImage: `linear-gradient(100deg,rgb(17,16,16) 0%,rgb(17,16,16) 40%,${th.dot} 50%,rgb(17,16,16) 60%,rgb(17,16,16) 100%)`,
                      }) }}>{rows[ri]}</span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* The report */}
        {phase === "report" && (
          <div key={kind} style={{ position: "absolute", inset: 0, zIndex: 6, display: "flex", flexDirection: "column", overflow: "hidden", background: "rgb(255,255,255)", animation: `flowRise .6s ${EASE} both` }}>
            <div style={{ flex: "none", display: "flex", flexWrap: "wrap", alignItems: "center", gap: "8px 12px", padding: "16px 20px", boxShadow: "inset 0 -1px 0 rgba(13,12,12,.06)" }}>
              <BackToMap onClick={close} style={{ flex: "none", width: 134, justifyContent: "center" }} />
              <div style={{ flex: "1 1 420px", minWidth: 0, display: "flex", justifyContent: "center" }}>
                <div className="no-scrollbar" style={{ maxWidth: "100%", display: "flex", alignItems: "center", gap: 4, height: 48, padding: 4, boxSizing: "border-box", borderRadius: 999, background: "rgb(255,255,255)", overflowX: "auto" }}>
                  {TABS.map(([k, label, ico]) => {
                    const on = k === kind;
                    return (
                      <button key={k} onClick={() => pick(k)} style={css("flex:none;display:flex;align-items:center;gap:8px;height:40px;padding:0 16px 0 6px;border:none;border-radius:9999px;cursor:pointer;white-space:nowrap;font:700 15px/20px var(--font-sans);transition:background .25s ease,color .25s ease;"
                        + (on ? "background:rgb(17,16,16);color:rgb(253,252,252)" : "background:none;color:rgb(17,16,16)"))}>
                        <span style={css("flex:none;width:28px;height:28px;border-radius:9999px;display:flex;align-items:center;justify-content:center;background:" + (on ? "rgba(253,252,252,.14)" : "rgb(245,240,238)"))}>
                          <span style={css("width:14px;height:14px;background:" + (on ? "rgb(253,252,252)" : "rgb(74,45,37)") + `;-webkit-mask:url('/ui/${ico}.svg') center/contain no-repeat;mask:url('/ui/${ico}.svg') center/contain no-repeat`)} />
                        </span>
                        {label}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div style={{ flex: "none", width: 134, display: "flex", justifyContent: "flex-end" }}>
                {onShare && (
                  <button onClick={onShare} title="Share report" style={css("flex:none;height:40px;padding:0 16px;display:flex;align-items:center;gap:8px;border:none;border-radius:9999px;background:rgb(18,18,18);font:700 14px/18px var(--font-sans);color:rgb(249,249,249);cursor:pointer;white-space:nowrap")}>
                    <span style={css("width:16px;height:16px;background:currentColor;-webkit-mask:url('/ui/share.svg') center/contain no-repeat;mask:url('/ui/share.svg') center/contain no-repeat")} />Share
                  </button>
                )}
              </div>
            </div>
            <div style={{ position: "relative", flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}>
              {kind === "comps" && <CompsReport l={l} reveal={reveal} />}
              {kind === "ub" && <UBReport l={l} write={write} onComps={toComps} />}
              {kind === "roi" && <UpsideReport l={l} write={write} onComps={toComps} />}
              {locked && <LockVeil key={kind} access={acc} feature={feat ?? "comps"} clear={ent.s.lockStyle === "blur" ? 0 : "42%"} onUnlock={unlock} onToast={onToast} />}
            </div>
          </div>
        )}
      </div>

      {/* Comps: confirm the subject property first (over the map, or over the sheet from its tab). */}
      {phase === "review" && (
        <CompsReview l={l} onClose={() => { if (raised && prev.current) { setKind(prev.current.kind); setPhase(prev.current.phase); } else close(); }} onConfirm={() => setPhase("choose")} />
      )}
    </>
  );
}

function BackToMap({ onClick, style }: { onClick: () => void; style?: React.CSSProperties }) {
  return (
    <button onClick={onClick} style={{ height: 40, display: "flex", alignItems: "center", gap: 8, padding: "0 16px 0 12px", border: "none", borderRadius: 9999, background: "rgb(245,240,238)", font: "700 14px/18px var(--font-sans)", color: "rgb(17,16,16)", cursor: "pointer", whiteSpace: "nowrap", ...style }}>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 12H4M10 6l-6 6 6 6" /></svg>
      Back to map
    </button>
  );
}
