"use client";
import { useEffect, useState } from 'react';
import { Bell, ChatsCircle, Check, CircleNotch, Coins, Hammer, HouseLine, SlidersHorizontal } from '@phosphor-icons/react';

import { M, Mk, N, PC0, ledger, setupOf, termsOf, withOverrides } from '@/lib/roi';
import type { Assumptions, ConfidenceLevel, ConfidenceReading, NumberKey, Outcome } from '@/lib/roi';
import type { Parcel } from './parcel';
const houseLineUpUrl = "/report/house-line-up.svg";
import { BuildSize } from './BuildSize';
import { ConfidenceChip, ConfidenceDetails } from './Confidence';
import { Gauge17 } from './Gauge';
import { Ledger } from './Ledger';
import { SizeLadder } from './SizeLadder';
import { NO_PRICE_COPY, heroCopy, noBuildCopy, noCapacityCopy, pathToWork } from './copy';
import { OPT_IN, VALUATION, isBlocked } from './states';
import type { RoiCase } from './states';
import { Neighborhood } from './Neighborhood';
import type { DealUpdate } from './assumptions';

/* Figma 234:9072 and 234:9075 — the two scenario switches, under Buy and
   Improve. The label never changes; the dark chip with a check is "on". */
function Chip({ on, label, onClick }: { on: boolean; label: string; onClick: () => void }) {
  return (
    <button type="button" className={`rp-toggle${on ? ' on' : ''}`} aria-pressed={on} onClick={onClick}>
      {label}
      {on && <Check size={16} weight="bold" />}
    </button>
  );
}

interface Props {
  parcel: Parcel;
  /** The deal as v2 reads it: tier, pick, break-even (lib/roi/outcome.ts). */
  o: Outcome;
  /** How much the comps back the after-build value. */
  reading: ConfidenceReading;
  /** The chip's level: the reading's, or "yours" once the person sets a sale price. */
  level: ConfidenceLevel;
  a: Assumptions;
  onDeal: DealUpdate;
  /** Opens the assumptions sidebar; with a field, on that field. */
  onAdjust: (field?: NumberKey) => void;
  adjusting: boolean;
  onComps: () => void;
  /**
   * No comparable sales and no price of the person's own (Figma "No
   * comparable sales", step 1): costs, sizes and the ledger's investment show;
   * the gauge, Sell, Profit and the return read as empty until a price is set.
   */
  noPrice?: boolean;
  /** No comparable sales at all, priced or not: step 3's copy once a price is set. */
  noComps?: boolean;
  /** Dev menu: an edge case or system state of Figma 00 (states.ts). */
  state?: RoiCase;
  /** No capacity's "View build guidelines →". */
  onGuidelines: () => void;
}

/** A value still to come (Figma 6594:41155): the report skeleton's bone. */
const Bone = ({ w }: { w?: string }) => <i className="v2-bone" style={w ? { width: w } : undefined} aria-hidden="true" />;

/** Valuation updating: the status pill, and after about ten seconds, the longer wait. */
function ValuationPill() {
  const [late, setLate] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setLate(true), VALUATION.afterMs);
    return () => clearTimeout(t);
  }, []);
  return (
    <p className="v2-pill" role="status">
      {late
        ? <>{VALUATION.late} <button type="button" onClick={() => window.location.reload()}>Refresh</button></>
        : <><CircleNotch size={16} className="spin" aria-hidden="true" />{VALUATION.pill}</>}
    </p>
  );
}

/** Unsupported property type and Zoning being confirmed: the opt-in in the hero's place. */
function OptIn({ kind, onComps }: { kind: 'unsupported' | 'zoning'; onComps: () => void }) {
  const c = OPT_IN[kind];
  const [asked, setAsked] = useState(false);
  return (
    <div className="bgc-action v2-optin">
      <div className="txt">
        {c.tag && <span className="bgc-tag">{c.tag}</span>}
        <b>{c.title}</b>
        <p>{c.text}</p>
        <div className="acts">
          {/* PLACEHOLDER: nothing is sent yet, the button only confirms */}
          <button type="button" className="bgc-pill" onClick={() => setAsked(true)} disabled={asked}>
            {asked ? <><Check size={18} aria-hidden="true" />We’ll let you know</> : <><Bell size={18} aria-hidden="true" />{c.button}</>}
          </button>
          {kind === 'unsupported'
            ? <button type="button" className="v2-link" onClick={onComps}>{c.second} →</button>
            /* PLACEHOLDER: there is no chat yet */
            : <button type="button" className="v2-link"><ChatsCircle size={16} aria-hidden="true" />{c.second}</button>}
        </div>
      </div>
    </div>
  );
}

