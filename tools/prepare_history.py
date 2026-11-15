"""Reproduce NASA worldwide 2019/2020 aggregates; detection-conditional, never calibration."""
import collections,csv,datetime,hashlib,io,json,math,pathlib,random,statistics,zipfile,re,unicodedata
ROOT=pathlib.Path(__file__).resolve().parents[1]; RAW=ROOT.parent/'firetrace-global/raw'; OUT=ROOT/'public'
EXPECTED={('modis',2019):'13a581b5d6b28741c81bf01bd27195cf3226b85a29102337f2cd3b2cabf1a517',('modis',2020):'bb4c7012b8f4d89dbf24da49143c4cecbaef90cc5f504433642189201d6c0ddb',('viirs-snpp',2019):'9ae38fbd33aeed67a75f1652009d43cb41e23ff0da2ea8b5100f0fd261111b84',('viirs-snpp',2020):'2095da8ff74d765d355eac3126d0349c932e5187b3ee7c9fe7eb1a8888572fe3'}
def norm(s):return re.sub('[^a-z0-9]','',unicodedata.normalize('NFKD',s).encode('ascii','ignore').decode().lower())
world=json.loads((OUT/'data/world.geojson').read_text());country_lookup={norm(f['properties'][n]):f['properties']['iso'] for f in world['features'] for n in ('name','label')}
old=json.loads((OUT/'data/world-observations.json').read_text());lookup={s:k for k,v in old['country_mapping'].items() for s in v}
# Natural Earth omits a separate Mayotte geometry; retain its named source under France.
lookup['Mayotte']='FRA'
def gap(a,b):
 a=sorted(a);b=sorted(b);i=j=0;best=1440
 while i<len(a) and j<len(b):
  best=min(best,abs(a[i]-b[j]))
  if a[i]<b[j]:i+=1
  else:j+=1
 return best
assert gap([0],[1439])==1439 and gap([1,100],[90,200])==10
reports=[];timing=[];country_month={};coverage=[]
for year in (2019,2020):
 cells=collections.defaultdict(lambda:[0]*6);totals=collections.defaultdict(lambda:[0]*6);mapping=collections.defaultdict(set);audits={};sources=[];archives={}
 for sensor in ('modis','viirs-snpp'):
  p=RAW/f'{sensor}_{year}_all_countries.zip';h=hashlib.file_digest(p.open('rb'),'sha256').hexdigest();assert h==EXPECTED[sensor,year],(p,h)
  z=zipfile.ZipFile(p);assert z.testzip() is None;archives[sensor]=z
  sources.append(dict(sensor=sensor,url=f'https://firms.modaps.eosdis.nasa.gov/data/country/zips/{p.name}',sha256=h,bytes=p.stat().st_size))
 names={s:{pathlib.Path(n).stem.removeprefix(f'{s}_{year}_'):n for n in z.namelist() if n.endswith('.csv')} for s,z in archives.items()}
 for country in sorted(set().union(*(set(n) for n in names.values()))):
  totals[country] # Preserve loaded source files even when all rows are filtered out.
  units={p:collections.defaultdict(set) for p in ('Terra','Aqua','N')}
  for sensor,z in archives.items():
   if country not in names[sensor]:continue
   audit=collections.Counter();ver=collections.Counter();dates=collections.Counter();months=collections.Counter();platforms=collections.Counter();daily=collections.Counter();bounds=[180,90,-180,-90]
   with z.open(names[sensor][country]) as binary:
    for row in csv.DictReader(io.TextIOWrapper(binary,encoding='utf-8-sig')):
     audit['source_rows']+=1;ver[row['version']]+=1;date=datetime.date.fromisoformat(row['acq_date']);assert date.year==year;dates[row['acq_date']]+=1
     if row['type']!='0':audit['excluded_type']+=1;continue
     if not(float(row['confidence'])>=30 if sensor=='modis' else row['confidence'] in ('n','h')):audit['excluded_confidence']+=1;continue
     lon=float(row['longitude']);lat=float(row['latitude']);dn=row['daynight'];platform=row['satellite'];assert -180<=lon<=180 and -90<=lat<=90 and dn in ('D','N')
     assert platform in (('Terra','Aqua') if sensor=='modis' else ('N',))
     t=row['acq_time'].zfill(4);minute=int(t[:2])*60+int(t[2:]);assert 0<=minute<1440 and int(t[2:])<60
     idx={'Terra':0,'Aqua':2,'N':4}[platform]+(dn=='N');month=row['acq_date'][:7]
     cells[country,month,min(179,math.floor(lon)),min(89,math.floor(lat))][idx]+=1;totals[country][idx]+=1
     country_month.setdefault((year,country,month),[0]*6)[idx]+=1
     units[platform][row['acq_date'],dn,math.floor(lon*4),math.floor(lat*4)].add(minute)
     audit['retained']+=1;months[month]+=1;platforms[platform]+=1;daily[row['acq_date']]+=1
     bounds=[min(bounds[0],lon),min(bounds[1],lat),max(bounds[2],lon),max(bounds[3],lat)]
   assert audit['source_rows']==audit['retained']+audit['excluded_type']+audit['excluded_confidence']
   audits.setdefault(sensor,collections.Counter()).update(audit)
   coverage.append(dict(year=year,country=country,sensor=sensor,audit=dict(audit),versions=dict(ver),source_first=min(dates) if dates else None,source_last=max(dates) if dates else None,source_days=len(dates),retained_days=len(daily),retained_months=dict(months),platforms=dict(platforms),retained_bbox=bounds if audit['retained'] else None))
   if country not in lookup and norm(country) in country_lookup:lookup[country]=country_lookup[norm(country)]
   if country in lookup:mapping[lookup[country]].add(country)
  for platform in ('Terra','Aqua'):
   for dn in ('D','N'):
    a={k for k in units[platform] if k[1]==dn};v={k for k in units['N'] if k[1]==dn};common=a&v;hist=collections.Counter(gap(units[platform][k],units['N'][k]) for k in common)
    timing.append(dict(year=year,country=country,platform=platform,daynight=dn,modis_units=len(a),viirs_units=len(v),shared_units=len(common),gap_histogram=dict(hist)))
  print(year,country,flush=True)
 rows=[[m,x+.5,y+.5,*v,c] for (c,m,x,y),v in sorted(cells.items())];retained=sum(a['retained'] for a in audits.values());assert sum(sum(r[3:9]) for r in rows)==retained==sum(sum(v) for v in totals.values())
 unmatched=sorted(set(totals)-set(lookup));assert not unmatched,unmatched
 out=dict(sensor_source_countries={s:sorted(n) for s,n in names.items()},cells=rows,countries=dict(totals),country_mapping={k:sorted(v) for k,v in mapping.items()},period=[f'{year}-01-01',f'{year}-12-31'],scope='NASA country-assigned historical detections; unassigned/ocean observations may be absent.',grid_degrees=1,global_coverage=True,audit={s:dict(a) for s,a in audits.items()},sources=sources)
 p=OUT/f'data/history-{year}.json';p.write_text(json.dumps(out,separators=(',',':')));assert p.stat().st_size<25*1024*1024
 reports.append({k:v for k,v in out.items() if k!='cells'}|dict(cell_month_rows=len(rows),output_sha256=hashlib.sha256(p.read_bytes()).hexdigest(),output_bytes=p.stat().st_size))
 for z in archives.values():z.close()
