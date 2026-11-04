"use client";
// Saved searches, saved properties and alerts, ported from the canvas
// `Home Web.dc.html`. Handlers ported:
//   save search sheet   onSaveSearch, onFooterSearch, onSsName, onSsSave, onSsClose, onSsNotify,
//                       onSsRemove, onSsSearchContact, onSsNewContact, c.remove (`_ssCommit`)
//   contact picker      onContactAdd, onContactCreate, onContactCancel, onCq, r.toggle
//   confirms            onRemoveConfirm/Cancel, onUnsavedSave/Discard/Cancel
//   alerts              onBell, onAlertSave, onAlertClose, onAlertReset, alAny.toggle, ar.toggle, op.pick
//   active search       onManageSearch, onClearActive (search field header + results pencil)
//   saved properties    r.save (savedP / pickOrder), onOpenSaved, onCloseSaved, sv.open, sv.remove, onPickedClear
// Styles are the canvas inline styles, copied verbatim through `css()`.
import { useEffect, useRef, useState } from "react";
import { css } from "@/lib/css";
import { Listing, fullPrice } from "@/lib/fake";
import { F_TYPES, Filters, fDef, fDims } from "@/lib/filters";
import { Place } from "@/lib/places";
import {
  ALERT_DEFS, ALERT_OPTS, AlertSet, CLIENT_PHOTOS, CONTACTS, SavedProp, SavedSearch, alertCount, forTxt, initials, useSaved,
} from "@/components/SavedState";

const mask = (u: string, size: number, color: string) => css(`flex:none;width:${size}px;height:${size}px;background:${color};-webkit-mask:url('${u}') center/contain no-repeat;mask:url('${u}') center/contain no-repeat`);
const X12 = <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg>;
const TRASH = <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M4 6h16M9 6V4h6v2M6 6l1 14h10l1-14M10 10v6M14 10v6" /></svg>;
const CHECK = (sz: number, sw: number, c = "rgb(255,255,255)") => <svg width={sz} height={sz} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>;

// `_tg(on)`: the switch track + knob.
const tg = (on: boolean) => ({
  track: css("flex:none;position:relative;width:40px;height:24px;border-radius:9999px;transition:background .2s;background:" + (on ? "rgb(18,18,18)" : "rgba(13,12,12,.2)")),
  knob: css("position:absolute;top:3px;left:" + (on ? 19 : 3) + "px;width:18px;height:18px;border-radius:9999px;background:rgb(253,252,252);transition:left .2s cubic-bezier(.2,.8,.2,1);box-shadow:0 1px 3px rgba(0,0,0,.18)"),
});
const tagSty = (t: string) => css("flex:none;display:flex;align-items:center;height:18px;padding:0 6px;border-radius:9999px;font:400 10px/18px var(--font-sans);"
  + (t === "Buyer" ? "background:rgba(105,75,119,.1);color:rgb(105,75,119)" : "background:rgba(214,53,41,.08);color:rgb(166,46,36)"));
const tagOf = (n: string) => (CONTACTS.find(c => c[0] === n) || [n, ""])[1];
// `anim(k)`: sheet in, or the 190 ms sheet-out of `_closeLayer`.
export const sheetAnim = (out: boolean) => out ? "bzSheetOut .2s cubic-bezier(.4,0,1,1) both" : "bzSheetIn .38s cubic-bezier(.2,.8,.2,1) backwards";

// ---------- search criteria from the current filters (`params` in the canvas) ----------

export function searchCriteria(F: Filters, area: string) {
  const on = (m: Record<string, boolean | undefined>) => Object.keys(m).filter(k => m[k]);
  const stOn = on(F.st as Record<string, boolean>), tOn = on(F.types);
  const price = F.pHi < 100 ? "Up to $" + (F.pHi * 50000 / 1e6).toFixed(1).replace(/\.0$/, "") + "m" : "Any price";
  const d = fDims(F);
  const extra = (["roi", "ub", "drops", "beds", "baths", "size", "lot", "styles", "feats"] as const).filter(k => d[k].on).map(k => k === "drops" ? "Price drops" : d[k].label);
  // Canvas: statuses, types (or "Single family"), price, area. Defaults here are "any", so say so.
  const chips = [...(stOn.length ? stOn : ["Any status"]), ...(tOn.length ? tOn : ["Any type"]), price, area, ...extra];
  const multi = (a: string[], none: string) => a.length ? a[0] + (a.length > 1 ? " +" + (a.length - 1) : "") : none;
  return { chips, params: [multi(stOn, "Any status"), multi(tOn, "Any type"), price, area] };
}

// Seeded searches only carry their chip labels; turn them back into filters
// ("Active", "Condo", "Up to $3m") so opening one filters like it says.
export function seedFilters(p: string[]): Filters {
  const F = fDef();
  if (p[0] && p[0] !== "Any status") F.st = { [p[0] === "Sold" ? "Recently sold" : p[0]]: true };
  const ty = ({ Multifamily: "Multi family", Lots: "Lot" } as Record<string, string>)[p[1]] || p[1];
  if (ty && F_TYPES.some(t => t[0] === ty)) F.types = { [ty]: true };
  const m = /\$([\d.]+)m/.exec(p[2] || "");
  if (m) F.pHi = Math.min(100, Math.round(Number(m[1]) * 1e6 / 50000));
  return F;
}

// ---------- save search sheet + contact picker + confirms ----------

type SheetState = { edit: string | null; name: string; clients: string[]; notify: boolean; snap: string };

