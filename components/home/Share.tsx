"use client";
// Share, ported from the canvas `Home Web.dc.html`: the "Share properties"
// modal (`showShareModal`) with its properties list (`shProps`, `sp.focus`),
// clients (`shClients`, `c.remove`, `onShContact`), the email-style preview
// (`shPreview`, `pv.prev/next`, `shHey`, `shCountTxt`), the split Share /
// quick-copy button (`onShLinkOpen`, `onShQuickCopy`), the share-link popover
// (`shLinkOpen`, `onShLinkCopy`, `onShLinkClose`, `_copyShLink`) and `onShClose`.
// Also the contact picker it opens (`contactOpen` with cFor "share": `onCq`,
// `r.toggle`, `onContactCreate`, `onContactAdd`, `onContactCancel`), the
// picked-set footer in the results column (`pickedThumbs`, `pickedMore`,
// `shareLabel`, `onOpenSaved`, `onSharePicked`) and the "Saved properties"
// sheet (`showSaved`, `savedList`, `sv.open`, `sv.remove`, `onPickedClear`,
// `onCloseSaved`). Entry points: `onShareProp` (detail panel footer, Comps
// report "Share report") and `onSharePicked` (picked footer, saved sheet).
import { useCallback, useEffect, useRef, useState } from "react";
import { Listing, fullPrice } from "@/lib/fake";
import { css } from "@/lib/css";

// ---------------------------------------------------------------- state

export type ShareState = ReturnType<typeof useShare>;

// `savedP` / `pickOrder` (the picked set), `shareOpen` / `shareOnly`,
// `shClients` and `savedOpen` from the canvas state.
export function useShare() {
  const [picked, setPicked] = useState<number[]>([]); // pick order, oldest first
  const [open, setOpen] = useState(false);
  const [only, setOnly] = useState<number | null>(null);
  const [clients, setClients] = useState<string[]>([]);
  const [savedOpen, setSavedOpen] = useState(false);
  const [savedOut, setSavedOut] = useState(false);
  const toggle = useCallback((id: number) => setPicked(o => o.includes(id) ? o.filter(x => x !== id) : o.concat([id])), []);
  const remove = useCallback((id: number) => setPicked(o => o.filter(x => x !== id)), []);
  const clear = useCallback(() => { setPicked([]); setSavedOpen(false); }, []);
  const shareProp = useCallback((id: number) => { setOnly(id); setOpen(true); }, []);
  const sharePicked = useCallback(() => { setOnly(null); setOpen(true); }, []);
  const close = useCallback(() => { setOpen(false); setOnly(null); }, []);
  // `_closeLayer(…, "saved")`: play the sheet-out animation, then unmount.
  const closeSaved = useCallback(() => { setSavedOut(true); setTimeout(() => { setSavedOpen(false); setSavedOut(false); }, 200); }, []);
  // The saved sheet only exists while something is picked (`o.length > 0`).
  useEffect(() => { if (!picked.length) setSavedOpen(false); }, [picked.length]);
  return { picked, toggle, remove, clear, open, only, clients, setClients, shareProp, sharePicked, close, savedOpen, savedOut, openSaved: () => setSavedOpen(true), closeSaved };
}

// ---------------------------------------------------------------- helpers

const POOL = ["h1a", "h1b", "h2a", "h2b", "h3a", "h3b"].map(n => `/share/${n}.jpg`);
// Canvas `C` (contacts) with their Buyer / Seller tags.
const CONTACTS: [string, string][] = [["Steve Hall", "Buyer"], ["Sarah Holmes", ""], ["Aanya Sharma", ""], ["Liam Johnson", "Seller"], ["Zara Patel", ""], ["Hayley Turner", "Seller"], ["Maya Wong", "Buyer"], ["Alex Field", ""], ["Nia Chen", ""]];
const tagSty = (t: string) => css("flex:none;display:flex;align-items:center;height:18px;padding:0 6px;border-radius:9999px;font:400 10px/18px var(--font-sans);"
  + (t === "Buyer" ? "background:rgba(105,75,119,.1);color:rgb(105,75,119)" : "background:rgba(214,53,41,.08);color:rgb(166,46,36)"));
const photo = (u: string) => `url('${u}') center/cover no-repeat`;
const ppsf = (l: Listing) => "$" + Math.round(l.price / l.sqft).toLocaleString("en-US");
export const specs = (l: Listing) => `${l.beds} Bed · ${l.baths} Bath · ${ppsf(l).slice(1)} per ft² · ${l.lotAc} /ac Lot`; // canvas specs carry no "$"
const fullAddr = (l: Listing) => l.addr + (l.city ? ", " + l.city : "");
export const shareUrl = (only: number | null) => "https://breezy.com/s/" + (only != null ? "p" + only : "c" + 4821) + "-hx7q2";
// `_copyShLink`. writeText rejects when the page isn't focused; swallow that.
const copyLink = (only: number | null) => { try { navigator.clipboard?.writeText(shareUrl(only)).catch(() => {}); } catch {} };

