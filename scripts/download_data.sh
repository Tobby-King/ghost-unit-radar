#!/usr/bin/env bash
# Download the three static public inputs (about 18 MB). No INEC live system is contacted.
set -euo pipefail
cd "$(dirname "$0")/../data" && mkdir -p raw && cd raw
curl -L -C - -o pu.csv https://raw.githubusercontent.com/mykeels/inec-polling-units/master/polling-units.csv
curl -L -o nga_adm1.geojson https://github.com/wmgeolab/geoBoundaries/raw/9469f09/releaseData/gbOpen/NGA/ADM1/geoBoundaries-NGA-ADM1_simplified.geojson
curl -L -C - -o nga_ppp_2020_1km.tif https://data.worldpop.org/GIS/Population/Global_2000_2020_1km/2020/NGA/nga_ppp_2020_1km_Aggregated.tif
ls -l
