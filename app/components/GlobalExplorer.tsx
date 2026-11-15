'use client';
import {useEffect,useMemo,useRef,useState} from 'react';
import {ArrowDownToLine,ArrowRight,Check,ChevronRight,Database,Globe2,MapPin,Search,ShieldCheck} from 'lucide-react';
import HistoryEvidence from './HistoryEvidence';
import BurningCalendar from './BurningCalendar';
import {sensorCounts} from './calendar-data';
import {updateGlobeChatContext} from './globe-chat-context';
import GlobeCanvas,{type GlobePoint,type World} from './GlobeCanvas';
type Row=[string,number,number,number,number,number,number,number,number,string?];
type Archive={sensor_source_countries?:Record<string,string[]>;cells:Row[];scope:string;global_coverage:boolean;country_mapping?:Record<string,string[]>;countries?:Record<string,number[]>};
const studyMonths=['2019-09','2019-10','2019-11','2019-12','2020-01','2020-02','2020-03'];

const fmt=(n:number)=>n.toLocaleString('en-US');
const normalize=(s:string)=>s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
function monthLabel(month:string){return new Date(month+'-15T12:00:00Z').toLocaleDateString('en-GB',{month:'short',year:'numeric',timeZone:'UTC'});}
export default function GlobalExplorer({onStudy,active=true}:{onStudy:()=>void;active?:boolean}){
 const root=useRef<HTMLDivElement>(null);
 const [world,setWorld]=useState<World|null>(null),[australia,setAustralia]=useState<Archive|null>(null),[global,setGlobal]=useState<Archive|null>(null),[error,setError]=useState('');
 const [year,setYear]=useState('2020'),[platform,setPlatform]=useState('ALL'),[histories,setHistories]=useState<Record<string,Archive>>({});
 const [dataset,setDataset]=useState('global'),[selected,setSelected]=useState('WORLD'),[query,setQuery]=useState(''),[month,setMonth]=useState('ALL'),[day,setDay]=useState('ALL');
 const [modis,setModis]=useState(true),[viirs,setViirs]=useState(true),[downloaded,setDownloaded]=useState(false);
 useEffect(()=>{const controller=new AbortController();Promise.all(['/data/world.geojson','/data/globe-observations.json'].map(url=>fetch(url,{signal:controller.signal}).then(r=>{if(!r.ok)throw Error('Archive unavailable');return r.json();}))).then(([w,a])=>{setWorld(w as World);setAustralia(a as Archive);}).catch(e=>{if(e.name!=='AbortError')setError('The globe data could not be loaded. Reload to try again.');});return()=>controller.abort();},[]);
 useEffect(()=>{if(dataset!=='legacy'||global)return;const c=new AbortController();fetch('/data/world-observations.json',{signal:c.signal}).then(r=>{if(!r.ok)throw Error();return r.json();}).then(d=>setGlobal(d as Archive)).catch(e=>{if(e.name!=='AbortError')setError('Original archive unavailable. Reload to retry.');});return()=>c.abort();},[dataset,global]);
 useEffect(()=>{if(dataset!=='global'||histories[year])return;const controller=new AbortController();fetch(`/data/history-${year}.json`,{signal:controller.signal}).then(r=>{if(!r.ok)throw Error('Archive unavailable');return r.json();}).then(a=>setHistories(h=>({...h,[year]:a as Archive}))).catch(e=>{if(e.name!=='AbortError')setError('Historical archive unavailable. Reload to retry.');});return()=>controller.abort();},[year,dataset,histories]);
 const isGlobal=dataset!=='australia',legacy=dataset==='legacy',activeYear=legacy?'2020':year,archive=isGlobal?(legacy?global:histories[year]):australia;
 useEffect(()=>{
  if(!active||!archive)return;
  const media=matchMedia('(prefers-reduced-motion: reduce)');
  const animations:Animation[]=[];
  const observer=new IntersectionObserver(entries=>{for(const entry of entries){if(!entry.isIntersecting)continue;observer.unobserve(entry.target);if(media.matches)continue;animations.push(entry.target.animate([{opacity:.6,transform:'translateY(6px)'},{opacity:1,transform:'translateY(0)'}],{duration:280,easing:'cubic-bezier(.22,1,.36,1)'}));}},{threshold:.1});
  root.current?.querySelectorAll('.global-timeline').forEach(el=>observer.observe(el));
  const cancel=()=>{if(media.matches)animations.forEach(a=>a.cancel());};
  media.addEventListener('change',cancel);
  return()=>{observer.disconnect();animations.forEach(a=>a.cancel());media.removeEventListener('change',cancel);};
 },[archive,active]);
 const globalMonths=useMemo(()=>Array.from({length:12},(_,i)=>`${activeYear}-${String(i+1).padStart(2,'0')}`),[activeYear]);
 const months=isGlobal?globalMonths:studyMonths;
 const countries=useMemo(()=>[...(world?.features||[])].sort((a,b)=>a.properties.name.localeCompare(b.properties.name)),[world]);
 const country=countries.find(c=>c.properties.iso===selected);
 const countrySources=useMemo(()=>archive?.country_mapping?.[selected]||[],[archive,selected]);
 const hasModis=!isGlobal||selected==='WORLD'||!archive?.sensor_source_countries||countrySources.some(c=>archive.sensor_source_countries?.modis?.includes(c));
 const hasViirs=!legacy&&(!isGlobal||selected==='WORLD'||countrySources.some(c=>archive?.sensor_source_countries?.['viirs-snpp']?.includes(c)));
 const loaded=selected==='WORLD'||(isGlobal?countrySources.length>0:selected==='AUS');
 const scopedRows=useMemo(()=>{
  if(!loaded)return [];
  const included=new Set(countrySources);
  return (archive?.cells||[]).filter(r=>!isGlobal||selected==='WORLD'||included.has(r[9]||''));
 },[archive,loaded,countrySources,isGlobal,selected]);
 const points=useMemo(()=>{
  const cells=new Map<string,GlobePoint>();
  for(const r of scopedRows){if(month!=='ALL'&&r[0]!==month)continue;
   const [m,v]=sensorCounts(r,platform,day);if(!m&&!v)continue;
   const k=`${r[1]},${r[2]}`;const c=cells.get(k)||{lon:r[1],lat:r[2],m:0,v:0};c.m+=m;c.v+=v;cells.set(k,c);
  }return [...cells.values()];
 },[scopedRows,month,day,platform]);
 const totals=useMemo(()=>points.reduce((sum,c)=>[sum[0]+c.m,sum[1]+c.v],[0,0]),[points]);
 const searchResults=query.trim()?countries.filter(c=>normalize(c.properties.name+' '+c.properties.label).includes(normalize(query))).slice(0,8):[];

  // Keep Ask FireTrace AI informed about the globe selection.
  useEffect(() => {
    updateGlobeChatContext({
      dataset: dataset as 'global' | 'legacy' | 'australia',
      countryCode: selected,
      countryName: country?.properties.name ||
        (selected === 'WORLD' ? (isGlobal ? 'Worldwide' : 'Australia') : selected),
      year: activeYear,
      month,
      dayNight: day as 'ALL' | 'D' | 'N',
      platform: platform as 'ALL' | 'Terra' | 'Aqua',
      showModis: modis,
      showViirs: viirs && hasViirs,
      dataLoaded: Boolean(archive && loaded)
    });
  }, [
    dataset, selected, country?.properties.name,
    isGlobal, activeYear, month, day, platform,
    modis, viirs, hasViirs, archive, loaded
  ]);

 const areaLabel=selected==='WORLD'?(isGlobal?'Worldwide':'Australia'):country?.properties.name||selected;
 function selectCountry(iso:string){setSelected(iso);setQuery('');setDownloaded(false);}
 function changeDataset(value:string){setDataset(value);setMonth('ALL');setDownloaded(false);if(value==='australia')selectCountry('AUS');}
 function exportView(){
  const csv='period,daynight,modis_platform,grid,scope,longitude_cell_center,latitude_cell_center,modis_observations,viirs_observations\n'+points.map(p=>[month==='ALL'?(isGlobal?activeYear:'2019-09_to_2020-03'):month,day,platform,isGlobal?'1degree_unequal_area':'25km_equal_area',selected,p.lon,p.lat,p.m,legacy?'':p.v].join(',')).join('\n');
  const url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download=`firetrace_${selected}_${isGlobal?`${legacy?'MODIS':'MODIS-VIIRS'}${activeYear}_${platform}`:'Australia2019-2020'}_${month}_${day}.csv`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);setDownloaded(true);
 }
 if(error)return <div className="error-box" role="alert">{error}<button onClick={()=>window.location.reload()}> Reload</button></div>;
 if(!world||!archive)return <div className="loading" role="status"><Globe2 size={24}/> Loading the world and verified observations…</div>;
 return <div ref={root} className="global-explorer">
  <section className="comparison-intro" aria-label="Meet the two satellite sensors"><div className="sensor-intro modis-intro"><span className="tiny">01 / MODIS</span><h2>A broader pixel.</h2><p>Terra + Aqua · 1 km nominal resolution</p><span>Historical Collection 6 observations</span></div><div className="intro-divider" aria-hidden="true">×</div><div className="sensor-intro viirs-intro"><span className="tiny">02 / VIIRS</span><h2>A finer view.</h2><p>Suomi-NPP · 375 m nominal resolution</p><span>Historical Collection 2 observations</span></div><p className="comparison-principle">More detections does not mean more fires. Pixel size, overpass time and sensitivity affect what each sensor reports.</p></section>
  <div className="global-dataset"><label htmlFor="globe-dataset">Observation archive</label><select id="globe-dataset" value={dataset} onChange={e=>changeDataset(e.target.value)}><option value="global">Worldwide · MODIS + VIIRS · 2019–2020</option><option value="legacy">Original worldwide · MODIS · 2020</option><option value="australia">Whole Australia · MODIS + VIIRS · 2019–2020</option></select><label>Year <select aria-label="Global archive year" disabled={!isGlobal||legacy} value={activeYear} onChange={e=>{setYear(e.target.value);setMonth('ALL');setDownloaded(false);}}><option>2019</option><option>2020</option></select></label><label>MODIS platform <select aria-label="Global MODIS platform" value={platform} onChange={e=>{setPlatform(e.target.value);setDownloaded(false);}}><option value="ALL">Terra + Aqua</option><option>Terra</option><option>Aqua</option></select></label><a href="/reports/history-validation.json" download>Source audit <ArrowDownToLine size={12}/></a></div>
  <p className="global-source-note">{isGlobal?<><strong>Global historical observations.</strong> MODIS C6 (6.03), January–December {activeYear}, covering {Object.keys(archive?.countries||{}).length} named NASA source countries. {legacy?'Original MODIS-only archive.':'VIIRS Suomi-NPP C2 is loaded separately. Counts are not interchangeable between sensors.'}</>:<><strong>Whole-country Australian observations.</strong> MODIS + VIIRS, September 2019–March 2020. Other countries are geographic context in this archive.</>}</p>
  <section className="global-toolbar" aria-label="Global observation filters"><div className="global-scope"><Globe2 size={17}/><label className="comparison-country-label">Compare in<select aria-label="Comparison country" value={selected} onChange={e=>selectCountry(e.target.value)}><option value="WORLD">Worldwide</option>{countries.map(c=><option key={c.properties.iso} value={c.properties.iso}>{c.properties.name}</option>)}</select></label><span className="scope-chip">{country?'COUNTRY VIEW':'GLOBAL VIEW'}</span></div><label className="global-period">Archive period<select aria-label="Globe archive period" value={month} onChange={e=>{setMonth(e.target.value);setDownloaded(false);}}><option value="ALL">{isGlobal?`Full year · ${activeYear}`:'Sep 2019 – Mar 2020'}</option>{months.map(m=><option key={m} value={m}>{monthLabel(m)}</option>)}</select></label><div className="segment" aria-label="Globe acquisition time">{[['ALL','Day + night'],['D','Day'],['N','Night']].map(([id,label])=><button key={id} className={day===id?'selected':''} aria-pressed={day===id} onClick={()=>{setDay(id);setDownloaded(false);}}>{label}</button>)}</div></section>
  <section key={`${selected}-${month}-${day}-${platform}-${year}`} className="global-summary" aria-label="Sensor comparison summary"><div><span><i className="sensor-dot orange"/>MODIS observations</span><strong>{loaded&&hasModis?fmt(totals[0]):'—'}</strong><p>{loaded?`${areaLabel} · ${platform==='ALL'?'Terra + Aqua':platform} · C6 (6.03)`:'No country records loaded'}</p></div><div><span><i className="sensor-dot teal"/>VIIRS observations</span><strong>{loaded&&hasViirs?fmt(totals[1]):'—'}</strong><p>{legacy?'Not loaded in original archive':loaded?'Suomi-NPP · C2':'No country records loaded'}</p></div><div><span><Globe2 size={13}/> Geographic coverage</span><strong>{world.features.length}<small>regions</small></strong><p>{isGlobal?`${Object.keys(archive?.countries||{}).length} named source countries loaded`:'1 country has imported observations'}</p></div><button className="export-button" disabled={!loaded||!points.length} onClick={exportView}><ArrowDownToLine size={15}/>{downloaded?'CSV downloaded':'Export observations'}</button></section>
  <BurningCalendar rows={scopedRows} months={months} area={areaLabel} month={month} day={day} platform={platform} hasModis={loaded&&hasModis} hasViirs={loaded&&hasViirs} onMonth={value=>{setMonth(value);setDownloaded(false);}}/>
  <details className="geography-disclosure" open><summary>Explore the observations on the globe <span>Country search · layers · geographic context</span></summary>
  <div className="global-layout"><section className="global-map-area"><div className="global-map-title"><span><i className="map-live-dot"/> THE WORLD, IN PERSPECTIVE</span><span>{world.features.length} COUNTRIES & TERRITORIES</span></div><GlobeCanvas active={active} world={world} points={points} selected={selected} modis={modis} viirs={viirs&&hasViirs} onSelect={selectCountry} coverageLabel={isGlobal?`Worldwide historical MODIS${hasViirs?' and VIIRS':''} detections for ${activeYear}.`:'Historical MODIS and VIIRS observations for Australia only.'} gridLabel={isGlobal?'1° geographic grid · unequal cell areas':'25 km equal-area observation grid'}/></section>
   <aside className="country-panel"><div className="panel-title"><h2>Explore a country</h2><MapPin size={17}/></div><p className="panel-subtitle">Select on the globe or find a place below.</p>
    <div className="country-search"><Search size={15}/><input type="search" aria-label="Search countries" placeholder="Search countries…" value={query} onChange={e=>setQuery(e.target.value)}/></div>
    {query&&<div className="country-results" role="region" aria-label="Country search results">{searchResults.length?searchResults.map(f=><button key={f.properties.iso} onClick={()=>selectCountry(f.properties.iso)}>{f.properties.name}<ChevronRight size={14}/></button>):<p>No matching country. Try another name.</p>}</div>}
    <label htmlFor="country-select" className="field-label">Country or territory</label><select id="country-select" className="full-select" value={selected} onChange={e=>selectCountry(e.target.value)}><option value="WORLD">World overview</option>{countries.map(c=><option key={c.properties.iso} value={c.properties.iso}>{c.properties.name}</option>)}</select>
    <div className="quick-countries">{[['AUS','Australia'],['IND','India'],['BRA','Brazil'],['USA','United States']].map(([id,name])=><button key={id} className={selected===id?'chosen':''} onClick={()=>selectCountry(id)}>{name}</button>)}</div>
    <div key={selected} className="country-selection" aria-live="polite"><span className="tiny">{selected==='WORLD'?'OBSERVATION COVERAGE':'SELECTED REGION'}</span><h3>{country?.properties.name||'A worldwide canvas.'}</h3>
     {loaded?<><span className="coverage-status"><Check size={13}/> {isGlobal?(legacy?'MODIS archive loaded':'Historical archives loaded'):'Australia archive loaded'}</span><p>{isGlobal?'Reported hotspot observations assigned to countries by NASA FIRMS. Counts do not represent unique fires, burned area or complete observation coverage.':'Both sensor archives are loaded for the whole of Australia. Confidence classes and acquisition times differ.'}</p><dl className="country-counts"><div><dt><i className="sensor-dot orange"/> MODIS C6</dt><dd>{hasModis?fmt(totals[0]):'Not loaded'}</dd></div><div><dt><i className="sensor-dot teal"/> VIIRS C2</dt><dd>{hasViirs?fmt(totals[1]):'Not loaded'}</dd></div></dl>{selected!=='WORLD'&&isGlobal&&<p className="country-source-files">Source: {countrySources.map(s=>s.replaceAll('_',' ')).join(' + ')}</p>}</>:<><span className="coverage-status not-loaded"><Database size={13}/> Fire records not loaded</span><p>The selected archive has no imported source file mapped to {country?.properties.name}. This does not mean there were no fires.</p><button className="return-data" onClick={()=>{if(!isGlobal)changeDataset('global');else selectCountry('WORLD');}}>Explore loaded observations <ArrowRight size={14}/></button></>}
    </div>
    <div className="global-layer-toggles"><label><i className="sensor-dot orange"/><span>MODIS</span><input type="checkbox" aria-label="Globe MODIS layer" checked={modis} onChange={e=>setModis(e.target.checked)}/></label><label className={legacy?'layer-unavailable':''}><i className="sensor-dot teal"/><span>VIIRS</span><input type="checkbox" aria-label="Globe VIIRS layer" disabled={!hasViirs} checked={viirs&&hasViirs} onChange={e=>setViirs(e.target.checked)}/></label></div><span className="fine-print">Switches control visibility; counts retain loaded sensors.</span>
   </aside>
  </div>
  </details>
  <HistoryEvidence selected={!isGlobal&&selected==='WORLD'?'AUS':selected} countryName={areaLabel} day={day} platform={platform}/><div className="global-footnotes"><div><ShieldCheck size={17}/><p><strong>Real observations, with clear boundaries.</strong> {isGlobal?'Global points represent 1° geographic cells with unequal areas. Country-assigned archives may omit offshore and unassigned observations.':'Australia points represent 25 km equal-area cells.'} Boundaries are for orientation, not authoritative border adjudication. Historical data; not a live fire service.</p></div><button onClick={onStudy}>Open the Black Summer study <ArrowRight size={15}/></button></div>
 </div>;
}
