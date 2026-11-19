"""Reconcile every released JSON/CSV row with source inventories and monthly chart data."""
import csv,gzip,hashlib,io,json,pathlib
ROOT=pathlib.Path(__file__).resolve().parents[1]
index=json.loads((ROOT/'public/data/atlas/index.json').read_text())
validation=json.loads((ROOT/'public/reports/atlas/validation.json').read_text())
assert set(validation['training_years']).isdisjoint(validation['holdout_years'])
assert set(validation['calibration_years']).isdisjoint(validation['holdout_years'])
assert index['status']=='EXPERIMENTAL'
retained=0;rowcount=0
for year in index['years']:
    path=ROOT/'public'/year['json'].lstrip('/')
    compressed=path.read_bytes();raw=gzip.decompress(compressed)
    assert hashlib.sha256(compressed).hexdigest()==year['sha256']
    assert hashlib.sha256(raw).hexdigest()==year['uncompressed_sha256']
    data=json.loads(raw);assert len(data)==year['rows'];rowcount+=len(data)
    csvpath=ROOT/'public'/year['csv'].lstrip('/')
    assert hashlib.sha256(csvpath.read_bytes()).hexdigest()==year['csv_sha256']
    with gzip.open(csvpath,'rt') as f: exported=list(csv.DictReader(f))
    assert len(exported)==len(data)
    seen=set()
    for record,export in zip(data,exported):
        assert (record['grid_id'],record['month']) not in seen
        seen.add((record['grid_id'],record['month']))
        assert record['year']==year['year'] and record['month'].startswith(str(year['year']))
        assert record['missing_data_status']=='observation_exposure_unknown'
        assert 'EXPERIMENTAL' in record['quality_flags']
        assert json.loads(export['source_availability'])==record['source_availability']
        assert export['grid_id']==record['grid_id']
        for key,value in record.items():
            if isinstance(value,(dict,list)): assert json.loads(export[key])==value
            else: assert export[key]==('' if value is None else str(value)),key
        for key in ('aqua_occupied_windows','viirs_occupied_windows'):
            assert record[key] is None or 0<=record[key]<=62
        if record['status']=='blended_aqua_equivalent_occupied_windows':
            prediction=min(62,validation['coefficient']*record['viirs_occupied_windows'])
            assert record['activity_estimate']==(record['aqua_occupied_windows']+prediction)/2
        elif record['status']=='MODIS_only_Aqua_baseline':
            assert record['activity_estimate']==record['aqua_occupied_windows']

        if year['year']==2001 or record['month']<'2002-07':
            assert record['modis_aqua_count'] is None
            assert record['source_availability']['modis_aqua'] is False
        if year['year']<2012:
            assert record['viirs_snpp_count'] is None
            assert record['status'].startswith('MODIS_only')
            assert record['activity_lower'] is None
        if 'UNMATCHED_SENSOR_ACTIVITY' in record['quality_flags']:
            assert record['activity_lower'] is None and record['activity_upper'] is None
    for source in (s for s in index['sources'] if s['year']==year['year']):
        keys=['modis_terra_count','modis_aqua_count'] if source['sensor']=='modis' else ['viirs_snpp_count']
        n=sum(sum(r[k] or 0 for k in keys) for r in data)
        assert n==source['counts']['retained'];retained+=n
        assert source['source_first'][:4]==str(year['year'])==source['source_last'][:4]
        assert len(source['sha256'])==64
        if source['published_sha256']: assert source['sha256']==source['published_sha256']
        c=source['counts'];assert c['source_rows']==sum(c.get(k,0) for k in ('retained','duplicate_filtered_rows','excluded_type','excluded_confidence'))
    for month in year['monthly']:
        records=[r for r in data if r['month']==month['month']]
        for summary,key in [('modis_terra','modis_terra_count'),('modis_aqua','modis_aqua_count'),('viirs','viirs_snpp_count'),('indicator','activity_estimate')]:
            values=[r[key] for r in records if r[key] is not None]
            assert month[summary]==(sum(values) if values else None)
for diagnostic in validation.get('acquisition_diagnostics',[]):
    annual=next(y for y in index['years'] if y['year']==diagnostic['year'])
    aqua=sum(m['modis_aqua'] or 0 for m in annual['monthly'])
    viirs=sum(m['viirs'] or 0 for m in annual['monthly'])
    for d in diagnostic['thresholds'].values():
        assert d['paired_aqua_reports']+d['unmatched_aqua_reports']==aqua
        assert d['paired_viirs_reports']+d['unmatched_viirs_reports']==viirs
for path in (ROOT/'public').rglob('*'):

    if path.is_file(): assert path.stat().st_size<25*1024*1024, f'Cloudflare oversized asset: {path}'
result=dict(status='PASS',years=[y['year'] for y in index['years']],sources=len(index['sources']),cell_month_rows=rowcount,reconciled_retained_reports=retained,checks=['source audit reconciliation','compressed/uncompressed SHA256','JSON/CSV equivalence','no fabricated pre-VIIRS observations','unique cell-month rows','monthly chart reconciliation','temporal split separation','missing/unsupported interval handling','Cloudflare per-file asset size'])
(ROOT/'public/reports/atlas/reconciliation.json').write_text(json.dumps(result,indent=2)+'\n')
print(json.dumps(result,indent=2))
