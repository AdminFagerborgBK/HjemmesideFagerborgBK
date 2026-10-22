import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { transpileModule, ModuleKind } from 'typescript';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { z } from 'zod';
import { issueNewsletterToken, verifyNewsletterToken } from '../../supabase/functions/_shared/newsletterToken.mjs';
import { deliverRecorded } from '../../supabase/functions/send-newsletter/delivery.mjs';
import { deliveryOutcome, assertTestRecipient } from '../../supabase/functions/send-newsletter/policy';
import { providerFailure } from '../../supabase/functions/_shared/providerFailure';

// Run with `bun test scripts/sports-tests/newsletter-handler.test.ts`.
// Executes the actual HTTP handlers with ONLY in-memory dependencies.
// Never read process.env, create a real client, or call the real fetch function.
const signingKey = 'local-harness-not-a-production-credential';
const memberId = '00000000-0000-4000-8000-000000000001';
const admin = {id:'local-admin',email:'admin@example.test'};
let state: ReturnType<typeof initialState>;
function initialState() {
  return {
    memberships:[{id:memberId,email:'member@example.test',first_name:'Test',status:'active',newsletter_opt_out:false,interests:['kamper']}],
    newsletters:[{id:'campaign-test',subject:'Controlled test',body_html:'<p>Test</p>',status:'draft',delivery_state:'idle'}],
    newsletter_recipients:[] as Record<string,unknown>[], activity_log:[] as Record<string,unknown>[],
  };
}
let messages: {to:string[];html:string}[] = [];
let rejectProvider = false;
let auditFailure = false;
let authorized = true;
function client() {
  return {
    auth:{getUser:async()=>({data:{user:authorized?admin:null}})},
    rpc:async()=>({data:true}),
    from:(table:keyof ReturnType<typeof initialState>)=>{
      let filters: ((row:any)=>boolean)[]=[];
      let mutation:Record<string,unknown>|null=null,insert:Record<string,unknown>|null=null,single=false;
      const q:any={
        select:()=>q,eq:(k:string,v:unknown)=>{filters.push(r=>r[k]===v);return q;},
        in:(k:string,v:unknown[])=>{filters.push(r=>v.includes(r[k]));return q;},
        overlaps:(k:string,v:unknown[])=>{filters.push(r=>r[k]?.some((x:unknown)=>v.includes(x)));return q;},
        update:(value:Record<string,unknown>)=>{mutation=value;return q;},
        insert:(value:Record<string,unknown>)=>{insert=value;return q;},
        single:()=>{single=true;return q;},maybeSingle:()=>{single=true;return q;},
        then:(resolveValue:any,rejectValue:any)=>Promise.resolve().then(()=>{
          if(table==='activity_log'&&auditFailure)return {data:null,error:{code:'audit_down'}};
          const rows:any[]=state[table];
          if(insert){const row={id:`intent-${rows.length}`, ...insert};rows.push(row);return {data:single?row:[row],error:null};}
          const found=rows.filter(row=>filters.every(f=>f(row)));
          if(mutation)for(const row of found)Object.assign(row,mutation);
          return {data:single?found[0]??null:found,error:null};
        }).then(resolveValue,rejectValue),
      };return q;
    },
  };
}
function loadHandler(path:string) {
  let handler:(req:Request)=>Promise<Response> = async()=>new Response(null,{status:500});
  const source=readFileSync(resolve(path),'utf8');
  const js=transpileModule(source,{compilerOptions:{module:ModuleKind.CommonJS,target:99}}).outputText;
  const requireLocal=(name:string)=>{
    if(name.includes('/http/server.ts'))return {serve:(fn:typeof handler)=>{handler=fn;}};
    if(name.includes('supabase-js'))return {createClient:client};
    if(name.endsWith('/policy.ts'))return name==='./policy.ts'&&path.includes('send-newsletter')?{deliveryOutcome,assertTestRecipient}:{PreferenceUpdate:z.object({newsletter_opt_out:z.boolean(),interests:z.array(z.enum(['kamper','ungdom','dugnad','arrangementer','sponsor'])).max(5).optional()})};
    if(name.endsWith('newsletterToken.mjs'))return {issueNewsletterToken,verifyNewsletterToken};
    if(name.endsWith('delivery.mjs'))return {deliverRecorded};
    if(name.endsWith('providerFailure.ts'))return {providerFailure};
    throw new Error('Unmocked import blocked');
  };
  const fakeFetch=async(_url:string,options:any)=>{
    const body=JSON.parse(options.body);messages.push({to:body.to,html:body.html});
    // Deliberately credential-like provider body must never escape the handler.
    return rejectProvider?new Response(JSON.stringify({error:'private-provider-body'}),{status:403}):Response.json({id:'local-provider-id'});
  };
  const fakeEnv={get:(name:string)=>name==='SUPABASE_SERVICE_ROLE_KEY'?signingKey:name==='SUPABASE_URL'?'https://local.invalid': 'local-only'};
  new Function('require','exports','Deno','fetch','console',js)(requireLocal,{}, {env:fakeEnv},fakeFetch,{error:()=>{}});
  return (body:unknown)=>handler(new Request('https://local.invalid',{method:'POST',headers:{Authorization:'Bearer local-only','Content-Type':'application/json'},body:JSON.stringify(body)}));
}

