#!/usr/bin/env python3
"""Write uid,lat,lon for units with a reliable coordinate in one state, for upload to Earth Engine.
    python pipeline/make_ee_points.py KANO
"""
import csv
import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BAD = {"OUTSIDE_NIGERIA", "WRONG_STATE", "STACKED", "NO_COORDINATE"}


def main(state):
    src = os.path.join(ROOT, "data", "out", "units.csv")
    dst = os.path.join(ROOT, "data", "out", f"ee_points_{state}.csv")
    n = 0
    with open(src) as f, open(dst, "w", newline="") as g:
        w = csv.writer(g)
        w.writerow(["uid", "lat", "lon"])
        for r in csv.DictReader(f):
            if r["state"] == state and r["lat"] and not (set(r["flags"].split("|")) & BAD):
                w.writerow([r["uid"], r["lat"], r["lon"]])
                n += 1
    print(f"wrote {n:,} points to {dst}")


if __name__ == "__main__":
    main((sys.argv[1] if len(sys.argv) > 1 else "KANO").upper())
