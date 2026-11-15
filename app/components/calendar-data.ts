/** Indices match the imported archive: Terra D/N, Aqua D/N, S-NPP D/N. */
export function sensorCounts(row: readonly (string|number|undefined)[], platform:string, day:string):[number,number] {
 const n=(i:number)=>Number(row[i]);
 return [
  (day==='N'?0:(platform==='Aqua'?0:n(3))+(platform==='Terra'?0:n(5)))+
  (day==='D'?0:(platform==='Aqua'?0:n(4))+(platform==='Terra'?0:n(6))),
  (day==='N'?0:n(7))+(day==='D'?0:n(8))
 ];
}
export function calendarCounts(rows:readonly (readonly (string|number|undefined)[])[],months:string[],platform:string,day:string) {
 const sums=new Map(months.map(m=>[m,[0,0] as [number,number]]));
 for(const row of rows){const sum=sums.get(String(row[0]));if(!sum)continue;const values=sensorCounts(row,platform,day);sum[0]+=values[0];sum[1]+=values[1];}
 return months.map(m=>sums.get(m)!);
}
