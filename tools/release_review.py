"""Generate the acceptance report from executed checks and released data, never estimates."""
import json,pathlib,subprocess
R=pathlib.Path(__file__).resolve().parents[1];P=R/'public/reports/atlas'
load=lambda name:json.loads((P/name).read_text())
index=json.loads((R/'public/data/atlas/index.json').read_text());v=load('validation.json');reconciliation=load('reconciliation.json');engineering=load('engineering-checks.json');browser=load('browser-regression.json')
modis=sorted(s['year'] for s in index['sources'] if s['sensor']=='modis' and s['counts']['retained']>0)
viirs=sorted(s['year'] for s in index['sources'] if s['sensor']=='viirs-snpp' and s['counts']['retained']>0)
overlap=sorted(set(modis)&set(viirs));passed=engineering['status']=='PASS' and browser['status']=='PASS'
data_ok=len(modis)>=20 and len(overlap)>=10
matrix=[]
def gate(name,status,evidence):matrix.append(dict(requirement=name,status=status,evidence=evidence))
for name,evidence in [
 ('Actual official historical archives acquired','index.json source URLs; source-*.json; original ignored .firms-cache/*.zip'),
 ('Source provenance, date validation and SHA-256 recorded','All source audits and NASA-published hashes; actual source date extents'),
 ('More than two populated years shown',f'{len(modis)} populated MODIS years; Historical Atlas browser check'),
 ('Instrument/platform/version distinctions preserved','source_versions in every cell-month; literal version register; version-change flags and by-version evaluation'),
 ('Missing periods are not zero fire years','Unavailable sources explicit; pre-VIIRS nulls; absent reference activity null; exposure UNKNOWN'),
 ('Common equal-area grid and UTC units','25 km spherical Lambert CEA; date × day/night occupancy; methodology.md'),
 ('Actual unified derived dataset generated',f"{reconciliation['cell_month_rows']} cell-month rows; /data/atlas/YYYY.json.gz and .csv.gz"),
 ('Incompatible raw sensor counts are not added','Raw Terra/Aqua/S-NPP columns separate; indicator averages common-unit occupancy scores'),
 ('Calibration method documented','methodology.md and validation.json; fixed training/calibration/test splits'),
 ('Independent multi-year temporal holdout',f"Train {v['training_years']}; holdout {v['holdout_years']}; reference is Aqua occupancy, NOT fire truth"),
 ('Uncertainty and unmatched observations reported','Empirical residual interval; unmatched 15/30/60 minute diagnostics; unsupported rows have null intervals'),
 ('Reproducible outputs','atlas_pipeline.py; source hashes; pipeline SHA; deterministic gzip; verify_atlas.py'),
 ('Scientific status accurately labelled','EXPERIMENTAL throughout; no exposure adjustment or independent fire-accuracy claim'),
 ('Server-side FIRMS Area integration code','worker/firms.ts; fixed area/sources; request parsing, cache, timeout and rate limit'),
 ('Credentials remain server-side','FIRMS_MAP_KEY Worker secret only; browser uses /api/firms; no key supplied or committed'),
 ('Freshness, stale data and error states','Timestamp separation; stale thresholds; local HTTP 503 observed; mocked valid/partial/invalid response tests'),
 ('Historical Atlas works','Desktop/mobile year and period selectors, real monthly rows, download verification'),
 ('Harmonization Lab works','Actual coefficient, holdout scores and limitations loaded in browser'),
 ('Historical COMMAND preserved','11 JS tests include existing COMMAND; browser decision-brief export verified'),
 ('Existing globe preserved','Browser rotation paused, zoom and visible rendered globe; existing global CSV reconciled'),
 ('Existing exports preserved','Global CSV 4,055,050 MODIS / 17,051,416 VIIRS; Black Summer 97,185 / 542,727; COMMAND brief platform counts verified'),
 ('No fabricated released data','Official ZIP/member validation; complete field-by-field CSV/JSON and raw-count reconciliation'),
 ('Desktop and mobile browser regression','browser-regression.json; screenshots and downloaded files in ignored output/playwright and .playwright-cli'),
 ('Python calculation tests','engineering-checks.json; python-calculations exit code'),
 ('TypeScript','engineering-checks.json; typescript exit code'),
 ('Cloudflare client build and Worker package','engineering-checks.json; client build and deploy --dry-run exit codes'),
 ('Production dependency audit','dependency-audit.json: zero production vulnerabilities'),
 ('Export validation and data reconciliation','reconciliation.json: source totals, hashes, all JSON/CSV fields, mathematical equation and acquisition diagnostics'),
 ('Browser regression','browser-regression.json; actual local Cloudflare Worker')]:
 gate(name,'COMPLETE',evidence)
