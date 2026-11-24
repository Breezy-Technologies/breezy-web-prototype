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
import { findPlace } from "@/lib/places";
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
    <main className="bz-login" style={{ position: "fixed", inset: 0, zIndex: 100, background: live ? "transparent" : "rgb(246,239,236)", pointerEvents: "none" }}>
      <style>{LOGIN_CSS}</style>
      <Backdrop done={approved} live={live} />

      {/* On the map: where the phone left off (like the onboarding's step pill) */}
      <div className="bz-maptag" style={{ position: "absolute", top: 32, zIndex: 1, transform: "translateX(-50%)", display: "flex", alignItems: "center", gap: 10, height: 44, padding: "0 18px 0 12px", borderRadius: 9999, background: "rgba(253,252,252,.96)", boxShadow: "0 6px 20px rgba(40,26,20,.14)", font: "400 14px/20px var(--font-sans)", color: INK, whiteSpace: "nowrap", animation: "riseIn .5s .3s cubic-bezier(.2,.8,.2,1) both" }}>
        <i className="ph-fill ph-device-mobile" style={{ fontSize: 18, color: CLAY }} />
        <span><b>Silver Lake</b> · picked up from your iPhone</span>
      </div>

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
            {approved ? "Opening Silver Lake, with the homes you saved on your iPhone…" : "Your desk workspace for comps, ROI and reports. Log in with the iPhone you signed up on, no password."}
          </p>

          {/* The stage: the code in the radar's rings, or the email / code form */}
          <div style={{ position: "relative", flex: 1, minHeight: 330, margin: "24px 0 0", borderRadius: 24, background: "rgb(243,239,237)", overflow: "hidden", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16, padding: "28px 24px", textAlign: "center" }}>
            {(mode === "qr" || approved) && <Rings done={approved} />}
            {approved ? (
              <span role="status" className="bz-approve" style={{ position: "relative", width: QR_SIZE + 40, height: QR_SIZE + 40, borderRadius: 24, background: PAPER, display: "flex", alignItems: "center", justifyContent: "center", animation: "riseIn .4s cubic-bezier(.2,.8,.2,1) both" }}>
                <span style={{ width: 88, height: 88, borderRadius: 9999, background: "rgb(49,140,96)", display: "flex", alignItems: "center", justifyContent: "center" }}><i className="ph-bold ph-check" style={{ fontSize: 44, color: "#fff" }} /></span>
              </span>
            ) : mode === "qr" ? <QrCard svg={qr.svg} left={qr.left} ttl={qr.ttl} k={qr.token} /> : (
              <div style={{ position: "relative", width: "100%", display: "flex", justifyContent: "center", textAlign: "left" }}>
                {mode === "email" && <EmailForm onBack={() => setMode("qr")} onSent={(email, token) => { setSent({ email, token }); setMode("sent"); }} />}
                {mode === "sent" && sent && <Sent {...sent} onBack={() => setMode("qr")} onRetry={() => setMode("email")} />}
                {mode === "code" && <CodeForm onBack={() => setMode("qr")} onOk={who => succeed(who, "code")} />}
              </div>
            )}
            {(mode === "qr" || approved) && (
              <div style={{ position: "relative", display: "flex", flexDirection: "column", gap: 4, maxWidth: 340 }}>
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
          <footer style={{ flex: "none", borderTop: "1px solid rgba(18,18,18,.08)", padding: "18px 40px 22px", display: "flex", flexDirection: "column", gap: 14 }}>
            {mode === "qr" && (
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                <span style={{ font: "400 14px/20px var(--font-sans)", color: MUTED, marginRight: 4 }}>No phone nearby?</span>
                <button onClick={() => setMode("email")} className="btn-soft" style={{ height: 40, fontSize: 14 }}><i className="ph-bold ph-envelope-simple" />Email me a link</button>
                <button onClick={() => setMode("code")} className="btn-soft" style={{ height: 40, fontSize: 14 }}><i className="ph-bold ph-password" />Use a code</button>
              </div>
            )}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
              <label style={{ display: "flex", alignItems: "center", gap: 8, font: "400 14px/20px var(--font-sans)", color: INK, cursor: "pointer", userSelect: "none" }}>
                <input type="checkbox" checked={stay} onChange={e => setStay(e.target.checked)} style={{ width: 18, height: 18, accentColor: INK, margin: 0 }} />
                Stay logged in on this browser
              </label>
              <span style={{ font: "400 14px/20px var(--font-sans)", color: MUTED }}>New to Breezy? <b style={{ color: INK }}>Get the iPhone app</b></span>
            </div>
          </footer>
        )}
      </section>

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

