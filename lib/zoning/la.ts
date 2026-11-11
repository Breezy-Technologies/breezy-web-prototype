// City of Los Angeles zoning rules for the Build guidelines report, by zone.
//
// The recorded report (public/ub-report/) is a sample for a New Jersey township.
// This module says what Los Angeles and California law say instead, for the lot's
// own zone (Pedro's lots carry their zone, e.g. "R2-1VL"; county parcels get one
// from their use): the zone's section of the LA Municipal Code (LAMC), uses,
// height by height district, yards, density, parking, and the state ADU / JADU /
// SB 9 rules that override local zoning.
//
// These are plain-English summaries, not quotations, and they leave out the
// details that need the parcel's overlays (hillside area, HPOZ, specific plans,
// Q / D conditions). The report says so and points to ZIMAS, the city's parcel
// lookup. Swap for the Underbuilt service's rules when it covers Los Angeles.
import type { Site } from "@/lib/roi";

export type ZoneClass = "R1" | "R2" | "RD" | "R3" | "R4" | "C" | "PF";
export type UseRow = [label: string, cite: string, mine?: boolean];
export type UseGroup = [heading: string, rows: UseRow[]];
export type LaZone = {
  code: string; cls: ZoneClass; name: string; section: string; intent: string;
  /** Height limit (pitched roof / flat roof), ft, and stories as text. */
  height: number; flat: number; stories: string; heightRule: string; heightCite: string;
  /** Floor area limit as a ratio of lot area (R1: residential floor area). */
  far: number; farLabel: string; farCite: string;
  yards: { F: number; Sd: number; Rr: number }; yardCite: string;
  homes: number; perHome: number | null; densityRule: string; densityCite: string;
  parking: string;
  uses: { permitted: UseGroup[]; conditional: UseGroup[]; notAllowed: UseGroup[] };
  /** The rule that limits the build, in a few words. */
  limiter: string;
};

export const LAMC_URL = "https://codelibrary.amlegal.com/codes/los_angeles/latest/lamc/0-0-0-1";
export const ZIMAS_URL = "https://zimas.lacity.org/";
const ADU = "§12.22 A.33", CUP = "§12.24", PARK = "§12.21 A.4", YARDS = "§12.22 C.20", DEFS = "§12.03", HD = "§12.21.1";

const fmt = (n: number) => Math.round(n).toLocaleString("en-US");

/** Height district from the zone code's suffix: 1 (none), 1L, 1VL, 1XL. */
function heightDistrict(code: string) {
  const hd = (code.match(/-(1(?:XL|VL|SS|L)?)\b/) || [])[1] || "1";
  return hd === "1XL" ? { h: 30, s: "2 stories", t: "Height District 1XL" }
    : hd === "1VL" ? { h: 45, s: "3 stories", t: "Height District 1VL" }
    : hd === "1L" ? { h: 75, s: "6 stories", t: "Height District 1L" }
    : { h: 0, s: "No story limit", t: "Height District 1" };
}

