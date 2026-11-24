"use client";
// Log in to Breezy on your computer: scan-to-link handoff (WhatsApp / Telegram Web style).
// Breezy users sign up on the iPhone (Apple or phone sign-in, no password), so the phone is
// the trusted device: the computer shows a one-time QR, the phone confirms with Face ID.
// Fallbacks: an emailed magic link, or a 6-digit code from the app. No password, no pricing.
// Everything goes through lib/auth/handoff.ts (mock). On approval, /home opens in context
// (lib/handoff/profile.ts).
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import QRCode from "qrcode";
import { handoff } from "@/lib/auth/handoff";
import { handoffProfile } from "@/lib/handoff/profile";
import { useApp } from "@/components/AppState";
import { Mark } from "@/components/handoff/BreezyEmail";
import { useMapCtx } from "@/components/map/MapProvider";
import { Place } from "@/lib/places";
import { Listing, OppType } from "@/lib/fake";
import { ringBBox } from "@/lib/geo";
import { Where, RadarSummary } from "@/components/onboarding/Scan";
import { OppPins } from "@/components/onboarding/OppPins";

type Mode = "qr" | "email" | "sent" | "code" | "approved";
const EMAIL_LINK = "your email link";

const INK = "rgb(18,18,18)", MUTED = "rgb(98,90,89)", PAPER = "rgb(253,252,252)", CLAY = "rgb(147,89,75)";
const QR_SIZE = 184;
const QR_BG = "rgb(253,251,250)";
const CARD_SHADOW = "0 8px 24px rgba(63,40,32,.10), 0 0 0 1px rgba(18,18,18,.08)";

