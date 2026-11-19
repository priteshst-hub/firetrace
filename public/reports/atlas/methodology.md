# FireTrace experimental occupancy bridge 1.0

This product is **EXPERIMENTAL**, not validated observation-adjusted harmonization. It is a relative sensor-continuity indicator, not unique fires, burned area, severity, hazard probability or an operational warning.

## Reproduce

```sh
python3 tools/atlas_pipeline.py acquire
python3 tools/atlas_pipeline.py derive
python3 tools/verify_atlas.py
```

Acquisition uses at most two simultaneous downloads and one streaming processor, with resumable files and per-year checkpoints. Raw global country ZIPs and original Australia CSV.gz files stay in ignored `.firms-cache/`. Each ZIP is fully SHA-256 hashed and compared with the NASA SHA-256 HTTP metadata when provided. The Australia ZIP member is consumed to EOF, verifying its CRC. Other countries' member CRCs are not tested. HTTP failures are recorded in `acquisition-failures.json`; missing years are never converted into zero-fire years. Re-running skips completed per-year checkpoints. To rebuild a source from an existing cached ZIP, remove only its `public/reports/atlas/source-*.json` checkpoint and rerun. Do not delete source research data.

`source-*.json` records exact source URL, byte count, hash, selected member, calendar year, source version distribution, platform distribution, observed date extent, filtering, retained count and duplicate count. Dates describe reported detections, not all valid observing opportunities. 2012 S-NPP starts after January 1; Aqua 2002 is partial; pre-July Aqua statistics are null and platform availability is false, not a zero-detection observing record. Standard country archives may have a different collection from the current archive-request service. Use the versions actually observed; do not relabel C6 as C6.1.

## Common observation framework

Spherical Lambert cylindrical equal-area coordinates in kilometres:

`x = R × lon_radians × cos(-34°)`

`y = R × sin(lat_radians) / cos(-34°)`

`R = 6371.0088 km`, origin `(0°,0°)`. Cell indices are `floor(x/25), floor(y/25)`. Grid ID `CEA25:x:y`. A 25 km cell has 625 km² equal area on this declared sphere. It is larger than either nominal pixel and reduces sensitivity to small coordinate differences, at the cost of mixing potentially unrelated fires. It does not represent intersected sensor footprints. Original coordinates, acquisition time, platform, confidence, version and other source fields remain in the compressed local CSVs.

Time units are UTC calendar date × original day/night flag. For each platform count at most one occupied window per cell and unit, even if many adjacent pixels report. Monthly raw pixel counts remain separate and retain Terra, Aqua and Suomi-NPP identities. Exact filtered-row duplicates are removed with a disk-backed SQLite primary key. Distinct overpass/pixel records remain raw observations, never unique fire incidents.

For acquisition diagnostics, acquisition-minute groups are paired one-to-one on identical grid/date/day-night units: ascending Aqua minute, nearest unused S-NPP group, earlier minute breaks ties. Sensitivity windows are 15, 30 and 60 minutes. Adjacent-cell and cross-midnight matches are excluded. These are detection-conditional comparisons, not verified common clear-sky observations.

## Derived indicator

Let A and V be Aqua and S-NPP occupied date/day-night window counts in a cell-month. Fit an origin-constrained least-squares bridge `b = Σ(A V) / Σ(V²)` on earlier overlap years, 2012–2018, for cell-months positive in both sensors outside southeastern Australia (140–154°E, 39–29°S by cell centre).

The VIIRS bridge score is `P = min(62, max(0, b V))`. The ceiling is the maximum possible date/day-night windows in a 31-day month, not a validated detection limit. The overlapping common-unit indicator is `(A + P) / 2`. This is an equal-weight average of Aqua occupancy and predicted Aqua-equivalent occupancy, **not addition of MODIS and VIIRS pixel counts**. Equal weighting is a declared continuity choice without evidence of optimal sensor reliability. Terra counts remain separate to avoid adding a different overpass schedule. Before VIIRS, 2003 onward is an Aqua-only baseline; 2001–2002 is a Terra-only baseline, a genuine discontinuity clearly labelled in each row. Missing sensor data are null. Cell-months with Terra reports but neither Aqua nor VIIRS reports publish a null common indicator rather than treating missing reference-platform evidence as zero activity. A MODIS-only baseline with no reports from its reference platform also publishes null. An unreported cell/window has unknown exposure and is not a confirmed fire-free unit.

