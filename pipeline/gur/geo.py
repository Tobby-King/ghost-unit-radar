"""Small, dependency-free geometry helpers (pure Python, so the pipeline runs anywhere)."""
import json
import math

EARTH_R_KM = 6371.0088


def haversine_km(lat1, lon1, lat2, lon2):
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp = p2 - p1
    dl = math.radians(lon2 - lon1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * EARTH_R_KM * math.asin(min(1.0, math.sqrt(a)))


def point_in_ring(x, y, ring):
    """Ray casting. ring = list of (x, y)."""
    inside = False
    n = len(ring)
    j = n - 1
    for i in range(n):
        xi, yi = ring[i]
        xj, yj = ring[j]
        if (yi > y) != (yj > y):
            xint = (xj - xi) * (y - yi) / (yj - yi) + xi
            if x < xint:
                inside = not inside
        j = i
    return inside


class Polygon:
    """A (multi)polygon with holes and a bounding box for quick rejection."""

    def __init__(self, name, polys):
        # polys: list of polygons; each polygon = [outer_ring, hole1, ...]
        self.name = name
        self.polys = polys
        xs = [p[0] for poly in polys for p in poly[0]]
        ys = [p[1] for poly in polys for p in poly[0]]
        self.bbox = (min(xs), min(ys), max(xs), max(ys))

    def contains(self, lon, lat):
        b = self.bbox
        if lon < b[0] or lon > b[2] or lat < b[1] or lat > b[3]:
            return False
        for poly in self.polys:
            if point_in_ring(lon, lat, poly[0]) and not any(point_in_ring(lon, lat, h) for h in poly[1:]):
                return True
        return False

    def distance_km(self, lon, lat):
        """Approximate distance from a point to the polygon boundary (0 if inside)."""
        if self.contains(lon, lat):
            return 0.0
        best = float("inf")
        kx = 111.32 * math.cos(math.radians(lat))
        ky = 110.57
        for poly in self.polys:
            for ring in poly:
                for (x1, y1), (x2, y2) in zip(ring, ring[1:]):
                    best = min(best, _seg_dist(lon, lat, x1, y1, x2, y2, kx, ky))
        return best


def _seg_dist(px, py, x1, y1, x2, y2, kx, ky):
    # Project to local km plane around the point.
    ax, ay = (x1 - px) * kx, (y1 - py) * ky
    bx, by = (x2 - px) * kx, (y2 - py) * ky
    dx, dy = bx - ax, by - ay
    L = dx * dx + dy * dy
    t = 0.0 if L == 0 else max(0.0, min(1.0, -(ax * dx + ay * dy) / L))
    cx, cy = ax + t * dx, ay + t * dy
    return math.hypot(cx, cy)


def load_polygons(geojson_path, name_prop="shapeName"):
    with open(geojson_path) as f:
        fc = json.load(f)
    out = []
    for feat in fc["features"]:
        g = feat["geometry"]
        coords = g["coordinates"]
        polys = [coords] if g["type"] == "Polygon" else coords
        polys = [[[tuple(pt[:2]) for pt in ring] for ring in poly] for poly in polys]
        out.append(Polygon(feat["properties"][name_prop], polys))
    return out


def norm_state(name):
    """Normalise state names so INEC ('FEDERAL CAPITAL TERRITORY') and geoBoundaries
    ('Abuja Federal Capital Territory') spellings match."""
    s = name.upper().replace("-", " ").strip()
    if "FEDERAL CAPITAL" in s or s in ("FCT", "ABUJA"):
        return "FCT"
    return s


class GridIndex:
    """Uniform grid spatial index for fast radius queries over ~100k points."""

    def __init__(self, points, cell_deg=0.02):
        # points: list of (idx, lat, lon)
        self.cell = cell_deg
        self.grid = {}
        for idx, lat, lon in points:
            self.grid.setdefault(self._key(lat, lon), []).append((idx, lat, lon))

    def _key(self, lat, lon):
        return (int(math.floor(lat / self.cell)), int(math.floor(lon / self.cell)))

    def within(self, lat, lon, radius_km):
        r_deg = radius_km / 110.0
        span = int(math.ceil(r_deg / self.cell)) + 1
        # widen in longitude away from the equator
        lon_span = int(math.ceil(span / max(0.2, math.cos(math.radians(lat)))))
        ki, kj = self._key(lat, lon)
        res = []
        for di in range(-span, span + 1):
            for dj in range(-lon_span, lon_span + 1):
                for idx, la, lo in self.grid.get((ki + di, kj + dj), ()):
                    if haversine_km(lat, lon, la, lo) <= radius_km:
                        res.append(idx)
        return res
