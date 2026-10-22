import manifest from '../../../public/sports-season.json' with {type:'json'};
import {validateSportsSeason} from '../_shared/sportsSeason.ts';
const config=validateSportsSeason(manifest);
import { assertEquals, assertThrows } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { createHandler, parseExcel } from './index.ts';
import * as XLSX from 'npm:xlsx@0.18.5';
import { SourceUnavailableError } from '../_shared/sourceAvailability.ts';
Deno.test('Division non-XLSX is explicit source unavailable', () => {
  assertThrows(() => parseExcel(new TextEncoder().encode('<html>').buffer,'205403',config), SourceUnavailableError);
});
for (const source of [true, false]) {
  Deno.test(`Division ${source ? 'source unavailable retains data' : 'programming error is fatal'}`, async () => {
    let matchWrites = 0;
    const db = { from: (table: string) => ({ upsert: async () => { if (table === 'division_matches') matchWrites++; return { error: null }; } }) };
    const response = await createHandler({ config, env: () => 'test', createClient: () => db, auth: async () => null,
      load: async () => { throw source ? new SourceUnavailableError('offline') : new TypeError('bug'); } })(new Request('https://test'));
    assertEquals(response.status, source ? 200 : 500); await response.text(); assertEquals(matchWrites, 0);
  });
}

function calendar(teams: number) {
  const data: any[][] = [['Runde','Dato','Dag','Tid','Hjemmelag','Resultat','Bortelag','Bane','Turnering','Kampnummer']];
  let id = 0;
  for (let home=0; home<teams; home++) for (let away=0; away<teams; away++) {
    if (home===away) continue;
    data.push([1,new Date('2026-10-01T00:00:00Z'),'Thursday','20:15',`Team ${home}`,'-',`Team ${away}`,'Venue','League',String(++id)]);
  }
  const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet(data),'Calendar');
  return XLSX.write(wb,{type:'array',bookType:'xlsx'});
}
Deno.test('Division Excel validation supports 205403 with 132 and 205410 with 90 matches', () => {
  const a = parseExcel(calendar(12),'205403',config); const b = parseExcel(calendar(10),'205410',config);
  assertEquals(a.length,132); assertEquals(b.length,90);
  assertEquals(new Set(b.map(m=>m.division_fiks_id)),new Set(['205410']));
  assertThrows(()=>parseExcel(calendar(10),'205403',config),SourceUnavailableError);
});
Deno.test('Division both calendars validate before a single composite-key upsert', async () => {
  let writes = 0;
  const db = { from: (table: string) => ({ upsert: async (rows: any, options: any) => {
    if (table==='division_matches') { writes++; assertEquals(rows.length,222);
      assertEquals(options.onConflict,'division_fiks_id,fiks_id');
      assertEquals(new Set(rows.map((r:any)=>r.division_fiks_id)),new Set(['205403','205410'])); }
    return {error:null};
  } }) };
  const response = await createHandler({ config, env:()=> 'test', createClient:()=>db,auth:async()=>null,
    load:async (id:string)=>parseExcel(calendar(id==='205403'?12:10),id,config) })(new Request('https://test'));
  assertEquals(response.status,200); assertEquals((await response.json()).upserted,222); assertEquals(writes,1);
});
Deno.test('Division B source failure causes no writes and 2xx source_unavailable', async () => {
  let writes=0;
  const response=await createHandler({ config,env:()=> 'test',createClient:()=>({from:(table:string)=>({upsert:async()=>{if(table==='division_matches')writes++;return{error:null};}})}),
    auth:async()=>null,load:async(id:string)=>{if(id==='205410')throw new SourceUnavailableError('B offline');return parseExcel(calendar(12),id,config);}})(new Request('https://test'));
  assertEquals(response.status,200);assertEquals((await response.json()).source_unavailable,true);assertEquals(writes,0);
});
Deno.test('Division internal DB error remains 500 with useful sync_status',async()=>{
  const statuses:any[]=[];
  const response=await createHandler({ config,env:()=> 'test',createClient:()=>({from:(table:string)=>({upsert:async(row:any)=>{
    if(table==='division_matches')return{error:{code:'XX000',message:'database broken'}};
    statuses.push(row);return{error:null};}})}),auth:async()=>null,load:async(id:string)=>parseExcel(calendar(id==='205403'?12:10),id,config)})(new Request('https://test'));
  assertEquals(response.status,500);await response.text();assertEquals(statuses[0].last_error,'database broken');
  assertEquals('last_success_at' in statuses[0],false);
});
