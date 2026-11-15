# FireTrace scientific protocol — 10 November 2026

## What can be claimed now

The loaded country-clipped southeastern Australia observations support a reproducible descriptive comparison of MODIS C6 (6.03) and VIIRS S-NPP C2. They do not establish a calibrated sensor conversion, unique wildfire count, fire perimeter, burned area, detection accuracy, or complete satellite coverage. A source type of 0 means presumed vegetation fire; it does not distinguish wildfire from prescribed or agricultural burning.

Use the existing 10 km equal-area grid and UTC date × source day/night units for the descriptive baseline. Preserve raw inputs and source collection, satellite, acquisition date/time, confidence, scan, track, FRP, type, and file provenance. Keep count and occupancy outputs distinct. Missing rows mean no reported detection, with coverage unknown. A shared pixel grid does not make sensors simultaneous or equally sensitive.

## Product consistency gate

1. Current MODIS 6.03 files remain explicitly C6. Obtain C6.1 for both Terra and Aqua before claiming the originally specified C6.1 experiment. Never relabel or silently concatenate collections.
2. Check each new file's collection, processing class, date span, satellite, schema, hash and provenance. Use standard processing throughout; do not fill holes with NRT without a documented separate analysis.
3. Annual country ZIPs exclude anything NASA did not assign to Australia. Treat the study geometry as Australia-country membership intersected with [140,-39,154,-29], inclusive. A future full bounding-box extract needs a boundary reconciliation, particularly offshore.
4. Obtain several complete overlap years, preferably 2012–2020 for the initial historical experiment, using consistent available collections. First audit actual coverage and processing changes; availability is not assumed from mission launch dates.

## Analysis possible with detection CSVs

- Separate Terra, Aqua and S-NPP. Aqua versus S-NPP is a useful first comparison because their nominal overpass times are closer; actual acquisition timestamps must still be checked. Terra remains a separate stratum.
- Retain all source data. Primary exploratory filter: type 0; MODIS confidence >=30; VIIRS n/h. This is an analysis choice, not equivalent confidence probabilities. Compare all-confidence and high-only choices separately. The new platform_confidence_sensitivity.csv provides those counts by platform, month and day/night.
- Report raw detection counts, occupied cells, and monthly distributions for each sensor. Continue 5/10/20 km and half-cell-origin sensitivity. A larger coarse-grid Jaccard score is not better accuracy.
- Add weekly aggregation only with explicit UTC week boundaries; distinguish persistence across days from separate events. Near-midnight observations can fall on different UTC dates. Compare a declared local-time or timestamp-window alternative before interpretation.
- For descriptive timestamp matching, declare tolerances before examining results (for example 15, 30 and 60 minutes), use geographic distance/footprints, handle many-to-one matches explicitly, and prevent double counting. These are sensitivity settings, not scientifically validated universal thresholds.
- Keep FRP outside the count-based baseline. Flag negative, null and non-finite FRP; do not clamp them to zero. Zero is not automatically an invalid detection. VIIRS FRP retrieval can be apportioned among 375 m subpixels associated with a 750 m measurement; do not interpret every subpixel FRP as an independent measurement. Summed instantaneous MW is not fire energy without temporal integration and sampling assumptions.

## Coverage-aware extension — required for stronger inference

Public CMR metadata identifies MOD14/MYD14 V061 and VNP14IMG V002 swaths intersecting the region and dates (see evidence/cmr-summary.json). The spatial query finds intersecting swaths, not fully observed study cells. Metadata alone cannot establish clear sky or usable pixels.

Retrieve full L2 fire masks, quality flags and geolocation; interpret them using each product's guide. Build per-platform, per-overpass masks for valid observed land, cloud, non-fire, fire and missing/bad pixels. Compute valid observed area and observation opportunities in the common grid. Retain unknowns. Exclude or separately report units without adequate common observable support; specify a valid-area threshold prospectively and test its sensitivity. Cloud-obscured fire can still be systematically missing, so coverage adjustment is not complete correction of detection bias.

## Calibration and validation design — not yet executed

Target an explicitly named quantity: for example expected Aqua-like hotspot activity per valid observed cell-week, predicted from S-NPP counts plus acquisition/coverage covariates. This is a relative continuity product, not fire truth. A separate physical FRP-continuity study needs its own measurement assumptions.

Start with unconverted sensor series and common-grid occupancy as baselines. A global count-ratio baseline may be scored as a weak comparator but must not be shipped as the harmonization method. Candidate count models can use Poisson or negative-binomial regression, with coverage exposure only after that denominator exists, platform/day-night strata and season controls. Evaluate overdispersion and zero behavior; model choice is not settled in advance.

Use earlier complete years for training; reserve contiguous whole seasons and spatial blocks for development/testing. Hold the 2019–2020 Black Summer season out as an extreme-event stress test. Do not randomly split individual pixels or neighboring days: correlated fires would leak across splits. Fit thresholds, normalizers and hyperparameters on training data only. Report held-out MAE, bias, error by activity decile, seasonal timing, spatial blocks and day/night; compare each against the baselines. Use spatial/temporal block bootstrap intervals rather than independent-pixel intervals. Publish block boundaries, random seeds and all failed comparisons.

Success requires repeatable held-out improvement over the declared baseline, acceptable predeclared bias for the intended use, and uncertainty that is useful to that use. Set those acceptance limits before fitting; there is no defensible universal percentage supplied by the present CSVs. External burned-area or perimeter products can assess spatial/seasonal plausibility, but are not interchangeable ground truth for instantaneous thermal detections.

## Stop conditions

Do not publish a harmonized calendar if collections remain mixed, valid-observation coverage is unmeasured for a coverage-dependent claim, held-out skill fails, or calibration is based solely on this extreme season. A defensible deliverable now is a sensor comparison with explicit uncertainty and provenance.

## Primary references

- FIRMS archive and authentication: https://firms.modaps.eosdis.nasa.gov/download/
- Public annual country downloads: https://firms.modaps.eosdis.nasa.gov/country/
- API sources, key requirement and five-day request limit: https://firms.modaps.eosdis.nasa.gov/api/area/
- MODIS C6/C6.1 product guide: https://www.earthdata.nasa.gov/s3fs-public/2023-09/MODIS_C6_C6.1_Fire_User_Guide_1.0.pdf
- VIIRS C2 375 m guide: https://www.earthdata.nasa.gov/s3fs-public/2024-07/VIIRS_C2_AF-375m_User_Guide_1.0.pdf
- NASA VIIRS product overview: https://viirsland.gsfc.nasa.gov/Products/NASA/FireESDR.html

The statistical design above is a proposed FireTrace protocol, not a NASA-endorsed algorithm.
