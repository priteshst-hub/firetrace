"""Build compact browser data directly from verified FireTrace outputs."""
import collections,csv,hashlib,json,math,pathlib,shutil
ROOT=pathlib.Path(__file__).resolve().parents[1];WORK=ROOT.parent
OUT=ROOT/'public/data';OUT.mkdir(exist_ok=True)
R=6371.0088;C=math.cos(math.radians(-34));cells=collections.defaultdict(lambda:[0]*6);counts=collections.Counter();inputs={}
a=json.loads((WORK/'firetrace-analysis/outputs/analysis.json').read_text())
for sensor in ('modis','viirs-snpp'):
 p=WORK/'firetrace-data-gate/filtered'/f'{sensor}_SE_Australia_20190901_20200331.csv'
 inputs[sensor]=hashlib.sha256(p.read_bytes()).hexdigest();assert inputs[sensor]==a['input_sha256'][sensor]
 with p.open() as f:
  for row in csv.DictReader(f):
   if row['type']!='0':continue
   if not (float(row['confidence'])>=30 if sensor=='modis' else row['confidence'] in ('n','h')):continue
   index={'Terra':0,'Aqua':2,'N':4}[row['satellite']]+(row['daynight']=='N')
   lon=float(row['longitude']);lat=float(row['latitude']);x=R*math.radians(lon)*C;y=R*math.sin(math.radians(lat))/C
   month=row['acq_date'][:7];key=(month,math.floor(x/10),math.floor(y/10));cells[key][index]+=1;counts[sensor]+=1
assert counts['modis']==97185 and counts['viirs-snpp']==542727
rows=[]
for (month,i,j),values in sorted(cells.items()):
 lon=math.degrees((i+.5)*10/(R*C));lat=math.degrees(math.asin((j+.5)*10*C/R))
 rows.append([month,round(lon,4),round(lat,4),*values])
output={'cells':rows,'columns':['month','longitude_grid_center','latitude_grid_center','terra_day','terra_night','aqua_day','aqua_night','viirs_day','viirs_night'],'input_sha256':inputs,'source_counts':dict(counts),'grid_km':10,'scope':'Australia country-clipped bbox 140,-39,154,-29; 2019-09-01–2020-03-31 UTC','note':'Grid centers may be just outside selection bounds; source observations remain within bounds. Counts use type 0; MODIS confidence >=30; VIIRS n/h.'}
(OUT/'observations.json').write_text(json.dumps(output,separators=(',',':')))
with (WORK/'firetrace-analysis/outputs/temporal_sensitivity.csv').open() as f:timing=list(csv.DictReader(f))
(OUT/'timing.json').write_text(json.dumps(timing,separators=(',',':')))
for name in ['harmonization-plan.md','status-2026-11-10.md','validation-report.md','provenance.json']:
 shutil.copyfile(WORK/'firetrace-data-gate'/name,ROOT/'public/reports'/name)
for name in ['timing-report.md']:
 shutil.copyfile(WORK/'firetrace-analysis'/name,ROOT/'public/reports'/name)
for name in ['temporal_sensitivity.csv','monthly_counts.csv','grid_sensitivity.csv']:
 shutil.copyfile(WORK/'firetrace-analysis/outputs'/name,ROOT/'public/reports'/name)
print(f'Prepared {len(rows):,} cell-month rows; all 639,912 retained observations reconcile.')
