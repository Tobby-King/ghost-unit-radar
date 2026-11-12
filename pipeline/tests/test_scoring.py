import os
import sys
from collections import Counter
from dataclasses import replace

import pytest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from gur.config import DEFAULT  # noqa: E402
from gur.geo import Polygon, haversine_km, point_in_ring, norm_state, GridIndex  # noqa: E402
from gur.location import check_unit  # noqa: E402
from gur.clock import max_accredited, audit_sheet, sensitivity  # noqa: E402
from gur.scoring import plausibility_reasons, score, band  # noqa: E402
from gur.gazetteer import nearest_place  # noqa: E402
from gur import synthetic  # noqa: E402

CFG = DEFAULT
# A square "state" around Kano city and one next to it.
KANO = Polygon("Kano", [[[(8.0, 11.5), (9.0, 11.5), (9.0, 12.5), (8.0, 12.5), (8.0, 11.5)]]])
JIGAWA = Polygon("Jigawa", [[[(9.0, 11.5), (10.0, 11.5), (10.0, 12.5), (9.0, 12.5), (9.0, 11.5)]]])
STATES = [KANO, JIGAWA]
BY_NORM = {norm_state(s.name): s for s in STATES}


def unit(lat, lon, state="KANO"):
    return {"uid": "T1", "name": "X", "ward": "W", "lga": "L", "state": state, "lat": lat, "lon": lon}


def codes(reasons):
    return [r["code"] for r in reasons]


# ---------------- geometry ----------------
def test_haversine_known_distance():
    # Lagos -> Abuja is roughly 525 km great-circle
    assert 500 < haversine_km(6.5244, 3.3792, 9.0765, 7.3986) < 560


def test_point_in_ring_and_polygon():
    ring = [(0, 0), (1, 0), (1, 1), (0, 1), (0, 0)]
    assert point_in_ring(0.5, 0.5, ring)
    assert not point_in_ring(1.5, 0.5, ring)
    assert KANO.contains(8.5, 12.0) and not KANO.contains(9.5, 12.0)


def test_distance_to_polygon():
    assert KANO.distance_km(8.5, 12.0) == 0
    d = KANO.distance_km(7.99, 12.0)  # ~1.1 km west of the border
    assert 0.9 < d < 1.3


def test_norm_state_fct():
    assert norm_state("FEDERAL CAPITAL TERRITORY") == norm_state("Abuja Federal Capital Territory") == "FCT"


def test_grid_index_radius():
    pts = [(0, 12.0, 8.5), (1, 12.005, 8.5), (2, 12.05, 8.5)]
    idx = GridIndex(pts)
    assert sorted(idx.within(12.0, 8.5, 1.0)) == [0, 1]


# ---------------- location integrity ----------------
def test_clean_unit_has_no_flags():
    assert check_unit(unit(12.0, 8.5), BY_NORM, STATES, Counter(), CFG) == []


def test_waterloo_outside_nigeria():
    r = check_unit(unit(43.4691201, -80.5756985, "KOGI"), BY_NORM, STATES, Counter(), CFG)
    assert codes(r) == ["OUTSIDE_NIGERIA"]
    assert "Waterloo, Canada" in r[0]["text"]
    assert r[0]["source"] == "REAL" and r[0]["innocent"]


def test_swapped_coordinates_explained():
    r = check_unit(unit(8.5, 12.0), BY_NORM, STATES, Counter(), CFG)  # lat/lon swapped
    assert codes(r) == ["OUTSIDE_NIGERIA"]
    assert "swapped" in r[0]["innocent"]


def test_wrong_state():
    r = check_unit(unit(12.0, 9.5, "KANO"), BY_NORM, STATES, Counter(), CFG)
    assert codes(r) == ["WRONG_STATE"] and "Jigawa" in r[0]["text"]


def test_border_tolerance_not_flagged():
    # 1 km outside claimed state but within 3 km tolerance -> not flagged
    assert check_unit(unit(12.0, 9.01, "KANO"), BY_NORM, STATES, Counter(), CFG) == []


def test_stacked():
    st = Counter({(12.0, 8.5): 12})
    r = check_unit(unit(12.0, 8.5), BY_NORM, STATES, st, CFG)
    assert codes(r) == ["STACKED"] and r[0]["penalty"] == 20
    st = Counter({(12.0, 8.5): 120})
    assert check_unit(unit(12.0, 8.5), BY_NORM, STATES, st, CFG)[0]["penalty"] == 30


def test_no_coordinate():
    r = check_unit(unit(None, None), BY_NORM, STATES, Counter(), CFG)
    assert codes(r) == ["NO_COORDINATE"] and r[0]["penalty"] == 0


