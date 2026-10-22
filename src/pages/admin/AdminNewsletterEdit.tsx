import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';
import { DefaultEditor } from 'react-simple-wysiwyg';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { ArrowLeft, Save, Send, Loader2, MailCheck, Users, Monitor, Smartphone } from 'lucide-react';

const MEMBERSHIP_TYPES = [
  { value: 'standard', label: 'Medlem' },
  { value: 'malklubben', label: 'Målklubben' },
  { value: 'partner', label: 'Partner' },
  { value: 'familie', label: 'Familie' },
  { value: 'stotte', label: 'Støttemedlem' },
];

const INTERESTS = [
  { value: 'kamper', label: 'Kamper og resultater' },
  { value: 'ungdom', label: 'Ungdom og B-lag' },
  { value: 'dugnad', label: 'Dugnad' },
  { value: 'arrangementer', label: 'Arrangementer' },
  { value: 'sponsor', label: 'Sponsor og partner' },
];

const TEAM_GROUPS = ['A-laget', 'B-laget', 'Ungdom', 'Foreldre', 'Støtteapparat'];

const AdminNewsletterEdit = () => {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [subject, setSubject] = useState('');
  const [bodyHtml, setBodyHtml] = useState('');
  const [dirty, setDirty] = useState(false);
  const [mobilePreview, setMobilePreview] = useState(false);

  // Segment state
  const [onlyActive, setOnlyActive] = useState(true);
  const [types, setTypes] = useState<string[]>([]);
  const [teamGroups, setTeamGroups] = useState<string[]>([]);
  const [interests, setInterests] = useState<string[]>([]);

  const segment = useMemo(
    () => ({
      status: onlyActive ? 'active' : 'all',
      membership_types: types,
      team_groups: teamGroups,
      interests,
    }),
    [onlyActive, types, teamGroups, interests],
  );

  const { data: newsletter, isLoading } = useQuery({
    queryKey: ['admin-newsletter', id],
    queryFn: async () => {
      const { data, error } = await supabase.from('newsletters').select('*').eq('id', id).single();
      if (error) throw error;
      return data as any;
    },
    enabled: !!id,
  });

  useEffect(() => {
    if (newsletter) {
      setSubject(newsletter.subject);
      setBodyHtml(newsletter.body_html);
      setDirty(false);
    }
  }, [newsletter]);

  const { data: recipientCount, isFetching: countLoading } = useQuery({
    queryKey: ['newsletter-recipient-count', segment],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('send-newsletter', {
        body: { count_only: true, newsletter_id: id, segment },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      return (data as any).count as number;
    },
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from('newsletters')
        .update({ subject, body_html: bodyHtml })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      setDirty(false);
      toast.success('Nyhetsbrevet er lagret');
      queryClient.invalidateQueries({ queryKey: ['admin-newsletter', id] });
      queryClient.invalidateQueries({ queryKey: ['admin-newsletters'] });
    },
    onError: (e: any) => toast.error(`Feil: ${e.message}`),
  });

  const testMutation = useMutation({
    mutationFn: async () => {
      if (dirty) await saveMutation.mutateAsync();
      const { data, error } = await supabase.functions.invoke('send-newsletter', {
        body: { newsletter_id: id, test_send: true },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      return data as any;
    },
    onSuccess: (data) => toast.success(`Test sendt til ${data.sent_to}`),
    onError: (e: any) => toast.error(`Feil: ${e.message}`),
  });

  const sendMutation = useMutation({
    mutationFn: async () => {
      if (dirty) await saveMutation.mutateAsync();
      const { data, error } = await supabase.functions.invoke('send-newsletter', {
        body: { newsletter_id: id, segment },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      return data as any;
    },
    onSuccess: (data) => {
      toast.success(`Nyhetsbrev sendt til ${data.sent_count} mottakere`);
      queryClient.invalidateQueries({ queryKey: ['admin-newsletter', id] });
      queryClient.invalidateQueries({ queryKey: ['admin-newsletters'] });
    },
    onError: (e: any) => toast.error(`Feil: ${e.message}`),
  });

  const toggle = (list: string[], setList: (v: string[]) => void, value: string) =>
    setList(list.includes(value) ? list.filter((v) => v !== value) : [...list, value]);

  const isSent = newsletter?.status==='sent' || ['sent','sending','partial'].includes(newsletter?.delivery_state);

  if (isLoading) {
    return (
      <AdminLayout>
        <Card><CardContent className="p-10 text-center text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin mx-auto mb-3" />Laster nyhetsbrev...
        </CardContent></Card>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <Button variant="ghost" size="sm" className="mb-2 -ml-2" onClick={() => navigate('/admin/newsletters')}>
              <ArrowLeft className="h-4 w-4 mr-1" />Tilbake
            </Button>
            <h1 className="text-2xl md:text-3xl font-bold">Forhåndsvis og godkjenn</h1>
            <p className="text-muted-foreground text-sm">
              Rediger innholdet, velg mottakere og send når du er fornøyd.
            </p>
          </div>
          <div className="flex items-center gap-2">
            {isSent ? <Badge className="bg-green-600 text-primary-foreground">Sendt</Badge> : <Badge variant="secondary">Utkast</Badge>}
            {dirty && <Badge variant="outline">Ulagrede endringer</Badge>}
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          {/* Editor */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Innhold</CardTitle>
              <CardDescription>Bruk {'{{PREFERENCES_URL}}'} og {'{{UNSUBSCRIBE_URL}}'} for egne lenker — ellers legges de til automatisk.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Emne</Label>
                <Input
                  value={subject}
                  disabled={isSent}
                  onChange={(e) => { setSubject(e.target.value); setDirty(true); }}
                />
              </div>
              <div>
                <Label>Brødtekst</Label>
                <DefaultEditor
                  value={bodyHtml}
                  disabled={isSent}
                  onChange={(e: any) => { setBodyHtml(e.target.value); setDirty(true); }}
                  className="min-h-[380px] bg-background border rounded-md"
                />
              </div>
              <div className="flex flex-wrap gap-2">
                <Button onClick={() => saveMutation.mutate()} disabled={isSent || saveMutation.isPending || !dirty}>
                  <Save className="h-4 w-4 mr-1" />{saveMutation.isPending ? 'Lagrer...' : 'Lagre utkast'}
                </Button>
                <Button variant="outline" onClick={() => testMutation.mutate()} disabled={testMutation.isPending}>
                  {testMutation.isPending
                    ? <><Loader2 className="h-4 w-4 mr-1 animate-spin" />Sender test...</>
                    : <><MailCheck className="h-4 w-4 mr-1" />Send test til meg</>}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Preview */}
          <Card>
            <CardHeader className="flex-row items-center justify-between space-y-0">
              <div>
                <CardTitle className="text-lg">Forhåndsvisning</CardTitle>
                <CardDescription>Slik ser e-posten ut for mottakeren</CardDescription>
              </div>
              <div className="flex gap-1">
                <Button variant={mobilePreview ? 'ghost' : 'secondary'} size="icon" onClick={() => setMobilePreview(false)} aria-label="Desktop">
                  <Monitor className="h-4 w-4" />
                </Button>
                <Button variant={mobilePreview ? 'secondary' : 'ghost'} size="icon" onClick={() => setMobilePreview(true)} aria-label="Mobil">
                  <Smartphone className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="rounded-lg border bg-white p-4 overflow-y-auto max-h-[520px] mx-auto" style={{ maxWidth: mobilePreview ? 380 : '100%' }}>
                <p className="text-xs text-muted-foreground mb-3 border-b pb-2">
                  <strong>Emne:</strong> {subject || '(uten emne)'}
                </p>
                <div className="prose prose-sm max-w-none text-[#1a2b4a]" dangerouslySetInnerHTML={{ __html: bodyHtml }} />
                <div className="mt-6 border-t pt-3 text-center text-[11px] text-muted-foreground">
                  Du mottar denne e-posten fordi du er registrert hos Fagerborg BK.<br />
                  Endre hva du vil motta · Meld deg av nyhetsbrevet
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Segmentation */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2"><Users className="h-4 w-4" />Mottakere</CardTitle>
            <CardDescription>Avmeldte mottakere utelates alltid. Uten valg sendes det til alle abonnenter.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center justify-between rounded-lg border p-4 max-w-md">
              <div>
                <p className="text-sm font-semibold">Kun aktive betalende</p>
                <p className="text-xs text-muted-foreground">Utelat medlemskap som venter på betaling</p>
              </div>
              <Switch checked={onlyActive} onCheckedChange={setOnlyActive} />
            </div>

            <div className="grid gap-6 sm:grid-cols-3">
              <div>
                <p className="text-sm font-semibold mb-2">Medlemstype</p>
                <div className="space-y-2">
                  {MEMBERSHIP_TYPES.map((t) => (
                    <label key={t.value} className="flex items-center gap-2 text-sm cursor-pointer">
                      <Checkbox checked={types.includes(t.value)} onCheckedChange={() => toggle(types, setTypes, t.value)} />
                      {t.label}
                    </label>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-sm font-semibold mb-2">Laggruppe</p>
                <div className="space-y-2">
                  {TEAM_GROUPS.map((g) => (
                    <label key={g} className="flex items-center gap-2 text-sm cursor-pointer">
                      <Checkbox checked={teamGroups.includes(g)} onCheckedChange={() => toggle(teamGroups, setTeamGroups, g)} />
                      {g}
                    </label>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-sm font-semibold mb-2">Interesser</p>
                <div className="space-y-2">
                  {INTERESTS.map((i) => (
                    <label key={i.value} className="flex items-center gap-2 text-sm cursor-pointer">
                      <Checkbox checked={interests.includes(i.value)} onCheckedChange={() => toggle(interests, setInterests, i.value)} />
                      {i.label}
                    </label>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-4 border-t pt-4">
              <div className="text-sm">
                {countLoading ? (
                  <span className="text-muted-foreground flex items-center gap-2"><Loader2 className="h-3 w-3 animate-spin" />Beregner mottakere...</span>
                ) : (
                  <span><strong>{recipientCount ?? 0}</strong> mottakere i dette segmentet</span>
                )}
              </div>

              {!isSent && (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button disabled={sendMutation.isPending || !recipientCount}>
                      {sendMutation.isPending
                        ? <><Loader2 className="h-4 w-4 mr-1 animate-spin" />Sender...</>
                        : <><Send className="h-4 w-4 mr-1" />Godkjenn og send</>}
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Send nyhetsbrevet?</AlertDialogTitle>
                      <AlertDialogDescription>
                        «{subject}» sendes til {recipientCount} mottakere. Dette kan ikke angres.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Avbryt</AlertDialogCancel>
                      <AlertDialogAction onClick={() => sendMutation.mutate()}>Send nå</AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
};

export default AdminNewsletterEdit;
