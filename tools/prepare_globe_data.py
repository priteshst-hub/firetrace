"""Whole-Australia 25 km aggregates from verified annual country CSVs."""
import collections,csv,hashlib,json,math,pathlib
ROOT=pathlib.Path(__file__).resolve().parents[1];D=ROOT.parent/'firetrace-data-gate'
P=json.loads((D/'provenance.json').read_text());cells=collections.defaultdict(lambda:[0]*6);audit={};versions={}
R=6371.0088;C=math.cos(math.radians(-34))
for p in P:
 path=D/p['file'];assert hashlib.sha256(path.read_bytes()).hexdigest()==p['sha256']
 counts=collections.Counter();ver=collections.Counter()
 with path.open() as f:
  for row in csv.DictReader(f):
   counts['source']+=1
   if not '2019-09-01'<=row['acq_date']<='2020-03-31':continue
   counts['selected_date']+=1;ver[row['version']]+=1
   if row['type']!='0':counts['excluded_type']+=1;continue
   if not (float(row['confidence'])>=30 if row['instrument']=='MODIS' else row['confidence'] in ['n','h']):counts['excluded_confidence']+=1;continue
   lon=float(row['longitude']);lat=float(row['latitude']);assert -180<=lon<=180 and -90<=lat<=90 and row['daynight'] in ['D','N']
   i=math.floor(R*math.radians(lon)*C/25);j=math.floor(R*math.sin(math.radians(lat))/C/25)
   index={'Terra':0,'Aqua':2,'N':4}[row['satellite']]+(row['daynight']=='N')
   cells[row['acq_date'][:7],i,j][index]+=1;counts['retained']+=1
 assert counts['selected_date']==counts['excluded_type']+counts['excluded_confidence']+counts['retained']
 audit[path.name]=dict(counts);versions[path.name]=dict(ver)
rows=[]
for (month,i,j),v in sorted(cells.items()):
 lon=math.degrees((i+.5)*25/(R*C));lat=math.degrees(math.asin((j+.5)*25*C/R));rows.append([month,round(lon,4),round(lat,4),*v])
assert sum(sum(r[3:]) for r in rows)==sum(a['retained'] for a in audit.values())
out=dict(cells=rows,grid_km=25,country='Australia',scope='All NASA Australia-assigned source detections; 2019-09-01 through 2020-03-31 UTC. Not limited to southeastern bbox.',audit=audit,versions=versions,provenance=P,filters='Type 0; MODIS confidence >=30; VIIRS n/h. MODIS C6 6.03. VIIRS C2. Observations, not unique fires.',global_coverage=False)
(ROOT/'public/data/globe-observations.json').write_text(json.dumps(out,separators=(',',':')))
(ROOT.parent/'firetrace-global/whole-australia-validation.json').write_text(json.dumps({k:v for k,v in out.items() if k!='cells'},indent=2))
print('Prepared whole Australia:',len(rows),'cell-month rows;',sum(a['retained'] for a in audit.values()),'observations.')