// Owns the sheet (`ssOpen`, `ssEdit`, `ssName`, `ssClients`, `ssNotify`, `ssSnap`), the
// contact picker, and the remove / unsaved-changes confirms.
export function useSearchSheet({ F, place, results, toast }: { F: Filters; place: Place; results: Listing[]; toast: (t: string) => void }) {
  const sv = useSaved();
  const [st, setSt] = useState<SheetState | null>(null);
  const [out, setOut] = useState(false);
  const [contactOpen, setContactOpen] = useState(false);
  const [removeOpen, setRemoveOpen] = useState(false);
  const [unsavedOpen, setUnsavedOpen] = useState(false);
  const outT = useRef<any>(null);
  const area = place.label.split(",")[0];
  const crit = searchCriteria(F, area);

  const close = () => {
    if (out) return;
    setOut(true); setContactOpen(false);
    clearTimeout(outT.current);
    outT.current = setTimeout(() => { setOut(false); setSt(null); }, 190);
  };
  const openNew = () => { clearTimeout(outT.current); setOut(false); setSt({ edit: null, name: "", clients: [], notify: true, snap: "" }); };
  // `onManageSearch` / `onFooterSearch` with an active search.
  const openManage = (s: SavedSearch) => {
    clearTimeout(outT.current); setOut(false);
    setSt({ edit: s.id, name: s.name, clients: s.clients.slice(), notify: s.notify !== false, snap: JSON.stringify([s.name, s.clients, s.notify !== false]) });
  };
  const dirty = !!st && !!st.edit && JSON.stringify([st.name, st.clients, st.notify]) !== st.snap;
  // `onSsClose`: editing with unsaved changes asks first.
  const onClose = () => { if (dirty) { setUnsavedOpen(true); setContactOpen(false); return; } close(); };
  // `_ssCommit`
  const commit = () => {
    if (!st) return;
    const nm = st.name.trim();
    if (!nm) return;
    if (st.edit) {
      sv.updateSearch(st.edit, { name: nm, clients: st.clients, notify: st.notify });
      close(); toast("Changes saved");
    } else {
      sv.addSearch({
        id: "s" + Date.now(), name: nm, clients: st.clients, newN: 0, th: [0, 1, 2], photos: results.slice(0, 3).map(l => l.photos[0]),
        params: crit.params, chips: crit.chips, f: F, place: { ...place, rings: undefined }, sq: place.label, when: "Today", notify: st.notify,
      });
      close(); toast("Search saved");
    }
  };
  const onRemoveConfirm = () => {
    if (!st?.edit) return;
    sv.removeSearch(st.edit); setRemoveOpen(false); close(); toast("Search removed");
  };

  const editing = st?.edit ? sv.searches.find(x => x.id === st.edit) : null;
  const layers = (
    <>
      {st && (
        <SaveSearchSheet st={st} set={p => setSt(s => s && { ...s, ...p })} out={out} chips={editing ? (editing.chips || editing.params) : crit.chips}
          onClose={onClose} onSave={commit} onRemove={() => { setRemoveOpen(true); setContactOpen(false); }} onContacts={() => setContactOpen(true)} />
      )}
    </>
  );
  const modals = (
    <>
      {contactOpen && st && (
        <ContactPicker chosen={st.clients} extra={sv.newContacts} onCancel={() => setContactOpen(false)}
          onCreate={n => sv.addContact(n)} onAdd={names => { setSt(s => s && { ...s, clients: names }); setContactOpen(false); }} />
      )}
      {removeOpen && (
        <ConfirmModal title="Remove search" body="This will permanently remove the search and its alerts." onCancel={() => setRemoveOpen(false)}
          actions={<button onClick={onRemoveConfirm} className="sv-press" style={css("height:43px;padding:0 20px;border:none;border-radius:9999px;background:rgb(195,65,55);font:700 15px/20px var(--font-sans);color:rgb(249,249,249);cursor:pointer;white-space:nowrap")}>Confirm</button>} />
      )}
      {unsavedOpen && (
        <ConfirmModal title="You have unsaved changes" body="Save or discard the changes you made for this search." onCancel={() => setUnsavedOpen(false)}
          actions={<>
            <button onClick={() => { setUnsavedOpen(false); close(); }} className="sv-press" style={css("height:43px;padding:0 20px;border:none;border-radius:9999px;background:rgba(13,12,12,.08);font:700 15px/20px var(--font-sans);color:rgb(17,16,16);cursor:pointer;white-space:nowrap")}>Discard</button>
            <button onClick={() => { setUnsavedOpen(false); commit(); }} className="sv-press" style={css("height:43px;padding:0 20px;border:none;border-radius:9999px;background:rgb(17,16,16);font:700 15px/20px var(--font-sans);color:rgb(249,249,249);cursor:pointer;white-space:nowrap")}>Save changes</button>
          </>} />
      )}
    </>
  );
  return { open: !!st, on: !!st && !out, openNew, openManage, close, requestClose: onClose, layers, modals };
}

