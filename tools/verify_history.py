"""Independent aggregate, provenance, partition and holdout reconciliation."""
import collections,hashlib,json,pathlib,statistics
R=pathlib.Path(__file__).resolve().parents[1];P=R/'public';report=json.loads((P/'reports/history-validation.json').read_text());coverage=json.loads((P/'reports/history-coverage.json').read_text());timing=json.loads((P/'reports/history-timing-country.json').read_text());pred=json.loads((P/'reports/holdout-predictions.json').read_text())
aus_total=0
for y,a in zip((2019,2020),report['archives']):
 path=P/f'data/history-{y}.json';assert hashlib.sha256(path.read_bytes()).hexdigest()==a['output_sha256'];d=json.loads(path.read_text());total=[0]*6;countries={c:[0]*6 for c in d['countries']}
 for row in d['cells']:
  assert row[0].startswith(str(y)) and 1<=int(row[0][5:])<=12
  assert -180<=row[1]<=180 and -90<=row[2]<=90
  assert len(row)==10 and all(isinstance(n,int) and n>=0 for n in row[3:9])
  for i,n in enumerate(row[3:9]):total[i]+=n;countries[row[9]][i]+=n
 assert dict(countries)==d['countries']
 assert sum(total[:4])==d['audit']['modis']['retained'];assert sum(total[4:])==d['audit']['viirs-snpp']['retained']
 for sensor,audit in d['audit'].items():
  assert audit['source_rows']==audit['retained']+audit.get('excluded_type',0)+audit.get('excluded_confidence',0)
  records=[c for c in coverage if c['year']==y and c['sensor']==sensor]
  assert sum(c['audit'].get('retained',0) for c in records)==audit['retained']
  for c in records:
   assert set(c['versions'])<=({'6.03'} if sensor=='modis' else {'2'})
 mapped=[n for ns in d['country_mapping'].values() for n in ns];assert len(mapped)==len(set(mapped)) and set(mapped)==set(countries)
 aus_names=d['country_mapping'].get('AUS',[])
 aus_total+=sum(sum(r[3:9]) for r in d['cells'] if r[9] in aus_names and '2019-09'<=r[0]<='2020-03')
 if y==2020:
  old=json.loads((P/'data/world-observations.json').read_text());assert sum(total[:4])==old['audit']['retained']==4055050
assert aus_total==1288177,aus_total
for t in timing:
 n=sum(t['gap_histogram'].values());assert n==t['shared_units']<=min(t['modis_units'],t['viirs_units']);assert all(0<=int(g)<1440 for g in t['gap_histogram'])
for t in report['timing']:
 rows=[r for r in timing if r['year']==t['year'] and r['platform']==t['platform'] and (t['daynight']=='ALL' or r['daynight']==t['daynight'])];assert sum(r['shared_units'] for r in rows)==t['shared_units']
 counts=[t['within_minutes'][str(w)]['count'] for w in (15,30,60)];assert counts==sorted(counts) and counts[-1]<=t['shared_units']
assert len(pred)==report['harmonization']['test_units']
assert all(p['month'].startswith('2020-') and p['aqua']>0 and p['viirs']>0 for p in pred)
assert abs(statistics.mean(abs(p['predicted_aqua']-p['aqua']) for p in pred)-report['harmonization']['mae'])<1e-9
print('PASS: yearly counts, country totals, versions, SHA256, old 2020 MODIS continuity, timing partitions and held-out MAE reconcile.')