# ---------------- plausibility ----------------
def catch(adults):
    return {"reliable": True, "adults_in_radius": adults}


def test_plausible_register_no_flag():
    assert plausibility_reasons(400, 600, catch(1200), CFG) == []


@pytest.mark.parametrize("register,share,pen", [(800, 600, 25), (1300, 600, 45), (2000, 600, 65)])
def test_register_ratio_bands(register, share, pen):
    r = plausibility_reasons(register, share, catch(share * 2), CFG)
    assert codes(r) == ["REGISTER_ABOVE_ADULTS"] and r[0]["penalty"] == pen


def test_empty_catchment():
    r = plausibility_reasons(1400, 20, catch(38), CFG)
    assert codes(r) == ["EMPTY_CATCHMENT"] and "1,400" in r[0]["text"]


def test_unreliable_catchment_not_scored():
    assert plausibility_reasons(5000, 10, {"reliable": False, "adults_in_radius": 0}, CFG) == []


def test_rooftops_and_new_buildings():
    r = plausibility_reasons(1400, 2000, catch(4000), CFG, {"latest": 38, "y2016": 0})
    assert set(codes(r)) == {"FEW_ROOFTOPS", "NEW_BUILDINGS"}


def test_radius_changes_text():
    cfg = replace(CFG, radius_km=2.0)
    assert "2 km" in plausibility_reasons(1400, 20, catch(38), cfg)[0]["text"]


# ---------------- clock audit ----------------
def test_max_accredited():
    assert max_accredited(6, 45, 1) == 480
    assert max_accredited(6, 30, 2) == 1440
    with pytest.raises(ValueError):
        max_accredited(6, 0, 1)


def test_clock_bands():
    assert audit_sheet(400, 1, CFG) is None
    assert audit_sheet(500, 1, CFG)["code"] == "CLOCK_IMPLAUSIBLE"
    assert audit_sheet(800, 1, CFG)["code"] == "CLOCK_IMPOSSIBLE"
    assert audit_sheet(800, 2, CFG) is None
    assert audit_sheet(1000, 2, CFG)["code"] == "CLOCK_IMPLAUSIBLE"


def test_clock_configurable_speed():
    slow = replace(CFG, seconds_per_voter=120)
    assert audit_sheet(200, 1, slow)["code"] == "CLOCK_IMPLAUSIBLE"


def test_sensitivity_monotonic():
    s = sensitivity(500, 1, CFG)
    maxes = [x["max"] for x in s]
    assert maxes == sorted(maxes, reverse=True)
    assert [x["exceeds"] for x in s] == [False, True, True, True, True]


# ---------------- score ----------------
def test_score_and_band():
    assert score([]) == 100 and band(100, CFG) == "green"
    assert score([{"penalty": 45}]) == 55 and band(55, CFG) == "amber"
    assert score([{"penalty": 70}, {"penalty": 45}]) == 0 and band(0, CFG) == "red"
    assert band(100, CFG, has_coordinate=False) == "grey"


def test_every_reason_has_innocent_explanation():
    rs = (check_unit(unit(43.46, -80.52), BY_NORM, STATES, Counter({(43.46, -80.52): 60}), CFG)
          + plausibility_reasons(1400, 20, catch(38), CFG, {"latest": 38, "y2016": 0})
          + [audit_sheet(900, 1, CFG)])
    assert rs and all(r["innocent"] and r["source"] in ("REAL", "SYNTHETIC") for r in rs)
    assert not any("fraud" in (r["text"] + r["innocent"]).lower() for r in rs)


def test_gazetteer():
    assert nearest_place(43.4691, -80.5757) == "Waterloo, Canada"
    assert "km from" in nearest_place(44.0, -78.9)


# ---------------- synthetic generator ----------------
def test_synthetic_is_deterministic_and_plants_anomalies():
    units = [{"uid": f"U{i}", "state": "KANO", "reliable": True,
              "adults_share": 300 + i % 200, "adults_in_radius": 600 + i} for i in range(300)]
    a = synthetic.generate(units, CFG)
    b = synthetic.generate(units, CFG)
    assert a == b
    planted = a[2]
    assert len(planted) == CFG.anomalies_per_state
    assert set(planted.values()) == set(synthetic.ANOMALY_TYPES)


def test_empty_catchment_requires_register_above_twice_adults():
    assert plausibility_reasons(300, 200, catch(200), CFG)[0]["code"] == "REGISTER_ABOVE_ADULTS"
    assert plausibility_reasons(150, 200, catch(200), CFG) == []


def test_severe_ratio_is_red():
    r = plausibility_reasons(1695, 192, catch(192), CFG)
    assert band(score(r), CFG) == "red"
