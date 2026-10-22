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
 return {rows,calls,fail:()=>{githubFailed=true;},secret:(body:any,secret='local-only')=>handler(new Request('https://local.invalid',{method:'POST',headers:{'x-sync-secret':secret},body:JSON.stringify(body)})),call:(body:any)=>handler(new Request('https://local.invalid',{method:'POST',headers:{Authorization:'Bearer local-only'},body:JSON.stringify(body)}))};
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
const discovered={...config,teams:[{...config.teams[0],tournament_id:'310001',league:'4. div. menn avd. 02'},{...config.teams[1],tournament_id:'310002'}]};
test('GitHub discovery with sync secret saves derived 2027 config, publishes manifest and activates',async()=>{
 const h=harness();const r=await h.secret({action:'discover',config:discovered});
 assert.equal(r.status,200);assert.equal((await r.json()).activated,true);
 const row=h.rows.find(x=>x.season===2027);assert.equal(row.config_source,'discovered');assert.equal(row.teams[0].expected_teams,14);assert.equal(row.teams[1].expected_teams,12);
 assert.deepEqual(h.rows.filter(x=>x.is_active).map(x=>x.season),[2027]);
 assert.deepEqual(h.calls,['save','read','publish','read','activate']);
});
test('discovery is a no-op once the season is active',async()=>{
 const h=harness();await h.secret({action:'discover',config:discovered});const before=h.calls.length;
 assert.equal((await (await h.secret({action:'discover',config:discovered})).json()).noop,'already_active');assert.equal(h.calls.length,before);
});
test('discovery never overrides a manual draft; manual save+activate still works',async()=>{
 const h=harness();await h.call({action:'save',config});
 assert.equal((await (await h.secret({action:'discover',config:discovered})).json()).noop,'manual_draft');
 assert.equal(h.rows.find(x=>x.season===2027).teams[0].tournament_id,'300001');assert.equal(h.calls.includes('activate'),false);
 assert.equal((await h.call({action:'activate',season:2027})).status,200);assert.deepEqual(h.rows.filter(x=>x.is_active).map(x=>x.season),[2027]);
});
test('discovery rejects wrong secret, wrong team IDs and admin-only actions via secret',async()=>{
 const h=harness();
 assert.equal((await h.secret({action:'discover',config:discovered},'wrong')).status,401);
 assert.equal((await h.secret({action:'discover',config:{...discovered,teams:[{...discovered.teams[0],team_id:'999'},discovered.teams[1]]}})).status,400);
 assert.equal((await h.secret({action:'activate',season:2027})).status,400);
 assert.deepEqual(h.calls,[]);assert.deepEqual(h.rows.filter(x=>x.is_active).map(x=>x.season),[2026]);
});
test('discovery GitHub failure is an internal error and keeps 2026 active',async()=>{
 const h=harness();h.fail();assert.equal((await h.secret({action:'discover',config:discovered})).status,500);
 assert.deepEqual(h.rows.filter(x=>x.is_active).map(x=>x.season),[2026]);assert.equal(h.calls.includes('activate'),false);
});
