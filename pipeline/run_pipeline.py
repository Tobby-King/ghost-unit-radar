#!/usr/bin/env python3
"""Ghost Unit Radar - reproducible pipeline.

    python pipeline/run_pipeline.py                      # all states with coordinates
    python pipeline/run_pipeline.py --radius 2 --spv 60  # sensitivity runs
    python pipeline/run_pipeline.py --ee data/raw/ee_catchments.csv   # add Open Buildings

Inputs (static public files only - no INEC live system is ever contacted):
  data/raw/pu.csv                 github.com/mykeels/inec-polling-units (MIT)
  data/raw/nga_adm1.geojson       geoBoundaries gbOpen NGA ADM1 simplified (CC BY 4.0)
  data/raw/nga_ppp_2020_1km.tif   WorldPop Global 1 km 2020 Nigeria (CC BY 4.0)
Outputs:
  data/out/units.csv, data/out/field_verification.csv, data/out/units_<STATE>.geojson,
  data/out/planted_ground_truth.csv, web/data/*.json
"""
import argparse
import csv
import json
import os
import sys
import time
from collections import Counter, defaultdict
from dataclasses import replace

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from gur.config import DEFAULT  # noqa: E402
from gur.geo import GridIndex, load_polygons, norm_state  # noqa: E402
from gur.location import check_unit, stack_counts  # noqa: E402
from gur.clock import audit_sheet  # noqa: E402
from gur.scoring import plausibility_reasons, score, band  # noqa: E402
from gur import synthetic  # noqa: E402

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RAW = os.path.join(ROOT, "data", "raw")
OUT = os.path.join(ROOT, "data", "out")
WEB = os.path.join(ROOT, "web", "data")


def load_units(path):
    units = []
    with open(path, newline="", encoding="utf-8") as f:
        for i, row in enumerate(csv.DictReader(f)):
            lat, lon = row["location.latitude"], row["location.longitude"]
            units.append({
                "uid": f"PU{i + 1:06d}",
                "name": row["name"].strip(),
                "ward": row["ward_name"].strip(),
                "lga": row["local_government_name"].strip(),
                "state": row["state_name"].strip(),
                "lat": float(lat) if lat else None,
                "lon": float(lon) if lon else None,
            })
    return units


def run(cfg, ee_path=None, write=True, units=None, states=None, raster=None, log=print):
    t0 = time.time()
    units = units if units is not None else load_units(os.path.join(RAW, "pu.csv"))
    states = states if states is not None else load_polygons(os.path.join(RAW, "nga_adm1.geojson"))
    states_by_norm = {norm_state(s.name): s for s in states}
    stacks = stack_counts(units)
    log(f"loaded {len(units):,} units, {len(states)} state polygons ({time.time() - t0:.1f}s)")

    # ---- Check 1: location integrity (REAL) ------------------------------------------
    for u in units:
        u["loc_reasons"] = check_unit(u, states_by_norm, states, stacks, cfg)
    log(f"location integrity done ({time.time() - t0:.1f}s)")

    # ---- Catchment ---------------------------------------------------------------------
    if raster is None:
        from gur.population import PopulationRaster
        raster = PopulationRaster(os.path.join(RAW, "nga_ppp_2020_1km.tif"))
    ee = {}
    if ee_path:
        from gur.population import load_ee_catchments
        ee = load_ee_catchments(ee_path)
        log(f"Earth Engine catchments loaded for {len(ee):,} units")

    reliable = [u for u in units if u["lat"] is not None and not any(
        r["code"] in ("OUTSIDE_NIGERIA", "WRONG_STATE", "STACKED") for r in u["loc_reasons"])]
    idx = GridIndex([(i, u["lat"], u["lon"]) for i, u in enumerate(reliable)])
    for u in units:
        u.update(reliable=False, adults_in_radius=None, units_in_radius=None, adults_share=None,
                 buildings=None)
    for u in reliable:
        adults = raster.adults_in_radius(u["lat"], u["lon"], cfg.radius_km, cfg.adult_share)
        e = ee.get(u["uid"])
        if e and e["adults"] is not None:
            adults = e["adults"]
        if e:
            u["buildings"] = {"latest": e["buildings_latest"], "y2016": e["buildings_2016"]}
        if adults is None:
            continue
        n = max(1, len(idx.within(u["lat"], u["lon"], cfg.radius_km)))
        u.update(reliable=True, adults_in_radius=adults, units_in_radius=n, adults_share=adults / n)
    log(f"catchments done for {sum(u['reliable'] for u in units):,} units ({time.time() - t0:.1f}s)")

    # ---- Synthetic register + sheets ---------------------------------------------------
    registers, sheets, planted = synthetic.generate(units, cfg)

    # ---- Checks 2 & 3 + score ----------------------------------------------------------
    for u in units:
        u["register"] = registers[u["uid"]]
        u["accredited"] = sheets[u["uid"]]["accredited"]
        u["devices"] = sheets[u["uid"]]["devices"]
        reasons = list(u["loc_reasons"])
        reasons += plausibility_reasons(u["register"], u["adults_share"] or 0,
                                        {"reliable": u["reliable"],
                                         "adults_in_radius": u["adults_in_radius"] or 0},
                                        cfg, u["buildings"])
        c = audit_sheet(u["accredited"], u["devices"], cfg)
        if c:
            reasons.append(c)
        u["reasons"] = reasons
        u["score"] = score(reasons)
        u["band"] = band(u["score"], cfg, u["lat"] is not None)
        u["planted"] = planted.get(u["uid"], "")
    log(f"scoring done ({time.time() - t0:.1f}s)")

    summary = summarise(units, planted, cfg)
    if write:
        write_outputs(units, summary, cfg)
        log(f"outputs written ({time.time() - t0:.1f}s)")
    return units, summary


