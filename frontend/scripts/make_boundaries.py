"""One-off: simplify geoBoundaries NGA ADM1 (CC BY 4.0) into small web files.
Writes frontend/public/geo/states.geojson (outlines + label points) and nigeria_border.geojson.
Run: python3 frontend/scripts/make_boundaries.py  (needs data/raw/nga_adm1.geojson)"""
import json, math, sys
from collections import Counter
SRC = "data/raw/nga_adm1.geojson"; OUT = "frontend/public/geo/"
TOL = 0.01  # degrees (~1 km)

def dp(pts, tol):
    if len(pts) < 3: return pts
    keep = [False]*len(pts); keep[0] = keep[-1] = True; stack = [(0, len(pts)-1)]
    while stack:
        a, b = stack.pop(); (x1, y1), (x2, y2) = pts[a], pts[b]; dx, dy = x2-x1, y2-y1; L = math.hypot(dx, dy)
        best, bi = 0, -1
        for i in range(a+1, b):
            x, y = pts[i]
            d = abs(dy*x - dx*y + x2*y1 - y2*x1)/L if L else math.hypot(x-x1, y-y1)
            if d > best: best, bi = d, i
        if best > tol: keep[bi] = True; stack += [(a, bi), (bi, b)]
    return [p for p, k in zip(pts, keep) if k]

r = lambda p: (round(p[0], 6), round(p[1], 6))
g = json.load(open(SRC))
rings = []  # (stateName, ring)
for f in g["features"]:
    geom = f["geometry"]; polys = [geom["coordinates"]] if geom["type"] == "Polygon" else geom["coordinates"]
    for poly in polys: rings.append((f["properties"]["shapeName"], [r(p) for p in poly[0]]))
seg = Counter()
for _, ring in rings:
    for a, b in zip(ring, ring[1:]): seg[frozenset((a, b))] += 1

def centroid(ring):
    A = cx = cy = 0
    for (x1, y1), (x2, y2) in zip(ring, ring[1:]):
        c = x1*y2 - x2*y1; A += c; cx += (x1+x2)*c; cy += (y1+y2)*c
    return (cx/(3*A), cy/(3*A)) if A else ring[0]

states, labels, border = {}, [], []
for name, ring in rings:
    states.setdefault(name, []).append(dp(ring, TOL))
    run = []
    for a, b in zip(ring, ring[1:]):
        if seg[frozenset((a, b))] == 1:
            if not run: run = [a]
            run.append(b)
        elif run: border.append(run); run = []
    if run: border.append(run)
feats = []
for name, rs in states.items():
    big = max(rs, key=len)
    feats.append({"type": "Feature", "properties": {"name": name, "key": name.upper().replace("FEDERAL CAPITAL TERRITORY", "FEDERAL CAPITAL TERRITORY")},
                  "geometry": {"type": "MultiLineString", "coordinates": [[[round(x, 4), round(y, 4)] for x, y in rr] for rr in rs if len(rr) > 3]}})
    cx, cy = centroid(big)
    labels.append({"type": "Feature", "properties": {"name": name, "key": name.upper()}, "geometry": {"type": "Point", "coordinates": [round(cx, 4), round(cy, 4)]}})
bl = [[[round(x, 4), round(y, 4)] for x, y in dp(b, TOL)] for b in border if len(b) > 1]
json.dump({"type": "FeatureCollection", "features": feats}, open(OUT+"states.geojson", "w"), separators=(",", ":"))
json.dump({"type": "FeatureCollection", "features": labels}, open(OUT+"state_centroids.geojson", "w"), separators=(",", ":"))
json.dump({"type": "FeatureCollection", "features": [{"type": "Feature", "properties": {}, "geometry": {"type": "MultiLineString", "coordinates": bl}}]}, open(OUT+"nigeria_border.geojson", "w"), separators=(",", ":"))
print(sorted(l["properties"]["key"] for l in labels))
