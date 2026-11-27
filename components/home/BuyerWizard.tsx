"use client";
// New buyer search, buyer first (19 Nov, Jimsy: "the buyer journey needs to be wizard based
// and reversed, start with the buyer"). Agents set searches up for a client, so the wizard
// starts with who it's for, then where, then what, then how to keep them posted:
//   1 Buyer    pick a contact or add a new one (name, email, phone)
//   2 Area     where they're looking (search, quick picks; several areas allowed)
//   3 Criteria budget, beds, baths, home type, must-haves
//   4 Alerts   search name, alerts on / frequency, send matches to the buyer
// Saving commits the areas and filters, saves the search for that buyer and shows the matches
// (app/home/page.tsx `finishBuyer`).
// 27 Nov (team: "the highlight and tooltip version"): Create → Buyer search opens only step 1
// (`contactOnly`): once the buyer is picked the modal closes and the guided overlay takes over
// on the map (search field → area → All filters → Save search, app/home/page.tsx). The full
// four-step wizard stays here, unused on main.
import { useEffect, useMemo, useRef, useState } from "react";
import { CONTACTS, CLIENT_PHOTOS, initials, useSaved } from "../SavedState";
import { Area, Place, searchPlaces } from "@/lib/places";
import { F_FEATS, F_TYPES, Filters } from "@/lib/filters";

export type BuyerResult = {
  buyer: { name: string; email?: string; phone?: string; isNew: boolean };
  areas: Area[];
  f: Partial<Filters>;
  name: string; notify: boolean; freq: string; shareWithBuyer: boolean;
};

const INK = "rgb(18,18,18)", MUTED = "rgb(98,90,89)", LINE = "rgba(18,18,18,.12)", SOFT = "rgb(245,243,243)";
const STEPS = ["Buyer", "Area", "Criteria", "Alerts"];
const BUDGET = [0, 500e3, 750e3, 1e6, 1.25e6, 1.5e6, 2e6, 2.5e6, 3e6, 4e6, 5e6];
const money = (v: number) => v >= 1e6 ? `$${(v / 1e6).toFixed(2).replace(/\.?0+$/, "")}m` : `$${Math.round(v / 1e3)}k`;
const QUICK_AREAS = ["Silver Lake", "Echo Park", "Los Feliz"];
const FREQ = ["Instant", "Daily digest", "Weekly"];

export type BuyerPick = BuyerResult["buyer"];