def summarise(units, planted, cfg):
    withc = [u for u in units if u["lat"] is not None]
    codes = Counter(r["code"] for u in units for r in u["reasons"])
    states = defaultdict(lambda: Counter())
    for u in units:
        s = states[u["state"]]
        s["units"] += 1
        s["with_coordinates"] += u["lat"] is not None
        for r in u["loc_reasons"]:
            s[r["code"]] += 1
        s[u["band"]] += 1
    no_coord_states = sorted(k for k, v in states.items() if v["with_coordinates"] == 0)

    # Detection of planted (synthetic) anomalies
    flagged = {u["uid"] for u in units if u["band"] in ("red", "amber")}
    synth_flag_codes = {"EMPTY_CATCHMENT", "REGISTER_ABOVE_ADULTS", "CLOCK_IMPOSSIBLE", "FEW_ROOFTOPS"}
    synth_flagged = {u["uid"] for u in units
                     if any(r["code"] in synth_flag_codes for r in u["reasons"])}
    detected = sum(1 for k in planted if k in flagged)
    by_type = Counter(planted.values())
    det_type = Counter(t for k, t in planted.items() if k in flagged)

    places = Counter(r.get("place", "").split(" km from ")[-1] for u in units for r in u["reasons"]
                     if r["code"] == "OUTSIDE_NIGERIA")
    biggest = max(withc, key=lambda u: next((r.get("stack_size", 0) for r in u["reasons"]
                                              if r["code"] == "STACKED"), 0))
    return {
        "generated": time.strftime("%Y-%m-%d %H:%M"),
        "params": {"radius_km": cfg.radius_km, "seconds_per_voter": cfg.seconds_per_voter,
                   "seconds_per_voter_fastest": cfg.seconds_per_voter_fastest,
                   "polling_hours": cfg.polling_hours, "adult_share": cfg.adult_share,
                   "stack_min": cfg.stack_min, "border_tolerance_km": cfg.border_tolerance_km},
        "national": {
            "units": len(units), "with_coordinates": len(withc),
            "without_coordinates": len(units) - len(withc),
            "outside_nigeria": codes["OUTSIDE_NIGERIA"], "wrong_state": codes["WRONG_STATE"],
            "stacked_units": codes["STACKED"],
            "stacked_points": sum(1 for k, v in stack_counts(units).items() if v >= cfg.stack_min),
            "largest_stack": {"size": next(r["stack_size"] for r in biggest["reasons"] if r["code"] == "STACKED"),
                              "lga": biggest["lga"], "state": biggest["state"]},
            "red": sum(u["band"] == "red" for u in units), "amber": sum(u["band"] == "amber" for u in units),
            "green": sum(u["band"] == "green" for u in units),
            "top_foreign_places": places.most_common(12),
        },
        "reason_counts": dict(codes),
        "no_coordinate_states": no_coord_states,
        "states": {k: dict(v) for k, v in sorted(states.items())},
        "synthetic_validation": {
            "planted": len(planted), "detected": detected,
            "by_type": {t: {"planted": by_type[t], "detected": det_type[t]} for t in by_type},
            "synthetic_flags_total": len(synth_flagged),
            "synthetic_flags_not_planted": len(synth_flagged - set(planted)),
        },
    }


REASON_COLS = ("code", "source", "text", "innocent")


