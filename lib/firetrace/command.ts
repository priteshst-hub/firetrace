export const MONTHS = [
  '2019-09', '2019-10', '2019-11', '2019-12', '2020-01', '2020-02', '2020-03',
] as const;
export type Month = typeof MONTHS[number];

export const ARCHIVE_PATH = '/data/observations.json';
export const CASE_ID = 'FT-AU-BLACK-SUMMER-2019-2020';
export const RULE_VERSION = 'Black Summer monthly screen v1';
export const DISCLAIMER =
  'Non-operational historical replay for qualified human review. A satellite detection is evidence of a thermal anomaly. Use official emergency information for current incidents. Review priority describes the order of analyst checks only.';

const COLUMNS = [
  'month', 'longitude_grid_center', 'latitude_grid_center',
  'terra_day', 'terra_night', 'aqua_day', 'aqua_night', 'viirs_day', 'viirs_night',
];

export const SENSORS = [
  { name: 'MODIS Terra', product: 'Collection 6 (6.03) · 1 km nominal' },
  { name: 'MODIS Aqua', product: 'Collection 6 (6.03) · 1 km nominal' },
  { name: 'VIIRS Suomi-NPP', product: 'Collection 2 · 375 m nominal' },
] as const;

type Counts = [terraDay: number, terraNight: number, aquaDay: number, aquaNight: number, viirsDay: number, viirsNight: number];
export type Site = {
  id: string;
  lon: number;
  lat: number;
  months: Partial<Record<Month, Counts>>;
};

export type Archive = {
  sites: Site[];
  hashes: { modis: string; 'viirs-snpp': string };
};

export type Priority = 'Monitor' | 'Analyst review' | 'Prompt verification' | 'Insufficient evidence';
export const RULES = [
  { priority: 'Prompt verification', rule: 'MODIS and VIIRS both report in the selected month, and the cell has observations in at least two replay months through that month.' },
  { priority: 'Analyst review', rule: 'Either both instrument families report in the selected month or the cell has observations in at least two replay months through that month.' },
  { priority: 'Monitor', rule: 'One instrument family reports in the selected month, with observations in only one replay month through that month.' },
  { priority: 'Insufficient evidence', rule: 'A valid grid location, archive month and positive observation count in that month are required.' },
] as const;

export const MISSING_EVIDENCE = [
  'Complete acquisition times and per-detection confidence are not included in the monthly grid. The pipeline retained type 0, MODIS confidence ≥30 and VIIRS nominal/high.',
  'The grid center gives a reference for the 10 km cell. Exact positions and fire boundaries require finer evidence.',
  'Cloud and overpass coverage leave detection gaps. A month with no archived rows has unknown fire activity.',
  'Ground reports, incident status, weather, fuels, vegetation and exposure need independent evidence.',
] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function isMonth(value: unknown): value is Month {
  return MONTHS.some(month => month === value);
}

export function validCoordinates(lon: unknown, lat: unknown): boolean {
  return typeof lon === 'number' && Number.isFinite(lon) && lon >= -180 && lon <= 180
    && typeof lat === 'number' && Number.isFinite(lat) && lat >= -90 && lat <= 90;
}

function isCount(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
}

function isHash(value: unknown): value is string {
  return typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
}

export function parseArchive(payload: unknown): Archive {
  const error = 'The Black Summer archive has an invalid or incomplete data format.';
  if (!isRecord(payload) || payload.grid_km !== 10 || !Array.isArray(payload.cells)
    || !isRecord(payload.input_sha256)) throw new Error(error);
  const { columns } = payload;
  if (!Array.isArray(columns) || columns.length !== COLUMNS.length
    || !COLUMNS.every((column, index) => columns[index] === column)) throw new Error(error);

  const { modis, 'viirs-snpp': viirs } = payload.input_sha256;
  if (!isHash(modis) || !isHash(viirs)) throw new Error(error);

  const sites = new Map<string, Site>();
  for (const row of payload.cells) {
    if (!Array.isArray(row) || row.length !== COLUMNS.length) throw new Error(error);
    const [month, lon, lat, ...counts] = row;
    // Rounded projected grid centers may sit just outside the original bbox.
    if (!isMonth(month) || !validCoordinates(lon, lat) || lon < 139.8 || lon > 154.2
      || lat < -39.2 || lat > -28.8 || !counts.every(isCount)
      || !Number.isSafeInteger(counts.reduce((sum, count) => sum + count, 0))) throw new Error(error);
    const id = `${lon},${lat}`;
    const site: Site = sites.get(id) ?? { id, lon, lat, months: {} };
    if (site.months[month]) throw new Error(error);
    site.months[month] = counts as Counts;
    sites.set(id, site);
  }
  return { sites: Array.from(sites.values()), hashes: { modis, 'viirs-snpp': viirs } };
}

