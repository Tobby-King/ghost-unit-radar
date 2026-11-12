/**
 * Ghost Unit Radar - Earth Engine catchment export (upgrade path).
 *
 * Computes, for every polling unit with a reliable coordinate:
 *   adults_20plus     WorldPop age-structured population (ages 20+, 100 m, 2020) within RADIUS_M
 *                     (20+ approximates 18+; document as a slight undercount)
 *   buildings_latest  Google Open Buildings 2.5D Temporal: buildings present in LATEST_YEAR
 *   buildings_2016    same, in 2016
 *
 * HOW TO RUN (about 10 minutes):
 *   1. Run the Python pipeline once; it writes data/out/units.csv.
 *   2. Make a points CSV with columns uid,lat,lon for ONE state:
 *        python pipeline/make_ee_points.py KANO      -> data/out/ee_points_KANO.csv
 *   3. code.earthengine.google.com -> Assets -> NEW -> CSV file -> upload it as table
 *      (set X = lon, Y = lat). Note the asset ID and paste it below.
 *   4. Paste this script, press Run, then Tasks -> RUN the export.
 *   5. Download the CSV from Google Drive to data/raw/ee_catchments.csv and run
 *        python pipeline/run_pipeline.py --ee data/raw/ee_catchments.csv
 *
 * Datasets (both public in the Earth Engine catalog, non-commercial use):
 *   WorldPop/GP/100m/pop_age_sex            (CC BY 4.0)
 *   GOOGLE/Research/open-buildings-temporal/v1  (CC BY 4.0 / ODbL)
 */
var POINTS_ASSET = 'projects/YOUR_PROJECT/assets/ee_points_KANO';  // <-- change me
var RADIUS_M = 1000;
var LATEST_YEAR = 2023;

var points = ee.FeatureCollection(POINTS_ASSET);
var region = points.geometry().bounds().buffer(5000);

// ---- WorldPop adults (20+) -------------------------------------------------------------
var wp = ee.ImageCollection('WorldPop/GP/100m/pop_age_sex')
  .filter(ee.Filter.eq('country', 'NGA')).filter(ee.Filter.eq('year', 2020)).first();
var adultBands = [];
[20, 25, 30, 35, 40, 45, 50, 55, 60, 65, 70, 75, 80].forEach(function (a) {
  adultBands.push('M_' + a); adultBands.push('F_' + a);
});
var adults = wp.select(adultBands).reduce(ee.Reducer.sum()).rename('adults_20plus');

// ---- Open Buildings Temporal: building presence per year -----------------------------
// building_presence is a 0-1 confidence at 4 m; threshold it, then count distinct buildings
// approximately via building_fractional_count (sum = estimated number of buildings).
function buildingsFor(year) {
  var col = ee.ImageCollection('GOOGLE/Research/open-buildings-temporal/v1')
    .filter(ee.Filter.calendarRange(year, year, 'year'))
    .filterBounds(region);
  return col.select('building_fractional_count').mosaic().rename('b_' + year);
}
var bLatest = buildingsFor(LATEST_YEAR).rename('buildings_latest');
var b2016 = buildingsFor(2016).rename('buildings_2016');

var stack = adults.addBands(bLatest).addBands(b2016).unmask(0);

var result = points.map(function (f) {
  var circle = f.geometry().buffer(RADIUS_M);
  var adultsSum = adults.reduceRegion({ reducer: ee.Reducer.sum(), geometry: circle, scale: 100, maxPixels: 1e9 });
  var bSum = bLatest.addBands(b2016).unmask(0).reduceRegion({ reducer: ee.Reducer.sum(), geometry: circle, scale: 4, maxPixels: 1e10 });
  return ee.Feature(null, {
    uid: f.get('uid'),
    adults_20plus: adultsSum.get('adults_20plus'),
    buildings_latest: ee.Number(bSum.get('buildings_latest')).round(),
    buildings_2016: ee.Number(bSum.get('buildings_2016')).round(),
  });
});

print('first rows', result.limit(5));
Map.centerObject(points, 8);
Map.addLayer(adults.clip(region), { min: 0, max: 50, palette: ['white', 'orange', 'red'] }, 'adults 20+');
Map.addLayer(points, { color: 'blue' }, 'polling units');

Export.table.toDrive({
  collection: result,
  description: 'ghost_unit_radar_catchments',
  fileFormat: 'CSV',
  selectors: ['uid', 'adults_20plus', 'buildings_latest', 'buildings_2016'],
});
// `stack` kept for interactive inspection: Map.addLayer(stack.select('buildings_latest'), {min:0,max:1});
