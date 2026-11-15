import fs from 'node:fs';
import { geoArea, geoCentroid } from 'd3-geo';
const source=new URL('../../firetrace-global/world-source.geojson',import.meta.url);
const output=new URL('../public/data/world.geojson',import.meta.url);
if(!fs.existsSync(source))fs.copyFileSync(output,source);
const world=JSON.parse(fs.readFileSync(source,'utf8'));
function simplify(points,tolerance=.05){
 if(points.length<=5)return points;
 const a=points[0],b=points[points.length-1];let best=0,index=0;
 for(let i=1;i<points.length-1;i++){
  const p=points[i],dx=b[0]-a[0],dy=b[1]-a[1];let t=dx||dy?((p[0]-a[0])*dx+(p[1]-a[1])*dy)/(dx*dx+dy*dy):0;t=Math.max(0,Math.min(1,t));
  const d=Math.hypot(p[0]-a[0]-t*dx,p[1]-a[1]-t*dy);if(d>best){best=d;index=i;}
 }
 return best>tolerance?[...simplify(points.slice(0,index+1),tolerance).slice(0,-1),...simplify(points.slice(index),tolerance)]:[a,b];
}
for(const f of world.features){
 const polygons=f.geometry.type==='MultiPolygon'?f.geometry.coordinates:[f.geometry.coordinates];
 for(const polygon of polygons)for(let i=0;i<polygon.length;i++){const ring=simplify(polygon[i]);if(ring.length>=4)polygon[i]=ring;}
 for(const polygon of polygons)for(let i=0;i<polygon.length;i++){const area=geoArea({type:'Polygon',coordinates:[polygon[i]]});if((i===0&&area>2*Math.PI)||(i>0&&area<2*Math.PI))polygon[i].reverse();}
 f.properties.center=geoCentroid(f);
}
fs.writeFileSync(output,JSON.stringify(world));
console.log(`Prepared ${world.features.length} country/territory geometries.`);