function SaveSearchSheet({ st, set, out, chips, onClose, onSave, onRemove, onContacts }: {
  st: SheetState; set: (p: Partial<SheetState>) => void; out: boolean; chips: string[];
  onClose: () => void; onSave: () => void; onRemove: () => void; onContacts: () => void;
}) {
  const named = !!st.name.trim(), has = st.clients.length > 0;
  const nameRef = useRef<HTMLInputElement>(null);
  useEffect(() => { const t = setTimeout(() => { try { nameRef.current?.focus({ preventScroll: true }); } catch {} }, 80); return () => clearTimeout(t); }, []);
  const box = "flex:none;display:flex;flex-direction:column;gap:12px;padding:16px;border-radius:20px;background:rgb(253,252,252);box-shadow:inset 0 0 0 .5px rgba(18,18,18,.16)";
  return (
    <div style={css("position:absolute;left:0;right:0;top:76px;bottom:0;z-index:4;display:flex;flex-direction:column;border-radius:24px;background:rgb(255,255,255);box-shadow:inset 0 0 0 1px rgba(13,12,12,.1);overflow:hidden;pointer-events:auto;animation:" + sheetAnim(out))}>
      <div style={css("flex:none;display:flex;align-items:center;justify-content:space-between;gap:12px;padding:16px 16px 8px 20px")}>
        <span style={css("font:700 15px/20px var(--font-sans);color:rgb(18,18,18)")}>{st.edit ? "Manage search" : "Save search"}</span>
        <button onClick={onClose} title="Close" className="sv-grey" style={css("flex:none;width:32px;height:32px;border:none;border-radius:9999px;background:rgba(13,12,12,.05);color:rgb(17,16,16);cursor:pointer;display:flex;align-items:center;justify-content:center")}>{X12}</button>
      </div>
      <div className="no-scrollbar" style={css("flex:1;min-height:0;overflow-y:auto;display:flex;flex-direction:column;gap:8px;padding:8px 16px 16px")}>
        <div style={css("flex:none;display:flex;align-items:center;justify-content:center;height:150px")}>
          <input ref={nameRef} value={st.name} onChange={e => set({ name: e.target.value })} onKeyDown={e => { if (e.key === "Enter" && named) onSave(); }} placeholder="Your search name"
            style={css("width:100%;border:none;outline:none;background:none;padding:0;text-align:center;font:300 26px/1.26 var(--font-sans);letter-spacing:-.5px;color:rgb(18,18,18);caret-color:rgb(175,127,113)")} />
        </div>
        <div style={css(box)}>
          <span style={css("font:700 14px/1.26 var(--font-sans);color:rgb(18,18,18)")}>Search parameters</span>
          <div style={css("display:flex;flex-wrap:wrap;gap:4px")}>
            {chips.map(l => <span key={l} style={css("display:flex;align-items:center;height:24px;padding:0 10px;border-radius:9999px;box-shadow:inset 0 0 0 .5px rgba(18,18,18,.4);font:400 12px/16px var(--font-sans);color:rgb(18,18,18);white-space:nowrap")}>{l}</span>)}
          </div>
        </div>
        <div style={css(box)}>
          <div style={css("display:flex;align-items:center;justify-content:space-between;gap:12px;min-height:32px")}>
            <span style={css("font:700 14px/1.26 var(--font-sans);color:rgb(18,18,18)")}>Clients</span>
            {has && <button onClick={onContacts} className="sv-add" style={css("flex:none;height:32px;padding:0 14px;border:none;border-radius:9999px;background:rgba(13,12,12,.07);font:700 13px/18px var(--font-sans);color:rgb(18,18,18);cursor:pointer;animation:fadeIn .2s ease backwards")}>Add</button>}
          </div>
          {has ? (
            <div style={css("display:flex;flex-direction:column;gap:4px")}>
              {st.clients.map(n => {
                const t = tagOf(n);
                return (
                  <div key={n} style={css("display:flex;align-items:center;gap:12px;height:48px;animation:fadeIn .2s ease backwards")}>
                    <span style={css("flex:none;width:40px;height:40px;border-radius:9999px;background:rgb(238,206,186);display:flex;align-items:center;justify-content:center;font:400 14px/18px var(--font-sans);color:rgb(18,18,18)")}>{initials(n)}</span>
                    <span style={css("flex:1;min-width:0;font:400 14px/1.26 var(--font-sans);color:rgb(18,18,18);white-space:nowrap;overflow:hidden;text-overflow:ellipsis")}>{n}</span>
                    {t && <span style={tagSty(t)}>{t}</span>}
                    <button onClick={() => set({ clients: st.clients.filter(x => x !== n) })} title="Remove" className="sv-ghost" style={css("flex:none;width:32px;height:32px;border:none;border-radius:9999px;background:none;color:rgb(18,18,18);cursor:pointer;display:flex;align-items:center;justify-content:center")}>{TRASH}</button>
                  </div>
                );
              })}
            </div>
          ) : (
            <div style={css("display:flex;justify-content:center;gap:40px;padding:8px 0 4px")}>
              <button onClick={onContacts} style={css("display:flex;flex-direction:column;align-items:center;gap:8px;padding:0;border:none;background:none;cursor:pointer")}>
                <span style={css("width:40px;height:40px;border-radius:9999px;background:rgba(18,18,18,.06);display:flex;align-items:center;justify-content:center")}><span style={mask("/ui/search.svg", 16, "rgb(77,71,69)")} /></span>
                <span style={css("font:400 12px/16px var(--font-sans);color:rgb(18,18,18)")}>Search</span>
              </button>
              <button onClick={onContacts} style={css("display:flex;flex-direction:column;align-items:center;gap:8px;padding:0;border:none;background:none;cursor:pointer")}>
                <span style={css("width:40px;height:40px;border-radius:9999px;background:rgba(18,18,18,.06);display:flex;align-items:center;justify-content:center")}>
                  <svg width="17" height="17" viewBox="0 0 256 256" fill="none" stroke="rgb(77,71,69)" strokeWidth="16" strokeLinecap="round" strokeLinejoin="round"><circle cx="108" cy="100" r="60" /><path d="M24 200c20.6-30.6 49.5-48 84-48s63.4 17.4 84 48M200 64v48M176 88h48" /></svg>
                </span>
                <span style={css("font:400 12px/16px var(--font-sans);color:rgb(18,18,18)")}>New</span>
              </button>
            </div>
          )}
        </div>
        <div style={css("flex:none;display:flex;align-items:center;gap:12px;padding:16px;border-radius:20px;background:rgb(253,252,252);box-shadow:inset 0 0 0 .5px rgba(18,18,18,.16)")}>
          <span style={css("flex:1;min-width:0;display:flex;flex-direction:column;gap:4px")}>
            <span style={css("font:400 14px/1.26 var(--font-sans);color:rgb(18,18,18)")}>New matches</span>
            <span style={css("font:400 12px/1.26 var(--font-sans);letter-spacing:.25px;color:rgb(73,67,65)")}>App push, email if not installed</span>
          </span>
          <button onClick={() => set({ notify: !st.notify })} title="New matches" style={css("flex:none;position:relative;width:40px;height:24px;padding:0;border:none;border-radius:9999px;cursor:pointer;transition:background .2s;background:" + (st.notify ? "rgb(18,18,18)" : "rgba(13,12,12,.2)"))}>
            <span style={css("position:absolute;top:3px;left:" + (st.notify ? 19 : 3) + "px;width:18px;height:18px;border-radius:9999px;background:rgb(253,252,252);transition:left .2s cubic-bezier(.2,.8,.2,1)")} />
          </button>
        </div>
        <span style={css("flex:none;padding:4px 4px 0;font:400 12px/16px var(--font-sans);color:rgb(73,67,65)")}>*You can change this at any time.</span>
      </div>
      <div style={css("flex:none;display:flex;align-items:center;gap:12px;padding:16px;background:rgb(255,255,255)")}>
        {st.edit && <button onClick={onRemove} className="sv-remove" style={css("flex:none;height:48px;padding:0 12px;margin-left:-4px;border:none;border-radius:9999px;background:none;font:700 15px/20px var(--font-sans);color:rgb(195,65,55);cursor:pointer;white-space:nowrap")}>Remove search</button>}
        <button onClick={() => { if (named) onSave(); }} className="fb-dark" style={css("width:100%;height:48px;border:none;border-radius:9999px;font:700 15px/20px var(--font-sans);color:rgb(249,249,249);transition:opacity .16s;background:rgb(17,16,16);cursor:" + (named ? "pointer;opacity:1" : "default;opacity:.32;pointer-events:none"))}>{st.edit ? "Save changes" : "Save search"}</button>
      </div>
    </div>
  );
}

