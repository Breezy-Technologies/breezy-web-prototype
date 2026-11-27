import type { BuildOption, Envelope, LimitRule, Rect, Sourced, ZoningRules } from './types';

/**
 * The building envelope from a lot's rules: the maximum floor area and the
 * rule that sets it, the homes and ADU allowed, the build options and what
 * each one needs. Pure: rules in, envelope out.
 *
 * The maximum is the lowest of what each rule allows:
 *   - floor area ratio × the basis area;
 *   - the largest footprint × the stories allowed, where the largest
 *     footprint is the lower of the coverage limit and the area inside the
 *     setbacks;
 *   - on a hillside lot, the level pad formula instead of both (coverage is
 *     not used there), never under the guarantee.
 * A lot with no zoning code has no maximum and no score.
 */

const N = (n: number) => Math.round(n).toLocaleString('en-US');
const PCT = (n: number) => `${Math.round(n * 100)}%`;
const ACRE = 43_560;
/** Area × a share, without the float tail (10,500 × 0.35 is 3,674.999…). */
const cent = (n: number) => Math.round(n * 100) / 100;

function inside(rules: ZoningRules): Sourced<Rect> | null {
  const sb = rules.limits.setbacks;
  if (!sb) return null;
  const b = rules.basis ?? rules.lot;
  const width = b.width - 2 * sb.value.side;
  const depth = b.depth - sb.value.front - sb.value.rear;
  return {
    value: { width, depth, area: width * depth },
    mark: 'calculated',
    how: `(${N(b.width)} − ${N(2 * sb.value.side)}) × (${N(b.depth)} − ${N(sb.value.front + sb.value.rear)})`,
  };
}

function homesAllowed(rules: ZoningRules): Sourced<number> {
  if (!rules.code) return { value: rules.existing.homes, mark: 'advisory', note: 'No zoning code: the county and any covenants decide.' };
  const d = rules.density;
  const area = (rules.basis ?? rules.lot).area;
  if (!d) return { value: rules.existing.homes, mark: 'confirmed' };
  const caps: number[] = [];
  const how: string[] = [];
  if (d.perAcre) {
    caps.push(Math.floor((area / ACRE) * d.perAcre));
    how.push(`${N(area)} ÷ 43,560 × ${d.perAcre} = ${((area / ACRE) * d.perAcre).toFixed(2)}, rounded down`);
  }
  if (d.minLotPerHome) {
    caps.push(Math.floor(area / d.minLotPerHome));
    how.push(`${N(area)} ÷ ${N(d.minLotPerHome)} per home`);
  }
  if (d.perBuilding) caps.push(d.perBuilding);
  let value = caps.length ? Math.min(...caps) : rules.existing.homes;
  if (d.lotOfRecord && value < 1) {
    value = 1;
    how.push('the lot of record rule guarantees one home');
  }
  return { value, mark: 'calculated', how: how.join('; ') };
}

