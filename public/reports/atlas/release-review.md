# FireTrace release review

**Scientific and operational requirements are not fully satisfied.** The expanded source archive and experimental derived product are implemented. Coverage-adjusted harmonization and authenticated current monitoring remain incomplete.

## Acceptance matrix

| Requirement | Status | Evidence |
|---|---|---|
| Actual official historical archives acquired | COMPLETE | index.json source URLs; source-*.json; original ignored .firms-cache/*.zip |
| Source provenance, date validation and SHA-256 recorded | COMPLETE | All source audits and NASA-published hashes; actual source date extents |
| More than two populated years shown | COMPLETE | 25 populated MODIS years; Historical Atlas browser check |
| Instrument/platform/version distinctions preserved | COMPLETE | source_versions in every cell-month; literal version register; version-change flags and by-version evaluation |
| Missing periods are not zero fire years | COMPLETE | Unavailable sources explicit; pre-VIIRS nulls; absent reference activity null; exposure UNKNOWN |
| Common equal-area grid and UTC units | COMPLETE | 25 km spherical Lambert CEA; date × day/night occupancy; methodology.md |
| Actual unified derived dataset generated | COMPLETE | 545347 cell-month rows; /data/atlas/YYYY.json.gz and .csv.gz |
| Incompatible raw sensor counts are not added | COMPLETE | Raw Terra/Aqua/S-NPP columns separate; indicator averages common-unit occupancy scores |
| Calibration method documented | COMPLETE | methodology.md and validation.json; fixed training/calibration/test splits |
| Independent multi-year temporal holdout | COMPLETE | Train [2012, 2013, 2014, 2015, 2016, 2017, 2018]; holdout [2021, 2022, 2023, 2024, 2025]; reference is Aqua occupancy, NOT fire truth |
| Uncertainty and unmatched observations reported | COMPLETE | Empirical residual interval; unmatched 15/30/60 minute diagnostics; unsupported rows have null intervals |
| Reproducible outputs | COMPLETE | atlas_pipeline.py; source hashes; pipeline SHA; deterministic gzip; verify_atlas.py |
| Scientific status accurately labelled | COMPLETE | EXPERIMENTAL throughout; no exposure adjustment or independent fire-accuracy claim |
| Server-side FIRMS Area integration code | COMPLETE | worker/firms.ts; fixed area/sources; request parsing, cache, timeout and rate limit |
| Credentials remain server-side | COMPLETE | FIRMS_MAP_KEY Worker secret only; browser uses /api/firms; no key supplied or committed |
| Freshness, stale data and error states | COMPLETE | Timestamp separation; stale thresholds; local HTTP 503 observed; mocked valid/partial/invalid response tests |
| Historical Atlas works | COMPLETE | Desktop/mobile year and period selectors, real monthly rows, download verification |
| Harmonization Lab works | COMPLETE | Actual coefficient, holdout scores and limitations loaded in browser |
| Historical COMMAND preserved | COMPLETE | 11 JS tests include existing COMMAND; browser decision-brief export verified |
| Existing globe preserved | COMPLETE | Browser rotation paused, zoom and visible rendered globe; existing global CSV reconciled |
| Existing exports preserved | COMPLETE | Global CSV 4,055,050 MODIS / 17,051,416 VIIRS; Black Summer 97,185 / 542,727; COMMAND brief platform counts verified |
| No fabricated released data | COMPLETE | Official ZIP/member validation; complete field-by-field CSV/JSON and raw-count reconciliation |
| Desktop and mobile browser regression | COMPLETE | browser-regression.json; screenshots and downloaded files in ignored output/playwright and .playwright-cli |
| Python calculation tests | COMPLETE | engineering-checks.json; python-calculations exit code |
| TypeScript | COMPLETE | engineering-checks.json; typescript exit code |
| Cloudflare client build and Worker package | COMPLETE | engineering-checks.json; client build and deploy --dry-run exit codes |
| Production dependency audit | COMPLETE | dependency-audit.json: zero production vulnerabilities |
| Export validation and data reconciliation | COMPLETE | reconciliation.json: source totals, hashes, all JSON/CSV fields, mathematical equation and acquisition diagnostics |
| Browser regression | COMPLETE | browser-regression.json; actual local Cloudflare Worker |
| At least 20 MODIS years and 10 overlapping years | COMPLETE | 25 MODIS years, 14 overlapping years; target years without sources: [] |
| Fully observation-adjusted scientifically validated harmonization | BLOCKED | MOD14.061, MYD14.061, VNP14IMG.002 probes all HTTP 401; valid-observation/cloud masks absent; independent fire truth not acquired |
| Genuine authenticated LIVE/NRT request and parsed response | BLOCKED | No authorized MAP_KEY configured; no authenticated NASA request verified; exact secure configuration in live-configuration.md |
| End-to-end review of genuine current detections | PARTIAL | Recent-evidence review and downloads implemented; positive live workflow awaits genuine authenticated feed |
| Release preparation | COMPLETE | Current branch; checks and browser results attached; production NOT deployed |

## Actual source coverage and retained records

MODIS years: [2001, 2002, 2003, 2004, 2005, 2006, 2007, 2008, 2009, 2010, 2011, 2012, 2013, 2014, 2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025]. S-NPP years: [2012, 2013, 2014, 2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025]. Overlap: [2012, 2013, 2014, 2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025].

| Year | MODIS source / retained rows | VIIRS source / retained rows | Literal versions (MODIS / VIIRS) |
|---|---:|---:|---|
| 2001 | 235,315 / 221,119 | Unavailable | 6.2 / Unavailable |
| 2002 | 335,342 / 316,543 | Unavailable | 6.2 / Unavailable |
| 2003 | 212,359 / 200,048 | Unavailable | 6.2 / Unavailable |
| 2004 | 312,386 / 295,906 | Unavailable | 6.2 / Unavailable |
| 2005 | 190,139 / 178,447 | Unavailable | 6.2 / Unavailable |
| 2006 | 304,651 / 288,171 | Unavailable | 6.2 / Unavailable |
| 2007 | 254,931 / 240,628 | Unavailable | 6.2 / Unavailable |
| 2008 | 183,518 / 173,006 | Unavailable | 6.2 / Unavailable |
| 2009 | 251,914 / 236,509 | Unavailable | 6.2 / Unavailable |
| 2010 | 120,558 / 113,415 | Unavailable | 6.2 / Unavailable |
| 2011 | 437,141 / 412,248 | Unavailable | 6.2 / Unavailable |
| 2012 | 474,964 / 448,180 | 2,143,784 / 1,936,613 | 6.2 / 2 |
| 2013 | 190,517 / 179,532 | 947,248 / 841,213 | 6.2 / 2 |
| 2014 | 256,921 / 242,254 | 1,216,712 / 1,074,779 | 6.2 / 2 |
| 2015 | 239,462 / 226,031 | 1,143,155 / 1,009,578 | 6.2 / 2 |
| 2016 | 159,223 / 150,199 | 777,831 / 691,033 | 6.2 / 2 |
| 2017 | 273,312 / 259,358 | 1,241,741 / 1,097,139 | 6.2 / 2 |
| 2018 | 307,359 / 289,765 | 1,470,574 / 1,311,116 | 6.03 / 2 |
| 2019 | 310,484 / 289,988 | 1,580,240 / 1,425,218 | 6.03 / 2 |
| 2020 | 155,524 / 144,556 | 847,691 / 754,713 | 6.03 / 2 |
| 2021 | 171,948 / 162,266 | 819,461 / 721,087 | 6.03 / 2 |
| 2022 | 160,278 / 150,901 | 804,720 / 708,930 | 6.03 / 2 |
| 2023 | 395,733 / 373,213 | 1,855,272 / 1,660,102 | 61.03 / 2 |
| 2024 | 223,807 / 210,724 | 979,867 / 881,613 | 61.03 / 2 |
| 2025 | 255,336 / 239,970 | 1,251,438 / 1,127,201 | 61.03 / 2 |

No absent year is labelled fire-free. Source-first/source-last are detection date extents, not proof of complete observation coverage. January 2012 S-NPP and Aqua 2002 are partial mission-start periods. Terra 2001–2002 is a distinct baseline. Exact URLs, hashes, member CRC status, version distributions and filtering counters are in the source audits and source inventory.

## Unified product and mathematical method

545,347 cell-month rows; 21,283,312 reconciled retained reports. Index: `/data/atlas/index.json`; per-year gzip JSON and CSV: `/data/atlas/YYYY.json.gz`, `/data/atlas/YYYY.csv.gz`. Derivation peak process RSS: 692.0 MiB.

Schema: year, UTC month, CEA25 grid ID and grid-centre coordinates/reference, source availability and literal versions, raw Terra/Aqua/S-NPP report counts, Aqua/VIIRS occupied windows, indicator unit, derived activity and empirical interval, method, status, quality flags, unknown-exposure status and calibration provenance.

The equal-area 25 km grid uses R=6371.0088 km and standard parallel −34°. Occupancy collapses multiple pixels into one cell/date/day-night window per platform. Fit b=Σ(AV)/Σ(V²) outside southeastern Australia on earlier overlap years. Predict P=min(62,bV); overlapping experimental indicator=(A+P)/2. Pre-VIIRS records are MODIS-only baselines, never invented VIIRS values. Raw pixel counts are not added. Terra-only cell-months without reference-platform evidence publish null.

Coefficient: 0.36900019516563587. Fit years [2012, 2013, 2014, 2015, 2016, 2017, 2018] (n=81098); interval calibration [2019, 2020] (n=17612); later holdout [2021, 2022, 2023, 2024, 2025].

## Actual holdout performance

| Target: Aqua occupied windows per cell-month | n | MAE | RMSE | Bias |
|---|---:|---:|---:|---:|
| VIIRS bridge | 64643 | 1.090395 | 1.580135 | -0.287585 |
| Raw VIIRS occupancy | 64643 | 4.337268 | 6.312444 | 4.283496 |

Nominal 90% empirical residual interval: holdout coverage 91.11%; calibration absolute residual quantile 2.631000. Split residual interval on VIIRS bridge; reported blended bounds propagate half residual width; exchangeability unsupported across climate/collection shifts. Holdout score tests bridge against Aqua, not blended self-reference.

Separate pixel-count reference (different units; never compare these errors numerically with occupancy errors):
- Raw VIIRS pixel count: n=64643, MAE=63.969726, RMSE=139.959637, bias=63.803026.
- Transferred previous matched-pixel coefficient: n=64643, MAE=4.648684, RMSE=8.559387, bias=-3.142841.

Full by-year, season, withheld southeast-region, collection/version-pair and training-period sensitivity results, plus 15/30/60 minute pairing and unmatched counts: `validation.json`. The original `tools/command_experiment.py` and `public/reports/command-experiment.json` remain unchanged.

## Scientific limitations

- No valid-observation/cloud masks: zeros are absence of retained reports, never verified absence of fire.
- Detection-conditional cell-month pairs select both sensors positive; unmatched observations are outside validated support.
- Overpass time differs; common day/night is not simultaneous observation. No physical pixel footprint intersection.
- MODIS Terra 2001/2002 baseline differs from Aqua baseline; Aqua 2002 is partial. Literal collection/version transitions are flagged, not physically corrected.
- OLS bridge handles occupied-window sensitivity empirically, not pixel-area correction or calibrated confidence probability.
- Previous experiment is evaluated separately against Aqua pixel-report counts; transfer to whole cell-month totals differs from its original matched-group support.
- No independent fire truth; no uncertainty in baseline, cloud exposure, geolocation, sensor drift or collection transitions.

The model estimates sensor agreement conditional on reported detections. It does not measure independent detection accuracy, recall, unique incidents, burned area, absolute severity, valid clear-sky exposure or warning lead time. The blended indicator includes Aqua, so validation tests only the VIIRS bridge against Aqua. Versions are preserved and transitions flagged, without claiming a validated correction across collections.

## Near-real-time status and secrets

Implemented: fixed-area Worker API, source-specific parsing, two UTC days, application retrieval vs acquisition vs unknown publication time, freshness/error handling, cache and rate limit, and separate COMMAND recent-evidence review/downloads. **No authenticated NASA live request has been verified.** No detections are manufactured on failure. All three tested science-mask URLs currently return HTTP 401; see `mask-access-probes.json` for exact URLs and timestamps.

Secure configuration (interactive secret prompt, never a browser/public variable):

```sh
npx wrangler secret put FIRMS_MAP_KEY --config wrangler.cloudflare.jsonc
```

See `live-configuration.md` for genuine authenticated staging verification. Until that succeeds, recent monitoring and end-to-end current-evidence review remain incomplete. No autonomous dispatch or evacuation instructions are supplied.

## Executed engineering checks

| Check | Exit code | Evidence |
|---|---:|---|
| production-dependency-audit | 0 | /reports/atlas/dependency-audit.json |
| python-calculations | 0 | /reports/atlas/checks/python-calculations.txt |
| javascript-regression | 0 | /reports/atlas/checks/javascript-regression.txt |
| typescript | 0 | /reports/atlas/checks/typescript.txt |
| changed-file-lint | 0 | /reports/atlas/checks/changed-file-lint.txt |
| data-and-export-reconciliation | 0 | /reports/atlas/checks/data-and-export-reconciliation.txt |
| cloudflare-client-build | 0 | /reports/atlas/checks/cloudflare-client-build.txt |
| cloudflare-worker-dry-run | 0 | /reports/atlas/checks/cloudflare-worker-dry-run.txt |

Browser regression status: PASS. Test details and actual observed outcomes: `browser-regression.json`.

## Files and release readiness

Complete file list: `files-changed.json`. Main changes: bounded acquisition/derivation/reconciliation tools; compressed atlas data and audits; HistoricalAtlas and RecentDetections components; existing page navigation and COMMAND mode link; Worker FIRMS route; regression tests; assistant reference update. No raw source archives are committed.

Branch: feature/harmonized-multidecade. Production has NOT been deployed. Historical experimental release is prepared for review. The scientific and authenticated-live blockers above remain in force.

After reviewing this evidence and the credential/scientific limitations, deploy the already-built assets only with:

```sh
npx wrangler deploy --config wrangler.cloudflare.jsonc
```

No push, force-push, history rewrite, production deployment or research-source deletion was performed.
