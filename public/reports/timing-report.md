# FireTrace timing comparison — 10 November 2026

## Decision

Use Aqua versus S-NPP as the first candidate for a future calibration study; keep Terra separate. This follows from measured timestamp compatibility in this dataset. No calibration was fitted. The current MODIS inputs remain C6 (6.03), not C6.1.

## Completed

Compared platform-specific acquisition timing using type-0 records with the existing confidence choices (MODIS >=30; VIIRS n/h). Retained observations: Terra 42,200; Aqua 54,985; S-NPP 542,727. Ran all combinations of 5/10/20 km equal-area grids, zero/half-cell origin shifts, and day/night/combined strata: 54 summary comparisons.

A common unit means the same grid cell, UTC date and source day/night label contains at least one retained detection from each compared platform. For every common unit, calculated the minimum absolute difference between the platforms’ distinct reported acquisition minutes. A unit counts once per comparison. Combined strata retain day and night as separate units.

## Primary 10 km results

| MODIS platform vs S-NPP | Common units | Median minimum gap | Within 15 min | Within 30 min | Within 60 min |
|---|---:|---:|---:|---:|---:|
| Terra | 8,656 | 144 min | 0.01% | 0.06% | 5.89% |
| Aqua | 10,792 | 25 min | 32.42% | 60.86% | 97.03% |
| Combined_MODIS | 15,261 | 36 min | 22.93% | 43.04% | 69.50% |

Percentages use common detection units as their denominator. They are not percentages of all fires, all observations, or all valid satellite coverage.

## Day/night detail, primary grid

| Pair | Stratum | Common units | Median minimum gap | Within 30 min |
|---|---|---:|---:|---:|
| Terra / S-NPP | D | 3,428 | 206 min | 0.00% |
| Terra / S-NPP | N | 5,228 | 109 min | 0.10% |
| Aqua / S-NPP | D | 6,565 | 22 min | 62.50% |
| Aqua / S-NPP | N | 4,227 | 25 min | 58.32% |
| Combined_MODIS / S-NPP | D | 8,166 | 30 min | 50.24% |
| Combined_MODIS / S-NPP | N | 7,095 | 46 min | 34.76% |

## Interpretation and limits

The original same-day spatial overlap includes many observations separated by hours, especially for Terra. Combining Terra and Aqua conceals this difference. Aqua has substantially more temporally compatible detections, but this alone does not establish equivalent sensitivity, valid conversion factors or interchangeable confidence classes.

- A minimum time gap can be small even if other detections within the unit are far apart. This is a unit-level diagnostic, not one-to-one pixel matching.
- Detections in a common cell may represent different fires. Detections across cell boundaries are omitted. Grid size and origin remain sensitivity choices.
- The same UTC-date restriction misses possible cross-midnight pairs. No modulo-day wrapping was used.
- No fire-free/cloud/valid-observation denominator is available in these CSVs. Neither unmatched nor absent detections establish sensor error.
- The 15/30/60-minute windows are exploratory choices, not validated universal collocation thresholds.
- This one extreme season cannot establish long-term model transferability.

## Verification

Input hashes and retained counts reconcile with the previous analysis. All 18 combined-platform occupancy partitions exactly reproduce the prior grid analysis. Window counts are monotonic and bounded by common units. Known minimum-gap cases, including a midnight non-wrapping case, passed.

## Reproduce and inspect

Run `python3 firetrace-analysis/temporal.py` from the workspace.

- outputs/temporal_sensitivity.csv: all 54 comparisons.
- outputs/temporal_common_units_10km.csv: primary-grid unit-level minimum gaps.
- outputs/temporal-analysis.json: input hashes, primary results, method and verification.

## Next scientific gate

Before fitting a continuity model, obtain consistent MODIS C6.1 records and per-overpass fire masks/quality/geolocation with usable observation coverage, then assemble multiple overlap years. The tested science-file route is authentication-blocked. Continue using the present results as descriptive evidence only.
