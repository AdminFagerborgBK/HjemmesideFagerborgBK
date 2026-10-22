import { useState, useMemo } from 'react';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { useSiteSponsors, useUpdateSiteSponsor, useDeleteSiteSponsor, useSponsorClickStats, SiteSponsor } from '@/hooks/useSiteSponsors';
import { Loader2, Plus, Pencil, Trash2, Star, ExternalLink, BarChart3, MousePointerClick } from 'lucide-react';
import { Link } from 'react-router-dom';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

const CHART_COLORS = [
  'hsl(var(--primary))',
  'hsl(210, 70%, 50%)',
  'hsl(150, 60%, 45%)',
  'hsl(35, 85%, 55%)',
  'hsl(280, 60%, 55%)',
  'hsl(0, 70%, 55%)',
  'hsl(180, 55%, 45%)',
  'hsl(60, 70%, 45%)',
];

const AdminSponsors = () => {
  const { data: sponsors, isLoading } = useSiteSponsors(true);
  const updateSponsor = useUpdateSiteSponsor();
  const deleteSponsor = useDeleteSiteSponsor();
  const { data: clickStats, isLoading: statsLoading } = useSponsorClickStats();
  const [timePeriod, setTimePeriod] = useState<string>('all');

  const handleToggleActive = async (sponsor: SiteSponsor) => {
    await updateSponsor.mutateAsync({ id: sponsor.id, is_active: !sponsor.is_active });
  };

  const mainSponsors = sponsors?.filter(s => s.tier === 'main') || [];
  const partners = sponsors?.filter(s => s.tier === 'partner') || [];

  const handleDelete = async (id: string) => {
    await deleteSponsor.mutateAsync(id);
  };

  const formatMonth = (monthKey: string) => {
    const [year, month] = monthKey.split('-');
    const date = new Date(parseInt(year), parseInt(month) - 1);
    return date.toLocaleDateString('nb-NO', { month: 'short', year: 'numeric' });
  };

  const formatMonthShort = (monthKey: string) => {
    const [, month] = monthKey.split('-');
    const date = new Date(2024, parseInt(month) - 1);
    return date.toLocaleDateString('nb-NO', { month: 'short' });
  };

  // Filter stats by time period
  const filteredStats = useMemo(() => {
    if (!clickStats) return null;

    let cutoffDate: Date | null = null;
    const now = new Date();
    if (timePeriod === '3m') {
      cutoffDate = new Date(now.getFullYear(), now.getMonth() - 3, 1);
    } else if (timePeriod === '6m') {
      cutoffDate = new Date(now.getFullYear(), now.getMonth() - 6, 1);
    } else if (timePeriod === '1y') {
      cutoffDate = new Date(now.getFullYear() - 1, now.getMonth(), 1);
    }

    if (!cutoffDate) return clickStats;

    const cutoffKey = `${cutoffDate.getFullYear()}-${String(cutoffDate.getMonth() + 1).padStart(2, '0')}`;
    const filteredMonths = clickStats.months.filter(m => m >= cutoffKey);

    const filteredSponsorStats = clickStats.sponsorStats.map(s => {
      const filteredMonthly: Record<string, number> = {};
      let total = 0;
      filteredMonths.forEach(m => {
        const val = s.monthly[m] || 0;
        filteredMonthly[m] = val;
        total += val;
      });
      return { ...s, monthly: filteredMonthly, total };
    }).filter(s => s.total > 0).sort((a, b) => b.total - a.total);

    return { sponsorStats: filteredSponsorStats, months: filteredMonths };
  }, [clickStats, timePeriod]);

  // Build chart data
  const chartData = useMemo(() => {
    if (!filteredStats || filteredStats.months.length === 0) return [];
    return filteredStats.months.map(month => {
      const row: Record<string, string | number> = { month: formatMonthShort(month) };
      filteredStats.sponsorStats.forEach(s => {
        row[s.name] = s.monthly[month] || 0;
      });
      return row;
    });
  }, [filteredStats]);

  if (isLoading) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      </AdminLayout>
    );
  }

  const SponsorTable = ({ sponsors, title, description }: { sponsors: SiteSponsor[]; title: string; description: string }) => (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="flex items-center gap-2">
            <Star className="h-5 w-5" />
            {title}
          </CardTitle>
          <CardDescription>{description}</CardDescription>
        </div>
        <Link to="/admin/sponsors/new">
          <Button size="sm">
            <Plus className="h-4 w-4 mr-2" />
            Legg til
          </Button>
        </Link>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Logo</TableHead>
              <TableHead>Navn</TableHead>
              <TableHead>Nettside</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Rekkefølge</TableHead>
              <TableHead className="w-24"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sponsors.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                  Ingen {title.toLowerCase()} lagt til ennå
                </TableCell>
              </TableRow>
            ) : (
              sponsors.map((sponsor) => (
                <TableRow key={sponsor.id}>
                  <TableCell>
                    {sponsor.logo_url ? (
                      <img 
                        src={sponsor.logo_url} 
                        alt={sponsor.name} 
                        className="h-10 w-16 object-contain bg-white rounded"
                      />
                    ) : (
                      <div className="h-10 w-16 bg-muted rounded flex items-center justify-center text-xs text-muted-foreground">
                        Ingen logo
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="font-medium">{sponsor.name}</TableCell>
                  <TableCell>
                    {sponsor.website_url ? (
                      <a 
                        href={sponsor.website_url} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 text-primary hover:underline"
                      >
                        <ExternalLink className="h-3 w-3" />
                        Besøk
                      </a>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={sponsor.is_active}
                        onCheckedChange={() => handleToggleActive(sponsor)}
                      />
                      <span className={`text-xs ${sponsor.is_active ? 'text-green-600' : 'text-muted-foreground'}`}>
                        {sponsor.is_active ? 'Aktiv' : 'Inaktiv'}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {sponsor.sort_order}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Link to={`/admin/sponsors/${sponsor.id}`}>
                        <Button variant="ghost" size="icon">
                          <Pencil className="h-4 w-4" />
                        </Button>
                      </Link>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Slett sponsor?</AlertDialogTitle>
                            <AlertDialogDescription>
                              Er du sikker på at du vil slette {sponsor.name}? Denne handlingen kan ikke angres.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Avbryt</AlertDialogCancel>
                            <AlertDialogAction onClick={() => handleDelete(sponsor.id)}>
                              Slett
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Sponsorer</h1>
          <p className="text-muted-foreground">Administrer hovedsponsor og partnere</p>
        </div>

        <SponsorTable 
          sponsors={mainSponsors}
          title="Hovedsponsor"
          description="Hovedsponsoren vises prominent på forsiden"
        />

        <SponsorTable 
          sponsors={partners}
          title="Partnere"
          description="Partnere vises i sponsorkarusellen"
        />

        {/* Click Analytics Section */}
        <Card>
          <CardHeader className="flex flex-row items-start justify-between gap-4">
            <div>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5" />
                Klikkstatistikk
              </CardTitle>
              <CardDescription>
                Unike besøkende som har klikket på sponsorlenker fra hjemmesiden
              </CardDescription>
            </div>
            <Select value={timePeriod} onValueChange={setTimePeriod}>
              <SelectTrigger className="w-[160px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="3m">Siste 3 mnd</SelectItem>
                <SelectItem value="6m">Siste 6 mnd</SelectItem>
                <SelectItem value="1y">Siste 12 mnd</SelectItem>
                <SelectItem value="all">All tid</SelectItem>
              </SelectContent>
            </Select>
          </CardHeader>
          <CardContent className="space-y-8">
            {statsLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin" />
              </div>
            ) : !filteredStats || filteredStats.sponsorStats.length === 0 ? (
              <div className="text-center text-muted-foreground py-8">
                <MousePointerClick className="h-10 w-10 mx-auto mb-3 opacity-40" />
                <p>Ingen klikkdata registrert ennå</p>
                <p className="text-xs mt-1">Klikk på sponsorlenker på forsiden vil spores automatisk</p>
              </div>
            ) : (
              <>
                {/* Bar Chart */}
                {chartData.length > 0 && (
                  <div className="h-[300px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={chartData}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                        <XAxis dataKey="month" className="text-xs" tick={{ fill: 'hsl(var(--muted-foreground))' }} />
                        <YAxis allowDecimals={false} className="text-xs" tick={{ fill: 'hsl(var(--muted-foreground))' }} />
                        <Tooltip 
                          contentStyle={{ 
                            backgroundColor: 'hsl(var(--card))', 
                            border: '1px solid hsl(var(--border))',
                            borderRadius: '8px',
                            color: 'hsl(var(--foreground))'
                          }} 
                        />
                        <Legend />
                        {filteredStats.sponsorStats.map((sponsor, i) => (
                          <Bar 
                            key={sponsor.id} 
                            dataKey={sponsor.name} 
                            fill={CHART_COLORS[i % CHART_COLORS.length]}
                            radius={[4, 4, 0, 0]}
                          />
                        ))}
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}

                {/* Data Table */}
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="sticky left-0 bg-card z-10">Sponsor</TableHead>
                        {filteredStats.months.map(month => (
                          <TableHead key={month} className="text-center min-w-[80px]">
                            {formatMonth(month)}
                          </TableHead>
                        ))}
                        <TableHead className="text-center font-bold min-w-[80px]">Totalt</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredStats.sponsorStats.map(sponsor => (
                        <TableRow key={sponsor.id}>
                          <TableCell className="sticky left-0 bg-card z-10 font-medium">
                            {sponsor.name}
                          </TableCell>
                          {filteredStats.months.map(month => {
                            const count = sponsor.monthly[month] || 0;
                            return (
                              <TableCell key={month} className="text-center">
                                {count > 0 ? (
                                  <span className="inline-flex items-center justify-center min-w-[28px] px-2 py-0.5 rounded-full bg-primary/10 text-primary text-sm font-medium">
                                    {count}
                                  </span>
                                ) : (
                                  <span className="text-muted-foreground/40">0</span>
                                )}
                              </TableCell>
                            );
                          })}
                          <TableCell className="text-center">
                            <span className="inline-flex items-center justify-center min-w-[28px] px-2 py-0.5 rounded-full bg-primary text-primary-foreground text-sm font-bold">
                              {sponsor.total}
                            </span>
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
      </div>
    </AdminLayout>
  );
};

export default AdminSponsors;