export function laZone(site: Site): LaZone {
  const code = site.zone.replace(/^(\[[A-Z]\]|\([A-Z]\))+/g, "") || "R1-1";
  const base = code.split("-")[0];
  const cls: ZoneClass = /^R1|^RS|^RE/.test(base) ? "R1" : /^R2/.test(base) ? "R2" : /^RD/.test(base) ? "RD" : /^R3/.test(base) ? "R3"
    : /^R[45]/.test(base) ? "R4" : /^(PF|P$|OS)/.test(base) ? "PF" : "C";
  const hd = heightDistrict(code);
  const lot = site.lot;
  const sb9: UseRow = ["Second home or lot split (SB 9)", "Gov. Code §65852.21"];
  const adu: UseRow[] = [["Accessory dwelling unit (ADU)", ADU], ["Junior ADU, inside the house", ADU]];
  const acc: UseRow[] = [["Home occupation", "§12.22 A.12"], ["Garage, shed, pool", YARDS]];
  const cond: UseGroup = ["Conditional use · Zoning Administrator hearing", [["Place of worship", CUP], ["School", CUP], ["Child care, 9 or more", CUP]]];

  if (cls === "R1") {
    const far = 0.45;
    return {
      code, cls, name: "One-Family Zone", section: "§12.08",
      intent: "One single-family home per lot, with an ADU and a junior ADU allowed by state law.",
      height: 33, flat: 28, stories: "No story limit", heightRule: "33 ft with a pitched roof (25% slope or more), 28 ft with a flatter roof, measured from grade.", heightCite: "§12.08 C.5",
      far, farLabel: "Residential floor area 0.45 × lot", farCite: "§12.08 C.5",
      yards: { F: 20, Sd: 5, Rr: 15 }, yardCite: "§12.08 C",
      homes: 1, perHome: null, densityRule: "One home per lot", densityCite: "§12.08 A",
      parking: "2 covered spaces",
      uses: {
        permitted: [["By right", [["Single-family home", "§12.08 A", true], ...adu]], ["Ministerial under state law", [sb9]], ["Accessory to the home", acc]],
        conditional: [cond],
        notAllowed: [["Prohibited", [["Apartments (3 or more homes)", "§12.08 A"], ["Commercial use", "§12.08 A"], ["Short-term rental of an ADU", ADU]]]],
      },
      limiter: "Residential floor area",
    };
  }
  const yards = cls === "C" ? { F: 0, Sd: 0, Rr: 0 } : cls === "R2" ? { F: 20, Sd: 5, Rr: 15 } : { F: 15, Sd: 5, Rr: 15 };
  const perHome = cls === "R2" ? 2500 : cls === "RD" ? Math.round(parseFloat(base.slice(2)) * 1000) || 1500 : cls === "R3" ? 800 : cls === "PF" ? null : 400;
  const homes = perHome ? Math.max(1, cls === "R2" ? Math.min(2, Math.floor(lot / perHome)) : Math.floor(lot / perHome)) : 0;
  const section = { R2: "§12.09", RD: "§12.09.1", R3: "§12.10", R4: "§12.11", C: "§12.14", PF: "§12.04.09" }[cls];
  const name = { R2: "Two-Family Zone", RD: "Restricted Density Multiple Dwelling Zone", R3: "Multiple Dwelling Zone", R4: "Multiple Dwelling Zone", C: "Commercial Zone", PF: "Public Facilities Zone" }[cls];
  const multi: UseRow = cls === "R2" ? ["Two-family home (duplex)", `${section} A`, true] : [`Apartments, up to ${homes} homes`, `${section} A`, true];
  return {
    code, cls, name, section,
    intent: cls === "R2" ? "Single-family homes and duplexes." : cls === "C" ? "Shops, offices and services; homes allowed at R4 density." : cls === "PF" ? "Public facilities; homes aren't a permitted use." : "Apartments and single-family homes, at the density the lot area allows.",
    height: hd.h, flat: hd.h, stories: hd.s, heightRule: hd.h ? `${hd.h} ft and ${hd.s} (${hd.t}).` : "No height limit in Height District 1; floor area is capped at 3 × the buildable area.", heightCite: HD,
    far: 3, farLabel: "Floor area 3 × buildable area", farCite: HD,
    yards, yardCite: `${section} C`,
    homes, perHome, densityRule: perHome ? `One home per ${fmt(perHome)} ft² of lot` : "No homes", densityCite: `${section} C`,
    parking: cls === "R2" ? "2 spaces per home" : "1 to 2 spaces per home, by size",
    uses: {
      permitted: cls === "PF" ? [["By right", [["Public facility", section]]]]
        : [["By right", [["Single-family home", `${section} A`, cls === "R2" && homes < 2], multi, ...adu]], ["Accessory to the home", acc]],
      conditional: [cond],
      notAllowed: [["Prohibited", [["Short-term rental of an ADU", ADU], ...(cls === "C" ? [] : [["Commercial use", `${section} A`] as UseRow])]]],
    },
    limiter: "Floor area",
  };
}

