# FireTrace — NASA Space Apps Challenge 2026

[Open the deployed FireTrace website](https://firetrace-black-summer.priteshst.workers.dev/).

FireTrace explores historical **2019–2020 active-fire observations** from NASA FIRMS through an interactive globe, filters, comparisons and a project assistant. This public source release was prepared after submission; publishing this repository does not update the deployed site or the NASA submission.

## Data credit and scientific limits

Credit: [NASA Fire Information for Resource Management System (FIRMS)](https://firms.modaps.eosdis.nasa.gov/) and its MODIS Terra/Aqua and VIIRS Suomi-NPP data providers. Source URLs, collection labels, checksums and filtering details are retained in `public/reports/`. Natural Earth supplies the country boundaries. This independent project does not imply NASA endorsement.

These are satellite active-fire **observations**, not counts of unique fires, burned-area measurements, forecasts or emergency alerts. MODIS and VIIRS have different resolution, overpass timing and detection characteristics. Counts depend on filters, cloud/observation availability and country archive coverage. The project does **not** implement validated harmonization or calibration between sensors. Exploratory comparisons and holdout baselines are not scientific validation of harmonization. Do not use this prototype for operational safety decisions.

## AI and tool disclosure

AI-assisted tools were used in project development, coding, documentation and verification, including ChatGPT/Codex and the Sites scaffolding present in this repository. The deployed conversational assistant uses Cloudflare Workers AI with Meta Llama 3.3 70B (`@cf/meta/llama-3.3-70b-instruct-fp8-fast`). Its answers may contain errors; check them against the reports. AI-generated answers are not observational evidence or scientific validation. NASA observations remain attributed to their source providers.

## Local setup and public source scope

Use Node.js 22.13 or newer. Run `npm ci`, then `npm run build:cloudflare` to build the standalone frontend. To preview those static assets, run `npx vite preview --config vite.cloudflare.config.ts`; the AI endpoint requires a separately configured Cloudflare Worker and Workers AI access. No NASA API credentials are required to view the bundled aggregates. Deployment commands below are for maintainers and publish changes when explicitly run.

The repository includes the browser aggregates, research reports, processing scripts and source needed by the app. It excludes credentials, environment files, local hosting metadata, build output, QA captures, backup copies and raw NASA ZIP archives. Some processing scripts depend on sibling research directories that are not included; see their source paths before attempting a full data rebuild. The committed aggregates support building the frontend without downloading those archives. Older implementation and verification notes below describe prior milestones, not checks rerun for this public release.

React/Vinext interface using verified NASA FIRMS observations. Research prototype: no calibrated harmonization, live alerts or unique-fire counts.

Public source repository: [priteshst-hub/firetrace](https://github.com/priteshst-hub/firetrace).

## FireTrace Command

Select **FireTrace Command** in the main navigation to replay the Black Summer archive. The workspace uses FireTrace’s existing monthly 10 km grid data for southeastern Australia, September 2019 through March 2020 UTC. Filters search grid coordinates and review priority within the selected month. **Locate cell in Australia study** opens the same grid center and month on the existing map.

### Review rules

The monthly screen uses the selected month and earlier months in the replay only. The thresholds are unvalidated demonstrations and order analyst review.

| Priority | First matching rule |
| --- | --- |
| Insufficient evidence | Invalid cell or period, or zero retained observations in the selected month |
| Prompt verification | MODIS and VIIRS both report in the selected month and the cell has at least two occupied months through that month |
| Analyst review | Either of those conditions holds |
| Monitor | One instrument family reports in the selected month, the only occupied month through that point |

The source applies type 0, MODIS confidence ≥30 and VIIRS nominal/high filters. Recurring months record activity in the same cell. The count does not identify distinct passes, wildfires or periods of continuous burning. The archive lacks a coverage mask, so zero retained rows leave fire activity unknown.

The **dated archive extract** comes from hash-verified FIRMS source inputs for one retrospectively selected cell and a fixed UTC date window. The checkpoint reveals actual acquisition minutes, detection-pixel coordinates, platform and product quality. Use it to see how the next verification check changes as evidence accumulates. The full-month brief is a separate retrospective assessment. Acquisition time alone cannot establish ignition, publication time, time of ingest or alert latency.

The downloaded text brief includes the selected evidence, exact rule match, analyst disposition, tagged verification steps, source hashes and generation time. Disposition is kept until page reload and recorded in the downloaded brief. This is a non-operational research prototype. The near-real-time workflow is unavailable. It requires authorized server-side FIRMS access and feed verification. See the [NASA FIRMS Area API](https://firms.modaps.eosdis.nasa.gov/api/area/) and the [original Australia source register](public/reports/provenance.json).

### Local demonstration

```sh
npm run build:cloudflare
npx vite preview --config vite.cloudflare.config.ts
```

1. Open **FireTrace Command**. The default January 2020 cell at 37.2821° S, 149.1025° E contains 194 MODIS and 1,279 VIIRS reports and receives **Analyst review**.
2. In the **Dated archive extract**, advance from before the first retained record to January 4 at 04:00 UTC, then 13:29 UTC. The extract changes from 14 VIIRS rows to 16 rows across VIIRS and MODIS. Open the source rows to inspect detection coordinates and confidence.
3. Switch the monthly timeline to February 2020. The same cell has one MODIS and four VIIRS reports. With both families present and records in two months, the screen assigns **Prompt verification**.
4. Record **Seek independent evidence** and download the response brief. Read the evidence and generic verification steps back from the file.

```sh
node --test tests/firetrace-command.test.mjs
python3 scripts/build-command-sample.py --check
npx tsc --noEmit
npm run build:cloudflare
npm audit --omit=dev
git diff --check
```

The Python reconstruction requires the verified filtered CSVs from the sibling `firetrace-data-gate/filtered` directory, or an equivalent directory passed with `--input-dir`. The browser and Node tests use the committed archive assets.

## Current worldwide extension

The globe now supports separate MODIS Terra/Aqua and VIIRS Suomi-NPP layers for both 2019 and 2020, year/month/day-night/platform filters, country search and selection, annual comparisons and filter-labelled CSV. The original MODIS-only 2020 archive and both Australian views are preserved.

Exact verified source/retained counts, collections, dates, hashes, country timing diagnostics and exploratory holdout errors are published in `public/reports/history-validation.json` and companion reports. Source-date spans are not clear-sky observation coverage. MODIS remains C6 6.03; VIIRS is C2. A 2019-trained ratio baseline is evaluated on 2020, with country-block bootstrap uncertainty, solely as a weak comparator. **Calibration is blocked** by missing observation masks, C6.1 inputs and independent season/spatial validation. No conversion alters the globe counts.

Read [FIRETRACE-GUIDE.md](FIRETRACE-GUIDE.md) for architecture, processing, limitations and a five-minute demonstration. The same guide is published at `/reports/firetrace-guide.md`. QA and deployment evidence for this extension are in `qa/history-verification.md` and `qa/history-deployment.json` once verified.

Reproduce worldwide inputs and outputs:

```
python3 tools/fetch_history.py
python3 tools/prepare_history.py
python3 tools/verify_history.py
node tools/verify_global.mjs
npx tsc --noEmit
npm run build:cloudflare
```

The old implementation notes below describe the earlier MODIS-only milestone; their “VIIRS not loaded” statements apply only to that original selectable archive.

## Run

```
python3 tools/prepare_data.py
npm run dev -- --host 127.0.0.1
```

The data preparation requires the sibling firetrace-data-gate and firetrace-analysis folders. Generated public data are committed for standalone deployment. All 639,912 retained observations reconcile with verified analysis input hashes.

## Workflows

- Explorer: month, source day/night, Terra/Aqua filters, sensor visibility, zoom, cell inspector, accessible top-cell table and full filtered grid CSV export.
- Comparison: 5/10/20 km grids, day/night strata and 15/30/60 minute windows using actual temporal-analysis summaries.
- Methods: provenance, study boundary, filters, original collection labels, input hashes and downloadable reports.

Map marks are 10 km equal-area grid centers; reports document exact projection and filtering. Basemap is the public-domain Natural Earth 1:50m country geometry from https://github.com/nvkelso/natural-earth-vector. City labels provide orientation. The full observations remain in the sibling research folders. The web bundle includes reproducible aggregates and the bounded Command source-row extract.

## Design

See DESIGN.md for tokens, visual direction and scope. The generated design concept is a reference only; no synthetic observations or map imagery are used in the application.

## Direct Cloudflare deployment

Live public URL: https://firetrace-black-summer.priteshst.workers.dev

Run `npm run deploy:cloudflare` to build the standalone React app and deploy static assets with `wrangler.cloudflare.jsonc`. No ChatGPT sign-in is required. This deployment uses the public research aggregates and does not require a backend or NASA credentials. The original Sites deployment is maintained separately.

Build and TypeScript checks passed. Live explorer and timing navigation loaded successfully with expected counts and no browser console errors. A separate Python HTTP asset probe received 403, so no byte comparison is claimed. Receipt: qa/cloudflare-deployment.json.

## Global observatory — completed 11 November 2026

The default view is now a rotating orthographic globe, with drag, keyboard arrows, pause/play, zoom, expanded view, country search and selection, month/day-night filters and CSV export. The original southeastern Australian comparison remains under Australia study.

Two explicitly separate archives are available:

- Worldwide MODIS 2020: 4,055,050 retained records from 211 NASA country files, rendered as 1° geographic cell centers. Cell areas vary with latitude. No global VIIRS records are loaded.
- Whole-country Australia, September 2019–March 2020: 1,288,177 retained MODIS/VIIRS observations, rendered at 25 km equal-area grid centers. This expands beyond the original southeastern bounding box.

Natural Earth supplies 242 country/territory geometries. NASA country file names are mapped to those geometries, with some territories grouped under their parent country; the source-file list is shown for selected countries. Missing source files are labelled not loaded. Counts are archive rows, not deduplicated unique fires or a verified observation denominator; unassigned/ocean detections may be omitted by country archives.

Rebuild browser aggregates with `python3 tools/prepare_world_observations.py` and `python3 tools/prepare_globe_data.py`. These scripts use the retained source archives in sibling research directories and verify source checksums. `node tools/prepare_world.mjs` rebuilds simplified/winding-normalized geographic boundaries from the retained Natural Earth source.

Run `node tools/verify_global.mjs` for geometry orientation, country containment, source mapping and count reconciliation. Global provenance, collection values, filters and source hashes are in public/reports/world-validation.json. MODIS records remain C6 (6.03), not C6.1. Scientific harmonization is not implemented.

## Project assistant and Start here

The Start here page explains purpose, a five-minute workflow, practical audiences and scientific limits. The global view links directly to it. Ask FireTrace AI opens a real conversational assistant from every view.

Cloudflare serves `/api/chat` through `worker/firetrace-api.ts`, using the Workers AI binding and `@cf/meta/llama-3.3-70b-instruct-fp8-fast`. No browser API key is used. `worker/knowledge.json` is generated from the verified guide, audit and country mappings with `python3 tools/prepare_assistant.py`; regenerate it whenever these inputs change. Only matched country annual totals enter the model context, not every country's data. The assistant cannot inspect current globe filters or query raw observations.

Input/body/history bounds, same-origin browser checks, output token limits and Cloudflare rate limits protect the endpoint. Limits are 10 requests per minute per IP and 100 per minute per Cloudflare location for the shared key; these are approximate local safeguards, not a global billing cap. AI inference is subject to account usage/quota. Provider failures return 503 with a clear UI error and guide link, never a canned answer presented as AI.

Chat is retained in page memory, sent to Cloudflare for inference, and not stored by FireTrace in a chat database. Model responses render as escaped text. Reference links come from a server-controlled allowlist. The model can still make mistakes; prompts and sampled tests do not guarantee all answers are correct or injection-proof.

The installed local Workers simulator required `--compatibility-date 2026-05-22` and did not support AI inference. Local failure UI was tested; real answers and follow-up conversation were tested on the deployed Worker. Current Wrangler can be used for future development. The older PDF/guide describe the observation explorer before the AI feature.

## Near-time Aqua–VIIRS experiment

Command displays a separate experimental adjustment, with reproducible metrics and source hashes in `public/reports/command-experiment.json`. Run `python3 tools/command_experiment.py` with the verified sibling filtered inputs to reconstruct it. Matching uses one-to-one acquisition-minute groups within 30 minutes, the same 10 km equal-area cell, UTC date and day/night class. It excludes adjacent-cell and cross-midnight pairs. The deterministic greedy pairing is a protocol choice, without a claim of optimal incident matching.

A through-origin least-squares coefficient fitted on September–December 2019 is evaluated on January–March 2020. Matching is independent of that fit. The report includes MAE, RMSE, bias, pair counts, unmatched record counts and a seeded holdout-date block bootstrap. Aqua is the reference count, with no independent ground truth. This conditional experiment does not establish validated harmonization or change any raw counts or review priorities.

Available local inputs comprise the verified 2019 and 2020 Australia raw CSVs, corresponding global country ZIP archives, and the hash-verified September 2019–March 2020 regional filtered CSVs. No additional verified year was found. Reported detection dates cannot measure clear-sky coverage. Additional years require NASA FIRMS standard MODIS and VIIRS Australia archives with collection/version metadata, source URL, checksum and ZIP/member integrity checks, followed by date/count/filter reconciliation. Valid-observation/cloud masks and independent seasons and regions remain necessary for coverage-adjusted validation.
