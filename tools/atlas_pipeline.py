"""Official FIRMS Australia archive pipeline. Standard library; bounded downloads/resumable processing.
Run: python3 tools/atlas_pipeline.py acquire; python3 tools/atlas_pipeline.py derive
Raw original coordinates/timestamps remain in cached source ZIPs and Australia CSV.gz.
"""
import concurrent.futures
import fcntl
import threading
import resource
import sys
import argparse, collections, csv, datetime as dt, gzip, hashlib, io, json, math, pathlib, shutil, sqlite3, subprocess, zipfile
ROOT = pathlib.Path(__file__).resolve().parents[1]
CACHE = ROOT / '.firms-cache'
OUT = ROOT / 'public/data/atlas'
REPORT = ROOT / 'public/reports/atlas'
METHOD = 'FT-occupancy-bridge-1.0'
R = 6371.0088
C = math.cos(math.radians(-34))
DOWNLOAD_STOP=threading.Event()
DOWNLOAD_CHILDREN=set()
DOWNLOAD_LOCK=threading.Lock()

def run_curl(args, **kwargs):
    with DOWNLOAD_LOCK:
        if DOWNLOAD_STOP.is_set(): raise RuntimeError('Acquisition interrupted')
        process=subprocess.Popen(args,stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True)
        DOWNLOAD_CHILDREN.add(process)
    try:
        stdout,stderr=process.communicate()
        return subprocess.CompletedProcess(args,process.returncode,stdout,stderr)
    finally:
        with DOWNLOAD_LOCK: DOWNLOAD_CHILDREN.discard(process)