// Contact picker (`contactOpen`): search, multi-select, create, add. Exported so
// the Share flow can reuse it for `shClients`.
export function ContactPicker({ chosen, extra, onCancel, onCreate, onAdd }: {
  chosen: string[]; extra: string[]; onCancel: () => void; onCreate: (n: string) => void; onAdd: (names: string[]) => void;
}) {
  const [cq, setCq] = useState("");
  const [sel, setSel] = useState<Record<string, boolean>>(() => Object.fromEntries(chosen.map(n => [n, true])));
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => { const t = setTimeout(() => { try { ref.current?.focus({ preventScroll: true }); } catch {} }, 80); return () => clearTimeout(t); }, []);
  const C: [string, string][] = CONTACTS.concat(extra.filter(n => !CONTACTS.some(c => c[0] === n)).map(n => [n, ""] as [string, string]));
  const q = cq.trim().toLowerCase();
  const rows = C.filter(([n]) => !q || n.toLowerCase().includes(q));
  const nSel = Object.keys(sel).filter(x => sel[x]).length;
  const create = () => { const n = cq.trim(); if (!n) return; onCreate(n); setSel(s => ({ ...s, [n]: true })); setCq(""); };
  return (
    <>
      <div onClick={onCancel} style={css("position:fixed;inset:0;z-index:210;background:rgba(18,18,18,.32);animation:fadeIn .2s ease both;pointer-events:auto")} />
      <div style={css("position:fixed;left:50%;top:50%;transform:translate(-50%,-50%);z-index:211;width:452px;max-width:calc(100vw - 24px);max-height:calc(100vh - 160px);box-sizing:border-box;display:flex;flex-direction:column;border-radius:24px;background:rgb(255,255,255);box-shadow:inset 0 0 0 1px rgba(13,12,12,.08),0 24px 60px rgba(30,18,12,.22);overflow:hidden;animation:bzModalIn .26s cubic-bezier(.2,.8,.2,1) both;pointer-events:auto")}>
        <div style={css("flex:none;display:flex;align-items:center;gap:12px;padding:16px 20px;box-shadow:inset 0 -1px 0 rgba(13,12,12,.08)")}>
          <span style={mask("/ui/search.svg", 16, "rgb(98,90,89)")} />
          <input ref={ref} value={cq} onChange={e => setCq(e.target.value)} onKeyDown={e => { if (e.key === "Enter" && rows.length === 0) create(); }} placeholder="Search Contact" style={css("flex:1;min-width:0;border:none;outline:none;background:none;padding:0;font:400 14px/20px var(--font-sans);color:rgb(18,18,18)")} />
          <button onClick={onCancel} style={css("flex:none;height:32px;padding:0 4px;border:none;background:none;font:700 14px/18px var(--font-sans);color:rgb(18,18,18);cursor:pointer")}>Cancel</button>
        </div>
        <div className="no-scrollbar" style={css("flex:1;min-height:0;overflow-y:auto;padding:8px 12px")}>
          {rows.map(([n, t]) => {
            const on = !!sel[n];
            return (
              <button key={n} onClick={() => setSel(s => ({ ...s, [n]: !on }))} className="sv-row" style={css("width:100%;display:flex;align-items:center;gap:8px;height:56px;padding:0 8px;border:none;border-radius:12px;background:none;cursor:pointer;text-align:left")}>
                <span style={css("flex:none;font:400 14px/1.26 var(--font-sans);color:rgb(18,18,18)")}>{n}</span>
                {t && <>
                  <span style={css("flex:none;width:6px;height:6px;margin-left:8px;border-radius:9999px;background:rgb(214,53,41)")} />
                  <span style={tagSty(t)}>{t}</span>
                </>}
                <span style={css("flex:1")} />
                <span style={css("flex:none;width:18px;height:18px;border-radius:9999px;display:flex;align-items:center;justify-content:center;transition:background .16s;" + (on ? "background:rgb(18,18,18)" : "box-shadow:inset 0 0 0 1.3px rgb(18,18,18)"))}>
                  {on && CHECK(10, 3.4)}
                </span>
              </button>
            );
          })}
          {rows.length === 0 && <span style={css("display:block;padding:24px 8px;font:400 14px/20px var(--font-sans);color:rgb(98,90,89);text-align:center")}>No contacts match. Create one below.</span>}
        </div>
        <div style={css("flex:none;display:flex;align-items:center;justify-content:space-between;gap:16px;padding:16px 20px;box-shadow:inset 0 1px 0 rgba(13,12,12,.08)")}>
          <button onClick={create} className="fb-ghost" style={css("flex:none;height:40px;padding:0 12px;margin-left:-12px;border:none;border-radius:9999px;background:none;font:700 14px/18px var(--font-sans);color:rgb(18,18,18);cursor:pointer")}>Create contact</button>
          <button onClick={() => onAdd(C.map(c => c[0]).filter(n => sel[n]))} className="fb-dark" style={css("flex:none;height:40px;padding:0 16px;border:none;border-radius:9999px;background:rgb(18,18,18);font:700 14px/18px var(--font-sans);color:rgb(249,249,249);cursor:pointer")}>{nSel > 1 ? "Add clients (" + nSel + ")" : "Add client"}</button>
        </div>
      </div>
    </>
  );
}

