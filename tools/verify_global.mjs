import assert from 'node:assert/strict';
import fs from 'node:fs';
import {geoArea,geoContains} from 'd3-geo';
const world=JSON.parse(fs.readFileSync('public/data/world.geojson'));
const global=JSON.parse(fs.readFileSync('public/data/world-observations.json'));
const australia=JSON.parse(fs.readFileSync('public/data/globe-observations.json'));
const sum=rows=>rows.reduce((n,r)=>n+r.slice(3,9).reduce((s,v)=>s+v,0),0);
assert.equal(world.features.length,242);
const ids=new Set(world.features.map(f=>f.properties.iso));assert.equal(ids.size,242);
for(const f of world.features)assert(geoArea(f)<2*Math.PI,`${f.properties.name}: exterior winding`);
for(const [id,lon,lat] of [['IND',78,22],['AUS',134,-25],['BRA',-52,-12],['USA',-100,40]]){
 assert.deepEqual(world.features.filter(f=>geoContains(f,[lon,lat])).map(f=>f.properties.iso),[id]);
}
assert.equal(global.audit.source_rows,4440623);assert.equal(global.audit.retained,4055050);
assert.equal(global.audit.source_rows,global.audit.retained+global.audit.excluded_type+global.audit.excluded_confidence);
assert.equal(sum(global.cells),4055050);assert.equal(sum(australia.cells),1288177);
assert.equal(Object.keys(global.countries).length,211);
assert.deepEqual(global.unmatched_source_countries,[]);
const assigned=Object.values(global.country_mapping).flat();assert.equal(assigned.length,211);assert.equal(new Set(assigned).size,211);
for(const iso of Object.keys(global.country_mapping))assert(ids.has(iso),`Unselectable source country: ${iso}`);
for(const row of global.cells){assert(/^2020-(0[1-9]|1[0-2])$/.test(row[0]));assert(row[1]>=-180&&row[1]<=180&&row[2]>=-90&&row[2]<=90);assert.equal(row[7]+row[8],0);}
for(const [iso,total] of [['IND',68614],['AUS',144556],['BRA',377943],['USA',140116]]){
 const names=global.country_mapping[iso];assert.equal(sum(global.cells.filter(r=>names.includes(r[9]))),total);
}
console.log('PASS: 242 country geometries, containment, 211 source mappings, 4,055,050 global MODIS rows and 1,288,177 Australian observations reconcile.');