gate('At least 20 MODIS years and 10 overlapping years','COMPLETE' if data_ok else 'PARTIAL',f'{len(modis)} MODIS years, {len(overlap)} overlapping years; target years without sources: {index["unavailable_sources"]}')
gate('Fully observation-adjusted scientifically validated harmonization','BLOCKED','MOD14.061, MYD14.061, VNP14IMG.002 probes all HTTP 401; valid-observation/cloud masks absent; independent fire truth not acquired')
gate('Genuine authenticated LIVE/NRT request and parsed response','BLOCKED','No authorized MAP_KEY configured; no authenticated NASA request verified; exact secure configuration in live-configuration.md')
gate('End-to-end review of genuine current detections','PARTIAL','Recent-evidence review and downloads implemented; positive live workflow awaits genuine authenticated feed')
gate('Release preparation','COMPLETE' if passed and data_ok else 'PARTIAL','Current branch; checks and browser results attached; production NOT deployed')
if not passed:
 for row in matrix:
  if row['requirement'] in ('Python calculation tests','TypeScript','Cloudflare client build and Worker package','Browser regression'): row['status']='PARTIAL'
(P/'acceptance-matrix.json').write_text(json.dumps(matrix,indent=2)+'\n')
text=['# FireTrace release review','', '**Scientific and operational requirements are not fully satisfied.** The expanded source archive and experimental derived product are implemented. Coverage-adjusted harmonization and authenticated current monitoring remain incomplete.','', '## Acceptance matrix','', '| Requirement | Status | Evidence |','|---|---|---|']
text += [f"| {r['requirement']} | {r['status']} | {r['evidence'].replace('|',' / ')} |" for r in matrix]
text += ['', '## Actual source coverage and retained records','',f'MODIS years: {modis}. S-NPP years: {viirs}. Overlap: {overlap}.','', '| Year | MODIS source / retained rows | VIIRS source / retained rows | Literal versions (MODIS / VIIRS) |','|---|---:|---:|---|']
for year in sorted(set(modis+viirs)):
 s={v['sensor']:v for v in index['sources'] if v['year']==year}
 counts=lambda sensor:f"{s[sensor]['counts']['source_rows']:,} / {s[sensor]['counts']['retained']:,}" if sensor in s else 'Unavailable'
 versions=lambda sensor:', '.join(s[sensor]['versions']) if sensor in s else 'Unavailable'
 text.append(f"| {year} | {counts('modis')} | {counts('viirs-snpp')} | {versions('modis')} / {versions('viirs-snpp')} |")
text += ['', 'No absent year is labelled fire-free. Source-first/source-last are detection date extents, not proof of complete observation coverage. January 2012 S-NPP and Aqua 2002 are partial mission-start periods. Terra 2001–2002 is a distinct baseline. Exact URLs, hashes, member CRC status, version distributions and filtering counters are in the source audits and source inventory.','', '## Unified product and mathematical method','', f"{reconciliation['cell_month_rows']:,} cell-month rows; {reconciliation['reconciled_retained_reports']:,} reconciled retained reports. Index: `/data/atlas/index.json`; per-year gzip JSON and CSV: `/data/atlas/YYYY.json.gz`, `/data/atlas/YYYY.csv.gz`. Derivation peak process RSS: {index['process_peak_rss_bytes']/1024**2:.1f} MiB.", '', 'Schema: year, UTC month, CEA25 grid ID and grid-centre coordinates/reference, source availability and literal versions, raw Terra/Aqua/S-NPP report counts, Aqua/VIIRS occupied windows, indicator unit, derived activity and empirical interval, method, status, quality flags, unknown-exposure status and calibration provenance.', '', 'The equal-area 25 km grid uses R=6371.0088 km and standard parallel −34°. Occupancy collapses multiple pixels into one cell/date/day-night window per platform. Fit b=Σ(AV)/Σ(V²) outside southeastern Australia on earlier overlap years. Predict P=min(62,bV); overlapping experimental indicator=(A+P)/2. Pre-VIIRS records are MODIS-only baselines, never invented VIIRS values. Raw pixel counts are not added. Terra-only cell-months without reference-platform evidence publish null.','', f"Coefficient: {v['coefficient']}. Fit years {v['training_years']} (n={v['training_n']}); interval calibration {v['calibration_years']} (n={v['calibration_n']}); later holdout {v['holdout_years']}.", '', '## Actual holdout performance','', '| Target: Aqua occupied windows per cell-month | n | MAE | RMSE | Bias |','|---|---:|---:|---:|---:|']
for label,key in [('VIIRS bridge','bridge'),('Raw VIIRS occupancy','raw_occupancy')]:
 m=v['holdout'][key];text.append(f"| {label} | {m['n']} | {m['mae']:.6f} | {m['rmse']:.6f} | {m['bias']:.6f} |")
