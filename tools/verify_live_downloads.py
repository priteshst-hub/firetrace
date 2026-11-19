"""Read-only public Atlas download verification. No NASA credential required."""
import concurrent.futures
import gzip
import hashlib
import json
import subprocess

BASE = 'https://firetrace-black-summer.priteshst.workers.dev'


def download(path):
    return subprocess.check_output(['curl', '--fail', '--silent', '--show-error',
                                    '--max-time', '60', BASE + path])


def verify(year):
    for fmt, key in [('json', 'sha256'), ('csv', 'csv_sha256')]:
        data = download(year[fmt])
        if hashlib.sha256(data).hexdigest() != year[key]:
            raise ValueError(f"{year['year']} {fmt}: compressed SHA-256 mismatch")
        raw = gzip.decompress(data)
        if fmt == 'json':
            if hashlib.sha256(raw).hexdigest() != year['uncompressed_sha256']:
                raise ValueError(f"{year['year']}: uncompressed SHA-256 mismatch")
            json.loads(raw)
    return year['year']


if __name__ == '__main__':
    index = json.loads(download('/data/atlas/index.json'))
    with concurrent.futures.ThreadPoolExecutor(max_workers=5) as pool:
        years = list(pool.map(verify, index['years']))
    print(json.dumps({'status': 'pass', 'years': years, 'compressed_files': len(years) * 2,
                      'checks': ['compressed SHA-256', 'gzip integrity',
                                 'uncompressed JSON SHA-256', 'JSON parsing']}))