def write_outputs(units, summary, cfg):
    os.makedirs(OUT, exist_ok=True)
    os.makedirs(os.path.join(WEB, "states"), exist_ok=True)
    fields = ["uid", "state", "lga", "ward", "name", "lat", "lon", "band", "score",
              "register_SYNTHETIC", "accredited_SYNTHETIC", "bvas_devices_SYNTHETIC",
              "adults_in_radius", "units_in_radius", "adults_per_unit", "flags", "reasons", "innocent_explanations"]

    def row(u):
        return {
            "uid": u["uid"], "state": u["state"], "lga": u["lga"], "ward": u["ward"], "name": u["name"],
            "lat": u["lat"], "lon": u["lon"], "band": u["band"], "score": u["score"],
            "register_SYNTHETIC": u["register"], "accredited_SYNTHETIC": u["accredited"],
            "bvas_devices_SYNTHETIC": u["devices"],
            "adults_in_radius": None if u["adults_in_radius"] is None else round(u["adults_in_radius"]),
            "units_in_radius": u["units_in_radius"],
            "adults_per_unit": None if u["adults_share"] is None else round(u["adults_share"]),
            "flags": "|".join(r["code"] for r in u["reasons"]),
            "reasons": " | ".join(f"[{r['source']}] {r['text']}" for r in u["reasons"]),
            "innocent_explanations": " | ".join(r["innocent"] for r in u["reasons"]),
        }

    with open(os.path.join(OUT, "units.csv"), "w", newline="") as f:
        w = csv.DictWriter(f, fieldnames=fields)
        w.writeheader()
        for u in units:
            w.writerow(row(u))
    with open(os.path.join(OUT, "field_verification.csv"), "w", newline="") as f:
        w = csv.DictWriter(f, fieldnames=fields)
        w.writeheader()
        for u in sorted((u for u in units if u["band"] in ("red", "amber")), key=lambda u: u["score"]):
            w.writerow(row(u))
    with open(os.path.join(OUT, "planted_ground_truth.csv"), "w", newline="") as f:
        w = csv.writer(f)
        w.writerow(["uid", "state", "planted_type", "band", "score", "flags"])
        for u in units:
            if u["planted"]:
                w.writerow([u["uid"], u["state"], u["planted"], u["band"], u["score"],
                            "|".join(r["code"] for r in u["reasons"])])

    demo = [u for u in units if u["state"] == cfg.demo_state and u["lat"] is not None]
    with open(os.path.join(OUT, f"units_{cfg.demo_state}.geojson"), "w") as f:
        json.dump({"type": "FeatureCollection", "name": "ghost_unit_radar_SYNTHETIC_REGISTERS",
                   "features": [{"type": "Feature", "geometry": {"type": "Point", "coordinates": [u["lon"], u["lat"]]},
                                 "properties": {k: v for k, v in row(u).items() if k not in ("lat", "lon")}}
                                for u in demo]}, f)

    # ---- Web data: compact per-state files --------------------------------------------
    cols = ["uid", "name", "ward", "lga", "lat", "lon", "score", "band", "register", "accredited",
            "devices", "adults_r", "units_r", "adults_share", "reasons"]
    by_state = defaultdict(list)
    for u in units:
        by_state[u["state"]].append([
            u["uid"], u["name"], u["ward"], u["lga"], u["lat"], u["lon"], u["score"], u["band"],
            u["register"], u["accredited"], u["devices"],
            None if u["adults_in_radius"] is None else round(u["adults_in_radius"]),
            u["units_in_radius"],
            None if u["adults_share"] is None else round(u["adults_share"]),
            [[r[c] for c in REASON_COLS] for r in u["reasons"]],
        ])
    index = []
    for st, rows in sorted(by_state.items()):
        fn = st.replace(" ", "_") + ".json"
        with open(os.path.join(WEB, "states", fn), "w") as f:
            json.dump({"state": st, "cols": cols, "rows": rows}, f, separators=(",", ":"))
        index.append({"state": st, "file": f"states/{fn}", "units": len(rows),
                      "with_coordinates": sum(1 for r in rows if r[4] is not None)})
    national = [[u["uid"], u["name"], u["ward"], u["lga"], u["state"], u["lat"], u["lon"], u["score"],
                 [[r[c] for c in REASON_COLS] for r in u["loc_reasons"]]]
                for u in units if any(r["code"] in ("OUTSIDE_NIGERIA", "WRONG_STATE") for r in u["loc_reasons"])]
    with open(os.path.join(WEB, "national_location_flags.json"), "w") as f:
        json.dump({"cols": ["uid", "name", "ward", "lga", "state", "lat", "lon", "score", "reasons"],
                   "rows": national}, f, separators=(",", ":"))
    with open(os.path.join(WEB, "summary.json"), "w") as f:
        json.dump({**summary, "index": index}, f, indent=1)


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--radius", type=float, default=DEFAULT.radius_km, help="catchment radius km")
    ap.add_argument("--spv", type=float, default=DEFAULT.seconds_per_voter, help="seconds per voter (typical)")
    ap.add_argument("--hours", type=float, default=DEFAULT.polling_hours)
    ap.add_argument("--demo-state", default=DEFAULT.demo_state)
    ap.add_argument("--ee", default=None, help="Earth Engine catchment CSV (optional)")
    a = ap.parse_args()
    cfg = replace(DEFAULT, radius_km=a.radius, seconds_per_voter=a.spv, polling_hours=a.hours,
                  demo_state=a.demo_state.upper())
    _, s = run(cfg, ee_path=a.ee)
    print(json.dumps(s["national"], indent=1))
    print(json.dumps(s["synthetic_validation"], indent=1))


if __name__ == "__main__":
    main()