export function summarize(counts: Counts | undefined) {
  const [terraDay, terraNight, aquaDay, aquaNight, viirsDay, viirsNight] = counts ?? [0, 0, 0, 0, 0, 0];
  const terra = terraDay + terraNight;
  const aqua = aquaDay + aquaNight;
  const viirs = viirsDay + viirsNight;
  return { terra, aqua, modis: terra + aqua, viirs, total: terra + aqua + viirs };
}

export function evaluateReview(site: Site, month: unknown) {
  const counts = isMonth(month) ? summarize(site.months[month]) : summarize(undefined);
  const observedMonths = isMonth(month)
    ? MONTHS.filter(period => period <= month && summarize(site.months[period]).total > 0)
    : [];
  const both = counts.modis > 0 && counts.viirs > 0;
  const recurring = observedMonths.length >= 2;
  let priority: Priority = 'Insufficient evidence';
  if (validCoordinates(site.lon, site.lat) && counts.total > 0) {
    if (both && recurring) priority = 'Prompt verification';
    else if (both || recurring) priority = 'Analyst review';
    else priority = 'Monitor';
  }
  const matched = RULES.find(rule => rule.priority === priority)!;
  return { ...matched, counts, observedMonths };
}

export function monthLabel(month: Month, style: 'short' | 'long' = 'long') {
  return new Intl.DateTimeFormat('en-US', { month: style, year: 'numeric', timeZone: 'UTC' })
    .format(new Date(`${month}-01T00:00:00Z`));
}

export function ageRange(month: Month, now: Date) {
  const first = new Date(`${month}-01T00:00:00Z`);
  const end = Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1);
  const day = 86_400_000;
  const earliest = Math.floor((now.getTime() - end + 1) / day);
  const latest = Math.floor((now.getTime() - first.getTime()) / day);
  return Number.isFinite(earliest) && earliest >= 0 ? `${earliest}–${latest} days (UTC month bounds)` : 'Unavailable';
}

export function coordinates(site: Site) {
  return `${site.lat.toFixed(4)}°, ${site.lon.toFixed(4)}°`;
}

export function reviewSteps(site: Site, month: Month) {
  const review = evaluateReview(site, month);
  const sourceReason = review.counts.modis && review.counts.viirs
    ? 'Compare the original MODIS and VIIRS records for this cell and month. Check dates, footprints and quality before treating the observations as corroboration.'
    : 'Check the original detections for dates, footprints and quality, and check whether coverage was available from the other instrument family.';
  return [
    { basis: 'Observation', action: `Use ${coordinates(site)} as the grid center for the ${monthLabel(month)} search. Confirm precise detection coordinates and the responsible jurisdiction.` },
    { basis: 'Observation', action: sourceReason },
    { basis: 'Generic verification', action: 'Check incident registers and local fire authority records for the area and dates, including any incident already reported.' },
    { basis: 'Generic verification', action: 'Review authoritative local weather and incident information. Verify vegetation, fuels and nearby exposure with appropriate local data.' },
    { basis: 'Generic verification', action: 'Seek independent human or local confirmation. Compare subsequent observations as they become available and record corroboration or disagreement.' },
    { basis: 'Generic verification', action: 'For a current counterpart, if independent evidence corroborates the concern, qualified personnel may share the verified information with the appropriate emergency management authority.' },
  ];
}

export const DISPOSITIONS = [
  'Unrecorded', 'Monitor archive evidence', 'Seek independent evidence', 'Hold for missing evidence',
] as const;
export type Disposition = typeof DISPOSITIONS[number];

