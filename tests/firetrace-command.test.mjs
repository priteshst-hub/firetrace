import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import {
  ageRange, buildReport, evaluateReview, parseArchive, parseSample, selectExtract,
} from '../lib/firetrace/command.ts';

const loadJson = path => JSON.parse(readFileSync(new URL(path, import.meta.url)));
const input = loadJson('../public/data/observations.json');
const extract = loadJson('../public/data/command-sample.json');
const archive = parseArchive(input);
const site = archive.sites.find(value => value.id === '149.1025,-37.2821');
const decemberSite = archive.sites.find(value => value.id === '149.1025,-37.6578');
const now = new Date('2026-11-20T12:00:00Z');

test('actual archive rows reconcile and triage is deterministic without lookahead', () => {
  const january = evaluateReview(site, '2020-01');
  assert.deepEqual(january, evaluateReview(structuredClone(site), '2020-01'));
  assert.deepEqual(site.months['2020-01'], [33, 38, 68, 55, 534, 745]);
  assert.deepEqual(january.counts, { terra: 71, aqua: 123, modis: 194, viirs: 1279, total: 1473 });
  assert.equal(january.priority, 'Analyst review');
  assert.deepEqual(january.observedMonths, ['2020-01']);
  assert.equal(evaluateReview(site, '2020-02').priority, 'Prompt verification');
  assert.equal(evaluateReview(decemberSite, '2019-12').counts.total, 49);
  assert.equal(evaluateReview(decemberSite, '2020-01').counts.total, 738);
  const archivedRowCount = archive.sites.reduce((sum, cell) => sum + Object.keys(cell.months).length, 0);
  assert.equal(archivedRowCount, 5363);
});

test('many observations in one month do not count as repeat dates or a continuous incident', () => {
  const oneFamily = { id: site.id, lon: site.lon, lat: site.lat, months: {
    '2019-09': [80, 40, 30, 20, 0, 0],
    '2019-11': [2, 1, 0, 0, 0, 0],
  } };
  assert.equal(evaluateReview(oneFamily, '2019-09').priority, 'Monitor');
  assert.equal(evaluateReview(oneFamily, '2019-10').priority, 'Insufficient evidence');
  assert.equal(evaluateReview(oneFamily, '2019-11').priority, 'Analyst review');
  assert.deepEqual(evaluateReview(oneFamily, '2019-11').observedMonths, ['2019-09', '2019-11']);
});

test('zero observations, invalid grids and missing periods yield insufficient evidence', () => {
  assert.deepEqual(parseArchive({ ...input, cells: [] }).sites, []);
  const empty = parseArchive({ ...input, cells: [['2020-01', 149, -37, 0, 0, 0, 0, 0, 0]] }).sites[0];
  assert.equal(evaluateReview(empty, '2020-01').priority, 'Insufficient evidence');
  assert.equal(evaluateReview({ ...site, lat: 91 }, '2020-01').priority, 'Insufficient evidence');
  assert.equal(evaluateReview(site, undefined).priority, 'Insufficient evidence');
  assert.equal(evaluateReview(site, '2020-13').priority, 'Insufficient evidence');
  assert.equal(ageRange('2020-01', new Date('2020-01-15T00:00Z')), 'Unavailable');
  assert.equal(ageRange('2020-01', new Date('invalid')), 'Unavailable');
  assert.equal(ageRange('2020-01', new Date('2020-02-01T00:00Z')), '0–31 days (UTC month bounds)');
});

test('invalid and incomplete JSON responses fail closed', () => {
  const broken = [null, '<html>', { cells: [] }, { ...input, grid_km: 20 }, { ...input, columns: [] },
    { ...input, input_sha256: {} }, { ...input, cells: [['2020-01', 999, -37, 0, 0, 0, 0, 0, 1]] },
    { ...input, cells: [['2020-01', 149, -37, 0, 0, 0, 0, 0, -1]] },
    { ...input, cells: [['2020-01', 149, -37, 0, 0, 0, 0, 0]] },
    { ...input, cells: [input.cells[0], input.cells[0]] }];
  for (const payload of broken) assert.throws(() => parseArchive(payload), /invalid or incomplete/);
});

test('source extract handles missing and impossible minutes, wrong grids and invalid confidence', () => {
  const [first, ...others] = extract.observations;
  const withFirst = row => ({ ...extract, observations: [row, ...others] });
  const broken = [null, {}, { ...extract, observations: [] }, { ...extract, inputSha256: {} },
    withFirst({ ...first, acquiredAt: undefined }), withFirst({ ...first, acquiredAt: '2020-02-31T04:00Z' }),
    withFirst({ ...first, acquiredAt: '2020-01-04T24:00Z' }), withFirst({ ...first, confidence: 'l' }),
    withFirst({ ...first, longitude: 152 }), { ...extract, observations: [first, ...extract.observations] }];
  for (const payload of broken) assert.throws(() => parseSample(payload, archive), /invalid or incomplete/);
});

test('dated checkpoint reveals only acquired rows and updates verification evidence', () => {
  const sample = parseSample(extract, archive);
  assert.equal(sample.rows.length, 82);
  assert.equal(selectExtract(sample, '2019-12', '2019-12-31T23:59Z').rows.length, 0);
  assert.equal(selectExtract(sample, '2020-01', '').rows.length, 0);
  const first = selectExtract(sample, '2020-01', '2020-01-04T04:00Z');
  assert.equal(first.rows.length, 14);
  assert.deepEqual(first.families, ['VIIRS']);
  assert.equal(first.days, 1);
  const second = selectExtract(sample, '2020-01', '2020-01-04T13:29Z');
  assert.equal(second.rows.length, 16);
  assert.deepEqual(second.families, ['VIIRS', 'MODIS']);
  assert.match(second.nextCheck, /Compare source footprints/);
  assert.equal(selectExtract(sample, '2020-01', '2020-01-05T15:02Z').days, 2);
});

test('response brief records exact visible evidence, priority, disposition and source', () => {
  const sample = parseSample(extract, archive);
  const report = buildReport(archive, site, '2020-01', 'Seek independent evidence', now,
    { sample, cutoff: '2020-01-04T13:29Z' });
  for (const marker of [
    'FT-AU-BLACK-SUMMER-2019-2020', 'HISTORICAL REPLAY', now.toISOString(), '-37.2821°, 149.1025°',
    'January 2020 (UTC month)', 'day 33, night 38', 'day 534, night 745',
    'MODIS 194, VIIRS 1279', 'ANALYST REVIEW', 'Seek independent evidence',
    'unvalidated demonstration thresholds', 'Ground reports', '[Observation]', '[Generic verification]',
    archive.hashes.modis, archive.hashes['viirs-snpp'], 'Non-operational historical replay',
    '2020-01-04 13:29 UTC', 'Retained rows in selected month through cutoff: 16', 'line 87178',
  ]) assert.ok(report.includes(marker), marker);
  assert.ok(!report.includes('2020-01-04 15:07 UTC'));
  assert.ok(!report.includes('February 2020'));
  assert.ok(!buildReport(archive, decemberSite, '2020-01', 'Unrecorded', now, { sample, cutoff: '' }).includes('DATED ARCHIVE EXTRACT'));
});
