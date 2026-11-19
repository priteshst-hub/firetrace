import assert from 'node:assert/strict';
import test from 'node:test';
import {csvRows,parseFirms,handleFirms} from '../worker/firms.ts';
const now=Date.parse('2026-11-20T12:00:00Z');
const header='latitude,longitude,acq_date,acq_time,satellite,confidence,version,daynight,frp';
const row='-35,149,2026-11-20,0905,N,n,2.0NRT,D,10.5';
test('FIRMS parser preserves observed evidence, deduplicates exact rows and handles CSV quoting',()=>{
 const rows=parseFirms(`${header}\r\n${row}\r\n${row}`, 'VIIRS_SNPP_NRT',now);
 assert.equal(rows.length,1);assert.equal(rows[0].acquired_at,'2026-11-20T09:05:00Z');assert.equal(rows[0].frp,10.5);assert.equal(rows[0].sensor,'VIIRS_SNPP_NRT');
 assert.deepEqual(csvRows('a,b\n"a,b","c""d"\n'),[['a','b'],['a,b','c"d']]);
 assert.equal(parseFirms(header+'\n','MODIS_NRT',now).length,0);
});
test('invalid, stale, impossible dates and API error bodies never become detections',()=>{
 for(const text of ['Invalid MAP_KEY',header+'\n'+row.replace('0905','2560'),header+'\n'+row.replace('2026-11-20','2026-11-01'),header+'\n'+row.replace('-35','-95'),header+'\n'+row.replace('2026-11-20','2026-02-30')])assert.throws(()=>parseFirms(text,'MODIS_NRT',now));
 assert.throws(()=>csvRows('a\n"unfinished'));
 assert.throws(()=>parseFirms(header+'\n'+row.replace(',n,',',invalid,'),'VIIRS_SNPP_NRT',now));
 assert.throws(()=>parseFirms(header+'\n'+row,'MODIS_NRT',now));
});
test('missing credentials produce explicit unavailable state without contacting NASA',async()=>{
 const response=await handleFirms(new Request('https://example.com/api/firms'),{CHAT_GLOBAL:{limit:async()=>{throw Error('should not be called')}}});
 assert.equal(response.status,503);const body=await response.json();assert.equal(body.status,'unavailable');assert.ok(!('detections' in body));
});
test('feed caches genuine parsed response, preserves partial source failure and does not expose keys',async()=>{
 const originalFetch=globalThis.fetch,originalCaches=globalThis.caches;
 const stored=new Map();globalThis.caches={default:{match:async request=>stored.get(request.url)?.clone(),put:async(request,response)=>stored.set(request.url,response)}};
 let calls=0;
 const date=new Date().toISOString().slice(0,10);
 globalThis.fetch=async url=>{calls++;return url.includes('MODIS_NRT')?new Response(`${header}\n-35,149,${date},0000,Terra,80,6.1NRT,D,2`):new Response('failure',{status:503});};
 try{
 const env={FIRMS_MAP_KEY:'DO_NOT_EXPOSE',CHAT_GLOBAL:{limit:async()=>({success:true})}};
 const response=await handleFirms(new Request('https://example.com/api/firms?ignored=1'),env);const text=await response.text();const body=JSON.parse(text);
 assert.equal(body.status,'partial');assert.equal(body.detections.length,1);assert.equal(body.publication_time,null);assert.equal(text.includes(env.FIRMS_MAP_KEY),false);
 await handleFirms(new Request('https://example.com/api/firms'),env);assert.equal(calls,2);
 }finally{globalThis.fetch=originalFetch;globalThis.caches=originalCaches;}
});
