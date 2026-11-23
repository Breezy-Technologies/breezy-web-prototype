"use client";
// Log in to Breezy on your computer: scan-to-link handoff (WhatsApp / Telegram Web style).
// Breezy users sign up on the iPhone (Apple or phone sign-in, no password), so the phone is
// the trusted device: the computer shows a one-time QR, the phone confirms with Face ID.
// Fallbacks: an emailed magic link, or a 6-digit code from the app. No password, no pricing.
// Everything goes through lib/auth/handoff.ts (mock). On approval, /home opens in context
// (lib/handoff/profile.ts).
import React, { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import QRCode from "qrcode";
import { handoff } from "@/lib/auth/handoff";
import { handoffProfile } from "@/lib/handoff/profile";
import { useApp } from "@/components/AppState";
import { Mark } from "@/components/handoff/BreezyEmail";
import { useMapCtx } from "@/components/map/MapProvider";
import mapboxgl from "mapbox-gl";

type Mode = "qr" | "email" | "sent" | "code" | "approved";
const EMAIL_LINK = "your email link";

const INK = "rgb(18,18,18)", MUTED = "rgb(98,90,89)", PAPER = "rgb(253,252,252)", CLAY = "rgb(147,89,75)";
const QR_SIZE = 184;
const QR_BG = "rgb(253,251,250)";

export default function LoginPage() {
  const router = useRouter();
  const { user, finishOnboarding } = useApp();
  const first = user.name.split(" ")[0];
  const [mode, setMode] = useState<Mode>("qr");
  const [stay, setStay] = useState(true);
  const [by, setBy] = useState("");
  const [declined, setDeclined] = useState(false);
  const [sent, setSent] = useState<{ email: string; token: string } | null>(null);
  const [phone, setPhone] = useState(false);
  const [lan, setLan] = useState<string | null>(null);
  const [isLocal, setIsLocal] = useState(false);
  const qr = useQrToken(mode === "qr", lan);
  const live = useLiveBackdrop(mode === "approved");

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
    <main className="bz-login" style={{ position: "fixed", inset: 0, zIndex: 100, overflowY: "auto", background: live ? "transparent" : "rgb(246,239,236)" }}>
      <style>{LOGIN_CSS}</style>
      <Backdrop done={approved} live={live} />
      {/* Logo lockup (Figma "Web experience 1.9", 5062:92652) */}
      <header style={{ position: "absolute", left: 32, top: 28, zIndex: 2, display: "flex", alignItems: "center", gap: 8 }}>
        <Mark size={30} color={INK} />
        <span role="img" aria-label="Breezy" style={{ width: 60, height: 22, background: INK, WebkitMask: "url(/brand/splash-wordmark.svg) left center/contain no-repeat", mask: "url(/brand/splash-wordmark.svg) left center/contain no-repeat" }} />
      </header>

      <div className="bz-cols" style={{ position: "relative", zIndex: 1, minHeight: "100%", display: "grid", gridTemplateColumns: "1fr 1fr", alignItems: "center", padding: "96px 32px 48px", boxSizing: "border-box" }}>
        {/* Left: welcome + the other ways in */}
        <section style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", gap: 28 }}>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 14, maxWidth: 420, animation: "riseIn .5s cubic-bezier(.2,.8,.2,1) both" }}>
            <h1 style={{ margin: 0, font: "300 48px/1.15 var(--font-sans)", letterSpacing: "-1.2px", color: INK, textWrap: "balance" } as React.CSSProperties}>
              {approved ? <>Welcome back,<br />{first}</> : <>Welcome back<br />to Breezy</>}
            </h1>
            <p style={{ margin: 0, font: "400 17px/24px var(--font-sans)", color: INK, textWrap: "pretty" } as React.CSSProperties}>
              {approved ? "Opening Silver Lake, with the homes you saved on your iPhone…" : "Your desk workspace for comps, ROI and reports. Log in with the iPhone you signed up on, no password."}
            </p>
          </div>
          {!approved && (mode === "qr" ? (
            <div style={{ width: 392, maxWidth: "100%", display: "flex", flexDirection: "column", gap: 10, animation: "riseIn .5s .08s cubic-bezier(.2,.8,.2,1) both" }}>
              <span style={{ font: "400 14px/20px var(--font-sans)", color: MUTED, margin: "0 0 4px" }}>No phone nearby?</span>
              <button onClick={() => setMode("email")} className="btn-dark" style={{ height: 44 }}><i className="ph-bold ph-envelope-simple" />Email me a link</button>
              <button onClick={() => setMode("code")} className="btn-dark" style={{ height: 44 }}><i className="ph-bold ph-password" />Use a 6-digit code</button>
              <label style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10, marginTop: 10, font: "400 14px/20px var(--font-sans)", color: INK, cursor: "pointer", userSelect: "none" }}>
                <input type="checkbox" checked={stay} onChange={e => setStay(e.target.checked)} style={{ width: 18, height: 18, accentColor: INK, margin: 0 }} />
                Stay logged in on this browser
              </label>
              <span style={{ marginTop: 6, font: "400 15px/22px var(--font-sans)", color: INK }}>New to Breezy? <b>Get the app on your iPhone</b></span>
            </div>
          ) : (
            <div style={{ width: 392, maxWidth: "100%", display: "flex", justifyContent: "center", textAlign: "left" }}>
              {mode === "email" && <EmailForm onBack={() => setMode("qr")} onSent={(email, token) => { setSent({ email, token }); setMode("sent"); }} />}
              {mode === "sent" && sent && <Sent {...sent} onBack={() => setMode("qr")} onRetry={() => setMode("email")} />}
              {mode === "code" && <CodeForm onBack={() => setMode("qr")} onOk={who => succeed(who, "code")} />}
            </div>
          ))}
        </section>

        {/* Right: the code, in the radar's rings */}
        <section style={{ position: "relative", display: "flex", alignItems: "center", justifyContent: "center", minHeight: 640 }}>
          <Rings done={approved} />
          <div style={{ position: "relative", display: "flex", flexDirection: "column", alignItems: "center", gap: 18, textAlign: "center", animation: "riseIn .55s .1s cubic-bezier(.2,.8,.2,1) both" }}>
            {approved ? (
              <span role="status" className="bz-approve" style={{ width: QR_SIZE + 40, height: QR_SIZE + 40, borderRadius: 24, background: "rgba(241,233,230,.92)", display: "flex", alignItems: "center", justifyContent: "center", animation: "riseIn .4s cubic-bezier(.2,.8,.2,1) both" }}>
                <span style={{ width: 88, height: 88, borderRadius: 9999, background: "rgb(49,140,96)", display: "flex", alignItems: "center", justifyContent: "center" }}><i className="ph-bold ph-check" style={{ fontSize: 44, color: "#fff" }} /></span>
              </span>
            ) : mode === "qr" ? <QrCard svg={qr.svg} left={qr.left} ttl={qr.ttl} k={qr.token} /> : (
              <span style={{ width: QR_SIZE + 40, height: QR_SIZE + 40, borderRadius: 24, background: "rgba(241,233,230,.85)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <i className={`ph-bold ph-${mode === "code" ? "password" : "envelope-simple-open"}`} style={{ fontSize: 56, color: CLAY }} />
              </span>
            )}
            <div style={{ display: "flex", flexDirection: "column", gap: 6, maxWidth: 340, padding: "12px 18px", borderRadius: 18, background: "rgba(253,251,250,.84)", backdropFilter: "blur(12px)", boxShadow: "0 8px 24px rgba(63,40,32,.12)" }}>
              <span style={{ font: "400 18px/24px var(--font-sans)", color: INK }}>
                {approved ? (by === EMAIL_LINK ? "Logged in with your email link" : `Approved on ${by}`) : mode === "qr" ? "Scan with your iPhone" : mode === "code" ? "Get the code on your iPhone" : "Check the email on your account"}
              </span>
              <span aria-live="polite" style={{ font: "400 14px/20px var(--font-sans)", color: declined && mode === "qr" ? CLAY : INK }}>
                {approved ? "Your workspace is ready" : mode === "qr"
                  ? (declined ? "Request declined on your iPhone. Here's a new code." : "Open Breezy, point the camera at this code and confirm with Face ID. It renews every minute.")
                  : mode === "code" ? "In the app: Profile → Log in on a computer → Use a code." : "The link works once, for 15 minutes."}
              </span>
            </div>
          </div>
        </section>
      </div>

      {/* Demo: approve from a simulated iPhone on this laptop (BroadcastChannel), or a real one on the same Wi-Fi in dev. */}
      {!approved && (
        <div style={{ position: "fixed", right: 20, bottom: 20, zIndex: 120, display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 8 }}>
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
        // Over the left column, so the code stays in view.
        <aside aria-label="Simulated iPhone" className="bz-sim" style={{ position: "fixed", bottom: 24, zIndex: 119, width: 390, height: "min(760px, calc(100vh - 48px))", borderRadius: 44, background: INK, padding: 10, boxShadow: "0 24px 60px rgba(30,18,12,.35)", animation: "riseIn .3s cubic-bezier(.2,.8,.2,1) both" }}>
          <iframe key={mode === "code" ? "code" : qr.token} title="Breezy on iPhone" src={mode === "code" ? `/link?mode=code&demo=1` : `/link?token=${qr.token}&demo=1`}
            style={{ width: "100%", height: "100%", border: 0, borderRadius: 34, background: PAPER }} />
        </aside>
      )}
    </main>
  );
}

