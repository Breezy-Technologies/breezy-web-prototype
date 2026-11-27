import type { Params } from '../types';
import type { Envelope, ZoningRules } from './types';

/**
 * PLACEHOLDER. What an approval costs beyond the building permit:
 * application fees, notices and the professionals who prepare and present
 * it. Neither the spreadsheet, the API doc nor the artifact gives a figure.
 */
export const APPROVAL_COST = { conditional: 7_500, historic: 2_500 } as const;

/**
 * PLACEHOLDER. What the terrain adds (ROI-V2.md, phase 10, second set):
 * a geology and soils report on a hillside lot, raising a home above the
 * flood level outside Zone X, and sprinklers in every new home in a very
 * high fire hazard zone (California Residential Code), per ft².
 */
export const TERRAIN_COST = { hillsideStudy: 12_000, floodElevation: 25_000, sprinklersPsf: 4 } as const;

/** Zone X (or none on record) is outside the floodplain. */
const inFloodplain = (zone: string) => !/^(X|none|)$/i.test(zone.trim());

/** A hearing, not a permit: the only approvals that add months on top of the model's entitlement time. */
const isHearing = (label: string) => /Planning Board|conditional/i.test(label);

/**
 * What the ROI model needs from the zoning layer (ROI-V2.md, phase 10):
 *
 * - **Smax**, the ceiling, is the maximum floor area the controlling limit
 *   allows. Where there is none (no zoning code, or a townhome scored on its
 *   whole development, which one unit cannot build), today's size.
 * - **adus**: one ADU at the allowed size; none where no ADU is allowed. An
 *   ADU allowed with no size on record keeps the model's two sizes.
 * - **Approval**: a hearing adds its months (the high end of the range) and
 *   its cost to an addition or a rebuild; an ADU that needs one pays its own.
 *   A by-right building permit adds nothing, as the model's months already
 *   include entitlement.
 * - **noTeardown** where the house may not come down (historic).
 * - **Terrain**: a hillside study and flood elevation join the approval's
 *   cost on an addition or a rebuild; a very high fire hazard zone prices
 *   sprinklers into every rebuild (rebuildPsf).
 * - **Units**: a duplex is priced as one lot, both homes together; a
 *   townhome unit has no room of its own to grow (the development's extra
 *   homes are the association's, not the owner's).
 */
export function zoningParams(rules: ZoningRules, env: Envelope, Ex: number): Partial<Params> {
  const max = rules.basis ? null : env.maxFloorArea?.value ?? null;
  const ceiling = max ?? Ex;
  const historic = !!rules.overlays.historic;
  const hearing = rules.permission === 'conditional' || isHearing(rules.approval.label);
  const terrain = (rules.overlays.hillside ? TERRAIN_COST.hillsideStudy : 0)
    + (inFloodplain(rules.overlays.flood) ? TERRAIN_COST.floodElevation : 0);
  const cost = (hearing ? APPROVAL_COST.conditional : 0) + (historic ? APPROVAL_COST.historic : 0) + terrain;
  const fire = !!rules.overlays.fire && /very high/i.test(rules.overlays.fire);

  const adu = rules.adu;
  const aduHearing = !!adu && isHearing(adu.approval.label);
  const aduCost = (aduHearing ? APPROVAL_COST.conditional : 0) + (historic && adu?.review ? APPROVAL_COST.historic : 0);

  return {
    Smax: ceiling,
    Sbonus: ceiling,
    adus: env.adu.allowed ? (env.adu.size ? [env.adu.size.value] : undefined) : [],
    mApproval: hearing ? rules.approval.months?.[1] ?? 0 : 0,
    approvalCost: cost,
    mAdu: aduHearing ? adu.approval.months?.[1] ?? 0 : 0,
    aduApprovalCost: aduCost,
    ...(rules.overlays.historic?.demolitionNeedsApproval ? { noTeardown: true } : {}),
    ...(fire ? { rebuildPsf: TERRAIN_COST.sprinklersPsf } : {}),
  };
}
