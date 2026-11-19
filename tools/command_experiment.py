"""Detection-conditional Aqua/VIIRS near-time experiment. Standard library only."""
import csv
import hashlib
import json
import math
from pathlib import Path
import random
import statistics
from collections import defaultdict

ROOT = Path(__file__).resolve().parents[1]
R = 6371.0088
C = math.cos(math.radians(-34))


def cell(lon, lat):
    return math.floor(R * math.radians(lon) * C / 10), math.floor(R * math.sin(math.radians(lat)) / C / 10)


def pair_windows(aqua, viirs, window=30):
    """Greedy nearest acquisition-minute groups, one-to-one, deterministic ties."""
    available = set(viirs)
    pairs = []
    for minute in sorted(aqua):
        options = sorted(available, key=lambda other: (abs(other - minute), other))
        if options and abs(options[0] - minute) <= window:
            other = options[0]
            available.remove(other)
            pairs.append((minute, other, aqua[minute], viirs[other]))
    return pairs


def fit(rows):
    return sum(row[0] * row[1] for row in rows) / sum(row[1] ** 2 for row in rows)


def metrics(rows, factor):
    errors = [factor * v - a for a, v in rows]
    return dict(n=len(rows), mae=statistics.mean(abs(e) for e in errors),
                rmse=math.sqrt(statistics.mean(e * e for e in errors)), bias=statistics.mean(errors))


def main():
    archive = json.loads((ROOT / 'public/data/observations.json').read_text())
    groups = defaultdict(lambda: {'Aqua': defaultdict(int), 'VIIRS': defaultdict(int)})
    inventory = []
    counts = defaultdict(int)
    for sensor in ('modis', 'viirs-snpp'):
        path = ROOT.parent / 'firetrace-data-gate/filtered' / f'{sensor}_SE_Australia_20190901_20200331.csv'
        digest = hashlib.sha256(path.read_bytes()).hexdigest()
        if digest != archive['input_sha256'][sensor]:
            raise ValueError('Source checksum mismatch')
        dates = []
        with path.open() as source:
            for row in csv.DictReader(source):
                if sensor == 'modis' and row['satellite'] != 'Aqua':
                    continue
                if row['type'] != '0' or not (float(row['confidence']) >= 30 if sensor == 'modis' else row['confidence'] in ('n', 'h')):
                    continue
                lon, lat = float(row['longitude']), float(row['latitude'])
                minute = int(row['acq_time']) // 100 * 60 + int(row['acq_time']) % 100
                key = (*cell(lon, lat), row['acq_date'], row['daynight'])
                platform = 'Aqua' if sensor == 'modis' else 'VIIRS'
                groups[key][platform][minute] += 1
                dates.append(row['acq_date'])
                counts[platform] += 1
        inventory.append(dict(file=path.name, sha256=digest, retained_rows=len(dates), first=min(dates), last=max(dates)))
    train, holdout = [], []
    paired_counts = defaultdict(int)
    pairs_by_date = defaultdict(list)
    for key, platforms in sorted(groups.items()):
        for am, vm, a, v in pair_windows(platforms['Aqua'], platforms['VIIRS']):
            date = key[2]
            (train if date < '2020-01-01' else holdout).append((a, v))
            pairs_by_date[date].append((a, v))
            paired_counts['Aqua'] += a
            paired_counts['VIIRS'] += v
    factor = fit(train)
    dates = sorted(date for date in pairs_by_date if date >= '2020-01-01')
    rng = random.Random(1729)
    improvements = []
    for _ in range(500):
        sample = [row for date in rng.choices(dates, k=len(dates)) for row in pairs_by_date[date]]
        improvements.append(metrics(sample, 1)['mae'] - metrics(sample, factor)['mae'])
    improvements.sort()
    result = dict(
        status='Exploratory detection-conditional adjustment; harmonized estimate unsupported',
        protocol='10 km equal-area grid at standard parallel -34 degrees; same UTC date and source day/night; acquisition-minute groups; Aqua groups sorted ascending, nearest unused VIIRS minute within 30 minutes, earlier minute wins ties. Each group paired at most once. Adjacent cells and cross-midnight pairs excluded. Groups count pixels, not incidents.',
        calibration='Least-squares through origin: Aqua count = coefficient × VIIRS count. Training September–December 2019, holdout January–March 2020. Matching uses no fitted coefficients.',
        coefficient=factor, training=metrics(train, factor), holdout_corrected=metrics(holdout, factor),
        holdout_uncorrected=metrics(holdout, 1),
        holdout_dates=len(dates),
        bootstrap=dict(seed=1729, replicates=500, mae_improvement_95_percentile_interval=[improvements[12], improvements[487]], unit='UTC holdout date blocks; fitted coefficient fixed'),
        retained=dict(counts), paired_retained=dict(paired_counts),
        unmatched_retained={name: count - paired_counts[name] for name, count in counts.items()},
        inputs=inventory,
        limitations=['Both groups require positive detections, excluding non-detection and clear-sky exposure.',
                      'Valid-observation/cloud masks and footprint intersections are unavailable.',
                      'Aqua and VIIRS nominal resolutions differ; shared grid/time is no proof of the same fire.',
                      'Temporal split divides Black Summer and offers no independent seasonal or spatial validation.',
                      'Bootstrap measures sampled date variability, excluding training, geolocation and coverage uncertainty.',
                      'C6 MODIS 6.03 and C2 VIIRS identities are preserved. No calibrated operational series is released.'],
        historical_inventory=dict(available_years=[2019, 2020], additional_verified_years=[],
            requirement='Acquire NASA FIRMS standard Australia MODIS and VIIRS country archives for additional overlapping years, preserve collection/version and source checksums, verify ZIP/member integrity, dates, filtering and counts. Obtain valid-observation/cloud masks for coverage-adjusted calibration.'),
    )
    (ROOT / 'public/reports/command-experiment.json').write_text(json.dumps(result, indent=2) + '\n')
    print(json.dumps(result, indent=2))


if __name__ == '__main__':
    main()
