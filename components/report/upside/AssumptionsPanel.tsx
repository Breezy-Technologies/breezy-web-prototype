"use client";
// "Adjust assumptions", ported from Pedro's underbuilt-roi
// src/routes/-report/AssumptionsPanel.tsx. In his report it is the sidebar's
// other face; here it slides in at the right of the report sheet. Phosphor
// webfont icons instead of @phosphor-icons/react.
import { useEffect, useRef, useState } from 'react';
import type { KeyboardEvent, ReactNode } from 'react';
import { Ic } from './Ic';

import { FINANCE, Mk, N, changedCount, holdingPerYear, setupOf } from '@/lib/roi';
import type { Assumptions, EvalRow, NumberKey, Params } from '@/lib/roi';
import { GROUPS, clampTo } from './assumptions';
import type { DealUpdate, Field, GroupId } from './assumptions';

/* ---------- one number ---------- */

const PREFIX: Partial<Record<Field['unit'], string>> = { usd: '$', psf: '$', perYear: '$' };
const SUFFIX: Record<Field['unit'], string> = { usd: '', psf: '/ft²', pct: '%', months: 'mo', perYear: '/yr' };

/** Stored units to what the input shows: percentages ×100, money with separators. */
function show(f: Field, v: number, plain = false): string {
  if (f.unit === 'pct') return String(Math.round(v * 10_000) / 100);
  if (f.unit === 'months') return String(Math.round(v));
  return plain ? String(Math.round(v)) : N(v);
}

/** With its units, for the reset button: $290/ft², 18%, 17 mo. */
const withUnits = (f: Field, v: number) =>
  `${PREFIX[f.unit] ?? ''}${show(f, v)}${f.unit === 'months' ? ' mo' : SUFFIX[f.unit]}`;

function parse(f: Field, text: string): number | null {
  const cleaned = text.replace(/[^0-9.]/g, '');
  if (!cleaned || cleaned === '.') return null;
  const n = Number(cleaned);
  if (!Number.isFinite(n)) return null;
  return f.unit === 'pct' ? n / 100 : n;
}

interface NumberProps {
  f: Field;
  label: string;
  value: number | undefined;
  /** What the model uses when the person has not set a value. */
  fallback: number;
  onChange: (v: number | undefined) => void;
  disabled?: boolean;
}

function NumberField({ f, label, value, fallback, onChange, disabled }: NumberProps) {
  // what is typed, while it is being typed; the committed value otherwise
  const [draft, setDraft] = useState<string | null>(null);
  const current = value ?? fallback;
  const changed = value !== undefined;
  const id = `adj-${f.key}`;

  const commit = (text: string) => {
    const v = parse(f, text);
    if (v === null) return;
    const next = clampTo(f, v);
    // focusing and leaving a field it does not change must not pin its value
    if (value === undefined && show(f, next, true) === show(f, current, true)) return;
    onChange(next);
  };

  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') e.currentTarget.blur();
    if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return;
    e.preventDefault();
    const next = clampTo(f, current + (e.key === 'ArrowUp' ? f.step : -f.step));
    onChange(next);
    setDraft(show(f, next, true));
  };

  return (
    <div className={`fld${changed ? ' changed' : ''}${disabled ? ' off' : ''}`}>
      <label htmlFor={id}>
        <span>{label}</span>
        {f.hint && <small>{f.hint}</small>}
      </label>
      <div className="in">
        {PREFIX[f.unit] && <span className="pre">{PREFIX[f.unit]}</span>}
        <input
          id={id} type="text" inputMode="decimal" disabled={disabled}
          value={draft ?? show(f, current)}
          onFocus={(e) => { setDraft(show(f, current, true)); e.currentTarget.select(); }}
          onChange={(e) => {
            setDraft(e.target.value);
            const v = parse(f, e.target.value);
            // out-of-range values wait for blur, so typing through them does not jump
            if (v !== null && v >= f.min && v <= f.max) onChange(v);
          }}
          onBlur={(e) => { commit(e.target.value); setDraft(null); }}
          onKeyDown={onKey}
        />
        {SUFFIX[f.unit] && <span className="suf">{SUFFIX[f.unit]}</span>}
      </div>
      {changed && !disabled && (
        <button type="button" className="reset" onClick={() => { onChange(undefined); setDraft(null); }}>
          <Ic n="arrow-counter-clockwise" s={12} />
          <span className="sr">Reset to </span>{withUnits(f, fallback)}
        </button>
      )}
    </div>
  );
}

