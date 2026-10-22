import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { z } from 'npm:zod@3.25.76';
import { assertManifest, readSportsSeason, validateSportsSeason } from '../_shared/sportsSeason.ts';
import { activateSeason } from '../_shared/seasonActivation.ts';

const json = (body: unknown, status=200) => new Response(JSON.stringify(body), {status,headers:{...corsHeaders,'Content-Type':'application/json'}});
const schema=z.discriminatedUnion('action',[
  z.object({action:z.literal('save'),config:z.unknown()}),
  z.object({action:z.literal('activate'),season:z.number().int().min(2000).max(2200)}),
  z.object({action:z.literal('check')}),
  z.object({action:z.literal('discover'),config:z.unknown()}),
]);
const STABLE_TEAM_IDS:Record<string,string>={'A-laget':'311','B-laget':'6458'};
const sameSecret=async(a:string,b:string)=>{
  const h=async(v:string)=>new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(v)));
  const [x,y]=await Promise.all([h(a),h(b)]);let d=0;for(let i=0;i<x.length;i++)d|=x[i]^y[i];return d===0;
};
const path='/repos/AdminFagerborgBK/HjemmesideFagerborgBK/contents/public/sports-season.json';

Deno.serve(async req=>{
  if(req.method==='OPTIONS') return new Response('ok',{headers:corsHeaders});
  if(req.method!=='POST') return json({error:'Method not allowed'},405);
  try {
    const url=Deno.env.get('SUPABASE_URL'),anon=Deno.env.get('SUPABASE_ANON_KEY'),service=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if(!url||!anon||!service) return json({error:'Sesongtjenesten er ikke konfigurert'},500);
    const syncSecret=req.headers.get('x-sync-secret'),expectedSecret=Deno.env.get('MATCHES_SYNC_SECRET');
    let body;
    if(syncSecret) {
      if(!expectedSecret||!(await sameSecret(syncSecret,expectedSecret))) return json({error:'Innlogging kreves'},401);
      body=schema.safeParse(await req.json());
      if(!body.success||body.data.action!=='discover') return json({error:'Ugyldige sesonginnstillinger'},400);
    } else {
      const authorization=req.headers.get('authorization');
      if(!authorization?.startsWith('Bearer ')) return json({error:'Innlogging kreves'},401);
      const client=createClient(url,anon,{global:{headers:{Authorization:authorization}}});
      const {data:{user},error:userError}=await client.auth.getUser(authorization.slice(7));
      if(userError||!user) return json({error:'Innlogging kreves'},401);
      const {data:admin,error:roleError}=await client.rpc('is_admin',{_user_id:user.id});
      if(roleError||admin!==true) return json({error:'Administrator kreves'},403);
      body=schema.safeParse(await req.json());
      if(!body.success||body.data.action==='discover') return json({error:'Ugyldige sesonginnstillinger'},400);
    }
    const db=createClient(url,service);
    if(body.data.action==='save') {
      let config;
      try {config=validateSportsSeason(body.data.config);} catch {return json({error:'Kontroller sesong, begge lag, turnerings-ID, lag-ID og antall lag'},400);}
      const {data:existing,error:readError}=await db.from('sports_seasons').select('is_active').eq('season',config.season).maybeSingle();
      if(readError) throw readError;
      if(existing?.is_active) return json({error:'Aktiv sesong kan ikke redigeres her; opprett neste sesong'},409);
      const {error}=await db.from('sports_seasons').upsert({...config,is_active:false,config_source:'manual'},{onConflict:'season'});
      if(error) throw error;
      return json({saved:true,season:config.season});
    }
    if(body.data.action==='discover') {
      let found;
      try {found=validateSportsSeason(body.data.config);} catch {return json({error:'Ugyldig oppdaget sesong'},400);}
      if(found.teams.some(t=>STABLE_TEAM_IDS[t.team]!==t.team_id)) return json({error:'Oppdaget sesong har feil lag-ID'},400);
      const active=await readSportsSeason(db);
      if(found.season<=active.season) return json({activated:false,noop:'already_active',season:active.season});
      if(found.season!==active.season+1) return json({error:'Oppdaget sesong er ikke neste sesong'},409);
      const {data:existing,error:readError}=await db.from('sports_seasons').select('config_source').eq('season',found.season).maybeSingle();
      if(readError) throw readError;
      // A manual draft is an admin override: discovery never replaces it.
      if(existing&&existing.config_source!=='discovered') return json({activated:false,noop:'manual_draft',season:found.season});
      const {error}=await db.from('sports_seasons').upsert({season:found.season,timezone:found.timezone,teams:found.teams,is_active:false,config_source:'discovered'},{onConflict:'season'});
      if(error) throw error;
    }
    const config=await readSportsSeason(db,body.data.action==='activate'||body.data.action==='discover'?(body.data.action==='activate'?body.data.season:validateSportsSeason(body.data.config).season):undefined);
    const key=Deno.env.get('GITHUB_API_KEY'),lovableKey=Deno.env.get('LOVABLE_API_KEY');
    if(!key||!lovableKey) return json({error:'GitHub-tilkoblingen mangler; sesongen er ikke aktivert'},503);
    const gateway=async(method:string,body?:unknown)=>{
      const response=await fetch(`https://connector-gateway.lovable.dev/github${path}${method==='GET'?'?ref=main':''}`,{method,headers:{Authorization:`Bearer ${lovableKey}`,'X-Connection-Api-Key':key,Accept:'application/vnd.github+json','Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});
      if(!response.ok) throw new Error(`GitHub manifest request failed (${response.status})`);
      return response.json();
    };
    const decode=(encoded:string)=>new TextDecoder().decode(Uint8Array.from(atob(encoded.replace(/\s/g,'')),c=>c.charCodeAt(0)));
    if(body.data.action==='check') {
      assertManifest(config,JSON.parse(decode((await gateway('GET')).content)));
      return json({verified:true,season:config.season});
    }
    await activateSeason(config,{
      publish:async value=>{
        const current=await gateway('GET');
        const bytes=new TextEncoder().encode(JSON.stringify(value,null,2)+'\n');
        const content=btoa(Array.from(bytes,b=>String.fromCharCode(b)).join(''));
        await gateway('PUT',{message:`Configure sports season ${value.season}`,branch:'main',sha:current.sha,content});
      },
      read:async()=>JSON.parse(decode((await gateway('GET')).content)),
      activate:async season=>{const {error}=await db.rpc('activate_sports_season',{p_season:season});if(error)throw error;},
    });
    return json({activated:true,season:config.season});
  } catch(error) {
    console.error('Sports season settings failed:', error instanceof Error?error.message:'Internal error');
    return json({error:'Sesongen ble ikke aktivert. Kontroller GitHub og lagrede sesonginnstillinger før nytt forsøk.'},500);
  }
});