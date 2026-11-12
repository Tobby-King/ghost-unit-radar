"""Population catchment from WorldPop (satellite-derived) gridded population.

Default path (works offline once the 5 MB file is downloaded):
  WorldPop Global 1 km 'ppp' 2020 for Nigeria (UN-unadjusted), CC BY 4.0.
  adults_in_radius = mean density of the (2k+1)^2 window around the unit * pi * r^2 * adult_share

Upgrade path: earth_engine/catchment_export.js computes adults (WorldPop age bins 20+ at 100 m)
and Google Open Buildings 2.5D Temporal building counts per unit; load its CSV with
load_ee_catchments() and it overrides the 1 km estimate.
"""
import csv
import math

import numpy as np


class PopulationRaster:
    def __init__(self, path):
        import tifffile
        with tifffile.TiffFile(path) as t:
            page = t.pages[0]
            self.data = page.asarray().astype("float64")
            tags = {tag.code: tag.value for tag in page.tags.values()}
        sx, sy = tags[33550][0], tags[33550][1]
        tp = tags[33922]
        self.x0, self.y0 = tp[3], tp[4]
        self.sx, self.sy = sx, sy
        nodata = float(tags.get(42113, -99999))
        self.data[self.data == nodata] = 0.0
        self.data[self.data < 0] = 0.0
        self.h, self.w = self.data.shape

    def cell_area_km2(self, lat):
        return (self.sx * 111.32 * math.cos(math.radians(lat))) * (self.sy * 110.57)

    def rowcol(self, lat, lon):
        return int((self.y0 - lat) / self.sy), int((lon - self.x0) / self.sx)

    def density(self, lat, lon, radius_km):
        """People per km^2 averaged over a window roughly matching the radius."""
        r, c = self.rowcol(lat, lon)
        if r < 0 or c < 0 or r >= self.h or c >= self.w:
            return None
        cell_km = self.sx * 111.32
        k = max(1, int(round(radius_km / cell_km)))
        win = self.data[max(0, r - k): r + k + 1, max(0, c - k): c + k + 1]
        return float(win.mean()) / self.cell_area_km2(lat)

    def adults_in_radius(self, lat, lon, radius_km, adult_share):
        d = self.density(lat, lon, radius_km)
        if d is None:
            return None
        return d * math.pi * radius_km ** 2 * adult_share


def load_ee_catchments(path):
    """CSV from earth_engine/catchment_export.js: uid, adults_20plus, buildings_latest, buildings_2016."""
    out = {}
    with open(path) as f:
        for row in csv.DictReader(f):
            def num(k):
                v = row.get(k, "")
                return None if v in ("", "null", "None") else float(v)
            out[row["uid"]] = {
                "adults": num("adults_20plus"),
                "buildings_latest": None if num("buildings_latest") is None else int(num("buildings_latest")),
                "buildings_2016": None if num("buildings_2016") is None else int(num("buildings_2016")),
            }
    return out


__all__ = ["PopulationRaster", "load_ee_catchments", "np"]
