// Listing photos (12 Nov review: "a wider variety of property images … a more real
// life experience"). Daylight MLS-style shots in public/photos/l, generated for the
// prototype (fal, FLUX.2 pro): no real addresses or people. Each listing gets a gallery
// in the order a listing shows it: the front of the house, then living room, kitchen,
// bedroom, bathroom and a yard or dining room, picked per listing (seeded, so a home
// always shows the same photos). The exterior suits the home:
//  - a vacant lot shows an empty lot;
//  - outside California, homes from elsewhere in the US (brick, colonial, desert…);
//  - from ~$3m, the luxury set (Beverly Hills villas, modern estates, the old dusk shots);
//  - otherwise Los Angeles styles (Spanish, Craftsman, mid-century, ranch, duplex…).
import { hashStr, rng } from "./geo";

const P = (n: string) => `/photos/l/${n}.jpg`;
const r = (a: number, b: number, pre: string) => Array.from({ length: b - a + 1 }, (_, i) => P(`${pre}-${String(a + i).padStart(2, "0")}`));

const LA = [...r(0, 3, "ext"), ...r(5, 13, "ext"), ...r(15, 17, "ext"), ...r(26, 27, "ext")];
const LUXURY = [P("ext-04"), P("ext-14"), P("ext-28"), P("ext-15"), P("ext-13"), P("ext-05"),
  ...["a", "c", "d", "g", "h"].map(c => `/photos/prop-${c}.jpg`), "/photos/hero-property.jpg"];
const ELSEWHERE = r(19, 25, "ext");
const VACANT = [P("ext-18")];
const KITCHEN = r(1, 5, "int"), LIVING = r(6, 10, "int"), BED = r(11, 13, "int"), BATH = r(14, 16, "int");
const LAST = [P("int-17"), ...r(18, 21, "int"), P("int-22")];

/** All exteriors, for places that only need a house front (saved-search thumbnails). */
export const EXTERIORS = [...LA, ...LUXURY.slice(0, 6), ...ELSEWHERE];

export function photosFor(seed: string, o: { price: number; lng: number; lat: number; vacant?: boolean }): string[] {
  const R = rng(hashStr("photos:" + seed));
  const pick = (a: string[]) => a[Math.floor(R() * a.length)];
  // California, roughly: west of the Colorado River and south of Oregon.
  const ca = o.lng < -114.1 && o.lat < 42 && o.lat > 32.4;
  const front = o.vacant ? pick(VACANT) : !ca ? pick(ELSEWHERE) : o.price >= 3e6 ? pick(LUXURY) : pick(LA);
  if (o.vacant) return [front];
  return [front, pick(LIVING), pick(KITCHEN), pick(BED), pick(BATH), pick(LAST)];
}
