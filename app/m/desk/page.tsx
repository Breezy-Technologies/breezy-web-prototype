"use client";
// Mobile trigger mock (handoff, optional): on the iPhone, tapping a desk-heavy action (comps,
// ROI breakdown, generate report) raises "Run this on your computer". The real one is in the
// iOS app; this frame is for the team to see the copy and the two ways to the computer.
import React, { useState } from "react";

const INK = "rgb(18,18,18)", MUTED = "rgb(98,90,89)", PAPER = "rgb(253,252,252)";
const ACTIONS = [
  { k: "comps", label: "Get comps", icon: "files" },
  { k: "roi", label: "ROI breakdown", icon: "chart-bar" },
  { k: "report", label: "Generate report", icon: "file-text" },
];

export default function DeskSheet() {
  const [open, setOpen] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [how, setHow] = useState(false);
  const close = () => { setOpen(null); setSent(false); setHow(false); };
  return (
    <main style={{ position: "fixed", inset: 0, zIndex: 100, background: "rgb(245,243,243)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div style={{ position: "relative", width: 390, height: "min(820px, calc(100vh - 32px))", borderRadius: 48, background: INK, padding: 10, boxShadow: "0 24px 60px rgba(30,18,12,.25)" }}>
        <div style={{ position: "relative", width: "100%", height: "100%", borderRadius: 38, overflow: "hidden", background: `url(/photos/l/ext-02.jpg) center/cover` }}>
          {/* A property screen, behind */}
          <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, display: "flex", flexDirection: "column", gap: 12, padding: "20px 20px 34px", borderRadius: "28px 28px 0 0", background: PAPER }}>
            <span style={{ font: "700 20px/26px var(--font-sans)", color: INK }}>1515 Westerly Terrace</span>
            <span style={{ font: "400 14px/20px var(--font-sans)", color: MUTED }}>Silver Lake · 3 bd · 2 ba · 1,640 ft²</span>
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 4 }}>
              {ACTIONS.map(a => (
                <button key={a.k} onClick={() => setOpen(a.label)} className="btn-soft" style={{ justifyContent: "flex-start", height: 52 }}>
                  <i className={`ph-bold ph-${a.icon}`} />{a.label}<span style={{ flex: 1 }} /><i className="ph-bold ph-desktop" style={{ color: MUTED }} />
                </button>
              ))}
            </div>
          </div>
          {open && <>
            <div onClick={close} style={{ position: "absolute", inset: 0, background: "rgba(18,15,14,.4)", animation: "fadeIn .2s ease both" }} />
            <div role="dialog" aria-label="Run this on your computer" style={{ position: "absolute", left: 0, right: 0, bottom: 0, display: "flex", flexDirection: "column", gap: 14, padding: "10px 24px 34px", borderRadius: "28px 28px 0 0", background: PAPER, animation: "bzSheetIn .35s cubic-bezier(.2,.8,.2,1) both" }}>
              <span aria-hidden style={{ alignSelf: "center", width: 40, height: 5, borderRadius: 9999, background: "rgba(18,18,18,.15)" }} />
              <img src="/iso/build.png" alt="" style={{ width: 120, alignSelf: "center" }} />
              <span style={{ font: "300 26px/1.15 var(--font-sans)", letterSpacing: "-.5px", color: INK, textAlign: "center" }}>Run this on your computer</span>
              <span style={{ font: "400 15px/22px var(--font-sans)", color: MUTED, textAlign: "center", textWrap: "pretty" } as React.CSSProperties}>
                {open} has room to breathe on a bigger screen. Find it on your phone. Close it at your desk.
              </span>
              {how ? (
                <ol style={{ margin: 0, padding: "12px 16px 12px 34px", borderRadius: 16, background: "rgb(247,244,243)", display: "flex", flexDirection: "column", gap: 6, font: "400 14px/20px var(--font-sans)", color: INK }}>
                  <li>On your computer, go to <b>breezy.ai/login</b></li>
                  <li>Here, tap <b>Profile → Log in on a computer</b></li>
                  <li>Point your camera at the code, confirm with Face ID</li>
                </ol>
              ) : null}
              <button onClick={() => setSent(true)} className="btn-dark" style={{ height: 52 }} disabled={sent}>
                {sent ? <><i className="ph-bold ph-check" />Link sent to your email</> : <><i className="ph-bold ph-envelope-simple" />Email me the link</>}
              </button>
              <button onClick={() => setHow(h => !h)} className="btn-soft" style={{ height: 52 }}>{how ? "Got it" : "Show me how to log in"}</button>
            </div>
          </>}
        </div>
      </div>
    </main>
  );
}
