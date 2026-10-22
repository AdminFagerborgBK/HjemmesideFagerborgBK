import { createClient } from 'npm:@supabase/supabase-js@2.112.4';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { z } from 'npm:zod@3.25.76';
import { paymentPlan, canSendPackage, assertPlayerAccess } from './policy.ts';
import { welcomeHtml } from './welcome.ts';

const applicationSchema = z.object({full_name:z.string().trim().min(2).max(200),birth_date:z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(v=>!Number.isNaN(Date.parse(v)) && v<new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Oslo'}).format(new Date()) && v>'1900-01-01','Ugyldig fødselsdato'),email:z.string().trim().email().max(255).transform(v=>v.toLowerCase()),phone:z.string().trim().min(5).max(50),previous_club:z.string().trim().max(300).default(''),payment_choice:z.enum(['annual','quarterly','monthly'])});
const configSchema=z.object({groups:z.object({'A-laget':z.string().url(),'B-laget':z.string().url()}),transfer_url:z.string().url(),transfer_contact:z.string().trim().min(1).max(100),transfer_email:z.string().email(),membership_ore:z.number().int().nonnegative().nullable(),training_ore_a:z.number().int().nonnegative().nullable(),training_ore_b:z.number().int().nonnegative().nullable(),membership_due:z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),first_training_due:z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),payment_channel:z.enum(['Spond','Bank etter avtale']),fees_confirmed:z.boolean(),legal_reviewed:z.boolean()});
const httpsUrl=(value:string,host?:string)=>{const u=new URL(value);if(u.protocol!=='https:' || (host && u.hostname!==host)) throw new Error('Ugyldig sikker lenke');return value;};
const sha=async (v:string)=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(v)))).map(n=>n.toString(16).padStart(2,'0')).join('');
const json=(data:unknown,status=200)=>new Response(JSON.stringify(data),{status,headers:{...corsHeaders,'Content-Type':'application/json','Cache-Control':'no-store'}});
const check=(result:any)=>{if(result.error) throw new Error(result.error.message);return result.data;};
Deno.serve(async(req)=>{
  if(req.method==='OPTIONS') return new Response('ok',{headers:corsHeaders});
  if(req.method!=='POST') return json({error:'Method not allowed'},405);
  try {
    const url=Deno.env.get('SUPABASE_URL'),key=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'),anon=Deno.env.get('SUPABASE_ANON_KEY');
    if(!url||!key||!anon) return json({error:'Tjenesten er ikke konfigurert'},500);
    const db=createClient(url,key);
    const body=await req.json();
    let action=z.enum(['apply','prefill','list','settings','save_settings','upload_document','create_agreement','approve','reject','invite','resend','preview','test_email','test_link','player','confirm','verify','update_application','events']).parse(body.action);
    const bearer=req.headers.get('Authorization')?.replace(/^Bearer /,'');
    const {data:auth}=bearer ? await createClient(url,anon).auth.getUser(bearer) : {data:{user:null}};
    const user=auth.user;
    const admin=user ? check(await db.rpc('is_admin',{_user_id:user.id}))===true : false;
    const getSettings=async()=>check(await db.from('player_enrollment_settings').select('*').eq('id',1).single());
    const getApp=async(id:string)=>{const a=check(await db.from('player_applications').select('*').eq('id',z.string().uuid().parse(id)).is('deleted_at',null).single());return a;};
    const event=async(id:string,kind:string,details:unknown={})=>check(await db.from('player_onboarding_events').insert({application_id:id,actor_id:user?.id,event:kind,details}));
    const signing=async(path:string)=>check(await db.storage.from('player-documents').createSignedUrl(path,600)).signedUrl;
    const publicApp=(a:any)=>{const {notes,approved_by,spond_verified_by,eligibility_verified_by,payment_verified_by,is_test,...safe}=a;return safe;};
    if(action==='apply') {
      if(body.website) return json({status:'pending'});
      const a=applicationSchema.parse(body.application);
      const token=z.string().min(1).max(3000).parse(body.turnstile_token);
      const secret=Deno.env.get('TURNSTILE_SECRET_KEY');
      if(!secret) return json({error:'Captcha er ikke konfigurert'},503);
      const verification=await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify',{method:'POST',body:new URLSearchParams({secret,response:token})});
      const result=await verification.json();
      if(!result.success) return json({error:'Captcha-verifisering feilet'},400);
      const inserted=await db.from('player_applications').insert({...a,user_id:user?.email?.toLowerCase()===a.email?user.id:null});
      if(inserted.error && inserted.error.code!=='23505') throw new Error(inserted.error.message);
      return json({status:'pending'});
    }
    if(action==='prefill') {
      if(!user) return json({});
      const a=check(await db.from('player_applications').select('full_name,birth_date,email,phone,previous_club,payment_choice').eq('user_id',user.id).is('deleted_at',null).order('created_at',{ascending:false}).limit(1));
      if(a[0]) return json(a[0]);
      const member=check(await db.from('memberships').select('first_name,last_name,email,phone,birth_date').eq('email',user.email||'').limit(1));
      return json(member[0]?{full_name:`${member[0].first_name} ${member[0].last_name}`.trim(),email:user.email,phone:member[0].phone,birth_date:member[0].birth_date}:{email:user.email});
    }
    if(action==='player'||action==='confirm') {
      let inv:any=null;
      if(body.token) {
        const token=z.string().regex(/^[a-f0-9]{64}$/).parse(body.token);
        inv=check(await db.from('player_invitations').select('*').eq('token_hash',await sha(token)).is('revoked_at',null).gt('expires_at',new Date().toISOString()).maybeSingle());
      } else {
        // Automatic lookup: either a verified club login, or the player portal server vouching for its own verified login via shared key.
        const portalKey=Deno.env.get('PLAYER_PORTAL_SHARED_KEY');
        const sentKey=req.headers.get('x-portal-key')||'';
        const portalOk=!!portalKey && portalKey.length>=32 && sentKey.length===portalKey.length && (await sha(sentKey))===(await sha(portalKey));
        if(sentKey && !portalOk) return json({error:'Ugyldig portalnøkkel'},401);
        const email=portalOk ? z.string().email().max(320).parse(body.player_email).toLowerCase() : user?.email?.toLowerCase();
        if(!portalOk && (!user||!email||!user.email_confirmed_at)) return json({error:'Logg inn med bekreftet e-postadresse'},401);
        const apps=check(await db.from('player_applications').select('id').eq('email',email).eq('status','approved').eq('is_test',false).is('deleted_at',null).order('created_at',{ascending:false}).limit(1));
        if(!apps[0]) return json({error:'Fant ingen godkjent spilleravtale for denne e-postadressen',code:'no_application'},404);
        inv=check(await db.from('player_invitations').select('*').eq('application_id',apps[0].id).is('revoked_at',null).gt('expires_at',new Date().toISOString()).order('created_at',{ascending:false}).limit(1).maybeSingle());
      }
      if(!inv) return json({error:'Invitasjonen er ugyldig eller utløpt'},401);
      const a=await getApp(inv.application_id);
      assertPlayerAccess(a.status,!!inv);
      const agreement=check(await db.from('player_agreements').select('id,version,season,body,pdf_path,status').eq('id',inv.agreement_id).single());
      if(action==='confirm') {
        if(a.is_test) return json({error:'Testutkast kan ikke bekreftes som gyldig avtale'},400);
        const task=z.enum(['agreement','payment','spond','transfer','details']).parse(body.task);
        const stamp=new Date().toISOString();
        let updates:any={updated_at:stamp};
        if(task==='agreement') {
          if(body.confirmed!==true || body.version!==agreement.version || agreement.status!=='ready') return json({error:'Bekreft gjeldende avtale uttrykkelig'},400);
          if(!a.agreement_confirmed_at) updates={...updates,agreement_confirmed_at:stamp,agreement_identity:{application_id:a.id,full_name:a.full_name,email:a.email,invitation_id:inv.id,user_id:user?.id||null,method:'personal_invitation_explicit_acceptance'}};
        }
        if(task==='payment') {if(body.confirmed!==true || !inv.snapshot.payment) return json({error:'Betalingsplan må være avklart'},400);if(!a.payment_confirmed_at)updates.payment_confirmed_at=stamp;}
        if(task==='spond') updates.spond_self_confirmed_at=body.confirmed===true?stamp:null;
        if(task==='transfer') updates.transfer_self_confirmed_at=body.confirmed===true?stamp:null;
        if(task==='details') {const details=z.object({full_name:z.string().trim().min(2).max(200),phone:z.string().trim().min(5).max(50),previous_club:z.string().trim().max(300)}).parse(body.details);if(a.agreement_confirmed_at && details.full_name!==a.full_name) return json({error:'Kontakt admin for navneendring etter avtalebekreftelse'},400);updates={...updates,...details};}
        check(await db.from('player_applications').update(updates).eq('id',a.id));await event(a.id,`player_${task}_confirmation`,{invitation_id:inv.id,confirmed:body.confirmed});
      }
      return json({application:publicApp(await getApp(a.id)),snapshot:inv.snapshot,agreement:{...agreement,pdf_url:await signing(agreement.pdf_path)},test:a.is_test});
    }
    if(!admin||!user) return json({error:'Kun administrator kan gjøre dette'},401);
    if(action==='settings') return json({settings:await getSettings(),agreements:check(await db.from('player_agreements').select('*').is('deleted_at',null).order('created_at',{ascending:false}))});
    if(action==='save_settings') {
      const settings=configSchema.parse(body.settings);
      Object.values(settings.groups).forEach(v=>httpsUrl(v,'spond.com'));httpsUrl(settings.transfer_url);
      if(settings.fees_confirmed && [settings.membership_ore,settings.training_ore_a,settings.training_ore_b,settings.membership_due,settings.first_training_due].some(v=>v===null)) return json({error:'Oppgi alle beløp og datoer før vedtak bekreftes'},400);
      check(await db.from('player_enrollment_settings').update({...settings,updated_by:user.id,updated_at:new Date().toISOString()}).eq('id',1));return json({success:true});
    }
    if(action==='upload_document') {
      const payload=z.object({filename:z.string().regex(/^[a-zA-Z0-9_-]+\.pdf$/).max(150),content:z.string().min(1).max(14000000)}).parse(body);
      const bytes=Uint8Array.from(atob(payload.content),c=>c.charCodeAt(0));
      if(bytes.length>10000000||new TextDecoder().decode(bytes.slice(0,5))!=='%PDF-') return json({error:'Kun gyldige PDF-filer under 10 MB'},400);
      const path=`agreements/${crypto.randomUUID()}-${payload.filename}`;
      check(await db.storage.from('player-documents').upload(path,bytes,{contentType:'application/pdf',upsert:false}));return json({path});
    }
    if(action==='create_agreement') {
      const a=z.object({version:z.string().trim().min(3).max(100),body:z.string().min(100).max(50000),pdf_path:z.string().regex(/^agreements\/[a-zA-Z0-9_.\/-]+$/),original_path:z.string().regex(/^agreements\/[a-zA-Z0-9_.\/-]+$/).nullable(),ready:z.boolean()}).parse(body.agreement);
      const settings=await getSettings();
      if(a.ready && (!settings.fees_confirmed||!settings.legal_reviewed||a.body.includes('[UAVKLART]'))) return json({error:'Avklar betaling og gjennomgå NFF-bestemmelser før avtalen tas i bruk'},400);
      check(await db.storage.from('player-documents').download(a.pdf_path));
      const row=check(await db.from('player_agreements').insert({version:a.version,body:a.body,pdf_path:a.pdf_path,original_path:a.original_path,status:a.ready?'ready':'draft',created_by:user.id}).select().single());
      check(await db.from('player_enrollment_settings').update({current_agreement_id:row.id}).eq('id',1));return json(row);
    }
    if(action==='list') {
      const applications=check(await db.from('player_applications').select('*').is('deleted_at',null).order('created_at',{ascending:false}));
      const invites=check(await db.from('player_invitations').select('id,application_id,email_state,email_sent_at,email_id,email_error,expires_at,created_at').is('revoked_at',null));
      return json(applications.map((a:any)=>({...a,invitation:invites.find((i:any)=>i.application_id===a.id)||null})));
    }
    if(action==='events') return json(check(await db.from('player_onboarding_events').select('*').eq('application_id',z.string().uuid().parse(body.id)).order('created_at',{ascending:false})));
    if(action==='invite') {
      const a=applicationSchema.parse(body.application); const team=z.enum(['A-laget','B-laget']).parse(body.team);
      const row=check(await db.from('player_applications').insert({...a,status:'approved',team,approved_by:user.id,approved_at:new Date().toISOString()}).select().single());
      await event(row.id,'admin_invited');
      body.id=row.id;body.team=team;action='approve';
    }
    if(action==='test_email') {
      const settings=await getSettings();
      const agreement=check(await db.from('player_agreements').select('*').eq('id',settings.current_agreement_id).single());
      let a=check(await db.from('player_applications').select('*').eq('is_test',true).is('deleted_at',null).eq('email','hamza_2301@hotmail.com').limit(1));
      if(!a[0]) a=[check(await db.from('player_applications').insert({full_name:'Kontrollert testspiller',birth_date:'2000-01-01',email:'hamza_2301@hotmail.com',phone:'00000000',payment_choice:'quarterly',status:'approved',team:'A-laget',is_test:true,approved_by:user.id,approved_at:new Date().toISOString()}).select().single())];
      const snapshot={team:'A-laget',spond_url:settings.groups['A-laget'],transfer_url:settings.transfer_url,transfer_contact:settings.transfer_contact,transfer_email:settings.transfer_email,payment:null};
      const issued=await issueInvite(a[0].id,agreement.id,snapshot,false);
      return await sendInvite(issued.id,true,issued.token);
    }
    const a=await getApp(body.id);
    if(action==='test_link') {
      if(!a.is_test) return json({error:'Kun kontrollert testspiller'},403);
      const inv=check(await db.from('player_invitations').select('agreement_id,snapshot').eq('application_id',a.id).is('revoked_at',null).single());
      const issued=await issueInvite(a.id,inv.agreement_id,inv.snapshot,true);
      return json({token:issued.token});
    }
    if(action==='reject') {if(a.status==='approved')return json({error:'Godkjent spiller kan ikke avslås via søknadsbehandling'},400);check(await db.from('player_applications').update({status:'rejected'}).eq('id',a.id));await event(a.id,'rejected');return json({success:true});}
    if(action==='verify') {
      const task=z.enum(['spond','eligibility','payment']).parse(body.task);const stamp=new Date().toISOString();let updates:any={};
      if(a.status!=='approved')return json({error:'Spilleren må være godkjent'},400);
      if(task==='spond')updates={spond_verified_at:stamp,spond_verified_by:user.id};
      if(task==='eligibility')updates={eligibility_verified_at:stamp,eligibility_verified_by:user.id,eligible_from:z.string().regex(/^\d{4}-\d{2}-\d{2}$/).parse(body.date)};
      if(task==='payment')updates={payment_verified_at:stamp,payment_verified_by:user.id,payment_source:z.enum(['manual_spond','manual_bank']).parse(body.source),payment_reference:z.string().trim().min(3).max(300).parse(body.reference)};
      check(await db.from('player_applications').update(updates).eq('id',a.id));await event(a.id,`admin_${task}_verified`,updates);return json({success:true});
    }
    if(action==='update_application') {
      if(a.invitation || a.agreement_id)return json({error:'Betalingsplan er låst etter invitasjon. Kontakt spilleren og opprett ny avtale ved endringer.'},400);
      const updates=z.object({training_override_ore:z.number().int().nonnegative().nullable(),notes:z.string().max(3000),custom_schedule:z.array(z.object({kind:z.enum(['membership','training']),amount_ore:z.number().int().nonnegative(),due:z.string().regex(/^\d{4}-\d{2}-\d{2}$/)})).max(24).nullable()}).parse(body.updates);
      check(await db.from('player_applications').update(updates).eq('id',a.id));await event(a.id,'individual_arrangement_updated');return json({success:true});
    }
    const settings=await getSettings();
    const agreement=check(await db.from('player_agreements').select('*').eq('id',a.agreement_id||settings.current_agreement_id).single());
    const team=z.enum(['A-laget','B-laget']).parse(body.team||a.team);
    const ready=canSendPackage(settings,agreement);
    let payment=null;
    if(settings.fees_confirmed) {
      payment=paymentPlan(settings.membership_ore,a.training_override_ore??(team==='A-laget'?settings.training_ore_a:settings.training_ore_b),a.payment_choice,settings.membership_due,settings.first_training_due);
      if(a.custom_schedule) {const rows=a.custom_schedule; if(rows.reduce((s:number,p:any)=>s+p.amount_ore,0)!==payment.total_ore || rows.filter((p:any)=>p.kind==='membership').length!==1 || rows.find((p:any)=>p.kind==='membership')?.amount_ore!==settings.membership_ore) return json({error:'Individuell plan må summere korrekt og ikke dele medlemskontingenten'},400);payment={...payment,payments:rows};}
    }
    const snapshot={team,spond_url:settings.groups[team],transfer_url:settings.transfer_url,transfer_contact:settings.transfer_contact,transfer_email:settings.transfer_email,payment};
    if(action==='preview') return json({html:welcomeHtml(a.full_name,'https://fagerborgbk.no/spillerinnmelding',snapshot,!ready),ready,pdf_url:await signing(agreement.pdf_path)});
    if(action==='approve') {
      if(a.status==='rejected')return json({error:'Avslått søknad kan ikke godkjennes uten ny søknad'},400);
      if(a.status!=='approved'){check(await db.from('player_applications').update({status:'approved',team,approved_by:user.id,approved_at:new Date().toISOString()}).eq('id',a.id));await event(a.id,'approved',{team});}
      if(!ready)return json({success:true,blocked:true,message:'Godkjent. Velkomstpakken venter på vedtatt betaling og godkjent avtale.'});
    }
    if(!ready)return json({error:'Velkomstpakken er sperret: avklar sesongens betaling og avtalen først'},409);
    const issued=await issueInvite(a.id,agreement.id,snapshot,action==='resend');
    return await sendInvite(issued.id,false,issued.token);

    async function issueInvite(applicationId:string,agreementId:string,snapshot:unknown,resend:boolean) {
      const token=Array.from(crypto.getRandomValues(new Uint8Array(32))).map(n=>n.toString(16).padStart(2,'0')).join('');
      const hash=await sha(token);
      const id=check(await db.rpc('create_hashed_player_invitation',{p_application_id:applicationId,p_actor:user?.id,p_agreement_id:agreementId,p_snapshot:snapshot,p_token_hash:hash,p_resend:resend}));
      const inv=check(await db.from('player_invitations').select('token_hash').eq('id',id).single());
      return {id,token:inv.token_hash===hash?token:null};
    }

    async function sendInvite(id:string,test:boolean,token:string|null) {
      let inv=check(await db.from('player_invitations').select('*').eq('id',id).single());
      if(inv.email_state==='sent')return json({success:true,already_sent:true});
      if(!token)return json({error:'Invitasjonen finnes, men engangsnøkkelen er ikke lagret. Kontroller e-postloggen og velg bevisst ny utsending.'},409);
      if(inv.email_attempt_at && Date.now()-Date.parse(inv.email_attempt_at)>23*3600000)return json({error:'Levering er usikker. Kontroller e-postloggen før en bevisst ny invitasjon.'},409);
      if(inv.email_state==='sending')return json({success:true,message:'En utsending pågår allerede'});
      const claimed=check(await db.from('player_invitations').update({email_state:'sending',email_attempt_at:inv.email_attempt_at||new Date().toISOString()}).eq('id',id).in('email_state',['pending','failed']).select());
      if(!claimed[0])return json({error:'Utsending må kontrolleres manuelt'},409);
      const apiKey=Deno.env.get('RESEND_API_KEY');
      if(!apiKey){check(await db.from('player_invitations').update({email_state:'failed',email_error:'E-posttjenesten er ikke konfigurert'}).eq('id',id));return json({error:'E-posttjenesten er ikke konfigurert'},503);}
      const player=await getApp(inv.application_id);
      const doc=check(await db.from('player_agreements').select('*').eq('id',inv.agreement_id).single());
      const file=check(await db.storage.from('player-documents').download(doc.pdf_path));
      const bytes=new Uint8Array(await file.arrayBuffer());let binary='';for(const byte of bytes)binary+=String.fromCharCode(byte);
      const link=`https://fagerborgbk.no/spillerinnmelding#invitasjon=${token}`;
      try{
        const response=await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:`Bearer ${apiKey}`,'Content-Type':'application/json','Idempotency-Key':`player-welcome-${id}`},body:JSON.stringify({from:'Fagerborg BK <post@support.fagerborgbk.no>',to:[test?'hamza_2301@hotmail.com':player.email],subject:test?`TEST – Spillerinnmelding ${doc.season} (uavklart utkast)`:`Velkommen til Fagerborg BK – spillerinnmelding ${doc.season}`,html:welcomeHtml(player.full_name,link,inv.snapshot,test),attachments:[{filename:`spilleravtale-${doc.version}.pdf`,content:btoa(binary)}]})});
        const result=await response.json();
        if(!response.ok){check(await db.from('player_invitations').update({email_state:'failed',email_error:`E-postleverandør avviste utsending (${response.status})`}).eq('id',id));return json({error:'E-postleverandør avviste utsending',status:response.status},502);}
        check(await db.from('player_invitations').update({email_state:'sent',email_sent_at:new Date().toISOString(),email_id:result.id,email_error:null}).eq('id',id));
        await event(player.id,test?'test_welcome_sent':'welcome_sent',{email_id:result.id,invitation_id:id});return json({success:true,email_id:result.id});
      }catch{await db.from('player_invitations').update({email_state:'uncertain',email_error:'Uavklart levering; kontroller før ny utsending'}).eq('id',id);return json({error:'Leveringsstatus er uavklart. Kontroller før ny utsending.'},502);}
    }
  }catch(error){return json({error:error instanceof z.ZodError?'Kontroller opplysningene':error instanceof Error?error.message:'Uventet feil'},400);}
});