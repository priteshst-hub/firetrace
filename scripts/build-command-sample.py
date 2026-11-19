"""Build the exact-time Black Summer replay from verified FireTrace CSV inputs.

The default input directory is the sibling firetrace-data-gate/filtered directory.
Run with --check to compare the committed sample with a fresh reconstruction.
"""

import argparse
from collections import defaultdict
import csv
from datetime import datetime
import hashlib
import json
import math
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
ARCHIVE = ROOT / "public/data/observations.json"
SAMPLE = ROOT / "public/data/command-sample.json"
EARTH_RADIUS_KM = 6371.0088
STANDARD_PARALLEL = math.cos(math.radians(-34))
GRID_KM = 10
START_DATE = "2019-12-30"
END_DATE = "2020-01-07"
SENSORS = ("modis", "viirs-snpp")
PLATFORMS = {"Terra": ("Terra", 0), "Aqua": ("Aqua", 2), "N": ("Suomi-NPP", 4)}


def grid_index(longitude, latitude):
    x = EARTH_RADIUS_KM * math.radians(longitude) * STANDARD_PARALLEL
    y = EARTH_RADIUS_KM * math.sin(math.radians(latitude)) / STANDARD_PARALLEL
    return math.floor(x / GRID_KM), math.floor(y / GRID_KM)


def build_sample(input_dir):
    archive = json.loads(ARCHIVE.read_text())
    # A retrospective selection is fixed before replay. Individual review rules
    # must only use observations up to the interactive replay cutoff.
    _, longitude, latitude, *_ = min(
        (row for row in archive["cells"] if row[0] == "2020-01"),
        key=lambda row: (-sum(row[3:]), row[1], row[2]),
    )
    selected_cell = grid_index(longitude, latitude)
    exact_counts = defaultdict(lambda: [0] * 6)
    observations = []
    input_files = {}

    for sensor in SENSORS:
        name = f"{sensor}_SE_Australia_20190901_20200331.csv"
        input_files[sensor] = name
        path = input_dir / name
        with path.open("rb") as source:
            digest = hashlib.file_digest(source, "sha256").hexdigest()
        if digest != archive["input_sha256"][sensor]:
            raise ValueError(f"SHA-256 mismatch for {name}")

        with path.open(newline="") as source:
            reader = csv.DictReader(source)
            for row in reader:
                if row["type"] != "0":
                    continue
                confidence = int(row["confidence"]) if sensor == "modis" else row["confidence"]
                retained = confidence >= 30 if sensor == "modis" else confidence in ("n", "h")
                if not retained:
                    continue

                lon = float(row["longitude"])
                lat = float(row["latitude"])
                if grid_index(lon, lat) != selected_cell:
                    continue

                date = row["acq_date"]
                platform, column = PLATFORMS[row["satellite"]]
                daynight = row["daynight"]
                exact_counts[date[:7]][column + (daynight == "N")] += 1
                if not START_DATE <= date <= END_DATE:
                    continue

                timestamp = datetime.strptime(f"{date} {row['acq_time'].zfill(4)}", "%Y-%m-%d %H%M")
                observations.append({
                    "latitude": lat,
                    "longitude": lon,
                    "acquiredAt": timestamp.strftime("%Y-%m-%dT%H:%MZ"),
                    "satellite": platform,
                    "instrument": row["instrument"],
                    "confidence": confidence,
                    "daynight": daynight,
                    "version": row["version"],
                    "sourceLine": reader.line_num,
                })

    expected_counts = {
        month: counts
        for month, lon, lat, *counts in archive["cells"]
        if (lon, lat) == (longitude, latitude)
    }
    if exact_counts != expected_counts:
        raise ValueError("Retained rows did not reconcile against the six published counts for every occupied month at this grid center")
    if not observations:
        raise ValueError("The selected dates yielded no retained observations")

    observations.sort(key=lambda row: (row["acquiredAt"], row["instrument"], row["sourceLine"]))
    return {
        "schemaVersion": 1,
        "caseId": "black-summer-2019-2020",
        "grid": {"longitude": longitude, "latitude": latitude, "sizeKm": GRID_KM},
        "startDate": START_DATE,
        "endDate": END_DATE,
        "selection": "Retrospective demonstration site selected by largest combined January 2020 cell count. This extract contains every retained row from the verified FireTrace inputs for this grid cell and the stated UTC dates.",
        "sourcePath": "/data/observations.json",
        "provenancePath": "/reports/provenance.json",
        "inputFiles": input_files,
        "inputSha256": archive["input_sha256"],
        "observations": observations,
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--input-dir", type=Path, default=ROOT.parent / "firetrace-data-gate/filtered")
    parser.add_argument("--check", action="store_true", help="Verify the committed sample without writing it")
    args = parser.parse_args()
    sample = build_sample(args.input_dir)
    metadata = {key: value for key, value in sample.items() if key != "observations"}
    lines = json.dumps(metadata, ensure_ascii=False, indent=2).splitlines()[:-1]
    lines[-1] += ","
    lines.append('  "observations": [')
    lines.append(",\n".join(f"    {json.dumps(row, ensure_ascii=False, separators=(',', ':'))}" for row in sample["observations"]))
    lines.extend(["  ]", "}", ""])
    content = "\n".join(lines)
    if args.check:
        if SAMPLE.read_text() != content:
            raise SystemExit("Committed command-sample.json differs from verified source reconstruction")
    else:
        SAMPLE.write_text(content)
    print(f"Verified {len(sample['observations'])} exact-time archive rows and reconciled monthly platform/day-night counts")


if __name__ == "__main__":
    main()
