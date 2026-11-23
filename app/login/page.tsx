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

const INK = "rgb(18,18,18)", MUTED = "rgb(98,90,89)", PAPER = "rgb(253,252,252)", CLAY = "rgb(147,89,75)";
const QR_SIZE = 248;

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
    if (m) { history.replaceState(null, "", "/login"); succeed("your email link", "magic"); }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <main style={{ position: "fixed", inset: 0, zIndex: 100, overflowY: "auto", background: "rgb(245,243,243)", display: "flex", flexDirection: "column" }}>
      <header style={{ flex: "none", display: "flex", alignItems: "center", padding: "24px 32px" }}>
        <span role="img" aria-label="Breezy" style={{ width: 84, height: 28, background: INK, WebkitMask: "url(/brand/splash-wordmark.svg) left center/contain no-repeat", mask: "url(/brand/splash-wordmark.svg) left center/contain no-repeat" }} />
      </header>
      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: "8px 16px 64px" }}>
        <section style={{ width: 960, maxWidth: "100%", display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(320px,1fr))", gap: 0, borderRadius: 32, background: PAPER, boxShadow: "inset 0 0 0 1px rgb(240,235,233),0 24px 60px rgba(40,26,20,.10)", overflow: "hidden", animation: "riseIn .4s cubic-bezier(.2,.8,.2,1) both" }}>
          {/* Left: what to do */}
          <div style={{ display: "flex", flexDirection: "column", gap: 28, padding: "56px 48px 44px" }}>
            <h1 style={{ margin: 0, font: "300 40px/1.1 var(--font-sans)", letterSpacing: "-1.2px", color: INK, textWrap: "balance" } as React.CSSProperties}>Log in to Breezy on your computer</h1>
            <ol style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 18 }}>
              {[
                <>Open <b>Breezy</b> on your iPhone</>,
                <>Point your camera at this code</>,
                <>Confirm with <b>Face ID</b></>,
              ].map((t, i) => (
                <li key={i} style={{ display: "flex", alignItems: "center", gap: 14, font: "400 17px/24px var(--font-sans)", color: INK }}>
                  <span aria-hidden style={{ flex: "none", width: 30, height: 30, borderRadius: 9999, background: "rgba(18,18,18,.06)", display: "flex", alignItems: "center", justifyContent: "center", font: "700 14px/1 var(--font-sans)" }}>{i + 1}</span>
                  <span>{t}</span>
                </li>
              ))}
            </ol>
            <span style={{ flex: 1 }} />
            <label style={{ display: "flex", alignItems: "center", gap: 10, font: "400 14px/20px var(--font-sans)", color: INK, cursor: "pointer", userSelect: "none" }}>
              <input type="checkbox" checked={stay} onChange={e => setStay(e.target.checked)} style={{ width: 18, height: 18, accentColor: INK, margin: 0 }} />
              Stay logged in on this browser
            </label>
            <span style={{ font: "400 13px/19px var(--font-sans)", color: MUTED, textWrap: "pretty" } as React.CSSProperties}>
              No Breezy account yet? Get the Breezy app on your iPhone and sign up there, then come back to this page.
            </span>
          </div>

          {/* Right: the code, or a fallback */}
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 18, padding: "48px 40px 40px", background: "rgb(250,248,247)", borderLeft: "1px solid rgb(240,235,233)", minHeight: 460 }}>
            {mode === "qr" && <>
              <QrCard svg={qr.svg} left={qr.left} ttl={qr.ttl} k={qr.token} />
              <span aria-live="polite" style={{ height: 20, font: "400 13px/20px var(--font-sans)", color: declined ? CLAY : MUTED, display: "flex", alignItems: "center", gap: 6 }}>
                {declined ? <><i className="ph-bold ph-prohibit" />Request declined on your iPhone. Here&apos;s a new code.</> : "The code refreshes by itself"}
              </span>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4, marginTop: 4 }}>
                <LinkBtn onClick={() => setMode("email")} icon="envelope-simple">Email me a link instead</LinkBtn>
                <LinkBtn onClick={() => setMode("code")} icon="password">Use a 6-digit code</LinkBtn>
              </div>
            </>}
            {mode === "email" && <EmailForm onBack={() => setMode("qr")} onSent={(email, token) => { setSent({ email, token }); setMode("sent"); }} />}
             {mode === "sent" && sent && <Sent {...sent} onBack={() => setMode("qr")} onRetry={() => setMode("email")} />}
            {mode === "code" && <CodeForm onBack={() => setMode("qr")} onOk={who => succeed(who, "code")} />}
            {mode === "approved" && (
              <div role="status" style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 14, animation: "riseIn .35s cubic-bezier(.2,.8,.2,1) both" }}>
                <span style={{ width: 88, height: 88, borderRadius: 9999, background: "rgb(49,140,96)", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 0 0 10px rgba(49,140,96,.12)" }}>
                  <i className="ph-bold ph-check" style={{ fontSize: 44, color: "#fff" }} />
                </span>
                <span style={{ font: "700 18px/24px var(--font-sans)", color: INK, textAlign: "center" }}>Approved on {by}</span>
                <span style={{ font: "400 14px/20px var(--font-sans)", color: MUTED }}>Opening your map…</span>
              </div>
            )}
          </div>
        </section>
      </div>

      {/* Demo: approve from a simulated iPhone on this laptop (BroadcastChannel), or a real one on the same Wi-Fi in dev. */}
      {mode !== "approved" && (
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
        <aside aria-label="Simulated iPhone" style={{ position: "fixed", right: 20, bottom: 68, zIndex: 119, width: 390, height: "min(760px, calc(100vh - 92px))", borderRadius: 44, background: INK, padding: 10, boxShadow: "0 24px 60px rgba(30,18,12,.3)", animation: "riseIn .3s cubic-bezier(.2,.8,.2,1) both" }}>
          <iframe key={mode === "code" ? "code" : qr.token} title="Breezy on iPhone" src={mode === "code" ? `/link?mode=code&demo=1` : `/link?token=${qr.token}&demo=1`}
            style={{ width: "100%", height: "100%", border: 0, borderRadius: 34, background: PAPER }} />
        </aside>
      )}
    </main>
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
    <div style={{ position: "relative", width: QR_SIZE + 40, height: QR_SIZE + 40, borderRadius: 28, background: PAPER, boxShadow: "inset 0 0 0 1px rgb(236,230,228),0 8px 24px rgba(40,26,20,.06)", display: "flex", alignItems: "center", justifyContent: "center" }}>
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
