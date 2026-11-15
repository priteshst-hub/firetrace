"""Aggregate public 2020 MODIS country files; no synthetic global fire data."""
import collections,csv,datetime,hashlib,io,json,math,pathlib,re,zipfile,unicodedata
ROOT=pathlib.Path(__file__).resolve().parents[1];D=ROOT.parent/'firetrace-global';path=D/'raw/modis_2020_all_countries.zip'
assert path.stat().st_size==77958638
sourcehash=hashlib.file_digest(path.open('rb'),'sha256').hexdigest()
assert sourcehash=='bb4c7012b8f4d89dbf24da49143c4cecbaef90cc5f504433642189201d6c0ddb'
world=json.loads((ROOT/'public/data/world.geojson').read_text());cells=collections.defaultdict(lambda:[0]*6);countrytotals={};audit=collections.Counter();versions=collections.Counter();mapping={}
def norm(s):return re.sub('[^a-z0-9]','',unicodedata.normalize('NFKD',s).encode('ascii','ignore').decode().lower())
aliases={'capeverde':'CPV','republicofcongo':'COG','macedoniaformeryugoslavrepublicof':'MKD','frenchguiana':'FRA','guadeloupe':'FRA','martinique':'FRA','svalbardandjanmayen':'NOR','unitedstatesminoroutlyingislands':'USA','unitedstates':'USA','congo':'COG','congodemocraticrepublicofthe':'COD','congodemocraticrepublic':'COD','democraticrepublicofcongo':'COD','cotedivoire':'CIV','cotedivoireivorycoast':'CIV','czechrepublic':'CZE','swaziland':'SWZ','easttimor':'TLS','tanzania':'TZA','korearepublicof':'KOR','koreademocraticpeoplesrepublicof':'PRK','vietnam':'VNM','laos':'LAO','russianfederation':'RUS','syrianarabrepublic':'SYR','iranislamicrepublicof':'IRN','boliviaplurinationalstateof':'BOL','venezuelabolivarianrepublicof':'VEN','macedonia':'MKD','serbia':'SRB','reunion':'FRA','palestinianterritory':'PSX'}
lookup={norm(f['properties'][n]):f['properties']['iso'] for f in world['features'] for n in ['name','label']};lookup.update(aliases)
with zipfile.ZipFile(path) as z:
 for entry in z.infolist():
  if not entry.filename.endswith('.csv'):continue
  country=pathlib.Path(entry.filename).stem.removeprefix('modis_2020_');countrytotals[country]=[0]*6
  iso=lookup.get(norm(country))
  if iso:mapping.setdefault(iso,[]).append(country)
  with z.open(entry) as binary:
   for row in csv.DictReader(io.TextIOWrapper(binary,encoding='utf-8-sig')):
    audit['source_rows']+=1;versions[row['version']]+=1
    if row['type']!='0':audit['excluded_type']+=1;continue
    if float(row['confidence'])<30:audit['excluded_confidence']+=1;continue
    date=datetime.date.fromisoformat(row['acq_date']);lon=float(row['longitude']);lat=float(row['latitude']);assert date.year==2020 and -180<=lon<=180 and -90<=lat<=90 and row['daynight'] in ['D','N']
    index={'Terra':0,'Aqua':2}[row['satellite']]+(row['daynight']=='N')
    key=(country,row['acq_date'][:7],min(179,math.floor(lon)),min(89,math.floor(lat)))
    cells[key][index]+=1;countrytotals[country][index]+=1;audit['retained']+=1
assert audit['source_rows']==audit['retained']+audit['excluded_type']+audit['excluded_confidence']
rows=[[m,x+.5,y+.5,*v,c] for (c,m,x,y),v in sorted(cells.items())]
assert sum(sum(r[3:9]) for r in rows)==audit['retained']==sum(sum(v) for v in countrytotals.values())
matched={s for values in mapping.values() for s in values}
unmatched=sorted(set(countrytotals)-matched)
out=dict(cells=rows,grid_degrees=1,countries=countrytotals,country_mapping=mapping,unmatched_source_countries=unmatched,audit=dict(audit),versions=dict(versions),global_coverage=True,period=['2020-01-01','2020-12-31'],scope='Worldwide NASA country-assigned MODIS C6 observations for 2020; country archives may omit unassigned/ocean detections. VIIRS not loaded globally.',provenance=dict(url='https://firms.modaps.eosdis.nasa.gov/data/country/zips/modis_2020_all_countries.zip',sha256=sourcehash,bytes=path.stat().st_size,processed_utc=datetime.datetime.now(datetime.timezone.utc).isoformat()),filters='type 0, confidence >=30; 1 degree geographic cells have unequal areas; counts are observations, not unique fires.')
p=ROOT/'public/data/world-observations.json';p.write_text(json.dumps(out,separators=(',',':')));assert p.stat().st_size<25*1024*1024
summary={k:v for k,v in out.items() if k!='cells'};summary['cell_month_rows']=len(rows);summary['output_sha256']=hashlib.sha256(p.read_bytes()).hexdigest();(D/'world-validation.json').write_text(json.dumps(summary,indent=2));(ROOT/'public/reports/world-validation.json').write_text(json.dumps(summary,indent=2))
print('GLOBAL MODIS READY:',dict(audit),len(countrytotals),'source countries;',len(rows),'cell-months;',p.stat().st_size,'bytes; unmatched',unmatched,flush=True)
