import { useEffect, useRef, useState } from 'react';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { onboarding, planLabels } from '@/lib/playerEnrollment';
import { CheckCircle, Send } from 'lucide-react';
const schema = z.object({full_name:z.string().trim().min(2,'Oppgi fullt navn').max(200),email:z.string().trim().email('Oppgi gyldig e-post').max(255),birth_date:z.string().regex(/^\d{4}-\d{2}-\d{2}$/,'Oppgi fødselsdato'),phone:z.string().trim().min(5,'Oppgi telefon').max(50),previous_club:z.string().max(300),payment_choice:z.enum(['annual','quarterly','monthly'])});
export type PlayerFormData = z.infer<typeof schema>;
export default function PlayerApplicationForm({ admin = false, onInvite }: {admin?:boolean;onInvite?:(data:PlayerFormData)=>Promise<void>}) {
  const [data,setData]=useState<PlayerFormData>({full_name:'',email:'',birth_date:'',phone:'',previous_club:'',payment_choice:'annual'});
  const [error,setError]=useState(''),[busy,setBusy]=useState(false),[sent,setSent]=useState(false);
  const container=useRef<HTMLDivElement>(null);const widget=useRef<string>();const token=useRef('');
  useEffect(()=>{if(!admin) onboarding({action:'prefill'}).then(v=>setData(d=>({...d,...Object.fromEntries(Object.entries(v).filter(([,value])=>value!=null))}))).catch(()=>{});},[admin]);
  useEffect(()=>{
    if(admin||sent)return;
    let cancelled=false;
    const render=()=>{if(cancelled||!container.current||!window.turnstile||widget.current)return;widget.current=window.turnstile.render(container.current,{sitekey:'0x4AAAAAACOr5ftU2vku54i6',callback:v=>{token.current=v;setError('');},'expired-callback':()=>{token.current='';},'error-callback':()=>setError('Captcha feilet. Last siden på nytt.'),theme:'auto'});};
    const existing=document.querySelector<HTMLScriptElement>('script[data-turnstile="true"]');
    if(existing){render();existing.addEventListener('load',render);}else{const script=document.createElement('script');script.src='https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';script.dataset.turnstile='true';script.async=true;script.addEventListener('load',render);document.head.appendChild(script);}
    return()=>{cancelled=true;existing?.removeEventListener('load',render);};
  },[admin,sent]);
  if(sent)return <div className="py-8 space-y-3" role="status"><CheckCircle className="h-10 w-10 text-primary"/><h2 className="text-2xl font-bold">Søknaden er mottatt</h2><p>Venter på godkjenning. Du får din personlige innmeldingsside og dokumenter når klubben har godkjent deg og avtalen er klar.</p></div>;
  return <form className="space-y-5" onSubmit={async e=>{e.preventDefault();setError('');const parsed=schema.safeParse(data);if(!parsed.success){setError(parsed.error.issues[0]?.message||'Kontroller feltene');return;}if(!admin&&!token.current){setError('Fullfør captcha-verifiseringen');return;}setBusy(true);try{if(admin&&onInvite)await onInvite(parsed.data);else await onboarding({action:'apply',application:parsed.data,turnstile_token:token.current,website:new FormData(e.currentTarget).get('website')});setSent(true);}catch(err){setError(err instanceof Error?err.message:'Kunne ikke sende');token.current='';window.turnstile?.reset(widget.current);}finally{setBusy(false);}}}>
    <input name="website" className="hidden" tabIndex={-1} aria-hidden="true"/>
    <div className="grid sm:grid-cols-2 gap-4">{([{key:'full_name',label:'Fullt navn',type:'text',max:200},{key:'birth_date',label:'Fødselsdato',type:'date',max:10},{key:'email',label:'E-post',type:'email',max:255},{key:'phone',label:'Telefon',type:'tel',max:50},{key:'previous_club',label:'Nåværende / tidligere klubb',type:'text',max:300}] as const).map(f=><div key={f.key} className={f.key==='previous_club'?'sm:col-span-2 space-y-2':'space-y-2'}><Label htmlFor={`player-${f.key}`}>{f.label}</Label><Input id={`player-${f.key}`} type={f.type} maxLength={f.max} required={f.key!=='previous_club'} value={data[f.key]} onChange={e=>setData(d=>({...d,[f.key]:e.target.value}))}/></div>)}</div>
    <fieldset className="space-y-3"><legend className="font-semibold mb-3">Ønsket betalingsordning</legend><RadioGroup value={data.payment_choice} onValueChange={v=>setData(d=>({...d,payment_choice:v as PlayerFormData['payment_choice']}))}>{Object.entries(planLabels).map(([key,label])=><div className="flex items-center gap-3" key={key}><RadioGroupItem id={`plan-${key}`} value={key}/><Label htmlFor={`plan-${key}`}>{label}</Label></div>)}</RadioGroup><p className="text-sm text-muted-foreground">Beløp og betalingsdatoer for 2027 er ikke vedtatt. Medlemskontingent betales samlet; ønsket avdragsordning gjelder treningsavgiften.</p></fieldset>
    {!admin&&<div ref={container}/>}{error&&<p role="alert" className="text-destructive text-sm">{error}</p>}
    <Button type="submit" disabled={busy} className="gap-2"><Send className="h-4 w-4"/>{busy?'Sender…':admin?'Opprett godkjent spiller':'Send spillersøknad'}</Button>
  </form>;
}