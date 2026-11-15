"""Fetch immutable input archives, checking NASA-published SHA256 before rename.
Already downloaded verified archives are reused. No API key needed for country ZIPs.
"""
import hashlib,pathlib,urllib.request
RAW=pathlib.Path(__file__).resolve().parents[2]/'firetrace-global/raw';RAW.mkdir(parents=True,exist_ok=True)
SOURCES={
 'modis_2019_all_countries.zip':('13a581b5d6b28741c81bf01bd27195cf3226b85a29102337f2cd3b2cabf1a517',80447291),
 'modis_2020_all_countries.zip':('bb4c7012b8f4d89dbf24da49143c4cecbaef90cc5f504433642189201d6c0ddb',77958638),
 'viirs-snpp_2019_all_countries.zip':('9ae38fbd33aeed67a75f1652009d43cb41e23ff0da2ea8b5100f0fd261111b84',373189317),
 'viirs-snpp_2020_all_countries.zip':('2095da8ff74d765d355eac3126d0349c932e5187b3ee7c9fe7eb1a8888572fe3',367548957)}
def sha(p):
 with p.open('rb') as f:return hashlib.file_digest(f,'sha256').hexdigest()
for name,(expected,size) in SOURCES.items():
 path=RAW/name
 if path.exists() and path.stat().st_size==size and sha(path)==expected:
  print('Verified existing',name,flush=True);continue
 temp=path.with_suffix('.zip.download');url='https://firms.modaps.eosdis.nasa.gov/data/country/zips/'+name
 with urllib.request.urlopen(url,timeout=60) as response,temp.open('wb') as output:
  published=response.headers.get('x-amz-meta-sha256')
  if published:assert published==expected,'NASA source changed; inspect before updating expected checksum'
  while block:=response.read(1024*1024):output.write(block)
 assert temp.stat().st_size==size and sha(temp)==expected,'Incomplete or changed source; retained for inspection'
 temp.replace(path);print('Downloaded and verified',name,flush=True)
