"use client";
import { PencilSimple, SlidersHorizontal } from '@phosphor-icons/react';

import { M, Mk, breakEven, ledger, sensitivity, termsOf, withOverrides } from '@/lib/roi';
import type { Assumptions, EvalRow, NumberKey, Params } from '@/lib/roi';
import { ADJUST_COPY } from './assumptions';
const trendDownUrl = "/report/sens/trend-down.svg";
const trendUpUrl = "/report/sens/trend-up.svg";
const trendUpDownUrl = "/report/sens/trend-up-down.svg";

/* Figma 234:7582 / 234:7584 / 234:7588, in sensitivity()'s order: costs up,
   sale price down, both at once. */
const SENS_ICONS = [trendUpUrl, trendDownUrl, trendUpDownUrl];

/** A minus sign (U+2212), not a hyphen, as M() writes money. */
const pct = (v: number, digits = 0) => `${v < 0 ? '−' : ''}${Math.abs(v * 100).toFixed(digits)}%`;
/** Rounded to the thousand, the way a sensitivity reads out loud. */
const about = (v: number) => M(Math.round(v / 1000) * 1000);

interface RowProps {
  label: string;
  value: string;
  total?: boolean;
  /** Editable rows carry the assumption behind them. */
  field?: NumberKey;
  onAdjust?: (field: NumberKey) => void;
}

/* An editable row keeps its number and gains a link to the assumption behind
   it. Where there is nothing to set — fees, payoffs, totals — there is no
   hover state at all. */
const Row = ({ label, value, total, field, onAdjust }: RowProps) => (
  <div className={`rp-led-r${total ? ' tot' : ''}${field ? ' can' : ''}`}>
    <span>{label}</span>
    {field && onAdjust && (
      <button type="button" className="adj" onClick={() => onAdjust(field)}>
        <PencilSimple size={12} weight="bold" aria-hidden="true" />
        <span>{ADJUST_COPY[field] ?? 'Adjust'}</span>
      </button>
    )}
    <b>{value}</b>
  </div>
);

interface Props {
  p: Params;
  rec: EvalRow;
  a: Assumptions;
  /** Opens the sidebar on one field. */
  onAdjust: (field?: NumberKey) => void;
  /** No sale price yet (Figma "No comparable sales", step 1): the investment only, no return or risks. */
  noPrice?: boolean;
}

/** Figma 144:22285 — "Where every dollar goes", at the v2 pick (the option the badge sits on). */
export function Ledger({ p, rec, a, onAdjust, noPrice = false }: Props) {
  const L = ledger(p, rec, a);
  const T = termsOf(a);
  const q = withOverrides(p, a);
  const sens = sensitivity(p, rec, a);
  const costHit = rec.profit - sens[0].profit;
  const saleHit = rec.profit - sens[1].profit;
  const be = breakEven(p, rec, a);
  const off = Math.round((Math.abs(be.gap) / rec.gross) * 100);
  const beVsEstimate = off === 0 ? 'right at the estimate' : `${off}% ${be.gap > 0 ? 'above' : 'below'} the estimate`;
  const field = (f: NumberKey) => ({ field: f, onAdjust });
  /* the duration that applies is the one for this job */
  const monthsField: NumberKey = rec.t === 1 ? 'm1' : rec.t === 2 ? 'm2' : 'm3';

  return (
    <section className="rp-card rp-money" id="money">
      <header className="rp-cardhead">
        <h2>Where every dollar goes</h2>
        <button type="button" className="rp-adjbtn" onClick={() => onAdjust()}>
          <SlidersHorizontal size={16} />Adjust Assumptions
        </button>
      </header>
      <p className="intro">
        {L.owner
          ? <>You already own the property, so only the project’s cash counts: {M(L.cash)} goes in.</>
          : <>{M(L.cash)} of your own cash goes in.</>}{' '}
        {L.purchaseLoan > 0 && L.projectLoan > 0
          ? <>Two loans cover the rest — {pct(T.ltvPurchase)} of the purchase at {pct(T.ratePurchase, 2)} and {pct(T.ltvProject)} of the project at {pct(T.rateProject, 2)} — and both are repaid at sale.</>
          : L.purchaseLoan > 0
            ? <>A loan covers {pct(T.ltvPurchase)} of the purchase at {pct(T.ratePurchase, 2)}, repaid at sale; the build is paid in cash.</>
            : L.projectLoan > 0
              ? <>A loan covers {pct(T.ltvProject)} of the project at {pct(T.rateProject, 2)}, repaid at sale{L.owner ? '' : '; the purchase is paid in cash'}.</>
              : <>No loans: every dollar is your own.</>}{' '}
        Here is every dollar in and out across the {L.months} months.
      </p>

      <div className={`rp-led${noPrice ? ' v2-one' : ''}`}>
        <div>
          <h3>Investment</h3>
          {L.invest.map((l) => (
            <Row key={l.label} label={l.label} value={M(l.value)} {...(l.field ? field(l.field) : {})} />
          ))}
          <Row label="Total investment" value={M(L.cash)} total />
        </div>
        {!noPrice && <div>
          <h3>Return</h3>
          <Row label="Sale proceeds" value={M(L.proceeds)} {...field('C_RB')} />
          <Row label={`Selling costs, ${pct(q.D_DISP, 1)}`} value={M(-L.sellCost)} {...field('D_DISP')} />
          {L.purchaseLoan > 0 && <Row label="Purchase loan payoff" value={M(-L.payPurchase)} />}
          {L.projectLoan > 0 && <Row label="Project loan payoff" value={M(-L.payProject)} />}
          <Row label="Net at close" value={M(L.net)} />
          <Row label="Cash invested" value={M(-L.cash)} />
          {L.owner && <Row label="Property’s value today, as-is" value={M(-L.asIs)} />}
          <Row label="Estimated profit" value={M(L.profit)} total />
          <p className="note">
            {L.owner && <>Selling the property as it stands would bring in {M(L.asIs)} after selling costs ({M(q.Aq)} less {pct(q.D_DISP, 1)}). Building gives that up, so it counts against the sale. </>}
            Your cash is tied up for{' '}
            <button type="button" className="tie" onClick={() => onAdjust(monthsField)}>{L.months} months</button>
            , which is why the return is also shown as {pct(L.annual, 1)} a year. Worth {M(L.npv)} today against a{' '}
            <button type="button" className="tie" onClick={() => onAdjust('hurdle')}>{+(T.hurdle * 100).toFixed(2)}% hurdle</button>.
          </p>
        </div>}
      </div>

      {!noPrice && <div className="rp-wif">
        <h3>What could affect your return?</h3>
        {sens.map((s, i) => (
          <div key={s.label} className="sens">
            <i className="ic"><img src={SENS_ICONS[i]} width={20} height={20} alt="" /></i>
            <span>{s.label}</span>
            <div><b className={s.profit < 0 ? 'neg' : undefined}>{Mk(s.profit)}</b><small>Estimated profit</small></div>
          </div>
        ))}
        {/* Figma 03 desktop: what each risk takes off, then where it breaks even */}
        <p>
          {saleHit >= costHit
            ? <>The result is most sensitive to the sale price. A 10% lower sale price takes about {about(saleHit)} off the profit; 10% higher construction costs take about {about(costHit)}.</>
            : <>The result is most sensitive to construction costs. 10% higher construction costs take about {about(costHit)} off the profit; a 10% lower sale price takes about {about(saleHit)}.</>}{' '}
          The break-even sale price is about {Mk(be.price)}, {beVsEstimate}.
        </p>
      </div>}
    </section>
  );
}
