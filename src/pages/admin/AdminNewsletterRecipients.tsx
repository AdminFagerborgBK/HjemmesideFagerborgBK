import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ArrowLeft, Users, UserMinus, Loader2, Search, Mail } from 'lucide-react';

const INTEREST_LABELS: Record<string, string> = {
  kamper: 'Kamper',
  ungdom: 'Ungdom/B-lag',
  dugnad: 'Dugnad',
  arrangementer: 'Arrangementer',
  sponsor: 'Sponsor',
};

const TYPE_LABELS: Record<string, string> = {
  standard: 'Medlem',
  malklubben: 'Målklubben',
  partner: 'Partner',
};

interface Member {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  status: string;
  membership_type: string;
  team_group: string | null;
  interests: string[] | null;
  newsletter_opt_out: boolean;
}

const AdminNewsletterRecipients = () => {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'subscribers' | 'optedout' | 'all'>('subscribers');
  const [pendingId, setPendingId] = useState<string | null>(null);

  const { data: members = [], isLoading } = useQuery({
    queryKey: ['newsletter-recipients'],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('admin-memberships', {
        body: { action: 'list' },
      });
      if (error) throw error;
      const list: Member[] = Array.isArray(data) ? data : (data?.members ?? []);
      return list;
    },
  });

  const toggleOptOut = useMutation({
    mutationFn: async ({ id, optOut }: { id: string; optOut: boolean }) => {
      setPendingId(id);
      const { data, error } = await supabase.functions.invoke('admin-memberships', {
        body: { action: 'update', id, newsletter_opt_out: optOut },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
    },
    onSuccess: (_d, vars) => {
      toast.success(vars.optOut ? 'Meldt av nyhetsbrevet' : 'Meldt på nyhetsbrevet');
      queryClient.invalidateQueries({ queryKey: ['newsletter-recipients'] });
      queryClient.invalidateQueries({ queryKey: ['newsletter-subscriber-stats'] });
      queryClient.invalidateQueries({ queryKey: ['memberships'] });
    },
    onError: (err: any) => toast.error(`Feil: ${err.message}`),
    onSettled: () => setPendingId(null),
  });

  const activeMembers = useMemo(() => members.filter((m) => m.status === 'active'), [members]);

  const stats = useMemo(() => {
    const optedOut = activeMembers.filter((m) => m.newsletter_opt_out).length;
    return { total: activeMembers.length, subscribers: activeMembers.length - optedOut, optedOut };
  }, [activeMembers]);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return activeMembers
      .filter((m) =>
        filter === 'all' ? true : filter === 'subscribers' ? !m.newsletter_opt_out : m.newsletter_opt_out,
      )
      .filter((m) =>
        !q ||
        `${m.first_name} ${m.last_name}`.toLowerCase().includes(q) ||
        m.email.toLowerCase().includes(q),
      )
      .sort((a, b) => `${a.first_name} ${a.last_name}`.localeCompare(`${b.first_name} ${b.last_name}`, 'nb'));
  }, [activeMembers, filter, search]);

  const copyEmails = async () => {
    const emails = visible.filter((m) => !m.newsletter_opt_out).map((m) => m.email).join(', ');
    if (!emails) return toast.error('Ingen e-postadresser i listen');
    await navigator.clipboard.writeText(emails);
    toast.success('E-postadressene er kopiert');
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <Button variant="ghost" size="sm" asChild className="mb-1 -ml-2">
              <Link to="/admin/newsletters"><ArrowLeft className="h-4 w-4 mr-1" />Nyhetsbrev</Link>
            </Button>
            <h1 className="text-3xl font-bold">Mottakere</h1>
            <p className="text-muted-foreground">
              Alle aktive medlemmer får nyhetsbrevet automatisk. Her kan du melde noen av eller på.
            </p>
          </div>
          <Button variant="outline" onClick={copyEmails}>
            <Mail className="h-4 w-4 mr-2" />Kopier e-postadresser
          </Button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10"><Users className="h-5 w-5 text-primary" /></div>
              <div>
                <p className="text-2xl font-bold">{stats.subscribers}</p>
                <p className="text-xs text-muted-foreground">Mottar nyhetsbrev</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2 rounded-lg bg-muted"><UserMinus className="h-5 w-5 text-muted-foreground" /></div>
              <div>
                <p className="text-2xl font-bold">{stats.optedOut}</p>
                <p className="text-xs text-muted-foreground">Avmeldt</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2 rounded-lg bg-muted"><Users className="h-5 w-5 text-muted-foreground" /></div>
              <div>
                <p className="text-2xl font-bold">{stats.total}</p>
                <p className="text-xs text-muted-foreground">Aktive medlemmer</p>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Liste</CardTitle>
            <CardDescription>
              Medlemmer kan også melde seg av selv via lenken i nyhetsbrevet – listen oppdateres automatisk.
            </CardDescription>
            <div className="flex flex-wrap gap-2 pt-2">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  className="pl-9"
                  placeholder="Søk på navn eller e-post"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              <Select value={filter} onValueChange={(v: any) => setFilter(v)}>
                <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="subscribers">Mottar nyhetsbrev</SelectItem>
                  <SelectItem value="optedout">Avmeldt</SelectItem>
                  <SelectItem value="all">Alle aktive</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="p-8 text-center text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin mx-auto mb-2" />Laster mottakere...
              </div>
            ) : !visible.length ? (
              <p className="p-8 text-center text-muted-foreground">Ingen mottakere i dette utvalget.</p>
            ) : (
              <div className="divide-y">
                {visible.map((m) => (
                  <div key={m.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                    <div className="min-w-0">
                      <p className="font-medium truncate">{m.first_name} {m.last_name}</p>
                      <p className="text-xs text-muted-foreground truncate">{m.email}</p>
                      <div className="flex flex-wrap gap-1 mt-1">
                        <Badge variant="secondary" className="text-[10px]">
                          {TYPE_LABELS[m.membership_type] || m.membership_type}
                        </Badge>
                        {m.team_group && <Badge variant="outline" className="text-[10px]">{m.team_group}</Badge>}
                        {(m.interests ?? []).map((i) => (
                          <Badge key={i} variant="outline" className="text-[10px]">
                            {INTEREST_LABELS[i] || i}
                          </Badge>
                        ))}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">
                        {m.newsletter_opt_out ? 'Avmeldt' : 'Mottar'}
                      </span>
                      {pendingId === m.id ? (
                        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                      ) : (
                        <Switch
                          checked={!m.newsletter_opt_out}
                          onCheckedChange={(checked) =>
                            toggleOptOut.mutate({ id: m.id, optOut: !checked })
                          }
                        />
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
};

export default AdminNewsletterRecipients;
