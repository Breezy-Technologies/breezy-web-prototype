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

type Mode = "qr" | "email" | "sent" | "code" | "approved";
const EMAIL_LINK = "your email link";

const INK = "rgb(18,18,18)", MUTED = "rgb(98,90,89)", PAPER = "rgb(253,252,252)", CLAY = "rgb(147,89,75)";
const QR_SIZE = 216;

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
    <main className="bz-login" style={{ position: "fixed", inset: 0, zIndex: 100, overflowY: "auto", background: "linear-gradient(180deg,rgb(238,233,228),rgb(223,213,207))", display: "flex", gap: 24, padding: 24, boxSizing: "border-box" }}>
      <style>{LOGIN_CSS}</style>
      {/* Left: the brand stage (Ann's mobile activation language: warm brown, the radar, signal pins) */}
      <Stage done={approved} />

      {/* Right: log in */}
      <section style={{ flex: "1 1 0", minWidth: 0, display: "flex", flexDirection: "column", justifyContent: "center", gap: 28, padding: "24px 32px 24px 40px" }}>
        <span role="img" aria-label="Breezy" style={{ width: 120, height: 40, background: "linear-gradient(180deg,rgb(186,152,144),rgb(132,98,90))", WebkitMask: "url(/brand/splash-wordmark.svg) left center/contain no-repeat", mask: "url(/brand/splash-wordmark.svg) left center/contain no-repeat", animation: "riseIn .5s cubic-bezier(.2,.8,.2,1) both" }} />
        {approved ? (
          <div role="status" style={{ display: "flex", flexDirection: "column", gap: 14, animation: "riseIn .45s cubic-bezier(.2,.8,.2,1) both" }}>
            <span className="bz-approve" style={{ position: "relative", width: 76, height: 76, borderRadius: 9999, background: "rgb(49,140,96)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <i className="ph-bold ph-check" style={{ fontSize: 38, color: "#fff" }} />
            </span>
            <span style={{ font: "700 12px/16px var(--font-sans)", letterSpacing: ".08em", textTransform: "uppercase", color: CLAY, marginTop: 8 }}>{by === EMAIL_LINK ? "Logged in with your email link" : `Approved on ${by}`}</span>
            <h1 style={{ margin: 0, font: "300 52px/1.05 var(--font-sans)", letterSpacing: "-1.6px", color: INK }}>Welcome back, {first}</h1>
            <span style={{ font: "400 17px/24px var(--font-sans)", color: MUTED }}>Opening Silver Lake, with your saved homes…</span>
          </div>
        ) : <>
          <div style={{ display: "flex", flexDirection: "column", gap: 10, animation: "riseIn .5s .05s cubic-bezier(.2,.8,.2,1) both" }}>
            <span style={{ font: "700 12px/16px var(--font-sans)", letterSpacing: ".08em", textTransform: "uppercase", color: CLAY }}>Log in on your computer</span>
            <h1 style={{ margin: 0, font: "300 52px/1.05 var(--font-sans)", letterSpacing: "-1.6px", color: INK, textWrap: "balance" } as React.CSSProperties}>
              {mode === "qr" ? "Scan with your iPhone" : "Log in without a password"}
            </h1>
          </div>

          {mode === "qr" ? (
            <div style={{ display: "flex", alignItems: "center", gap: 32, flexWrap: "wrap", animation: "riseIn .5s .12s cubic-bezier(.2,.8,.2,1) both" }}>
              <QrCard svg={qr.svg} left={qr.left} ttl={qr.ttl} k={qr.token} />
              <div style={{ flex: "1 1 220px", display: "flex", flexDirection: "column", gap: 18 }}>
                <ol style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 16 }}>
                  {[
                    <>Open <b>Breezy</b> on your iPhone</>,
                    <>Point your camera at the code</>,
                    <>Confirm with <b>Face ID</b></>,
                  ].map((t, i) => (
                    <li key={i} style={{ display: "flex", alignItems: "center", gap: 14, font: "400 17px/24px var(--font-sans)", color: INK }}>
                      <span aria-hidden style={{ flex: "none", width: 32, height: 32, borderRadius: 9999, background: PAPER, boxShadow: "0 1px 2px rgba(40,26,20,.08)", display: "flex", alignItems: "center", justifyContent: "center", font: "700 14px/1 var(--font-sans)", color: CLAY }}>{i + 1}</span>
                      <span>{t}</span>
                    </li>
                  ))}
                </ol>
                <span aria-live="polite" style={{ minHeight: 20, font: "400 13px/20px var(--font-sans)", color: declined ? CLAY : MUTED, display: "flex", alignItems: "center", gap: 6 }}>
                  {declined ? <><i className="ph-bold ph-prohibit" />Request declined on your iPhone. Here&apos;s a new code.</> : <><i className="ph-bold ph-arrows-clockwise" />The code renews itself every minute</>}
                </span>
              </div>
            </div>
          ) : (
            <div style={{ display: "flex" }}>
              {mode === "email" && <EmailForm onBack={() => setMode("qr")} onSent={(email, token) => { setSent({ email, token }); setMode("sent"); }} />}
              {mode === "sent" && sent && <Sent {...sent} onBack={() => setMode("qr")} onRetry={() => setMode("email")} />}
              {mode === "code" && <CodeForm onBack={() => setMode("qr")} onOk={who => succeed(who, "code")} />}
            </div>
          )}

          <div style={{ display: "flex", flexDirection: "column", gap: 14, animation: "riseIn .5s .2s cubic-bezier(.2,.8,.2,1) both" }}>
            {mode === "qr" && <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              <LinkBtn onClick={() => setMode("email")} icon="envelope-simple">Email me a link instead</LinkBtn>
              <LinkBtn onClick={() => setMode("code")} icon="password">Use a 6-digit code</LinkBtn>
            </div>}
            <label style={{ display: "flex", alignItems: "center", gap: 10, font: "400 14px/20px var(--font-sans)", color: INK, cursor: "pointer", userSelect: "none" }}>
              <input type="checkbox" checked={stay} onChange={e => setStay(e.target.checked)} style={{ width: 18, height: 18, accentColor: INK, margin: 0 }} />
              Stay logged in on this browser
            </label>
            <span style={{ maxWidth: 440, font: "400 13px/19px var(--font-sans)", color: MUTED, textWrap: "pretty" } as React.CSSProperties}>
              No Breezy account yet? Get the Breezy app on your iPhone and sign up there, then come back to this page.
            </span>
          </div>
        </>}
      </section>

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
        // Over the brand stage, so the QR stays in view.
        <aside aria-label="Simulated iPhone" className="bz-sim" style={{ position: "fixed", bottom: 24, zIndex: 119, width: 390, height: "min(760px, calc(100vh - 48px))", borderRadius: 44, background: INK, padding: 10, boxShadow: "0 24px 60px rgba(30,18,12,.35)", animation: "riseIn .3s cubic-bezier(.2,.8,.2,1) both" }}>
          <iframe key={mode === "code" ? "code" : qr.token} title="Breezy on iPhone" src={mode === "code" ? `/link?mode=code&demo=1` : `/link?token=${qr.token}&demo=1`}
            style={{ width: "100%", height: "100%", border: 0, borderRadius: 34, background: PAPER }} />
        </aside>
      )}
    </main>
  );
}

