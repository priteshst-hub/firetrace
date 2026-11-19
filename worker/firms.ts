/** Fixed-area server-side feed. URLs containing credentials never leave this module. */
export interface FirmsEnv {
  FIRMS_MAP_KEY?: string;
  CHAT_GLOBAL: { limit: (input: { key: string }) => Promise<{ success: boolean }> };
}
export type Detection = { latitude: number; longitude: number; acquired_at: string; sensor: string; satellite: string; confidence: string; version: string; frp: number | null; daynight: string };
export function csvRows(text: string): string[][] {
  const rows: string[][] = []; let row: string[] = [], field = '', quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '"') { if (quoted && text[i + 1] === '"') { field += '"'; i++; } else quoted = !quoted; }
    else if (ch === ',' && !quoted) { row.push(field); field = ''; }
    else if ((ch === '\n' || ch === '\r') && !quoted) { if (ch === '\r' && text[i + 1] === '\n') i++; row.push(field); if (row.some(Boolean)) rows.push(row); row = []; field = ''; }
    else field += ch;
  }
  if (quoted) throw Error('Malformed CSV');
  if (field || row.length) { row.push(field); rows.push(row); }
  return rows;
}
export function parseFirms(text: string, source: string, now = Date.now()): Detection[] {
  const [header, ...rows] = csvRows(text);
  const required = ['latitude','longitude','acq_date','acq_time','satellite','confidence','version','daynight'];
  if (!header || required.some(k => !header.includes(k))) throw Error('Invalid FIRMS schema');
  const seen = new Set<string>(); const result: Detection[] = [];
  for (const values of rows) {
    if (values.length !== header.length) throw Error('Invalid FIRMS row');
    const row = Object.fromEntries(header.map((k,i) => [k,values[i]]));
    const latitude = Number(row.latitude), longitude = Number(row.longitude), time = row.acq_time.padStart(4,'0');
    if (!row.latitude || !row.longitude || !Number.isFinite(latitude) || !Number.isFinite(longitude) || latitude < -45 || latitude > -9 || longitude < 112 || longitude > 154 || !/^\d{4}$/.test(time) || Number(time.slice(0,2)) > 23 || Number(time.slice(2)) > 59 || !/^\d{4}-\d{2}-\d{2}$/.test(row.acq_date)) throw Error('Invalid FIRMS coordinates/time');
    const modis = source === 'MODIS_NRT';
    if (!['MODIS_NRT','VIIRS_SNPP_NRT'].includes(source) || !['D','N'].includes(row.daynight) || !row.version ||
      !(modis ? ['Terra','Aqua','T','A'].includes(row.satellite) && row.confidence.trim() !== '' && Number.isFinite(Number(row.confidence)) && Number(row.confidence) >= 0 && Number(row.confidence) <= 100 : ['N','Suomi-NPP','Suomi NPP','SNPP'].includes(row.satellite) && ['l','n','h'].includes(row.confidence)) ||
      (row.instrument && row.instrument.toUpperCase() !== (modis ? 'MODIS' : 'VIIRS'))) throw Error('Invalid FIRMS sensor/quality metadata');
    const acquired_at = `${row.acq_date}T${time.slice(0,2)}:${time.slice(2)}:00Z`;
    const stamp = Date.parse(acquired_at);
    if (!Number.isFinite(stamp) || new Date(stamp).toISOString().slice(0,10) !== row.acq_date || stamp > now + 3600000 || stamp < now - 3*86400000) throw Error('FIRMS date outside recent window');
    const detection: Detection = {latitude,longitude,acquired_at,sensor:source,satellite:row.satellite,confidence:row.confidence,version:row.version,frp:row.frp && Number.isFinite(Number(row.frp)) ? Number(row.frp) : null,daynight:row.daynight};
    const id = JSON.stringify(detection); if (!seen.has(id)) { seen.add(id); result.push(detection); }
  }
  return result;
}
const pending = new Map<string, Promise<Response>>();
export async function handleFirms(request: Request, env: FirmsEnv): Promise<Response> {
  const json = (body: unknown, status = 200) => Response.json(body,{status,headers:{'Cache-Control':'no-store'}});
  if (request.method !== 'GET') return json({status:'error',error:'GET required'},405);
  if (!env.FIRMS_MAP_KEY) return json({status:'unavailable',error:'NASA MAP_KEY is not configured. No authenticated live request has been verified.'},503);
  // Stable cache identity independent of request query strings and secrets.
  const cacheKey = new Request(new URL('/api/firms',request.url).href);
  const cache = (caches as unknown as {default: Cache}).default;
  const cached = await cache.match(cacheKey); if (cached) return cached;
  if (!(await env.CHAT_GLOBAL.limit({key:'firms-area-global'})).success) return json({status:'rate_limited',error:'Feed request limit reached; retry later.'},429);
  const key = cacheKey.url;
  const existing = pending.get(key); if (existing) return (await existing).clone();
  const job = (async () => {
    const sources = ['MODIS_NRT','VIIRS_SNPP_NRT'];
    const results = await Promise.all(sources.map(async source => {
      try {
        const response = await fetch(`https://firms.modaps.eosdis.nasa.gov/api/area/csv/${encodeURIComponent(env.FIRMS_MAP_KEY!)}/${source}/112,-45,154,-9/2`,{signal:AbortSignal.timeout(25000)});
        if (!response.ok) return {source,status:'error',error:`NASA HTTP ${response.status}`,detections:[] as Detection[]};
        const text = await response.text(); if (text.length > 12_000_000) throw Error('Oversized feed');
        return {source,status:'ok',detections:parseFirms(text,source)};
      } catch { return {source,status:'error',error:'NASA response unavailable, timed out or failed schema validation',detections:[] as Detection[]}; }
    }));
    const detections = results.flatMap(r => r.detections).sort((a,b) => b.acquired_at.localeCompare(a.acquired_at));
    const latest = detections[0]?.acquired_at ?? null;
    const ok = results.filter(r => r.status === 'ok').length;
    const response = Response.json({status:ok===2?'ok':ok?'partial':'unavailable',retrieved_at:new Date().toISOString(),publication_time:null,publication_note:'FIRMS Area CSV does not supply per-record publication time.',latest_acquisition:latest,stale:latest ? Date.now()-Date.parse(latest)>24*3600000 : null,sources:results.map(r=>({source:r.source,status:r.status,...('error' in r?{error:r.error}:{})})),detections,scope:'Australia bounding box; may include offshore/neighbouring territory; two UTC days; NRT subject to revision; detections are not unique fires.'},{status:ok?200:502,headers:{'Cache-Control':`public, max-age=${ok?300:30}`}});
    await cache.put(cacheKey,response.clone()); return response;
  })();
  pending.set(key,job);
  try { return (await job).clone(); } finally { pending.delete(key); }
}