/* ---------- The map and the rings ----------
   24 Nov review: the onboarding's layout (step "What should Breezy look out for?"): one floating
   panel on the left, the live map full bleed behind it. The map is the shared Mapbox map, flat,
   framed on Silver Lake (the phone's last area) beside the panel, with the area's inner-glow
   outline, the ROI heat and the signal pins of Ann's activation prototype (teardrop + label
   pill). On approval it leans in. Offline, the static Silver Lake image and fixed pins stand in.
   The radar sweep and pulse rings stay round the code, inside the panel. */
const PANEL_W = "min(520px, calc(100vw - 32px))";
const LOGIN_CSS = `
@keyframes bzRingPulse { 0% { transform: translate(-50%, -50%) scale(.55); opacity: .5 } 100% { transform: translate(-50%, -50%) scale(1.25); opacity: 0 } }
@keyframes bzMarkIn { 0% { opacity: 0; transform: translateY(10px) scale(.7) } 70% { opacity: 1; transform: scale(1.05) } 100% { opacity: 1; transform: none } }
@keyframes bzPinPulse { 0% { transform: scale(.6); opacity: .55 } 100% { transform: scale(2.1); opacity: 0 } }
@keyframes bzApprove { 0% { box-shadow: 0 0 0 0 rgba(49,140,96,.3) } 100% { box-shadow: 0 0 0 30px rgba(49,140,96,0) } }
.bz-approve { animation: bzApprove 1.4s ease-out infinite }
.bz-maptag { left: calc(32px + ${PANEL_W} + (100vw - 32px - ${PANEL_W}) / 2) }
@media (max-width: 900px) { .bz-maptag, .bz-pins { display: none !important } .bz-panel { left: 16px !important; top: 16px !important; bottom: 16px !important } }
@media (prefers-reduced-motion: reduce) { .bz-login * { animation-duration: .01ms !important; animation-iteration-count: 1 !important } }
`;
const pinHtml = (f: string, t: string, delay: number) =>
  `<div style="display:flex;flex-direction:column;align-items:center;animation:bzMarkIn .55s ${delay}s cubic-bezier(.2,.8,.2,1) both">`
  + `<span style="position:relative;display:block;width:30px;height:33px"><span style="position:absolute;left:3px;top:1px;width:24px;height:24px;border-radius:9999px;background:rgba(147,89,75,.35);animation:bzPinPulse 2.4s ${delay + 0.6}s ease-out infinite"></span><img src="/pins/${f}.svg" alt="" style="position:relative;width:30px;height:33px;display:block"/></span>`
  + `<span style="margin-top:2px;height:24px;padding:0 9px;display:flex;align-items:center;border-radius:9999px;background:${PAPER};box-shadow:0 2px 8px rgba(40,26,20,.16);font:700 12px/1 var(--font-sans);color:${INK};white-space:nowrap">${t}</span></div>`;
// Offline only: positions in % of the page, right of the panel.
const PINS: { x: number; y: number; f: string; t: string }[] = [
  { x: 52, y: 24, f: "drop", t: "12% price drop" },
  { x: 74, y: 16, f: "ub", t: "84% Underbuilt" },
  { x: 90, y: 34, f: "roi", t: "$1.6m ROI" },
  { x: 58, y: 62, f: "exp", t: "Expired 4 days ago" },
  { x: 84, y: 70, f: "comps", t: "$310k under comps" },
  { x: 66, y: 42, f: "stale", t: "193 DOM" },
  { x: 72, y: 86, f: "wd", t: "Withdrawn 3 days ago" },
];
// Live: real spots inside the Silver Lake outline.
const MAP_PINS: { at: [number, number]; f: string; t: string }[] = [
  { at: [-118.2795, 34.0825], f: "drop", t: "12% price drop" },
  { at: [-118.2665, 34.1010], f: "ub", t: "84% Underbuilt" },
  { at: [-118.2610, 34.0930], f: "roi", t: "$1.6m ROI" },
  { at: [-118.2725, 34.0765], f: "exp", t: "Expired 4 days ago" },
  { at: [-118.2640, 34.0840], f: "comps", t: "$310k under comps" },
  { at: [-118.2810, 34.0900], f: "stale", t: "193 DOM" },
  { at: [-118.2725, 34.0945], f: "wd", t: "Withdrawn 3 days ago" },
];
const SL_PLACE = findPlace("sl");

