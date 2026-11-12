#!/usr/bin/env python3
"""Sensitivity analysis: how many units are flagged as the catchment radius and the BVAS
seconds-per-voter assumption change. Writes data/out/sensitivity.json and web/data/sensitivity.json.

    python pipeline/sensitivity.py
"""
import json
import os
import sys
from collections import Counter
from dataclasses import replace

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from gur.config import DEFAULT  # noqa: E402
from gur.geo import load_polygons  # noqa: E402
from gur.population import PopulationRaster  # noqa: E402
from gur.clock import max_accredited  # noqa: E402
import run_pipeline as rp  # noqa: E402


def main():
    units = rp.load_units(os.path.join(rp.RAW, "pu.csv"))
    states = load_polygons(os.path.join(rp.RAW, "nga_adm1.geojson"))
    raster = PopulationRaster(os.path.join(rp.RAW, "nga_ppp_2020_1km.tif"))
    out = {"radius": [], "seconds_per_voter": []}
    for r in (0.5, 1.0, 2.0):
        cfg = replace(DEFAULT, radius_km=r)
        us, s = rp.run(cfg, write=False, units=[dict(u) for u in units], states=states, raster=raster, log=lambda *_: None)
        c = Counter(x["code"] for u in us for x in u["reasons"])
        out["radius"].append({
            "radius_km": r, "red": s["national"]["red"], "amber": s["national"]["amber"],
            "register_above_adults": c["REGISTER_ABOVE_ADULTS"], "empty_catchment": c["EMPTY_CATCHMENT"],
            "planted_detected": s["synthetic_validation"]["detected"], "planted": s["synthetic_validation"]["planted"],
            "synthetic_flags_not_planted": s["synthetic_validation"]["synthetic_flags_not_planted"],
        })
        print(out["radius"][-1])
        if r == 1.0:
            base = us
    for spv in (30, 45, 60, 90, 120):
        n = sum(1 for u in base if u["accredited"] > max_accredited(DEFAULT.polling_hours, spv, u["devices"]))
        planted = sum(1 for u in base if u["planted"] == "CLOCK_IMPOSSIBLE"
                      and u["accredited"] > max_accredited(DEFAULT.polling_hours, spv, u["devices"]))
        out["seconds_per_voter"].append({"seconds_per_voter": spv, "sheets_exceeding": n,
                                         "planted_clock_detected": planted, "sheets": len(base)})
        print(out["seconds_per_voter"][-1])
    for d in (os.path.join(rp.ROOT, "data", "out"), rp.WEB):
        with open(os.path.join(d, "sensitivity.json"), "w") as f:
            json.dump(out, f, indent=1)


if __name__ == "__main__":
    main()
