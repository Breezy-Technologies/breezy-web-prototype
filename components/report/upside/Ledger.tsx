"use client";
// "Where every dollar goes" (Figma 144:22285), ported from Pedro's
// underbuilt-roi src/routes/-report/Ledger.tsx. Phosphor webfont icons
// instead of @phosphor-icons/react; assets from public/report/.
import { M, Mk, ledger, sensitivity, termsOf, withOverrides } from "@/lib/roi";
import type { Assumptions, EvalRow, NumberKey, Params } from "@/lib/roi";
import { ADJUST_COPY } from "./assumptions";
import { Ic } from "./Ic";

const SENS_ICONS = ["/report/sens/trend-up.svg", "/report/sens/trend-down.svg", "/report/sens/trend-up-down.svg"];

const pct = (v: number, digits = 0) => `${(v * 100).toFixed(digits)}%`;
const about = (v: number) => M(Math.round(v / 1000) * 1000);

type RowProps = { label: string; value: string; total?: boolean; field?: NumberKey; onAdjust?: (field: NumberKey) => void };

const Row = ({ label, value, total, field, onAdjust }: RowProps) => (
  <div className={`rp-led-r${total ? " tot" : ""}${field ? " can" : ""}`}>
    <span>{label}</span>
    {field && onAdjust && (
      <button type="button" className="adj" onClick={() => onAdjust(field)}>
        <Ic n="pencil-simple" s={12} b />
        <span>{ADJUST_COPY[field] ?? "Adjust"}</span>
      </button>
    )}
    <b>{value}</b>
  </div>
);

export function Ledger({ p, rec, a, onAdjust }: { p: Params; rec: EvalRow; a: Assumptions; onAdjust: (field?: NumberKey) => void }) {
  const L = ledger(p, rec, a);
  const T = termsOf(a);
  const q = withOverrides(p, a);
  const sens = sensitivity(p, rec, a);
  const costHit = rec.profit - sens[0].profit;
  const saleHit = rec.profit - sens[1].profit;
  const field = (f: NumberKey) => ({ field: f, onAdjust });
  const monthsField: NumberKey = rec.t === 1 ? "m1" : rec.t === 2 ? "m2" : "m3";

  return (
    <section className="rp-card rp-money" id="money">
      <header className="rp-cardhead">
        <h2>Where every dollar goes</h2>
        <button type="button" className="rp-adjbtn" onClick={() => onAdjust()}>
          <Ic n="sliders-horizontal" s={16} />Adjust Assumptions
        </button>
      </header>
      <p className="intro">
        {L.owner
          ? <>You already own the property, so only the project’s cash counts: {M(L.cash)} goes in.</>
          : <>{M(L.cash)} of your own cash goes in.</>}{" "}
        {L.purchaseLoan > 0 && L.projectLoan > 0
          ? <>Two loans cover the rest — {pct(T.ltvPurchase)} of the purchase at {pct(T.ratePurchase, 2)} and {pct(T.ltvProject)} of the project at {pct(T.rateProject, 2)} — and both are repaid at sale.</>
          : L.purchaseLoan > 0
            ? <>A loan covers {pct(T.ltvPurchase)} of the purchase at {pct(T.ratePurchase, 2)}, repaid at sale; the build is paid in cash.</>
            : L.projectLoan > 0
              ? <>A loan covers {pct(T.ltvProject)} of the project at {pct(T.rateProject, 2)}, repaid at sale{L.owner ? "" : "; the purchase is paid in cash"}.</>
              : <>No loans: every dollar is your own.</>}{" "}
        Here is every dollar in and out across the {L.months} months.
      </p>

      <div className="rp-led">
        <div>
          <h3>Investment</h3>
          {L.invest.map(l => <Row key={l.label} label={l.label} value={M(l.value)} {...(l.field ? field(l.field) : {})} />)}
          <Row label="Total investment" value={M(L.cash)} total />
        </div>
        <div>
          <h3>Return</h3>
          <Row label="Sale proceeds" value={M(L.proceeds)} {...field("C_RB")} />
          <Row label={`Selling costs, ${pct(q.D_DISP, 1)}`} value={M(-L.sellCost)} {...field("D_DISP")} />
          {L.purchaseLoan > 0 && <Row label="Purchase loan payoff" value={M(-L.payPurchase)} />}
          {L.projectLoan > 0 && <Row label="Project loan payoff" value={M(-L.payProject)} />}
          <Row label="Net at close" value={M(L.net)} />
          <Row label="Cash invested" value={M(-L.cash)} />
          {L.owner && <Row label="Home’s value today, as-is" value={M(-L.asIs)} />}
          <Row label="Estimated profit" value={M(L.profit)} total />
          <p className="note">
            {L.owner && <>Selling the house as it stands would bring in {M(L.asIs)} after selling costs ({M(q.Aq)} less {pct(q.D_DISP, 1)}). Building gives that up, so it counts against the sale. </>}
            Your cash is tied up for{" "}
            <button type="button" className="tie" onClick={() => onAdjust(monthsField)}>{L.months} months</button>
            , which is why the return is also shown as {pct(L.annual, 1)} a year. Worth {M(L.npv)} today against a{" "}
            <button type="button" className="tie" onClick={() => onAdjust("hurdle")}>{+(T.hurdle * 100).toFixed(2)}% hurdle</button>.
          </p>
        </div>
      </div>

      <div className="rp-wif">
        <h3>What could affect your return?</h3>
        {sens.map((s, i) => (
          <div key={s.label} className="sens">
            <i className="ic"><img src={SENS_ICONS[i]} width={20} height={20} alt="" /></i>
            <span>{s.label}</span>
            <div><b className={s.profit < 0 ? "neg" : undefined}>{Mk(s.profit)}</b><small>Estimated profit</small></div>
          </div>
        ))}
        <p>
          {saleHit >= costHit
            ? <>The return is most sensitive to the sale price. A 10% miss at the exit costs about {about(saleHit)}; a 10% overrun on construction costs about {about(costHit)}. Get your comps right before you get your quotes.</>
            : <>The return is most sensitive to construction costs. A 10% overrun costs about {about(costHit)}; a 10% miss at the exit costs about {about(saleHit)}. Get firm quotes before you commit to a size.</>}
        </p>
      </div>
    </section>
  );
}