summary=[]
for year in (2019,2020):
 for platform in ('Terra','Aqua'):
  for dn in ('D','N','ALL'):
   selected=[t for t in timing if t['year']==year and t['platform']==platform and (dn=='ALL' or t['daynight']==dn)];hist=collections.Counter()
   for t in selected:hist.update({int(k):v for k,v in t['gap_histogram'].items()})
   n=sum(hist.values());mid=[]
   for rank in ((n-1)//2,n//2):
    acc=0
    for g,count in sorted(hist.items()):
     acc+=count
     if acc>rank:mid.append(g);break
   summary.append(dict(year=year,platform=platform,daynight=dn,modis_units=sum(t['modis_units'] for t in selected),viirs_units=sum(t['viirs_units'] for t in selected),shared_units=n,median_minimum_gap_minutes=statistics.mean(mid) if n else None,within_minutes={str(w):dict(count=sum(c for g,c in hist.items() if g<=w),fraction=sum(c for g,c in hist.items() if g<=w)/n if n else None) for w in (15,30,60)}))
train=collections.defaultdict(lambda:[0,0]);test=[]
for (y,c,m),v in country_month.items():
 a=v[2]+v[3];n=v[4]+v[5]
 if a>0 and n>0:
  if y==2019:train[c][0]+=a;train[c][1]+=n
  else:test.append((c,m,a,n))
errors=[]
for c,m,a,n in test:
 if train[c][1]:
  pred=n*train[c][0]/train[c][1];errors.append(dict(country=c,month=m,aqua=a,viirs=n,predicted_aqua=pred,error=pred-a,absolute_error=abs(pred-a),identity_absolute_error=abs(n-a)))
assert all(e['month'].startswith('2020-') for e in errors)
blocks=collections.defaultdict(list)
for e in errors:blocks[e['country']].append(e)
rng=random.Random(1729);boot=[];keys=sorted(blocks)
for _ in range(500):
 sample=[e for c in rng.choices(keys,k=len(keys)) for e in blocks[c]];boot.append(statistics.mean(e['absolute_error'] for e in sample))
boot.sort()
experiment=dict(status='Exploratory baseline only; NOT calibrated or harmonized',training='2019 country-level Aqua/VIIRS total ratios, fit only on months positive in both',holdout='Entire 2020 calendar year; months positive in both; countries also present in training',test_units=len(errors),country_blocks=len(blocks),mae=statistics.mean(e['absolute_error'] for e in errors),bias=statistics.mean(e['error'] for e in errors),identity_mae=statistics.mean(e['identity_absolute_error'] for e in errors),mae_country_bootstrap_95_interval=[boot[12],boot[487]],bootstrap_replicates=500,seed=1729,limitations=['Conditional on positive detections; not a clear-sky exposure model.','Ratio is a weak comparator, not a deployable harmonization method.','Country bootstrap reflects sampled country variability, not total scientific uncertainty.','No independent spatial holdout, no valid observation masks, only two years, MODIS C6 not C6.1.','2019/2020 split divides Black Summer; not an independent extreme-season stress test.'],release_gate='BLOCKED: no calibrated series is produced or displayed')
result=dict(archives=reports,timing=summary,timing_method='0.25 degree geographic cell × country × UTC date × source day/night. Minimum absolute acquisition-minute gap, no midnight wrap. Cells unequal-area; no individual fire pairing. Fractions condition on shared detections; not recall or coverage.',coverage_limit='Source date spans and reported detections are NOT valid-observation or clear-sky coverage. Missing detections retain unknown observation status.',harmonization=experiment,generated_utc=datetime.datetime.now(datetime.timezone.utc).isoformat())
for name,obj in [('history-validation.json',result),('history-coverage.json',coverage),('history-timing-country.json',timing),('holdout-predictions.json',errors)]:
 (OUT/'reports'/name).write_text(json.dumps(obj,indent=2))
print(json.dumps(result,indent=2),flush=True)
