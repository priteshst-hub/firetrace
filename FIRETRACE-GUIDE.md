# FireTrace: what you built and how to demonstrate it

FireTrace is a historical satellite observation explorer and a reproducible sensor-comparison workspace. It is not an emergency warning system, a wildfire counter, or a calibrated global fire record.

## What the globe shows

Orange marks summarize MODIS Terra/Aqua detections; green marks summarize VIIRS Suomi-NPP detections. A mark is the center of an aggregated geographic cell, not the exact location or size of one fire. Multiple satellite reports can describe the same fire over time. Type 0 is presumed vegetation fire, including possible agricultural or prescribed burning.

The worldwide historical archive offers 2019 and 2020. The original MODIS-only 2020 globe remains selectable. The Australian whole-country archive and original southeastern Black Summer study remain separate. A country border being visible does not prove records or clear-sky observations exist there.

## Data journey

1. Download genuine annual country ZIPs from NASA FIRMS. Preserve each original file.
2. Verify SHA256 against the NASA response metadata and test ZIP integrity. Read every CSV row and check its date and collection; validate coordinates, acquisition time, satellite and day/night for retained detections.
3. Retain type 0; MODIS confidence at least 30; VIIRS nominal/high confidence. These are declared analysis choices, not equivalent probabilities.
4. Group reports into country × month × 1-degree geographic cells, preserving six channels: Terra day/night, Aqua day/night, VIIRS day/night. Geographic cells have different physical areas at different latitudes.
5. Reconcile source rows = retained + excluded rows. Reconcile cell, country and yearly totals. Preserve hashes and collection values in downloadable audits.
6. Serve small aggregates to the browser. Raw archives remain in the research workspace rather than being downloaded by every visitor.

NASA country assignment determines the country totals. Some territory source files are grouped under a parent country geometry. Offshore/unassigned detections may be absent. Zero reports cannot distinguish no fire from an unusable observation.

## Sensor timing and calibration

The global timing analysis compares detections within the same quarter-degree geographic cell, country, UTC date and source day/night. It records the smallest absolute acquisition-time gap separately for Terra–VIIRS and Aqua–VIIRS. The 15/30/60-minute thresholds are exploratory. A close pair is not proof that two sensors saw the same fire. Different UTC dates are never wrapped around midnight.

The original Australian study uses its own 5/10/20 km equal-area grids; its numbers must not be compared directly to the global quarter-degree diagnostic as if the methods were identical.

A weak baseline learns one Aqua/VIIRS count ratio per country from positive-report months in 2019 and evaluates predictions against 2020 Aqua counts. Nothing from 2020 fits those ratios. Its held-out MAE, bias and unconverted-VIIRS baseline are reported. Resampling whole countries 500 times gives an exploratory interval for mean absolute error. It is not a prediction interval for a cell and does not quantify cloud bias or all scientific uncertainty.

Calibration remains blocked. Detection CSVs lack valid-observed-area/cloud/non-fire masks. MODIS is C6 (6.03), not C6.1. Two calendar years do not provide independent full-season and spatial validation, and the calendar split divides Black Summer. There is no justified universal conversion between the sensors. FireTrace never changes displayed source counts using this baseline.

## Architecture

The interface uses React and TypeScript. D3 supplies country geometry, globe projection and hit testing; Canvas draws the globe. Filtered counts and chart series are computed from the same aggregates used for CSV export. Point directions are cached; drawing updates are coalesced to avoid repainting for every pointer event. Years load on demand and stay cached in the session.

Python scripts perform the offline data processing. JSON files and downloadable scientific reports are static public assets. Vite builds the frontend. A Cloudflare Worker serves those assets at the existing public URL; no database, NASA login or API secret is needed to view it. This separation keeps the site simple but means new archive years require an explicit download, validation, rebuild and deployment.

## Five-minute demo

1. Open the global archive. Explain that these are historical detections, not live emergencies.
2. Find India or Brazil by search; show country selection, drag, rotation, pause and zoom. Orange and green are different sensors, not two categories of wildfire.
3. Select a month, night, then Aqua. Explain why closer overpass timing matters. Visibility switches only hide layers; numeric totals keep the selected data filters.
4. Export CSV. Explain its period, platform, scope and grid-center columns.
5. Change year. Use the annual table to compare 2019/2020 under the same country/day/platform filters. The annual table intentionally ignores the month filter. Raw changes are not coverage-adjusted trends.
6. Expand timing, coverage and harmonization details. State plainly that calibration is blocked and show the downloadable evidence.
7. Switch to original MODIS 2020, then open the Black Summer study, timing comparison and methodology to show the preserved research.

## Reproduce

Run `python3 tools/fetch_history.py` to retrieve or verify the four input ZIPs, then `python3 tools/prepare_history.py`. Run `python3 tools/verify_history.py`, `node tools/verify_global.mjs`, `npx tsc --noEmit` and `npm run build:cloudflare`. Deploy using `npm run deploy:cloudflare`; deployment is only complete once the live files and workflows have been checked.

The machine-readable results in `public/reports/history-validation.json` are the source of exact counts and scores. The final QA report records checks actually performed, including any remaining failures.