// `removeOpen` / `unsavedOpen` confirm dialog.
function ConfirmModal({ title, body, onCancel, actions }: { title: string; body: string; onCancel: () => void; actions: React.ReactNode }) {
  return (
    <div onClick={onCancel} style={css("position:fixed;inset:0;z-index:212;background:rgba(18,18,18,.32);display:flex;align-items:center;justify-content:center;animation:fadeIn .2s ease both;pointer-events:auto")}>
      <div onClick={e => e.stopPropagation()} style={css("width:508px;max-width:calc(100vw - 32px);display:flex;flex-direction:column;align-items:center;border-radius:44px;overflow:hidden;background:rgb(240,235,235);backdrop-filter:blur(40px);box-shadow:0 24px 60px rgba(30,18,12,.22);animation:riseIn .26s cubic-bezier(.2,.8,.2,1) both")}>
        <div style={css("align-self:stretch;height:72px;box-sizing:border-box;display:flex;align-items:center;justify-content:flex-end;padding:0 20px")}>
          <button onClick={onCancel} title="Close" className="sv-grey" style={css("width:40px;height:40px;border:none;border-radius:9999px;background:rgba(13,12,12,.06);color:rgb(17,16,16);cursor:pointer;display:flex;align-items:center;justify-content:center")}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
          </button>
        </div>
        <div style={css("align-self:stretch;display:flex;flex-direction:column;align-items:center;gap:20px;padding:20px 24px 60px")}>
          <div style={css("display:flex;flex-direction:column;align-items:center;gap:8px;text-align:center")}>
            <span style={css("font:700 18px/24px var(--font-sans);color:rgb(17,16,16)")}>{title}</span>
            <span style={css("font:400 14px/20px var(--font-sans);color:rgb(73,67,65);max-width:354px;text-wrap:pretty")}>{body}</span>
          </div>
          <div style={css("display:flex;gap:20px")}>{actions}</div>
        </div>
      </div>
    </div>
  );
}

// ---------- active saved search (search field header + results pencil) ----------

export function ActiveSearchHeader({ s, onManage, onClear }: { s: SavedSearch; onManage: () => void; onClear: () => void }) {
  const cp = s.clients[0] ? CLIENT_PHOTOS[s.clients[0]] : null;
  return (
    <>
      <div onClick={onManage} title="Manage search" style={css("flex:1;min-width:0;display:flex;align-items:center;gap:8px;margin-left:-6px;cursor:pointer;animation:fadeIn .2s ease both")}>
        <span style={css("flex:none;width:36px;height:36px;border-radius:9999px;display:flex;align-items:center;justify-content:center;box-shadow:inset 0 0 0 .5px rgba(18,18,18,.06);font:400 13px/16px var(--font-sans);color:rgb(18,18,18);"
          + (cp ? "background:url('" + cp + "') center/cover no-repeat" : "background:rgb(238,206,186)"))}>{cp || !s.clients[0] ? "" : initials(s.clients[0])}</span>
        <span style={css("flex:1;min-width:0;display:flex;flex-direction:column")}>
          <span style={css("font:400 15px/20px var(--font-sans);color:rgb(17,16,16);white-space:nowrap;overflow:hidden;text-overflow:ellipsis")}>{s.name}</span>
          <span style={css("font:400 12px/16px var(--font-sans);color:rgb(73,67,65);letter-spacing:.25px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis")}>{forTxt(s.clients)}</span>
        </span>
      </div>
      <span style={css("flex:none;width:1px;height:22px;background:rgb(228,228,231)")} />
      <button onClick={e => { e.stopPropagation(); onClear(); }} title="Clear search" className="fb-ghost" style={css("flex:none;width:32px;height:32px;margin-right:-6px;border:none;border-radius:9999px;background:none;cursor:pointer;display:flex;align-items:center;justify-content:center")}>
        <span style={mask("/ui/x.svg", 14, "rgb(17,16,16)")} />
      </button>
    </>
  );
}

export function ManageSearchButton({ onClick }: { onClick: () => void }) {
  return (
    <button onClick={onClick} title="Manage search" className="sv-grey" style={css("flex:none;width:32px;height:32px;margin-left:auto;margin-right:-4px;border:none;border-radius:9999px;background:rgba(13,12,12,.05);color:rgb(17,16,16);cursor:pointer;display:flex;align-items:center;justify-content:center")}>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M4 20h4L19 9l-4-4L4 16z" /><path d="M13.5 6.5l4 4" /></svg>
    </button>
  );
}

// ---------- results card save toggle + picked footer + saved properties sheet ----------

// `r.saveStyle` / `r.save`: "+" when not saved, green check when saved.
export function SaveToggle({ saved, onToggle }: { saved: boolean; onToggle: () => void }) {
  return (
    <button onClick={e => { e.stopPropagation(); onToggle(); }} title={saved ? "Saved" : "Save"} style={css("position:absolute;right:12px;top:12px;width:32px;height:32px;border:none;border-radius:9999px;cursor:pointer;display:flex;align-items:center;justify-content:center;backdrop-filter:blur(12px);transition:background .16s;"
      + (saved ? "background:rgb(13,87,57);color:rgb(237,252,243)" : "background:rgb(253,252,252);color:rgb(17,16,16)"))}>
      {saved
        ? <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
        : <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>}
    </button>
  );
}

const shareLabel = (n: number) => "Share " + n + (n === 1 ? " property" : " properties");