export function envelope(rules: ZoningRules): Envelope {
  const ex = rules.existing;
  const homes = homesAllowed(rules);
  const cautions: string[] = [];
  if (rules.permission === 'conditional') cautions.push(`${rules.use === 'townhome' ? 'Townhomes' : 'This use'} need${rules.use === 'townhome' ? '' : 's'} a conditional use approval: the score shows what the rules allow, not a promise of approval.`);
  if (rules.overlays.historic) cautions.push(`${rules.overlays.historic.district}: exterior work needs a Certificate of Appropriateness.`);

  const adu = (() => {
    const a = rules.adu;
    if (!a || (a.attached === 'no' && a.detached === 'no')) return { allowed: false, type: null, size: null, approval: null };
    const type = a.attached === 'by-right' || (a.attached !== 'no' && a.detached === 'no') ? 'attached' as const : 'detached' as const;
    const size: Sourced<number> | null = a.maxSize
      ? a.maxSize.shareOfHome
        ? {
          value: Math.min(a.maxSize.cap, Math.round(a.maxSize.shareOfHome * ex.floorArea)),
          mark: 'calculated',
          how: `Lesser of ${N(a.maxSize.cap)} ft² and ${PCT(a.maxSize.shareOfHome)} of ${N(ex.floorArea)}`,
        }
        : { value: a.maxSize.cap, mark: 'confirmed', ...(a.maxSize.source ? { source: a.maxSize.source } : {}) }
      : null;
    return { allowed: true, type, size, approval: a.approval.label };
  })();

  if (!rules.code) {
    return {
      noZoning: true, scored: false, cautions, maxFloorArea: null, controlling: null, roomToGrow: null, underbuilt: null,
      buildable: null, footprint: null, homes, moreHomes: 0, adu,
      options: [{ kind: 'as-is', total: ex.floorArea, delta: 0, approval: 'None needed' }],
      approval: rules.approval,
    };
  }

  const area = (rules.basis ?? rules.lot).area;
  const L = rules.limits;
  const buildable = inside(rules);
  const candidates: { rule: LimitRule; value: number; label: string; how: string }[] = [];
  let footprint: Sourced<number> | null = null;

  if (L.hillside) {
    const h = L.hillside;
    const formula = cent(h.padShare * h.pad + h.slopeShare * h.slope);
    candidates.push({
      rule: 'hillside', value: Math.max(formula, h.guaranteed), label: 'Level pad formula',
      how: `${PCT(h.padShare)} × ${N(h.pad)} + ${PCT(h.slopeShare)} × ${N(h.slope)}${formula < h.guaranteed ? `, raised to the ${N(h.guaranteed)} ft² guarantee` : ''}`,
    });
  } else {
    if (L.far !== undefined) {
      candidates.push({ rule: 'far', value: cent(area * L.far), label: `Floor area ratio, ${L.far.toFixed(2)}`, how: `${N(area)} × ${L.far.toFixed(2)}` });
    }
    if (L.coverage !== undefined) {
      const byCoverage = cent(area * L.coverage);
      const fp = buildable ? Math.min(byCoverage, buildable.value.area) : byCoverage;
      footprint = {
        value: fp, mark: 'calculated',
        how: buildable && buildable.value.area < byCoverage
          ? `lower of ${N(buildable.value.area)} inside the setbacks and ${N(byCoverage)} coverage`
          : `${N(area)} × ${PCT(L.coverage)}`,
      };
      if (L.stories) {
        candidates.push({
          rule: 'coverage', value: cent(fp * L.stories), label: `Lot coverage, ${PCT(L.coverage)}`,
          how: `${N(fp)} × ${L.stories} stories`,
        });
      }
    }
  }

  // lowest wins; on a tie the floor area ratio is named, as the report does
  const order: LimitRule[] = ['far', 'hillside', 'coverage'];
  const top = candidates.reduce<(typeof candidates)[number] | null>((best, c) =>
    (!best || c.value < best.value || (c.value === best.value && order.indexOf(c.rule) < order.indexOf(best.rule)) ? c : best), null);

  const max = top ? Math.floor(top.value) : null;
  const room = max === null ? null : Math.max(max - ex.floorArea, 0);
  const approval = rules.approval.label;
  const moreHomes = Math.max(homes.value - ex.homes, 0);
  const options: BuildOption[] = [];
  if (max !== null && room) {
    if (rules.use !== 'townhome') options.push({ kind: 'add-on', total: max, delta: room, approval });
    if (rules.use !== 'townhome' && !rules.overlays.historic?.demolitionNeedsApproval) options.push({ kind: 'rebuild', total: max, delta: room, approval });
  }
  if (moreHomes > 0) options.push({ kind: 'more-homes', total: homes.value, delta: moreHomes, approval });
  if (adu.allowed && adu.size) options.push({ kind: 'adu', total: ex.floorArea + adu.size.value, delta: adu.size.value, approval: adu.approval ?? approval });
  options.push({ kind: 'as-is', total: ex.floorArea, delta: 0, approval: 'None needed' });

  return {
    noZoning: false,
    scored: max !== null,
    cautions,
    maxFloorArea: top && max !== null ? { value: max, mark: 'calculated', how: top.how } : null,
    controlling: top ? { rule: top.rule, label: top.label } : null,
    roomToGrow: room,
    underbuilt: max ? Math.max(0, 1 - ex.floorArea / max) : null,
    buildable,
    footprint,
    homes,
    moreHomes,
    adu,
    options,
    approval: rules.approval,
  };
}
