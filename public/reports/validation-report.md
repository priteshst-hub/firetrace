# FireTrace dataset validation — actual NASA records obtained

Checked 8 November 2026. This report supersedes the earlier blocked-only status. The MODIS–VIIRS harmonization problem remains unchanged.

## Decision

Real historical observations for both sensors are downloaded and parsed. The basic data-access gate passes for a Collection 6 MODIS / VIIRS version 2 experiment. The exact originally requested MODIS C6.1 gate remains unmet: every selected MODIS record says 6.03. Do not call these C6.1 data. Calibration and scientific validity are not yet established.

## Official source and retrieval

Source: https://firms.modaps.eosdis.nasa.gov/country/ . This public page links annual all-country ZIP archives and labels the dataset Standard Processing. No account, API key or authentication was used. Four Australia CSV members were retrieved from the linked 2019 and 2020 MODIS and viirs-snpp ZIPs using HTTP byte ranges. Each member was decompressed and checked against the ZIP CRC32 and uncompressed size. The entire global ZIPs were not downloaded. The interrupted partial ZIP from an initial full-download attempt has been renamed .partial; it is not an input.

Exact source URLs, original member names, UTC retrieval times and SHA-256 hashes are in provenance.json. Untouched CSV members are in raw/. retrieve.py reproduces retrieval with Python standard library only. validate.py reproduces filtering and counts. Run python3 firetrace-data-gate/retrieve.py then python3 firetrace-data-gate/validate.py from the workspace.

NASA GIBS documentation explicitly maps 6.03 to Collection 6 standard processing, separately from 6.1: https://nasa-gibs.github.io/gibs-api-docs/python-usage/ . No equivalence to C6.1 is assumed.

## Selection and actual counts

Inclusive coordinates: 140 <= longitude <= 154, -39 <= latitude <= -29. Inclusive acquisition dates: 2019-09-01 to 2020-03-31; 213 calendar days. UTC acquisition timestamps are preserved as source strings. Country membership is inherited from NASA Australia CSVs; this is a country-clipped bounding-box extract, not a verified all-surface global bounding-box query. Offshore detections omitted by the country assignment cannot be ruled out.

| Measure | MODIS | VIIRS S-NPP |
|---|---:|---:|
| All Australia source rows, 2019–2020 | 466,008 | 2,427,931 |
| Selected hotspot observations | 106,390 | 569,166 |
| Exact duplicate selected rows | 0 | 0 |
| Days with detections / 213 | 210 | 212 |
| Invalid source coordinates/date/time | 0 | 0 |
| Selected negative or non-finite FRP | 0 | 155 |

| Month | MODIS | VIIRS S-NPP |
|---|---:|---:|
| 2019-09 | 3,784 | 25,781 |
| 2019-10 | 3,456 | 19,722 |
| 2019-11 | 25,530 | 140,252 |
| 2019-12 | 42,508 | 221,159 |
| 2020-01 | 26,045 | 138,904 |
| 2020-02 | 3,878 | 17,983 |
| 2020-03 | 1,189 | 5,365 |

Both start and end dates have detections. Both peak in December 2019. This establishes overlapping fire-activity observations, not equal sampling or complete valid satellite coverage. Three MODIS dates and one VIIRS date have no rows; that does not establish no fire.

MODIS: Terra 46,859; Aqua 59,531. Day 55,749; night 50,641. Version 6.03 only; confidence spans 0–100. VIIRS: satellite N only; version 2 only. Day 200,427; night 368,739. Confidence low 23,597; nominal 499,591; high 45,978. These confidence encodings must not be treated as a shared numerical scale.

## Quality findings and scientific limits

- 155 VIIRS records have negative FRP values. They remain unchanged in raw and filtered files and are flagged for exclusion or investigation before FRP aggregation. Negative values are not valid nonnegative radiative-power measurements; their processing cause has not been established here.
- Counts retain all source type and confidence classes. MODIS type counts: 0=105,959; 2=368; 3=63. VIIRS: 0=566,235; 2=2,222; 3=709. A vegetation-fire analysis must define and document type filtering against the relevant product guide before fitting a model.
- No source coordinate/date/time parse errors or exact duplicate selected rows were found. No claim is made that every other physical field has been exhaustively validated.
- VIIRS has about 5.35 times as many selected rows as MODIS. This is an observed count ratio, not a harmonization coefficient, accuracy measure, or unique-fire ratio. Different pixel sizes, overpasses, confidence classes and detection thresholds matter.
- These CSVs record detections; they do not contain the full cloud/clear/non-fire observation denominator required to establish sampling completeness.
- One extreme seven-month season is sufficient for an initial loading/aggregation experiment, not a transferable long-term harmonization model. A calibration needs a longer overlap period, held-out validation, day/night controls and spatial aggregation.
- No UI, harmonization model, event classification or claimed calibrated result was built.

## Files

- filtered/modis_SE_Australia_20190901_20200331.csv: 106,390 observations.
- filtered/viirs-snpp_SE_Australia_20190901_20200331.csv: 569,166 observations.
- filtered/*_daily_counts.csv: 213 dates per sensor, including dates with zero CSV detections.
- validation.json: machine-readable counts, version distributions, sample actual records, bounds and output SHA-256 hashes.
- provenance.json: source URLs and original CSV SHA-256 hashes.

## Remaining exact-product requirement

An authenticated FIRMS archive request is still needed for the originally specified C6.1 extract unless a separate official unauthenticated C6.1 route is verified. The archive offers email-code authentication as well as Earthdata; an existing Earthdata account is not the only offered route. This report does not represent the exact C6.1 requirement as complete.
