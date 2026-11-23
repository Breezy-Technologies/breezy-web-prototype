"use client";
// The iPhone side of the scan-to-link handoff (simulated; the real one is a screen in the
// Breezy iOS app). /link?token=… is what the QR opens: "Log in on your computer?", the
// computer's device line, Confirm (Face ID) / Not me. /link?mode=code shows a 6-digit code
// to type on the computer instead. Works on a real phone (same Wi-Fi as `next dev`) and in
// the login page's "Simulate phone" panel (demo=1). All calls go through lib/auth/handoff.ts.
import React, { useEffect, useState } from "react";
import { handoff } from "@/lib/auth/handoff";
import { useApp } from "@/components/AppState";

const INK = "rgb(18,18,18)", MUTED = "rgb(98,90,89)", PAPER = "rgb(253,252,252)";
type Phase = "ask" | "faceid" | "done" | "declined" | "expired";

export default function LinkPage() {
  const { user } = useApp();
  const first = user.name.split(" ")[0];
  const me = `${first}'s iPhone`;
  const [q, setQ] = useState<{ token: string; code: boolean; demo: boolean } | null>(null);
  const [phase, setPhase] = useState<Phase>("ask");
  const [device, setDevice] = useState("Chrome on macOS");
  const [code, setCode] = useState("");

  useEffect(() => {
    const p = new URLSearchParams(location.search);
    const v = { token: p.get("token") || "", code: p.get("mode") === "code", demo: p.get("demo") === "1" };
    setQ(v);
    if (v.code) { handoff.issueCode(me).then(setCode); return; }
    if (v.token) handoff.lookup(v.token).then(r => {
      if (r?.device) setDevice(r.device);
      // Only the server knows a token expired; in the demo panel (no shared server) it's unknown, which is fine.
      if (r && (r.status === "expired" || r.status === "consumed")) setPhase("expired");
    });
  }, [me]);

  const confirm = () => {
    setPhase("faceid");
    setTimeout(async () => { await handoff.approve(q!.token, me); setPhase("done"); }, 900);
  };
  const notMe = async () => { await handoff.decline(q!.token, me); setPhase("declined"); };

  return (
    <main style={{ position: "fixed", inset: 0, zIndex: 100, overflowY: "auto", background: q?.demo ? PAPER : "rgb(245,243,243)", display: "flex", justifyContent: "center" }}>
      <div style={{ position: "relative", width: "100%", maxWidth: 390, minHeight: "100%", display: "flex", flexDirection: "column", background: PAPER, padding: "0 24px", boxSizing: "border-box" }}>
        {/* Status bar */}
        <div aria-hidden style={{ flex: "none", height: 48, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 8px", font: "700 15px/1 var(--font-sans)", color: INK }}>
          <span>9:41</span>
          <span style={{ display: "flex", gap: 6, fontSize: 15 }}><i className="ph-fill ph-cell-signal-full" /><i className="ph-fill ph-wifi-high" /><i className="ph-fill ph-battery-full" /></span>
        </div>
        <div style={{ flex: "none", display: "flex", alignItems: "center", justifyContent: "center", height: 52 }}>
          <span role="img" aria-label="Breezy" style={{ width: 76, height: 26, background: INK, WebkitMask: "url(/brand/splash-wordmark.svg) center/contain no-repeat", mask: "url(/brand/splash-wordmark.svg) center/contain no-repeat" }} />
        </div>

        {q?.code ? (
          <Center>
            <Icon name="password" />
            <H>Your login code</H>
            <P>Type it on your computer, on the Breezy login page. It works once, for 5 minutes.</P>
            <span aria-live="polite" style={{ marginTop: 8, font: "300 44px/1 var(--font-sans)", letterSpacing: "6px", color: INK, fontVariantNumeric: "tabular-nums" }}>
              {code ? `${code.slice(0, 3)} ${code.slice(3)}` : "··· ···"}
            </span>
            <button onClick={() => navigator.clipboard?.writeText(code)} className="btn-soft" style={{ marginTop: 8, height: 40, fontSize: 14 }}><i className="ph-bold ph-copy" />Copy</button>
          </Center>
        ) : phase === "done" ? (
          <Center>
            <Icon name="check" bg="rgb(49,140,96)" color="#fff" />
            <H>You&apos;re logged in on your computer</H>
            <P>{device} · just now. You can put your phone down; your map, saved homes and searches are waiting there.</P>
          </Center>
        ) : phase === "declined" ? (
          <Center>
            <Icon name="prohibit" />
            <H>Request declined</H>
            <P>Nobody was logged in. If you didn&apos;t try to log in, you can ignore this; your account is safe.</P>
          </Center>
        ) : phase === "expired" ? (
          <Center>
            <Icon name="clock-counter-clockwise" />
            <H>This code has expired</H>
            <P>Codes renew every minute. Scan the new one on your computer.</P>
          </Center>
        ) : (
          <>
            <Center>
              <Icon name="desktop" />
              <H>Log in on your computer?</H>
              <div style={{ alignSelf: "stretch", display: "flex", alignItems: "center", gap: 12, marginTop: 8, padding: "14px 16px", borderRadius: 18, background: "rgb(247,244,243)" }}>
                <i className="ph-bold ph-browser" style={{ fontSize: 22, color: INK }} />
                <span style={{ flex: 1, display: "flex", flexDirection: "column", textAlign: "left" }}>
                  <b style={{ font: "700 15px/20px var(--font-sans)", color: INK }}>{device}</b>
                  <span style={{ font: "400 13px/18px var(--font-sans)", color: MUTED }}>Los Angeles, CA · just now</span>
                </span>
              </div>
              <P>Only confirm if you&apos;re in front of this computer and just scanned its code.</P>
            </Center>
            <div style={{ flex: "none", display: "flex", flexDirection: "column", gap: 10, padding: "16px 0 28px" }}>
              <button onClick={confirm} disabled={phase === "faceid" || !q?.token} className="btn-dark" style={{ height: 52 }}>
                {phase === "faceid" ? <FaceId /> : <><i className="ph-bold ph-scan" />Confirm</>}
              </button>
              <button onClick={notMe} disabled={phase === "faceid"} className="btn-soft" style={{ height: 52 }}>Not me</button>
            </div>
          </>
        )}
      </div>
    </main>
  );
}

const Center = ({ children }: { children: React.ReactNode }) => (
  <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12, textAlign: "center", animation: "stepIn .3s cubic-bezier(.2,.8,.2,1) both" }}>{children}</div>
);
const H = ({ children }: { children: React.ReactNode }) => <h1 style={{ margin: "8px 0 0", font: "300 28px/1.15 var(--font-sans)", letterSpacing: "-.6px", color: INK, textWrap: "balance" } as React.CSSProperties}>{children}</h1>;
const P = ({ children }: { children: React.ReactNode }) => <p style={{ margin: 0, font: "400 15px/22px var(--font-sans)", color: MUTED, textWrap: "pretty" } as React.CSSProperties}>{children}</p>;
const Icon = ({ name, bg = "rgba(18,18,18,.06)", color = INK }: { name: string; bg?: string; color?: string }) => (
  <span style={{ width: 72, height: 72, borderRadius: 9999, background: bg, display: "flex", alignItems: "center", justifyContent: "center", animation: "riseIn .35s cubic-bezier(.2,.8,.2,1) both" }}>
    <i className={`ph-bold ph-${name}`} style={{ fontSize: 34, color }} />
  </span>
);

/** Fake Face ID: the glyph traces, then ticks. */
function FaceId() {
  return (
    <span style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <style>{`@keyframes fidTrace{0%{stroke-dashoffset:120}70%{stroke-dashoffset:0}100%{stroke-dashoffset:0}}@keyframes fidTick{0%,65%{opacity:0;transform:scale(.6)}100%{opacity:1;transform:none}}`}</style>
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
        <path d="M3 8V5a2 2 0 0 1 2-2h3M16 3h3a2 2 0 0 1 2 2v3M21 16v3a2 2 0 0 1-2 2h-3M8 21H5a2 2 0 0 1-2-2v-3" strokeDasharray="120" style={{ animation: "fidTrace .8s ease both" }} />
        <path d="M8.5 13.5c1.8 1.6 5.2 1.6 7 0M9 9v1M15 9v1M12 9v3h-1" style={{ animation: "fidTick .8s ease both", transformOrigin: "12px 12px" }} />
      </svg>
      Face ID
    </span>
  );
}