/* ---------- one choice ---------- */

interface SegProps<V extends string> {
  label: string;
  value: V;
  options: readonly (readonly [V, string])[];
  onChange: (v: V) => void;
}

function Segmented<V extends string>({ label, value, options, onChange }: SegProps<V>) {
  return (
    <div className="seg">
      <span className="lbl">{label}</span>
      <div className="track" role="radiogroup" aria-label={label}>
        {options.map(([v, text]) => (
          <button
            key={v} type="button" role="radio" aria-checked={v === value}
            className={v === value ? 'on' : undefined} onClick={() => onChange(v)}
          >
            {text}
          </button>
        ))}
      </div>
    </div>
  );
}

const OWNERSHIP = [['buying', 'Buying'], ['own', 'Already own']] as const;
const FUNDING = [['finance', 'Finance'], ['cash', 'Cash']] as const;

/* ---------- panel ---------- */

interface Props {
  p: Params;
  /** The recommended build for the current deal. Holding costs are quoted at its size. */
  rec: EvalRow;
  a: Assumptions;
  onChange: DealUpdate;
  /** A field to scroll to, focus and flash, from a link in the analysis. */
  focus?: NumberKey;
  /** Called once that has happened, so the URL can drop it. */
  onFocused?: () => void;
  onClose: () => void;
}

