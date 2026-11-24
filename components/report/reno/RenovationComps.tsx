"use client";
// Renovation comps tab (Figma Project Nimbus (Core) "Comps · Positive ROI · high confidence ·
// 1200" 7137:46640, section 7888:56954): "The comps behind the numbers". The property panel
// on the left (as on the ROI page), then the Comparable sales card: Today (pre-renovation
// comps) vs After the build (post-renovation comps), the post-renovation comp cards, and
// the pre-renovation box whose Get comps (like "View pre-renovation comps →") starts the
// detail panel's Get comps: review the subject, then the comps split view.
import { useMemo, useRef, useState } from "react";
import { fullPrice, type Listing } from "@/lib/fake";
import { compDetail, shortDate } from "@/lib/comps";
import { renovationOf, type RenoComp } from "@/lib/renovation";
import { StatusBadge } from "../../StatusBadge";
import { Carousel, SPARK } from "../CompsReport";
import { PropertyPanel } from "../upside/PropertyPanel";
import { useAiWrite } from "../aiWrite";
import "../upside.css";
import "../upside-scenarios.css";
import "../report-tabs.css";

const f = (n: number) => Math.round(n).toLocaleString("en-US");

export function RenovationComps({ l, onComps, write }: { l: Listing; onComps: () => void; write?: boolean }) {
  const r = useMemo(() => renovationOf(l), [l]);
  const scroller = useRef<HTMLDivElement>(null);
  useAiWrite(scroller, scroller, !!write, true);
  const street = l.addr.split(",")[0];
  const { pre, post } = r;
  const n = post.comps.length;

  return (
    <div className="bz-up bz-rc" style={{ position: "relative", flex: 1, minHeight: 0, display: "flex" }}>
      <aside className="bz-up-left" aria-label="Property"><PropertyPanel l={l} /></aside>
      <div className="bz-up-col">
        <div ref={scroller} className="rp-main no-scrollbar" style={{ overflowY: "auto", overscrollBehavior: "contain" }}>
          <div className="rc-page">
            <section className="rc-hero">
              <h1>The comps behind the numbers</h1>
              <p>What renovated homes nearby sell for, compared with what {street} is worth today. That gap is the upside behind the ROI.</p>
            </section>

            <section className="rc-card">
              <h2>Comparable sales</h2>
              <div className="rc-bridge">
                <div>
                  <p className="k">Today</p>
                  <p className="big">{pre.value ? fullPrice(pre.value) : "—"}</p>
                  <p className="sm">{pre.n} pre-renovation comps · ${f(pre.ppsf)}/ft²{pre.lot ? " of lot" : ""} × {f(pre.size)} ft²{pre.lot ? " lot" : ""}</p>
                  <button type="button" className="lnk" onClick={onComps}>View pre-renovation comps →</button>
                </div>
                <div>
                  <p className="k">After the build</p>
                  <p className="big up">{post.value ? fullPrice(post.value) : "—"}</p>
                  <p className="sm">{n} sold post-renovation comps · ${f(post.ppsf)}/ft² × {f(post.size)} ft²</p>
                  <p className="sm mute">Median $/ft² of included sold comps</p>
                </div>
              </div>

              <div className="rc-post">
                <div className="hd">
                  <div>
                    <h3>Post-renovation comps</h3>
                    <p>Renovated homes close to {f(post.size)} ft² that set the after-build value.</p>
                  </div>
                  <span>{n} sold</span>
                </div>
                {n ? (
                  <div className="grid">{post.comps.map((c, i) => <RenoCard key={c.i} c={c} n={i + 1} of={n} />)}</div>
                ) : (
                  <p className="empty">No renovated homes have sold within 1.5 miles yet. The ROI uses the model’s sale price until one does.</p>
                )}
              </div>

              <div className="rc-pre">
                <div>
                  <b>Pre-renovation comps</b>
                  <p>{pre.n} comps used to estimate today’s value of {fullPrice(pre.value)}. Review or adjust them with Get comps.</p>
                </div>
                <button type="button" onClick={onComps}>Get comps <span aria-hidden="true">→</span></button>
              </div>
            </section>

            <section className="rp-card rp-notice rc-notice">
              <h2>Please note</h2>
              <p>
                Development potential estimates are derived from zoning data and automated analysis. They may not
                reflect all regulations, restrictions, or site-specific conditions. This information is provided for
                informational purposes only and should not be relied upon as legal, architectural, or development
                advice. Always verify zoning and development potential with local authorities or licensed professionals.
              </p>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}

function RenoCard({ c, n, of }: { c: RenoComp; n: number; of: number }) {
  const d = compDetail(c);
  const [hist, setHist] = useState(false);
  return (
    <article className="rc-comp">
      <Carousel photos={d.photos} h={190} radius={18}>
        <span className="match">{SPARK("currentColor")}{c.score}% Match</span>
      </Carousel>
      <div className="body">
        <h4>{c.addr}</h4>
        <p className="specs"><b>{c.beds}</b> bed <b>{c.baths}</b> bath <b>{f(c.sqft)}</b> ft² <b>{f(c.lot)}</b> /ft² lot</p>
        <div className="chips">
          <span>Built {c.year}</span>
          {(c.remodel || c.year >= 2000) && <span className="ai">{SPARK("currentColor", 10)}{c.remodel ? "Remodel" : "New build"}</span>}
          <span className="ai">{SPARK("currentColor", 10)}{c.style}</span>
        </div>
        <div className="grid3 top">
          <span><i>listed for</i>{fullPrice(d.listed)}</span>
          <span><i>sold for</i><b>{fullPrice(d.sold ?? c.price)}</b></span>
          <span className="tr">
            <span><i className={`ph ph-trend-${d.diff < 0 ? "down" : "up"}`} aria-hidden="true" /><em className={d.diff < 0 ? "dn" : "up"}>{Math.abs(d.diff)}%</em></span>
            <button type="button" aria-label="Listing history" aria-pressed={hist} onClick={() => setHist(h => !h)}><i className="ph-bold ph-clock-counter-clockwise" /></button>
          </span>
        </div>
        {hist && (
          <div className="hist">
            <span><span>Listed</span><span>{shortDate(d.listedOn)} · {fullPrice(d.listed)}</span></span>
            {d.soldOn && <span><span>Sold</span><span>{shortDate(d.soldOn)} · {fullPrice(d.sold!)}</span></span>}
          </div>
        )}
        <div className="grid3">
          <span><i>price per ft²</i>${f(c.ppsf)}</span>
          <span><i>price per ft² lot</i>{d.perLot ? `$${f(d.perLot)}` : "—"}</span>
          <span />
        </div>
        <div className="grid3">
          <span><i>listed on</i>{shortDate(d.listedOn)}</span>
          <span><i>sold on</i>{d.soldOn ? shortDate(d.soldOn) : "—"}</span>
          <span><i>DOM</i>{d.dom}</span>
        </div>
        <p className="foot"><StatusBadge status="Sold" size={16} /><b>Sold</b> {n} of {of}</p>
      </div>
    </article>
  );
}
