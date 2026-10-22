import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useSportsSeason } from '@/hooks/useSportsSeason';
import { type SportsSeason, validateSportsSeason } from '../../../supabase/functions/_shared/sportsSeason';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Save, Plus, Check, Loader2 } from 'lucide-react';
import { FunctionsHttpError } from '@supabase/supabase-js';

export default function SportsSeasonSettings() {
  const {data:active}=useSportsSeason();
  const qc=useQueryClient();
  const [draft,setDraft]=useState<SportsSeason>();
  const [busy,setBusy]=useState(false);
  const [message,setMessage]=useState('');
  const [confirm,setConfirm]=useState(false);
  const {data:seasons}=useQuery({queryKey:['sports-seasons-settings'],queryFn:async()=>{
    const {data,error}=await supabase.from('sports_seasons').select('*').order('season',{ascending:false});
    if(error)throw error;return data;
  }});
  const call=async(body:unknown)=>{
    setBusy(true);setMessage('');
    try {
      const {error}=await supabase.functions.invoke('sports-season-settings',{body});
      if(error) {
        if(error instanceof FunctionsHttpError) {
          const detail=await error.context.json();throw new Error(detail.error??'Kunne ikke lagre sesongen');
        }
        throw error;
      }
      await qc.invalidateQueries({queryKey:['sports-seasons-settings']});
      await qc.invalidateQueries({queryKey:['sports-season']});
      await qc.invalidateQueries({queryKey:['sports-seasons']});
      setMessage('Sesonginnstillingene er lagret.');
    } catch(error) {setMessage(error instanceof Error?error.message:'Kunne ikke lagre sesongen');}
    finally {setBusy(false);}
  };
  const editTeam=(index:number,field:string,value:string|number)=>setDraft(current=>current?{...current,teams:current.teams.map((t,i)=>i===index?{...t,[field]:value}:t)}:current);
  const valid=(()=>{try {validateSportsSeason(draft);return true;}catch{return false;}})();
  return <section className="space-y-4 border-t pt-6">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <h2 className="text-xl font-bold">Sportssesong · {active?.season??'–'}</h2>
      <Button variant="outline" disabled={!active||busy} onClick={()=>{if(active)setDraft({...active,season:active.season+1,teams:active.teams.map(t=>({...t,tournament_id:''}))});setMessage('');}}><Plus className="mr-2 h-4 w-4"/>Neste sesong</Button>
    </div>
    <Select onValueChange={value=>{const row=seasons?.find(s=>s.season===Number(value));if(row)setDraft(validateSportsSeason(row));setMessage('');}}>
      <SelectTrigger className="w-48" aria-label="Rediger sportssesong"><SelectValue placeholder="Velg sesong"/></SelectTrigger>
      <SelectContent>{seasons?.map(s=><SelectItem key={s.season} value={String(s.season)}>{s.season}{s.is_active?' · aktiv':''}</SelectItem>)}</SelectContent>
    </Select>
    {draft&&<div className="space-y-4">
      <div className="max-w-48 space-y-2"><Label htmlFor="sports-season">Sesong</Label><Input id="sports-season" type="number" min={2000} max={2200} disabled={busy||draft.season===active?.season} value={draft.season} onChange={e=>setDraft({...draft,season:Number(e.target.value)})}/></div>
      <p className="text-sm text-muted-foreground">Europe/Oslo</p>
      <div className="grid gap-6 md:grid-cols-2">{draft.teams.map((team,index)=><fieldset key={team.team} disabled={busy||draft.season===active?.season} className="space-y-3 min-w-0">
        <legend className="font-semibold">{team.team}</legend>
        {([['tournament_id','Turnerings-ID'],['team_id','Lag-ID'],['expected_teams','Antall lag'],['league','Divisjon'],['club_name','Klubbnavn i tabellen']] as const).map(([field,label])=><div key={field} className="space-y-1"><Label htmlFor={`${team.team}-${field}`}>{label}</Label><Input id={`${team.team}-${field}`} type={field==='expected_teams'?'number':'text'} min={field==='expected_teams'?2:undefined} max={field==='expected_teams'?32:undefined} value={team[field]} onChange={e=>editTeam(index,field,field==='expected_teams'?Number(e.target.value):e.target.value)}/></div>)}
      </fieldset>)}</div>
      <div className="flex flex-wrap gap-2">
        <Button disabled={busy||!valid||draft.season===active?.season} onClick={()=>call({action:'save',config:draft})}>{busy?<Loader2 className="mr-2 h-4 w-4 animate-spin"/>:<Save className="mr-2 h-4 w-4"/>}Lagre sesong</Button>
        <Button variant="outline" disabled={busy||!valid||draft.season===active?.season||!seasons?.some(s=>s.season===draft.season&&JSON.stringify(validateSportsSeason(s).teams)===JSON.stringify(draft.teams))} onClick={()=>setConfirm(true)}><Check className="mr-2 h-4 w-4"/>Aktiver sesong</Button>
      </div>
      <AlertDialog open={confirm} onOpenChange={setConfirm}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Aktiver sesong {draft.season}?</AlertDialogTitle><AlertDialogDescription>Sportsoppsettet i GitHub oppdateres før sesongen aktiveres. Nye Målklubb-påmeldinger tilhører denne sesongen. Tidligere sesonger beholdes. Ingen fakturaer sendes nå.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Avbryt</AlertDialogCancel><AlertDialogAction onClick={()=>call({action:'activate',season:draft.season})}>Aktiver</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
    </div>}
    {message&&<p role="status" className="text-sm">{message}</p>}
  </section>;
}