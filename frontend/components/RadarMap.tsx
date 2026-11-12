"use client";

import maplibregl, { type GeoJSONSource, type Map as MLMap, type MapGeoJSONFeature } from "maplibre-gl";
import { useEffect, useImperativeHandle, useRef, type Ref } from "react";
import type { FeatureCollection, LineString, Point } from "geojson";
import { NIGERIA_BOUNDS, STATUS, indexToUid } from "@/lib/data";

// Basemaps: OpenFreeMap (free, no key, no usage limits). Data © OpenStreetMap contributors (ODbL),
// tiles/schema © OpenMapTiles. Attribution is added by the style sources plus customAttribution below.
const STYLE = {
  dark: "https://tiles.openfreemap.org/styles/dark",
  light: "https://tiles.openfreemap.org/styles/positron",
};
const HEX = { ok: "#4C9F8B", review: "#E0A43A", field: "#E2574C", none: "#7A869C", accent: "#3FB8C9" };
const SURF = {
  dark: { bg: "#0F1114", water: "#15191E", raised: "#1E2227", text: "#E9E6DF" },
  light: { bg: "#F4F3EF", water: "#C9DDEA", raised: "#FFFFFF", text: "#181816" },
};

export type PointProps = { i: number; b: number };
export type Pad = { left?: number; right?: number; top?: number; bottom?: number };
export interface RadarMapHandle {
  flyTo: (lon: number, lat: number, zoom: number, opts?: Pad & { duration?: number }) => void;
  fitBounds: (b: [[number, number], [number, number]], opts?: Pad) => void;
  fitNigeria: (opts?: Pad) => void;
  zoomBy: (d: number) => void;
}
interface Props {
  points: FeatureCollection<Point, PointProps>;
  links: FeatureCollection<LineString>;
  selected: [number, number] | null;
  reducedMotion: boolean;
  onSelect: (i: number) => void;
  onReady?: () => void;
  pad: Pad;
  apiRef: Ref<RadarMapHandle>;
}

