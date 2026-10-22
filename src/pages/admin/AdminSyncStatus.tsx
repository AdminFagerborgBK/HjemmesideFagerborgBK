import { useEffect, useState } from 'react';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import { RefreshCw, CheckCircle2, AlertTriangle, Clock } from 'lucide-react';
import { toast } from 'sonner';

type SyncRow = {
  job_key: string;
  last_attempt_at: string | null;
  last_success_at: string | null;
  last_error: string | null;
  last_updated_count: number | null;
  last_details: any;
  updated_at: string;
};

const STALE_HOURS = 24;

const JOBS: { key: string; label: string; fn: string }[] = [
  { key: 'sync-matches', label: 'Kamper (sync-matches)', fn: 'sync-matches' },
  { key: 'grasrot-scrape', label: 'Grasrotandelen (grasrot-scrape)', fn: 'grasrot-scrape' },
];

const MANUAL_JOBS: { label: string; fn: string }[] = [
  { label: 'Oppdater tabell', fn: 'standings-scraper' },
  { label: 'Oppdater divisjonskamper', fn: 'division-matches-sync' },
];


function formatRel(iso: string | null) {
  if (!iso) return 'Aldri';
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'akkurat nå';
  if (m < 60) return `${m} min siden`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} t siden`;
  return `${Math.floor(h / 24)} dager siden`;
}

function formatAbs(iso: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('nb-NO', { timeZone: 'Europe/Oslo' });
}

const AdminSyncStatus = () => {
  const [running, setRunning] = useState<string | null>(null);

  const { data, refetch, isLoading } = useQuery({
    queryKey: ['sync-status'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sync_status')
        .select('*')
        .in('job_key', JOBS.map(j => j.key));
      if (error) throw error;
      return data as SyncRow[];
    },
    staleTime: 60_000,
  });

  const runJob = async (fn: string) => {
    setRunning(fn);
    try {
      const { error } = await supabase.functions.invoke(fn, { body: {} });
      if (error) throw error;
      toast.success(`${fn} kjørt`);
      await refetch();
    } catch (e: any) {
      toast.error(`Feil: ${e.message ?? String(e)}`);
    } finally {
      setRunning(null);
    }
  };

  return (
    <AdminLayout>
      <div className="space-y-6 max-w-4xl">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Sync-status</h1>
            <p className="text-muted-foreground">
              Siste kjøring av automatiske scrapere. Varsel sendes på e-post hvis en jobb ikke har lykkes på {STALE_HOURS} timer.
            </p>
          </div>
          <Button variant="outline" onClick={() => refetch()} disabled={isLoading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            Oppdater
          </Button>
        </div>

        <div className="grid gap-4">
          {JOBS.map(job => {
            const row = data?.find(d => d.job_key === job.key);
            const lastSuccess = row?.last_success_at ? new Date(row.last_success_at).getTime() : 0;
            const ageHours = lastSuccess ? (Date.now() - lastSuccess) / 3_600_000 : Infinity;
            const isStale = ageHours > STALE_HOURS;
            const hasError = !!row?.last_error;

            return (
              <Card key={job.key} className={isStale ? 'border-destructive/50' : ''}>
                <CardHeader>
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        {job.label}
                        {isStale ? (
                          <Badge variant="destructive" className="gap-1">
                            <AlertTriangle className="h-3 w-3" /> Utdatert
                          </Badge>
                        ) : hasError ? (
                          <Badge variant="secondary" className="gap-1">
                            <AlertTriangle className="h-3 w-3" /> Forrige feil
                          </Badge>
                        ) : row?.last_success_at ? (
                          <Badge variant="default" className="gap-1 bg-green-600">
                            <CheckCircle2 className="h-3 w-3" /> OK
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="gap-1">
                            <Clock className="h-3 w-3" /> Ingen data
                          </Badge>
                        )}
                      </CardTitle>
                      <CardDescription>
                        Siste suksess: {formatRel(row?.last_success_at ?? null)} ({formatAbs(row?.last_success_at ?? null)})
                      </CardDescription>
                    </div>
                    <Button
                      onClick={() => runJob(job.fn)}
                      disabled={running === job.fn}
                      size="sm"
                    >
                      <RefreshCw className={`h-4 w-4 mr-2 ${running === job.fn ? 'animate-spin' : ''}`} />
                      Kjør nå
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <div className="text-muted-foreground">Siste forsøk</div>
                      <div className="font-medium">{formatAbs(row?.last_attempt_at ?? null)}</div>
                    </div>
                    <div>
                      <div className="text-muted-foreground">Oppdaterte poster (sist)</div>
                      <div className="font-medium">{row?.last_updated_count ?? 0}</div>
                    </div>
                  </div>
                  {row?.last_error && (
                    <div className="bg-destructive/10 border border-destructive/30 rounded p-3">
                      <div className="font-medium text-destructive mb-1">Siste feil</div>
                      <pre className="text-xs whitespace-pre-wrap break-words">{row.last_error}</pre>
                    </div>
                  )}
                  {row?.last_details != null && (
                    <details className="text-xs">
                      <summary className="cursor-pointer text-muted-foreground hover:text-foreground">Detaljer</summary>
                      <pre className="mt-2 p-2 bg-muted rounded overflow-x-auto">
                        {JSON.stringify(row.last_details, null, 2)}
                      </pre>
                    </details>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Kjør oppdatering manuelt</CardTitle>
            <CardDescription>
              Tabell og divisjonskamper oppdateres automatisk kun når fotball.no faktisk har endret data.
              Trenger du en oppdatering med en gang, kan du hente den her.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-3">
            {MANUAL_JOBS.map(job => (
              <Button
                key={job.fn}
                variant="outline"
                onClick={() => runJob(job.fn)}
                disabled={running === job.fn}
                size="sm"
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${running === job.fn ? 'animate-spin' : ''}`} />
                {job.label}
              </Button>
            ))}
          </CardContent>
        </Card>
      </div>

    </AdminLayout>
  );
};

export default AdminSyncStatus;