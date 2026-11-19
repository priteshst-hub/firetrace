'use client';

import { useEffect, useMemo, useState } from 'react';
import { ArrowDownToLine, Crosshair, Database, Radio, ShieldCheck } from 'lucide-react';
import {
  acquisitionLabel, ageRange, ARCHIVE_PATH, buildReport, CASE_ID, confidenceLabel, coordinates, DISCLAIMER, DISPOSITIONS,
  evaluateReview, isMonth, MISSING_EVIDENCE, MONTHS, monthLabel, parseArchive, reviewSteps,
  parseSample, RULES, RULE_VERSION, SAMPLE_PATH, selectExtract, SENSORS, summarize,
} from '../../lib/firetrace/command';
import type { Archive, Disposition, ExactSample, Month, Priority, Site } from '../../lib/firetrace/command';
import './command.css';

const DEFAULT_SITE = '149.1025,-37.2821';
const number = new Intl.NumberFormat('en-US');
const priorityClass = (priority: Priority) => priority.toLowerCase().replaceAll(' ', '-');

type LoadState = { status: 'loading' } | { status: 'error'; message: string } | { status: 'ready'; archive: Archive };

function ObservationEvidence({ site, month, onLocate }: { site: Site; month: Month; onLocate: () => void }) {
  const counts = site.months[month];
  const review = evaluateReview(site, month);
  return (
    <section className="command-section" aria-labelledby="command-evidence">
      <div className="command-section-title">
        <h2 id="command-evidence">What was observed?</h2>
        <span className="command-small-label">10 km grid</span>
      </div>
      <dl className="command-facts">
        <div><dt>Grid center · latitude, longitude</dt><dd>{coordinates(site)}</dd></div>
        <div><dt>Archive period · UTC</dt><dd>{monthLabel(month)}</dd></div>
        <div><dt>Observation age</dt><dd>{ageRange(month, new Date())}</dd></div>
        <div><dt>Months with recorded activity</dt><dd>{review.observedMonths.length} through {monthLabel(month, 'short')}</dd></div>
      </dl>
      <h3>MODIS × VIIRS evidence comparison</h3>
      <p>{review.counts.modis > 0 && review.counts.viirs > 0
        ? 'Both instrument families report in this cell and month. This is agreement on recorded activity at monthly grid scale.'
        : 'Only one instrument family reports in this cell and month. This is a difference in recorded evidence, with the cause unresolved.'}</p>
      <p className="command-note">Counts differ by {number.format(Math.abs(review.counts.modis - review.counts.viirs))} retained records. Different pixel sizes, overpasses and detection characteristics affect this difference. The archive supplies no complete observation or cloud mask, so a missing report cannot establish sensor disagreement about fire presence.</p>
      <p className="command-note">A shared month and 10 km cell can contain unrelated detections. Temporal coincidence, matched incidents and cross-sensor accuracy remain unmeasured here. The dated extract below permits inspection of individual acquisition minutes for its bounded sample.</p>
      <table className="command-table">
        <caption className="command-visually-hidden">Archived observations by satellite and day or night classification</caption>
        <thead><tr><th scope="col">Instrument / platform</th><th scope="col">Day</th><th scope="col">Night</th></tr></thead>
        <tbody>
          {SENSORS.map((sensor, i) => (
            <tr key={sensor.name}>
              <th scope="row">{sensor.name}<small>{sensor.product}</small></th>
              <td>{number.format(counts?.[i * 2] ?? 0)}</td>
              <td>{number.format(counts?.[i * 2 + 1] ?? 0)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="command-note">These are counts of retained satellite detections. Time of acquisition, time of publication, time of ingestion and time of workspace refresh measure different events. The monthly archive gives an age range and cannot establish alert latency.</p>
      <button type="button" className="command-button" onClick={onLocate}><Crosshair size={16} aria-hidden="true" /> Locate cell in Australia study</button>
    </section>
  );
}

function IncidentReplay({ site, month, onMonth }: { site: Site; month: Month; onMonth: (month: Month) => void }) {
  return (
    <section className="command-section" aria-labelledby="command-timeline">
      <div className="command-section-title">
        <h2 id="command-timeline">Activity by month</h2>
        <span className="command-small-label">Sep ’19 – Mar ’20</span>
      </div>
      <div className="command-timeline" role="group" aria-label="Replay timeline for this grid cell">
        {MONTHS.map(period => {
          const count = period <= month ? summarize(site.months[period]).total : null;
          const label = monthLabel(period, 'short');
          const description = count === null ? 'later replay period' : count ? `${number.format(count)} observations` : 'no retained observations';
          return (
            <button key={period} type="button" aria-pressed={period === month}
              aria-label={`${label}, ${description}`} onClick={() => onMonth(period)}>
              <span>{label}</span>
              <strong>{count === null ? 'Later' : number.format(count)}</strong>
            </button>
          );
        })}
      </div>
      <p className="command-note">Timeline controls keep this cell and clear candidate filters. The screen uses only the selected month and earlier months. Recurring records show activity in the cell, with fire identity and continuity unknown.</p>
    </section>
  );
}

function DatedEvidence({ sample, month, cutoff, onCutoff }: {
  sample: ExactSample;
  month: Month;
  cutoff: string;
  onCutoff: (cutoff: string) => void;
}) {
  const { rows, families, days, nextCheck } = selectExtract(sample, month, cutoff);
  const checkpoints = Array.from(new Set(sample.rows.filter(row => row.acquiredAt.startsWith(month)).map(row => row.acquiredAt)));
  const latestRows = rows.filter(row => row.acquiredAt === cutoff);
  return (
    <section className="command-section" aria-labelledby="command-dated-evidence">
      <h2 id="command-dated-evidence">Dated archive extract</h2>
      <p className="command-note">{sample.startDate} to {sample.endDate} UTC · one grid cell chosen retrospectively. The monthly review uses the full selected month and stays fixed as this separate extract plays.</p>
      {checkpoints.length > 0 && <label>Acquisition checkpoint
        <select value={cutoff} onChange={event => onCutoff(event.target.value)}>
          <option value="">Before first retained record</option>
          {checkpoints.map(timestamp => <option key={timestamp} value={timestamp}>{acquisitionLabel(timestamp)}</option>)}
        </select>
      </label>}
      <p role="status">
        {rows.length ? `${rows.length} retained rows through this checkpoint · ${families.join(' + ')} · ${days} UTC acquisition ${days === 1 ? 'day' : 'days'}`
          : 'No retained rows in the extract through this checkpoint. Coverage and fire activity are unknown.'}
      </p>
      <p className="command-rule-evidence"><strong>Checkpoint verification.</strong> {nextCheck}</p>
      {latestRows.length > 0 && <details className="command-rules">
        <summary>Inspect {latestRows.length} source {latestRows.length === 1 ? 'row' : 'rows'} at this minute</summary>
        <ul className="command-source-rows">
          {latestRows.map(row => <li key={`${row.instrument}/${row.sourceLine}`}>
            <strong>{row.instrument} {row.satellite} · confidence {confidenceLabel(row.confidence)}</strong>
            <span>{row.latitude}°, {row.longitude}° · {sample.files[row.instrument === 'MODIS' ? 'modis' : 'viirs-snpp']}, line {row.sourceLine}</span>
          </li>)}
        </ul>
      </details>}
      <p className="command-note">Timestamps show reported acquisition to the minute. The first retained row in this extract cannot establish ignition or first regional detection. CSV line numbers refer to filtered research inputs.</p>
      <p className="command-note">{sample.selection}</p>
      <a className="command-source-link" href={SAMPLE_PATH}>Open source-row extract</a>
    </section>
  );
}

function DecisionSupportBrief({ site, month, disposition, onDisposition }: {
  site: Site;
  month: Month;
  disposition: Disposition;
  onDisposition: (disposition: Disposition) => void;
}) {
  const review = evaluateReview(site, month);
  return (
    <section className="command-section command-brief" aria-labelledby="command-brief">
      <div className="command-section-title">
        <h2 id="command-brief"><ShieldCheck size={20} aria-hidden="true" /> Decision Support Brief</h2>
        <span className={`command-priority ${priorityClass(review.priority)}`}>{review.priority}</span>
      </div>
      <h3>Why does the complete month merit review?</h3>
      <p>{review.rule}</p>
      <p className="command-rule-evidence">MODIS <strong>{number.format(review.counts.modis)}</strong> · VIIRS <strong>{number.format(review.counts.viirs)}</strong> · Occupied months through selection <strong>{review.observedMonths.length}</strong></p>
      <details className="command-rules">
        <summary>{RULE_VERSION} · Unvalidated demonstration thresholds</summary>
        <ul>{RULES.map(row => <li key={row.priority}><strong>{row.priority}.</strong> {row.rule}</li>)}</ul>
        <p>Rules are applied from top to bottom for valid evidence. Priority orders human review.</p>
      </details>
      <h3>What information is missing?</h3>
      <ul>{MISSING_EVIDENCE.map(item => <li key={item}>{item}</li>)}</ul>
      <h3>What should be verified next?</h3>
      <ol className="command-steps">{reviewSteps(site, month).map(step => (
        <li key={step.action}><span>{step.basis}</span>{step.action}</li>
      ))}</ol>
      <label className="command-disposition">Record an analyst disposition
        <select value={disposition} onChange={event => {
          const choice = DISPOSITIONS.find(item => item === event.target.value);
          if (choice) onDisposition(choice);
        }}>
          {DISPOSITIONS.map(item => <option key={item}>{item}</option>)}
        </select>
        <small>Kept until page reload. The downloaded brief includes the selected disposition.</small>
      </label>
    </section>
  );
}

export default function CommandWorkspace({ onLocate }: {
  onLocate: (month: Month, cell: { lon: number; lat: number; m: number; v: number }) => void;
}) {
  const [load, setLoad] = useState<LoadState>({ status: 'loading' });
  const [revision, setRevision] = useState(0);
  const [month, setMonth] = useState<Month>('2020-01');
  const [preferredId, setPreferredId] = useState(DEFAULT_SITE);
  const [priorityFilter, setPriorityFilter] = useState('All priorities');
  const [query, setQuery] = useState('');
  const [dispositions, setDispositions] = useState<Record<string, Disposition>>({});
  const [downloaded, setDownloaded] = useState('');
  const [sample, setSample] = useState<ExactSample | 'unavailable' | null>(null);
  const [cutoff, setCutoff] = useState('');
  const archive = load.status === 'ready' ? load.archive : null;
  useEffect(() => {
    const controller = new AbortController();
    async function loadArchive() {
      try {
        const response = await fetch(ARCHIVE_PATH, { signal: controller.signal, cache: 'no-cache' });
        if (!response.ok) throw new Error(`The archive request returned HTTP ${response.status}.`);
        const payload: unknown = await response.json().catch(() => {
          throw new Error('The archive response is missing valid JSON.');
        });
        const archive = parseArchive(payload);
        if (!controller.signal.aborted) setLoad({ status: 'ready', archive });
      } catch (error) {
        if (!controller.signal.aborted) setLoad({ status: 'error', message: error instanceof Error ? error.message : 'The archive could not be loaded.' });
      }
    }
    void loadArchive();
    return () => controller.abort();
  }, [revision]);

  useEffect(() => {
    if (!archive) return;
    const controller = new AbortController();
    fetch(SAMPLE_PATH, { signal: controller.signal })
      .then(response => {
        if (!response.ok) throw new Error('Extract unavailable');
        return response.json();
      })
      .then(payload => parseSample(payload, archive))
      .then(result => { if (!controller.signal.aborted) setSample(result); })
      .catch(() => { if (!controller.signal.aborted) setSample('unavailable'); });
    return () => controller.abort();
  }, [archive]);

  const sitesForMonth = useMemo(() => (archive?.sites ?? [])
    .flatMap(site => {
      const review = evaluateReview(site, month);
      return review.counts.total > 0 ? [{ site, review }] : [];
    }).sort((a, b) => b.review.counts.total - a.review.counts.total || a.site.lon - b.site.lon || a.site.lat - b.site.lat),
  [archive, month]);

  const filtered = useMemo(() => {
    const terms = query.toLowerCase().trim().split(/[\s,°]+/).filter(Boolean);
    return sitesForMonth.filter(({ site, review }) =>
      (priorityFilter === 'All priorities' || review.priority === priorityFilter)
      && terms.every(term => coordinates(site).includes(term)));
  }, [sitesForMonth, priorityFilter, query]);

  const site = filtered.find(item => item.site.id === preferredId)?.site
    ?? (priorityFilter === 'All priorities' && !query.trim() ? archive?.sites.find(entry => entry.id === preferredId) : undefined)
    ?? filtered[0]?.site;
  const review = site ? evaluateReview(site, month) : null;
  const reviewKey = site ? `${site.id}/${month}` : '';
  const disposition = dispositions[reviewKey] ?? 'Unrecorded';
  const datedSample = sample && sample !== 'unavailable' && sample.siteId === site?.id
    && month >= sample.startDate.slice(0, 7) && month <= sample.endDate.slice(0, 7) ? sample : null;

  function refresh() {
    setLoad({ status: 'loading' });
    setSample(null);
    setDownloaded('');
    setRevision(value => value + 1);
  }

  function downloadBrief() {
    if (!archive || !site || !review?.counts.total) return;
    const report = buildReport(archive, site, month, disposition, new Date(),
      datedSample ? { sample: datedSample, cutoff } : undefined);
    const url = URL.createObjectURL(new Blob([report], { type: 'text/plain;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `firetrace-black-summer-${month}-${site.lat}-${site.lon}.txt`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    setDownloaded(reviewKey);
  }

  function selectMonth(period: Month) {
    if (site) setPreferredId(site.id);
    setMonth(period);
    setCutoff('');
    setDownloaded('');
  }

  return (
    <div className="command" aria-label="FireTrace Command workspace">
      <header className="command-header">
        <div className="command-mode"><Radio size={16} aria-hidden="true" /> Historical Replay</div>
        <h1>FireTrace Command</h1>
        <p>FireTrace connects satellite observations to transparent human review decisions.</p>
        <div className="command-header-meta">
          <span>Black Summer · Southeastern Australia</span>
          <span>Near-real-time feed unavailable</span>
        </div>
        <p><a className="command-source-link" href="#command-candidates">Start with a candidate</a> · <a className="command-source-link" href="#command-brief">Review the decision brief</a></p>
        <p className="command-flow">Satellite evidence → warning candidate → analyst decision → response brief</p>
        <p className="command-review-context">Review priority orders human verification. This replay is for research and demonstration.</p>
      </header>
      <div className="command-body">
        <section className="command-section command-controls" aria-labelledby="command-candidates">
          <div className="command-section-title">
            <h2 id="command-candidates"><Crosshair size={19} aria-hidden="true" /> Warning candidates</h2>
            <button type="button" className="command-button" onClick={refresh} disabled={load.status === 'loading'}>Reload archive</button>
          </div>
          <div className="command-filter-grid">
            <label>Replay month
              <select value={month} onChange={event => { if (isMonth(event.target.value)) selectMonth(event.target.value); }}>
                {MONTHS.map(period => <option key={period} value={period}>{monthLabel(period)}</option>)}
              </select>
            </label>
            <label>Review priority
              <select value={priorityFilter} onChange={event => { setPriorityFilter(event.target.value); setDownloaded(''); }}>
                <option>All priorities</option>
                {RULES.filter(row => row.priority !== 'Insufficient evidence').map(row => <option key={row.priority}>{row.priority}</option>)}
              </select>
            </label>
            <label>Find grid coordinates
              <input type="search" value={query} placeholder="e.g. -37.2821, 149.1025"
                onChange={event => { setQuery(event.target.value); setDownloaded(''); }} />
            </label>
            <label>Observed grid cell
              <select disabled={!filtered.length} value={filtered.some(item => item.site.id === site?.id) ? site?.id : ''}
                onChange={event => { setPreferredId(event.target.value); setDownloaded(''); }}>
                <option value="" disabled>Select a grid cell</option>
                {filtered.map(({ site, review }) => <option key={site.id} value={site.id}>
                  {coordinates(site)} · {number.format(review.counts.total)} observations
                </option>)}
              </select>
            </label>
          </div>
          {load.status === 'loading' && <p role="status">Loading archived observations…</p>}
          {load.status === 'error' && <p role="alert">{load.message} Select Reload archive to try again.</p>}
          {load.status === 'ready' && <p className="command-note" role="status">
            {filtered.length
              ? `${number.format(filtered.length)} matching grid cells · sorted by observation count`
              : sitesForMonth.length ? 'No grid cells match these filters. Try another coordinate or review priority.'
                : 'Insufficient evidence. No observations are available for this replay month. Coverage and fire activity are unknown.'}
          </p>}
        </section>

        {site && review && <div className="command-review-grid">
          <div className="command-evidence-stack">
            {review.counts.total > 0 ? <ObservationEvidence site={site} month={month}
              onLocate={() => onLocate(month, { lon: site.lon, lat: site.lat, m: review.counts.modis, v: review.counts.viirs })} /> : (
              <section className="command-section">
                <h2>Insufficient evidence</h2>
                <p>No retained observations at {coordinates(site)} in {monthLabel(month)}. Choose a month in the timeline or select an observed grid cell.</p>
              </section>
            )}
            <IncidentReplay site={site} month={month} onMonth={period => {
              setPriorityFilter('All priorities');
              setQuery('');
              selectMonth(period);
            }} />
            {datedSample && <DatedEvidence sample={datedSample} month={month} cutoff={cutoff}
              onCutoff={value => { setCutoff(value); setDownloaded(''); }} />}
            {sample === 'unavailable' && site.id === DEFAULT_SITE && <p className="command-note" role="status">
              The dated archive extract is unavailable. Monthly review is still available.
            </p>}
          </div>
          {review.counts.total > 0 && <DecisionSupportBrief site={site} month={month} disposition={disposition}
            onDisposition={value => { setDispositions(previous => ({ ...previous, [reviewKey]: value })); setDownloaded(''); }} />}
        </div>}

        <section className="command-section command-export" aria-labelledby="command-export">
          <div>
            <h2 id="command-export"><Database size={18} aria-hidden="true" /> Evidence and audit trail</h2>
            <p className="command-note">{CASE_ID} · NASA FIRMS standard archive products</p>
            <p className="command-note">The global archive covers 2019–2020. Command covers September 2019–March 2020 in southeastern Australia. Two years cannot establish long-term trends or performance across other seasons, regions or current incidents. Priorities require independent validation.</p>
            <div className="command-links">
              <a href="https://github.com/priteshst-hub/firetrace">Public GitHub repository</a>
              <a href={ARCHIVE_PATH}>Monthly grid source</a>
              <a href="/reports/provenance.json">Source inventory and SHA-256</a>
              <a href="https://firms.modaps.eosdis.nasa.gov/api/area/">NASA FIRMS Area API</a>
            </div>
          </div>
          <div>
            <button type="button" className="command-button command-primary" disabled={!review?.counts.total} onClick={downloadBrief}>
              <ArrowDownToLine size={16} aria-hidden="true" /> Download response brief
            </button>
            <p role="status" className="command-download-status">{reviewKey && downloaded === reviewKey ? 'Brief download started.' : ''}</p>
          </div>
        </section>
        <p className="command-disclaimer">{DISCLAIMER}</p>
      </div>
    </div>
  );
}
