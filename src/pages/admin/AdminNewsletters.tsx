import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { DefaultEditor } from 'react-simple-wysiwyg';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Mail, Send, Eye, ListChecks, RefreshCw, Loader2, Pencil, Save, X, Users, UserMinus, Trash2, MailCheck } from 'lucide-react';
import { format } from 'date-fns';
import { nb } from 'date-fns/locale';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const SentRecipientsDialog = ({ newsletterId, subject, sentCount }: { newsletterId: string; subject: string; sentCount: number }) => {
  const [open, setOpen] = useState(false);
  const { data, isLoading } = useQuery({
    queryKey: ['newsletter-sent-recipients', newsletterId],
    enabled: open,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('newsletter_recipients')
        .select('*')
        .eq('newsletter_id', newsletterId)
        .order('email');
      if (error) throw error;
      return data;
    },
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <ListChecks className="h-4 w-4 mr-1" />Se mottakere ({sentCount})
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Mottakere · {subject}</DialogTitle></DialogHeader>
        {isLoading ? (
          <p className="text-sm text-muted-foreground py-6 text-center">Laster...</p>
        ) : !data?.length ? (
          <p className="text-sm text-muted-foreground py-6 text-center">
            Detaljert mottakerliste ble ikke lagret for denne utsendelsen. Nye utsendelser logges automatisk.
          </p>
        ) : (
          <div className="divide-y">
            {data.map((r: any) => (
              <div key={r.id} className="flex items-center justify-between gap-3 py-2">
                <div className="min-w-0">
                  {r.name && <p className="text-sm font-medium truncate">{r.name}</p>}
                  <p className="text-xs text-muted-foreground truncate">{r.email}</p>
                </div>
                {r.status === 'sent'
                  ? <Badge className="bg-green-600 text-primary-foreground">Sendt</Badge>
                  : <Badge variant="destructive">Feilet</Badge>}
              </div>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

const AdminNewsletters = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [previewHtml, setPreviewHtml] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editSubject, setEditSubject] = useState('');
  const [editHtml, setEditHtml] = useState('');
  const [sendAudience, setSendAudience] = useState<string>('all');

  const { data: newsletters, isLoading } = useQuery({
    queryKey: ['admin-newsletters'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('newsletters')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: subscriberStats } = useQuery({
    queryKey: ['newsletter-subscriber-stats'],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('admin-memberships', {
        body: { action: 'list' },
      });
      if (error) throw error;
      const members: any[] = Array.isArray(data) ? data : (data?.members || []);
      const active = members.filter((m: any) => m.status === 'active');
      const optedOut = active.filter((m: any) => m.newsletter_opt_out === true);
      return { total: active.length, subscribers: active.length - optedOut.length, optedOut: optedOut.length };
    },
  });

  const generateMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('generate-newsletter');
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: () => {
      toast.success('Nyhetsbrev-utkast generert!');
      queryClient.invalidateQueries({ queryKey: ['admin-newsletters'] });
    },
    onError: (err: any) => toast.error(`Feil: ${err.message}`),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, subject, body_html }: { id: string; subject: string; body_html: string }) => {
      const { error } = await supabase
        .from('newsletters')
        .update({ subject, body_html })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Nyhetsbrev oppdatert');
      setEditingId(null);
      queryClient.invalidateQueries({ queryKey: ['admin-newsletters'] });
    },
    onError: (err: any) => toast.error(`Feil: ${err.message}`),
  });

  const sendMutation = useMutation({
    mutationFn: async ({ newsletterId, audience }: { newsletterId: string; audience: string }) => {
      const { data, error } = await supabase.functions.invoke('send-newsletter', {
        body: { newsletter_id: newsletterId, audience },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: (data) => {
      toast.success(`Nyhetsbrev sendt til ${data.sent_count} medlemmer!`);
      queryClient.invalidateQueries({ queryKey: ['admin-newsletters'] });
    },
    onError: (err: any) => toast.error(`Feil: ${err.message}`),
  });

  const testSendMutation = useMutation({
    mutationFn: async (newsletterId: string) => {
      const { data, error } = await supabase.functions.invoke('send-newsletter', {
        body: { newsletter_id: newsletterId, test_send: true },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: (data) => {
      toast.success(`Test-nyhetsbrev sendt til ${data.sent_to}`);
    },
    onError: (err: any) => toast.error(`Feil: ${err.message}`),
  });

  const deleteMutation = useMutation({
    mutationFn: async (newsletterId: string) => {
      const { error } = await supabase
        .from('newsletters')
        .delete()
        .eq('id', newsletterId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Nyhetsbrev slettet');
      queryClient.invalidateQueries({ queryKey: ['admin-newsletters'] });
    },
    onError: (err: any) => toast.error(`Feil: ${err.message}`),
  });

  const startEditing = (nl: any) => {
    setEditingId(nl.id);
    setEditSubject(nl.subject);
    setEditHtml(nl.body_html);
  };

  const statusBadge = (status: string) => {
    switch (status) {
      case 'draft': return <Badge variant="secondary">Utkast</Badge>;
      case 'sent': return <Badge className="bg-green-600 text-primary-foreground">Sendt</Badge>;
      default: return <Badge>{status}</Badge>;
    }
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Nyhetsbrev</h1>
            <p className="text-muted-foreground">Generer og send månedlige nyhetsbrev til medlemmene</p>
          </div>
          <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => navigate('/admin/newsletter-mottakere')}>
            <Users className="h-4 w-4 mr-2" />Se mottakere
          </Button>
          <Button onClick={() => generateMutation.mutate()} disabled={generateMutation.isPending}>
            {generateMutation.isPending ? (
              <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Genererer...</>
            ) : (
              <><RefreshCw className="h-4 w-4 mr-2" />Generer nyhetsbrev</>
            )}
          </Button>
          </div>
        </div>

        {/* Subscriber stats */}
        {subscriberStats && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Card>
              <CardContent className="p-4 flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/10"><Users className="h-5 w-5 text-primary" /></div>
                <div>
                  <p className="text-2xl font-bold">{subscriberStats.subscribers}</p>
                  <p className="text-xs text-muted-foreground">Abonnenter</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 flex items-center gap-3">
                <div className="p-2 rounded-lg bg-muted"><UserMinus className="h-5 w-5 text-muted-foreground" /></div>
                <div>
                  <p className="text-2xl font-bold">{subscriberStats.optedOut}</p>
                  <p className="text-xs text-muted-foreground">Avmeldt</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 flex items-center gap-3">
                <div className="p-2 rounded-lg bg-muted"><Mail className="h-5 w-5 text-muted-foreground" /></div>
                <div>
                  <p className="text-2xl font-bold">{newsletters?.filter((n: any) => n.status === 'sent').length || 0}</p>
                  <p className="text-xs text-muted-foreground">Sendte nyhetsbrev</p>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {isLoading ? (
          <Card><CardContent className="p-6 text-center text-muted-foreground">Laster...</CardContent></Card>
        ) : !newsletters?.length ? (
          <Card>
            <CardContent className="p-12 text-center">
              <Mail className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-medium mb-2">Ingen nyhetsbrev ennå</h3>
              <p className="text-muted-foreground mb-4">Klikk «Generer nyhetsbrev» for å lage det første utkastet.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {newsletters.map((nl: any) => (
              <Card key={nl.id}>
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <CardTitle className="text-lg flex items-center gap-2">
                        <Mail className="h-4 w-4" />
                        {nl.subject}
                      </CardTitle>
                      <CardDescription>
                        Opprettet {format(new Date(nl.created_at), 'd. MMM yyyy HH:mm', { locale: nb })}
                        {nl.sent_at && ` · Sendt ${format(new Date(nl.sent_at), 'd. MMM yyyy HH:mm', { locale: nb })}`}
                        {nl.sent_count > 0 && ` · ${nl.sent_count} mottakere`}
                      </CardDescription>
                    </div>
                    {statusBadge(nl.status)}
                  </div>
                </CardHeader>
                <CardContent>
                  {editingId === nl.id ? (
                    <div className="space-y-4">
                      <div>
                        <Label>Emne</Label>
                        <Input value={editSubject} onChange={e => setEditSubject(e.target.value)} />
                      </div>
                      <div>
                        <Label>Innhold</Label>
                        <DefaultEditor
                          value={editHtml}
                          onChange={e => setEditHtml(e.target.value)}
                          className="min-h-[300px] bg-background border rounded-md"
                        />
                      </div>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          onClick={() => updateMutation.mutate({ id: nl.id, subject: editSubject, body_html: editHtml })}
                          disabled={updateMutation.isPending}
                        >
                          <Save className="h-4 w-4 mr-1" />{updateMutation.isPending ? 'Lagrer...' : 'Lagre'}
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => setEditingId(null)}>
                          <X className="h-4 w-4 mr-1" />Avbryt
                        </Button>
                        <Dialog>
                          <DialogTrigger asChild>
                            <Button variant="outline" size="sm" onClick={() => setPreviewHtml(editHtml)}>
                              <Eye className="h-4 w-4 mr-1" />Forhåndsvis
                            </Button>
                          </DialogTrigger>
                          <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
                            <DialogHeader><DialogTitle>{editSubject}</DialogTitle></DialogHeader>
                            <div className="mt-4 border rounded-lg p-4" dangerouslySetInnerHTML={{ __html: previewHtml || '' }} />
                          </DialogContent>
                        </Dialog>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button variant="outline" size="sm" onClick={() => setPreviewHtml(nl.body_html)}>
                            <Eye className="h-4 w-4 mr-1" />Forhåndsvis
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
                          <DialogHeader><DialogTitle>{nl.subject}</DialogTitle></DialogHeader>
                          <div className="mt-4 border rounded-lg p-4" dangerouslySetInnerHTML={{ __html: previewHtml || '' }} />
                        </DialogContent>
                      </Dialog>

                      {nl.status === 'sent' && (
                        <SentRecipientsDialog newsletterId={nl.id} subject={nl.subject} sentCount={nl.sent_count || 0} />
                      )}

                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => testSendMutation.mutate(nl.id)}
                        disabled={testSendMutation.isPending}
                      >
                        {testSendMutation.isPending ? (
                          <><Loader2 className="h-4 w-4 mr-1 animate-spin" />Sender test...</>
                        ) : (
                          <><MailCheck className="h-4 w-4 mr-1" />Send test til meg</>
                        )}
                      </Button>

                      {nl.status === 'draft' && (
                        <>
                          <Button variant="outline" size="sm" onClick={() => startEditing(nl)}>
                            <Pencil className="h-4 w-4 mr-1" />Rediger
                          </Button>
                          <Button size="sm" onClick={() => navigate(`/admin/newsletters/${nl.id}`)}>
                            <Eye className="h-4 w-4 mr-1" />Forhåndsvis, segmenter og godkjenn
                          </Button>
                          <div className="flex items-center gap-2">
                            <Select value={sendAudience} onValueChange={setSendAudience}>
                              <SelectTrigger className="w-[160px] h-8 text-xs">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="all">Alle abonnenter</SelectItem>
                                <SelectItem value="members">Kun medlemmer</SelectItem>
                                <SelectItem value="malklubben">Kun Målklubben</SelectItem>
                                <SelectItem value="partners">Kun partnere</SelectItem>
                              </SelectContent>
                            </Select>
                            <Button
                              size="sm"
                              onClick={() => {
                                const labels: Record<string, string> = { all: 'alle abonnenter', members: 'medlemmer', malklubben: 'Målklubben-deltakere', partners: 'partnere' };
                                if (confirm(`Sende nyhetsbrevet til ${labels[sendAudience] || 'alle'}?`)) {
                                  sendMutation.mutate({ newsletterId: nl.id, audience: sendAudience });
                                }
                              }}
                              disabled={sendMutation.isPending}
                            >
                              {sendMutation.isPending ? (
                                <><Loader2 className="h-4 w-4 mr-1 animate-spin" />Sender...</>
                              ) : (
                                <><Send className="h-4 w-4 mr-1" />Send</>
                              )}
                            </Button>
                          </div>
                        </>
                      )}

                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="destructive" size="sm">
                            <Trash2 className="h-4 w-4 mr-1" />Slett
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Slett nyhetsbrev?</AlertDialogTitle>
                            <AlertDialogDescription>
                              Er du sikker på at du vil slette «{nl.subject}»? Denne handlingen kan ikke angres.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Avbryt</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => deleteMutation.mutate(nl.id)}
                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            >
                              Slett
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </AdminLayout>
  );
};

export default AdminNewsletters;