test('actual newsletter HTTP flow uses signed own-member preferences, opts out and rejects malformed resubscription',async()=>{
  state=initialState();messages=[];rejectProvider=false;auditFailure=false;
  const send=loadHandler('supabase/functions/send-newsletter/index.ts');
  const preferences=loadHandler('supabase/functions/newsletter-preferences/index.ts');
  assert.equal((await send({newsletter_id:'campaign-test'})).status,200);
  assert.deepEqual(messages.map(m=>m.to),[['member@example.test']]);
  assert.equal(state.newsletter_recipients[0].status,'sent');
  const token=messages[0].html.match(/#token=([^"<]+)/)?.[1];
  assert.equal(await verifyNewsletterToken(token,signingKey),memberId);
  assert.equal((await preferences({action:'get',token})).status,200);
  auditFailure=true;
  assert.equal((await preferences({action:'update',token,newsletter_opt_out:true,interests:['kamper']})).status,200);
  assert.equal(state.memberships[0].newsletter_opt_out,true);
  assert.equal((await preferences({action:'update',token})).status,400);
  assert.equal(state.memberships[0].newsletter_opt_out,true);
  const count=await (await send({count_only:true})).json();assert.equal(count.count,0);
  assert.equal((await send({newsletter_id:'campaign-test'})).status,500);
  assert.equal(messages.length,1);
});
test('actual test send is isolated to admin and does not present unsigned preference links',async()=>{
  state=initialState();messages=[];auditFailure=false;rejectProvider=false;
  const send=loadHandler('supabase/functions/send-newsletter/index.ts');
  assert.equal((await send({newsletter_id:'campaign-test',test_send:true})).status,200);
  assert.deepEqual(messages[0].to,['admin@example.test']);
  assert.equal(messages[0].html.includes('href='),false);
  assert.equal(state.newsletters[0].delivery_state,'idle');
  assert.equal(state.newsletter_recipients.length,0);
});
test('provider rejection is partial, sanitized and never replayed; unauthorized requests cannot send',async()=>{
  state=initialState();messages=[];rejectProvider=true;
  const send=loadHandler('supabase/functions/send-newsletter/index.ts');
  const result=await send({newsletter_id:'campaign-test'});
  assert.equal(result.status,502);
  assert.equal((await result.text()).includes('private-provider-body'),false);
  assert.equal(state.newsletters[0].delivery_state,'partial');
  assert.equal(String(state.newsletter_recipients[0].error).includes('private-provider-body'),false);
  assert.equal((await send({newsletter_id:'campaign-test'})).status,500);
  authorized=false;
  assert.equal((await send({newsletter_id:'campaign-test',test_send:true})).status,500);
  authorized=true;rejectProvider=false;
  assert.equal(messages.length,1);
});