export default function RadarMap(props: Props) {
  const box = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MLMap | null>(null);
  const live = useRef(props);
  live.current = props;
  const theme = useRef<"dark" | "light">("dark");

  const duration = (d: number) => (live.current.reducedMotion ? 0 : d);
  const padding = (o?: Pad) => {
    const p = { ...live.current.pad, ...o };
    return { top: 40 + (p.top ?? 0), left: 40 + (p.left ?? 0), right: 40 + (p.right ?? 0), bottom: 40 + (p.bottom ?? 0) };
  };

  useImperativeHandle(props.apiRef, () => ({
    flyTo(lon, lat, zoom, o) {
      const m = mapRef.current;
      if (!m) return;
      const opts = { center: [lon, lat] as [number, number], zoom, padding: padding(o) };
      if (live.current.reducedMotion) m.jumpTo(opts);
      else m.flyTo({ ...opts, duration: o?.duration ?? 4200, curve: 1.5, essential: false });
    },
    fitBounds(b, o) {
      mapRef.current?.fitBounds(b, { padding: padding(o), duration: duration(1200), maxZoom: 12 });
    },
    fitNigeria(o) {
      mapRef.current?.fitBounds(NIGERIA_BOUNDS, { padding: padding(o), duration: duration(1200) });
    },
    zoomBy(d) {
      const m = mapRef.current;
      if (m) m.easeTo({ zoom: m.getZoom() + d, duration: duration(300) });
    },
  }));

  useEffect(() => {
    if (!box.current) return;
    theme.current = document.documentElement.dataset.theme === "dark" ? "dark" : "light";
    const map = new maplibregl.Map({
      container: box.current,
      style: STYLE[theme.current],
      bounds: NIGERIA_BOUNDS,
      fitBoundsOptions: { padding: { ...padding(), top: padding().top + 60 } },
      minZoom: 1,
      maxZoom: 17,
      attributionControl: false,
      dragRotate: false,
      pitchWithRotate: false,
    });
    mapRef.current = map;
    map.touchZoomRotate.disableRotation();
    map.addControl(new maplibregl.AttributionControl({
      compact: true,
      customAttribution: '<a href="https://openfreemap.org" target="_blank" rel="noopener">OpenFreeMap</a> · Boundaries <a href="https://www.geoboundaries.org" target="_blank" rel="noopener">geoBoundaries</a> CC BY 4.0',
    }), "bottom-right");

    const tip = new maplibregl.Popup({ closeButton: false, closeOnClick: false, offset: 12, maxWidth: "260px" });

    function addOverlays() {
      const t = theme.current;
      const s = SURF[t];
      // Mute the basemap toward our ink.
      for (const l of map.getStyle().layers ?? []) {
        try {
          if (l.type === "background") map.setPaintProperty(l.id, "background-color", s.bg);
          else if (l.type === "fill" && /water|ocean/.test(l.id)) map.setPaintProperty(l.id, "fill-color", s.water);
          else if (l.type === "symbol" && t === "dark") map.setPaintProperty(l.id, "text-opacity", 0.7);
        } catch { /* layer without that property */ }
      }
      map.addSource("states", { type: "geojson", data: "/geo/states.geojson" });
      map.addSource("border", { type: "geojson", data: "/geo/nigeria_border.geojson" });
      map.addSource("links", { type: "geojson", data: live.current.links });
      map.addSource("units", {
        type: "geojson",
        data: live.current.points,
        cluster: true,
        clusterRadius: 46,
        clusterMaxZoom: 9,
        clusterProperties: {
          red: ["+", ["case", ["==", ["get", "b"], 2], 1, 0]],
          amber: ["+", ["case", ["==", ["get", "b"], 1], 1, 0]],
        },
      });
      map.addSource("selected", { type: "geojson", data: selectedFC(live.current.selected) });

      map.addLayer({ id: "states-line", type: "line", source: "states",
        paint: { "line-color": HEX.accent, "line-width": ["interpolate", ["linear"], ["zoom"], 4, 0.4, 9, 1], "line-opacity": t === "dark" ? 0.38 : 0.55 } });
      map.addLayer({ id: "border-line", type: "line", source: "border",
        paint: { "line-color": HEX.accent, "line-width": ["interpolate", ["linear"], ["zoom"], 2, 0.8, 8, 1.8], "line-opacity": 0.9 } });
      map.addLayer({ id: "links-line", type: "line", source: "links", layout: { "line-cap": "round" },
        paint: { "line-color": HEX.field, "line-width": 1.1, "line-opacity": ["interpolate", ["linear"], ["zoom"], 1, 0.6, 3, 0.45, 4.5, 0.12, 5.5, 0.05], "line-dasharray": [0, 4, 3] } });
      map.addLayer({ id: "clusters", type: "circle", source: "units", filter: ["has", "point_count"],
        paint: {
          "circle-color": s.raised,
          "circle-opacity": 0.92,
          "circle-radius": ["step", ["get", "point_count"], 11, 50, 14, 500, 17, 3000, 21],
          "circle-stroke-width": 1.5,
          "circle-stroke-color": ["case", [">", ["get", "red"], 0], HEX.field, [">", ["get", "amber"], 0], HEX.review, HEX.ok],
        } });
      map.addLayer({ id: "cluster-count", type: "symbol", source: "units", filter: ["has", "point_count"],
        layout: { "text-field": ["get", "point_count_abbreviated"], "text-font": ["Noto Sans Regular"], "text-size": 11, "text-allow-overlap": true },
        paint: { "text-color": s.text } });
      map.addLayer({ id: "units-pt", type: "circle", source: "units", filter: ["!", ["has", "point_count"]],
        layout: { "circle-sort-key": ["get", "b"] },
        paint: {
          "circle-color": ["match", ["get", "b"], 0, HEX.ok, 1, HEX.review, 2, HEX.field, HEX.none],
          "circle-radius": ["interpolate", ["linear"], ["zoom"], 4, ["match", ["get", "b"], 2, 4, 1, 3.5, 2.5], 13,
            ["match", ["get", "b"], 2, 8, 1, 7, 5.5]],
          "circle-opacity": ["match", ["get", "b"], 0, 0.8, 1],
          "circle-stroke-width": ["match", ["get", "b"], 0, 0, 1.2],
          "circle-stroke-color": s.bg,
        } });
      map.addLayer({ id: "selected-pulse", type: "circle", source: "selected",
        paint: { "circle-radius": 14, "circle-color": HEX.accent, "circle-opacity": 0, "circle-stroke-color": HEX.accent, "circle-stroke-width": 1.5, "circle-stroke-opacity": 0 } });
      map.addLayer({ id: "selected-halo", type: "circle", source: "selected",
        paint: { "circle-radius": 13, "circle-color": "transparent", "circle-stroke-color": HEX.accent, "circle-stroke-width": 2.5 } });
      map.addLayer({ id: "selected-dot", type: "circle", source: "selected",
        paint: { "circle-radius": 4, "circle-color": HEX.accent } });
    }
    map.on("style.load", () => {
      addOverlays();
      live.current.onReady?.();
    });

    // Motion: dashes march from each misplaced coordinate back toward its state; the selected unit pulses like sonar.
    const DASHES: number[][] = [[0, 4, 3], [0.5, 4, 2.5], [1, 4, 2], [1.5, 4, 1.5], [2, 4, 1], [2.5, 4, 0.5], [3, 4, 0],
      [0, 0.5, 3, 3.5], [0, 1, 3, 3], [0, 1.5, 3, 2.5], [0, 2, 3, 2], [0, 2.5, 3, 1.5], [0, 3, 3, 1], [0, 3.5, 3, 0.5]];
    let raf = 0, lastDash = -1;
    const animate = (now: number) => {
      raf = requestAnimationFrame(animate);
      if (live.current.reducedMotion || !map.isStyleLoaded()) return;
      const step = Math.floor(now / 70) % DASHES.length;
      if (step !== lastDash && map.getLayer("links-line")) {
        lastDash = step;
        map.setPaintProperty("links-line", "line-dasharray", DASHES[step]);
      }
      if (map.getLayer("selected-pulse")) {
        const t = (now % 1800) / 1800;
        map.setPaintProperty("selected-pulse", "circle-radius", 13 + 30 * t);
        map.setPaintProperty("selected-pulse", "circle-stroke-opacity", 0.9 * (1 - t));
        map.setPaintProperty("selected-pulse", "circle-opacity", 0.12 * (1 - t));
      }
    };
    raf = requestAnimationFrame(animate);

    map.on("click", "clusters", async (e) => {
      const f = e.features?.[0] as MapGeoJSONFeature | undefined;
      if (!f) return;
      const src = map.getSource("units") as GeoJSONSource;
      const zoom = await src.getClusterExpansionZoom(f.properties.cluster_id as number);
      map.easeTo({ center: (f.geometry as Point).coordinates as [number, number], zoom, duration: duration(600) });
    });
    map.on("click", "units-pt", (e) => {
      const f = e.features?.[0];
      if (f) live.current.onSelect(f.properties.i as number);
    });
    for (const layer of ["clusters", "units-pt"]) {
      map.on("mouseenter", layer, () => { map.getCanvas().style.cursor = "pointer"; });
      map.on("mouseleave", layer, () => { map.getCanvas().style.cursor = ""; tip.remove(); });
    }
    map.on("mousemove", "units-pt", (e) => {
      const p = e.features?.[0]?.properties as PointProps | undefined;
      if (!p) return;
      const st = STATUS[p.b];
      tip.setLngLat(e.lngLat).setHTML(`<span style="font-family:IBM Plex Mono,monospace">${indexToUid(p.i)}</span> · ${st.icon} ${st.label}`).addTo(map);
    });
    map.on("mousemove", "clusters", (e) => {
      const p = e.features?.[0]?.properties as { point_count: number; red: number; amber: number } | undefined;
      if (!p) return;
      tip.setLngLat(e.lngLat).setHTML(`${p.point_count.toLocaleString("en-NG")} units · ◆ ${p.red.toLocaleString("en-NG")} field check · ▲ ${p.amber.toLocaleString("en-NG")} review`).addTo(map);
    });

    const onTheme = (e: Event) => {
      const next = (e as CustomEvent<"dark" | "light">).detail;
      theme.current = next;
      map.setStyle(STYLE[next], { diff: false });
    };
    window.addEventListener("gur-theme", onTheme);
    return () => {
      window.removeEventListener("gur-theme", onTheme);
      cancelAnimationFrame(raf);
      map.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    (mapRef.current?.getSource("units") as GeoJSONSource | undefined)?.setData(props.points);
  }, [props.points]);
  useEffect(() => {
    (mapRef.current?.getSource("links") as GeoJSONSource | undefined)?.setData(props.links);
  }, [props.links]);
  useEffect(() => {
    (mapRef.current?.getSource("selected") as GeoJSONSource | undefined)?.setData(selectedFC(props.selected));
  }, [props.selected]);

  return <div ref={box} className="absolute inset-0" role="region" aria-label="Map of polling units" />;
}

function selectedFC(p: [number, number] | null): FeatureCollection<Point> {
  return { type: "FeatureCollection", features: p ? [{ type: "Feature", properties: {}, geometry: { type: "Point", coordinates: p } }] : [] };
}