/* ---------- The brand stage ----------
   Ann's activation prototype, brought to the computer: the warm brown frame of "See what
   agents don't", a Silver Lake map scanned by the clay radar sweep, the teardrop signal pins
   with their label pills ("What Breezy sees"), the shimmering AI status line, the photo stack
   and a light headline. On approval the map leans in and every pin pulses. */
const LOGIN_CSS = `
@keyframes bzScanRing { 0% { transform: scale(1); opacity: .55 } 100% { transform: scale(1.32); opacity: 0 } }
@keyframes bzPinIn { 0% { opacity: 0; transform: translate(-50%, -100%) translateY(10px) scale(.7) } 70% { opacity: 1; transform: translate(-50%, -100%) scale(1.05) } 100% { opacity: 1; transform: translate(-50%, -100%) scale(1) } }
@keyframes bzPinHalo { 0% { transform: translate(-50%, -50%) scale(.6); opacity: .7 } 100% { transform: translate(-50%, -50%) scale(2.4); opacity: 0 } }
@keyframes bzApprove { 0% { box-shadow: 0 0 0 0 rgba(49,140,96,.35) } 100% { box-shadow: 0 0 0 26px rgba(49,140,96,0) } }
.bz-approve { animation: bzApprove 1.4s ease-out infinite }
.bz-sim { left: 48px }
@media (max-width: 1080px) { .bz-stage { display: none !important } .bz-sim { left: auto; right: 20px; bottom: 68px } }
@media (prefers-reduced-motion: reduce) { .bz-login * { animation-duration: .01ms !important; animation-iteration-count: 1 !important } }
`;
const PINS: { x: number; y: number; f: string; t: string }[] = [
  { x: 24, y: 22, f: "drop", t: "12% price drop" },
  { x: 74, y: 25, f: "ub", t: "84% Underbuilt" },
  { x: 80, y: 47, f: "roi", t: "$1.6m ROI" },
  { x: 27, y: 57, f: "exp", t: "Expired 4 days ago" },
  { x: 60, y: 74, f: "wd", t: "Withdrawn 3 days ago" },
  { x: 15, y: 86, f: "stale", t: "193 DOM" },
  { x: 84, y: 86, f: "comps", t: "$310k under comps" },
];
const STATUS = ["Syncing your 4 saved homes", "Loading your Market Radar", "Getting comps ready", "Putting Silver Lake on a big map"];

