'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import LearnFireTrace from './components/LearnFireTrace';
import ProjectAssistant from './components/ProjectAssistant';
import GlobalExplorer from './components/GlobalExplorer';
import CommandWorkspace from './components/CommandWorkspace';
import HistoricalAtlas from './components/HistoricalAtlas';
import RecentDetections from './components/RecentDetections';
import type { Month } from '../lib/firetrace/command';
import { Globe2, ArrowDownToLine, ArrowRight, ArrowUpRight, Check, ChevronDown, CircleHelp, Crosshair, Database, Flame, Layers, Map as MapIcon, Maximize2, Minus, Plus, Radio, ShieldCheck, SlidersHorizontal, X } from 'lucide-react';

type Cell=[string,number,number,number,number,number,number,number,number];
type PlotCell={lon:number;lat:number;m:number;v:number};
type Dataset={cells:Cell[];input_sha256:Record<string,string>;source_counts:Record<string,number>};
type Timing=Record<string,string>;
type Geometry={type:string;coordinates:number[][][]|number[][][][]};
type Geo={features:{geometry:Geometry}[]};
type View='atlas'|'lab'|'recent'|'command'|'learn'|'global'|'explore'|'timing'|'methods';
const MONTHS=['2019-09','2019-10','2019-11','2019-12','2020-01','2020-02','2020-03'];
const LABELS=['Sep','Oct','Nov','Dec','Jan','Feb','Mar'];
const FULL=['September 2019','October 2019','November 2019','December 2019','January 2020','February 2020','March 2020'];
const fmt=(n:number)=>n.toLocaleString('en-US');
function val(row:Cell,platform:string,day:string) {
 const indices=platform==='Terra'?[3,4]:platform==='Aqua'?[5,6]:[3,4,5,6];
 const modis=indices.filter(i=>day==='ALL'||(day==='D'?i%2===1:i%2===0)).reduce((s,i)=>s+Number(row[i]),0);
 return [modis,(day==='N'?0:row[7])+(day==='D'?0:row[8])];
}
const mapX=(lon:number)=>(lon-138)*50;
const mapY=(lat:number)=>(-27-lat)*50;
function geoPath(geo:Geo) {
 return geo.features.map(f=>{
  const polygons=f.geometry.type==='MultiPolygon'?f.geometry.coordinates as number[][][][]:[f.geometry.coordinates as number[][][]];
  return polygons.map(p=>p.map(r=>r.map((v,i)=>`${i?'L':'M'}${mapX(v[0]).toFixed(2)},${mapY(v[1]).toFixed(2)}`).join(' ')+'Z').join(' ')).join(' ');
 }).join(' ');
}
function download(name:string,rows:PlotCell[]) {
 const csv='longitude_grid_center,latitude_grid_center,modis_observations,viirs_observations\n'+rows.map(c=>[c.lon,c.lat,c.m,c.v].join(',')).join('\n');
 const url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));
 const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}