export function buildReport(archive: Archive, site: Site, month: Month, disposition: Disposition, now: Date, extract?: { sample: ExactSample; cutoff: string }) {
  const review = evaluateReview(site, month);
  const exact = extract?.sample.siteId === site.id ? selectExtract(extract.sample, month, extract.cutoff) : null;
  return [
    'FIRETRACE COMMAND — DECISION SUPPORT BRIEF',
    `Case study: ${CASE_ID}`,
    'Mode: HISTORICAL REPLAY',
    `Generated (UTC): ${now.toISOString()}`,
    `10 km grid center (latitude, longitude): ${coordinates(site)}`,
    `Archive period: ${monthLabel(month)} (UTC month)`,
    `Observation age: ${ageRange(month, now)}`,
    '',
    'WHAT WAS OBSERVED — COMPLETE MONTH',
    ...SENSORS.map((sensor, i) => {
      const counts = site.months[month];
      const day = counts?.[i * 2] ?? 0;
      const night = counts?.[i * 2 + 1] ?? 0;
      return `${sensor.name} (${sensor.product}): ${day + night} observations (day ${day}, night ${night})`;
    }),
    `Months with recorded activity through the selected month: ${review.observedMonths.map(period => monthLabel(period)).join(', ') || 'None'}`,
    'Repeated records can reflect distinct detections or incidents. Continuous burning and fire identity are unknown.',
    '',
    ...(exact ? [
      'DATED ARCHIVE EXTRACT',
      `Source: ${SAMPLE_PATH} · ${exact.sample.startDate} to ${exact.sample.endDate} UTC · one grid cell`,
      exact.sample.selection,
      `Selected cutoff: ${exact.cutoff ? acquisitionLabel(exact.cutoff) : 'Before first retained record in the selected month'}`,
      'This extract is separate from the monthly triage. Acquisition time is reported to the minute and gives no publication, ingestion or notification time.',
      `Retained rows in selected month through cutoff: ${exact.rows.length}`,
      `[Observation] ${exact.nextCheck}`,
      'CSV line numbers refer to filtered research inputs. The earliest row in this extract cannot establish ignition or first regional detection.',
      ...exact.rows.map(row => `${acquisitionLabel(row.acquiredAt)} · ${row.instrument} ${row.satellite} (v${row.version}) · ${row.latitude}°, ${row.longitude}° · confidence ${confidenceLabel(row.confidence)} · ${row.daynight === 'D' ? 'day' : 'night'} · ${exact.sample.files[row.instrument === 'MODIS' ? 'modis' : 'viirs-snpp']}, line ${row.sourceLine}`),
      '',
    ] : []),
    'WHY IT MERITS REVIEW — RETROSPECTIVE MONTHLY ASSESSMENT',
    `Review category: ${review.priority.toUpperCase()}`,
    `Rule: ${RULE_VERSION} — unvalidated demonstration thresholds`,
    `Matched condition: ${review.rule}`,
    `Triggering evidence: MODIS ${review.counts.modis}, VIIRS ${review.counts.viirs}; ${review.observedMonths.length} month(s) with observations through the selected month.`,
    `Analyst disposition: ${disposition}`,
    '',
    'MISSING INFORMATION AND UNCERTAINTY',
    ...MISSING_EVIDENCE.map(item => `- ${item}`),
    '',
    'VERIFICATION WORKFLOW',
    ...reviewSteps(site, month).map((step, i) => `${i + 1}. [${step.basis}] ${step.action}`),
    '',
    'DATA PROVENANCE',
    `NASA FIRMS archived country standard products, aggregated by FireTrace: ${ARCHIVE_PATH}`,
    'Original Australia CSV inventory and SHA-256 checksums: /reports/provenance.json',
    `Derived archive input MODIS SHA-256: ${archive.hashes.modis}`,
    `Derived archive input VIIRS Suomi-NPP SHA-256: ${archive.hashes['viirs-snpp']}`,
    '',
    DISCLAIMER,
    '',
  ].join('\n');
}

export const SAMPLE_PATH = '/data/command-sample.json';

type ExactObservation = {
  latitude: number;
  longitude: number;
  acquiredAt: string;
  satellite: 'Terra' | 'Aqua' | 'Suomi-NPP';
  instrument: 'MODIS' | 'VIIRS';
  confidence: number | 'n' | 'h';
  daynight: 'D' | 'N';
  version: string;
  sourceLine: number;
};
export type ExactSample = {
  siteId: string;
  startDate: string;
  endDate: string;
  selection: string;
  files: Record<'modis' | 'viirs-snpp', string>;
  rows: ExactObservation[];
};