/** The report sidebar's other face: every number behind the Upside analysis, editable. */
export function AssumptionsPanel({ p, rec, a, onChange, focus, onFocused, onClose }: Props) {
  /* Read through a ref: the callback is a new function on every render, and
     this should run once per field, not once per keystroke. */
  const done = useRef(onFocused);
  useEffect(() => { done.current = onFocused; });
  useEffect(() => {
    if (!focus) return;
    const input = document.getElementById(`adj-${focus}`);
    const row = input?.closest('.fld');
    if (!input || !row) { done.current?.(); return; }
    /* scroll the panel itself: scrollIntoView would drag the analysis behind it */
    const body = row.closest<HTMLElement>('.body');
    if (body) {
      const from = body.getBoundingClientRect(), to = row.getBoundingClientRect();
      body.scrollTo({ top: body.scrollTop + (to.top - from.top) - (from.height - to.height) / 2, behavior: 'smooth' });
    }
    input.focus({ preventScroll: true });
    row.classList.add('hit');
    const t = window.setTimeout(() => { row.classList.remove('hit'); done.current?.(); }, 1400);
    return () => { clearTimeout(t); row.classList.remove('hit'); };
  }, [focus]);

  const s = setupOf(a);
  const own = s.ownership === 'own';
  const holding = holdingPerYear(p, rec.S, a, rec.job);
  const n = changedCount(a);

  const defaults: Record<NumberKey, number> = {
    Aq: p.Aq, D_ACQ: p.D_ACQ, Hc: p.Hc, D_SOFT: p.D_SOFT, C_RB: p.C_RB, D_DISP: p.D_DISP,
    m1: p.m1, m2: p.m2, m3: p.m3,
    down: 1 - FINANCE.ltvPurchase, ratePurchase: FINANCE.ratePurchase,
    ltvProject: FINANCE.ltvProject, rateProject: FINANCE.rateProject, hurdle: FINANCE.hurdle,
    ...holding,
  };

  /* a field the setup has taken out of the deal is dropped, not greyed */
  const cashPurchase = (a.down ?? 1 - FINANCE.ltvPurchase) >= 1;
  const unused = (key: NumberKey): boolean =>
    (own && (key === 'D_ACQ' || key === 'down' || key === 'ratePurchase')) ||
    (cashPurchase && key === 'ratePurchase') ||
    (s.construction === 'cash' && (key === 'ltvProject' || key === 'rateProject'));

  const groupNote: Partial<Record<GroupId, string | null>> = {
    purchase: own
      ? 'You already own it, so there is no purchase, buying cost or purchase loan. The value today is what you give up by building instead of selling.'
      : cashPurchase ? 'Paying cash: a full down payment, no purchase loan.' : null,
    construction: s.construction === 'cash' ? 'Paying cash: no construction loan.' : null,
    holding: 'Estimated from the model’s carrying rate until you set them.',
  };

  const hintFor = (key: NumberKey): string | undefined => {
    if (key === 'Hc') return `${Mk(rec.build + rec.soft)} project at ${N(rec.S)} ft²`;
    if (key === 'C_RB') return `${Mk(rec.gross)} after the build`;
    return undefined;
  };

  /* The switches sit on the same keys the hero's chips and the down payment
     use, and write only what differs from the standard deal, as the URL
     expects. A cash purchase is a 100% down payment; back to financing
     returns the down payment to the model's. */
  const setOwnership = (v: 'buying' | 'own') =>
    onChange(({ ownership: _o, ...prev }) => (v === 'own' ? { ...prev, ownership: 'own' } : prev));
  const setPurchase = (v: 'finance' | 'cash') =>
    onChange(({ down: _d, ...prev }) => (v === 'cash' ? { ...prev, down: 1 } : prev));
  const setConstruction = (v: 'finance' | 'cash') =>
    onChange(({ construction: _c, ...prev }) => (v === 'cash' ? { ...prev, construction: 'cash' } : prev));

  const setup: Partial<Record<GroupId, ReactNode>> = {
    purchase: (
      <>
        <Segmented label="Ownership" value={s.ownership} options={OWNERSHIP} onChange={setOwnership} />
        {/* an owner makes no purchase to pay for */}
        {!own && (
          <Segmented label="Payment method" value={cashPurchase ? 'cash' : 'finance'} options={FUNDING} onChange={setPurchase} />
        )}
      </>
    ),
    construction: (
      <Segmented label="Payment method" value={s.construction} options={FUNDING} onChange={setConstruction} />
    ),
  };

  const set = (key: NumberKey, v: number | undefined) =>
    onChange((prev) => {
      const next = { ...prev };
      if (v === undefined) delete next[key];
      else next[key] = v;
      return next;
    });

  return (
    <section className="rp-adj" aria-labelledby="adj-title">
      <header>
        <h2 id="adj-title">Adjust assumptions</h2>
        <button type="button" className="close" onClick={onClose} aria-label="Close assumptions">
          <Ic n="x" s={16} />
        </button>
      </header>
      <p className="lede">
        Every number behind the Upside analysis. Change one and the analysis updates as you type.
      </p>

      <div className="body">
        {GROUPS.map((g) => (
          <div key={g.id} className="grp">
            <h3>{g.title}</h3>
            {setup[g.id]}
            {groupNote[g.id] && <p className="gnote">{groupNote[g.id]}</p>}
            {g.fields.filter((f) => !unused(f.key)).map((f) => (
              <NumberField
                key={f.key}
                f={hintFor(f.key) ? { ...f, hint: hintFor(f.key) } : f}
                label={f.key === 'Aq' && own ? 'Value today' : f.label}
                value={a[f.key]}
                fallback={defaults[f.key]}
                onChange={(v) => set(f.key, v)}
              />
            ))}
          </div>
        ))}
      </div>

      <footer>
        <span>{n === 0 ? 'Using the model’s estimates' : `${n} assumption${n === 1 ? '' : 's'} changed`}</span>
        <button type="button" disabled={Object.keys(a).length === 0} onClick={() => onChange(() => ({}))}>
          Reset all
        </button>
      </footer>
    </section>
  );
}