export default function Home() {
 const [data,setData]=useState<Dataset|null>(null);const [geo,setGeo]=useState<Geo|null>(null);const [timing,setTiming]=useState<Timing[]>([]);
 const mainRef=useRef<HTMLElement>(null);
 const [chatOpen,setChatOpen]=useState(false);
 const [commandVisited,setCommandVisited]=useState(false);
 const [error,setError]=useState('');const [view,setView]=useState<View>('atlas');
 useEffect(()=>{
  const media=matchMedia('(prefers-reduced-motion: reduce)');
  if(media.matches)return;
  const animation=mainRef.current?.animate([{opacity:.65,transform:'translateY(6px)'},{opacity:1,transform:'translateY(0)'}],{duration:240,easing:'cubic-bezier(.22,1,.36,1)'});
  const cancel=()=>{if(media.matches)animation?.cancel();};media.addEventListener('change',cancel);
  return()=>{animation?.cancel();media.removeEventListener('change',cancel);};
 },[view]);
 const [month,setMonth]=useState('ALL');const [day,setDay]=useState('ALL');const [platform,setPlatform]=useState('Combined_MODIS');
 const [modis,setModis]=useState(true);const [viirs,setViirs]=useState(true);const [zoom,setZoom]=useState(1);
 const [cell,setCell]=useState<PlotCell|null>(null);const [guide,setGuide]=useState(false);const [exported,setExported]=useState(false);
 const guideRef=useRef<HTMLDivElement>(null);
 useEffect(()=>{
  if(!guide)return;
  const previous=document.activeElement as HTMLElement|null;
  function trap(event:KeyboardEvent){
   if(event.key==='Escape'){setGuide(false);return;}
   if(event.key!=='Tab')return;
   const controls=guideRef.current?.querySelectorAll<HTMLElement>('button,a[href],select,input,[tabindex="0"]');
   if(!controls?.length)return;
   const first=controls[0],last=controls[controls.length-1];
   if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}
   else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}
  }
  document.addEventListener('keydown',trap);
  return ()=>{document.removeEventListener('keydown',trap);previous?.focus();};
 },[guide]);
 const [grid,setGrid]=useState('10');const [windowMinutes,setWindowMinutes]=useState(30);const [stratum,setStratum]=useState('ALL');
 useEffect(()=>{
  const controller=new AbortController();
  Promise.all(['/data/observations.json','/data/australia.geojson','/data/timing.json'].map(url=>fetch(url,{signal:controller.signal}).then(r=>{if(!r.ok)throw Error('Data could not be loaded.');return r.json();})))
   .then(([d,g,t])=>{const dataset=d as Dataset; const geometry=g as Geo; if(!Array.isArray(dataset.cells)||!Array.isArray(geometry.features)||!Array.isArray(t))throw Error('Invalid research data.');setData(dataset);setGeo(geometry);setTiming(t as Timing[]);}).catch(e=>{if(e.name!=='AbortError')setError('The research files could not be loaded. Refresh to try again.');});
  return ()=>controller.abort();
 },[]);
 const plot=useMemo(()=>{
  const aggregated=new Map<string,PlotCell>();
  for(const r of data?.cells||[]) {
   if(month!=='ALL'&&r[0]!==month)continue;
   const [m,v]=val(r,platform,day);if(!m&&!v)continue;
   const key=`${r[1]},${r[2]}`;const c=aggregated.get(key)||{lon:r[1],lat:r[2],m:0,v:0};c.m+=m;c.v+=v;aggregated.set(key,c);
  }
  return [...aggregated.values()];
 },[data,month,platform,day]);
 const totals=useMemo(()=>plot.reduce((s,c)=>[s[0]+c.m,s[1]+c.v],[0,0]),[plot]);
 const monthly=useMemo(()=>MONTHS.map(m=>(data?.cells||[]).filter(r=>r[0]===m).reduce((s,r)=>{const v=val(r,platform,day);return [s[0]+v[0],s[1]+v[1]];},[0,0])),[data,platform,day]);
 const maximum=Math.max(1,...monthly.flat());
 const paths=useMemo(()=>geo?geoPath(geo):'',[geo]);
 const displayMonth=month==='ALL'?'September 2019 – March 2020':FULL[MONTHS.indexOf(month)];
 function changeFilter(fn:()=>void) {fn();setCell(null);setExported(false);}
 function exportData(){download(`firetrace_${month}_${platform}_${day}_10km.csv`,plot);setExported(true);}
 const currentTiming=timing.filter(r=>r.grid_km===grid&&r.offset_cell_fraction==='0'&&r.daynight===stratum&&r.modis_platform!=='Combined_MODIS');
 const selected=cell?plot.find(c=>c.lon===cell.lon&&c.lat===cell.lat):null;
 function locateCommandCell(period:Month, selectedCell:PlotCell) {
  setMonth(period);setPlatform('Combined_MODIS');setDay('ALL');
  setModis(true);setViirs(true);setZoom(1);setCell(selectedCell);setExported(false);setView('explore');
  window.scrollTo(0,0);
 }

 return <div className={view==='command'?'app-shell command-view':'app-shell'}>
  <a className="skip-link" href="#main">Skip to workspace</a>
  <aside className="sidebar">
   <a href="#" className="brand" onClick={e=>{e.preventDefault();setView('global');}} aria-label="FireTrace home"><span className="brand-symbol"><Flame size={27} strokeWidth={1.7}/></span><span>FireTrace<span className="brand-sub">SATELLITE RESEARCH LAB</span></span></a>
   <div className="workspace-label">WORKSPACE <span>01</span></div>
   <nav aria-label="Main navigation">
    {[{id:'atlas',name:'Historical Atlas',icon:Database},{id:'lab',name:'Harmonization Lab',icon:Layers},{id:'recent',name:'Recent detections',icon:Radio},{id:'command',name:'FireTrace Command',icon:Crosshair},{id:'learn',name:'How it works',icon:CircleHelp},{id:'global',name:'Compare sensors',icon:Globe2},{id:'explore',name:'Australia case study',icon:MapIcon},{id:'timing',name:'Sensor comparison',icon:Radio},{id:'methods',name:'Data & methodology',icon:Database}].map(({id,name,icon:Icon})=><button key={id} className={`nav-item ${view===id?'active':''}`} aria-label={name} aria-current={view===id?'page':undefined} onClick={()=>{if(id==='command')setCommandVisited(true);setView(id as View);}}><Icon size={18}/><span>{name}</span>{view===id&&<span className="nav-dot"/>}</button>)}
   </nav>
   <div className="study-box"><span className="tiny">{(view==='global'||view==='learn')?'CURRENT WORKSPACE':'CURRENT STUDY'}</span><div className="study-outline"><Crosshair size={20}/><span>{(view==='global'||view==='learn')?'Planet Earth':<>Southeastern<br/>Australia</>}</span></div><p>{(view==='global'||view==='learn')?'Country explorer':'Black Summer'}<br/><span>2019 — 2020</span></p><div className="study-status"><span/> Historical observations</div></div>
   <div className="sidebar-bottom"><div className="source-sign"><span className="orbit"><Database size={17}/></span><span>Powered by public data<br/><strong>NASA FIRMS</strong></span></div><button className="help-link" onClick={()=>setGuide(true)}><CircleHelp size={17}/> Reading this workspace <ArrowUpRight size={15}/></button><span className="version">RESEARCH PROTOTYPE · V0.1</span></div>
  </aside>
  <div className="workspace">
   <header className="topbar"><div className="breadcrumb">Workspace <span>/</span> <strong>{view==='atlas'?'Historical Atlas':view==='lab'?'Sensor Harmonization Lab':view==='recent'?'Recent detections':view==='command'?'FireTrace Command':view==='learn'?'Start here':view==='global'?'Global observatory':view==='explore'?'Australia study':view==='timing'?'Sensor comparison':'Data & methodology'}</strong></div><div className="top-status"><span className="status-dot"/> Verified source files <span className="divider"/> <span className="mono">11 NOV 2026</span></div></header>
   <main id="main" ref={mainRef}>
    {commandVisited&&<div hidden={view!=='command'}><CommandWorkspace onLocate={locateCommandCell} onRecent={()=>setView('recent')}/></div>}
    {!['command','atlas','lab','recent'].includes(view)&&<div className="page-heading"><div><div className="eyebrow"><span className="orange-line"/> {view==='learn'?'A FIELD GUIDE TO FIRETRACE':view==='global'?'NASA FIRMS / MODIS × VIIRS':'THE BLACK SUMMER STUDY'}</div><h1>{view==='learn'?'Why. How. What you can learn.':view==='global'?'Same Earth. Different observations.':view==='explore'?'Black Summer, in focus.':view==='timing'?'Same place. Different times.':'Evidence comes first.'}</h1><p>{view==='learn'?'Understand the purpose, explore the evidence, and ask better questions.':view==='global'?'Compare what MODIS and VIIRS reported for the same place and period. Understand why the counts differ.':view==='explore'?'Two satellite systems. One extraordinary fire season. Explore what each observed.':view==='timing'?'Compare when satellites observed the same occupied grid cells.':"Every observation has a source. Every comparison has a limit."}</p></div>{view!=='global'&&view!=='learn'&&<button className="export-button" onClick={view==='explore'?exportData:()=>{window.location.href=view==='timing'?'/reports/temporal_sensitivity.csv':'/reports/harmonization-plan.md';}} disabled={view==='explore'&&!data}><ArrowDownToLine size={16}/>{exported&&view==='explore'?'CSV downloaded':'Export '+(view==='explore'?'view':view==='timing'?'results':'protocol')}</button>}</div>}
    {view==='atlas'&&<HistoricalAtlas/>}
    {view==='lab'&&<HistoricalAtlas lab/>}
    {view==='recent'&&<RecentDetections/>}
    {view==='learn'&&<LearnFireTrace onExplore={()=>setView('global')} onAsk={()=>setChatOpen(true)}/>}
    <div hidden={view!=='global'}><GlobalExplorer active={view==='global'} onStudy={()=>setView('explore')}/></div>
    {view!=='global'&&view!=='command'&&error&&<div role="alert" className="error-box">{error} <button onClick={()=>window.location.reload()}>Try again</button></div>}
    {view!=='global'&&view!=='command'&&!data&&!error&&<div className="loading" role="status"><Radio size={22}/> Loading verified observations…</div>}
    {data&&view==='explore'&&<>
     <section className="filter-bar" aria-label="Observation filters"><div className="region-name"><Crosshair size={17}/><strong>Southeastern Australia</strong><span className="country-code">AU</span></div><div className="filter-select"><label htmlFor="period">Period</label><select id="period" aria-label="Period" value={month} onChange={e=>changeFilter(()=>setMonth(e.target.value))}><option value="ALL">Full season · Sep ’19 – Mar ’20</option>{MONTHS.map((m,i)=><option key={m} value={m}>{FULL[i]}</option>)}</select><ChevronDown size={14}/></div><div className="segment" aria-label="Acquisition time">{[['ALL','Day + night'],['D','Day'],['N','Night']].map(([id,label])=><button key={id} aria-pressed={day===id} className={day===id?'selected':''} onClick={()=>changeFilter(()=>setDay(id))}>{label}</button>)}</div></section>
     <section className="metrics" aria-label="Selected observation counts"><div className="metric"><span><i className="sensor-dot orange"/>MODIS observations</span><strong>{fmt(totals[0])}<small>1 km nominal</small></strong><p>{platform==='Combined_MODIS'?'Terra + Aqua':platform} · Collection 6 (6.03)</p></div><div className="metric"><span><i className="sensor-dot teal"/>VIIRS observations</span><strong>{fmt(totals[1])}<small>375 m nominal</small></strong><p>Suomi-NPP · Collection 2</p></div><div className="metric"><span><Layers size={14}/>Occupied grid cells</span><strong>{fmt(plot.length)}<small>10 km grid</small></strong><p>At least one retained sensor detection</p></div></section>
     <div className="explorer-grid">
      <section className="map-panel" aria-label="Geographic observation plot"><div className="map-heading"><div><span className="map-live-dot"/>OBSERVATION FOOTPRINT <span className="map-heading-sub"> / {month==='ALL'?'FULL SEASON':month}</span></div><span className="map-coordinate">140°E – 154°E</span></div>
       <div className="map-stage"><svg viewBox="0 0 850 650" role="img" aria-label={`10 km aggregated hotspot observations in southeastern Australia, ${displayMonth}. Orange MODIS; turquoise VIIRS. Detailed counts are below the map.`}>
        <defs><clipPath id="map-bound"><rect width="850" height="650"/></clipPath><pattern id="ocean-grid" width="50" height="50" patternUnits="userSpaceOnUse"><path d="M50 0H0V50" fill="none" stroke="#547068" strokeWidth=".5" opacity=".2"/></pattern></defs>
        <rect width="850" height="650" fill="#122d29"/><rect width="850" height="650" fill="url(#ocean-grid)"/>
        <g clipPath="url(#map-bound)"><g className="map-camera" transform={`translate(${425*(1-zoom)} ${325*(1-zoom)}) scale(${zoom})`}>
         <path d={paths} fill="#25483c" stroke="#64836c" strokeWidth="1.3" fillRule="evenodd"/>
         <text x={mapX(143)} y={mapY(-30.7)} className="state-label">NEW SOUTH WALES</text><text x={mapX(143.5)} y={mapY(-37.3)} className="state-label">VICTORIA</text><text x={mapX(139)} y={mapY(-32)} className="state-label" transform={`rotate(-90 ${mapX(139)} ${mapY(-32)})`}>SOUTH AUSTRALIA</text>
         <rect x={mapX(140)} y={mapY(-29)} width={700} height={500} fill="none" stroke="#adc6ac" strokeWidth=".8" strokeDasharray="5 5" opacity=".4"/>
         <g className="observation-reveal" key={`${month}-${day}-${platform}-${modis}-${viirs}`}>{plot.map((c,i)=><g key={i}>{viirs&&c.v>0&&<circle cx={mapX(c.lon)} cy={mapY(c.lat)} r={1.5+Math.min(3,Math.log10(c.v+1))} fill="#5ec8ae" opacity=".64"/>}{modis&&c.m>0&&<circle cx={mapX(c.lon)} cy={mapY(c.lat)} r={1.5+Math.min(2.6,Math.log10(c.m+1))} fill="#ff9b5a" opacity=".88"/>}</g>)}
         </g>{plot.map((c,i)=><circle key={`hit${i}`} cx={mapX(c.lon)} cy={mapY(c.lat)} r="5" fill="transparent" className="map-hit" onClick={()=>setCell(c)}><title>{c.lat.toFixed(2)}°, {c.lon.toFixed(2)}° · MODIS {fmt(c.m)} · VIIRS {fmt(c.v)}</title></circle>)}
         {selected&&<circle cx={mapX(selected.lon)} cy={mapY(selected.lat)} r="10" fill="none" stroke="white" strokeWidth="1.5"/>}
         {[[151.2093,-33.8688,'Sydney'],[149.13,-35.28,'Canberra'],[144.963,-37.814,'Melbourne']].map(([lon,lat,label])=><g key={String(label)}><circle cx={mapX(Number(lon))} cy={mapY(Number(lat))} r="2.3" fill="#e5e8d9"/><text x={mapX(Number(lon))+8} y={mapY(Number(lat))+4} className="city-label">{label}</text></g>)}
         <text x="660" y="470" className="sea-label" transform="rotate(-14 660 470)">TASMAN SEA</text>
        </g></g>
       </svg><div className="map-top-note"><Crosshair size={13}/> AUSTRALIA · HISTORICAL</div><div className="zoom-controls"><button onClick={()=>setZoom(z=>Math.min(2,z+.25))} aria-label="Zoom in" disabled={zoom>=2}><Plus size={17}/></button><button onClick={()=>setZoom(z=>Math.max(1,z-.25))} aria-label="Zoom out" disabled={zoom<=1}><Minus size={17}/></button><button onClick={()=>setZoom(1)} aria-label="Reset map zoom"><Maximize2 size={15}/></button></div><div className="map-bottom"><span><i className="sensor-dot orange"/>MODIS <i className="sensor-dot teal"/>VIIRS</span><span>GRID CENTERS · 10 KM</span></div></div>
       <div className="map-caption"><span><ShieldCheck size={14}/> Real NASA FIRMS observations</span><span>Basemap: Natural Earth · Geographic plot</span></div>
      </section>
      <aside className="inspector"><div className="panel-title"><h2>Observation layers</h2><SlidersHorizontal size={16}/></div><p className="panel-subtitle">Compare the sensors’ reported activity.</p>
       <label className={`layer-row ${modis?'layer-on':''}`}><span className="layer-icon orange-icon"><Radio size={20}/></span><span className="layer-copy"><strong>MODIS <small>C6</small></strong><span>{fmt(totals[0])} observations</span></span><input type="checkbox" checked={modis} onChange={e=>setModis(e.target.checked)} aria-label="Show MODIS layer"/><span className="switch"/></label>
       <label className={`layer-row ${viirs?'layer-on':''}`}><span className="layer-icon teal-icon"><Radio size={20}/></span><span className="layer-copy"><strong>VIIRS <small>C2</small></strong><span>{fmt(totals[1])} observations</span></span><input type="checkbox" checked={viirs} onChange={e=>setViirs(e.target.checked)} aria-label="Show VIIRS layer"/><span className="switch"/></label>
       <label className="field-label" htmlFor="platform">MODIS platform</label><select className="full-select" id="platform" value={platform} onChange={e=>changeFilter(()=>setPlatform(e.target.value))}><option value="Combined_MODIS">Terra + Aqua</option><option value="Aqua">Aqua only</option><option value="Terra">Terra only</option></select><p className="fine-print">Layer switches change visibility. Counts include both sensor layers.</p>
       <div className="inspector-divider"/>
       {selected?<div className="cell-detail"><div className="mini-heading">SELECTED GRID CELL <button aria-label="Clear selected cell" onClick={()=>setCell(null)}><X size={14}/></button></div><strong className="mono">{selected.lat.toFixed(3)}°, {selected.lon.toFixed(3)}°</strong><dl><div><dt>MODIS</dt><dd>{fmt(selected.m)}</dd></div><div><dt>VIIRS</dt><dd>{fmt(selected.v)}</dd></div></dl><span className="fine-print">10 km grid center; selected period and time filters.</span></div>:<div className="field-note"><span className="tiny">FIELD NOTE / 01</span><h3>More detections.<br/>{' '}Not more fires.</h3><p>VIIRS resolves smaller hotspots. Different pixel sizes and overpass times affect the counts.</p><button onClick={()=>setView('timing')}>Compare sensor timing <ArrowRight size={15}/></button></div>}
       <div className="quality-note"><span className="quality-icon">!</span><p><strong>Observations, not fire events.</strong> No coverage correction or sensor calibration has been applied.</p></div>
      </aside>
     </div>
     <section className="timeline"><div className="timeline-heading"><div><h2>The season at a glance</h2><p>Filtered hotspot observations · common count scale</p></div><button onClick={()=>changeFilter(()=>setMonth('ALL'))} className={month==='ALL'?'season-active':''}>Full season <ArrowRight size={14}/></button></div><div className="bar-chart">{monthly.map((counts,i)=><button key={MONTHS[i]} className={`month-column ${month===MONTHS[i]?'month-active':''}`} onClick={()=>changeFilter(()=>setMonth(month===MONTHS[i]?'ALL':MONTHS[i]))} aria-pressed={month===MONTHS[i]} aria-label={`${FULL[i]}: ${fmt(counts[0])} MODIS and ${fmt(counts[1])} VIIRS observations. Select month.`}><span className="bars"><span className="modis-bar" style={{height:`${counts[0]/maximum*100}%`}}/><span className="viirs-bar" style={{height:`${counts[1]/maximum*100}%`}}/></span><span className="month-label">{LABELS[i]} <small>{i===0?'2019':i===4?'2020':''}</small></span><span className="chart-tooltip">MODIS {fmt(counts[0])}<br/>VIIRS {fmt(counts[1])}</span></button>)}</div><div className="timeline-footer"><span><i className="sensor-dot orange"/>MODIS <i className="sensor-dot teal"/>VIIRS S-NPP</span><span>Click a month to explore</span></div></section>
     <details className="data-table"><summary>Inspect occupied grid cells <span>{fmt(plot.length)} cells · keyboard-accessible data table</span></summary><p>Top 100 cells by total reported observations. Export view downloads all cells for the selected filters.</p><div className="table-scroll"><table><thead><tr><th>Latitude</th><th>Longitude</th><th>MODIS</th><th>VIIRS</th><th>Inspect</th></tr></thead><tbody>{[...plot].sort((a,b)=>(b.m+b.v)-(a.m+a.v)).slice(0,100).map(c=><tr key={`${c.lat},${c.lon}`}><td>{c.lat.toFixed(3)}°</td><td>{c.lon.toFixed(3)}°</td><td>{fmt(c.m)}</td><td>{fmt(c.v)}</td><td><button onClick={()=>{setCell(c);document.querySelector('.inspector')?.scrollIntoView({behavior:'auto',block:'center'});}}>Select cell</button></td></tr>)}</tbody></table></div></details>
    </>}
    {data&&view==='timing'&&<>
     <div className="science-banner"><Radio size={20}/><div><strong>Start with Aqua. Keep Terra separate.</strong><p>The observed timing is more compatible for Aqua–VIIRS. This supports a study design, not a calibrated conversion.</p></div></div>
     <section className="timing-controls"><label>Grid size<select value={grid} onChange={e=>setGrid(e.target.value)}><option value="5">5 km</option><option value="10">10 km</option><option value="20">20 km</option></select></label><label>Acquisition stratum<select value={stratum} onChange={e=>setStratum(e.target.value)}><option value="ALL">Day + night</option><option value="D">Day only</option><option value="N">Night only</option></select></label><div><span className="field-label">Maximum time gap</span><div className="segment">{[15,30,60].map(n=><button key={n} className={windowMinutes===n?'selected':''} aria-pressed={windowMinutes===n} onClick={()=>setWindowMinutes(n)}>{n} min</button>)}</div></div></section>
     <section className="timing-board"><div className="section-heading"><div><h2>How close were the observations?</h2><p>Same grid cell, UTC date and source day/night label · unshifted grid</p></div><span className="tiny">MINIMUM TIMESTAMP GAP</span></div>{currentTiming.map(r=>{const fraction=Number(r[`fraction_common_units_within_${windowMinutes}min`]);return <div className="timing-row" key={r.modis_platform}><div className="pair-name"><span className={`pair-symbol ${r.modis_platform==='Aqua'?'aqua':'terra'}`}><Radio size={22}/></span><div><h3>{r.modis_platform} <span>×</span> VIIRS</h3><p>{fmt(Number(r.same_date_common_units))} shared occupied units</p></div></div><div className="timing-stat"><strong>{Number(r.median_minimum_gap_minutes)}<span> min</span></strong><p>Median minimum gap</p></div><div className="timing-fraction"><div><strong>{(fraction*100).toFixed(1)}%</strong><span>within {windowMinutes} minutes</span></div><div className="fraction-track"><span style={{width:`${fraction*100}%`}}/></div><small>{fmt(Number(r[`common_units_within_${windowMinutes}min`]))} of {fmt(Number(r.same_date_common_units))} shared units</small></div></div>;})}<p className="board-note">Fractions only include units where both sensors reported detections. They cannot measure accuracy, recall or clear-sky coverage.</p></section>
     <div className="method-columns"><section><span className="tiny">WHAT WE MEASURED</span><h2>One shared cell. The closest reported times.</h2><p>For each cell/date/day-night unit, we compare the platforms’ acquisition minutes and retain the smallest absolute gap. Each unit counts once.</p><a href="/reports/timing-report.md" download>Download the timing report <ArrowDownToLine size={15}/></a></section><section><span className="tiny">WHAT THIS DOES NOT PROVE</span><h2>Proximity is a starting point.</h2><p>Two detections can be different fires. The analysis omits adjacent-cell and cross-midnight pairs. The time windows are sensitivity choices, not validated matching thresholds.</p><button className="text-button" onClick={()=>setView('methods')}>Read the full methodology <ArrowRight size={15}/></button></section></div>
    </>}
    {data&&view==='methods'&&<>
     <div className="science-banner"><ShieldCheck size={22}/><div><strong>Verified records. Explicit limitations.</strong><p>Original source hashes and live ZIP member checks passed on 10 November 2026.</p></div></div>
     <div className="science-banner"><Globe2 size={20}/><div><strong>Global observatory: a separate archive.</strong><p>The globe offers separate worldwide MODIS C6 and VIIRS S-NPP C2 observations for 2019 and 2020, plus the original MODIS-only 2020 archive. Global source counts, country/date coverage, timing and the exploratory holdout experiment are documented in the global audit. The Australia registers below describe the original southeastern study.</p><a href="/reports/history-validation.json" download>Download global source audit</a></div></div>
     <section className="provenance-section"><div className="section-heading"><div><h2>Source register</h2><p>NASA FIRMS annual Australia country files · standard processing</p></div><a href="/reports/provenance.json" download>Download provenance <ArrowDownToLine size={15}/></a></div><div className="table-scroll"><table><thead><tr><th>Dataset</th><th>Collection</th><th>Selected rows</th><th>Retained rows</th><th>Access</th></tr></thead><tbody><tr><td><i className="sensor-dot orange"/>MODIS · Terra + Aqua</td><td>C6 / 6.03</td><td>106,390</td><td>97,185</td><td><span className="access-label"><Check size={13}/>Public archive</span></td></tr><tr><td><i className="sensor-dot teal"/>VIIRS · Suomi-NPP</td><td>C2 / 2</td><td>569,166</td><td>542,727</td><td><span className="access-label"><Check size={13}/>Public archive</span></td></tr></tbody></table></div></section>
     <div className="method-columns method-details"><section><span className="tiny">01 / STUDY BOUNDARY</span><h2>A precise slice of Black Summer.</h2><p>1 September 2019 through 31 March 2020, inclusive UTC dates. Australia-country membership intersected with 140°–154°E and 39°–29°S. Offshore coverage is not guaranteed.</p><span className="mono coordinate-box">140, -39, 154, -29 · 213 DAYS</span></section><section><span className="tiny">02 / FILTERING</span><h2>Preserved source. Declared choices.</h2><p>Type 0: presumed vegetation fire. MODIS confidence ≥30; VIIRS nominal/high. These confidence classes are not equivalent probabilities. All original records remain preserved.</p><p>155 negative VIIRS FRP values were flagged in the selected source data. None survive the baseline type/confidence filters. FRP is not used for counts.</p></section><section><span className="tiny">03 / CURRENT LIMITS</span><h2>A comparison, not a harmonized calendar.</h2><p>No-data rows do not establish fire absence. Counts are observations, not unique fires or burned area. Full valid-observation and cloud masks have not been retrieved.</p><p>The loaded MODIS data are C6, not C6.1. Sample C6.1 science-file requests returned authentication errors. A 2019-trained country-ratio baseline has been tested against 2020 as a weak comparator. It is not a transferable calibration. See the globe evidence for scores and uncertainty.</p></section><section><span className="tiny">04 / REPRODUCIBILITY</span><h2>Follow every number back.</h2><p>The browser data are rebuilt from verified filtered CSVs. Aggregations reconcile with 639,912 retained observations. Grid centers represent 10 km equal-area cells, not precise fire locations.</p><a href="/reports/harmonization-plan.md" download>Download scientific protocol <ArrowDownToLine size={15}/></a><a href="/reports/status-2026-11-10.md" download>Download completed-work audit <ArrowDownToLine size={15}/></a></section></div>
     <details className="hash-details"><summary>Verified filtered-input SHA-256 hashes</summary>{Object.entries(data.input_sha256).map(([s,h])=><p key={s}><strong>{s}</strong><code>{h}</code></p>)}</details><div className="external-sources"><span>OFFICIAL SOURCES</span><a href="https://firms.modaps.eosdis.nasa.gov/country/" target="_blank" rel="noreferrer">FIRMS country archive <ArrowUpRight size={14}/></a><a href="https://firms.modaps.eosdis.nasa.gov/download/" target="_blank" rel="noreferrer">FIRMS archive tool <ArrowUpRight size={14}/></a></div>
    </>}
    <footer className="footer"><span><Flame size={14}/> FireTrace <span> / </span> Understand the observation.</span><span>Independent research prototype · Not an emergency monitoring service</span></footer>
   </main>
  </div>
  <ProjectAssistant open={chatOpen} onOpen={()=>setChatOpen(true)} onClose={()=>setChatOpen(false)}/>
  {guide&&<div className="modal-backdrop" onClick={()=>setGuide(false)}><div ref={guideRef} className="guide-modal" role="dialog" aria-modal="true" aria-labelledby="guide-title" onClick={e=>e.stopPropagation()} onKeyDown={e=>{if(e.key==='Escape')setGuide(false);}}><button autoFocus className="modal-close" aria-label="Close reading guide" onClick={()=>setGuide(false)}><X size={20}/></button><span className="tiny">A QUICK FIELD GUIDE</span><h2 id="guide-title">Read the signal.<br/>Respect the limits.</h2><p>Orange marks MODIS. Turquoise marks VIIRS. Global points represent 1° geographic cell centers; Australia globe points use 25 km cells and the southeastern study uses 10 km cells. The numbers are reported hotspot observations.</p><ol><li>Choose a month and day/night filter.</li><li>Toggle layers or separate Terra and Aqua.</li><li>Click a map point or select a cell in the data table.</li><li>Compare timing before interpreting disagreement.</li></ol><p className="fine-print">No observed hotspot does not mean no fire. The loaded MODIS collection is C6; calibration remains unfinished.</p><button className="export-button" onClick={()=>setGuide(false)}>Explore the observations <ArrowRight size={16}/></button></div></div>}
 </div>;
}