// `hasPicked` footer: stacked thumbs (+n) opening the saved sheet, and Share.
// `onSaveSearch` adds a round Save search (bell) button so saving homes doesn't hide
// saving the search (review feedback; the canvas swapped one footer for the other).
export function PickedFooter({ picked, onOpen, onShare, onSaveSearch, searchLabel = "Save search" }: { picked: SavedProp[]; onOpen: () => void; onShare?: () => void; onSaveSearch?: () => void; searchLabel?: string }) {
  const vis = picked.slice(0, 2);
  return (
    <div style={css("flex:none;height:81px;box-sizing:border-box;display:flex;align-items:center;justify-content:center;gap:16px;padding:12px 20px 20px;background:rgb(253,252,252);box-shadow:inset 0 1px 0 rgba(13,12,12,.16);animation:fadeIn .2s ease both")}>
      <div onClick={onOpen} title="View saved properties" style={css("flex:none;display:flex;align-items:center;gap:4px;height:48px;isolation:isolate;cursor:pointer")}>
        <div style={css("display:flex;align-items:center")}>
          {vis.map((p, n) => (
            <span key={p.key} style={css("flex:none;position:relative;border-radius:" + (n ? 7 : 8) + "px;box-shadow:inset 0 0 0 " + (n ? 2.188 : 2.5) + "px rgb(255,255,255);width:" + (n ? 38 : 48) + "px;height:" + (n ? 38 : 48) + "px;margin-left:" + (n ? -20 : 0) + "px;z-index:" + (3 - n) + ";"
              + "background:rgb(241,231,228) url('" + p.l.photos[0] + "') center/cover no-repeat;animation:fadeIn .2s ease backwards")} />
          ))}
        </div>
        {picked.length > 2 && <span style={css("min-width:19px;font:700 16px/1.26 var(--font-sans);letter-spacing:-.25px;color:rgb(18,18,18);text-align:center")}>+{picked.length - 2}</span>}
      </div>
      {onSaveSearch && (
        <button onClick={onSaveSearch} title={searchLabel} className="sv-grey" style={css("flex:none;width:43px;height:43px;border:none;border-radius:9999px;background:rgba(13,12,12,.06);color:rgb(17,16,16);cursor:pointer;display:flex;align-items:center;justify-content:center")}>
          <i className="ph-bold ph-bell" style={{ fontSize: 18 }} />
        </button>
      )}
      <button onClick={onShare} className="fb-dark" style={css("flex:1;min-width:0;height:43px;padding:0 12px;border:none;border-radius:9999px;background:rgb(18,18,18);font:700 15px/20px var(--font-sans);color:rgb(253,252,252);cursor:pointer;white-space:nowrap")}>{shareLabel(picked.length)}</button>
    </div>
  );
}

// `showSaved`: the saved properties sheet over the results column.
export function SavedSheet({ picked, out, onBack, onOpen, onRemove, onClear, onShare }: {
  picked: SavedProp[]; out: boolean; onBack: () => void; onOpen: (p: SavedProp) => void; onRemove: (p: SavedProp) => void; onClear: () => void; onShare?: () => void;
}) {
  return (
    <div style={css("position:absolute;left:0;right:0;top:76px;bottom:0;z-index:4;display:flex;flex-direction:column;border-radius:24px;background:rgb(255,255,255);box-shadow:inset 0 0 0 1px rgba(13,12,12,.1);overflow:hidden;pointer-events:auto;transform-origin:50% 0;animation:" + sheetAnim(out))}>
      <div style={css("flex:none;height:80px;box-sizing:border-box;display:flex;align-items:center;gap:12px;padding:16px;background:rgb(255,255,255)")}>
        <button onClick={onBack} title="Back" className="sv-grey" style={css("flex:none;width:32px;height:32px;border:none;border-radius:9999px;background:rgba(13,12,12,.05);color:rgb(17,16,16);cursor:pointer;display:flex;align-items:center;justify-content:center")}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 6l-6 6 6 6" /></svg>
        </button>
        <span style={css("flex:1;min-width:0;display:flex;flex-direction:column;gap:4px")}>
          <span style={css("font:700 18px/1.48 var(--font-sans);color:rgb(18,18,18)")}>Saved properties</span>
          <span style={css("font:400 14px/1.48 var(--font-sans);letter-spacing:.25px;color:rgb(73,67,65)")}>{picked.length + (picked.length === 1 ? " property" : " properties")}</span>
        </span>
      </div>
      <div className="no-scrollbar" style={css("flex:1;min-height:0;overflow-y:auto;display:flex;flex-direction:column;gap:32px;padding:16px")}>
        {picked.map(p => {
          const l = p.l;
          return (
            <div key={p.key} onClick={() => onOpen(p)} style={css("flex:none;display:flex;align-items:center;gap:12px;height:89px;cursor:pointer;animation:fadeIn .2s ease backwards")}>
              <span style={css("flex:none;width:89px;height:89px;border-radius:8px;background:rgb(241,231,228) url('" + l.photos[0] + "') center/cover no-repeat")} />
              <span style={css("flex:1;min-width:0;display:flex;flex-direction:column")}>
                <span style={css("font:700 14px/19px var(--font-sans);letter-spacing:.25px;color:rgb(18,18,18);white-space:nowrap;overflow:hidden;text-overflow:ellipsis")}>{l.addr}{l.city ? ", " + l.city : ""}</span>
                <span style={css("font:400 14px/21px var(--font-sans);letter-spacing:.25px;color:rgb(73,67,65);display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden")}>{l.beds} bed · {l.baths} bath · {l.sqft.toLocaleString()} ft² · {l.lotAc} ac lot</span>
                <span style={css("height:6px")} />
                <span style={css("display:flex;align-items:baseline;gap:4px;white-space:nowrap")}>
                  <span style={css("font:700 14px/21px var(--font-sans);letter-spacing:.25px;color:rgb(18,18,18)")}>{fullPrice(l.price)}</span>
                  <span style={css("font:400 12px/16px var(--font-sans);letter-spacing:.25px;color:rgb(98,90,89)")}>/ ${Math.round(l.price / l.sqft).toLocaleString()} per ft²</span>
                </span>
              </span>
              <button onClick={e => { e.stopPropagation(); onRemove(p); }} title="Remove" className="sv-ghost" style={css("flex:none;width:32px;height:32px;margin-right:-4px;border:none;border-radius:9999px;background:none;color:rgb(17,16,16);cursor:pointer;display:flex;align-items:center;justify-content:center")}>{TRASH}</button>
            </div>
          );
        })}
      </div>
      <div style={css("flex:none;height:84px;box-sizing:border-box;display:flex;align-items:center;justify-content:center;gap:16px;padding:20px;background:rgb(255,255,255);box-shadow:inset 0 1px 0 rgba(13,12,12,.16)")}>
        <button onClick={onClear} className="fb-ghost" style={css("flex:none;height:43px;padding:0 12px;border:none;border-radius:9999px;background:none;font:700 15px/20px var(--font-sans);color:rgb(18,18,18);cursor:pointer")}>Clear all</button>
        <button onClick={onShare} className="fb-dark" style={css("flex:1;min-width:0;height:43px;padding:0 16px;border:none;border-radius:9999px;background:rgb(18,18,18);font:700 15px/20px var(--font-sans);color:rgb(253,252,252);cursor:pointer;white-space:nowrap")}>{shareLabel(picked.length)}</button>
      </div>
    </div>
  );
}