const X = <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg>;
const LINK = <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1" /><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" /></svg>;
const TRASH = <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M4 6h16M9 6V4h6v2M6 6l1 14h10l1-14M10 10v6M14 10v6" /></svg>;

// ---------------------------------------------------------------- share modal

export function ShareModal({ sh, items, toast }: { sh: ShareState; items: Listing[]; toast: (t: string) => void }) {
  const [linkOpen, setLinkOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [gal, setGal] = useState<Record<number, number>>({});
  const [contactOpen, setContactOpen] = useState(false);
  const prevRef = useRef<HTMLDivElement>(null);
  const cpT = useRef<any>(null);
  useEffect(() => () => clearTimeout(cpT.current), []);
  const one = sh.only != null;
  const n = items.length;
  if (!sh.open || !n) return null;

  const first = sh.clients.map(c => c.split(" ")[0]);
  const hey = first.length ? "Hey " + (first.length > 2 ? first.slice(0, -1).join(", ") + " & " + first[first.length - 1] : first.join(" & ")) + "," : "Hey,";
  const countTxt = n === 1 ? "a fantastic property" : n + " fantastic properties";
  const close = () => { setContactOpen(false); setLinkOpen(false); sh.close(); };
  const focus = (id: number) => {
    const box = prevRef.current, el = box?.querySelector<HTMLElement>(`[data-pv="${id}"]`);
    if (box && el) box.scrollTo({ top: el.offsetTop - 40, behavior: "smooth" });
  };
  const navBtn = (on: boolean) => css("width:26px;height:26px;border:none;border-radius:9999px;background:rgb(255,255,255);display:flex;align-items:center;justify-content:center;box-shadow:0 1px 4px rgba(0,0,0,.12);transition:opacity .2s;" + (on ? "cursor:pointer;opacity:1" : "cursor:default;opacity:.45;pointer-events:none"));

  return (
    <>
      <div onClick={close} style={css("position:fixed;inset:0;z-index:205;background:rgba(18,18,18,.32);display:flex;align-items:center;justify-content:center;animation:fadeIn .2s ease both")}>
        <div onClick={e => e.stopPropagation()} style={css("width:min(1417px,calc(100vw - 48px));height:min(902px,calc(100vh - 48px));display:flex;flex-direction:column;border-radius:16px;overflow:hidden;background:rgb(255,255,255);box-shadow:0 34px 90px rgba(30,20,14,.32);animation:bzModalIn2 .3s cubic-bezier(.2,.8,.2,1) both")}>
          <div style={css("flex:none;height:72px;box-sizing:border-box;display:flex;align-items:center;justify-content:space-between;gap:16px;padding:0 20px 0 25px")}>
            <span style={css("font:700 18px/24px var(--font-sans);color:rgb(17,16,16);")}>Share properties</span>
            <button onClick={close} title="Close" className="sh-x" style={css("width:40px;height:40px;border:none;border-radius:9999px;background:rgba(13,12,12,.06);color:rgb(17,16,16);cursor:pointer;display:flex;align-items:center;justify-content:center")}>{X}</button>
          </div>
          <span style={css("flex:none;height:2px;background:rgba(237,205,179,.64)")} />
          <div style={css("flex:1;min-height:0;display:flex")}>
            {/* Left: properties + clients */}
            <div style={css("flex:none;width:514px;max-width:45%;box-sizing:border-box;overflow-y:auto;display:flex;flex-direction:column;gap:16px;padding:20px 25px 40px;box-shadow:inset -.5px 0 0 rgba(13,12,12,.16)")}>
              <div style={css("flex:none;display:flex;flex-direction:column;gap:20px;padding:20px;border-radius:20px;box-shadow:inset 0 0 0 .5px rgba(13,12,12,.16)")}>
                <div style={css("display:flex;align-items:center;justify-content:space-between;gap:12px")}>
                  <span style={css("font:700 15px/20px var(--font-sans);color:rgb(17,16,16);")}>Properties</span>
                  <span style={css("font:400 12px/16px var(--font-sans);color:rgb(73,67,65);letter-spacing:.25px")}>{n + (n === 1 ? " property" : " properties")}</span>
                </div>
                <div style={css("display:flex;flex-direction:column;gap:32px;padding:16px 0")}>
                  {items.map(l => (
                    <div key={l.id} style={css("display:flex;align-items:center;gap:12px;min-height:67px")}>
                      <span style={{ ...css("flex:none;width:67px;height:67px;border-radius:8px"), background: photo(l.photos[0]) }} />
                      <span style={css("flex:1;min-width:0;display:flex;flex-direction:column")}>
                        <span style={css("font:700 14px/19px var(--font-sans);color:rgb(18,18,18);letter-spacing:.25px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis")}>{l.addr}</span>
                        <span style={css("font:400 12px/17px var(--font-sans);color:rgb(73,67,65);letter-spacing:.25px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis")}>{specs(l)}</span>
                        <span style={css("font:700 14px/21px var(--font-sans);color:rgb(18,18,18);margin-top:4px;letter-spacing:.25px")}>{fullPrice(l.price)}</span>
                      </span>
                      <button onClick={() => focus(l.id)} title="Preview" className="btn-ghost" style={css("flex:none;width:32px;height:32px;border:none;border-radius:9999px;background:none;color:rgb(17,16,16);cursor:pointer;display:flex;align-items:center;justify-content:center")}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M9 6l6 6-6 6" /></svg>
                      </button>
                    </div>
                  ))}
                </div>
              </div>
              <div style={css("flex:none;display:flex;flex-direction:column;gap:12px;padding:20px;border-radius:20px;background:rgb(255,255,255);box-shadow:inset 0 0 0 .5px rgba(13,12,12,.16)")}>
                <div style={css("display:flex;align-items:center;justify-content:space-between;gap:12px;min-height:32px")}>
                  <span style={css("font:700 15px/20px var(--font-sans);color:rgb(17,16,16);")}>Clients</span>
                  {sh.clients.length > 0 && <button onClick={() => setContactOpen(true)} className="sh-add" style={css("flex:none;height:32px;padding:0 14px;border:none;border-radius:9999px;background:rgba(13,12,12,.07);font:700 13px/18px var(--font-sans);color:rgb(18,18,18);cursor:pointer")}>Add</button>}
                </div>
                {sh.clients.length > 0 ? (
                  <div style={css("display:flex;flex-direction:column;gap:4px")}>
                    {sh.clients.map(c => (
                      <div key={c} style={css("display:flex;align-items:center;gap:12px;height:48px;animation:fadeIn .2s ease both")}>
                        <span style={css("flex:none;width:40px;height:40px;border-radius:9999px;background:rgb(238,206,186);display:flex;align-items:center;justify-content:center;font:400 14px/18px var(--font-sans);color:rgb(18,18,18);")}>{c.split(" ").map(w => w[0]).join("").slice(0, 2)}</span>
                        <span style={css("flex:1;min-width:0;font:400 14px/1.26 var(--font-sans);color:rgb(18,18,18);white-space:nowrap;overflow:hidden;text-overflow:ellipsis")}>{c}</span>
                        <button onClick={() => sh.setClients(sh.clients.filter(x => x !== c))} title="Remove" className="btn-ghost" style={css("flex:none;width:32px;height:32px;border:none;border-radius:9999px;background:none;color:rgb(18,18,18);cursor:pointer;display:flex;align-items:center;justify-content:center")}>{TRASH}</button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div style={css("display:flex;justify-content:center;gap:40px;padding:8px 0 4px")}>
                    <button onClick={() => setContactOpen(true)} style={css("display:flex;flex-direction:column;align-items:center;gap:8px;padding:0;border:none;background:none;cursor:pointer")}>
                      <span style={css("width:40px;height:40px;border-radius:9999px;background:rgba(18,18,18,.06);display:flex;align-items:center;justify-content:center")}><span style={css("width:16px;height:16px;background:rgb(77,71,69);-webkit-mask:url('/ui/search.svg') center/contain no-repeat;mask:url('/ui/search.svg') center/contain no-repeat")} /></span>
                      <span style={css("font:400 12px/16px var(--font-sans);color:rgb(18,18,18);")}>Search</span>
                    </button>
                    <button onClick={() => setContactOpen(true)} style={css("display:flex;flex-direction:column;align-items:center;gap:8px;padding:0;border:none;background:none;cursor:pointer")}>
                      <span style={css("width:40px;height:40px;border-radius:9999px;background:rgba(18,18,18,.06);display:flex;align-items:center;justify-content:center")}><svg width="17" height="17" viewBox="0 0 256 256" fill="none" stroke="rgb(77,71,69)" strokeWidth="16" strokeLinecap="round" strokeLinejoin="round"><circle cx="108" cy="100" r="60" /><path d="M24 200c20.6-30.6 49.5-48 84-48s63.4 17.4 84 48M200 64v48M176 88h48" /></svg></span>
                      <span style={css("font:400 12px/16px var(--font-sans);color:rgb(18,18,18);")}>New</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
            {/* Right: what the client receives */}
            <div ref={prevRef} style={css("flex:1;min-width:0;overflow-y:auto;background-color:rgb(250,249,248);background-image:radial-gradient(rgba(13,12,12,.14) 1px,transparent 1.2px);background-size:14px 14px;padding:40px 32px;box-sizing:border-box;display:flex;flex-direction:column;align-items:center")}>
              <div style={css("flex:none;width:100%;max-width:792px;box-sizing:border-box;overflow:hidden;display:flex;flex-direction:column;padding:44px clamp(20px,10%,79px) 56px;background:rgb(241,231,228);container-type:inline-size;box-shadow:0 0 0 .5px rgba(13,12,12,.12)")}>
                <div style={css("display:flex;flex-direction:column;gap:14px")}>
                  <div style={css("display:flex;flex-wrap:wrap;align-items:center;gap:9px")}>
                    <span style={css("flex:none;width:48px;height:48px;border-radius:9999px;background:rgb(255,255,255) url('/photos/avatar.jpg') center/cover no-repeat")} />
                    <div style={css("flex:1 1 160px;min-width:0;display:flex;flex-direction:column;gap:5px")}>
                      <span style={css("font:400 12px/1.26 var(--font-sans);color:rgb(18,18,18)")}>Agent’s name</span>
                      <div style={css("display:flex;flex-wrap:wrap;gap:4px 13px")}>
                        <span style={css("display:flex;align-items:center;gap:4px;font:400 10px/1.26 var(--font-sans);color:rgb(18,18,18);white-space:nowrap")}><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="rgb(195,65,55)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2" /></svg>037 7332-233</span>
                        <span style={css("display:flex;align-items:center;gap:4px;font:400 10px/1.26 var(--font-sans);color:rgb(18,18,18);white-space:nowrap")}><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="rgb(195,65,55)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M3 7l9 6 9-6" /></svg>agentsname@brokerage.com</span>
                      </div>
                    </div>
                    <span style={css("flex:0 1 148px;min-width:96px;aspect-ratio:148/52;box-sizing:border-box;padding:4px;border-radius:4px;background:rgb(255,255,255)")}><span style={css("display:block;width:100%;height:100%;background:url('/share/brokerage-logo.jpg') center/cover no-repeat")} /></span>
                  </div>
                  <span style={css("display:block;height:1px;background:rgb(234,215,210)")} />
                </div>
                <span style={css("margin-top:35px;font:300 28px/1.2 var(--font-sans);letter-spacing:-.01em;color:rgb(7,6,6);text-wrap:pretty")}>{hey} I found <b style={{ fontWeight: 700 }}>{countTxt}</b> for you!</span>
                <span style={css("align-self:flex-start;margin-top:24px;display:flex;align-items:center;gap:5px;height:28px;padding:0 11px 0 9px;border-radius:9999px;background:rgb(255,255,255);font:700 10px/1 var(--font-sans);color:rgb(18,18,18);white-space:nowrap")}>
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M7 4v16M3.5 16.5 7 20l3.5-3.5M17 20V4M13.5 7.5 17 4l3.5 3.5" /></svg>Sort by: Newest
                </span>
                <div style={css("margin-top:12px;display:flex;flex-direction:column;gap:36px")}>
                  {items.map((l, i) => {
                    const ph = [0, 1, 2, 3].map(j => POOL[(i * 2 + j) % POOL.length]);
                    const gi = gal[l.id] || 0;
                    const setG = (d: number) => (e: React.MouseEvent) => { e.stopPropagation(); setGal(g => ({ ...g, [l.id]: Math.max(0, Math.min(ph.length - 2, gi + d)) })); };
                    const stats: [string, string][] = [[String(l.beds), "bed"], [String(l.baths), "bath"], [l.sqft.toLocaleString("en-US"), "ft² home"], [Math.round(l.lotAc * 43560).toLocaleString("en-US"), "ft² lot"]];
                    return (
                      <div key={l.id} data-pv={l.id} style={css("display:flex;flex-direction:column;gap:9px")}>
                        <div style={{ ...css("position:relative;height:202px;overflow:hidden"), ["--pw" as any]: "calc((100cqw - clamp(40px,20cqw,158px) - 13px) / 2)" }}>
                          <div style={css("display:flex;gap:13px;height:202px;transition:transform .45s cubic-bezier(.2,.8,.2,1);transform:translateX(calc(" + (-gi) + " * (var(--pw) + 13px)))")}>
                            {ph.map((u, k) => <span key={k} style={{ ...css("flex:none;width:var(--pw);height:202px;border-radius:5px"), background: `rgb(225,214,210) url('${u}') center/cover no-repeat` }} />)}
                          </div>
                          <div style={css("position:absolute;right:10px;bottom:10px;z-index:2;display:flex;gap:4px")}>
                            <button onClick={setG(-1)} title="Previous" className="sh-pv" style={navBtn(gi > 0)}>
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="rgb(18,18,18)" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5M11 6l-6 6 6 6" /></svg>
                            </button>
                            <button onClick={setG(1)} title="Next" className="sh-pv" style={navBtn(gi < ph.length - 2)}>
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="rgb(18,18,18)" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
                            </button>
                          </div>
                        </div>
                        <div style={css("display:flex;flex-direction:column;gap:7px")}>
                          <div style={css("display:flex;align-items:center;gap:24px")}>
                            <span style={css("flex:1;min-width:0;font:300 20px/1.26 var(--font-sans);letter-spacing:-.55px;color:rgb(22,19,19)")}>{fullAddr(l)}</span>
                            <span style={css("flex:none;display:flex;flex-direction:column;align-items:flex-end")}>
                              <span style={css("font:300 14.3px/1.26 var(--font-sans);letter-spacing:-.28px;color:rgb(18,18,18);white-space:nowrap")}>{fullPrice(l.price)}</span>
                              <span style={css("color:rgba(17,16,16,.65);font:400 9px/12px var(--font-sans);white-space:nowrap")}>{l.dom} DOM</span>
                            </span>
                          </div>
                          <div style={css("display:flex;gap:13px")}>
                            {stats.map(([v, k]) => (
                              <span key={k} style={css("display:flex;flex-direction:column;gap:1px")}>
                                <span style={css("font:400 10px/1.26 var(--font-sans);letter-spacing:.14px;color:rgb(17,16,16);white-space:nowrap")}>{v}</span>
                                <span style={css("color:rgba(17,16,16,.65);font:400 9px/1.48 var(--font-sans);letter-spacing:.14px;white-space:nowrap")}>{k}</span>
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
          <div style={css("flex:none;height:83px;box-sizing:border-box;display:flex;align-items:center;justify-content:space-between;gap:16px;padding:20px 25px;background:rgb(255,255,255);box-shadow:inset 0 .5px 0 rgba(13,12,12,.16)")}>
            <span />
            <div style={css("position:relative;flex:none")}>
              <div style={css("display:flex;gap:2px")}>
                <button onClick={() => { setLinkOpen(v => !v); setCopied(false); }} className="fb-dark" style={css("display:flex;align-items:center;gap:8px;height:43px;padding:0 16px 0 14px;border:none;border-radius:9999px 6px 6px 9999px;background:rgb(18,18,18);font:700 15px/20px var(--font-sans);color:rgb(253,252,252);cursor:pointer")}>Share</button>
                <button onClick={() => { copyLink(sh.only); toast("Link copied to clipboard"); }} title="Copy link" className="fb-dark" style={css("display:flex;align-items:center;justify-content:center;width:46px;height:43px;padding:0 2px 0 0;border:none;border-radius:6px 9999px 9999px 6px;background:rgb(18,18,18);color:rgb(253,252,252);cursor:pointer")}>{LINK}</button>
              </div>
              {linkOpen && <>
                <div onClick={() => { setLinkOpen(false); setCopied(false); }} style={css("position:fixed;inset:0;z-index:1")} />
                <div style={css("position:absolute;right:0;bottom:55px;z-index:2;width:400px;box-sizing:border-box;display:flex;flex-direction:column;border-radius:20px;background:rgb(255,255,255);box-shadow:inset 0 0 0 .5px rgba(13,12,12,.16),0 18px 44px rgba(30,20,14,.18);animation:bzPanelDrop .22s cubic-bezier(.2,.8,.2,1) both")}>
                  <div style={css("display:flex;flex-direction:column;gap:12px;padding:20px 20px 16px")}>
                    <span style={css("font:700 15px/20px var(--font-sans);color:rgb(17,16,16)")}>Share link</span>
                    <span style={css("font:400 14px/1.48 var(--font-sans);letter-spacing:.25px;color:rgb(73,67,65);text-wrap:pretty")}>Anyone with the link can view {one ? "this property" : "these properties"}.</span>
                    <div style={css("display:flex;align-items:center;gap:10px;height:48px;box-sizing:border-box;padding:0 4px 0 14px;border-radius:9999px;background:rgb(249,249,249);box-shadow:inset 0 0 0 .5px rgba(13,12,12,.24)")}>
                      <span style={css("flex:none;display:flex;color:rgb(98,90,89)")}>{LINK}</span>
                      <span style={css("flex:1;min-width:0;font:400 14px/18px var(--font-sans);color:rgb(18,18,18);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;user-select:all")}>{shareUrl(sh.only)}</span>
                      <button onClick={() => { copyLink(sh.only); setCopied(true); clearTimeout(cpT.current); cpT.current = setTimeout(() => setCopied(false), 1800); }} className="fb-dark fb-cta2"
                        style={css("flex:none;height:40px;min-width:96px;padding:0 16px;border:none;border-radius:9999px;background:rgb(18,18,18);font:700 14px/18px var(--font-sans);color:rgb(253,252,252);cursor:pointer;white-space:nowrap")}>{copied ? "Copied" : "Copy link"}</button>
                    </div>
                  </div>
                </div>
              </>}
            </div>
          </div>
        </div>
      </div>
      {contactOpen && <ContactSheet chosen={sh.clients} onCancel={() => setContactOpen(false)} onAdd={c => { sh.setClients(c); setContactOpen(false); }} />}
    </>
  );
}

// ---------------------------------------------------------------- contact picker

// The canvas `contactOpen` sheet, opened for "share" (`openC("share")`).
// Contacts created here (`onContactCreate`) are kept for the session.
let created: string[] = [];
function ContactSheet({ chosen, onCancel, onAdd }: { chosen: string[]; onCancel: () => void; onAdd: (c: string[]) => void }) {
  const [q, setQ] = useState("");
  const [sel, setSel] = useState<Record<string, boolean>>(() => Object.fromEntries(chosen.map(n => [n, true])));
  const [extra, setExtra] = useState<string[]>(created);
  const inp = useRef<HTMLInputElement>(null);
  useEffect(() => { const t = setTimeout(() => { try { inp.current?.focus({ preventScroll: true }); } catch {} }, 80); return () => clearTimeout(t); }, []);
  const all: [string, string][] = CONTACTS.concat(extra.map(n => [n, ""] as [string, string]));
  const ql = q.trim().toLowerCase();
  const rows = all.filter(([n]) => !ql || n.toLowerCase().includes(ql));
  const nSel = Object.values(sel).filter(Boolean).length;
  const create = () => {
    const n = q.trim();
    if (!n) return;
    created = created.concat([n]); setExtra(created);
    setSel(s => ({ ...s, [n]: true })); setQ("");
  };
  return (
    <>
      <div onClick={onCancel} style={css("position:fixed;inset:0;z-index:210;background:rgba(18,18,18,.32);animation:fadeIn .2s ease both")} />
      <div style={css("position:fixed;left:50%;top:50%;transform:translate(-50%,-50%);z-index:211;width:452px;max-width:calc(100vw - 24px);max-height:calc(100vh - 160px);box-sizing:border-box;display:flex;flex-direction:column;border-radius:24px;background:rgb(255,255,255);box-shadow:inset 0 0 0 1px rgba(13,12,12,.08),0 24px 60px rgba(30,18,12,.22);overflow:hidden;animation:bzModalIn .26s cubic-bezier(.2,.8,.2,1) both")}>
        <div style={css("flex:none;display:flex;align-items:center;gap:12px;padding:16px 20px;box-shadow:inset 0 -1px 0 rgba(13,12,12,.08)")}>
          <span style={css("flex:none;width:16px;height:16px;background:rgb(98,90,89);-webkit-mask:url('/ui/search.svg') center/contain no-repeat;mask:url('/ui/search.svg') center/contain no-repeat")} />
          <input ref={inp} value={q} onChange={e => setQ(e.target.value)} onKeyDown={e => { if (e.key === "Enter" && !rows.length) create(); if (e.key === "Escape") onCancel(); }} placeholder="Search Contact" style={css("flex:1;min-width:0;border:none;outline:none;background:none;padding:0;font:400 14px/20px var(--font-sans);color:rgb(18,18,18)")} />
          <button onClick={onCancel} style={css("flex:none;height:32px;padding:0 4px;border:none;background:none;font:700 14px/18px var(--font-sans);color:rgb(18,18,18);cursor:pointer")}>Cancel</button>
        </div>
        <div style={css("flex:1;min-height:0;overflow-y:auto;padding:8px 12px")}>
          {rows.map(([n, t]) => {
            const on = !!sel[n];
            return (
              <button key={n} onClick={() => setSel(s => ({ ...s, [n]: !on }))} className="sh-row" style={css("width:100%;display:flex;align-items:center;gap:8px;height:56px;padding:0 8px;border:none;border-radius:12px;background:none;cursor:pointer;text-align:left")}>
                <span style={css("flex:none;font:400 14px/1.26 var(--font-sans);color:rgb(18,18,18)")}>{n}</span>
                {t && <>
                  <span style={css("flex:none;width:6px;height:6px;margin-left:8px;border-radius:9999px;background:rgb(214,53,41)")} />
                  <span style={tagSty(t)}>{t}</span>
                </>}
                <span style={{ flex: 1 }} />
                <span style={css("flex:none;width:18px;height:18px;border-radius:9999px;display:flex;align-items:center;justify-content:center;transition:background .16s;" + (on ? "background:rgb(18,18,18)" : "box-shadow:inset 0 0 0 1.3px rgb(18,18,18)"))}>
                  {on && <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="rgb(255,255,255)" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>}
                </span>
              </button>
            );
          })}
          {!rows.length && <span style={css("display:block;padding:24px 8px;font:400 14px/20px var(--font-sans);color:rgb(98,90,89);text-align:center")}>No contacts match. Create one below.</span>}
        </div>
        <div style={css("flex:none;display:flex;align-items:center;justify-content:space-between;gap:16px;padding:16px 20px;box-shadow:inset 0 1px 0 rgba(13,12,12,.08)")}>
          <button onClick={create} className="fb-ghost" style={css("flex:none;height:40px;padding:0 12px;margin-left:-12px;border:none;border-radius:9999px;background:none;font:700 14px/18px var(--font-sans);color:rgb(18,18,18);cursor:pointer")}>Create contact</button>
          <button onClick={() => onAdd(all.map(c => c[0]).filter(n => sel[n]))} className="fb-dark" style={css("flex:none;height:40px;padding:0 16px;border:none;border-radius:9999px;background:rgb(18,18,18);font:700 14px/18px var(--font-sans);color:rgb(249,249,249);cursor:pointer")}>{nSel > 1 ? "Add clients (" + nSel + ")" : "Add client"}</button>
        </div>
      </div>
    </>
  );
}

// ---------------------------------------------------------------- picked set

// Results-column footer while properties are picked (`hasPicked`): stacked
// thumbnails that open the saved sheet, and "Share n properties".
export function PickedFooter({ sh, byId }: { sh: ShareState; byId: (id: number) => Listing | undefined }) {
  const o = sh.picked.slice().reverse().map(byId).filter(Boolean) as Listing[];
  if (!o.length) return null;
  const vis = o.slice(0, 2);
  return (
    <div style={css("flex:none;height:81px;box-sizing:border-box;display:flex;align-items:center;justify-content:center;gap:16px;padding:12px 20px 20px;background:rgb(253,252,252);box-shadow:inset 0 1px 0 rgba(13,12,12,.16);animation:fadeIn .2s ease both")}>
      <div onClick={sh.openSaved} title="View saved properties" style={css("flex:none;display:flex;align-items:center;gap:4px;height:48px;isolation:isolate;cursor:pointer")}>
        <div style={css("display:flex;align-items:center")}>
          {vis.map((l, n) => (
            <span key={l.id} style={{ ...css("flex:none;position:relative;border-radius:" + (n ? 7 : 8) + "px;box-shadow:inset 0 0 0 " + (n ? 2.188 : 2.5) + "px rgb(255,255,255);width:" + (n ? 38 : 48) + "px;height:" + (n ? 38 : 48) + "px;margin-left:" + (n ? -20 : 0) + "px;z-index:" + (3 - n) + ";animation:fadeIn .2s ease both"), background: photo(l.photos[0]) }} />
          ))}
        </div>
        {o.length > 2 && <span style={css("min-width:19px;font:700 16px/1.26 var(--font-sans);letter-spacing:-.25px;color:rgb(18,18,18);text-align:center")}>+{o.length - 2}</span>}
      </div>
      <button onClick={sh.sharePicked} className="fb-dark" style={css("flex:1;min-width:0;height:43px;padding:0 12px;border:none;border-radius:9999px;background:rgb(18,18,18);font:700 15px/20px var(--font-sans);color:rgb(253,252,252);cursor:pointer;white-space:nowrap")}>{"Share " + o.length + (o.length === 1 ? " property" : " properties")}</button>
    </div>
  );
}

// "Saved properties" sheet over the results column (`showSaved`).
export function SavedSheet({ sh, byId, onOpen }: { sh: ShareState; byId: (id: number) => Listing | undefined; onOpen: (id: number) => void }) {
  const o = sh.picked.slice().reverse().map(byId).filter(Boolean) as Listing[];
  if (!sh.savedOpen || !o.length) return null;
  return (
    <div style={css("position:absolute;left:0;right:0;top:76px;bottom:0;z-index:4;display:flex;flex-direction:column;border-radius:24px;background:rgb(255,255,255);box-shadow:inset 0 0 0 1px rgba(13,12,12,.1);overflow:hidden;pointer-events:auto;transform-origin:50% 0;animation:" + (sh.savedOut ? "bzSheetOut .2s cubic-bezier(.4,0,1,1) both" : "bzSheetIn .38s cubic-bezier(.2,.8,.2,1) backwards"))}>
      <div style={css("flex:none;height:80px;box-sizing:border-box;display:flex;align-items:center;gap:12px;padding:16px;background:rgb(255,255,255)")}>
        <button onClick={sh.closeSaved} title="Back" className="sh-x" style={css("flex:none;width:32px;height:32px;border:none;border-radius:9999px;background:rgba(13,12,12,.05);color:rgb(17,16,16);cursor:pointer;display:flex;align-items:center;justify-content:center")}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 6l-6 6 6 6" /></svg>
        </button>
        <span style={css("flex:1;min-width:0;display:flex;flex-direction:column;gap:4px")}>
          <span style={css("font:700 18px/1.48 var(--font-sans);color:rgb(18,18,18)")}>Saved properties</span>
          <span style={css("font:400 14px/1.48 var(--font-sans);letter-spacing:.25px;color:rgb(73,67,65)")}>{o.length + (o.length === 1 ? " property" : " properties")}</span>
        </span>
      </div>
      <div className="no-scrollbar" style={css("flex:1;min-height:0;overflow-y:auto;display:flex;flex-direction:column;gap:32px;padding:16px")}>
        {o.map(l => (
          <div key={l.id} onClick={() => onOpen(l.id)} style={css("flex:none;display:flex;align-items:center;gap:12px;height:89px;cursor:pointer;animation:fadeIn .2s ease both")}>
            <span style={{ ...css("flex:none;width:89px;height:89px;border-radius:8px"), background: photo(l.photos[0]) }} />
            <span style={css("flex:1;min-width:0;display:flex;flex-direction:column")}>
              <span style={css("font:700 14px/19px var(--font-sans);letter-spacing:.25px;color:rgb(18,18,18);white-space:nowrap;overflow:hidden;text-overflow:ellipsis")}>{fullAddr(l)}</span>
              <span style={css("font:400 14px/21px var(--font-sans);letter-spacing:.25px;color:rgb(73,67,65);display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden")}>{specs(l)}</span>
              <span style={css("height:6px")} />
              <span style={css("display:flex;align-items:baseline;gap:4px;white-space:nowrap")}>
                <span style={css("font:700 14px/21px var(--font-sans);letter-spacing:.25px;color:rgb(18,18,18)")}>{fullPrice(l.price)}</span>
                <span style={css("font:400 12px/16px var(--font-sans);letter-spacing:.25px;color:rgb(98,90,89)")}>/ {ppsf(l)} per ft²</span>
              </span>
            </span>
            <button onClick={e => { e.stopPropagation(); sh.remove(l.id); }} title="Remove" className="btn-ghost" style={css("flex:none;width:32px;height:32px;margin-right:-4px;border:none;border-radius:9999px;background:none;color:rgb(17,16,16);cursor:pointer;display:flex;align-items:center;justify-content:center")}>{TRASH}</button>
          </div>
        ))}
      </div>
      <div style={css("flex:none;height:84px;box-sizing:border-box;display:flex;align-items:center;justify-content:center;gap:16px;padding:20px;background:rgb(255,255,255);box-shadow:inset 0 1px 0 rgba(13,12,12,.16)")}>
        <button onClick={sh.clear} className="fb-ghost" style={css("flex:none;height:43px;padding:0 12px;border:none;border-radius:9999px;background:none;font:700 15px/20px var(--font-sans);color:rgb(18,18,18);cursor:pointer")}>Clear all</button>
        <button onClick={sh.sharePicked} className="fb-dark" style={css("flex:1;min-width:0;height:43px;padding:0 16px;border:none;border-radius:9999px;background:rgb(18,18,18);font:700 15px/20px var(--font-sans);color:rgb(253,252,252);cursor:pointer;white-space:nowrap")}>{"Share " + o.length + (o.length === 1 ? " property" : " properties")}</button>
      </div>
    </div>
  );
}
