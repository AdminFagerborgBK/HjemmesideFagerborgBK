import { useSportsSeason } from '@/hooks/useSportsSeason';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { useState } from 'react';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Target, Users, Building2, User, DollarSign, Loader2, Pencil, Trash2, RotateCcw } from 'lucide-react';
import { format } from 'date-fns';
import { nb } from 'date-fns/locale';
import { useToast } from '@/hooks/use-toast';
import GoalClubQR from '@/components/GoalClubQR';
import GoalClubPosterGenerator from '@/components/admin/GoalClubPosterGenerator';
import GoalClubInvoices from '@/components/admin/GoalClubInvoices';

interface GoalClubFullEntry {
  id: string;
  name: string;
  is_company: boolean;
  phone: string | null;
  email: string;
  amount_per_goal: number;
  goal_guess: number;
  created_at: string;
  deleted_at: string | null;
  is_anonymous: boolean;
}

const AdminGoalClub = () => {
  const {data:config}=useSportsSeason();
  const [selectedSeason,setSelectedSeason]=useState<number>();
  const season=selectedSeason ?? config?.season;
  const {data:seasons}=useQuery({queryKey:['sports-seasons'],queryFn:async()=>{const {data,error}=await supabase.from('sports_seasons').select('season').order('season',{ascending:false});if(error)throw error;return data;}});
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [editEntry, setEditEntry] = useState<GoalClubFullEntry | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [permanentDeleteId, setPermanentDeleteId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('active');

  // Edit form state
  const [editName, setEditName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editAmount, setEditAmount] = useState('');
  const [editGuess, setEditGuess] = useState('');
  const [editIsCompany, setEditIsCompany] = useState(false);
  const [editIsAnonymous, setEditIsAnonymous] = useState(false);

  const { data: allEntries, isLoading } = useQuery({
    queryKey: ['admin-goal-club-entries',season],
    enabled:!!season,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('goal_club_entries')
        .select('*')
        .eq('season',season ?? 0)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as unknown as GoalClubFullEntry[];
    },
  });

  const activeEntries = allEntries?.filter(e => !e.deleted_at) || [];
  const trashedEntries = allEntries?.filter(e => !!e.deleted_at) || [];

  const updateMutation = useMutation({
    mutationFn: async (entry: { id: string; name: string; email: string; phone: string | null; amount_per_goal: number; goal_guess: number; is_company: boolean; is_anonymous: boolean }) => {
      const { error } = await supabase
        .from('goal_club_entries')
        .update({
          name: entry.name,
          email: entry.email,
          phone: entry.phone,
          amount_per_goal: entry.amount_per_goal,
          goal_guess: entry.goal_guess,
          is_company: entry.is_company,
          is_anonymous: entry.is_anonymous,
        } as any)
        .eq('id', entry.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-goal-club-entries'] });
      queryClient.invalidateQueries({ queryKey: ['goal-club-entries'] });
      toast({ title: 'Oppdatert', description: 'Endringene er lagret.' });
      setEditEntry(null);
    },
    onError: (err: any) => {
      toast({ title: 'Feil', description: err.message, variant: 'destructive' });
    },
  });

  // Soft delete
  const softDeleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('goal_club_entries')
        .update({ deleted_at: new Date().toISOString() } as any)
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-goal-club-entries'] });
      queryClient.invalidateQueries({ queryKey: ['goal-club-entries'] });
      toast({ title: 'Flyttet til søppelkurv', description: 'Påmeldingen kan gjenopprettes.' });
      setDeleteId(null);
    },
    onError: (err: any) => {
      toast({ title: 'Feil', description: err.message, variant: 'destructive' });
    },
  });

  // Restore
  const restoreMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('goal_club_entries')
        .update({ deleted_at: null } as any)
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-goal-club-entries'] });
      queryClient.invalidateQueries({ queryKey: ['goal-club-entries'] });
      toast({ title: 'Gjenopprettet', description: 'Påmeldingen er tilbake.' });
    },
    onError: (err: any) => {
      toast({ title: 'Feil', description: err.message, variant: 'destructive' });
    },
  });

  // Permanent delete
  const permanentDeleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('goal_club_entries')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-goal-club-entries'] });
      queryClient.invalidateQueries({ queryKey: ['goal-club-entries'] });
      toast({ title: 'Permanent slettet', description: 'Påmeldingen er fjernet for godt.' });
      setPermanentDeleteId(null);
    },
    onError: (err: any) => {
      toast({ title: 'Feil', description: err.message, variant: 'destructive' });
    },
  });

  const openEdit = (entry: GoalClubFullEntry) => {
    setEditEntry(entry);
    setEditName(entry.name);
    setEditEmail(entry.email);
    setEditPhone(entry.phone || '');
    setEditAmount(entry.amount_per_goal.toString());
    setEditGuess(entry.goal_guess.toString());
    setEditIsCompany(entry.is_company);
    setEditIsAnonymous(!!entry.is_anonymous);
  };

  const handleSaveEdit = () => {
    if (!editEntry || !editName || !editEmail || !editAmount || !editGuess) return;
    updateMutation.mutate({
      id: editEntry.id,
      name: editName,
      email: editEmail,
      phone: editPhone || null,
      amount_per_goal: parseInt(editAmount),
      goal_guess: parseInt(editGuess),
      is_company: editIsCompany,
      is_anonymous: editIsAnonymous,
    });
  };

  const entries = activeEntries;
  const totalMembers = entries.length;
  const totalPerGoal = entries.reduce((sum, e) => sum + e.amount_per_goal, 0);
  const companies = entries.filter(e => e.is_company).length;
  const individuals = totalMembers - companies;

  const renderTable = (list: GoalClubFullEntry[], isTrashed: boolean) => (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>#</TableHead>
            <TableHead>Type</TableHead>
            <TableHead>Navn</TableHead>
            <TableHead>Anonym</TableHead>
            <TableHead>E-post</TableHead>
            <TableHead>Telefon</TableHead>
            <TableHead className="text-right">Beløp/mål</TableHead>
            <TableHead className="text-right">Måltips</TableHead>
            <TableHead>Dato</TableHead>
            <TableHead className="text-right">Handlinger</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {list.map((entry, i) => (
            <TableRow key={entry.id}>
              <TableCell className="font-medium">{i + 1}</TableCell>
              <TableCell>
                <Badge variant={entry.is_company ? 'secondary' : 'outline'} className="text-xs">
                  {entry.is_company ? (
                    <><Building2 className="h-3 w-3 mr-1" />Selskap</>
                  ) : (
                    <><User className="h-3 w-3 mr-1" />Privat</>
                  )}
                </Badge>
              </TableCell>
              <TableCell className="font-medium">{entry.name}</TableCell>
              <TableCell>
                {entry.is_anonymous && (
                  <Badge variant="outline" className="text-xs">Anonym</Badge>
                )}
              </TableCell>
              <TableCell>{entry.email}</TableCell>
              <TableCell>{entry.phone || '–'}</TableCell>
              <TableCell className="text-right font-bold">{entry.amount_per_goal} kr</TableCell>
              <TableCell className="text-right font-bold">{entry.goal_guess}</TableCell>
              <TableCell className="text-muted-foreground text-sm">
                {format(new Date(entry.created_at), 'd. MMM yyyy', { locale: nb })}
              </TableCell>
              <TableCell className="text-right">
                <div className="flex justify-end gap-1">
                  {isTrashed ? (
                    <>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-primary hover:text-primary" onClick={() => restoreMutation.mutate(entry.id)} title="Gjenopprett">
                        <RotateCcw className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => setPermanentDeleteId(entry.id)} title="Slett permanent">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </>
                  ) : (
                    <>
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(entry)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => setDeleteId(entry.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </>
                  )}
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Target className="h-6 w-6" />
            Målklubben {season}
          </h1>
          <p className="text-muted-foreground">Oversikt over alle påmeldte i Målklubben</p>
        </div>

        <Select value={season?.toString()} onValueChange={v=>setSelectedSeason(Number(v))}><SelectTrigger className="w-40" aria-label="Sesong"><SelectValue placeholder="Sesong" /></SelectTrigger><SelectContent>{seasons?.map(s=><SelectItem key={s.season} value={String(s.season)}>{s.season}</SelectItem>)}</SelectContent></Select>
        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center gap-3">
                <Users className="h-8 w-8 text-primary" />
                <div>
                  <p className="text-2xl font-bold">{totalMembers}</p>
                  <p className="text-xs text-muted-foreground">Påmeldte</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center gap-3">
                <DollarSign className="h-8 w-8 text-primary" />
                <div>
                  <p className="text-2xl font-bold">{totalPerGoal} kr</p>
                  <p className="text-xs text-muted-foreground">Totalt per mål</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center gap-3">
                <User className="h-8 w-8 text-primary" />
                <div>
                  <p className="text-2xl font-bold">{individuals}</p>
                  <p className="text-xs text-muted-foreground">Privatpersoner</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center gap-3">
                <Building2 className="h-8 w-8 text-primary" />
                <div>
                  <p className="text-2xl font-bold">{companies}</p>
                  <p className="text-xs text-muted-foreground">Selskaper</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {season && <GoalClubInvoices season={season} />}

        {/* Table with tabs */}
        <Card>
          <CardHeader>
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <div className="flex items-center justify-between">
                <CardTitle>Påmeldte</CardTitle>
                <TabsList>
                  <TabsTrigger value="active">Aktive ({activeEntries.length})</TabsTrigger>
                  <TabsTrigger value="trash">
                    Søppelkurv {trashedEntries.length > 0 && `(${trashedEntries.length})`}
                  </TabsTrigger>
                </TabsList>
              </div>
            </Tabs>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : activeTab === 'active' ? (
              !activeEntries.length ? (
                <p className="text-center text-muted-foreground py-8">Ingen påmeldte ennå</p>
              ) : renderTable(activeEntries, false)
            ) : (
              !trashedEntries.length ? (
                <p className="text-center text-muted-foreground py-8">Søppelkurven er tom</p>
              ) : renderTable(trashedEntries, true)
            )}
          </CardContent>
        </Card>

        {/* QR + Poster tools */}
        <div className="grid lg:grid-cols-3 gap-6">
          <Card className="lg:col-span-1">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Target className="h-5 w-5" />
                QR-kode til Målklubben
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">
                Last ned QR-koden og bruk den fritt på print, sosiale medier eller e-post. Den peker til påmeldingssiden.
              </p>
              <GoalClubQR size={220} showDownload />
            </CardContent>
          </Card>
          <div className="lg:col-span-2">
            <GoalClubPosterGenerator />
          </div>
        </div>
      </div>

      {/* Edit Dialog */}
      <Dialog open={!!editEntry} onOpenChange={(open) => !open && setEditEntry(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rediger påmelding</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="flex gap-2 p-1 bg-muted rounded-lg">
              <button
                type="button"
                onClick={() => setEditIsCompany(false)}
                className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-md text-sm font-medium transition-all ${!editIsCompany ? 'bg-background shadow-sm' : 'text-muted-foreground'}`}
              >
                <User className="h-4 w-4" /> Privatperson
              </button>
              <button
                type="button"
                onClick={() => setEditIsCompany(true)}
                className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-md text-sm font-medium transition-all ${editIsCompany ? 'bg-background shadow-sm' : 'text-muted-foreground'}`}
              >
                <Building2 className="h-4 w-4" /> Selskap
              </button>
            </div>
            <div>
              <Label>{editIsCompany ? 'Selskapsnavn' : 'Navn'}</Label>
              <Input value={editName} onChange={(e) => setEditName(e.target.value)} />
            </div>
            <div>
              <Label>E-post</Label>
              <Input type="email" value={editEmail} onChange={(e) => setEditEmail(e.target.value)} />
            </div>
            <div>
              <Label>Telefon</Label>
              <Input type="tel" value={editPhone} onChange={(e) => setEditPhone(e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Beløp per mål (kr)</Label>
                <Input type="number" min={1} value={editAmount} onChange={(e) => setEditAmount(e.target.value)} />
              </div>
              <div>
                <Label>Måltips</Label>
                <Input type="number" min={0} value={editGuess} onChange={(e) => setEditGuess(e.target.value)} />
              </div>
            </div>
            <div className="flex items-start gap-3 pt-2 border-t">
              <Checkbox
                id="edit-anonymous"
                checked={editIsAnonymous}
                onCheckedChange={(checked) => setEditIsAnonymous(checked === true)}
                className="mt-0.5"
              />
              <Label htmlFor="edit-anonymous" className="text-sm leading-snug cursor-pointer">
                Vis som anonym i offentlig medlemsliste
                <span className="block text-xs text-muted-foreground font-normal mt-0.5">
                  Navnet erstattes med «Anonym» for besøkende. Admin ser fortsatt all informasjon.
                </span>
              </Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditEntry(null)}>Avbryt</Button>
            <Button onClick={handleSaveEdit} disabled={updateMutation.isPending}>
              {updateMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Lagre
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Soft Delete Confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Flytt til søppelkurv?</AlertDialogTitle>
            <AlertDialogDescription>
              Påmeldingen flyttes til søppelkurven. Du kan gjenopprette den senere.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Avbryt</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteId && softDeleteMutation.mutate(deleteId)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Flytt til søppelkurv
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Permanent Delete Confirmation */}
      <AlertDialog open={!!permanentDeleteId} onOpenChange={(open) => !open && setPermanentDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Slett permanent?</AlertDialogTitle>
            <AlertDialogDescription>
              Er du sikker på at du vil slette denne påmeldingen permanent? Dette kan ikke angres.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Avbryt</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => permanentDeleteId && permanentDeleteMutation.mutate(permanentDeleteId)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Slett permanent
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AdminLayout>
  );
};

export default AdminGoalClub;