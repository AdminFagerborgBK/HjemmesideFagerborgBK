import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Receipt, Loader2, Send } from 'lucide-react';
import { useState } from 'react';
import GoalClubInvoicePreview from './GoalClubInvoicePreview';

const kr = (n: number) => `${n.toLocaleString('nb-NO')} kr`;
const d = (iso: string) => iso.slice(0, 10).split('-').reverse().join('.');

export default function GoalClubInvoices({season}:{season:number}) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [running, setRunning] = useState(false);
  const { data, isLoading } = useQuery({
    queryKey: ['goal-club-invoices',season],
    queryFn: async () => {
      const [inv, cl] = await Promise.all([
        supabase.from('goal_club_invoices').select('*').eq('season',season).order('season', { ascending: false }).order('name'),
        supabase.from('goal_club_season_closures').select('*').eq('season',season).order('season', { ascending: false }),
      ]);
      if (inv.error) throw inv.error;
      if (cl.error) throw cl.error;
      return { invoices: inv.data, closures: cl.data };
    },
  });
  const markPaid = useMutation({
    mutationFn: async ({ id, paid }: { id: string; paid: boolean }) => {
      const { error } = await supabase.from('goal_club_invoices').update({ paid_at: paid ? new Date().toISOString() : null }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['goal-club-invoices'] }),
    onError: () => toast({ title: 'Kunne ikke lagre betaling', variant: 'destructive' }),
  });

  const run = async () => {
    setRunning(true);
    const { data: r, error } = await supabase.functions.invoke('goal-club-season-close', { body: {season} });
    setRunning(false);
    qc.invalidateQueries({ queryKey: ['goal-club-invoices'] });
    if (error) return toast({ title: 'Utsending feilet', variant: 'destructive' });
    const msg: Record<string, string> = {
      season_not_finished: 'Sesongen er ikke ferdigspilt ennå – ingenting er sendt.',
      already_sent: 'Fakturaene for denne sesongen er allerede sendt.',
      completed: `Sendt ${r.sent} fakturaer.`,
      partial: `${r.sent} sendt, ${r.failed} feilet – prøv igjen.`,
    };
    toast({ title: msg[r.status] ?? 'Ferdig' });
  };

  const invoices = data?.invoices ?? [];
  const closure = data?.closures[0];
  const paid = invoices.filter((i) => i.paid_at);
  const total = invoices.reduce((s, i) => s + i.total_nok, 0);
  const paidSum = paid.reduce((s, i) => s + i.total_nok, 0);
  const hasFailed = invoices.some((i) => i.email_state === 'failed');

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
        <div>
          <CardTitle className="flex items-center gap-2"><Receipt className="h-5 w-5" />Fakturaer</CardTitle>
          <CardDescription>
            Sendes automatisk når A-laget har spilt siste kamp. Kontonummer 1600.20.64026, forfall 14 dager.
          </CardDescription>
        </div>
        <div className="flex flex-wrap gap-2 justify-end">
          <GoalClubInvoicePreview season={season} />
          {(hasFailed || closure?.status !== 'completed') && (
            <Button size="sm" variant="outline" onClick={run} disabled={running}>
              {running ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Send className="h-4 w-4 mr-2" />}
              {hasFailed ? 'Send feilede på nytt' : 'Sjekk og send nå'}
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading ? <Loader2 className="h-6 w-6 animate-spin" /> : !invoices.length ? (
          <p className="text-sm text-muted-foreground">Ingen fakturaer ennå. De lages når sesongen er ferdigspilt.</p>
        ) : (
          <>
            {closure && (
              <p className="text-sm">
                Sesong {closure.season}: {closure.goals} mål, {closure.final_position}. plass. Betalt {paid.length} av {invoices.length} ({kr(paidSum)} av {kr(total)}).
              </p>
            )}
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Navn</TableHead>
                    <TableHead>Referanse</TableHead>
                    <TableHead className="text-right">Beløp</TableHead>
                    <TableHead>Forfall</TableHead>
                    <TableHead>E-post</TableHead>
                    <TableHead>Betalt</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {invoices.map((i) => (
                    <TableRow key={i.id}>
                      <TableCell>
                        <div className="font-medium">{i.name}{i.is_winner && ' 🏆'}</div>
                        <div className="text-xs text-muted-foreground">{i.email}</div>
                      </TableCell>
                      <TableCell className="font-mono text-xs">{i.reference}</TableCell>
                      <TableCell className="text-right">{kr(i.total_nok)}<div className="text-xs text-muted-foreground">{i.amount_per_goal} × {i.goals}</div></TableCell>
                      <TableCell>{d(i.due_date)}</TableCell>
                      <TableCell>
                        {i.email_state === 'sent' ? <Badge>Sendt</Badge> : i.email_state === 'failed'
                          ? <Badge variant="destructive" title={i.email_error ?? ''}>Feilet</Badge> : <Badge variant="secondary">Venter</Badge>}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Checkbox checked={!!i.paid_at} aria-label={`Betalt ${i.name}`}
                            onCheckedChange={(v) => markPaid.mutate({ id: i.id, paid: v === true })} />
                          {i.paid_at && <span className="text-xs text-muted-foreground">{d(i.paid_at)}</span>}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