/* ---------- The backdrop and the rings ----------
   Figma "Web experience 1.9" (5062:92652): blush paper, the welcome on the left, the QR in
   concentric rings on the right. Behind it all, full bleed, the Silver Lake map from the phone,
   washed in blush and drifting slowly, with the signal pins popping in (Ann's activation
   prototype: teardrop markers + label pills). The rings carry the radar sweep and pulse; on
   approval the map leans in and the sweep speeds up. */
const LOGIN_CSS = `
@keyframes bzScanRing { 0% { transform: scale(1); opacity: .55 } 100% { transform: scale(1.3); opacity: 0 } }
@keyframes bzPinIn { 0% { opacity: 0; transform: translate(-50%, -100%) translateY(10px) scale(.7) } 70% { opacity: 1; transform: translate(-50%, -100%) scale(1.05) } 100% { opacity: 1; transform: translate(-50%, -100%) scale(1) } }
@keyframes bzDrift { from { transform: scale(1.06) translate(0, 0) } to { transform: scale(1.06) translate(-1.6%, -1.2%) } }
@keyframes bzRingPulse { 0% { transform: translate(-50%, -50%) scale(.55); opacity: .5 } 100% { transform: translate(-50%, -50%) scale(1.25); opacity: 0 } }
@keyframes bzMarkIn { 0% { opacity: 0; transform: translateY(10px) scale(.7) } 70% { opacity: 1; transform: scale(1.05) } 100% { opacity: 1; transform: none } }
@keyframes bzApprove { 0% { box-shadow: 0 0 0 0 rgba(49,140,96,.3) } 100% { box-shadow: 0 0 0 30px rgba(49,140,96,0) } }
.bz-approve { animation: bzApprove 1.4s ease-out infinite }
.bz-sim { left: 32px }
@media (max-width: 960px) { .bz-cols { grid-template-columns: 1fr !important; gap: 24px } .bz-pins { display: none } .bz-sim { left: auto; right: 20px; bottom: 68px } }
@media (prefers-reduced-motion: reduce) { .bz-login * { animation-duration: .01ms !important; animation-iteration-count: 1 !important } }
`;
// Positions in % of the page, kept out of the two columns' content.
const PINS: { x: number; y: number; f: string; t: string }[] = [
  { x: 9, y: 22, f: "drop", t: "12% price drop" },
  { x: 47, y: 13, f: "ub", t: "84% Underbuilt" },
  { x: 92, y: 18, f: "roi", t: "$1.6m ROI" },
  { x: 7, y: 78, f: "exp", t: "Expired 4 days ago" },
  { x: 49, y: 88, f: "wd", t: "Withdrawn 3 days ago" },
  { x: 93, y: 74, f: "comps", t: "$310k under comps" },
  { x: 28, y: 92, f: "stale", t: "193 DOM" },
];