function useLiveBackdrop(done: boolean) {
  const { map, ready, offline, setInset, setHeat, setAreaRings } = useMapCtx();
  const live = !!map && ready && !offline;
  useEffect(() => { setInset({ left: 0, top: 0, radius: 0 }); }, [setInset]);
  useEffect(() => {
    if (!live || !map) return;
    setHeat("roi"); setAreaRings(SL_PLACE?.rings ?? null);
    // Silver Lake fills the map beside the panel.
    const frame = (duration = 0) => {
      const panel = Math.min(520, innerWidth - 32) + 32;
      const wide = innerWidth > 900;
      map.fitBounds([[-118.2875, 34.0725], [-118.2515, 34.1095]], { padding: { left: wide ? panel + 48 : 24, right: 48, top: 96, bottom: 48 }, pitch: 0, bearing: 0, duration });
    };
    frame();
    const markers = MAP_PINS.map((p, k) => {
      const el = document.createElement("div");
      el.style.pointerEvents = "none";
      el.innerHTML = pinHtml(p.f, p.t, 0.7 + k * 0.28);
      return new mapboxgl.Marker({ element: el, anchor: "bottom", occludedOpacity: 1 } as mapboxgl.MarkerOptions).setLngLat(p.at).addTo(map);
    });
    const onResize = () => frame();
    addEventListener("resize", onResize);
    return () => {
      removeEventListener("resize", onResize);
      markers.forEach(m => m.remove());
      setAreaRings(null);
      map.jumpTo({ pitch: 0, bearing: 0, padding: { left: 0, right: 0, top: 0, bottom: 0 } });
    };
  }, [live, map]); // eslint-disable-line react-hooks/exhaustive-deps
  // Approved: the map leans in on Silver Lake.
  useEffect(() => { if (live && map && done) map.easeTo({ zoom: map.getZoom() + 0.9, pitch: 40, duration: 1600, easing: t => 1 - Math.pow(1 - t, 3) }); }, [live, map, done]);
  return live;
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

function Rings({ done }: { done: boolean }) {
  const ring = (d: number, bg: string): React.CSSProperties => ({ position: "absolute", left: "50%", top: "50%", width: d, height: d, transform: "translate(-50%,-50%)", borderRadius: 9999, background: bg });
  return (
    <div aria-hidden style={{ position: "absolute", left: "50%", top: "calc(50% - 34px)", width: 0, height: 0 }}>
      <span style={{ ...ring(560, "transparent"), boxShadow: "inset 0 0 0 1px rgba(147,89,75,.12)" }} />
      <span style={{ ...ring(430, "rgba(253,252,252,.35)"), boxShadow: "inset 0 0 0 1px rgba(147,89,75,.14)" }} />
      <span style={{ ...ring(310, "rgba(253,252,252,.55)"), boxShadow: "inset 0 0 0 1px rgba(147,89,75,.16)" }} />
      {/* The radar sweep */}
      <span style={{ ...ring(560, "conic-gradient(from 0deg, rgba(147,89,75,0) 0deg, rgba(147,89,75,0) 292deg, rgba(147,89,75,.18) 359deg, rgba(147,89,75,0) 360deg)"), animation: `sweep ${done ? 1.4 : 6}s linear infinite` }} />
      {[0, 1.6].map(d => <span key={d} style={{ ...ring(520, "transparent"), boxShadow: "inset 0 0 0 1.5px rgba(147,89,75,.24)", animation: `bzRingPulse ${done ? 1.2 : 3.2}s ${d}s ease-out infinite` }} />)}
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
    <div style={{ position: "relative", flex: "none", width: QR_SIZE + 40, height: QR_SIZE + 40, borderRadius: 24, background: "rgba(253,251,250,.94)", backdropFilter: "blur(14px)", boxShadow: "0 12px 32px rgba(63,40,32,.14),0 0 0 1px rgba(18,18,18,.04)", display: "flex", alignItems: "center", justifyContent: "center" }}>
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