function Stage({ done }: { done: boolean }) {
  const [i, setI] = useState(0);
  useEffect(() => { if (done) return; const t = setInterval(() => setI(x => (x + 1) % STATUS.length), 2400); return () => clearInterval(t); }, [done]);
  return (
    <div className="bz-stage" aria-hidden style={{ position: "relative", flex: "0 0 50%", minWidth: 0, display: "flex", flexDirection: "column", gap: 24, padding: 20, borderRadius: 36, overflow: "hidden", background: "linear-gradient(180deg,rgb(116,77,65) -4%,rgb(63,51,48) 100%)", boxShadow: "0 30px 70px rgba(63,40,32,.28)", animation: "riseIn .6s cubic-bezier(.2,.8,.2,1) both" }}>
      {/* Arches, the texture behind Ann's hero */}
      <div style={{ position: "absolute", left: -20, right: -20, bottom: -40, height: "42%", opacity: .1, background: `url("data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="112" height="400"><path d="M8 400V64a48 48 0 0 1 96 0v336" fill="none" stroke="#fff" stroke-width="2"/></svg>')}") 0 0/112px 100% repeat-x` }} />
      {/* The map card */}
      <div style={{ position: "relative", flex: "1 1 0", minHeight: 300, borderRadius: 26, overflow: "hidden", background: "rgb(240,235,232)" }}>
        <div style={{ position: "absolute", inset: "-6%", background: "url(/map/silverlake.jpg) center/cover", filter: "saturate(.55) sepia(.12) brightness(1.02)", transform: done ? "scale(1.18)" : "scale(1)", transition: "transform 1.6s cubic-bezier(.2,.8,.2,1)" }} />
        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg,rgba(240,233,230,.25),rgba(217,201,195,.35))" }} />
        {/* Radar: rings, sweep, centre */}
        {[0.22, 0.42, 0.64].map(r => <span key={r} style={{ position: "absolute", left: "50%", top: "50%", width: `${r * 200}%`, aspectRatio: "1", transform: "translate(-50%,-50%)", borderRadius: 9999, boxShadow: "inset 0 0 0 1px rgba(116,77,65,.22)" }} />)}
        <span style={{ position: "absolute", left: "50%", top: "50%", width: "150%", aspectRatio: "1", borderRadius: 9999, background: "conic-gradient(from 0deg, rgba(116,77,65,0) 0deg, rgba(116,77,65,0) 290deg, rgba(116,77,65,.5) 359deg, rgba(116,77,65,0) 360deg)", animation: `sweep ${done ? 1.4 : 5}s linear infinite`, transform: "translate(-50%,-50%)" }} />
        <span style={{ position: "absolute", left: "50%", top: "50%", width: 12, height: 12, borderRadius: 9999, background: "rgb(116,77,65)", transform: "translate(-50%,-50%)", boxShadow: "0 0 0 4px rgba(253,252,252,.8)" }} />
        {/* What Breezy sees */}
        <span style={{ position: "absolute", left: "50%", top: 18, transform: "translateX(-50%)", display: "flex", alignItems: "center", gap: 8, height: 44, padding: "0 18px 0 14px", borderRadius: 9999, background: "rgb(48,36,33)", boxShadow: "0 8px 20px rgba(40,26,20,.25)", font: "700 15px/1 var(--font-sans)", color: PAPER, whiteSpace: "nowrap" }}>
          <span style={{ width: 20, height: 20, background: PAPER, WebkitMask: "url(/brand/brandmark.svg) center/contain no-repeat", mask: "url(/brand/brandmark.svg) center/contain no-repeat" }} />What Breezy sees
        </span>
        {/* Signal pins, popping in like the phone's scan */}
        {PINS.map((p, k) => (
          <span key={p.t} style={{ position: "absolute", left: `${p.x}%`, top: `${p.y}%`, display: "flex", flexDirection: "column", alignItems: "center", animation: `bzPinIn .55s ${0.6 + k * 0.42}s cubic-bezier(.2,.8,.2,1) both` }}>
            <span style={{ position: "relative", width: 32, height: 35 }}>
              <span style={{ position: "absolute", left: "50%", top: "44%", width: 28, height: 28, borderRadius: 9999, background: "rgba(253,252,252,.7)", animation: `bzPinHalo ${done ? 0.9 : 2.6}s ${k * 0.3}s ease-out infinite` }} />
              <img src={`/pins/${p.f}.svg`} alt="" style={{ position: "relative", width: 32, height: 35, display: "block" }} />
            </span>
            <span style={{ marginTop: 2, height: 26, padding: "0 10px", display: "flex", alignItems: "center", borderRadius: 9999, background: PAPER, boxShadow: "0 2px 8px rgba(40,26,20,.16)", font: "700 13px/1 var(--font-sans)", color: INK, whiteSpace: "nowrap" }}>{p.t}</span>
          </span>
        ))}
        {/* The AI status line */}
        <span style={{ position: "absolute", left: "50%", bottom: 18, transform: "translateX(-50%)", display: "flex", alignItems: "center", gap: 8, height: 40, padding: "0 16px", borderRadius: 9999, background: "rgba(253,252,252,.92)", boxShadow: "0 6px 18px rgba(40,26,20,.14)", whiteSpace: "nowrap" }}>
          <i className={done ? "ph-bold ph-check" : "ph-fill ph-sparkle"} style={{ fontSize: 15, color: done ? "rgb(49,140,96)" : "rgb(168,128,190)", animation: done ? undefined : "ub-pulse 1.4s cubic-bezier(.4,0,.6,1) infinite" }} />
          <span key={done ? "done" : i} style={{ display: "block", animation: "stepIn .35s ease" }}>
            <span style={{ display: "block", font: "700 14px/18px var(--font-sans)", color: INK }}>
              {done ? "Your workspace is ready" : `${STATUS[i]}…`}
            </span>
          </span>
        </span>
      </div>
      {/* Under the map: the photo stack and the line */}
      <div style={{ position: "relative", display: "flex", flexDirection: "column", alignItems: "center", gap: 12, padding: "0 24px 12px", textAlign: "center" }}>
        <span style={{ position: "relative", width: 132, height: 58 }}>
          {["ext-05", "ext-02", "ext-09"].map((f, k) => (
            <span key={f} style={{ position: "absolute", left: [6, 36, 70][k], top: k === 1 ? 0 : 8, width: k === 1 ? 60 : 50, height: k === 1 ? 54 : 44, borderRadius: 8, background: `url(/photos/l/${f}.jpg) center/cover`, boxShadow: "0 0 0 2px rgb(253,252,252),0 6px 14px rgba(0,0,0,.3)", transform: `rotate(${[-9, 0, 9][k]}deg)`, zIndex: k === 1 ? 2 : 1 }} />
          ))}
        </span>
        <span style={{ font: "300 34px/1.12 var(--font-sans)", letterSpacing: "-.8px", color: PAPER }}>Your next deal, on a bigger map</span>
        <span style={{ maxWidth: 460, font: "400 16px/23px var(--font-sans)", color: "rgba(253,252,252,.78)", textWrap: "pretty" } as React.CSSProperties}>Comps, ROI and reports side by side, with everything you saved on your iPhone.</span>
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
    <div style={{ position: "relative", flex: "none", width: QR_SIZE + 40, height: QR_SIZE + 40, borderRadius: 28, background: PAPER, boxShadow: "0 18px 44px rgba(63,40,32,.14),0 2px 6px rgba(63,40,32,.06)", display: "flex", alignItems: "center", justifyContent: "center" }}>
      {/* Scan rings: the radar's pulse, round the code */}
      {[0, 1.3].map(d => <span key={d} aria-hidden style={{ position: "absolute", inset: 0, borderRadius: 28, boxShadow: "0 0 0 1.5px rgba(147,89,75,.5)", animation: `bzScanRing 2.6s ${d}s ease-out infinite`, pointerEvents: "none" }} />)}
      {svg ? (
        <div key={k} role="img" aria-label="QR code: scan it with the Breezy app on your iPhone to log in on this computer. Or use the email link or a 6-digit code below."
          style={{ width: QR_SIZE, height: QR_SIZE, animation: "fadeIn .5s ease both" }} dangerouslySetInnerHTML={{ __html: svg.replace("<svg", `<svg width="${QR_SIZE}" height="${QR_SIZE}"`) }} />
      ) : <span style={{ width: QR_SIZE, height: QR_SIZE, borderRadius: 12, background: "linear-gradient(90deg,rgba(18,18,18,.04),rgba(18,18,18,.08),rgba(18,18,18,.04))", backgroundSize: "200% 100%", animation: "lineShimmer 1.2s linear infinite" }} />}
      {/* The Breezy mark in the middle (error correction H leaves room for it). */}
      {svg && <span aria-hidden style={{ position: "absolute", width: 52, height: 52, borderRadius: 14, background: PAPER, boxShadow: "0 0 0 5px rgb(253,252,252)", display: "flex", alignItems: "center", justifyContent: "center" }}>
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
