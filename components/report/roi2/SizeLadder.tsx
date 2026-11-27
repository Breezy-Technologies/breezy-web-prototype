"use client";
import { N, best } from '@/lib/roi';
import type { Outcome, Params } from '@/lib/roi';

interface Props {
  p: Params;
  o: Outcome;
  /** No sale price yet: no return ranks the additions, so the largest one stands in. */
  noPrice?: boolean;
  /**
   * capped: No capacity, the two that add space are over the zoning limit.
   * mine: No build scenarios, the middle cell is the person's own project.
   * pending: Zoning being confirmed, only what stands is known.
   */
  mode?: 'capped' | 'mine' | 'pending';
}

/**
 * Figma "size ladder" (6571:35852): what stands today, the addition worth
 * doing, and the most the city allows, between the hero and the steps.
 * The middle cell is the best-return addition that keeps the existing
 * structure; a lot with no room for one shows the other two.
 */
export function SizeLadder({ p, o, noPrice = false, mode }: Props) {
  const keeps = o.sc.rows.filter((r) => r.t < 3);
  const addition = keeps.length ? (noPrice ? keeps[keeps.length - 1] : best(keeps)) : null;
  const room = Math.max(p.Smax - p.Ex, 0);

  const existing = { size: p.Ex, name: 'Existing Property', text: `What is standing today, on a ${N(p.lot)} ft² lot.` };
  const teardown = { size: p.Smax, name: 'Teardown & Rebuild', text: `+${N(room)} ft² of additional floor area to rebuild, up to the most the city allows.` };

  /* Figma 6582:36811: what adds space is over the limit, greyed */
  if (mode === 'capped' || mode === 'pending') {
    const off = mode === 'capped' ? 'Over the zoning limit.' : 'Waiting for the zoning.';
    return (
      <div className="v2-ladder">
        <Cell c={existing} />
        <Cell c={{ size: null, name: 'Addition & Remodel', text: off }} off />
        <Cell c={{ size: null, name: 'Teardown & Rebuild', text: off }} off />
      </div>
    );
  }
  /* Figma 6598:41292: no size is priced, the middle one is the person's */
  if (mode === 'mine') {
    return (
      <div className="v2-ladder">
        <Cell c={existing} />
        <Cell c={{ size: null, name: 'Your project', text: 'Pick a size below and add your numbers.' }} />
        <Cell c={teardown} />
      </div>
    );
  }

  const cells = [
    { size: p.Ex, name: 'Existing Property', text: `What is standing today, on a ${N(p.lot)} ft² lot.` },
    ...(addition
      ? [{ size: addition.S, name: 'Addition & Remodel', text: `+${N(addition.added)} ft² of additional floor area to extend what exists.` }]
      : []),
    { size: p.Smax, name: 'Teardown & Rebuild', text: `+${N(room)} ft² of additional floor area to rebuild, up to the most the city allows.` },
  ];

  return (
    <div className="v2-ladder">
      {cells.map((c) => <Cell key={c.name} c={c} />)}
    </div>
  );
}

function Cell({ c, off = false }: { c: { size: number | null; name: string; text: string }; off?: boolean }) {
  return (
    <div className={off ? 'off' : undefined}>
      <p className="k">{c.size === null ? '—' : `${N(c.size)} ft²`}</p>
      <p className="l">{c.name}</p>
      <p className="d">{c.text}</p>
    </div>
  );
}
