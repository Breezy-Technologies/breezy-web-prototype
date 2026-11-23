"use client";
// The property panel on the left of the ROI page (Figma "ROI · 03 Scenarios",
// every desktop frame's left column, e.g. 6571:35737): photo with the status
// and photo count, city and address, the specs row, Summary / Specs / Records /
// Owners, listing history, features, owner, and "Get the report". Adjust
// assumptions takes this column's place while it is open (UpsideReport).
import { useState } from "react";
import { fullPrice, listingDetail, type Listing } from "@/lib/fake";
import { StatusTag } from "@/components/StatusBadge";
import { Ic } from "./Ic";

/** $431K, $9.58M */
const money = (v: number) => (v >= 1e6 ? `$${(v / 1e6).toFixed(2)}M` : `$${Math.round(v / 1000)}K`);

const TABS =["Summary", "Specs", "Records", "Owners"] as const;
type Tab = (typeof TABS)[number];

const FEAT_IC: Record<string, string> = {
  "Single family": "house", Condo: "buildings", Townhouse: "buildings", "Multi family": "buildings", Duplex: "buildings", Lot: "selection",
  Pool: "swimming-pool", "ADU potential": "house-simple", "City view": "city", Garage: "garage", "Landscaped garden": "plant", Solar: "solar-panel",
};

export function PropertyPanel({ l, onGetReport }: { l: Listing; onGetReport?: () => void }) {
  const d = listingDetail(l);
  const [tab, setTab] = useState<Tab>("Summary");
  const [ph, setPh] = useState(0);
  const photos = l.photos.length ? l.photos : [];
  const [street, ...rest] = l.addr.split(",");
  const city = l.city.split(",")[0] || "Los Angeles";
  const lotSf = Math.round(l.lotAc * 43560);
  const specs: [string, string][] = [
    [String(l.beds), "Bed"], [String(l.baths), "Bath"],
    [l.sqft ? l.sqft.toLocaleString("en-US") : "—", "ft² Home"],
    [l.lotAc ? (Math.round(l.lotAc * 100) / 100).toString() : "—", "/ac Lot"],
    [d.hoa ? `$${d.hoa}` : "$0", "/mo HOA"],
  ];
  const feats = [l.ptype, l.pstyle, ...l.feats].filter(Boolean);
  const show = (t: Tab) => tab === "Summary" || tab === t;

  return (
    <section className="rp-prop" aria-label="Property">
      <div className="photo">
        {photos[0] && <img src={photos[ph % photos.length]} alt={`${street}, photo ${ph + 1}`} />}
        {photos.length > 1 && <button type="button" className="next" aria-label="Next photo" onClick={() => setPh(i => (i + 1) % photos.length)}><Ic n="caret-right" s={16} b /></button>}
        <StatusTag status={l.status === "Off market" ? "Off market" : l.status} style={{ position: "absolute", left: 16, bottom: 16, height: 32, lineHeight: "32px", font: "400 16px/32px var(--font-sans)" }} />
        <span className="count"><Ic n="camera" s={16} />{photos.length}</span>
      </div>

      <div className="body">
        <div className="head">
          <p className="city">{city}</p>
          <h2>{street}{rest.length ? `,${rest.join(",")}` : ""}</h2>
          <div className="specs">
            {specs.map(([v, k]) => <div key={k}><b>{v}</b><span>{k}</span></div>)}
          </div>
          <div className="tabs" role="tablist">
            {TABS.map(t => <button key={t} type="button" role="tab" aria-selected={tab === t} className={tab === t ? "on" : undefined} onClick={() => setTab(t)}>{t}</button>)}
          </div>
        </div>

        {show("Records") && (
          <div className="sec">
            <h3>Listing history</h3>
            <div className="hist">
              <div><span>{l.status === "Sold" ? "Sold for" : "Listed for"}</span><b>{fullPrice(l.price)}</b></div>
              <div><span>Per /ft² Home</span><b>{l.sqft ? `$${Math.round(l.price / l.sqft).toLocaleString("en-US")}` : "—"}</b></div>
              <div><span>Per/ac Lot</span><b>{l.lotAc ? money(l.price / l.lotAc) : "—"}</b></div>
              <div><span>Listed on</span><b>{d.listedOn}</b></div>
              <div><span>DOM</span><b>{l.dom}</b></div>
            </div>
          </div>
        )}

        {show("Specs") && (
          <div className="sec">
            <h3>Features</h3>
            <div className="chips">
              {feats.map(f => <span key={f}><Ic n={FEAT_IC[f] ?? "check"} s={14} />{f}</span>)}
              {tab === "Specs" && <>
                <span>Built {l.built || "—"}</span>
                <span>{lotSf.toLocaleString("en-US")} ft² lot</span>
                <span>Zone {d.zone}</span>
                <span>{d.garage}-car garage</span>
              </>}
            </div>
          </div>
        )}

        {show("Owners") && (
          <div className="sec">
            <h3>Owners</h3>
            <div className="owner">
              <span>Current owner</span>
              <b>{l.owner.name}</b>
              {tab === "Owners" && <small>{l.owner.sub}</small>}
            </div>
          </div>
        )}
      </div>

      <div className="foot">
        <button type="button" onClick={onGetReport}>Get the report</button>
      </div>
    </section>
  );
}
