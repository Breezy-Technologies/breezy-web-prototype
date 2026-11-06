"use client";
import { useEffect, useRef, useState } from "react";
import { MapOverlay } from "../map/Overlay";
import { useMapCtx } from "../map/MapProvider";
import { Listing, heatColor, heatValue, makeListings } from "@/lib/fake";
import { config, hasRegrid, isLiveMap } from "@/lib/config";
import { OwnerRow, QeRow } from "./HoverCard";

export type ParcelHit = { key: string; ring: [number, number][]; cx: number; cy: number; addr: string; listing: Listing };

// Hovering a parcel (zoom ≥ 15.4) lifts it off the map as a solid slab. With the
// heat map on the slab keeps the parcel's heat colour; otherwise it's neutral.
export function ParcelLift({ suppressCard, onOpen, selected }: { suppressCard: boolean; onOpen: (p: ParcelHit) => void; selected: ParcelHit | null }) {
  const { map, tick, heat, mode } = useMapCtx();
  const [hit, setHit] = useState<ParcelHit | null>(null);
  const keyRef = useRef("");
  const satUrls = useRef(new Map<string, string>()); // parcel key -> satellite image URL (fetched once per parcel)

  useEffect(() => {
    if (!map) return;
    const move = (e: any) => {
      if (map.getZoom() < 15.4 || !map.getLayer("bz-par-fill")) { if (keyRef.current) { keyRef.current = ""; setHit(null); } return; }
      const f = map.queryRenderedFeatures(e.point, { layers: ["bz-par-fill"] })[0];
      if (!f || f.geometry.type !== "Polygon") { if (keyRef.current) { keyRef.current = ""; setHit(null); } return; }
      const props: any = f.properties || {};
      const key = String(f.id ?? props.ll_uuid ?? props.pid ?? props.parcelnumb ?? JSON.stringify(f.geometry.coordinates[0][0]));
      if (key === keyRef.current) return;
      keyRef.current = key;
      const ring = (f.geometry.coordinates[0] as [number, number][]);
      const cx = ring.reduce((a, p) => a + p[0], 0) / ring.length, cy = ring.reduce((a, p) => a + p[1], 0) / ring.length;
      const addr = props.address || props.headline || props.saddress || "";
      const l = makeListings("parcel:" + key, [cx, cy], [cx - 1e-5, cy - 1e-5, cx + 1e-5, cy + 1e-5], null, 1, "")[0];
      if (addr) l.addr = String(addr);
      if (props.owner) l.owner = { ...l.owner, name: String(props.owner), ini: String(props.owner).split(" ").filter((w: string) => /^[A-Z]/.test(w)).slice(0, 2).map((w: string) => w[0]).join("") };
      setHit({ key, ring, cx, cy, addr: l.addr, listing: l });
    };
    const leave = () => { keyRef.current = ""; setHit(null); };
    const click = () => { if (keyRef.current && hitRef.current) onOpenRef.current(hitRef.current); };
    map.on("mousemove", move);
    map.on("mouseout", leave);
    map.on("click", click);
    return () => { map.off("mousemove", move); map.off("mouseout", leave); map.off("click", click); };
  }, [map]);
  const hitRef = useRef(hit); hitRef.current = hit;
  const onOpenRef = useRef(onOpen); onOpenRef.current = onOpen;

  const show = hit || selected;
  if (!map || !show || map.getZoom() < 15.4) return null;
  void tick;
  const el = map.getContainer(), W = el.clientWidth, H = el.clientHeight;
  const q = show.ring.map(ll => map.project(ll));
  const pts = q.map(v => `${v.x.toFixed(1)},${v.y.toFixed(1)}`).join(" ");
  const sat = mode === "satellite";
  const hc = heat !== "none" && !sat ? heatColor(heat, heatValue(heat, show.cx, show.cy)) : null;
  const hv = hc ? hc.match(/[\d.]+/g)!.map(Number) : null;
  const shade = (c: number[], f: number) => `rgb(${c.slice(0, 3).map(v => Math.round(v * f)).join(",")})`;
  const sideC = sat ? "rgb(122,112,100)" : hv ? shade(hv, 0.8) : "rgb(212,200,192)";
  const topC = sat ? "rgb(246,243,238)" : hc || "rgb(253,251,248)";
  // Satellite: the slab top is the parcel's own satellite imagery, as if that
  // patch of ground were lifted up (review feedback). A Mapbox Static Images
  // request for the parcel's bbox, sized to its on-screen pixels so the
  // Mercator extent matches exactly; placed by projecting the bbox each frame.
  const clipId = show.key.replace(/[^a-zA-Z0-9_-]/g, "");
  let satTop: { url: string; x: number; y: number; w: number; h: number } | null = null;
  if (sat && isLiveMap()) {
    const lngs = show.ring.map(p => p[0]), lats = show.ring.map(p => p[1]);
    const bw = Math.min(...lngs), be = Math.max(...lngs), bs = Math.min(...lats), bn = Math.max(...lats);
    const nw = map.project([bw, bn]), se = map.project([be, bs]);
    const w = se.x - nw.x, h = se.y - nw.y;
    if (w > 2 && h > 2) {
      let url = satUrls.current.get(show.key);
      if (!url) {
        const k = Math.min(1, 1280 / Math.max(w, h));
        url = `https://api.mapbox.com/styles/v1/mapbox/satellite-v9/static/[${bw},${bs},${be},${bn}]/${Math.max(1, Math.round(w * k))}x${Math.max(1, Math.round(h * k))}@2x?access_token=${config.mapboxToken}&attribution=false&logo=false`;
        satUrls.current.set(show.key, url);
      }
      satTop = { url, x: nw.x, y: nw.y, w, h };
    }
  }
  const edgeC = sat ? "rgb(255,209,41)" : "rgba(17,16,16,.75)";
  const hole = `M0,0H${W}V${H}H0Z M${q.map(v => `${v.x.toFixed(1)},${v.y.toFixed(1)}`).join(" L")}Z`;
  const top = Math.min(...q.map(v => v.y)), bot = Math.max(...q.map(v => v.y)), cx = q.reduce((a, v) => a + v.x, 0) / q.length;
  const num = (show.addr.match(/^\d+/) || [""])[0];
  const fs = Math.max(10, Math.min(14, 8 + (map.getZoom() - 15.4) * 3));
  const ccy = q.reduce((a, v) => a + v.y, 0) / q.length;
  const showCard = hit && !suppressCard && !selected;
  const CH = 150, below = top - CH < 124 && bot + 16 + CH < H - 12;
  return (
    <MapOverlay>
      <svg width={W} height={H} style={{ position: "absolute", inset: 0, zIndex: 45, pointerEvents: "none" }} key={show.key}>
        <defs><filter id="bzLiftBlur" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="7" /></filter></defs>
        {/* Light fade around the lifted parcel so the rest of the map, neighbouring parcels and labels stay readable (review feedback).
            The alpha lives in the fill colour: the fadeIn animation ends at CSS opacity 1, which would override an opacity attribute. */}
        {sat ? <path d={hole} fill="rgba(8,10,12,.2)" fillRule="evenodd" style={{ animation: "fadeIn .3s ease both" }} />
          : <path d={hole} fill="rgba(253,251,248,.22)" fillRule="evenodd" style={{ animation: "fadeIn .3s ease both" }} />}
        <polygon points={pts} fill={sat ? "rgba(0,0,0,.6)" : "rgba(58,42,38,.4)"} filter="url(#bzLiftBlur)" transform="translate(5 9)" style={{ animation: "fadeIn .3s ease both" }} />
        {Array.from({ length: 9 }, (_, k) => <polygon key={k} points={pts} fill={sideC} stroke={sideC} strokeWidth={1} strokeLinejoin="round" style={{ ["--l" as any]: `${-(k + 1)}px`, animation: "liftUp .3s cubic-bezier(.2,.8,.2,1) both" }} />)}
        <g style={{ ["--l" as any]: "-10px", animation: "liftUp .3s cubic-bezier(.2,.8,.2,1) both" }}>
          <polygon points={pts} fill={topC} stroke={edgeC} strokeWidth={sat ? 2.5 : 1.6} strokeLinejoin="round" />
          {satTop && (
            <>
              <clipPath id={`bzTop-${clipId}`}><polygon points={pts} /></clipPath>
              <image href={satTop.url} x={satTop.x} y={satTop.y} width={satTop.w} height={satTop.h} preserveAspectRatio="none" clipPath={`url(#bzTop-${clipId})`} />
              <polygon points={pts} fill="none" stroke={edgeC} strokeWidth={2.5} strokeLinejoin="round" />
            </>
          )}
          {num && <text x={cx} y={ccy} textAnchor="middle" dominantBaseline="central" fontFamily="Akkurat LL, sans-serif" fontWeight={700} fontSize={fs} fill="rgb(18,18,18)" stroke="rgba(255,255,255,.95)" strokeWidth={3} paintOrder="stroke">{num}</text>}
        </g>
        {/* The parcel's real outline on the ground stays visible above the lifted slab (review feedback). */}
        <polygon points={pts} fill="none" stroke={sat ? "rgba(255,209,41,.9)" : "rgba(18,18,18,.6)"} strokeWidth={1.2} strokeDasharray="4 3" strokeLinejoin="round" style={{ animation: "fadeIn .3s ease both" }} />
      </svg>
      {showCard && (
        <div style={{ position: "absolute", left: Math.max(146, Math.min(W - 146, cx)), top: below ? bot + 16 : Math.max(124 + CH, top - 12), transform: `translate(-50%,${below ? "0" : "-100%"})`, width: 268, display: "flex", flexDirection: "column", gap: 10, padding: 12, borderRadius: 18, background: "var(--paper)", boxShadow: "0 14px 34px rgba(30,18,12,.2),0 0 0 .5px rgba(13,12,12,.08)", zIndex: 60, pointerEvents: "none", animation: "hvPop .2s cubic-bezier(.2,.8,.2,1) both" }}>
          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 8 }}>
            <span style={{ font: "700 14px/19px var(--font-sans)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{hit!.addr}</span>
            <span style={{ flex: "none", font: "400 11px/16px var(--font-sans)", color: "rgb(98,90,89)" }}>{hasRegrid() ? "Parcel" : "Off market"}</span>
          </div>
          <span style={{ marginTop: -6, font: "400 12px/16px var(--font-sans)", color: "rgb(98,90,89)" }}>{hit!.listing.beds} Bed · {hit!.listing.lotAc} ac · Built {hit!.listing.built}</span>
          <OwnerRow l={hit!.listing} />
          {!hit!.listing.noQe && <QeRow l={hit!.listing} cta="Click for comps" />}
        </div>
      )}
    </MapOverlay>
  );
}