/** Figma "ROI handoff · 03 Scenarios" — the v2 "Upside analysis" tab. */
export function UpsideTab({ parcel: p, o, reading, level, a, onDeal, onAdjust, adjusting, onComps, noPrice: noPrice0 = false, noComps = false, state, onGuidelines }: Props) {
  const blocked = isBlocked(state) ? state : null;
  const noBuild = state === 'no-build';
  const capped = state === 'no-capacity';
  /* no value to show: these read as the No comps step 1 below the hero */
  const noPrice = noPrice0 || noBuild || blocked !== null;
  /* what the steps can't say yet: unsupported and zoning have no numbers at
     all; valuation keeps the last known costs (Figma 00) */
  const hideCosts = blocked === 'unsupported' || blocked === 'zoning';
  const [details, setDetails] = useState(false);
  /* with no price there is no best return to put forward: the costs shown
     are for everything zoning allows, the size the person starts from */
  /* valuation updating keeps the last known costs: the pick's */
  const r = noPrice && blocked !== 'valuation' ? o.sc.ceiling : o.pick;
  const L = noPrice ? ledger(p, r, a) : o.ledger;
  const q = withOverrides(p, a);
  const negative = !noPrice && o.tier === 'negative';
  const yours = level === 'yours';
  const comps = `${p.images.comps.length} comp${p.images.comps.length === 1 ? '' : 's'}`;
  const cost = r.build + r.soft;
  const terms = termsOf(a);
  const buildCash = setupOf(a).construction === 'cash';
  const copy = capped ? noCapacityCopy(o, p.addr)
    : noBuild ? noBuildCopy(p.Smax)
      : noPrice ? NO_PRICE_COPY
        : heroCopy({ o, own: L.owner, conf: level, sales: reading.count, noComps, salePsf: q.C_RB });
  const chip = <ConfidenceChip level={level} onOpen={() => setDetails(true)} />;
  const addPrice = () => onAdjust('C_RB');
  /* The steps' bold figure is the one the hero does not already say: when
     the hero leads with the profit, the sale value; otherwise the profit. */
  const heroSaysProfit = !noPrice && o.tier === 'positive' && !(yours && noComps);

  const toMoney = () => document.getElementById('money')?.scrollIntoView({ behavior: 'smooth', block: 'start' });

  return (
    <>
      <section className={`rp-sec rp-sec-hero${blocked === 'valuation' ? ' v2-waiting' : ''}`}>
        {blocked === 'valuation' && <ValuationPill />}
        <div className="rp-wrap rp-hero">
          {blocked === 'unsupported' || blocked === 'zoning' ? (
            <div className="left"><OptIn kind={blocked} onComps={onComps} /></div>
          ) : blocked === 'valuation' ? (
            <div className="left v2-bones" aria-hidden="true">
              <Bone w="78%" /><Bone w="56%" />
              <p><Bone w="90%" /><Bone w="86%" /><Bone w="54%" /></p>
            </div>
          ) : (
            <div className="left">
              <h1>{copy.title}</h1>
              <p>{copy.lede}</p>
            </div>
          )}
          {noBuild ? (
            /* Figma 6598:41292: room to grow, and the call to price it */
            <div className="v2-room">
              <p className="lbl">Room to grow</p>
              <p className="val">+{N(Math.max(p.Smax - p.Ex, 0))} ft²</p>
              <p className="sub">on top of the existing {N(p.Ex)} ft²</p>
              <button type="button" className="v2-cta" onClick={addPrice}>Price a project</button>
            </div>
          ) : blocked ? (
            <div className={`v2-score${blocked === 'valuation' ? '' : ' v2-faded'}`}>
              <Gauge17 pct={null} months={r.months} />
            </div>
          ) : noPrice ? (
            <div className="v2-score">
              <Gauge17 pct={null} months={r.months} />
              <button type="button" className="v2-cta" onClick={addPrice}>Add a sale price</button>
            </div>
          ) : negative
            ? (() => {
              const path = pathToWork(o, L.owner, q.Aq);
              return (
                <div className="v2-path">
                  <p className="lbl">{path.label}</p>
                  <p className="val">{path.value}</p>
                  <p className="sub">{path.sub}</p>
                  {chip}
                </div>
              );
            })()
            : (
              <div className="v2-score">
                <Gauge17 pct={Math.round(L.coc * 100)} months={r.months} cap={yours && noComps ? `Your estimate · ROI over ${r.months} months` : undefined} />
                {chip}
              </div>
            )}
        </div>
      </section>
      <ConfidenceDetails reading={reading} open={details} onClose={() => setDetails(false)} onOwnPrice={() => onAdjust('C_RB')} />

      <section className="rp-sec v2-sec-ladder">
        <div className="rp-wrap">
          <SizeLadder p={q} o={o} noPrice={noPrice} mode={capped ? 'capped' : noBuild ? 'mine' : blocked === 'zoning' ? 'pending' : undefined} />
        </div>
      </section>

      {!noBuild && <section className="rp-sec">
        <div className={`rp-wrap rp-steps${blocked ? ' v2-blocked' : ''}`}>
          <div className="step">
            <HouseLine size={24} color="#625A59" />
            <i className="arrow" aria-hidden="true" />
            <p className="k">{hideCosts ? <Bone w="126px" /> : L.owner ? '$0' : Mk(q.Aq)}</p>
            <p className="l">Buy</p>
            <p className="d">{L.owner ? 'You already own this property' : a.Aq === undefined ? 'Estimated purchase price' : 'Your purchase price'}</p>
            <p className="x">
              {L.owner ? <>Worth {Mk(q.Aq)} as it stands</> : p.images.comps.length ? <>Based on {comps}</> : null}
              <button type="button" onClick={onComps}>See comps →</button>
            </p>
            <Chip
              on={L.owner} label="Already own"
              onClick={() => onDeal((prev) => ({ ...prev, ownership: L.owner ? 'buying' : 'own' }))}
            />
          </div>
          <div className="step">
            <Hammer size={24} color="#625A59" />
            <i className="arrow" aria-hidden="true" />
            <p className="k">{hideCosts ? <Bone w="126px" /> : Mk(cost)}</p>
            <p className="l">Improve</p>
            <p className="d">{hideCosts ? <Bone w="152px" /> : r.T.n}</p>
            <p className="x">
              {hideCosts ? <Bone w="116px" /> : <>{r.job?.kind === 'remodel' ? 'Same size' : `${N(r.added)} ft²`} • {r.months} months</>}
              {!hideCosts && <span>{buildCash ? 'Paid in cash' : <>Construction loan · {PC0(terms.ltvProject)} LTV</>}</span>}
              <button type="button" onClick={toMoney}>View breakdown →</button>
            </p>
            <Chip
              on={buildCash} label="Pay in cash"
              onClick={() => onDeal((prev) => ({ ...prev, construction: buildCash ? 'finance' : 'cash' }))}
            />
          </div>
          <div className="out">
            <div className="step">
              <img className="ic" src={houseLineUpUrl} width={24} height={24} alt="" />
              <p className={`k${noPrice ? ' none' : ''}${heroSaysProfit ? ' strong' : ''}`}>{blocked ? <Bone w="96px" /> : noPrice ? '—' : Mk(r.gross)}</p>
              <p className="l">Sell</p>
              <p className="d">Estimated after-build value</p>
              {blocked
                ? <p className="x">Based on {comps}<button type="button" onClick={onComps}>See comps →</button></p>
                : noPrice
                ? <p className="x"><button type="button" onClick={addPrice}>Add your expected sale price →</button></p>
                : yours
                  ? <p className="x">Your sale price: {M(q.C_RB)}/ft²<button type="button" onClick={addPrice}>Edit sale price →</button></p>
                  : <p className="x">Based on {comps}<button type="button" onClick={onComps}>See comps →</button></p>}
            </div>
            {blocked ? (
              <div className="step">
                <i className="ic" aria-hidden="true" />
                <p className="k strong"><Bone w="96px" /></p>
                <p className="l">Profit</p>
                <p className="d">Estimated profit</p>
                <p className="x note"><Bone w="100%" /><Bone w="86%" /><Bone w="52%" /></p>
              </div>
            ) : noPrice ? (
              <div className="step">
                <i className="ic" aria-hidden="true" />
                <p className="k strong none">—</p>
                <p className="l">Profit</p>
                <p className="d">Estimated profit</p>
                <p className="x note">Fills in once there’s a sale price.</p>
              </div>
            ) : negative ? (
              /* Figma 6633:46561: when every option loses, the card's
                 headline is the sale price that breaks even */
              <div className="step">
                <Coins size={24} color="#625A59" className="ic" />
                <p className="k strong">{Mk(o.breakEven.price)}</p>
                <p className="l">Break-even</p>
                <p className="d">Closest to break-even</p>
                <p className="x note">{Mk(o.breakEven.gap)} above today’s {Mk(r.gross)} estimate.</p>
              </div>
            ) : (
              <div className="step">
                {/* no icon here: the profit is the card's headline (Figma 144:22112) */}
                <i className="ic" aria-hidden="true" />
                <p className={`k${heroSaysProfit ? '' : ' strong'}`}>{Mk(L.profit)}</p>
                <p className="l">Profit</p>
                <p className="d">Estimated profit</p>
                <p className="x note">
                  {L.purchaseLoan + L.projectLoan > 0
                    ? 'After loan repayment, interest, carrying costs and selling costs.'
                    : 'After holding and selling costs.'}
                  {L.owner && ' The property as it stands counts against the sale.'}
                </p>
              </div>
            )}
            <button type="button" className={`rp-adjbtn adjust${adjusting ? ' on' : ''}`} onClick={() => onAdjust()} aria-expanded={adjusting}>
              <SlidersHorizontal size={16} />Adjust Assumptions
            </button>
          </div>
        </div>
      </section>}

      <section className={`rp-sec${noBuild ? ' v2-after-ladder' : ''}`}>
        <div className="rp-wrap rp-cards">
          {/* unsupported and zoning have no build sizes and no money yet;
              no build has sizes to price, and no money until it does */}
          {blocked !== 'unsupported' && blocked !== 'zoning' && (
            <BuildSize p={p} o={o} a={a} onAdjust={onAdjust} noPrice={noPrice} capped={capped} onGuidelines={onGuidelines} noBuild={noBuild} />
          )}
          {!noBuild && blocked !== 'unsupported' && blocked !== 'zoning' && (
            <Ledger p={p} rec={r} a={a} onAdjust={onAdjust} noPrice={noPrice} />
          )}
          <Neighborhood parcel={p} onComps={onComps} />
        </div>
      </section>
    </>
  );
}