/** The live map, full bleed (23 Nov review: "the map on full bleed in the background"): the
 *  shared Mapbox map from the root layout, on Silver Lake, tilted, ROI heat on, turning slowly,
 *  with the signal pins anchored on it; on approval it flies in. Offline (no token / style
 *  error) the static Silver Lake image stands in. Returns whether the live map is showing. */
const SL: [number, number] = [-118.2712, 34.0868];
// Offsets from the centre in degrees, on a ring round the code (the card covers the middle).
const MAP_PINS: { d: [number, number]; f: string; t: string }[] = [
  { d: [-0.0112, 0.0058], f: "drop", t: "12% price drop" },
  { d: [0.0006, 0.0092], f: "ub", t: "84% Underbuilt" },
  { d: [0.0118, 0.0052], f: "roi", t: "$1.6m ROI" },
  { d: [-0.0128, -0.0028], f: "exp", t: "Expired 4 days ago" },
  { d: [0.0132, -0.0034], f: "comps", t: "$310k under comps" },
  { d: [-0.0068, -0.0086], f: "stale", t: "193 DOM" },
  { d: [0.0062, -0.0094], f: "wd", t: "Withdrawn 3 days ago" },
];
function useLiveBackdrop(done: boolean) {
  const { map, ready, offline, setInset, setHeat, setAreaRings } = useMapCtx();
  const live = !!map && ready && !offline;
  useEffect(() => { setInset({ left: 0, top: 0, radius: 0 }); }, [setInset]);
  useEffect(() => {
    if (!live || !map) return;
    setHeat("roi"); setAreaRings(null);
    // Keep Silver Lake in the right half, behind the code; the welcome reads on the wash.
    const pad = () => ({ left: Math.round(innerWidth * 0.34), right: 0, top: 0, bottom: 0 });
    map.jumpTo({ center: SL, zoom: 14.1, pitch: 50, bearing: -24, padding: pad() });
    const markers = MAP_PINS.map((p, k) => {
      const el = document.createElement("div");
      el.style.cssText = "display:flex;flex-direction:column;align-items:center;pointer-events:none";
      el.innerHTML = `<div style="display:flex;flex-direction:column;align-items:center;animation:bzMarkIn .55s ${0.6 + k * 0.3}s cubic-bezier(.2,.8,.2,1) both"><img src="/pins/${p.f}.svg" alt="" style="width:30px;height:33px;display:block"/><span style="margin-top:2px;height:24px;padding:0 9px;display:flex;align-items:center;border-radius:9999px;background:${PAPER};box-shadow:0 2px 8px rgba(40,26,20,.16);font:700 12px/1 var(--font-sans);color:${INK};white-space:nowrap">${p.t}</span></div>`;
      return new mapboxgl.Marker({ element: el, anchor: "bottom", occludedOpacity: 1 } as mapboxgl.MarkerOptions).setLngLat([SL[0] + p.d[0], SL[1] + p.d[1]]).addTo(map);
    });
    // The slow turn: a few degrees a second, paused while the tab is hidden.
    let raf = 0, last = performance.now();
    const spin = (t: number) => { const dt = Math.min(64, t - last); last = t; if (!map.isMoving()) map.setBearing(map.getBearing() + dt * 0.0024); raf = requestAnimationFrame(spin); };
    raf = requestAnimationFrame(spin);
    const onResize = () => map.setPadding(pad());
    addEventListener("resize", onResize);
    return () => {
      cancelAnimationFrame(raf); removeEventListener("resize", onResize);
      markers.forEach(m => m.remove());
      map.jumpTo({ pitch: 0, bearing: 0, padding: { left: 0, right: 0, top: 0, bottom: 0 } });
    };
  }, [live, map]); // eslint-disable-line react-hooks/exhaustive-deps
  // Approved: the map leans in.
  useEffect(() => { if (live && map && done) map.easeTo({ zoom: 15.4, pitch: 58, duration: 1800, easing: t => 1 - Math.pow(1 - t, 3) }); }, [live, map, done]);
  return live;
}