// ---------- alerts ----------

// Detail footer bell (`bellOff` / `bellOn` with the count badge).
export function BellButton({ n, onClick }: { n: number; onClick: () => void }) {
  if (!n) return (
    <button onClick={onClick} title="Set alert" className="sv-bell" style={css("flex:none;width:48px;height:48px;border:none;border-radius:9999px;background:rgba(18,18,18,.06);cursor:pointer;display:flex;align-items:center;justify-content:center")}>
      <span style={mask("/ui/bell.svg", 18, "rgb(17,16,16)")} />
    </button>
  );
  return (
    <button onClick={onClick} title={n + (n === 1 ? " alert set · Edit" : " alerts set · Edit")} className="sv-bellon" style={css("position:relative;flex:none;width:48px;height:48px;border:none;border-radius:9999px;background:rgb(221,237,232);box-shadow:inset 0 0 0 1px rgba(49,104,89,.28);cursor:pointer;display:flex;align-items:center;justify-content:center;animation:fadeIn .2s ease backwards")}>
      <svg width="20" height="20" viewBox="0 0 24 24" style={css("display:block")}><path d="M12 3a6 6 0 0 0-6 6v3.6L4.4 15.4a.9.9 0 0 0 .8 1.4h13.6a.9.9 0 0 0 .8-1.4L18 12.6V9a6 6 0 0 0-6-6z" fill="rgb(49,104,89)" /><path d="M9.6 19a2.5 2.5 0 0 0 4.8 0z" fill="rgb(49,104,89)" /></svg>
      <span style={css("position:absolute;right:-2px;top:-2px;min-width:18px;height:18px;box-sizing:border-box;padding:0 5px;border-radius:9999px;background:rgb(49,104,89);box-shadow:0 0 0 2px rgb(253,252,252);font:700 11px/18px var(--font-sans);color:rgb(249,249,249);text-align:center")}>{n}</span>
    </button>
  );
}

// Alert panel state (`alertK`, `alertTmp`) + the panel itself. `left` is the detail column's x.
export function useAlerts({ toast }: { toast: (t: string) => void }) {
  const sv = useSaved();
  const [l, setL] = useState<Listing | null>(null);
  const [tmp, setTmp] = useState<AlertSet>({});
  const [out, setOut] = useState(false);
  const outT = useRef<any>(null);
  const key = l ? l.addr + "|" + l.id : "";
  const existing = l ? sv.alerts[key] : undefined;
  const close = () => {
    if (out || !l) return;
    setOut(true); clearTimeout(outT.current);
    outT.current = setTimeout(() => { setOut(false); setL(null); setTmp({}); }, 190);
  };
  const open = (x: Listing) => { clearTimeout(outT.current); setOut(false); setL(x); setTmp({ ...(sv.alerts[x.addr + "|" + x.id] || {}) }); };
  const save = () => {
    if (!l) return;
    const keep = alertCount(tmp) > 0;
    sv.setAlerts(l, keep ? tmp : null);
    close();
    toast(keep ? "Alert set · you’ll see it on Home" : "Alerts removed");
  };
  const count = (x: Listing | null) => x ? alertCount(sv.alerts[x.addr + "|" + x.id]) : 0;
  const panel = (left: number) => l && (
    <>
      {!out && <div onClick={close} title="Back to property" style={css("position:absolute;left:" + left + "px;top:12px;bottom:12px;z-index:6;width:420px;max-width:calc(100% - " + (left + 12) + "px);cursor:pointer;pointer-events:auto")} />}
      <AlertsPanel left={left} tmp={tmp} setTmp={setTmp} hadAlerts={!!existing} out={out} onClose={close} onSave={save} onReset={() => setTmp({})} />
    </>
  );
  return { open, close, on: !!l && !out, listing: l, panel, count };
}

