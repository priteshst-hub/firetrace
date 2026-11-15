'use client';
import {useCallback,useEffect,useMemo,useRef,useState} from 'react';
import {geoContains,geoGraticule10,geoOrthographic,geoPath,type GeoProjection} from 'd3-geo';
import type {Feature,FeatureCollection,Geometry} from 'geojson';
import {Maximize2,Minus,Pause,Play,Plus,RotateCcw} from 'lucide-react';
export type Country=Feature<Geometry,{name:string;iso:string;label:string;center:[number,number]}>;
export type World=FeatureCollection<Geometry,Country['properties']>;
export type GlobePoint={lon:number;lat:number;m:number;v:number};
type Props={active?:boolean;world:World;points:GlobePoint[];selected:string;modis:boolean;viirs:boolean;coverageLabel:string;gridLabel:string;onSelect:(iso:string)=>void};
export default function GlobeCanvas({active=true,world,points,selected,modis,viirs,onSelect,coverageLabel,gridLabel}:Props){
 const canvas=useRef<HTMLCanvasElement>(null),surface=useRef<HTMLDivElement>(null);
 const rotation=useRef<[number,number,number]>([-20,-15,0]);
 const projection=useRef<GeoProjection|null>(null),draw=useRef<()=>void>(()=>{});
 const camera=useRef<{from:[number,number,number];to:[number,number,number];start:number}|null>(null);
 const visible=useRef(true);
 const renderZoom=useRef(1);
 const zoomMove=useRef<{from:number;to:number;start:number}|null>(null);
 const lastHover=useRef(0);
 const pointers=useRef(new Map<number,[number,number]>());const origin=useRef<[number,number]|null>(null);const moved=useRef(false);const pinch=useRef<number|null>(null);
 const [playing,setPlaying]=useState(false),[zoom,setZoom]=useState(1),[hover,setHover]=useState(''),[reduced,setReduced]=useState(false),[expanded,setExpanded]=useState(false);
 useEffect(()=>{if(!expanded)return;const previous=document.body.style.overflow;document.body.style.overflow='hidden';const escape=(e:KeyboardEvent)=>{if(e.key==='Escape')setExpanded(false);};document.addEventListener('keydown',escape);return()=>{document.body.style.overflow=previous;document.removeEventListener('keydown',escape);};},[expanded]);
 const preparedPoints=useMemo(()=>points.map(point=>{const lon=point.lon*Math.PI/180,lat=point.lat*Math.PI/180,c=Math.cos(lat);return {...point,x:c*Math.cos(lon),y:c*Math.sin(lon),z:Math.sin(lat)};}),[points]);
 const chosen=world.features.find(f=>f.properties.iso===selected);
 useEffect(()=>{const media=matchMedia('(prefers-reduced-motion: reduce)');const update=()=>{setReduced(media.matches);setPlaying(!media.matches);};update();media.addEventListener('change',update);return()=>media.removeEventListener('change',update);},[]);
 useEffect(()=>{
  if(!chosen){camera.current=null;return;}
  const from=[...rotation.current] as [number,number,number];
  const longitude=-chosen.properties.center[0];
  const to:[number,number,number]=[from[0]+(((longitude-from[0]+180)%360+360)%360-180),-chosen.properties.center[1],0];
  if(reduced){rotation.current=to;camera.current=null;}else camera.current={from,to,start:performance.now()};
  draw.current();const frame=requestAnimationFrame(()=>{setPlaying(false);setZoom(1.35);});
  return()=>cancelAnimationFrame(frame);
 },[chosen,reduced]);
 useEffect(()=>{if(active)return;const frame=requestAnimationFrame(()=>setExpanded(false));return()=>cancelAnimationFrame(frame);},[active]);
 useEffect(()=>{
  if(reduced){renderZoom.current=zoom;zoomMove.current=null;}
  else zoomMove.current={from:renderZoom.current,to:zoom,start:performance.now()};
  draw.current();
 },[zoom,reduced]);
 useEffect(()=>{
  if(reduced)return;
  const animation=canvas.current?.animate([{opacity:.6},{opacity:1}],{duration:220,easing:'ease-out'});
  return()=>animation?.cancel();
 },[preparedPoints,modis,viirs,reduced]);
 const countryAt=useCallback((clientX:number,clientY:number)=>{
  const rect=canvas.current?.getBoundingClientRect(),p=projection.current;if(!rect||!p)return;
  const x=clientX-rect.left,y=clientY-rect.top;const c=p.translate(),radius=p.scale();
  if(Math.hypot(x-c[0],y-c[1])>radius)return;
  const position=p.invert?.([x,y]);if(!position||!Number.isFinite(position[0]))return;
  return world.features.find(f=>geoContains(f,position));
 },[world]);
 useEffect(()=>{
  const el=canvas.current,holder=surface.current;if(!el||!holder)return;const ctx=el.getContext('2d');if(!ctx)return;
  let frame=0,last=0,lastDraw=0,dirty=true;let width=0,height=0;const graticule=geoGraticule10();
  function resize(){const box=holder!.getBoundingClientRect();width=box.width;height=box.height;const dpr=Math.min(devicePixelRatio||1,2);el!.width=width*dpr;el!.height=height*dpr;ctx!.setTransform(dpr,0,0,dpr,0,0);dirty=true;paint();}
  function paint(){
   if(!width||!height)return;const c=ctx!;c.clearRect(0,0,width,height);
   const zoom=renderZoom.current;
   const radius=Math.min(width*.41,height*.43)*zoom;
   const p=geoOrthographic().translate([width/2,height/2]).scale(radius).rotate(rotation.current).clipAngle(90).precision(.7);projection.current=p;
   const path=geoPath(p,c);const sphere={type:'Sphere'} as const;
   const ocean=c.createRadialGradient(width*.39,height*.34,1,width/2,height/2,radius);ocean.addColorStop(0,'#224c47');ocean.addColorStop(1,'#102f2e');
   c.beginPath();path(sphere);c.fillStyle=ocean;c.fill();c.strokeStyle='#789889';c.lineWidth=.8;c.stroke();
   c.save();c.beginPath();path(sphere);c.clip();
   c.beginPath();path(graticule);c.strokeStyle='#7e9f8a22';c.lineWidth=.55;c.stroke();
   for(const f of world.features){c.beginPath();path(f);c.fillStyle=f.properties.iso===selected?'#7c9271':'#3a6050';c.fill();c.strokeStyle=f.properties.iso===selected?'#f1cca1':'#92aa864a';c.lineWidth=f.properties.iso===selected?1.2:.45;c.stroke();}
   const cl=-rotation.current[0]*Math.PI/180,ct=-rotation.current[1]*Math.PI/180;const cx=Math.cos(ct)*Math.cos(cl),cy=Math.cos(ct)*Math.sin(cl),cz=Math.sin(ct);
   for(const point of preparedPoints){if(point.x*cx+point.y*cy+point.z*cz<0)continue;const position=p([point.lon,point.lat]);if(!position)continue;
    if(viirs&&point.v){c.beginPath();c.arc(position[0],position[1],Math.min(3.4,1+Math.log10(point.v+1)*.65)*Math.sqrt(zoom),0,2*Math.PI);c.fillStyle='#59c8ad9c';c.fill();}
    if(modis&&point.m){c.beginPath();c.arc(position[0],position[1],(gridLabel.startsWith('1°')?Math.min(1.8,.55+Math.log10(point.m+1)*.24):Math.min(2.8,.8+Math.log10(point.m+1)*.5))*Math.sqrt(zoom),0,2*Math.PI);c.fillStyle='#f6a161dc';c.fill();}
   }
   c.restore();
   // Thin orbital guide marks orient the globe without implying an observation boundary.
   c.strokeStyle='#9cb39b22';c.lineWidth=1;c.beginPath();c.arc(width/2,height/2,radius+12,0,2*Math.PI);c.stroke();
  }
  draw.current=()=>{dirty=true;if(!frame&&active&&visible.current&&!document.hidden)frame=requestAnimationFrame(tick);};
  function tick(now:number){if(!last)last=now;const delta=Math.min(now-last,100);last=now;
   if(!active||!visible.current||document.hidden){frame=0;return;}
   if(zoomMove.current){const move=zoomMove.current;const t=Math.min(1,(now-move.start)/280);renderZoom.current=move.from+(move.to-move.from)*(1-Math.pow(1-t,3));dirty=true;if(t===1)zoomMove.current=null;}
   if(camera.current){const move=camera.current;const t=Math.min(1,(now-move.start)/600),ease=1-Math.pow(1-t,3);rotation.current=move.from.map((v,i)=>v+(move.to[i]-v)*ease) as [number,number,number];dirty=true;if(t===1)camera.current=null;}
   if(playing&&!camera.current&&pointers.current.size===0){rotation.current[0]=(rotation.current[0]+delta*.0028)%360;dirty=true;}
   if(dirty&&now-lastDraw>50){paint();dirty=false;lastDraw=now;}
   frame=(playing||camera.current||zoomMove.current||dirty)?requestAnimationFrame(tick):0;
  }
  const observer=new ResizeObserver(resize);observer.observe(holder);resize();if(active)frame=requestAnimationFrame(tick);
  const visibility=new IntersectionObserver(([entry])=>{visible.current=entry.isIntersecting;if(entry.isIntersecting)draw.current();});visibility.observe(holder);
  const wake=()=>draw.current();document.addEventListener('visibilitychange',wake);
  const wheel=(e:WheelEvent)=>{if(!e.ctrlKey&&!e.metaKey)return;e.preventDefault();setZoom(z=>Math.max(.8,Math.min(3,z-e.deltaY*.002)));setPlaying(false);};
  holder.addEventListener('wheel',wheel,{passive:false});
  return()=>{cancelAnimationFrame(frame);observer.disconnect();visibility.disconnect();document.removeEventListener('visibilitychange',wake);holder.removeEventListener('wheel',wheel);draw.current=()=>{};};
 },[world,preparedPoints,selected,modis,viirs,playing,gridLabel,active]);
 function reset(){camera.current=null;rotation.current=[-20,-15,0];setZoom(1);onSelect('WORLD');setPlaying(!reduced);draw.current();}
 return <div className="globe-frame">
  <div className={`globe-surface ${expanded?'expanded':''}`} ref={surface}>
   <canvas ref={canvas} role="img" aria-label={`Rotatable world globe. ${chosen?chosen.properties.name+' selected.':'All countries and territories.'} ${coverageLabel} Use the country selector for an accessible alternative.`} tabIndex={0}
    onPointerDown={e=>{camera.current=null;e.currentTarget.setPointerCapture(e.pointerId);pointers.current.set(e.pointerId,[e.clientX,e.clientY]);origin.current=[e.clientX,e.clientY];moved.current=false;setPlaying(false);if(pointers.current.size===2){const [a,b]=[...pointers.current.values()];pinch.current=Math.hypot(a[0]-b[0],a[1]-b[1]);}}}
    onPointerMove={e=>{
     const old=pointers.current.get(e.pointerId);
     if(old){pointers.current.set(e.pointerId,[e.clientX,e.clientY]);if(pointers.current.size===2){const [a,b]=[...pointers.current.values()];const distance=Math.hypot(a[0]-b[0],a[1]-b[1]);if(pinch.current)setZoom(z=>Math.max(.8,Math.min(3,z*distance/pinch.current!)));pinch.current=distance;moved.current=true;}
      else {rotation.current[0]+=(e.clientX-old[0])*.3/zoom;rotation.current[1]=Math.max(-85,Math.min(85,rotation.current[1]-(e.clientY-old[1])*.3/zoom));if(origin.current&&Math.hypot(e.clientX-origin.current[0],e.clientY-origin.current[1])>5)moved.current=true;draw.current();}}
     else {const now=performance.now();if(now-lastHover.current>80){lastHover.current=now;const f=countryAt(e.clientX,e.clientY);setHover(f?.properties.name||'');}}
    }}
    onPointerUp={e=>{if(pointers.current.size===1&&!moved.current){const f=countryAt(e.clientX,e.clientY);if(f)onSelect(f.properties.iso);}pointers.current.delete(e.pointerId);pinch.current=null;}}
    onPointerCancel={e=>{pointers.current.delete(e.pointerId);pinch.current=null;}}
    onPointerLeave={()=>setHover('')}
    onKeyDown={e=>{if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown',' ','+','-'].includes(e.key)){e.preventDefault();camera.current=null;setPlaying(false);if(e.key==='ArrowLeft')rotation.current[0]-=10;if(e.key==='ArrowRight')rotation.current[0]+=10;if(e.key==='ArrowUp')rotation.current[1]=Math.min(85,rotation.current[1]+10);if(e.key==='ArrowDown')rotation.current[1]=Math.max(-85,rotation.current[1]-10);if(e.key===' ')setPlaying(!playing);if(e.key==='+')setZoom(z=>Math.min(3,z+.2));if(e.key==='-')setZoom(z=>Math.max(.8,z-.2));draw.current();}}}/>
   <div className="globe-coordinates"><span className="map-live-dot"/> EARTH / ORTHOGRAPHIC VIEW</div>
   <div className="globe-hover" aria-live="polite">{hover||chosen?.properties.name||'Drag to explore the planet'}</div>
   <div className="globe-zoom"><button aria-label="Zoom globe in" onClick={()=>setZoom(z=>Math.min(3,z+.25))} disabled={zoom>=3}><Plus size={17}/></button><button aria-label="Zoom globe out" onClick={()=>setZoom(z=>Math.max(.8,z-.25))} disabled={zoom<=.8}><Minus size={17}/></button><button aria-label="Reset globe" onClick={reset}><RotateCcw size={15}/></button><button aria-label={expanded?'Exit fullscreen globe':'Fullscreen globe'} onClick={()=>setExpanded(v=>!v)}><Maximize2 size={15}/></button></div>
   <div className="globe-playback"><button className={playing?'is-playing':''} aria-label={playing?'Pause globe rotation':'Start globe rotation'} aria-pressed={playing} onClick={()=>setPlaying(p=>!p)}>{playing?<Pause size={13}/>:<Play size={13}/>} {playing?'Rotating':'Rotation paused'}</button><span>DRAG TO ROTATE · PINCH OR CTRL + SCROLL TO ZOOM</span></div>
  </div>
  <div className="globe-caption"><span><i className="sensor-dot orange"/> MODIS {coverageLabel.includes('VIIRS')&&<><i className="sensor-dot teal"/> VIIRS</>}</span><span>Natural Earth · {gridLabel}</span></div>
 </div>;
}