function Backdrop({ done, live }: { done: boolean; live: boolean }) {
  return (
    <div aria-hidden style={{ position: "absolute", inset: 0, overflow: "hidden", pointerEvents: "none" }}>
      {!live && <div style={{ position: "absolute", inset: "-4%", transform: done ? "scale(1.14)" : undefined, transition: "transform 1.6s cubic-bezier(.2,.8,.2,1)" }}>
        <div style={{ position: "absolute", inset: 0, background: "url(/map/silverlake.jpg) center/cover", filter: "saturate(.5) sepia(.14)", animation: "bzDrift 40s ease-in-out infinite alternate" }} />
      </div>}
      {/* The blush wash: under the welcome only; the map stays clear round the code */}
      <div style={{ position: "absolute", inset: 0, background: live
        ? "linear-gradient(90deg,rgba(247,240,237,.9) 0%,rgba(247,240,237,.8) 30%,rgba(247,240,237,.32) 50%,rgba(247,240,237,0) 64%)"
        : "linear-gradient(90deg,rgba(247,240,237,.93) 0%,rgba(247,240,237,.86) 38%,rgba(243,233,229,.6) 62%,rgba(241,230,226,.52) 100%)" }} />
      <div style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg,rgba(248,242,240,.5) 0%,rgba(248,242,240,0) 22%,rgba(236,224,220,0) 78%,rgba(236,224,220,.5) 100%)" }} />
      {!live && <div className="bz-pins">
        {PINS.map((p, k) => (
          <span key={p.t} style={{ position: "absolute", left: `${p.x}%`, top: `${p.y}%`, display: "flex", flexDirection: "column", alignItems: "center", animation: `bzPinIn .55s ${0.5 + k * 0.35}s cubic-bezier(.2,.8,.2,1) both` }}>
            <img src={`/pins/${p.f}.svg`} alt="" style={{ width: 30, height: 33, display: "block" }} />
            <span style={{ marginTop: 2, height: 24, padding: "0 9px", display: "flex", alignItems: "center", borderRadius: 9999, background: PAPER, boxShadow: "0 2px 8px rgba(40,26,20,.14)", font: "700 12px/1 var(--font-sans)", color: INK, whiteSpace: "nowrap" }}>{p.t}</span>
          </span>
        ))}
      </div>}
    </div>
  );
}

