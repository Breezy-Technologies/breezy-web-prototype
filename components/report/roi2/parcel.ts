// Pedro's v2 report reads a `Parcel` (underbuilt-roi src/mocks/parcels.ts): the model's
// inputs plus images and, here, the neighbourhood figures his API serves. Ours is built
// from a Breezy Listing in UpsideReport (lib/roi/property.ts for the inputs, the
// renovation comps for the comp photos, lib/comps hoodStats for the neighbourhood).
import type { Params } from "@/lib/roi";

export type HoodFigures = {
  /** The ZIP (or neighbourhood) the property sits in, its rank and how many are tracked. */
  name: string; rank: number; tracked: number;
  resalePsf: number; dom: number; compSize: number; underbuiltShare: number;
};

export interface Parcel extends Params {
  images: { hero: string; plan?: string; comps: string[] };
  hoodData: HoodFigures;
}