export function BuyerWizard({ onClose, onDone, contactOnly, onBuyer }: { onClose: () => void; onDone?: (r: BuyerResult) => void;
  /** Only the contact step; Continue hands the buyer to `onBuyer`. */ contactOnly?: boolean; onBuyer?: (b: BuyerPick) => void }) {
  const sv = useSaved();
  const [step, setStep] = useState(0);
  // 1 · buyer
  const [buyer, setBuyer] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [nb, setNb] = useState({ name: "", email: "", phone: "" });
  const [q, setQ] = useState("");
  // 2 · area
  const [areas, setAreas] = useState<Area[]>([]);
  const [aq, setAq] = useState("");
  const [sugg, setSugg] = useState<Place[] | null>(null);
  // 3 · criteria
  const [lo, setLo] = useState(0), [hi, setHi] = useState(0); // indexes into BUDGET (hi 0 = no max)
  const [beds, setBeds] = useState(0), [baths, setBaths] = useState(0);
  const [types, setTypes] = useState<Record<string, boolean>>({});
  const [feats, setFeats] = useState<Record<string, boolean>>({});
  // 4 · alerts
  const [name, setName] = useState(""); const [named, setNamed] = useState(false);
  const [notify, setNotify] = useState(true), [freq, setFreq] = useState("Instant"), [share, setShare] = useState(true);

  const first = (buyer || nb.name || "your buyer").split(" ")[0];
  const contacts = useMemo(() => {
    const all: [string, string][] = CONTACTS.concat(sv.newContacts.filter(n => !CONTACTS.some(c => c[0] === n)).map(n => [n, ""] as [string, string]));
    // Buyers first: they're who a buyer search is usually for.
    return all.filter(c => c[0].toLowerCase().includes(q.trim().toLowerCase())).sort((a, b) => Number(b[1] === "Buyer") - Number(a[1] === "Buyer"));
  }, [q, sv.newContacts]);

  // Area suggestions (lenient search: gazetteer offline), addresses left out.
  useEffect(() => {
    const t = aq.trim();
    if (t.length < 2) { setSugg(null); return; }
    let live = true;
    const id = setTimeout(async () => {
      const r = await searchPlaces(t, [-118.27, 34.087]);
      if (live) setSugg(r.filter(p => p.kind !== "address").slice(0, 5));
    }, 220);
    return () => { live = false; clearTimeout(id); };
  }, [aq]);
  const addArea = (a: Area) => { setAreas(l => l.some(x => x.label === a.label) ? l : [...l, a]); setAq(""); setSugg(null); };

  // Suggested name, until the agent edits it.
  const areaName = areas.map(a => a.label.split(",")[0]).slice(0, 2).join(" & ") + (areas.length > 2 ? ` +${areas.length - 2}` : "");
  useEffect(() => { if (!named) setName(`${first}'s search${areaName ? " · " + areaName : ""}`); }, [first, areaName, named]);

  const ok = [
    !!buyer || (adding && nb.name.trim().length > 1),
    areas.length > 0,
    !(hi && lo && BUDGET[hi] <= BUDGET[lo]),
    name.trim().length > 0,
  ][step];
  const next = () => {
    if (!ok) return;
    if (contactOnly) { onBuyer?.({ name: adding ? nb.name.trim() : buyer!, email: adding ? nb.email.trim() : undefined, phone: adding ? nb.phone.trim() : undefined, isNew: adding }); return; }
    if (step < 3) { if (step === 0 && adding) setBuyer(null); setStep(step + 1); return; }
    const bName = adding ? nb.name.trim() : buyer!;
    const pick = (m: Record<string, boolean>) => Object.fromEntries(Object.entries(m).filter(([, v]) => v));
    onDone?.({
      buyer: { name: bName, email: adding ? nb.email.trim() : undefined, phone: adding ? nb.phone.trim() : undefined, isNew: adding },
      areas,
      f: { st: { Active: true }, tg: {}, pLo: lo ? BUDGET[lo] / 50000 : 0, pHi: hi ? BUDGET[hi] / 50000 : 100, bedMin: beds, bathMin: baths, types: pick(types), feats: pick(feats) },
      name: name.trim(), notify, freq, shareWithBuyer: share,
    });
  };
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === "Escape") { e.preventDefault(); onClose(); } };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [onClose]);

  const crit = [
    lo || hi ? (lo && hi ? `${money(BUDGET[lo])}–${money(BUDGET[hi])}` : lo ? `From ${money(BUDGET[lo])}` : `Up to ${money(BUDGET[hi])}`) : "",
    beds ? `${beds}+ bd` : "", baths ? `${baths}+ ba` : "",
    ...Object.keys(types).filter(k => types[k]), ...Object.keys(feats).filter(k => feats[k]),
  ].filter(Boolean);
  const titles = [
    ["Who's this search for?", contactOnly ? "Start with your buyer. Then we'll show you where to set their area, criteria and alerts on the map." : "Start with your buyer. Their search, alerts and matches stay together."],
    [`Where is ${first} looking?`, "Add one or more areas."],
    [`What does ${first} need?`, "Everything is optional. You can fine-tune the filters later."],
    ["How should we keep you posted?", `We'll watch for new listings that match ${first}'s criteria.`],
  ][step];

  return (
    <div onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }} style={{ position: "fixed", inset: 0, zIndex: 120, background: "rgba(18,15,14,.42)", display: "flex", alignItems: "center", justifyContent: "center", padding: 24, animation: "fadeIn .2s ease both" }}>
      <div data-bw style={{ width: 600, maxWidth: "100%", maxHeight: "min(720px, calc(100vh - 48px))", display: "flex", flexDirection: "column", borderRadius: 24, background: "rgb(253,252,252)", boxShadow: "0 24px 64px rgba(30,18,12,.28)", overflow: "hidden", animation: "hvPop .28s cubic-bezier(.2,.8,.2,1) both" }}>
        {/* Header: title, stepper, the search so far */}
        <div style={{ flex: "none", padding: "20px 24px 0", display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <span style={{ font: "700 15px/20px var(--font-sans)", color: INK }}>New buyer search</span>
            {!contactOnly && <span style={{ font: "400 13px/18px var(--font-sans)", color: MUTED }}>Step {step + 1} of 4</span>}
            <span style={{ flex: 1 }} />
            <button onClick={onClose} title="Close" className="sv-grey" style={{ width: 32, height: 32, border: "none", borderRadius: 9999, background: "rgba(13,12,12,.05)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}><i className="ph ph-x" style={{ fontSize: 16, color: INK }} /></button>
          </div>
          {!contactOnly && <div style={{ display: "flex", gap: 6 }}>
            {STEPS.map((s, i) => (
              <button key={s} onClick={() => i < step && setStep(i)} disabled={i >= step} style={{ flex: 1, display: "flex", flexDirection: "column", gap: 6, padding: 0, border: "none", background: "none", cursor: i < step ? "pointer" : "default", textAlign: "left" }}>
                <span style={{ height: 4, borderRadius: 9999, background: i <= step ? INK : "rgba(18,18,18,.1)", transition: "background .3s" }} />
                <span style={{ font: `${i === step ? 700 : 400} 12px/16px var(--font-sans)`, color: i <= step ? INK : MUTED }}>{s}</span>
              </button>
            ))}
          </div>}
          {step > 0 && (
            <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 6, font: "400 12px/16px var(--font-sans)", color: MUTED }}>
              <Avatar name={adding ? nb.name : buyer || ""} size={20} />
              <b style={{ color: INK, fontWeight: 700 }}>{adding ? nb.name : buyer}</b>
              {step > 1 && areaName && <><span>·</span><span>{areaName}</span></>}
              {step > 2 && crit.length > 0 && <><span>·</span><span>{crit.slice(0, 3).join(", ")}{crit.length > 3 ? ` +${crit.length - 3}` : ""}</span></>}
            </div>
          )}
        </div>
        <div key={step} style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: "22px 24px 8px", display: "flex", flexDirection: "column", gap: 18, animation: "bwIn .32s cubic-bezier(.2,.8,.2,1) both" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <span style={{ font: "700 22px/28px var(--font-sans)", color: INK, letterSpacing: "-.2px" }}>{titles[0]}</span>
            <span style={{ font: "400 14px/20px var(--font-sans)", color: MUTED }}>{titles[1]}</span>
          </div>

          {step === 0 && (!adding ? (
            <>
              <Field icon="ph-magnifying-glass" value={q} onChange={setQ} placeholder="Search your contacts" autoFocus />
              <div style={{ display: "flex", flexDirection: "column", gap: 2, margin: "-6px -8px 0" }}>
                <button onClick={() => { setAdding(true); setBuyer(null); setNb(n => ({ ...n, name: q.trim() && !contacts.length ? q.trim() : n.name })); }} className="hover-row" style={row(false)}>
                  <span style={{ width: 36, height: 36, borderRadius: 9999, background: SOFT, display: "flex", alignItems: "center", justifyContent: "center" }}><i className="ph ph-user-plus" style={{ fontSize: 18, color: INK }} /></span>
                  <span style={{ flex: 1, font: "700 14px/18px var(--font-sans)", color: INK }}>New buyer{q.trim() && !contacts.length ? ` “${q.trim()}”` : ""}</span>
                  <i className="ph ph-caret-right" style={{ fontSize: 14, color: MUTED }} />
                </button>
                {contacts.map(([n, tag]) => (
                  <button key={n} onClick={() => setBuyer(n)} onDoubleClick={() => { setBuyer(n); setStep(1); }} className="hover-row" style={row(buyer === n)}>
                    <Avatar name={n} size={36} />
                    <span style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
                      <span style={{ font: "400 14px/18px var(--font-sans)", color: INK }}>{n}</span>
                      {tag && <span style={{ font: "400 12px/16px var(--font-sans)", color: MUTED }}>{tag}</span>}
                    </span>
                    <span style={{ width: 20, height: 20, borderRadius: 9999, boxShadow: buyer === n ? "none" : `inset 0 0 0 1.5px ${LINE}`, background: buyer === n ? INK : "none", display: "flex", alignItems: "center", justifyContent: "center" }}>{buyer === n && <i className="ph-bold ph-check" style={{ fontSize: 11, color: "rgb(253,252,252)" }} />}</span>
                  </button>
                ))}
              </div>
            </>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <button onClick={() => setAdding(false)} style={{ alignSelf: "flex-start", display: "flex", alignItems: "center", gap: 6, height: 28, padding: "0 10px 0 6px", marginLeft: -6, border: "none", borderRadius: 9999, background: "none", cursor: "pointer", font: "700 13px/18px var(--font-sans)", color: INK }} className="sv-ghost"><i className="ph ph-caret-left" style={{ fontSize: 14 }} />Pick from contacts</button>
              <Label t="Full name"><Field value={nb.name} onChange={v => setNb({ ...nb, name: v })} placeholder="e.g. Jordan Lee" autoFocus /></Label>
              <div style={{ display: "flex", gap: 12 }}>
                <Label t="Email" opt><Field value={nb.email} onChange={v => setNb({ ...nb, email: v })} placeholder="jordan@email.com" /></Label>
                <Label t="Phone" opt><Field value={nb.phone} onChange={v => setNb({ ...nb, phone: v })} placeholder="(323) 555-0100" /></Label>
              </div>
              <span style={{ font: "400 12px/16px var(--font-sans)", color: MUTED }}>Saved to your contacts, so you can send them matches.</span>
            </div>
          ))}

          {step === 1 && (
            <>
              <div style={{ position: "relative" }}>
                <Field icon="ph-map-pin" value={aq} onChange={setAq} placeholder="Neighborhood, city or ZIP" autoFocus
                  onEnter={() => sugg?.[0] && addArea({ label: sugg[0].label, place: sugg[0] })} />
                {sugg && sugg.length > 0 && (
                  <div style={{ position: "absolute", left: 0, right: 0, top: 50, zIndex: 2, padding: 6, borderRadius: 16, background: "rgb(255,255,255)", boxShadow: "0 12px 32px rgba(30,18,12,.16),0 0 0 .5px rgba(13,12,12,.1)" }}>
                    {sugg.map(p => (
                      <button key={p.id} onClick={() => addArea({ label: p.label, place: p })} className="hover-row" style={row(false)}>
                        <i className="ph ph-map-pin" style={{ fontSize: 17, color: MUTED }} />
                        <span style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
                          <span style={{ font: "400 14px/18px var(--font-sans)", color: INK, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{p.label}</span>
                          <span style={{ font: "400 12px/16px var(--font-sans)", color: MUTED }}>{p.sub}</span>
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              {areas.length > 0 && (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                  {areas.map(a => (
                    <span key={a.label} style={{ display: "flex", alignItems: "center", gap: 6, height: 34, padding: "0 6px 0 14px", borderRadius: 9999, background: INK, color: "rgb(253,252,252)", font: "400 14px/18px var(--font-sans)" }}>
                      {a.label.split(",")[0]}
                      <button onClick={() => setAreas(l => l.filter(x => x.label !== a.label))} title="Remove" style={{ width: 24, height: 24, border: "none", borderRadius: 9999, background: "rgba(253,252,252,.14)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}><i className="ph ph-x" style={{ fontSize: 12, color: "rgb(253,252,252)" }} /></button>
                    </span>
                  ))}
                </div>
              )}
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <span style={{ font: "400 12px/16px var(--font-sans)", color: MUTED }}>Popular with your buyers</span>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                  {QUICK_AREAS.filter(n => !areas.some(a => a.label.startsWith(n))).map(n => (
                    <Chip key={n} on={false} onClick={() => addArea({ label: `${n}, Los Angeles` })} icon="ph-plus">{n}</Chip>
                  ))}
                </div>
              </div>
            </>
          )}

          {step === 2 && (
            <>
              <Group t="Budget">
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <Select value={lo} onChange={setLo} opts={BUDGET.map((v, i) => [i, i ? money(v) : "No min"])} />
                  <span style={{ color: MUTED }}>–</span>
                  <Select value={hi} onChange={setHi} opts={BUDGET.map((v, i) => [i, i ? money(v) : "No max"])} />
                </div>
                {hi > 0 && lo > 0 && BUDGET[hi] <= BUDGET[lo] && <span style={{ font: "400 12px/16px var(--font-sans)", color: "rgb(195,65,55)" }}>The max should be above the min.</span>}
              </Group>
              <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
                <Group t="Beds"><Seg value={beds} onChange={setBeds} n={5} /></Group>
                <Group t="Baths"><Seg value={baths} onChange={setBaths} n={4} /></Group>
              </div>
              <Group t="Home type">
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                  {F_TYPES.map(([t]) => <Chip key={t} on={!!types[t]} onClick={() => setTypes(m => ({ ...m, [t]: !m[t] }))}>{t}</Chip>)}
                </div>
              </Group>
              <Group t="Must-haves">
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                  {F_FEATS.map(t => <Chip key={t} on={!!feats[t]} onClick={() => setFeats(m => ({ ...m, [t]: !m[t] }))}>{t}</Chip>)}
                </div>
              </Group>
            </>
          )}

          {step === 3 && (
            <>
              <Label t="Search name"><Field value={name} onChange={v => { setName(v); setNamed(true); }} placeholder="Name this search" /></Label>
              <div style={{ display: "flex", flexDirection: "column", borderRadius: 16, boxShadow: `inset 0 0 0 1px ${LINE}` }}>
                <Toggle icon="ph-bell-simple-ringing" t="Alert me about new matches" s="New listings, price drops and status changes" on={notify} set={setNotify}>
                  {notify && <div style={{ display: "flex", gap: 8, padding: "0 16px 14px 52px" }}>{FREQ.map(f => <Chip key={f} on={freq === f} onClick={() => setFreq(f)} small>{f}</Chip>)}</div>}
                </Toggle>
                <span style={{ height: 1, background: LINE, margin: "0 16px" }} />
                <Toggle icon="ph-paper-plane-tilt" t={`Send new matches to ${first}`} s={`From you, with your branding, ${freq === "Instant" ? "as they come in" : freq === "Weekly" ? "once a week" : "once a day"}`} on={share} set={setShare} />
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {[areaName, ...(crit.length ? crit : ["Any price", "Any size"])].map(c => <span key={c} style={{ height: 26, padding: "0 10px", borderRadius: 9999, background: SOFT, font: "400 12px/26px var(--font-sans)", color: INK }}>{c}</span>)}
              </div>
            </>
          )}
        </div>
        {/* Footer */}
        <div style={{ flex: "none", display: "flex", alignItems: "center", gap: 10, padding: "14px 24px 20px" }}>
          {step > 0 && <button onClick={() => setStep(step - 1)} className="fb-grey" style={btn(false)}>Back</button>}
          <span style={{ flex: 1 }} />
          {step === 2 && <button onClick={() => setStep(3)} className="sv-ghost" style={{ ...btn(false), background: "none" }}>Skip</button>}
          <button onClick={next} disabled={!ok} className="fb-dark" style={{ ...btn(true), opacity: ok ? 1 : 0.35, cursor: ok ? "pointer" : "default" }}>
            {step === 3 ? "Save & see matches" : step === 0 && adding ? (contactOnly ? "Add buyer" : "Add buyer & continue") : "Continue"}
          </button>
        </div>
      </div>
      <style>{`@keyframes bwIn{from{opacity:0;transform:translateX(14px)}to{opacity:1;transform:none}}`}</style>
    </div>
  );
}

const row = (on: boolean): React.CSSProperties => ({ display: "flex", alignItems: "center", gap: 12, width: "100%", minHeight: 52, padding: "8px", border: "none", borderRadius: 12, background: on ? SOFT : "none", cursor: "pointer", textAlign: "left" });
const btn = (dark: boolean): React.CSSProperties => ({ height: 44, padding: "0 20px", border: "none", borderRadius: 9999, background: dark ? INK : "rgba(13,12,12,.06)", color: dark ? "rgb(253,252,252)" : INK, font: "700 15px/20px var(--font-sans)", cursor: "pointer", whiteSpace: "nowrap" });

function Avatar({ name, size }: { name: string; size: number }) {
  const ph = CLIENT_PHOTOS[name];
  return <span style={{ flex: "none", width: size, height: size, borderRadius: 9999, background: ph ? `url(${ph}) center/cover` : "rgb(228,214,208)", display: "flex", alignItems: "center", justifyContent: "center", font: `700 ${Math.round(size * 0.36)}px/1 var(--font-sans)`, color: INK }}>{!ph && initials(name || "?")}</span>;
}
function Field({ value, onChange, placeholder, icon, autoFocus, onEnter }: { value: string; onChange: (v: string) => void; placeholder: string; icon?: string; autoFocus?: boolean; onEnter?: () => void }) {
  const r = useRef<HTMLInputElement>(null);
  useEffect(() => { if (autoFocus) setTimeout(() => r.current?.focus({ preventScroll: true }), 60); }, [autoFocus]);
  return (
    <span style={{ display: "flex", alignItems: "center", gap: 10, height: 46, padding: "0 14px", borderRadius: 14, background: "rgb(255,255,255)", boxShadow: `inset 0 0 0 1px ${LINE}`, flex: "none", width: "100%", boxSizing: "border-box", minWidth: 0 }}>
      {icon && <i className={`ph ${icon}`} style={{ fontSize: 17, color: MUTED }} />}
      <input ref={r} value={value} onChange={e => onChange(e.target.value)} onKeyDown={e => { if (e.key === "Enter") onEnter?.(); }} placeholder={placeholder} style={{ flex: 1, minWidth: 0, border: "none", outline: "none", background: "none", font: "400 15px/20px var(--font-sans)", color: INK }} />
    </span>
  );
}
function Label({ t, opt, children }: { t: string; opt?: boolean; children: React.ReactNode }) {
  return <label style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 6 }}><span style={{ font: "700 13px/18px var(--font-sans)", color: INK }}>{t}{opt && <span style={{ fontWeight: 400, color: MUTED }}> · optional</span>}</span>{children}</label>;
}
function Group({ t, children }: { t: string; children: React.ReactNode }) {
  return <div style={{ display: "flex", flexDirection: "column", gap: 8 }}><span style={{ font: "700 13px/18px var(--font-sans)", color: INK }}>{t}</span>{children}</div>;
}
function Chip({ on, onClick, children, icon, small }: { on: boolean; onClick: () => void; children: React.ReactNode; icon?: string; small?: boolean }) {
  return (
    <button onClick={onClick} style={{ display: "flex", alignItems: "center", gap: 6, height: small ? 30 : 36, padding: small ? "0 12px" : "0 14px", border: "none", borderRadius: 9999, background: on ? INK : "rgb(255,255,255)", boxShadow: on ? "none" : `inset 0 0 0 1px ${LINE}`, color: on ? "rgb(253,252,252)" : INK, font: `400 ${small ? 13 : 14}px/18px var(--font-sans)`, cursor: "pointer", whiteSpace: "nowrap", transition: "background .15s" }}>
      {icon && <i className={`ph ${icon}`} style={{ fontSize: 13 }} />}{children}
    </button>
  );
}
function Seg({ value, onChange, n }: { value: number; onChange: (v: number) => void; n: number }) {
  return (
    <div style={{ display: "flex", padding: 3, borderRadius: 9999, background: SOFT }}>
      {Array.from({ length: n + 1 }, (_, i) => (
        <button key={i} onClick={() => onChange(i)} style={{ minWidth: 46, height: 32, padding: "0 10px", border: "none", borderRadius: 9999, background: value === i ? "rgb(255,255,255)" : "none", boxShadow: value === i ? "0 1px 3px rgba(30,18,12,.14)" : "none", font: `${value === i ? 700 : 400} 13px/18px var(--font-sans)`, color: INK, cursor: "pointer" }}>{i ? `${i}+` : "Any"}</button>
      ))}
    </div>
  );
}
function Select({ value, onChange, opts }: { value: number; onChange: (v: number) => void; opts: [number, string][] }) {
  return (
    <span style={{ position: "relative", flex: 1, display: "flex" }}>
      <select value={value} onChange={e => onChange(+e.target.value)} style={{ flex: 1, appearance: "none", height: 44, padding: "0 36px 0 14px", border: "none", borderRadius: 12, background: "rgb(255,255,255)", boxShadow: `inset 0 0 0 1px ${LINE}`, font: "400 15px/20px var(--font-sans)", color: INK, cursor: "pointer" }}>
        {opts.map(([v, t]) => <option key={v} value={v}>{t}</option>)}
      </select>
      <i className="ph ph-caret-down" style={{ position: "absolute", right: 14, top: 14, fontSize: 14, color: MUTED, pointerEvents: "none" }} />
    </span>
  );
}
function Toggle({ icon, t, s, on, set, children }: { icon: string; t: string; s: string; on: boolean; set: (v: boolean) => void; children?: React.ReactNode }) {
  return (
    <div style={{ display: "flex", flexDirection: "column" }}>
      <button onClick={() => set(!on)} style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 16px", border: "none", background: "none", cursor: "pointer", textAlign: "left" }}>
        <span style={{ width: 28, height: 28, borderRadius: 8, background: SOFT, display: "flex", alignItems: "center", justifyContent: "center" }}><i className={`ph ${icon}`} style={{ fontSize: 16, color: INK }} /></span>
        <span style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
          <span style={{ font: "700 14px/18px var(--font-sans)", color: INK }}>{t}</span>
          <span style={{ font: "400 12px/16px var(--font-sans)", color: MUTED }}>{s}</span>
        </span>
        <span style={{ flex: "none", width: 40, height: 24, borderRadius: 9999, background: on ? INK : "rgba(13,12,12,.16)", position: "relative", transition: "background .2s" }}>
          <span style={{ position: "absolute", top: 3, left: on ? 19 : 3, width: 18, height: 18, borderRadius: 9999, background: "rgb(255,255,255)", boxShadow: "0 1px 2px rgba(0,0,0,.2)", transition: "left .2s" }} />
        </span>
      </button>
      {children}
    </div>
  );
}