/** Sample text → Los Angeles text, as [sample, ours] pairs (whole text nodes). */
export function laPairs(site: Site, z: LaZone): [string, string][] {
  const { F, Sd, Rr } = z.yards;
  const Smax = Math.round(site.Smax), left = Math.max(0, Smax - site.Ex);
  const r2 = (n: number) => (Math.round(n * 100) / 100).toString();
  const ratio = r2(Smax / Math.max(site.lot, 1));
  const zn = z.code, dn = `${zn} ${z.name}`;
  const heightTxt = z.height ? `${z.height} ft${z.flat !== z.height ? ` (${z.flat} ft flat roof)` : ""}` : "No limit";
  const hs = z.height ? `${z.height} ft, ${z.stories.toLowerCase()}` : "No height limit";
  return [
    // the verified banner and the report's provenance: nothing here is architect-verified yet
    ["Our team of architects have reviewed and verified this data", "Summarised from the LA Municipal Code and California ADU law. Not yet reviewed by our architects"],
    ["Verified by the Underbuilt Data Team on Oct 8, 2026", "Rules summarised for Los Angeles"],
    ["Every rule was checked against Larchmere Township Code Ch. 245 as amended in Mar 2026. Rules that depend on how the township applies the code are marked Advisory, with the question to ask.",
      `Each rule is a plain-English summary of the LA Municipal Code (Chapter 1, Planning and Zoning) and state ADU law for ${zn}. Overlays can change them: hillside area, historic zone (HPOZ), specific plans and the zone's Q or D conditions. Look the parcel up on ZIMAS before you rely on a rule.`],
    ["rules confirmed", "rules summarised"], ["to confirm with township", "to check on ZIMAS"],
    ["The drawing shows why: the house can cover only 20% of the lot, and the setbacks leave far more room than that. 37 of 41 rules confirmed against Ch. 245; 4 to check with the township.",
      `The drawing shows the yards: ${F} ft front, ${Sd} ft sides, ${Rr} ft rear. ${z.limiter} caps the home at ${fmt(Smax)} ft².`],
    ["Confirmed by the Underbuilt Data Team on Oct 8, 2026, against the code as amended Mar 2026", "Summary of the LA Municipal Code, not a quotation"],
    ["Sample excerpt written for this fictional report. Live reports quote the adopted ordinance.", "Check the current code and the parcel's overlays on ZIMAS before relying on it."],
    ["Open in the township code", "Open the LA Municipal Code"],
    ["Taken directly from the township zoning code or public records, and checked by our architects.", "Summarised from the LA Municipal Code, state law or public records."],
    ["The code does not settle this clearly. Treat it as guidance and confirm with the township before you rely on it.", "Depends on the parcel's overlays. Check ZIMAS or ask LA City Planning."],
    ["Development potential is calculated from the zoning ordinance, assessor records, and GIS data listed above. This report is informational and is not legal, architectural, or engineering advice. Confirm with the Larchmere Township Zoning Office before designing or financing. This sample uses fictional data. Report version 3.",
      "Development potential is estimated from LA County assessor records and a summary of the LA Municipal Code and state law. This report is informational and is not legal, architectural, or engineering advice. Confirm with LA City Planning (and the parcel's ZIMAS record) before designing or financing."],
    ["A citation to the township zoning code. §245-14(C) means Chapter 245 (Zoning), section 14, paragraph C. Every rule in this report cites the section it comes from: select any § reference to read that section.",
      "A citation to the Los Angeles Municipal Code. §12.08 C.5 means Chapter 1, Article 2, section 12.08 (the R1 zone), subsection C, paragraph 5. Select any § reference to read a summary of that section."],
    // district
    ["What the R-40 district allows on this lot.", `What the ${zn} zone allows on this lot.`],
    ["R-40 Low Density Residential", dn], ["R-40 Low Density Residential: purpose", `${dn}: purpose`],
    ["Low-density single-family neighborhoods on large lots with open, landscaped yards.", z.intent],
    ["The R-40 district preserves low-density single-family neighborhoods on large lots with open, landscaped yards.", z.intent],
    ["Larchmere Township Code · Ch. 245 Zoning", "LA Municipal Code · Ch. 1 Planning and Zoning"],
    ["Larchmere Township Code, Ch. 245 (amended Mar 2026)", "LA Municipal Code, Ch. 1, Art. 2 (Zoning)"],
    ["Larchmere Township Code, Ch. 245", `LA Municipal Code ${z.section}`], ["Larchmere Township Code, Ch. 248", "LA Municipal Code §12.40 (landscape)"],
    ["Official Larchmere Township zoning map", "ZIMAS (LA City zoning map)"],
    ["Water, sewer, flood, overlays, environmental layers, and what the R-40 district allows.", `Water, sewer, flood, overlays, environmental layers, and what the ${zn} zone allows.`],
    ["How many homes this lot can hold, and which rule decides it. Multifamily standards appear only on reports for zones that allow two or more homes; R-40 does not.",
      `How many homes this lot can hold, and which rule decides it. ${z.homes > 1 ? `${zn} allows ${z.homes} homes on this lot.` : "State law adds an ADU, a junior ADU and, in R1, an SB 9 second home."}`],
    ["R-40 allows one single-family home per lot.", z.cls === "R1" ? "R1 allows one home per lot, plus an ADU and junior ADU (state law), or two homes under SB 9." : `${zn} allows ${z.homes} home${z.homes === 1 ? "" : "s"} on this lot.`],
    ["R-40 allows 1 home per acre and needs 40,000 ft² of lot per home. At 24,000 ft² this lot is below both, so the density math rounds to zero. The lot of record rule still guarantees one single-family home. An attached ADU does not count toward density.",
      z.perHome ? `${zn} allows one home per ${fmt(z.perHome)} ft² of lot. At ${fmt(site.lot)} ft² that is ${z.homes} home${z.homes === 1 ? "" : "s"}. ADUs and junior ADUs don't count toward density under state law.` : `${zn} allows one home per lot. ADUs and junior ADUs don't count toward density under state law.`],
    ["Density math alone rounds to zero on this lot. The lot of record rule guarantees one home.", z.perHome ? `${fmt(site.lot)} ÷ ${fmt(z.perHome)} ft² per home, rounded down.` : "One home per lot in R1."],
    ["Lowest of density (0), use table (1 per lot), and lot of record rule (1)", z.densityRule],
    ["Lot of record (§245-9)", `${z.densityRule} (${z.densityCite})`],
    ["1 home / acre, 40,000 ft² minimum lot, §245-14", `${z.densityRule}, 5,000 ft² minimum lot, ${z.densityCite}`],
    ["1 home / acre (Low Density Residential)", "Set by the community plan (Silver Lake–Echo Park–Elysian Valley)"], ["1 home / acre", z.densityRule],
    ["Not used in R-40", "Not used in LA zoning"], ["None in NJ", "ADU / JADU (state law); SB 9 in R1; density bonus for affordable homes"],
    // height, floor area, coverage
    ["35 ft, 2.5 stories", hs], ["No taller than 35 ft or 2.5 stories", `No taller than ${heightTxt}`],
    ["Measured to the roof midpoint. Flat roofs stop at 30 ft.", z.heightRule],
    ["Maximum height 35 ft, measured from average finished grade to the midpoint of a pitched roof, or 30 ft for a flat roof. Maximum 2.5 stories. Chimneys and cupolas may extend 5 ft above the limit.", z.heightRule + " Chimneys and roof equipment may rise above the limit within set allowances."],
    ["Height is measured from average finished grade to the midpoint of a pitched roof, so the peak can sit above 35 ft. A flat roof is capped at 30 ft and does not allow a half story, which lowers the maximum to 9,600 ft². Chimneys and cupolas may rise 5 ft above the limit.", z.heightRule],
    ["Peak may rise above 35 ft", z.cls === "R1" ? "Measured to the top of the roof" : "Measured to the top of the roof"],
    ["35 ft to roof midpoint", heightTxt], ["30 ft to top of flat roof", z.cls === "R1" ? `${z.flat} ft for a flat roof` : heightTxt],
    ["Pitched or flat; flat roofs max 30 ft", z.cls === "R1" ? `Pitched or flat; flat roofs max ${z.flat} ft` : "Pitched or flat"],
    ["No half story with a flat roof", z.cls === "R1" ? `Flat roof: ${z.flat} ft max` : "Same limit for any roof"],
    ["Half story (the .5 in 2.5 stories)", "Attic and lofts"], ["Up to 2.5", z.stories], ["4,800 + 4,800, no half story", `${fmt(Smax)} ft² of floor area`],
    ["Your current house uses 22% of that. Lot coverage is the rule that limits the build.", `Your current house uses ${Smax ? Math.round((100 * site.Ex) / Smax) : 0}% of that. ${z.limiter} is the rule that limits the build.`],
    ["The one rule that limits your build the most. Here, lot coverage.", `The one rule that limits your build the most. Here, ${z.limiter.toLowerCase()}.`],
    ["How much of the lot can the house cover?", "How much floor area can the house have?"],
    ["Roofed structures can cover 20% of the lot. That includes the garage and any covered porch. Pools, patios and driveways don’t count here, but they do count toward impervious surface. Today you use 1,980 ft², leaving 2,820 ft².",
      `${z.farLabel}: ${fmt(Smax)} ft² on this lot. Every floor counts, including most of an attached garage. Today the house has ${fmt(site.Ex)} ft², leaving ${fmt(left)} ft².`],
    ["20% from Township Code §245-14(C)", `${z.farLabel}, LAMC ${z.farCite}`],
    ["Buildings and roofed structures, including garages and covered porches, shall not cover more than 20% of the lot area.", z.cls === "R1" ? "R1 caps residential floor area at 45% of the lot area for a lot outside the hillside area; R1 variation zones and the hillside ordinance set other ratios." : "Floor area is capped at three times the buildable area in Height District 1."],
    ["No more than 4,800 ft² under roofs", `No more than ${fmt(Smax)} ft² of floor area`],
    ["House, garage, porches and sheds all count toward lot coverage.", "Every floor of the house counts, plus most attached garage space."],
    ["No separate cap; counts toward the 4,800 ft² coverage limit", "Within the yard rules; no separate cap"],
    ["No second home or duplex", z.cls === "R1" ? "No apartments" : "No more homes than the density allows"],
    // uses, permits, ADUs
    ["By right. A building permit is enough for the single family.", "By right. A building permit is enough for the home, an ADU and a junior ADU."],
    ["Planning Board hearing", "Zoning Administrator hearing"],
    ["Detached ADU only. About 3 to 4 months when required.", "Not needed for your plan. Only conditional uses (schools, places of worship) need one."],
    ["None. The lot is outside any historic district.", "Check ZIMAS for a historic zone (HPOZ). Angelino Heights, in Echo Park, is one."],
    ["Single-family home, additions within limits, attached ADU. Building permit only.", "Homes, additions within limits, ADUs and junior ADUs. Building permit only."],
    ["Detached ADU, bed and breakfast. Needs zoning officer or Planning Board approval.", "Schools, places of worship, larger child care. Needs a Zoning Administrator hearing."],
    ["The score and the 12,000 ft² maximum count only what you can build by right. Anything that needs a conditional or special use approval gets no max build score, because the outcome depends on a hearing.",
      `The score and the ${fmt(Smax)} ft² maximum count only what you can build by right. Anything that needs a conditional use hearing gets no max build score, because the outcome depends on the hearing.`],
    ["No detached ADU without approval", "No short-term rental of an ADU"],
    ["A detached ADU needs Planning Board conditional use approval first.", "ADUs must be rented for more than 30 days."],
    ["Plan 3 to 4 months for Planning Board approval if you want a detached ADU.", "Look the parcel up on ZIMAS for hillside, historic (HPOZ) or specific plan rules."],
    ["Yes. An addition and an attached ADU can share the 4,800 ft² footprint. The ADU can grow to 800 ft² once the house reaches 2,667 ft².",
      "Yes. State law lets an 800 ft² ADU be built even where the floor-area or coverage limits are used up, so an addition and an ADU can go together."],
    ["No statewide mandate", "Gov. Code §66314 and on; LAMC §12.22 A.33"],
    ["35 ft attached; 20 ft detached", "16 ft detached (18 ft near transit); attached up to 25 ft or the zone limit"],
    ["About 30 days for an attached ADU (zoning permit)", "Ministerial: the city must decide within 60 days of a complete application"],
    ["Not addressed in the township code", "Up to 500 ft² inside the house; the owner must live on site"],
    ["Cannot be sold separately from the home", "Not separately, unless the city adopts ADU condominiums (AB 1033)"],
    ["None for ADUs under 750 ft²", "None for ADUs under 750 ft² (state law)"],
    // parking, fences, projections
    ["2.5 spaces", z.parking], ["+0.5 space", "None"], ["Required for 4 bedrooms", "Required for the home"],
    ["A 4-bedroom home needs 2.5 spaces, and each added bedroom adds 0.5. An attached ADU needs 1 more. The driveway can be up to 20 ft wide, and half the front yard must stay planted, so parking can limit an addition before zoning does.",
      `${z.parking} for the home (LAMC ${PARK}). An ADU needs no parking within half a mile of public transit, and none when it replaces a garage. Within half a mile of a major transit stop no parking is required at all (AB 2097).`],
    ["Based on township zoning office practice. Confirm with the township when your plans rely on the garage to meet the requirement.", "Covered garage spaces count toward the requirement."],
    ["Whether garage spaces count: confirm with the township", "Garage spaces count toward the requirement"],
    ["Front-yard fences must stay 4 ft or lower.", "Front-yard fences and walls must stay 3½ ft or lower."],
    ["No front fence over 4 ft", "No front fence over 3½ ft"], ["4 ft maximum", "3½ ft maximum"], ["6 ft maximum", "8 ft maximum"],
    ["At least 4 ft tall, with a self-latching gate", "At least 5 ft tall, with a self-closing, self-latching gate"],
    ["Open, unroofed porches may extend up to 8 ft into a required front yard. Eaves may project 2 ft, steps 5 ft and bay windows 2 ft into any required yard.", "Porches, steps, eaves and similar features may project into required yards within the limits of LAMC §12.22 C.20."],
    ["May extend 8 ft into front setback", "May project into the front yard within §12.22 C.20 limits"],
    ["Eaves 2 ft; steps 5 ft; bay windows 2 ft", "Eaves, steps, bay windows: §12.22 C.20 limits"],
    // lot, site, sources
    ["No, preexisting undersized lot", site.lot >= 5000 ? "Yes" : "No, smaller than 5,000 ft²; a lot of record can still be built on"],
    ["40,000 ft²", "5,000 ft²"], ["150 ft", "50 ft"],
    ["35%", "No cap; stormwater (LID) rules apply"], ["Max impervious surface", "Paving and runoff"],
    ["No more than 35% paved", "Stormwater rules apply"], ["Driveways and patios count, and at least half the front yard stays planted.", "New paving over 500 ft² must manage its runoff (LA's Low Impact Development rules)."],
    ["X (outside floodplain)", "Check ZIMAS"], ["Do not apply", "Check ZIMAS: much of Silver Lake is a hillside area"],
    ["3.8%", "Not measured yet"], ["9.2%", "Not measured yet"], ["None (start above 15% slope)", "Hillside rules reduce floor area on steep lots"],
    ["Ocean Bay County Assessor", "LA County Assessor"], ["FEMA FIRM panel 34029C0312F", "FEMA flood maps, via ZIMAS"],
    ["NJ Residential Site Improvement Standards", "LA Municipal Code §12.21 A.4"],
    ["3 trees", "Not set for one home"], ["No, not for a single-family home", "No, not for one home"],
    ["Check title for subdivision covenants", "Check title for covenants (CC&Rs)"],
    ["Subdivision covenants can limit additions or second units even where zoning allows them.", "Private covenants can't block an ADU in California, but they can limit other additions."],
    ["Illustrative aerial for this sample. Live reports use licensed satellite imagery with the provider's attribution.", "Illustrative drawing. The lot's real outline is on the map."],
    // § citations: township sections → LAMC sections
    ["§245-12", z.section], ["§245-13(A)", `${z.section} A`], ["§245-13(B)", ADU], ["§245-13(C)", CUP], ["§245-13(D)", CUP], ["§245-13(E)", `${z.section} A`],
    ["§245-14(A) · R-40: area, bulk and yard standards · Yards (setbacks)", `${z.yardCite} · ${zn}: yards`],
    ["§245-14(A), porch §245-31", `${z.yardCite}, projections ${YARDS}`], ["§245-14(A)", z.yardCite], ["§245-14(B)(2)", HD], ["§245-14(B)", z.heightCite],
    ["§245-14(C)", z.farCite], ["§245-14(D)", "§64.72 (LID)"], ["§245-31", YARDS],
    ["§245-4 · Definitions", `${DEFS} · Definitions`], ["§245-4, definitions", `${DEFS}, definitions`], ["§245-4", DEFS],
    ["§245-9 · Lots of record", `${z.densityCite} · Density`], ["§245-9", z.densityCite],
    ["R-40: uses · Permitted uses", `${zn}: uses · Permitted uses`], ["R-40: uses · Accessory uses", `${zn}: accessory dwelling units`],
    ["R-40: uses · Conditional uses", "Conditional uses"], ["R-40: uses · Special exceptions", "Conditional uses"], ["R-40: uses · Prohibited uses", `${zn}: uses`],
    ["R-40: area, bulk and yard standards · Height", `${zn}: height`], ["R-40: area, bulk and yard standards · Lot coverage", `${zn}: floor area`],
    ["R-40: area, bulk and yard standards · Impervious surface", "Low Impact Development (stormwater)"], ["R-40: area, bulk and yard standards · Yards (setbacks)", `${zn}: yards`],
    // the modals' quoted code → summaries
    ["Single-family detached dwellings; family day care homes for up to 6 children; non-commercial agriculture.", z.cls === "R1" ? "One single-family dwelling per lot; small family child care; parks and playgrounds." : `${z.intent} Uses not listed for the zone are not permitted.`],
    ["Attached accessory dwelling units; minor home occupations; private garages, sheds and swimming pools.", "One ADU (attached or detached, up to 1,200 ft²) and one junior ADU (up to 500 ft², inside the house) on a lot with a single-family home; more on multifamily lots. Approved ministerially under state law."],
    ["Bed and breakfast with no more than 2 guest rooms, subject to review by the zoning officer.", "Schools, places of worship and similar uses may be allowed after a Zoning Administrator hearing."],
    ["Detached accessory dwelling units, houses of worship and schools, subject to Planning Board approval after a public hearing.", "Schools, places of worship and similar uses may be allowed after a Zoning Administrator hearing."],
    ["Two-family and multifamily dwellings, townhouses, and short-term rentals of less than 30 days.", z.cls === "R1" ? "Buildings with three or more homes, commercial uses, and renting an ADU for 30 days or less." : "Uses not listed for the zone, and renting an ADU for 30 days or less."],
    ["“Front yard 35 ft; each side yard 15 ft; rear yard 30 ft.”", `Front yard ${F} ft; side yards ${Sd} ft (more for taller buildings); rear yard ${Rr} ft.`],
    ["“A lot lawfully created and recorded before this chapter was adopted may be used for one single-family dwelling, even where it does not meet the current minimum lot area or width, provided every other standard of the district is met.”",
      z.perHome ? `One home per ${fmt(z.perHome)} ft² of lot area, rounded down; a legal lot can always hold one home.` : "One single-family dwelling per lot; a legal lot can always hold one home, even below today's minimum size."],
    ["“A lot lawfully created and recorded before this chapter was adopted may be used for one single-family dwelling, even where it does not meet the current minimum lot area or width, provided every other standard of the district is me",
      "A legal lot can always hold one home, even below today's minimum size."],
    ["““Half story”: a story under a pitched roof whose floor area is no more than 50% of the floor below, with knee walls no taller than 4 ft. “Story” excludes a basement whose floor above is 6 ft or less above grade.”",
      "Floor area counts every floor within the outside walls; a basement whose ceiling is no more than 3 ft above grade doesn't count."],
    ["“Half story”: a story under a pitched roof whose floor area is no more than 50% of the floor below, with knee walls no taller than 4 ft. “Story” excludes a basement whose floor above is 6 ft or less above grade.",
      "Floor area counts every floor within the outside walls; a basement whose ceiling is no more than 3 ft above grade doesn't count."],
    // remaining ratio wording
    ["24,000 × 20% = 4,800", `${fmt(site.lot)} × ${ratio} = ${fmt(Smax)}`],
    ["4,800 × 2.5 stories", `${fmt(site.lot)} × ${ratio}`],
  ];
}
