"""Build the assistant's trusted context from verified project outputs."""
import json,pathlib
R=pathlib.Path(__file__).resolve().parents[1]
r=json.loads((R/'public/reports/history-validation.json').read_text());w=json.loads((R/'public/data/world.geojson').read_text());names={f['properties']['iso']:[f['properties']['name'],f['properties']['label']] for f in w['features']}
out={'snapshot':'2026-11-11','guide':(R/'public/reports/firetrace-guide.md').read_text(),'annual':[{'year':a['period'][0][:4],'audit':a['audit']} for a in r['archives']],'timing':r['timing'],'harmonization':r['harmonization'],'countries':[]}
for iso,labels in names.items():
 years=[]
 for a in r['archives']:
  sources=a['country_mapping'].get(iso,[])
  if sources:
   v=[sum(a['countries'][s][i] for s in sources) for i in range(6)]
   years.append({'year':a['period'][0][:4],'MODIS':sum(v[:4]),'VIIRS':sum(v[4:]),'sources':sources})
 if years:out['countries'].append({'names':labels,'iso':iso,'annual':years})
atlas_path=R/'public/data/atlas/index.json'
if atlas_path.exists():
 atlas=json.loads(atlas_path.read_text());validation=json.loads((R/'public/reports/atlas/validation.json').read_text())
 out['snapshot']='2026-11-20'
 out['atlas_upgrade']={'scope':'Separate Australia Historical Atlas; global globe remains 2019/2020. This current upgrade supersedes older guide statements only for Australia atlas/harmonization and NRT capabilities.','years':[y['year'] for y in atlas['years']],'sources':[{'year':s['year'],'sensor':s['sensor'],'retained':s['counts']['retained'],'versions':s['versions']} for s in atlas['sources']],'method':atlas['method'],'scientific_status':validation['scientific_status'],'target':validation['target'],'holdout':validation['holdout'],'holdout_years':validation['holdout_years'],'limitations':validation['limitations'],'live':{'endpoint':'/api/firms','authenticated_verified':False,'status':'Implemented Worker-secret pathway; authorized MAP_KEY and genuine authenticated verification still required. Never imply that current detections have been obtained.'}}
(R/'worker/knowledge.json').write_text(json.dumps(out,separators=(',',':')))
print('Assistant context generated from verified reports.')
