"""Download public FIRMS annual country archives and aggregate the common historical window globally."""
import collections,concurrent.futures,csv,datetime,hashlib,io,json,math,pathlib,urllib.request,zipfile
ROOT=pathlib.Path(__file__).resolve().parents[1];DATA=ROOT.parent/'firetrace-global';RAW=DATA/'raw';RAW.mkdir(parents=True,exist_ok=True)
SOURCES=[(s,y) for s in ['modis','viirs-snpp'] for y in [2019,2020]]
def acquire(item):
 s,y=item;name=f'{s}_{y}_all_countries.zip';path=RAW/name;url=f'https://firms.modaps.eosdis.nasa.gov/data/country/zips/{name}'
 if not path.exists():
  tmp=path.with_suffix('.partial')
  with urllib.request.urlopen(url,timeout=120) as response,tmp.open('wb') as f:
   while True:
    b=response.read(1024*1024)
    if not b:break
    f.write(b)
  with zipfile.ZipFile(tmp) as z:assert z.namelist()
  tmp.rename(path)
 print('Downloaded',name,path.stat().st_size,flush=True)
 digest=hashlib.file_digest(path.open('rb'),'sha256').hexdigest()
 return dict(sensor=s,year=y,url=url,file=str(path.relative_to(DATA)),bytes=path.stat().st_size,sha256=digest,retrieved_utc=datetime.datetime.now(datetime.timezone.utc).isoformat())
with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:provenance=list(pool.map(acquire,SOURCES))
(DATA/'provenance.json').write_text(json.dumps(provenance,indent=2))
cells=collections.defaultdict(lambda:[0]*6);countries=collections.defaultdict(lambda:[0]*6);audit={};versions={}
for p in provenance:
 s=p['sensor'];year=p['year'];counts=collections.Counter();ver=collections.Counter()
 with zipfile.ZipFile(DATA/p['file']) as z:
  for member in z.infolist():
   if not member.filename.endswith('.csv'):continue
   country=pathlib.Path(member.filename).stem.removeprefix(f'{s}_{year}_')
   with z.open(member) as binary:
    for row in csv.DictReader(io.TextIOWrapper(binary,encoding='utf-8-sig')):
     counts['source_rows']+=1
     date=row['acq_date']
     if not '2019-09-01'<=date<='2020-03-31':continue
     counts['date_selected']+=1;ver[row['version']]+=1
     if row.get('type')!='0':counts['excluded_non_type0']+=1;continue
     if not (float(row['confidence'])>=30 if s=='modis' else row['confidence'] in ['n','h']):counts['excluded_confidence']+=1;continue
     lat=float(row['latitude']);lon=float(row['longitude']);dn=row['daynight']
     if not (math.isfinite(lat) and math.isfinite(lon) and -90<=lat<=90 and -180<=lon<=180 and dn in ['D','N']):counts['invalid_retained_candidate']+=1;continue
     platform=row['satellite'];index=({'Terra':0,'Aqua':2}[platform] if s=='modis' else 4)+(dn=='N')
     key=(country,date[:7],min(179,math.floor(lon)),min(89,math.floor(lat)))
     cells[key][index]+=1;countries[country][index]+=1;counts['retained']+=1
 assert counts['date_selected']==counts['retained']+counts['excluded_non_type0']+counts['excluded_confidence']+counts['invalid_retained_candidate']
 audit[f'{s}_{year}']=dict(counts);versions[f'{s}_{year}']=dict(ver)
 print('Processed',s,year,dict(counts),flush=True)
rows=[[c,m,x+.5,y+.5,*values] for (c,m,x,y),values in sorted(cells.items())]
assert sum(sum(r[4:]) for r in rows)==sum(v['retained'] for v in audit.values())
output=dict(cells=rows,countries=dict(sorted(countries.items())),columns=['country_source','month','longitude_1degree_cell_center','latitude_1degree_cell_center','terra_day','terra_night','aqua_day','aqua_night','viirs_day','viirs_night'],audit=audit,versions=versions,provenance=provenance,period=['2019-09-01','2020-03-31'],grid='1 degree longitude/latitude cells, unequal area. Country-assigned observations; offshore completeness not guaranteed.',filters='type 0; MODIS confidence >=30; VIIRS n/h. Counts are observations, not unique fires. No harmonization applied.')
path=ROOT/'public/data/global-observations.json';path.write_text(json.dumps(output,separators=(',',':')))
assert path.stat().st_size<25*1024*1024
(DATA/'validation.json').write_text(json.dumps(dict(audit=audit,versions=versions,countries=len(countries),cell_month_rows=len(rows),output_sha256=hashlib.sha256(path.read_bytes()).hexdigest()),indent=2))
print('GLOBAL READY',len(countries),'countries',len(rows),'cell-month rows',path.stat().st_size,'bytes',flush=True)
