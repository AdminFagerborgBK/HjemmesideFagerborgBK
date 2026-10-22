import { readFileSync } from 'node:fs';
import { transpileModule, ModuleKind } from 'typescript';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { z } from 'zod';
import * as seasonModule from '../../supabase/functions/_shared/sportsSeason';
import { activateSeason } from '../../supabase/functions/_shared/seasonActivation';
const config=seasonModule.validateSportsSeason({season:2027,timezone:'Europe/Oslo',teams:[
 {team:'A-laget',tournament_id:'300001',team_id:'311',expected_teams:14,league:'4. divisjon',club_name:'Fagerborg'},
 {team:'B-laget',tournament_id:'300002',team_id:'6458',expected_teams:12,league:'6. divisjon',club_name:'Fagerborg 2'},
]});
// Actual handler, in-memory DB and GitHub only; no real credentials or network.
function harness(admin=true){
 const rows:any[]=[{...config,season:2026,is_active:true}];
 let manifest:any={...config,season:2026}, githubFailed=false;
 const calls:string[]=[];
 const client=()=>({auth:{getUser:async()=>({data:{user:{id:'local-admin'}},error:null})},rpc:async(name:string,args:any)=>{
  if(name==='is_admin')return {data:admin,error:null};
  calls.push('activate');rows.forEach(r=>{r.is_active=r.season===args.p_season;});return {error:null};
 },from:()=>{
  let filters:((r:any)=>boolean)[]=[],value:any;
  const q:any={select:()=>q,eq:(key:string,v:any)=>{filters.push(r=>r[key]===v);return q;},single:()=>q,maybeSingle:()=>q,upsert:(v:any)=>{value=v;return q;},then:(yes:any,no:any)=>Promise.resolve().then(()=>{
   if(value){calls.push('save');const found=rows.find(r=>r.season===value.season);if(found)Object.assign(found,value);else rows.push(value);return {error:null};}
   return {data:rows.find(r=>filters.every(f=>f(r)))??null,error:null};
  }).then(yes,no)};return q;
 }});
 let handler:any;
 const source=transpileModule(readFileSync('supabase/functions/sports-season-settings/index.ts','utf8'),{compilerOptions:{module:ModuleKind.CommonJS,target:99}}).outputText;
 const local=(name:string)=>{
  if(name.endsWith('/cors'))return {corsHeaders:{'Access-Control-Allow-Origin':'*'}};
  if(name.includes('supabase-js'))return {createClient:client};
  if(name.includes('zod'))return {z};
  if(name.includes('sportsSeason'))return seasonModule;
  if(name.includes('seasonActivation'))return {activateSeason};
  throw new Error('Unmocked import blocked');
 };
 new Function('require','exports','Deno','fetch','console',source)(local,{}, {serve:(fn:any)=>{handler=fn;},env:{get:()=> 'local-only'}},async(_url:string,options:any)=>{
  if(githubFailed)return new Response('{}',{status:403});
  if(options.method==='PUT'){calls.push('publish');manifest=JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(JSON.parse(options.body).content),c=>c.charCodeAt(0))));return Response.json({});}
  calls.push('read');return Response.json({sha:'local-sha',content:btoa(JSON.stringify(manifest))});
 },{error:()=>{}});
 return {rows,calls,fail:()=>{githubFailed=true;},call:(body:any)=>handler(new Request('https://local.invalid',{method:'POST',headers:{Authorization:'Bearer local-only'},body:JSON.stringify(body)}))};
}
test('actual settings saves 2027, reads it back, publishes/verifies manifest then activates',async()=>{
 const h=harness();assert.equal((await h.call({action:'save',config})).status,200);
 assert.equal(h.rows.find(r=>r.season===2027).is_active,false);
 assert.equal((await h.call({action:'activate',season:2027})).status,200);
 assert.deepEqual(h.rows.filter(r=>r.is_active).map(r=>r.season),[2027]);
 assert.deepEqual(h.calls,['save','read','publish','read','activate']);
});
test('actual read-only check verifies manifest without writes or activation',async()=>{
 const h=harness();assert.deepEqual(await (await h.call({action:'check'})).json(),{verified:true,season:2026});
 assert.deepEqual(h.calls,['read']);assert.deepEqual(h.rows.filter(r=>r.is_active).map(r=>r.season),[2026]);
});
test('actual activation GitHub rejection leaves prior season active',async()=>{
 const h=harness();await h.call({action:'save',config});h.fail();
 assert.equal((await h.call({action:'activate',season:2027})).status,500);
 assert.deepEqual(h.rows.filter(r=>r.is_active).map(r=>r.season),[2026]);
 assert.equal(h.calls.includes('activate'),false);
});
test('non-admin and malformed config cannot save or activate seasons',async()=>{
 const h=harness(false);assert.equal((await h.call({action:'save',config})).status,403);assert.deepEqual(h.calls,[]);
 const allowed=harness();assert.equal((await allowed.call({action:'save',config:{...config,teams:[]}})).status,400);assert.deepEqual(allowed.calls,[]);
});