def dump(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    temp = path.with_suffix(path.suffix + '.tmp')
    temp.write_text(json.dumps(value, separators=(',', ':'), allow_nan=False) + '\n')
    temp.replace(path)

def sha(path):
    with path.open('rb') as f:
        return hashlib.file_digest(f, 'sha256').hexdigest()

def cell(lon, lat, size=25):
    return math.floor(R * math.radians(lon) * C / size), math.floor(R * math.sin(math.radians(lat)) / C / size)

def center(x, y):
    return math.degrees((x + .5) * 25 / (R * C)), math.degrees(math.asin((y + .5) * 25 * C / R))

def inventory():
    return [json.loads(p.read_text()) for p in sorted(REPORT.glob('source-*.json'))]

def process(path, sensor, year, url, published):
    digest = sha(path)
    if published and published != digest:
        raise ValueError('NASA SHA256 mismatch: ' + url)
    dbpath = CACHE / 'working.sqlite'
    dbpath.unlink(missing_ok=True)
    db = sqlite3.connect(dbpath)
    db.execute('pragma cache_size=-65536')
    db.execute('pragma journal_mode=OFF')
    db.execute('pragma synchronous=OFF')
    db.execute('pragma temp_store=FILE')
    db.execute('create table observations (identity blob primary key, month text, x int, y int, platform text, date text, dn text, minute int)')
    counts = collections.Counter(); versions = collections.Counter(); platforms = collections.Counter(); dates = collections.Counter()
    with zipfile.ZipFile(path) as z:
        members = [n for n in z.namelist() if n.endswith(f'_{year}_Australia.csv')]
        if len(members) != 1: raise ValueError('Expected one Australia member')
        # Reading selected member to EOF checks its ZIP CRC. Full archive SHA is checked above.
        with z.open(members[0]) as binary, gzip.open(CACHE / f'{sensor}-{year}-Australia.csv.gz', 'wt', compresslevel=3) as original:
            stream = io.TextIOWrapper(binary, encoding='utf-8-sig')
            reader = csv.DictReader(stream)
            required = {'latitude','longitude','acq_date','acq_time','satellite','instrument','version','confidence','type','daynight'}
            if not required <= set(reader.fieldnames or []): raise ValueError('Invalid schema')
            writer = csv.DictWriter(original, fieldnames=reader.fieldnames); writer.writeheader()
            for row in reader:
                counts['source_rows'] += 1
                date = dt.date.fromisoformat(row['acq_date']); assert date.year == year
                lat, lon = float(row['latitude']), float(row['longitude'])
                assert -90 <= lat <= 90 and -180 <= lon <= 180
                platform = row['satellite']; assert platform in (('Terra','Aqua') if sensor == 'modis' else ('N',))
                assert row['instrument'].upper() == ('MODIS' if sensor == 'modis' else 'VIIRS')
                assert row['daynight'] in ('D','N')
                time = row['acq_time'].zfill(4); hour, minute = int(time[:2]), int(time[2:]); assert 0 <= hour < 24 and 0 <= minute < 60
                versions[row['version']] += 1; platforms[platform] += 1; dates[date.isoformat()] += 1
                writer.writerow(row)
                if row['type'] != '0': counts['excluded_type'] += 1; continue
                if not (float(row['confidence']) >= 30 if sensor == 'modis' else row['confidence'] in ('n','h')):
                    counts['excluded_confidence'] += 1; continue
                identity = hashlib.sha256(json.dumps(row, sort_keys=True).encode()).digest()
                x,y = cell(lon,lat)
                changed = db.execute('insert or ignore into observations values (?,?,?,?,?,?,?,?)', (identity, date.isoformat()[:7], x,y,platform,date.isoformat(),row['daynight'],hour*60+minute)).rowcount
                counts['retained' if changed else 'duplicate_filtered_rows'] += 1
                if counts['source_rows'] % 10000 == 0: db.commit()
                if counts['source_rows'] % 250000 == 0: print('Processing',sensor,year,counts['source_rows'],flush=True)
    db.commit()
    rows=[]
    for month,x,y,platform,n,occupied in db.execute("select month,x,y,platform,count(*),count(distinct date || dn) from observations group by month,x,y,platform"):
        rows.append([month,x,y,platform,n,occupied])
    # Near-time corroboration diagnostic only; each acquisition group used once.
    acquisitions = collections.defaultdict(lambda: collections.defaultdict(list))
    for x,y,date,dn,platform,minute,n in db.execute('select x,y,date,dn,platform,minute,count(*) from observations group by x,y,date,dn,platform,minute'):
        acquisitions[(x,y,date,dn)][platform].append([minute,n])
    dump(CACHE / f'{sensor}-{year}-groups.json', [[*k,dict(v)] for k,v in acquisitions.items()])
    dump(CACHE / f'{sensor}-{year}-cells.json', rows)
    db.close(); dbpath.unlink()
    assert counts['source_rows'] == sum(counts[k] for k in ('retained','duplicate_filtered_rows','excluded_type','excluded_confidence'))
    report=dict(sensor=sensor,year=year,url=url,sha256=digest,published_sha256=published,bytes=path.stat().st_size,member=members[0],member_crc_verified=True,collection_identification='Literal FIRMS version retained; collection mapping must be checked against product metadata, not inferred from a decimal string',full_zip_members_crc_checked=False,counts=dict(counts),versions=dict(versions),platforms=dict(platforms),source_first=min(dates),source_last=max(dates),detection_dates=len(dates),coverage='Country archive present; cloud/valid-observation exposure UNKNOWN. Dates describe detections, not full observation coverage.',filter='type=0; MODIS confidence>=30; VIIRS confidence n/h; exact retained-row deduplication',status='verified',processed_at=dt.datetime.now(dt.timezone.utc).isoformat())
    dump(REPORT / f'source-{sensor}-{year}.json',report)
    print(sensor,year,dict(counts),flush=True)

def download(sensor,year):
    name=f'{sensor}_{year}_all_countries.zip'; url='https://firms.modaps.eosdis.nasa.gov/data/country/zips/'+name
    path=CACHE/name;headers=CACHE/f'{name}.headers'
    existing=ROOT.parent/'firetrace-global/raw'/name
    if not path.exists() and existing.exists(): shutil.copyfile(existing,path)
    if not path.exists():
        partial=path.with_suffix('.zip.download')
        result=run_curl(['curl','--fail','--location','--retry','2','--connect-timeout','20','--max-time','900','--continue-at','-','--dump-header',str(headers),'--output',str(partial),url],capture_output=True,text=True)
        if result.returncode: raise RuntimeError(result.stderr[-800:])
        partial.replace(path)
    else:
        result=run_curl(['curl','--fail','--head','--silent','--show-error','--max-time','45','--output',str(headers),url],capture_output=True,text=True)
        if result.returncode: raise RuntimeError(result.stderr[-800:])
    published=next((line.split(':',1)[1].strip() for line in headers.read_text().splitlines() if line.lower().startswith('x-amz-meta-sha256:')),None)
    if published and sha(path)!=published:
        # Preserve a failed/interrupted cache artifact; never reuse it as science data.
        rejected_hash=sha(path)
        rejected=path.with_name(path.stem+'.rejected-'+rejected_hash[:16]+'.zip')
        path.replace(rejected)
        result=run_curl(['curl','--fail','--location','--retry','2','--connect-timeout','20','--max-time','900','--dump-header',str(headers),'--output',str(path.with_suffix('.zip.download')),url],capture_output=True,text=True)
        if result.returncode: raise RuntimeError(result.stderr[-800:])
        path.with_suffix('.zip.download').replace(path)
        published=next((line.split(':',1)[1].strip() for line in headers.read_text().splitlines() if line.lower().startswith('x-amz-meta-sha256:')),None)
        if published and sha(path)!=published: raise ValueError('Fresh source SHA256 mismatch: '+url)
        dump(REPORT/f'cache-repair-{sensor}-{year}.json',dict(sensor=sensor,year=year,url=url,rejected_cache_file=rejected.name,rejected_sha256=rejected_hash,verified_replacement_sha256=sha(path),published_sha256=published,status='fresh_download_verified; rejected artifact preserved'))
    return path,url,published

def acquire():
    CACHE.mkdir(exist_ok=True); REPORT.mkdir(parents=True,exist_ok=True)
    failures=[]
    jobs=[(sensor,year) for year in range(2001,2026) for sensor in ('modis','viirs-snpp') if not(sensor=='viirs-snpp' and year<2012) and not((REPORT/f'source-{sensor}-{year}.json').exists() and (CACHE/f'{sensor}-{year}-cells.json').exists())]
    # Two network streams, one processor. No concurrent SQLite writers or year-sized records.
    pool=concurrent.futures.ThreadPoolExecutor(max_workers=2)
    tasks={}
    try:
        tasks={(sensor,year):pool.submit(download,sensor,year) for sensor,year in jobs}
        for sensor,year in jobs:
            url=f'https://firms.modaps.eosdis.nasa.gov/data/country/zips/{sensor}_{year}_all_countries.zip'
            try:
                path,url,published=tasks[sensor,year].result()
                process(path,sensor,year,url,published)
            except Exception as e:
                failures.append(dict(sensor=sensor,year=year,url=url,error=str(e)))
                print('FAILED',sensor,year,str(e),flush=True)
            dump(REPORT/'acquisition-failures.json',failures)
    finally:
        DOWNLOAD_STOP.set()
        for future in tasks.values(): future.cancel()
        with DOWNLOAD_LOCK:
            for child in DOWNLOAD_CHILDREN: child.terminate()
        pool.shutdown(wait=True,cancel_futures=True)

def metrics(pairs, predict):
    if not pairs: return dict(n=0,mae=None,rmse=None,bias=None)
    e=[predict(a,v)-a for a,v in pairs]
    return dict(n=len(e),mae=sum(map(abs,e))/len(e),rmse=math.sqrt(sum(x*x for x in e)/len(e)),bias=sum(e)/len(e))

def derive():
    sources=inventory(); cells={}; allrows=[]; comparisons=[]; diagnostics=[]
    available={(s['year'],s['sensor']):s for s in sources}
    for source in sources:
        source['instrument']='MODIS' if source['sensor']=='modis' else 'VIIRS'
        source['platform_identification']={p:('Suomi-NPP' if p=='N' else p) for p in source['platforms']}
        source['collection_versions']=list(source['versions'])
        source['collection_identification']='FIRMS literal version preserved; product collection not silently relabelled'
        source['version_definition_url']='https://firms.modaps.eosdis.nasa.gov/content/descriptions/FIRMS_MODIS_Firehotspots.html' if source['sensor']=='modis' else 'https://firms.modaps.eosdis.nasa.gov/content/descriptions/FIRMS_VIIRS_Firehotspots.html'
        groups=json.loads((CACHE/f"{source['sensor']}-{source['year']}-groups.json").read_text())
        platform_dates=collections.defaultdict(set)
        for x,y,date,dn,platforms in groups:
            for platform in platforms: platform_dates[platform].add(date)
        source['retained_platform_dates']={p:dict(first=min(dates),last=max(dates),detection_dates=len(dates)) for p,dates in platform_dates.items()}
        dump(REPORT/f"source-{source['sensor']}-{source['year']}.json",source)
        del groups

    for s in sources:
        year=s['year']; sensor=s['sensor']
        for month,x,y,p,n,occ in json.loads((CACHE/f'{sensor}-{year}-cells.json').read_text()):
            cells.setdefault((month,x,y),{})[p]=[n,occ]
    for (month,x,y),p in sorted(cells.items()):
        lon,lat=center(x,y)
        a=p.get('Aqua',[0,0])[1]; v=p.get('N',[0,0])[1]
        if a and v:
            comparisons.append(dict(year=int(month[:4]),month=month,x=x,y=y,a=a,v=v,a_count=p['Aqua'][0],v_count=p['N'][0],version_pair='MODIS:'+','.join(available[int(month[:4]),'modis']['versions'])+'|VIIRS:'+','.join(available[int(month[:4]),'viirs-snpp']['versions']),region='SE' if 140<=lon<=154 and -39<=lat<=-29 else 'other'))
    for year in sorted({s['year'] for s in sources}):
        paths=[CACHE/f'{sensor}-{year}-groups.json' for sensor in ('modis','viirs-snpp')]
        if not all(p.exists() for p in paths): continue
        units={}
        for path in paths:
            for x,y,date,dn,platforms in json.loads(path.read_text()):
                units.setdefault((x,y,date,dn),{}).update(platforms)
        diagnostics_year=dict(year=year,thresholds={})
        for window in (15,30,60):
            matched_a=matched_v=matched_groups=total_a=total_v=0
            for platforms in units.values():
                aa=platforms.get('Aqua',[]); vv=platforms.get('N',[])
                total_a+=sum(n for _,n in aa);total_v+=sum(n for _,n in vv)
                remaining={minute:n for minute,n in vv}
                for minute,n in sorted(aa):
                    if not remaining: break
                    nearest=min(remaining,key=lambda v:(abs(v-minute),v))
                    if abs(nearest-minute)<=window:
                        matched_groups+=1;matched_a+=n;matched_v+=remaining.pop(nearest)
            diagnostics_year['thresholds'][str(window)]=dict(paired_acquisition_groups=matched_groups,paired_aqua_reports=matched_a,paired_viirs_reports=matched_v,unmatched_aqua_reports=total_a-matched_a,unmatched_viirs_reports=total_v-matched_v)
        diagnostics.append(diagnostics_year)
        del units
    # Fixed temporal and spatial splits; no test outcomes used in fitting/interval selection.
    train=[r for r in comparisons if 2012<=r['year']<=2018 and r['region']=='other']
    calibration=[r for r in comparisons if 2019<=r['year']<=2020 and r['region']=='other']
    test=[r for r in comparisons if r['year']>=2021]
    pairs=lambda rr:[(r['a'],r['v']) for r in rr]
    slope=sum(r['a']*r['v'] for r in train)/sum(r['v']**2 for r in train) if train else None
    # A bounded occupied-window score (max two day/night strata per UTC date).
    pred=lambda v: min(62.,max(0.,slope*v)) if slope is not None else None
    residuals=sorted(abs(pred(r['v'])-r['a']) for r in calibration) if slope is not None else []
    q=residuals[min(len(residuals)-1,math.ceil((len(residuals)+1)*.9)-1)] if residuals else None
    old_coefficient=json.loads((ROOT/'public/reports/command-experiment.json').read_text())['coefficient']
    def evaluate(rr):
        pp=pairs(rr)
        return dict(bridge=metrics(pp,lambda a,v:pred(v)),raw_occupancy=metrics(pp,lambda a,v:v),interval_coverage=sum(abs(pred(r['v'])-r['a'])<=q for r in rr)/len(rr) if rr and q is not None else None)
    trained_version_pairs=sorted({r['version_pair'] for r in train})
    cells_by_year=collections.defaultdict(list)
    for key,platforms in sorted(cells.items()): cells_by_year[int(key[0][:4])].append((key,platforms))
    for year in sorted({s['year'] for s in sources}):
        rows=[]
        for (month,x,y),p in cells_by_year[year]:
            m=available.get((year,'modis')); vsource=available.get((year,'viirs-snpp'))
            # Missing sensor and non-detection are distinct. Raw zeros only for a present archive.
            platform_available=lambda platform,source: bool(source and platform in source['platforms'] and not(platform=='Aqua' and month<'2002-07'))
            raw=lambda platform,source: p.get(platform,[0,0]) if platform_available(platform,source) else [None,None]
            terra=raw('Terra',m); aqua=raw('Aqua',m); viirs=raw('N',vsource)
            flags=['EXPERIMENTAL','EXPOSURE_UNKNOWN','DETECTION_CONDITIONAL','NOT_UNIQUE_FIRES']
            if m and vsource and slope is not None:
                estimate=(aqua[1]+pred(viirs[1]))/2
                status='blended_aqua_equivalent_occupied_windows'
                if not aqua[1] or not viirs[1]: flags.append('UNMATCHED_SENSOR_ACTIVITY')
                lower=max(0,(aqua[1]+max(0,pred(viirs[1])-q))/2) if q is not None else None
                upper=(aqua[1]+min(62,pred(viirs[1])+q))/2 if q is not None else None
            elif m:
                estimate=aqua[1] if year>=2003 else terra[1]; status='MODIS_only_Aqua_baseline' if year>=2003 else 'MODIS_only_Terra_baseline'; lower=upper=None
                flags.append('SINGLE_SENSOR_BASELINE')
            else:
                estimate=pred(viirs[1]) if slope is not None else None;status='VIIRS_only_proxy';lower=upper=None
            if m and vsource and not aqua[1] and not viirs[1]:
                estimate=lower=upper=None
                status='Terra_reports_only_Aqua_VIIRS_activity_unknown'
                flags.append('NO_AQUA_VIIRS_REPORTS')
            elif status.startswith('MODIS_only') and estimate==0:
                estimate=None
                status+='_no_reference_platform_reports'
                flags.append('REFERENCE_ACTIVITY_UNKNOWN')
            if 'UNMATCHED_SENSOR_ACTIVITY' in flags:
                lower=upper=None
                flags.append('OUTSIDE_INTERVAL_SUPPORT')
            if m and vsource:
                version_pair='MODIS:'+','.join(m['versions'])+'|VIIRS:'+','.join(vsource['versions'])
                if version_pair not in trained_version_pairs: flags.append('UNSEEN_TRAINING_VERSION')
                if len(m['versions'])>1 or len(vsource['versions'])>1: flags.append('WITHIN_YEAR_VERSION_MIX')
            if year==2012: flags.append('PARTIAL_VIIRS_START_YEAR')
            if year==2002: flags.append('PARTIAL_AQUA_START_YEAR')
            if m and any('NRT' in version.upper() for version in m['versions']): flags.append('NRT_COLLECTION_PRESENT')
            rows.append(dict(year=year,month=month,grid_id=f'CEA25:{x}:{y}',coordinate_reference='25 km equal-area cell center on declared sphere',longitude=center(x,y)[0],latitude=center(x,y)[1],source_availability=dict(modis=bool(m),modis_terra=platform_available('Terra',m),modis_aqua=platform_available('Aqua',m),viirs_snpp=platform_available('N',vsource)),source_versions=dict(modis=list(m['versions']) if m else [],viirs_snpp=list(vsource['versions']) if vsource else []),modis_terra_count=terra[0],modis_aqua_count=aqua[0],viirs_snpp_count=viirs[0],aqua_occupied_windows=aqua[1],viirs_occupied_windows=viirs[1],indicator_unit='Terra occupied UTC date/daynight windows' if status.startswith('MODIS_only_Terra_baseline') else 'Aqua-equivalent occupied UTC date/daynight windows',activity_estimate=estimate,activity_lower=lower,activity_upper=upper,method=METHOD,status=status,quality_flags=flags,missing_data_status='observation_exposure_unknown',calibration_provenance='/reports/atlas/validation.json'))
        dump(OUT/f'{year}.json',rows)
        with (OUT/f'{year}.csv').open('w') as f:
            writer=csv.DictWriter(f,fieldnames=list(rows[0]) if rows else ['year']);writer.writeheader()
            for row in rows: writer.writerow({k:json.dumps(v) if isinstance(v,(dict,list)) else v for k,v in row.items()})
        output_json=OUT/f'{year}.json'
        raw_hash=sha(output_json)
        for extension in ('json','csv'):
            source_path=OUT/f'{year}.{extension}'
            with source_path.open('rb') as source_file, (OUT/f'{year}.{extension}.gz').open('wb') as destination:
                with gzip.GzipFile(fileobj=destination,mode='wb',compresslevel=6,mtime=0,filename='') as compressed:
                    shutil.copyfileobj(source_file,compressed)
            source_path.unlink()
        monthly=[]
        for i in range(1,13):
            month=f'{year}-{i:02d}'; selected=[r for r in rows if r['month']==month]
            total=lambda key:sum(r[key] or 0 for r in selected) if selected and any(r[key] is not None for r in selected) else None
            monthly.append(dict(month=month,modis_terra=total('modis_terra_count'),modis_aqua=total('modis_aqua_count'),viirs=total('viirs_snpp_count'),indicator=total('activity_estimate'),occupied_cells=len(selected) if selected else None))
        # Reconcile deduplicated counts with source audit.
        for sensor,keys in [('modis',['modis_terra_count','modis_aqua_count']),('viirs-snpp',['viirs_snpp_count'])]:
            if (year,sensor) in available: assert sum(sum(r[k] or 0 for k in keys) for r in rows)==available[year,sensor]['counts']['retained']
        allrows.append(dict(year=year,monthly=monthly,rows=len(rows),json=f'/data/atlas/{year}.json.gz',csv=f'/data/atlas/{year}.csv.gz',sha256=sha(OUT/f'{year}.json.gz'),uncompressed_sha256=raw_hash,csv_sha256=sha(OUT/f'{year}.csv.gz')))
    sensitivity={}
    if slope is not None:
        for label,subset in [('earlier_training_2012_2015',[r for r in train if r['year']<=2015]),('later_training_2016_2018',[r for r in train if r['year']>=2016])]:
            beta=sum(r['a']*r['v'] for r in subset)/sum(r['v']**2 for r in subset) if subset else None
            sensitivity[label]=dict(training_n=len(subset),coefficient=beta,holdout=metrics(pairs(test),lambda a,v:min(62,beta*v)) if beta is not None else None)
    validation=dict(pipeline_sha256=sha(pathlib.Path(__file__)),calibration_sources=[{k:s[k] for k in ('sensor','year','sha256','versions')} for s in sources if 2012<=s['year']<=2020],trained_version_pairs=trained_version_pairs,previous_experiment_sha256=sha(ROOT/'public/reports/command-experiment.json'),raw_pixel_reference=dict(target='Aqua raw report counts on positive occupancy cell-month pairs; separate units from main occupancy scores',identity=metrics([(r['a_count'],r['v_count']) for r in test],lambda a,v:v),previous_experiment_transfer=metrics([(r['a_count'],r['v_count']) for r in test],lambda a,v:old_coefficient*v),previous_coefficient=old_coefficient,scope='Original coefficient learned on 2019 SE matched pixel groups; transferred here to whole cell-month report totals as an explicitly weak baseline, not validated transfer'),by_version_pair={version:evaluate([r for r in test if r['version_pair']==version]) for version in sorted({r['version_pair'] for r in test})} if slope is not None else {},acquisition_diagnostics=diagnostics,sensitivity=sensitivity,method=METHOD,scientific_status='EXPERIMENTAL; not observation-adjusted or independently validated fire accuracy',target='Aqua-equivalent occupied cell UTC day/daynight windows per month; counts capped at 62; not fires, burned area or exposure-adjusted incidence',coefficient=slope,training_years=sorted({r['year'] for r in train}),calibration_years=sorted({r['year'] for r in calibration}),holdout_years=sorted({r['year'] for r in test}),training_n=len(train),calibration_n=len(calibration),holdout=evaluate(test) if slope is not None else None,by_year={str(y):evaluate([r for r in test if r['year']==y]) for y in sorted({r['year'] for r in test})} if slope is not None else {},by_region={region:evaluate([r for r in test if r['region']==region]) for region in ('SE','other')} if slope is not None else {},by_season={season:evaluate([r for r in test if ((int(r['month'][5:])%12)//3)==i]) for i,season in enumerate(('DJF','MAM','JJA','SON'))} if slope is not None else {},interval_absolute_residual_q90=q,interval_scope='Split residual interval on VIIRS bridge; reported blended bounds propagate half residual width; exchangeability unsupported across climate/collection shifts. Holdout score tests bridge against Aqua, not blended self-reference.',limitations=['No valid-observation/cloud masks: zeros are absence of retained reports, never verified absence of fire.','Detection-conditional cell-month pairs select both sensors positive; unmatched observations are outside validated support.','Overpass time differs; common day/night is not simultaneous observation. No physical pixel footprint intersection.','MODIS Terra 2001/2002 baseline differs from Aqua baseline; Aqua 2002 is partial. Literal collection/version transitions are flagged, not physically corrected.','OLS bridge handles occupied-window sensitivity empirically, not pixel-area correction or calibrated confidence probability.','Previous experiment is evaluated separately against Aqua pixel-report counts; transfer to whole cell-month totals differs from its original matched-group support.','No independent fire truth; no uncertainty in baseline, cloud exposure, geolocation, sensor drift or collection transitions.'])
    dump(REPORT/'validation.json',validation)
    dump(OUT/'index.json',dict(process_peak_rss_bytes=resource.getrusage(resource.RUSAGE_SELF).ru_maxrss*(1 if sys.platform=='darwin' else 1024),unavailable_sources=[dict(sensor=sensor,year=year,url=f'https://firms.modaps.eosdis.nasa.gov/data/country/zips/{sensor}_{year}_all_countries.zip') for year in range(2001,2026) for sensor in ('modis','viirs-snpp') if not(sensor=='viirs-snpp' and year<2012) and (year,sensor) not in available],status='EXPERIMENTAL',grid='Spherical Lambert cylindrical equal-area; R=6371.0088 km; standard parallel -34 degrees; origin lon=lat=0; floor x/25,y/25; 25 km cells',years=allrows,sources=sources,method=METHOD,missing='Absent cell-months not materialized. Null means unavailable; no detections is not zero fire activity.',validation='/reports/atlas/validation.json'))
    print(json.dumps(validation,indent=2))

if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('action',choices=['acquire','derive']);args=parser.parse_args()
    CACHE.mkdir(exist_ok=True)
    with (CACHE/'pipeline.lock').open('w') as lock:
        try: fcntl.flock(lock,fcntl.LOCK_EX|fcntl.LOCK_NB)
        except BlockingIOError: raise SystemExit('Another acquisition/derivation is running; wait for its checkpoint.')
        acquire() if args.action=='acquire' else derive()