The bridge reduces count-resolution sensitivity through occupancy, but does not physically correct nominal 1 km vs 375 m pixels, scan-dependent footprint, sensitivity, orbital drift, or differing confidence algorithms. MODIS confidence ≥30 and VIIRS nominal/high are source-specific filtering choices, not equivalent probabilities. Type 0 includes presumed vegetation fires, including non-wildfire burning. No additional VIIRS platforms are mixed into this product.

## Validation and uncertainty

Fixed time splits: fit 2012–2018; calibrate absolute bridge residuals in 2019–2020; evaluate on distinct 2021 onward. Southeastern Australia is excluded from fit and interval calibration and scored separately. MAE, RMSE and signed bias reference observed **Aqua occupancy**, not independent fire truth. The blended score itself is not tested against Aqua because it contains Aqua. Evaluation is restricted to positive pairs, and the report identifies this support limitation. Raw occupancy is the main baseline in common units. Separately, raw VIIRS pixel counts and the preserved previous pixel coefficient are evaluated against Aqua pixel counts on the same positive cell-month support. These pixel-count MAEs have different units from occupancy MAEs and cannot be compared numerically across targets. Transfer of the old matched-window coefficient to whole cell-month totals is a weak baseline, not a reproduction of its original experiment. The original experiment is preserved unchanged.

A 90% split-residual quantile uses rank `ceil((n+1)×0.9)`, capped at n, on absolute 2019–2020 residuals. Bridge bounds clip to [0,62]; blended bounds average those with observed A. This is an empirical disagreement interval, not total uncertainty or a guaranteed confidence interval. Climate/season dependence, spatial autocorrelation, support selection, collection shifts and missing exposure defeat a claim of exchangeability. Report actual later-year coverage. Do not sum per-cell bounds to claim a calibrated annual interval. Single-sensor baselines have no supported uncertainty interval and publish null bounds.

## Coverage blocker

FIRMS detection-only country CSVs do not supply full cloud, non-fire, valid land and unobserved pixel masks. Those require separate science/geolocation products and authenticated access where applicable. Fresh unauthenticated probes in `mask-access-probes.json` record HTTP 401 for the tested MOD14.061, MYD14.061 and VNP14IMG.002 science-mask files. Earthdata authorization is required for those exact URLs. This upgrade does not claim those masks were obtained. Without them, absence of reports cannot distinguish no fire, cloud, missing swath or detector sensitivity. Independent burned-area/ground reference data have not been obtained either. Fully validated harmonization and operational fire-detection accuracy remain unsupported.

## Machine-readable schema

Per-year gzip-compressed JSON arrays and CSVs (`.json.gz`, `.csv.gz`): `year`, `month`, `grid_id`, grid-centre `longitude`/`latitude`, `source_availability`, literal `source_versions`, three platform-specific raw report counts, `aqua_occupied_windows`, `viirs_occupied_windows`, `indicator_unit`, `activity_estimate`, `activity_lower`, `activity_upper`, `method`, `status`, `quality_flags`, `missing_data_status`, `calibration_provenance`. Object/list values in CSV are JSON strings. The sparse dataset materializes cell-months with at least one retained source report; missing rows must not be interpreted as zero-fire observations. The index contains monthly/annual chart inputs, source inventory and output SHA-256 hashes.

## Official references

- [FIRMS archive service](https://firms.modaps.eosdis.nasa.gov/download/)
- [FIRMS Area API](https://firms.modaps.eosdis.nasa.gov/api/area/)
- [NASA detection/confidence and missed-fire notes](https://firms.modaps.eosdis.nasa.gov/alerts/notes.php)
- [VIIRS product description](https://firms.modaps.eosdis.nasa.gov/content/descriptions/FIRMS_VIIRS_Firehotspots.html)
