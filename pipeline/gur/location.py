"""Check 1 - Location integrity (REAL public data, no synthetic inputs).

For every polling unit with a published coordinate:
  * OUTSIDE_NIGERIA  - point is not inside any Nigerian state polygon (beyond tolerance)
  * WRONG_STATE      - point is inside Nigeria but in a different state from the one INEC lists
  * STACKED          - >= stack_min units share the exact same coordinate (centroid geocoding)
  * NO_COORDINATE    - no coordinate published (reported, not scored)
Each flag carries a plain-language reason and the most likely innocent explanation.
"""
from collections import Counter

from .geo import norm_state
from .gazetteer import nearest_place


def stack_counts(units):
    """Map (lat, lon) -> number of units at exactly that point."""
    return Counter((u["lat"], u["lon"]) for u in units if u["lat"] is not None)


def in_bbox(lat, lon, bbox):
    return bbox[0] <= lon <= bbox[2] and bbox[1] <= lat <= bbox[3]


def find_state(lat, lon, states, tol_km=0.0):
    for s in states:
        if s.contains(lon, lat):
            return s.name
    if tol_km > 0:
        best = min(states, key=lambda s: s.distance_km(lon, lat))
        if best.distance_km(lon, lat) <= tol_km:
            return best.name
    return None


def check_unit(u, states_by_norm, states, stacks, cfg):
    """Return a list of reason dicts for one unit. Pure function of its inputs."""
    reasons = []
    lat, lon = u["lat"], u["lon"]
    if lat is None:
        return [{
            "code": "NO_COORDINATE", "source": "REAL", "penalty": 0,
            "text": "INEC's published list gives no coordinate for this unit.",
            "innocent": "Coordinates were never published for this state/unit.",
        }]

    claimed = norm_state(u["state"])
    claimed_poly = states_by_norm.get(claimed)
    inside_claimed = claimed_poly is not None and (
        claimed_poly.contains(lon, lat)
        or (in_bbox(lat, lon, cfg.nigeria_bbox) and claimed_poly.distance_km(lon, lat) <= cfg.border_tolerance_km)
    )

    if not inside_claimed:
        actual = None
        if in_bbox(lat, lon, cfg.nigeria_bbox):
            actual = find_state(lat, lon, states, tol_km=cfg.border_tolerance_km)
        if actual is None:
            place = nearest_place(lat, lon)
            swapped_ok = in_bbox(lon, lat, cfg.nigeria_bbox)  # (lat, lon) swapped?
            innocent = "Automatic geocoding matched the school/village name to a place abroad."
            if swapped_ok:
                innocent = "Latitude and longitude appear to be swapped."
            elif abs(lat) < 0.5 and abs(lon) < 0.5:
                innocent = "Placeholder (0,0)-type coordinate entered instead of a real location."
            reasons.append({
                "code": "OUTSIDE_NIGERIA", "source": "REAL", "penalty": 70,
                "text": f"Official coordinate is outside Nigeria - near {place}.",
                "innocent": innocent, "place": place,
            })
        else:
            reasons.append({
                "code": "WRONG_STATE", "source": "REAL", "penalty": 45,
                "text": f"Listed in {u['state'].title()} but the coordinate falls in {actual}.",
                "innocent": "Geocoder matched a same-named place in another state, or a typo in the coordinate.",
            })

    n = stacks.get((lat, lon), 1)
    if n >= cfg.stack_min:
        severe = n >= cfg.stack_severe
        reasons.append({
            "code": "STACKED", "source": "REAL", "penalty": 30 if severe else 20,
            "text": f"{n} polling units share this exact coordinate.",
            "innocent": "Coordinate is a ward/LGA centroid rather than the unit's real GPS position.",
            "stack_size": n,
        })
    return reasons
