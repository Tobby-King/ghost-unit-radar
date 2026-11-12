"""Integration tests on the pipeline OUTPUTS. They recompute headline numbers independently
from the raw CSV (without the pipeline's code) and check every published file for consistency.
Skipped automatically if the pipeline has not been run."""
import csv
import glob
import json
import os
from collections import Counter

import pytest

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
RAW = os.path.join(ROOT, "data", "raw", "pu.csv")
OUT = os.path.join(ROOT, "data", "out")
WEB = os.path.join(ROOT, "web", "data")

pytestmark = pytest.mark.skipif(not (os.path.exists(RAW) and os.path.exists(os.path.join(WEB, "summary.json"))),
                                reason="run scripts/download_data.sh and pipeline/run_pipeline.py first")


@pytest.fixture(scope="module")
def raw():
    with open(RAW, newline="", encoding="utf-8") as f:
        return list(csv.DictReader(f))


@pytest.fixture(scope="module")
def summary():
    with open(os.path.join(WEB, "summary.json")) as f:
        return json.load(f)


@pytest.fixture(scope="module")
def web_rows():
    rows = []
    for p in glob.glob(os.path.join(WEB, "states", "*.json")):
        with open(p) as f:
            d = json.load(f)
        c = {k: i for i, k in enumerate(d["cols"])}
        for r in d["rows"]:
            rows.append({k: r[i] for k, i in c.items()} | {"state": d["state"]})
    return rows


@pytest.fixture(scope="module")
def units_csv():
    with open(os.path.join(OUT, "units.csv"), newline="") as f:
        return list(csv.DictReader(f))


def coords(raw):
    return [(float(r["location.latitude"]), float(r["location.longitude"])) for r in raw if r["location.latitude"]]


# ---- headline numbers recomputed independently ------------------------------------------
def test_unit_counts(raw, summary):
    assert len(raw) == summary["national"]["units"] == 176623
    assert len(coords(raw)) == summary["national"]["with_coordinates"] == 119297


def test_stacked_recomputed(raw, summary):
    c = Counter(coords(raw))
    assert sum(v for v in c.values() if v >= 10) == summary["national"]["stacked_units"]
    assert max(c.values()) == summary["national"]["largest_stack"]["size"]


def test_outside_nigeria_consistent_with_bbox(raw, summary):
    # Simple bounding-box count is a lower bound; polygon test adds points inside the box but in
    # neighbouring countries / sea. The difference must be small and explained.
    outside_box = sum(1 for la, lo in coords(raw) if not (2.6 <= lo <= 14.75 and 4.2 <= la <= 13.95))
    assert outside_box == 1512
    assert 0 <= summary["national"]["outside_nigeria"] - outside_box <= 10


def test_waterloo_unit(raw, units_csv):
    r = raw[1]
    assert r["name"] == "LGEA SCHOOL INELE, UGO I & II" and r["state_name"] == "KOGI"
    u = units_csv[1]
    assert u["uid"] == "PU000002" and "OUTSIDE_NIGERIA" in u["flags"] and "Waterloo, Canada" in u["reasons"]


def test_no_coordinate_states(raw, summary):
    with_c = {r["state_name"] for r in raw if r["location.latitude"]}
    none = sorted({r["state_name"] for r in raw} - with_c)
    assert none == summary["no_coordinate_states"] and len(none) == 7


# ---- web data consistency -----------------------------------------------------------------
def test_web_covers_every_unit_once(web_rows):
    assert len(web_rows) == 176623
    assert len({r["uid"] for r in web_rows}) == 176623


def test_bands_match_scores(web_rows, summary):
    for r in web_rows:
        if r["lat"] is None:
            assert r["band"] == "grey"
        else:
            exp = "green" if r["score"] >= 70 else "amber" if r["score"] >= 40 else "red"
            assert r["band"] == exp, r["uid"]
    c = Counter(r["band"] for r in web_rows)
    for b in ("red", "amber", "green"):
        assert c[b] == summary["national"][b]


def test_every_flag_explained_and_labelled(web_rows):
    for r in web_rows:
        if r["band"] in ("red", "amber"):
            assert r["reasons"], r["uid"]
        for code, source, text, innocent in r["reasons"]:
            assert source in ("REAL", "SYNTHETIC")
            assert text and innocent
            assert "fraud" not in (text + innocent).lower()
            if code in ("REGISTER_ABOVE_ADULTS", "EMPTY_CATCHMENT", "CLOCK_IMPOSSIBLE", "CLOCK_IMPLAUSIBLE"):
                assert source == "SYNTHETIC"
            if code in ("OUTSIDE_NIGERIA", "WRONG_STATE", "STACKED", "NO_COORDINATE"):
                assert source == "REAL"


def test_clock_flags_match_formula(web_rows, summary):
    h = summary["params"]["polling_hours"]
    for r in web_rows:
        codes = {x[0] for x in r["reasons"]}
        fast = int(h * 3600 // 30) * r["devices"]
        typ = int(h * 3600 // summary["params"]["seconds_per_voter"]) * r["devices"]
        assert ("CLOCK_IMPOSSIBLE" in codes) == (r["accredited"] > fast), r["uid"]
        assert ("CLOCK_IMPLAUSIBLE" in codes) == (typ < r["accredited"] <= fast), r["uid"]


def test_unreliable_coordinates_not_scored_on_population(web_rows):
    for r in web_rows:
        codes = {x[0] for x in r["reasons"]}
        if codes & {"OUTSIDE_NIGERIA", "WRONG_STATE", "STACKED", "NO_COORDINATE"}:
            assert r["adults_r"] is None and not codes & {"REGISTER_ABOVE_ADULTS", "EMPTY_CATCHMENT"}


def test_national_layer(summary):
    with open(os.path.join(WEB, "national_location_flags.json")) as f:
        d = json.load(f)
    n = summary["national"]
    assert len(d["rows"]) == n["outside_nigeria"] + n["wrong_state"]


def test_field_verification_csv(units_csv):
    with open(os.path.join(OUT, "field_verification.csv"), newline="") as f:
        fv = list(csv.DictReader(f))
    assert len(fv) == sum(1 for u in units_csv if u["band"] in ("red", "amber"))
    scores = [int(r["score"]) for r in fv]
    assert scores == sorted(scores)
    assert all(r["innocent_explanations"] for r in fv)
    assert "register_SYNTHETIC" in fv[0]


def test_planted_ground_truth(summary):
    with open(os.path.join(OUT, "planted_ground_truth.csv"), newline="") as f:
        gt = list(csv.DictReader(f))
    v = summary["synthetic_validation"]
    assert len(gt) == v["planted"] == 900
    assert sum(1 for g in gt if g["band"] in ("red", "amber")) == v["detected"]


def test_index_matches_files(summary):
    for e in summary["index"]:
        assert os.path.exists(os.path.join(WEB, e["file"]))
    assert len(summary["index"]) == 37
