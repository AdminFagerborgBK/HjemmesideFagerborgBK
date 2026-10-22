import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, Radio, ThumbsUp, SkipForward, BarChart2, Save, X } from 'lucide-react';
import { useAdminMatches } from '@/hooks/useAdminMatches';
import { formatOsloDateLong, formatOsloTime } from '@/lib/osloTime';
import { toast } from 'sonner';

const useMatchLivestreamStats = () => {
  return useQuery({
    queryKey: ['livestream-stats'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('livestream_stats')
        .select('match_id, action, created_at');
      if (error) throw error;
      return data;
    },
  });
};

const useUpdateLivestreamUrl = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, url }: { id: string; url: string | null }) => {
      const { error } = await supabase
        .from('matches')
        .update({ livestream_url: url || null })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-matches'] });
      queryClient.invalidateQueries({ queryKey: ['matches'] });
      toast.success('Direktelink oppdatert');
    },
    onError: (e) => toast.error('Kunne ikke lagre: ' + e.message),
  });
};

const MatchRow = ({
  match,
  stats,
}: {
  match: any;
  stats: { donated: number; skipped: number };
}) => {
  const [editing, setEditing] = useState(false);
  const [urlValue, setUrlValue] = useState((match.livestream_url as string) ?? '');
  const update = useUpdateLivestreamUrl();
  const total = stats.donated + stats.skipped;
  const donatedPct = total > 0 ? Math.round((stats.donated / total) * 100) : 0;
  const hasUrl = !!match.livestream_url;

  const save = () => {
    update.mutate({ id: match.id, url: urlValue });
    setEditing(false);
  };

  const clear = () => {
    setUrlValue('');
    update.mutate({ id: match.id, url: null });
    setEditing(false);
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-4">
          <div>
            <CardTitle className="text-base">
              {match.is_home ? 'Fagerborg' : match.opponent} vs{' '}
              {match.is_home ? match.opponent : 'Fagerborg'}
            </CardTitle>
            <p className="text-sm text-muted-foreground mt-0.5">
              {formatOsloDateLong(match.match_date)}
              {!match.time_tbd && ` · ${formatOsloTime(match.match_date)}`}
              {' · '}{match.competition}
            </p>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <Badge variant={match.status === 'upcoming' ? 'outline' : match.status === 'finished' ? 'secondary' : 'destructive'}>
              {match.status === 'upcoming' ? 'Kommende' : match.status === 'finished' ? 'Ferdig' : 'Live'}
            </Badge>
            {hasUrl && (
              <Badge variant="outline" className="text-primary border-primary/30 bg-primary/5">
                <Radio className="h-3 w-3 mr-1 animate-pulse" />
                Link satt
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* URL editor */}
        <div>
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1.5 flex items-center gap-1">
            <Radio className="h-3 w-3" /> Direktelink (YouTube/Hudl)
          </p>
          {editing ? (
            <div className="flex gap-2">
              <Input
                value={urlValue}
                onChange={(e) => setUrlValue(e.target.value)}
                placeholder="https://www.youtube.com/watch?v=..."
                className="flex-1 text-sm"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter') save();
                  if (e.key === 'Escape') setEditing(false);
                }}
              />
              <Button size="sm" onClick={save} disabled={update.isPending}>
                {update.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              </Button>
              {hasUrl && (
                <Button size="sm" variant="outline" onClick={clear} disabled={update.isPending}>
                  <X className="h-4 w-4" />
                </Button>
              )}
              <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>
                Avbryt
              </Button>
            </div>
          ) : (
            <button
              onClick={() => { setUrlValue(match.livestream_url ?? ''); setEditing(true); }}
              className="w-full text-left px-3 py-2 rounded-md border border-dashed border-border hover:border-primary hover:bg-muted/50 transition-colors text-sm"
            >
              {match.livestream_url ? (
                <span className="text-foreground truncate block">{match.livestream_url}</span>
              ) : (
                <span className="text-muted-foreground italic">Klikk for å legge inn direktelink…</span>
              )}
            </button>
          )}
        </div>

        {/* Stats */}
        {total > 0 && (
          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1.5 flex items-center gap-1">
              <BarChart2 className="h-3 w-3" /> Klikk-statistikk
            </p>
            <div className="grid grid-cols-3 gap-3 text-center">
              <div className="bg-muted rounded-lg p-2.5">
                <ThumbsUp className="h-4 w-4 mx-auto mb-0.5 text-primary" />
                <p className="text-xl font-bold text-primary">{stats.donated}</p>
                <p className="text-xs text-muted-foreground">Har vippset</p>
              </div>
              <div className="bg-muted rounded-lg p-2.5">
                <SkipForward className="h-4 w-4 mx-auto mb-0.5 text-muted-foreground" />
                <p className="text-xl font-bold">{stats.skipped}</p>
                <p className="text-xs text-muted-foreground">Hoppet over</p>
              </div>
              <div className="bg-primary/5 rounded-lg p-2.5">
                <BarChart2 className="h-4 w-4 mx-auto mb-0.5 text-primary" />
                <p className="text-xl font-bold text-primary">{donatedPct}%</p>
                <p className="text-xs text-muted-foreground">Vippset-andel</p>
              </div>
            </div>
            <div className="mt-2 h-1.5 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-primary rounded-full transition-all"
                style={{ width: `${donatedPct}%` }}
              />
            </div>
            <p className="text-xs text-muted-foreground mt-1 text-center">{total} besøkende totalt</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

const AdminLivestreamStats = () => {
  const { data: matches, isLoading: loadingMatches } = useAdminMatches();
  const { data: stats, isLoading: loadingStats } = useMatchLivestreamStats();
  const [filter, setFilter] = useState<'upcoming' | 'all'>('upcoming');

  const isLoading = loadingMatches || loadingStats;

  const statsByMatch = (stats || []).reduce<Record<string, { donated: number; skipped: number }>>((acc, row) => {
    if (!acc[row.match_id]) acc[row.match_id] = { donated: 0, skipped: 0 };
    if (row.action === 'donated') acc[row.match_id].donated++;
    if (row.action === 'skipped') acc[row.match_id].skipped++;
    return acc;
  }, {});

  const displayMatches = (matches || [])
    .filter((m) => !m.is_cancelled)
    .filter((m) => m.team === 'A-laget')
    .filter((m) => filter === 'all' || m.status !== 'finished')
    .sort((a, b) => {
      // upcoming first, then by date
      if (a.status === 'upcoming' && b.status !== 'upcoming') return -1;
      if (b.status === 'upcoming' && a.status !== 'upcoming') return 1;
      return new Date(a.match_date).getTime() - new Date(b.match_date).getTime();
    });

  return (
    <AdminLayout>
      <div className="space-y-6 max-w-3xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <Radio className="h-7 w-7" />
              Direktesending
            </h1>
            <p className="text-muted-foreground mt-1">
              Legg inn direktelink per kamp og se klikk-statistikk
            </p>
          </div>
          <div className="flex gap-2 mt-1">
            <Button
              size="sm"
              variant={filter === 'upcoming' ? 'default' : 'outline'}
              onClick={() => setFilter('upcoming')}
            >
              Kommende
            </Button>
            <Button
              size="sm"
              variant={filter === 'all' ? 'default' : 'outline'}
              onClick={() => setFilter('all')}
            >
              Alle kamper
            </Button>
          </div>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center h-40">
            <Loader2 className="h-8 w-8 animate-spin" />
          </div>
        ) : displayMatches.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Radio className="h-10 w-10 mx-auto mb-3 text-muted-foreground opacity-50" />
              <p className="text-muted-foreground">Ingen kamper å vise.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {displayMatches.map((match) => (
              <MatchRow
                key={match.id}
                match={match}
                stats={statsByMatch[match.id] || { donated: 0, skipped: 0 }}
              />
            ))}
          </div>
        )}
      </div>
    </AdminLayout>
  );
};

export default AdminLivestreamStats;