function validDate(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function isExactObservation(row: unknown): row is ExactObservation {
  if (!isRecord(row) || !validCoordinates(row.longitude, row.latitude)
    || typeof row.acquiredAt !== 'string' || !validDate(row.acquiredAt.slice(0, 10))
    || !/^\d{4}-\d{2}-\d{2}T(?:[01]\d|2[0-3]):[0-5]\dZ$/.test(row.acquiredAt)
    || !isCount(row.sourceLine) || row.sourceLine < 2 || (row.daynight !== 'D' && row.daynight !== 'N')) return false;
  if (row.instrument === 'MODIS') {
    return (row.satellite === 'Terra' || row.satellite === 'Aqua') && row.version === '6.03'
      && isCount(row.confidence) && row.confidence >= 30 && row.confidence <= 100;
  }
  return row.instrument === 'VIIRS' && row.satellite === 'Suomi-NPP' && row.version === '2'
    && (row.confidence === 'n' || row.confidence === 'h');
}

export function parseSample(payload: unknown, archive: Archive): ExactSample {
  const error = 'The dated archive extract is invalid or incomplete.';
  if (!isRecord(payload) || payload.schemaVersion !== 1 || payload.caseId !== 'black-summer-2019-2020'
    || !isRecord(payload.grid) || payload.grid.sizeKm !== 10
    || !validCoordinates(payload.grid.longitude, payload.grid.latitude)
    || !validDate(payload.startDate) || !validDate(payload.endDate) || payload.startDate > payload.endDate
    || !isMonth(payload.startDate.slice(0, 7)) || !isMonth(payload.endDate.slice(0, 7))
    || !isRecord(payload.inputSha256)
    || payload.inputSha256.modis !== archive.hashes.modis || payload.inputSha256['viirs-snpp'] !== archive.hashes['viirs-snpp']
    || !isRecord(payload.inputFiles) || typeof payload.inputFiles.modis !== 'string'
    || typeof payload.inputFiles['viirs-snpp'] !== 'string'
    || typeof payload.selection !== 'string' || !Array.isArray(payload.observations)
    || !payload.observations.length || !payload.observations.every(isExactObservation)) throw new Error(error);

  const siteId = `${payload.grid.longitude},${payload.grid.latitude}`;
  const site = archive.sites.find(site => site.id === siteId);
  if (!site) throw new Error(error);
  const { startDate, endDate } = payload;
  const rows: ExactObservation[] = payload.observations;
  const identities = new Set<string>();
  const subsetCounts = new Map<string, number>();
  const gridIndex = (lon: number, lat: number) => {
    const rad = Math.PI / 180;
    const parallel = Math.cos(-34 * rad);
    return `${Math.floor(6371.0088 * lon * rad * parallel / 10)},${Math.floor(6371.0088 * Math.sin(lat * rad) / parallel / 10)}`;
  };
  const expectedGrid = gridIndex(site.lon, site.lat);
  for (const [i, row] of rows.entries()) {
    const date = row.acquiredAt.slice(0, 10);
    const month = date.slice(0, 7);
    const identity = `${row.instrument}/${row.sourceLine}`;
    const column = (row.satellite === 'Terra' ? 0 : row.satellite === 'Aqua' ? 2 : 4) + (row.daynight === 'N' ? 1 : 0);
    const subsetKey = `${month}/${column}`;
    const count = (subsetCounts.get(subsetKey) ?? 0) + 1;
    if (date < startDate || date > endDate || identities.has(identity)
      || gridIndex(row.longitude, row.latitude) !== expectedGrid
      || !isMonth(month) || count > (site.months[month]?.[column] ?? 0)
      || (i > 0 && row.acquiredAt < rows[i - 1].acquiredAt)) throw new Error(error);
    identities.add(identity);
    subsetCounts.set(subsetKey, count);
  }
  return { siteId, startDate, endDate, selection: payload.selection, files: { modis: payload.inputFiles.modis, 'viirs-snpp': payload.inputFiles['viirs-snpp'] }, rows };
}

export function selectExtract(sample: ExactSample, month: Month, cutoff: string) {
  const rows = sample.rows.filter(row => row.acquiredAt.startsWith(month) && row.acquiredAt <= cutoff);
  const families = Array.from(new Set(rows.map(row => row.instrument)));
  const days = new Set(rows.map(row => row.acquiredAt.slice(0, 10))).size;
  let nextCheck = 'Check overpass and cloud coverage before interpreting the absence of retained rows.';
  if (families.length === 1) nextCheck = `Check ${families[0]} source pixels and product quality, then check whether the other instrument had coverage.`;
  if (families.length === 2) nextCheck = 'Compare source footprints and acquisition times across instruments before treating the reports as corroboration.';
  return { sample, cutoff, rows, families, days, nextCheck };
}

export function acquisitionLabel(timestamp: string) {
  return timestamp.replace('T', ' ').replace('Z', ' UTC');
}

export function confidenceLabel(confidence: ExactObservation['confidence']) {
  if (confidence === 'n') return 'nominal (n)';
  if (confidence === 'h') return 'high (h)';
  return `${confidence}/100 (product quality)`;
}