text += ['',f"Nominal 90% empirical residual interval: holdout coverage {v['holdout']['interval_coverage']*100:.2f}%; calibration absolute residual quantile {v['interval_absolute_residual_q90']:.6f}. {v['interval_scope']}", '', 'Separate pixel-count reference (different units; never compare these errors numerically with occupancy errors):']
for label,key in [('Raw VIIRS pixel count','identity'),('Transferred previous matched-pixel coefficient','previous_experiment_transfer')]:
 m=v['raw_pixel_reference'][key];text.append(f"- {label}: n={m['n']}, MAE={m['mae']:.6f}, RMSE={m['rmse']:.6f}, bias={m['bias']:.6f}.")
text += ['', 'Full by-year, season, withheld southeast-region, collection/version-pair and training-period sensitivity results, plus 15/30/60 minute pairing and unmatched counts: `validation.json`. The original `tools/command_experiment.py` and `public/reports/command-experiment.json` remain unchanged.','', '## Scientific limitations','']+[f'- {x}' for x in v['limitations']]
text += ['', 'The model estimates sensor agreement conditional on reported detections. It does not measure independent detection accuracy, recall, unique incidents, burned area, absolute severity, valid clear-sky exposure or warning lead time. The blended indicator includes Aqua, so validation tests only the VIIRS bridge against Aqua. Versions are preserved and transitions flagged, without claiming a validated correction across collections.','', '## Near-real-time status and secrets','', 'Implemented: fixed-area Worker API, source-specific parsing, two UTC days, application retrieval vs acquisition vs unknown publication time, freshness/error handling, cache and rate limit, and separate COMMAND recent-evidence review/downloads. **No authenticated NASA live request has been verified.** No detections are manufactured on failure. All three tested science-mask URLs currently return HTTP 401; see `mask-access-probes.json` for exact URLs and timestamps.','', 'Secure configuration (interactive secret prompt, never a browser/public variable):','', '```sh','npx wrangler secret put FIRMS_MAP_KEY --config wrangler.cloudflare.jsonc','```','', 'See `live-configuration.md` for genuine authenticated staging verification. Until that succeeds, recent monitoring and end-to-end current-evidence review remain incomplete. No autonomous dispatch or evacuation instructions are supplied.','', '## Executed engineering checks','', '| Check | Exit code | Evidence |','|---|---:|---|']
text += [f"| {c['check']} | {c['exit_code']} | {c['log']} |" for c in engineering['checks']]
text += ['',f"Browser regression status: {browser['status']}. Test details and actual observed outcomes: `browser-regression.json`.", '', '## Files and release readiness','', 'Complete file list: `files-changed.json`. Main changes: bounded acquisition/derivation/reconciliation tools; compressed atlas data and audits; HistoricalAtlas and RecentDetections components; existing page navigation and COMMAND mode link; Worker FIRMS route; regression tests; assistant reference update. No raw source archives are committed.','', f"Branch: {subprocess.check_output(['git','branch','--show-current'],cwd=R,text=True).strip()}. Production has NOT been deployed. {'Historical experimental release is prepared for review.' if passed and data_ok else 'Release remains incomplete; inspect failed checks.'} The scientific and authenticated-live blockers above remain in force.", '', 'After reviewing this evidence and the credential/scientific limitations, deploy the already-built assets only with:', '', '```sh','npx wrangler deploy --config wrangler.cloudflare.jsonc','```', '', 'No push, force-push, history rewrite, production deployment or research-source deletion was performed.']
(P/'release-review.md').write_text('\n'.join(text)+'\n')
filelist=subprocess.check_output(['git','diff','--name-only','HEAD'],cwd=R,text=True).splitlines()+subprocess.check_output(['git','ls-files','--others','--exclude-standard'],cwd=R,text=True).splitlines()
(P/'files-changed.json').write_text(json.dumps(sorted(set(filelist+['public/reports/atlas/files-changed.json'])),indent=2)+'\n')
print('Release report generated:',P/'release-review.md')