function Rings({ done }: { done: boolean }) {
  const ring = (d: number, bg: string): React.CSSProperties => ({ position: "absolute", left: "50%", top: "50%", width: d, height: d, transform: "translate(-50%,-50%)", borderRadius: 9999, background: bg });
  return (
    <div aria-hidden style={{ position: "absolute", left: "50%", top: "50%", width: 0, height: 0 }}>
      {/* Glass rings over the map: a faint blush fill and a hairline each */}
      <span style={{ ...ring(640, "radial-gradient(circle, rgba(253,248,246,0) 60%, rgba(253,248,246,.16) 100%)"), boxShadow: "inset 0 0 0 1px rgba(253,252,252,.55)" }} />
      <span style={{ ...ring(528, "rgba(253,248,246,.12)"), boxShadow: "inset 0 0 0 1px rgba(253,252,252,.6)" }} />
      <span style={{ ...ring(376, "rgba(253,248,246,.2)"), boxShadow: "inset 0 0 0 1px rgba(253,252,252,.7)", backdropFilter: "blur(2px)" }} />
      {/* The radar sweep, inside the outer ring */}
      <span style={{ ...ring(640, "conic-gradient(from 0deg, rgba(147,89,75,0) 0deg, rgba(147,89,75,0) 292deg, rgba(147,89,75,.22) 359deg, rgba(147,89,75,0) 360deg)"), animation: `sweep ${done ? 1.4 : 6}s linear infinite` }} />
      {[0, 1.6].map(d => <span key={d} style={{ ...ring(640, "transparent"), boxShadow: "inset 0 0 0 1.5px rgba(147,89,75,.28)", animation: `bzRingPulse ${done ? 1.2 : 3.2}s ${d}s ease-out infinite` }} />)}
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
    <div style={{ position: "relative", flex: "none", width: QR_SIZE + 40, height: QR_SIZE + 40, borderRadius: 24, background: "rgba(253,251,250,.94)", backdropFilter: "blur(14px)", boxShadow: "0 24px 60px rgba(63,40,32,.22),0 0 0 1px rgba(253,252,252,.8)", display: "flex", alignItems: "center", justifyContent: "center" }}>
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
