import { readFileSync } from 'node:fs';
import { transpileModule, ModuleKind } from 'typescript';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { z } from 'zod';
import { readSportsSeason, teamConfig } from '../../supabase/functions/_shared/sportsSeason';
import { osloWallTimeToIso } from '../../supabase/functions/_shared/osloWallTime.mjs';
import * as logic from '../../supabase/functions/goal-club-season-close/logic';
// Actual HTTP handlers with in-memory state. No environment reads or network access.
const teams=[{team:'A-laget',tournament_id:'205403',team_id:'311',expected_teams:12,league:'5. divisjon avd. 01',club_name:'Fagerborg'},{team:'B-laget',tournament_id:'205410',team_id:'6458',expected_teams:10,league:'7. divisjon avd. 02',club_name:'Fagerborg 2'}];
let state:any, filtersSeen:any[],writes:number,mail:number;
function reset(){state={sports_seasons:[{season:2026,is_active:false,timezone:'Europe/Oslo',teams},{season:2027,is_active:true,timezone:'Europe/Oslo',teams}],goal_club_entries:[{id:'old',name:'2026 member',email:'old@example.test',season:2026,amount_per_goal:10,goal_guess:79,deleted_at:null},{id:'new',name:'2027 member',email:'new@example.test',season:2027,amount_per_goal:20,goal_guess:80,deleted_at:null}],goal_club_season_closures:[],matches:[],standings:[]};filtersSeen=[];writes=0;mail=0;}
function client(){return {from:(table:string)=>{
 let filters:((r:any)=>boolean)[]=[],single=false,insert:any;
 const q:any={select:()=>q,eq:(key:string,value:any)=>{filtersSeen.push([table,key,value]);filters.push(r=>r[key]===value);return q;},is:(k:string,v:any)=>{filters.push(r=>r[k]===v);return q;},order:()=>q,gte:()=>q,lt:()=>q,single:()=>{single=true;return q;},maybeSingle:()=>{single=true;return q;},insert:(row:any)=>{insert=row;return q;},then:(yes:any,no:any)=>Promise.resolve().then(()=>{
  if(insert){writes++;const row={...insert,id:'signup'};state[table].push(row);return {data:single?row:[row],error:null};}
  const rows=state[table].filter((r:any)=>filters.every(f=>f(r)));return {data:single?rows[0]??null:rows,error:null};
 }).then(yes,no)};return q;
}};}
function load(path:string){
 let handler:any;
 const js=transpileModule(readFileSync(path,'utf8'),{compilerOptions:{module:ModuleKind.CommonJS,target:99}}).outputText;
 const local=(name:string)=>{
  if(name.includes('supabase-js'))return {createClient:client};
  if(name.includes('zod'))return {z};
  if(name.includes('sportsSeason'))return {readSportsSeason,teamConfig};
  if(name.includes('osloWallTime'))return {osloWallTimeToIso};
  if(name.includes('adminAuth'))return {requireAdminOrSecret:async()=>null,htmlEscape:(s:any)=>String(s)};
  if(name==='./logic.ts')return logic;
  if(name.includes('providerFailure'))return {providerFailure:()=>({})};
  throw new Error('Unmocked import blocked: '+name);
 };
 class JanuaryClock extends Date {constructor(value?:any){super(value??'2028-01-15T12:00:00Z');}}
 new Function('require','exports','Deno','fetch','console','Date',js)(local,{}, {serve:(fn:any)=>{handler=fn;},env:{get:(name:string)=>name==='RESEND_API_KEY'?undefined:'local-test'}},async()=>{mail++;throw new Error('Network disabled');},{log:()=>{},error:()=>{}},JanuaryClock);
 return (body:any)=>handler(new Request('https://test.invalid',{method:'POST',body:JSON.stringify(body)}));
}
test('actual signup stores explicitly active 2027 season',async()=>{
 reset();const signup=load('supabase/functions/goal-club-signup/index.ts');
 const response=await signup({name:'New Player',email:'player@example.test',amount_per_goal:10,goal_guess:79});
 assert.equal(response.status,200);assert.equal(state.goal_club_entries.at(-1).season,2027);assert.equal(mail,0);
});
test('actual preview switches seasons without mixing members, invoices or email',async()=>{
 reset();const handler=load('supabase/functions/goal-club-season-close/index.ts');
 for(const season of [2026,2027]){
  const result=await (await handler({preview:true,season})).json();
  assert.equal(result.season,season);assert.deepEqual(result.entries.map((e:any)=>e.id),[season===2026?'old':'new']);
 }
 assert.equal(writes,0);assert.equal(mail,0);
});
test('January rerun uses explicit prior 2026 config rather than clock or active 2027',async()=>{
 reset();const handler=load('supabase/functions/goal-club-season-close/index.ts');
 const result=await (await handler({season:2026})).json();
 assert.equal(result.season,2026);assert.equal(result.status,'season_not_finished');
 assert.ok(filtersSeen.some(([table,key,value])=>table==='standings'&&key==='season'&&value==='2026'));
 assert.equal(writes,0);assert.equal(mail,0);
});