export default function LoginPage() {
  const router = useRouter();
  const { user, finishOnboarding } = useApp();
  const first = user.name.split(" ")[0];
  const [mode, setMode] = useState<Mode>("qr");
  const stay = true; // 24 Nov review: no "Stay logged in" option; the session is kept
  const [by, setBy] = useState("");
  const [declined, setDeclined] = useState(false);
  const [sent, setSent] = useState<{ email: string; token: string } | null>(null);
  const [phone, setPhone] = useState(false);
  const [lan, setLan] = useState<string | null>(null);
  const [isLocal, setIsLocal] = useState(false);
  const qr = useQrToken(mode === "qr", lan);
  const live = useLiveBackdrop(mode === "approved");
  const scan = useScan(live);

  useEffect(() => {
    const local = /^(localhost|127\.|\[::1\])/.test(location.hostname);
    setIsLocal(local);
    if (local) handoff.lanOrigin().then(setLan);
  }, []);

  // Signed in: a check and who approved, a beat, then the map in context.
  const succeed = useCallback((who: string, via: "qr" | "magic" | "code") => {
    setBy(who); setMode("approved"); setPhone(false);
    handoff.signIn({ by: who, via }, stay);
    handoffProfile.arrive(who);
    finishOnboarding();
    setTimeout(() => router.push("/home"), 1300);
  }, [stay, router, finishOnboarding]);

  // The phone's answer to the current QR.
  useEffect(() => {
    if (mode !== "qr" || !qr.token) return;
    return handoff.watch(qr.token, a => {
      if (a.status === "approved") succeed(a.by, "qr");
      else { setDeclined(true); qr.refresh(); setTimeout(() => setDeclined(false), 5000); }
    });
  }, [mode, qr.token]); // eslint-disable-line react-hooks/exhaustive-deps

  // A magic link opened on this computer (/login?magic=…).
  useEffect(() => {
    const m = new URLSearchParams(location.search).get("magic");
    if (m) { history.replaceState(null, "", "/login"); succeed(EMAIL_LINK, "magic"); }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const approved = mode === "approved";
  return (
    <main className="bz-login" style={{ position: "fixed", inset: 0, zIndex: 100, background: live ? "transparent" : "rgb(246,239,236)", pointerEvents: "none" }}>
      <style>{LOGIN_CSS}</style>
      <Backdrop done={approved} live={live} />

      {/* The floating panel (the onboarding's card): welcome, the code, the other ways in */}
      <section className="bz-panel" aria-label="Log in to Breezy" style={{ position: "absolute", left: 32, top: 32, bottom: 32, zIndex: 2, width: PANEL_W, display: "flex", flexDirection: "column", borderRadius: 32, background: PAPER, boxShadow: "0 24px 64px rgba(40,26,20,.18), 0 0 0 1px rgba(18,18,18,.04)", overflow: "hidden", pointerEvents: "auto", animation: "riseIn .5s cubic-bezier(.2,.8,.2,1) both" }}>
        <div style={{ flex: 1, minHeight: 0, overflowY: "auto", display: "flex", flexDirection: "column", padding: "32px 40px 24px" }}>
          <header style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Mark size={28} color={INK} />
            <span role="img" aria-label="Breezy" style={{ width: 56, height: 21, background: INK, WebkitMask: "url(/brand/splash-wordmark.svg) left center/contain no-repeat", mask: "url(/brand/splash-wordmark.svg) left center/contain no-repeat" }} />
          </header>
          <h1 style={{ margin: "28px 0 8px", font: "300 38px/1.12 var(--font-sans)", letterSpacing: "-1px", color: INK, textWrap: "balance" } as React.CSSProperties}>
            {approved ? `Welcome back, ${first}` : "Welcome back to Breezy"}
          </h1>
          <p style={{ margin: 0, font: "400 15px/22px var(--font-sans)", color: MUTED, textWrap: "pretty" } as React.CSSProperties}>
            {approved ? `Opening ${scan.placeName}, with the homes you saved on your iPhone…` : "Your desk workspace for comps, ROI and reports. Log in with the iPhone you signed up on, no password."}
          </p>

          {/* The code (outline + a soft shadow, no rings), or the email / code form */}
          <div style={{ flex: 1, minHeight: 320, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 18, padding: "28px 0 8px", textAlign: "center" }}>
            {approved ? (
              <span role="status" className="bz-approve" style={{ width: QR_SIZE + 40, height: QR_SIZE + 40, borderRadius: 24, background: PAPER, boxShadow: CARD_SHADOW, display: "flex", alignItems: "center", justifyContent: "center", animation: "riseIn .4s cubic-bezier(.2,.8,.2,1) both" }}>
                <span style={{ width: 88, height: 88, borderRadius: 9999, background: "rgb(49,140,96)", display: "flex", alignItems: "center", justifyContent: "center" }}><i className="ph-bold ph-check" style={{ fontSize: 44, color: "#fff" }} /></span>
              </span>
            ) : mode === "qr" ? <QrCard svg={qr.svg} left={qr.left} ttl={qr.ttl} k={qr.token} /> : (
              <div style={{ width: "100%", display: "flex", justifyContent: "center", textAlign: "left" }}>
                {mode === "email" && <EmailForm onBack={() => setMode("qr")} onSent={(email, token) => { setSent({ email, token }); setMode("sent"); }} />}
                {mode === "sent" && sent && <Sent {...sent} onBack={() => setMode("qr")} onRetry={() => setMode("email")} />}
                {mode === "code" && <CodeForm onBack={() => setMode("qr")} onOk={who => succeed(who, "code")} />}
              </div>
            )}
            {(mode === "qr" || approved) && (
              <div style={{ display: "flex", flexDirection: "column", gap: 4, maxWidth: 340 }}>
                <span style={{ font: "700 17px/24px var(--font-sans)", color: INK }}>
                  {approved ? (by === EMAIL_LINK ? "Logged in with your email link" : `Approved on ${by}`) : "Scan with your iPhone"}
                </span>
                <span aria-live="polite" style={{ font: "400 14px/20px var(--font-sans)", color: declined && !approved ? CLAY : MUTED, textWrap: "pretty" } as React.CSSProperties}>
                  {approved ? "Your workspace is ready" : declined ? "Request declined on your iPhone. Here's a new code." : "Open Breezy, point the camera at the code and confirm with Face ID. It renews every minute."}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Footer, pinned like the onboarding card's: the other ways in */}
        {!approved && (
          <footer style={{ flex: "none", borderTop: "1px solid rgba(18,18,18,.08)", padding: "18px 40px 22px", display: "flex", flexDirection: "column", gap: 12 }}>
            {mode === "qr" && <>
              <span style={{ font: "400 14px/20px var(--font-sans)", color: MUTED }}>No phone nearby?</span>
              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={() => setMode("email")} className="btn-soft" style={{ flex: 1, height: 44, fontSize: 14 }}><i className="ph-bold ph-envelope-simple" />Email me a link</button>
                <button onClick={() => setMode("code")} className="btn-soft" style={{ flex: 1, height: 44, fontSize: 14 }}><i className="ph-bold ph-password" />Use a 6-digit code</button>
              </div>
            </>}
            <span style={{ font: "400 14px/20px var(--font-sans)", color: MUTED }}>New to Breezy? <b style={{ color: INK }}>Get the iPhone app</b></span>
          </footer>
        )}
      </section>

      {/* Right, over the map: where to scan (the onboarding's location step), then the radar read-out */}
      {!approved && (
        <aside className="bz-scan" aria-label="Scan your area" style={{ position: "absolute", right: 32, top: 32, zIndex: 2, width: SCAN_W, maxHeight: "calc(100% - 128px)", overflowY: "auto", borderRadius: 28, background: PAPER, boxShadow: "0 24px 64px rgba(40,26,20,.18), 0 0 0 1px rgba(18,18,18,.04)", pointerEvents: "auto", animation: "riseIn .5s .15s cubic-bezier(.2,.8,.2,1) both" }}>
          {scan.phase === "ask" ? (
            <Where onPick={scan.pick} logo={false} titleSize={28} title="Where do you mainly work?" body="We'll scan it for deals other agents miss while you log in."
              style={{ display: "flex", flexDirection: "column", gap: 18, padding: 28 }} />
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 20, padding: 28 }}>
              <RadarSummary label={scan.placeLabel} n={scan.n} total={scan.total} counts={scan.counts} onHover={scan.setHover} />
              <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 10px 10px 14px", borderRadius: 16, background: "rgb(247,244,242)" }}>
                <i className="ph-bold ph-qr-code" style={{ fontSize: 20 }} /><span style={{ flex: 1, font: "400 14px/19px var(--font-sans)" }}>Log in to open them on the big map.</span>
                <button onClick={scan.reset} className="btn-ghost" style={{ height: 30, padding: "0 10px", font: "700 13px/18px var(--font-sans)", color: INK }}>Change area</button>
              </div>
            </div>
          )}
        </aside>
      )}
      {scan.sweep && <RadarOnce {...scan.sweep} />}
      {live && <OppPins pulse items={scan.opps} shown={(_, i) => i < scan.n} lit={l => !scan.hover || l.opp === scan.hover} />}

      {/* Demo: approve from a simulated iPhone on this laptop (BroadcastChannel), or a real one on the same Wi-Fi in dev. */}
      {!approved && (
        <div style={{ position: "fixed", right: 20, bottom: 20, zIndex: 120, pointerEvents: "auto", display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 8 }}>
          {isLocal && lan && !phone && (
            <span title="Your iPhone must be on the same Wi-Fi" style={{ padding: "6px 12px", borderRadius: 9999, background: "rgba(253,252,252,.9)", boxShadow: "0 2px 8px rgba(40,26,20,.08)", font: "400 12px/16px var(--font-sans)", color: MUTED }}>
              Real iPhone: the QR opens <b style={{ color: INK }}>{lan.replace(/^https?:\/\//, "")}</b>
            </span>
          )}
          <button onClick={() => setPhone(p => !p)} className="btn-soft" style={{ height: 36, padding: "0 14px", fontSize: 13, background: phone ? INK : PAPER, color: phone ? PAPER : INK, boxShadow: "0 4px 12px rgba(40,26,20,.12)" }}>
            <i className="ph-bold ph-device-mobile" />{phone ? "Hide phone" : "Simulate phone"}
          </button>
        </div>
      )}
      {phone && (
        // Over the map on the right, so the code stays in view.
        <aside aria-label="Simulated iPhone" className="bz-sim" style={{ position: "fixed", right: 20, bottom: 68, pointerEvents: "auto", zIndex: 119, width: 390, height: "min(760px, calc(100vh - 100px))", borderRadius: 44, background: INK, padding: 10, boxShadow: "0 24px 60px rgba(30,18,12,.35)", animation: "riseIn .3s cubic-bezier(.2,.8,.2,1) both" }}>
          <iframe key={mode === "code" ? "code" : qr.token} title="Breezy on iPhone" src={mode === "code" ? `/link?mode=code&demo=1` : `/link?token=${qr.token}&demo=1`}
            style={{ width: "100%", height: "100%", border: 0, borderRadius: 34, background: PAPER }} />
        </aside>
      )}
    </main>
  );
}

/* ---------- The map and the scan ----------
   24 Nov reviews: the onboarding's layout, one floating panel on the left with the code (outline +
   a soft shadow, no rings), the live map full bleed behind it. On the right, over the map, the
   onboarding's location step asks where the agent works (search, Silver Lake / Echo Park, or the
   device's location); picking one frames the area with its inner-glow outline and plays the radar
   once: a single sweep round the area, the signal pins popping in as it passes, the read-out
   counting them (RadarSummary). Offline, the static Silver Lake image and fixed pins stand in. */
const PANEL_W = "min(480px, calc(100vw - 32px))";
const SCAN_W = 380;
const SWEEP_MS = 3600;
const LOGIN_CSS = `
@keyframes bzMarkIn { 0% { opacity: 0; transform: translateY(10px) scale(.7) } 70% { opacity: 1; transform: scale(1.05) } 100% { opacity: 1; transform: none } }
@keyframes bzPinPulse { 0% { transform: scale(.6); opacity: .55 } 100% { transform: scale(2.1); opacity: 0 } }
@keyframes bzApprove { 0% { box-shadow: 0 0 0 0 rgba(49,140,96,.3) } 100% { box-shadow: 0 0 0 30px rgba(49,140,96,0) } }
@keyframes bzSweepOnce { 0% { transform: translate(-50%,-50%) rotate(0deg); opacity: 1 } 88% { opacity: 1 } 100% { transform: translate(-50%,-50%) rotate(360deg); opacity: 0 } }
@keyframes bzFadeOnce { 0% { transform: translate(-50%,-50%); opacity: 0 } 10% { opacity: 1 } 85% { opacity: 1 } 100% { transform: translate(-50%,-50%); opacity: 0 } }
@keyframes bzPingOnce { 0% { transform: translate(-50%,-50%) scale(.2); opacity: .7 } 100% { transform: translate(-50%,-50%) scale(1); opacity: 0 } }
.bz-approve { animation: bzApprove 1.4s ease-out infinite }
@media (max-width: 1100px) { .bz-scan { display: none !important } }
@media (max-width: 900px) { .bz-pins { display: none !important } .bz-panel { left: 16px !important; top: 16px !important; bottom: 16px !important } }
@media (prefers-reduced-motion: reduce) { .bz-login * { animation-duration: .01ms !important; animation-iteration-count: 1 !important } }
`;
const pinHtml = (f: string, t: string, delay: number) =>
  `<div style="display:flex;flex-direction:column;align-items:center;animation:bzMarkIn .55s ${delay}s cubic-bezier(.2,.8,.2,1) both">`
  + `<span style="position:relative;display:block;width:30px;height:33px"><span style="position:absolute;left:3px;top:1px;width:24px;height:24px;border-radius:9999px;background:rgba(147,89,75,.35);animation:bzPinPulse 2.4s ${delay + 0.6}s ease-out infinite"></span><img src="/pins/${f}.svg" alt="" style="position:relative;width:30px;height:33px;display:block"/></span>`
  + `<span style="margin-top:2px;height:24px;padding:0 9px;display:flex;align-items:center;border-radius:9999px;background:${PAPER};box-shadow:0 2px 8px rgba(40,26,20,.16);font:700 12px/1 var(--font-sans);color:${INK};white-space:nowrap">${t}</span></div>`;
// Offline only: positions in % of the page, between the panel and the scan card.
const PINS: { x: number; y: number; f: string; t: string }[] = [
  { x: 44, y: 24, f: "drop", t: "12% price drop" },
  { x: 58, y: 16, f: "ub", t: "84% Underbuilt" },
  { x: 62, y: 46, f: "roi", t: "$1.6m ROI" },
  { x: 46, y: 62, f: "exp", t: "Expired 4 days ago" },
  { x: 66, y: 74, f: "comps", t: "$310k under comps" },
  { x: 52, y: 40, f: "stale", t: "193 DOM" },
  { x: 54, y: 88, f: "wd", t: "Withdrawn 3 days ago" },
];
const panelRight = () => Math.min(480, innerWidth - 32) + 32;
const mapPad = () => ({ left: innerWidth > 900 ? panelRight() + 48 : 24, right: innerWidth > 1100 ? SCAN_W + 32 + 48 : 48, top: 64, bottom: 64 });

function useLiveBackdrop(done: boolean) {
  const { map, ready, offline, setInset, setHeat, setAreaRings } = useMapCtx();
  const live = !!map && ready && !offline;
  useEffect(() => { setInset({ left: 0, top: 0, radius: 0 }); }, [setInset]);
  useEffect(() => {
    if (!live || !map) return;
    setHeat("roi"); setAreaRings(null);
    // Before a pick: Los Angeles, between the two cards.
    map.jumpTo({ center: [-118.33, 34.06], zoom: 11.3, pitch: 0, bearing: 0, padding: mapPad() });
    return () => {
      setAreaRings(null);
      map.jumpTo({ pitch: 0, bearing: 0, padding: { left: 0, right: 0, top: 0, bottom: 0 } });
    };
  }, [live, map]); // eslint-disable-line react-hooks/exhaustive-deps
  // Approved: the map leans in.
  useEffect(() => { if (live && map && done) map.easeTo({ zoom: map.getZoom() + 0.9, pitch: 40, duration: 1600, easing: t => 1 - Math.pow(1 - t, 3) }); }, [live, map, done]);
  return live;
}

/** The scan on the right: ask where, then frame the area and run the radar once. */
function useScan(live: boolean) {
  const app = useApp();
  const { map, setAreaRings } = useMapCtx();
  const [phase, setPhase] = useState<"ask" | "scan">("ask");
  const [n, setN] = useState(0);
  const [hover, setHover] = useState<OppType | null>(null);
  const [sweep, setSweep] = useState<{ x: number; y: number; r: number; k: number } | null>(null);
  // The first 24 homes, ordered clockwise from north round the centre, with their bearing.
  const ranked = useMemo(() => {
    if (phase !== "scan") return [] as { l: Listing; a: number }[];
    const L = app.listings.slice(0, 24), c = app.place.center;
    return L.map(l => ({ l, a: ((Math.atan2((l.lng - c[0]) * Math.cos(c[1] * Math.PI / 180), l.lat - c[1]) * 180) / Math.PI + 360) % 360 })).sort((x, y) => x.a - y.a);
  }, [phase, app.listings, app.place]);
  const opps = useMemo(() => ranked.map(x => x.l), [ranked]);

  const pick = useCallback(async (p: Place) => { await app.choosePlace(p); setN(0); setPhase("scan"); }, [app]);
  const reset = useCallback(() => { setPhase("ask"); setN(0); setSweep(null); setHover(null); setAreaRings(null); }, [setAreaRings]);

  useEffect(() => {
    if (phase !== "scan") return;
    const timers: ReturnType<typeof setTimeout>[] = [];
    const run = () => {
      // One sweep, starting at north; each pin pops in as the beam passes its bearing.
      ranked.forEach((x, i) => timers.push(setTimeout(() => setN(i + 1), 250 + (x.a / 360) * SWEEP_MS)));
      timers.push(setTimeout(() => setSweep(null), SWEEP_MS + 600));
    };
    if (!live || !map) { run(); return () => timers.forEach(clearTimeout); }
    setAreaRings(app.rings);
    const pts = opps.map(l => [l.lng, l.lat] as [number, number]);
    const bb = pts.length ? ringBBox([pts]) : app.rings?.length ? ringBBox(app.rings) : app.place.bbox;
    const go = () => {
      const c = map.project(app.place.center);
      const r = Math.max(160, ...opps.map(l => { const q = map.project([l.lng, l.lat]); return Math.hypot(q.x - c.x, q.y - c.y); })) + 60;
      setSweep({ x: c.x, y: c.y, r, k: Date.now() });
      run();
    };
    map.once("moveend", go);
    if (bb) map.fitBounds([[bb[0], bb[1]], [bb[2], bb[3]]], { padding: mapPad(), maxZoom: 15, duration: 1100 });
    else map.flyTo({ center: app.place.center, zoom: 13.4, duration: 1100 });
    return () => { map.off("moveend", go); timers.forEach(clearTimeout); };
  }, [phase, ranked, live, map]); // eslint-disable-line react-hooks/exhaustive-deps

  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    opps.slice(0, n).forEach(l => { c[l.opp] = (c[l.opp] || 0) + 1; });
    return c;
  }, [opps, n]);
  return { phase, pick, reset, n, total: opps.length, counts, hover, setHover, opps, sweep, placeLabel: app.place.label, placeName: phase === "scan" ? app.place.name : "Silver Lake" };
}

/** The radar, once: a clay beam turning a full circle round the area, and one ring going out. */
function RadarOnce({ x, y, r, k }: { x: number; y: number; r: number; k: number }) {
  const d = r * 2;
  return (
    <div key={k} aria-hidden style={{ position: "absolute", inset: 0, zIndex: 1, overflow: "hidden", pointerEvents: "none" }}>
      <span style={{ position: "absolute", left: x, top: y, width: d, height: d, borderRadius: "50%", boxShadow: "inset 0 0 0 1.5px rgba(147,89,75,.35)", background: "radial-gradient(circle, rgba(175,127,113,.08), rgba(175,127,113,0) 70%)", animation: `bzPingOnce ${SWEEP_MS + 600}ms ease-out both`, animationName: "bzFadeOnce" }} />
      <span style={{ position: "absolute", left: x, top: y, width: d, height: d, borderRadius: "50%", background: "conic-gradient(from 0deg, rgba(147,89,75,0) 0deg, rgba(147,89,75,0) 270deg, rgba(147,89,75,.42) 358deg, rgba(147,89,75,.85) 359.5deg, rgba(147,89,75,0) 360deg)", animation: `bzSweepOnce ${SWEEP_MS}ms linear both` }} />
      {[0, 900].map(t => <span key={t} style={{ position: "absolute", left: x, top: y, width: d, height: d, borderRadius: "50%", border: "1.5px solid rgba(175,127,113,.5)", animation: `bzPingOnce 2.4s ${t}ms ease-out both` }} />)}
    </div>
  );
}

function Backdrop({ done, live }: { done: boolean; live: boolean }) {
  if (live) return null;
  return (
    <div aria-hidden style={{ position: "absolute", inset: 0, overflow: "hidden", pointerEvents: "none" }}>
      <div style={{ position: "absolute", inset: "-4%", background: "url(/map/silverlake.jpg) center/cover", filter: "saturate(.6)", transform: done ? "scale(1.12)" : undefined, transition: "transform 1.6s cubic-bezier(.2,.8,.2,1)" }} />
      <div className="bz-pins">
        {PINS.map((p, k) => (
          <span key={p.t} style={{ position: "absolute", left: `${p.x}%`, top: `${p.y}%`, transform: "translate(-50%,-100%)" }} dangerouslySetInnerHTML={{ __html: pinHtml(p.f, p.t, 0.5 + k * 0.3) }} />
        ))}
      </div>
    </div>
  );
}

/** A one-time QR token that renews itself every ~60 s while shown. */
function useQrToken(on: boolean, lan: string | null) {
  const [token, setToken] = useState("");
  const [exp, setExp] = useState(0);
  const [svg, setSvg] = useState("");
  const [now, setNow] = useState(Date.now());
  const [n, setN] = useState(0);
  const refresh = useCallback(() => setN(x => x + 1), []);
  useEffect(() => {
    if (!on) return;
    let alive = true;
    handoff.create("qr").then(async r => {
      if (!alive) return;
      const origin = lan || location.origin;
      const s = await QRCode.toString(`${origin}/link?token=${r.token}`, { type: "svg", errorCorrectionLevel: "H", margin: 0, color: { dark: "#121212", light: "#0000" } });
      if (!alive) return;
      setToken(r.token); setExp(r.expiresAt); setSvg(s);
    });
    return () => { alive = false; };
  }, [on, n, lan]);
  useEffect(() => {
    if (!on || !exp) return;
    const t = setInterval(() => { const t0 = Date.now(); setNow(t0); if (t0 >= exp - 400) refresh(); }, 250);
    return () => clearInterval(t);
  }, [on, exp, refresh]);
  return { token, svg, left: Math.max(0, exp - now), ttl: 60_000, refresh };
}

function QrCard({ svg, left, ttl, k }: { svg: string; left: number; ttl: number; k: string }) {
  const R = 15, C = 2 * Math.PI * R;
  return (
    <div style={{ position: "relative", flex: "none", width: QR_SIZE + 40, height: QR_SIZE + 40, borderRadius: 24, background: QR_BG, boxShadow: CARD_SHADOW, display: "flex", alignItems: "center", justifyContent: "center" }}>
      {svg ? (
        <div key={k} role="img" aria-label="QR code: scan it with the Breezy app on your iPhone to log in on this computer. Or use the email link or a 6-digit code below."
          style={{ width: QR_SIZE, height: QR_SIZE, animation: "fadeIn .5s ease both" }} dangerouslySetInnerHTML={{ __html: svg.replace("<svg", `<svg width="${QR_SIZE}" height="${QR_SIZE}"`) }} />
      ) : <span style={{ width: QR_SIZE, height: QR_SIZE, borderRadius: 12, background: "linear-gradient(90deg,rgba(18,18,18,.04),rgba(18,18,18,.08),rgba(18,18,18,.04))", backgroundSize: "200% 100%", animation: "lineShimmer 1.2s linear infinite" }} />}
      {/* The Breezy mark in the middle (error correction H leaves room for it). */}
      {svg && <span aria-hidden style={{ position: "absolute", width: 48, height: 48, borderRadius: 13, background: QR_BG, boxShadow: `0 0 0 5px ${QR_BG}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <span style={{ width: 34, height: 34, background: INK, WebkitMask: "url(/brand/brandmark.svg) center/contain no-repeat", mask: "url(/brand/brandmark.svg) center/contain no-repeat" }} />
      </span>}
      {/* Countdown ring: a quiet hint the code renews by itself. */}
      {svg && <svg aria-hidden width="36" height="36" viewBox="0 0 36 36" style={{ position: "absolute", right: -10, top: -10, borderRadius: 9999, background: PAPER, boxShadow: "0 2px 8px rgba(40,26,20,.12)" }}>
        <circle cx="18" cy="18" r={R} fill="none" stroke="rgba(18,18,18,.08)" strokeWidth="2.5" />
        <circle cx="18" cy="18" r={R} fill="none" stroke={INK} strokeWidth="2.5" strokeLinecap="round" strokeDasharray={C} strokeDashoffset={C * (1 - left / ttl)} transform="rotate(-90 18 18)" style={{ transition: "stroke-dashoffset .25s linear" }} />
        <text x="18" y="22" textAnchor="middle" style={{ font: "700 10px/1 var(--font-sans)", fill: INK }}>{Math.ceil(left / 1000)}</text>
      </svg>}
    </div>
  );
}

function LinkBtn({ onClick, icon, children }: { onClick: () => void; icon: string; children: React.ReactNode }) {
  return (
    <button onClick={onClick} className="btn-ghost" style={{ display: "flex", alignItems: "center", gap: 8, height: 36, padding: "0 14px", font: "700 14px/20px var(--font-sans)", color: INK }}>
      <i className={`ph-bold ph-${icon}`} style={{ fontSize: 16 }} />{children}
    </button>
  );
}

const Back = ({ onClick }: { onClick: () => void }) => (
  <button onClick={onClick} className="btn-ghost" style={{ alignSelf: "flex-start", display: "flex", alignItems: "center", gap: 6, height: 32, padding: "0 10px", margin: "0 0 0 -10px", font: "400 14px/20px var(--font-sans)", color: MUTED }}>
    <i className="ph-bold ph-arrow-left" />Back to QR code
  </button>
);
const Title = ({ children }: { children: React.ReactNode }) => <h2 style={{ margin: 0, font: "300 28px/1.15 var(--font-sans)", letterSpacing: "-.6px", color: INK }}>{children}</h2>;
const Body = ({ children }: { children: React.ReactNode }) => <p style={{ margin: 0, font: "400 15px/22px var(--font-sans)", color: MUTED, textWrap: "pretty" } as React.CSSProperties}>{children}</p>;
const panel: React.CSSProperties = { width: "100%", maxWidth: 360, display: "flex", flexDirection: "column", gap: 16, animation: "stepIn .3s cubic-bezier(.2,.8,.2,1) both" };

function EmailForm({ onBack, onSent }: { onBack: () => void; onSent: (email: string, token: string) => void }) {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const ok = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  const send = async (e: React.FormEvent) => {
    e.preventDefault(); if (!ok) return;
    setBusy(true);
    const r = await handoff.create("magic", email);
    onSent(email, r.token);
  };
  return (
    <form onSubmit={send} style={panel}>
      <Back onClick={onBack} />
      <Title>Email me a link</Title>
      <Body>Use the email on your Breezy account. The link works once, for 15 minutes.</Body>
      <input autoFocus type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" aria-label="Email address"
        style={{ height: 48, padding: "0 16px", border: "none", borderRadius: 14, boxShadow: "inset 0 0 0 1px rgb(226,219,216)", background: PAPER, font: "400 16px/20px var(--font-sans)", color: INK, outline: "none" }} />
      <button type="submit" disabled={!ok || busy} className="btn-dark" style={{ opacity: ok ? 1 : .4 }}>
        {busy && <i className="ph-bold ph-circle-notch" style={{ animation: "spin .8s linear infinite" }} />}Send link
      </button>
    </form>
  );
}

function Sent({ email, token, onBack, onRetry }: { email: string; token: string; onBack: () => void; onRetry: () => void }) {
  return (
    <div style={panel}>
      <Back onClick={onBack} />
      <img src="/iso/empty-search.png" alt="" style={{ width: 96, alignSelf: "flex-start" }} />
      <Title>Check your inbox</Title>
      <Body>We sent a link to <b style={{ color: INK }}>{email}</b>. Open it on this computer to log in. It works once, for 15 minutes.</Body>
      <div style={{ display: "flex", gap: 10, padding: "12px 14px", borderRadius: 14, background: "rgb(245,241,238)", font: "400 13px/19px var(--font-sans)", color: INK }}>
        <i className="ph-bold ph-apple-logo" style={{ flex: "none", fontSize: 16, marginTop: 1 }} />
        <span>If you signed up with Apple and chose <b>Hide My Email</b>, check the address Apple forwards to you.</span>
      </div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button onClick={onRetry} className="btn-soft" style={{ height: 40, fontSize: 14 }}>Use a different email</button>
        {/* Demo: stands in for clicking the link in the email. */}
        <a href={`/login?magic=${token}`} className="btn-soft" style={{ height: 40, fontSize: 14, textDecoration: "none", border: "1px dashed rgba(18,18,18,.25)", background: "transparent" }}>
          <i className="ph-bold ph-flask" />Demo: open the email link
        </a>
      </div>
    </div>
  );
}

function CodeForm({ onBack, onOk }: { onBack: () => void; onOk: (by: string) => void }) {
  const [d, setD] = useState<string[]>(Array(6).fill(""));
  const [err, setErr] = useState(false);
  const [busy, setBusy] = useState(false);
  const refs = useRef<(HTMLInputElement | null)[]>([]);
  const submit = async (code: string) => {
    setBusy(true); setErr(false);
    const a = await handoff.redeemCode(code);
    setBusy(false);
    if (a) onOk(a.by);
    else { setErr(true); setD(Array(6).fill("")); refs.current[0]?.focus(); }
  };
  const put = (i: number, v: string) => {
    const digits = v.replace(/\D/g, "");
    if (!digits) { const n = [...d]; n[i] = ""; setD(n); return; }
    const n = [...d];
    for (let k = 0; k < digits.length && i + k < 6; k++) n[i + k] = digits[k];
    setD(n); setErr(false);
    const next = Math.min(5, i + digits.length);
    refs.current[next]?.focus();
    if (n.every(Boolean)) submit(n.join(""));
  };
  return (
    <div style={panel}>
      <Back onClick={onBack} />
      <Title>Enter your code</Title>
      <Body>In Breezy on your iPhone, open <b style={{ color: INK }}>Profile → Log in on a computer → Use a code</b>, then type the 6 digits here.</Body>
      <div role="group" aria-label="6-digit code" style={{ display: "flex", gap: 8 }} onPaste={e => { e.preventDefault(); put(0, e.clipboardData.getData("text")); }}>
        {d.map((v, i) => (
          <input key={i} ref={el => { refs.current[i] = el; }} autoFocus={i === 0} inputMode="numeric" autoComplete={i === 0 ? "one-time-code" : "off"} maxLength={6} value={v} aria-label={`Digit ${i + 1}`} disabled={busy}
            onChange={e => put(i, e.target.value)}
            onKeyDown={e => { if (e.key === "Backspace" && !v && i > 0) { refs.current[i - 1]?.focus(); const n = [...d]; n[i - 1] = ""; setD(n); } if (e.key === "ArrowLeft" && i > 0) refs.current[i - 1]?.focus(); if (e.key === "ArrowRight" && i < 5) refs.current[i + 1]?.focus(); }}
            style={{ width: 0, flex: 1, height: 56, border: "none", borderRadius: 14, boxShadow: `inset 0 0 0 ${err ? 2 : 1}px ${err ? CLAY : "rgb(226,219,216)"}`, background: PAPER, textAlign: "center", font: "400 24px/1 var(--font-sans)", color: INK, outline: "none", ...(i === 3 ? { marginLeft: 8 } : {}) }} />
        ))}
      </div>
      <span aria-live="polite" style={{ minHeight: 20, font: "400 13px/20px var(--font-sans)", color: err ? CLAY : MUTED }}>
        {busy ? "Checking…" : err ? "That code didn't work. Codes last 5 minutes; get a new one in the app." : "Paste works too."}
      </span>
    </div>
  );
}
