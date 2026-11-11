import type { Params, ProjectType, TypeId } from './types';

/**
 * The sample parcel. Real parcels overwrite the model inputs and keep the
 * cost/rate assumptions, so spread this first:
 *   const p = { ...DEFAULTS, ...parcel }
 *
 * Values marked PLACEHOLDER are not yet grounded in real data. They are load
 * bearing for the recommendation, so anything user-facing needs them replaced
 * or disclosed.
 */
export const DEFAULTS: Params = {
  addr: '1420 Elm Street',
  hood: 'Silver Lake',
  apn: '5560021020',
  zone: 'R1-1',
  city: 'Los Angeles',
  zip: '90026',
  bed: 3,
  bath: 2,
  garage: 2,
  lot: 6750,
  status: 'Listed',
  owner: 'Christopher Phinley',
  sold: 'Dec 9, 2024',
  lotW: 54,
  lotD: 125,
  setF: 20,
  setS: 5,
  setR: 15,
  lat: 34.0866,
  lon: -118.27,
  ring: null,
  bldg: null,

  Ex: 1600,
  Aq: 575_000,
  Smax: 3400,
  Sbonus: 4600,      // PLACEHOLDER
  Snbhd: 2900,       // PLACEHOLDER
  Yr: 1985,
  C_RB: 720,

  /**
   * Two brakes on size, doing different jobs.
   *
   * C_SL is the general hedonic slope: buyers pay less per ft² as homes get
   * bigger, everywhere, always. 0.10 is about a 10% drop per 1,000 ft² added
   * at LA price levels. PLACEHOLDER.
   *
   * C_OVER only bites above the biggest home nearby. Past that line you are
   * the largest house on the block, out of your own comp set, and the market
   * discounts you for it. This is what stops the model recommending the legal
   * maximum on a lot where the legal maximum is out of scale with the street.
   * PLACEHOLDER.
   */
  C_SL: 0.1,
  C_OVER: 0.45,

  Hc: 290,
  Demo: 10,
  D_SOFT: 0.15,
  D_ACQ: 0.06,
  D_CARRY: 0.06,
  D_DISP: 0.06,
  m1: 16,
  m2: 17,
  m3: 21,
  profitGate: 75_000, // PLACEHOLDER
  step: 100,
};

/** Indexed by TypeId, so index 0 is deliberately unused. */
export const TYPES: Record<TypeId, ProjectType> = {
  1: {
    n: 'Light remodel and addition',
    short: 'Light remodel',
    plain: "Add space, plus light work on the house that's there",
    desc: 'You add square footage and lightly update the rest of the house. The existing structure stays.',
    rate: 0.25,
    q: 0.88,
    c: '#EFE4DF',
  },
  2: {
    n: 'Major remodel and addition',
    short: 'Major remodel',
    plain: "Add space, plus rebuild most of the house that's there",
    desc: 'You add square footage and rebuild more than half of the existing house. Costs jump because almost everything gets touched.',
    rate: 0.55,
    q: 0.97,
    c: '#D0AFA4',
  },
  3: {
    n: 'Teardown and rebuild',
    short: 'Teardown',
    plain: 'Take the house down and build new',
    desc: 'The existing house comes down and you build from scratch. Highest cost, longest timeline, best finished product.',
    rate: 0,
    q: 1,
    c: '#A87F70',
  },
};
