'use client';
import {useMemo} from 'react';
import {calendarCounts} from './calendar-data';
const fmt=(n:number)=>n.toLocaleString('en-US');
export default function BurningCalendar({rows,months,area,month,day,platform,hasModis,hasViirs,onMonth}:{rows:readonly (readonly (string|number|undefined)[])[];months:string[];area:string;month:string;day:string;platform:string;hasModis:boolean;hasViirs:boolean;onMonth:(value:string)=>void}){
 const counts=useMemo(()=>calendarCounts(rows,months,platform,day),[rows,months,platform,day]);
 const maximum=Math.max(1,...counts.flatMap(c=>[hasModis?c[0]:0,hasViirs?c[1]:0]));
 return <section className="burning-calendar" aria-labelledby="burning-calendar-title">
  <div className="calendar-heading"><div><span className="tiny">HISTORICAL RECORD / MONTHLY</span><h2 id="burning-calendar-title">Burning Activity Calendar</h2><p>{area} · {platform==='ALL'?'Terra + Aqua':platform} · {day==='ALL'?'day + night':day==='D'?'day':'night'} · UTC months</p></div><button className="calendar-reset" aria-pressed={month==='ALL'} onClick={()=>onMonth('ALL')}>Show full period</button></div>
  <p className="calendar-key"><span><i className="sensor-dot orange"/>MODIS</span><span><i className="sensor-dot teal"/>VIIRS S-NPP</span><span>Separate counts · one linear scale</span></p>
  <div className="calendar-grid">{months.map((m,i)=>{const label=new Date(m+'-15T12:00:00Z').toLocaleDateString('en-GB',{month:'long',year:'numeric',timeZone:'UTC'});return <button key={m} className={`calendar-month ${month===m?'is-selected':''}`} aria-pressed={month===m} aria-label={`${label}. MODIS: ${hasModis?fmt(counts[i][0]):'not loaded'}. VIIRS: ${hasViirs?fmt(counts[i][1]):'not loaded'}. Select month.`} onClick={()=>onMonth(month===m?'ALL':m)}><span className="calendar-date"><strong>{label.split(' ')[0]}</strong><span>{m.slice(0,4)}</span></span>{(['MODIS','VIIRS'] as const).map((sensor,j)=>{const available=j===0?hasModis:hasViirs;return <span key={sensor} className={`calendar-sensor sensor-${j}`}><span>{sensor}</span><strong>{available?fmt(counts[i][j]):'Not loaded'}</strong><span className={`calendar-track ${available?'':'unavailable'}`} aria-hidden="true">{available&&<i style={{width:`${counts[i][j]/maximum*100}%`}}/>}</span></span>;})}</button>;})}</div>
  <p className="calendar-note">Select a month to filter the globe; select it again to show the full period. Layer switches affect the globe only. Zero means no retained detections in an imported sensor archive; “Not loaded” means no mapped source file. Neither establishes fire absence or clear-sky coverage. These are hotspot observations, not unique fires, burned area or an observation-adjusted trend.</p>
 </section>;
}