function AlertsPanel({ left, tmp, setTmp, hadAlerts, out, onClose, onSave, onReset }: {
  left: number; tmp: AlertSet; setTmp: (f: (t: AlertSet) => AlertSet) => void; hadAlerts: boolean; out: boolean; onClose: () => void; onSave: () => void; onReset: () => void;
}) {
  const anyOn = ALERT_DEFS.every(d => tmp[d[0]]);
  const nOn = alertCount(tmp);
  const any = tg(anyOn);
  const row = "display:flex;align-items:center;gap:12px;width:100%;padding:16px;border:none;cursor:pointer;text-align:left";
  const lbl = (label: string, sub: string) => (
    <span style={css("flex:1;min-width:0;display:flex;flex-direction:column;gap:4px")}>
      <span style={css("font:400 15px/20px var(--font-sans);color:rgb(17,16,16)")}>{label}</span>
      <span style={css("font:400 12px/1.26 var(--font-sans);color:rgb(73,67,65);letter-spacing:.25px;text-wrap:pretty")}>{sub}</span>
    </span>
  );
  return (
    <div style={css("position:absolute;left:" + left + "px;top:24px;bottom:12px;z-index:7;width:420px;max-width:calc(100% - " + (left + 12) + "px);display:flex;flex-direction:column;border-radius:24px;overflow:hidden;background:rgb(255,255,255);box-shadow:inset 0 0 0 1px rgba(13,12,12,.1);pointer-events:auto;animation:" + (out ? "bzSheetOut .2s cubic-bezier(.4,0,1,1) both" : "bzSheetIn .38s cubic-bezier(.2,.8,.2,1) backwards"))}>
      <div style={css("flex:none;display:flex;align-items:center;justify-content:space-between;gap:12px;padding:16px 16px 8px 20px")}>
        <span style={css("font:700 15px/20px var(--font-sans);color:rgb(18,18,18)")}>Set alerts</span>
        <button onClick={onClose} title="Close" className="sv-grey" style={css("flex:none;width:32px;height:32px;border:none;border-radius:9999px;background:rgba(13,12,12,.05);color:rgb(17,16,16);cursor:pointer;display:flex;align-items:center;justify-content:center")}>{X12}</button>
      </div>
      <div className="no-scrollbar" style={css("flex:1;min-height:0;overflow-y:auto;display:flex;flex-direction:column;gap:32px;padding:24px 20px 24px")}>
        <div style={css("display:flex;flex-direction:column;gap:16px")}>
          <span style={css("font:700 15px/20px var(--font-sans);color:rgb(17,16,16)")}>Watch for any change</span>
          {/* alAny.toggle: all on / all off, keeping the option picks */}
          <button onClick={() => setTmp(t => ALERT_DEFS.reduce((m, d) => { m[d[0]] = !anyOn; return m; }, { opts: t.opts } as AlertSet))} style={css(row + ";border-radius:20px;background:rgb(253,252,252);box-shadow:inset 0 0 0 .5px rgba(18,18,18,.16)")}>
            {lbl("Any change", "When there’s any change to this property.")}
            <span style={any.track}><span style={any.knob} /></span>
          </button>
        </div>
        <div style={css("display:flex;flex-direction:column;gap:16px")}>
          <span style={css("font:700 15px/20px var(--font-sans);color:rgb(17,16,16)")}>Choose specific alerts</span>
          <div style={css("display:flex;flex-direction:column;gap:8px")}>
            {ALERT_DEFS.map(([id, label, sub]) => {
              const O = ALERT_OPTS[id], on = !!tmp[id], t = tg(on);
              const sel = (tmp.opts || {})[id] || (O ? O.def : []);
              const setSel = (v: string[]) => setTmp(x => ({ ...x, opts: { ...(x.opts || {}), [id]: v } }));
              // op.pick: "one" is single choice; multi keeps at least one picked.
              const pick = (o: string) => { const act = sel.includes(o); setSel(O!.type === "one" ? [o] : act ? (sel.length > 1 ? sel.filter(x => x !== o) : sel) : sel.concat(o)); };
              return (
                <div key={id} style={css("display:flex;flex-direction:column;border-radius:20px;background:rgb(253,252,252);box-shadow:inset 0 0 0 .5px rgba(18,18,18,.16);overflow:hidden")}>
                  <button onClick={() => setTmp(x => ({ ...x, [id]: !x[id] }))} style={css(row + ";background:none")}>
                    {lbl(label, sub)}
                    <span style={t.track}><span style={t.knob} /></span>
                  </button>
                  {on && O && (
                    <div style={css("display:flex;flex-direction:column;gap:10px;margin:0 16px;padding:14px 0 16px;box-shadow:inset 0 .5px 0 rgba(18,18,18,.16);animation:panelDrop .22s cubic-bezier(.2,.8,.2,1) both")}>
                      <span style={css("font:400 12px/16px var(--font-sans);color:rgb(73,67,65);letter-spacing:.25px")}>{O.label}</span>
                      {O.type !== "multi" ? (
                        <div style={css("display:flex;flex-wrap:wrap;gap:8px")}>
                          {O.opts.map(o => {
                            const act = sel.includes(o);
                            return <button key={o} onClick={() => pick(o)} style={css("flex:none;height:32px;padding:0 14px;border:none;border-radius:9999px;cursor:pointer;font:400 13px/18px var(--font-sans);white-space:nowrap;transition:background .16s,color .16s;"
                              + (act ? "background:rgb(18,18,18);color:rgb(249,249,249)" : "background:rgb(255,255,255);color:rgb(18,18,18);box-shadow:inset 0 0 0 .5px rgba(18,18,18,.32)"))}>{o}</button>;
                          })}
                        </div>
                      ) : (
                        <div style={css("display:flex;flex-direction:column;gap:2px;margin:0 -8px")}>
                          {O.opts.map(o => {
                            const act = sel.includes(o);
                            return (
                              <button key={o} onClick={() => pick(o)} className="fb-opt" style={css("display:flex;align-items:center;gap:10px;height:36px;padding:0 8px;border:none;border-radius:10px;background:none;cursor:pointer;text-align:left")}>
                                <span style={css("flex:none;width:18px;height:18px;border-radius:5px;display:flex;align-items:center;justify-content:center;transition:background .16s;" + (act ? "background:rgb(13,87,57)" : "box-shadow:inset 0 0 0 1.3px rgba(18,18,18,.5)"))}>{act && CHECK(11, 3.2)}</span>
                                <span style={css("font:400 14px/18px var(--font-sans);color:rgb(17,16,16)")}>{o}</span>
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
      <div style={css("flex:none;display:flex;align-items:center;justify-content:space-between;gap:16px;height:83px;box-sizing:border-box;padding:20px;background:rgb(255,255,255);box-shadow:inset 0 .5px 0 rgba(13,12,12,.16)")}>
        <button onClick={onReset} className="sv-grey" style={css("flex:none;height:43px;padding:0 16px;border:none;border-radius:9999px;background:rgba(13,12,12,.06);font:700 15px/20px var(--font-sans);color:rgb(18,18,18);cursor:pointer")}>Reset to default</button>
        <button onClick={onSave} className="fb-dark" style={css("flex:none;height:43px;padding:0 20px;border:none;border-radius:9999px;font:700 15px/20px var(--font-sans);color:rgb(253,252,252);background:rgb(18,18,18);transition:opacity .16s;cursor:"
          + (nOn || hadAlerts ? "pointer;opacity:1" : "default;opacity:.32;pointer-events:none"))}>{nOn ? "Set " + nOn + (nOn === 1 ? " alert" : " alerts") : hadAlerts ? "Remove alerts" : "Set alerts"}</button>
      </div>
    </div>
  );
}
