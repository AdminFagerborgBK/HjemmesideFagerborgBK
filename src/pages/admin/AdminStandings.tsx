import { useState } from 'react';
import { StandingsGraphicGenerator } from '@/components/admin/StandingsGraphicGenerator';
import { BackgroundLibrary } from '@/components/admin/BackgroundLibrary';
import { CombinedStandingsGraphic } from '@/components/admin/CombinedStandingsGraphic';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  useAdminHistoricalStandings,
  useCreateHistoricalStanding,
  useUpdateHistoricalStanding,
  useDeleteHistoricalStanding,
  HistoricalStanding,
} from '@/hooks/useAdminHistoricalStandings';
import { Loader2, Plus, Pencil, Trash2, ExternalLink, ArrowUp, ArrowDown } from 'lucide-react';
import { Lock, Unlock } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';

const TEAMS = ['A-laget', 'B-laget'] as const;
const DIVISIONS = ['1. divisjon', '2. divisjon', '3. divisjon', '4. divisjon', '5. divisjon', '6. divisjon', '7. divisjon'] as const;
const RESULTS = [
  { value: 'normal', label: 'Normal' },
  { value: 'promotion', label: 'Opprykk' },
  { value: 'qualification', label: 'Kvalifisering' },
  { value: 'relegation', label: 'Nedrykk' },
] as const;

interface StandingFormProps {
  standing?: HistoricalStanding;
  team: string;
  onClose: () => void;
}

const StandingForm = ({ standing, team, onClose }: StandingFormProps) => {
  const [year, setYear] = useState(standing?.year?.toString() || new Date().getFullYear().toString());
  const [division, setDivision] = useState(standing?.division || '5. divisjon');
  const [position, setPosition] = useState(standing?.position?.toString() || '');
  const [result, setResult] = useState<string>(standing?.result || 'normal');
  const [tableUrl, setTableUrl] = useState(standing?.table_url || '');
  const [locked, setLocked] = useState<boolean>(standing?.locked ?? false);

  const createMutation = useCreateHistoricalStanding();
  const updateMutation = useUpdateHistoricalStanding();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const data = {
      team,
      year: parseInt(year),
      division,
      position: position ? parseInt(position) : null,
      result: result as 'normal' | 'promotion' | 'relegation' | 'qualification',
      table_url: tableUrl || null,
      locked,
    };

    if (standing) {
      await updateMutation.mutateAsync({ id: standing.id, ...data });
    } else {
      await createMutation.mutateAsync(data);
    }
    onClose();
  };

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="year">År</Label>
          <Input
            id="year"
            type="number"
            value={year}
            onChange={(e) => setYear(e.target.value)}
            min="1914"
            max="2100"
            required
          />
        </div>
        <div>
          <Label htmlFor="position">Plassering</Label>
          <Input
            id="position"
            type="number"
            value={position}
            onChange={(e) => setPosition(e.target.value)}
            min="1"
            max="20"
            placeholder="Valgfritt"
          />
        </div>
      </div>

      <div>
        <Label htmlFor="division">Divisjon</Label>
        <Select value={division} onValueChange={setDivision}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {DIVISIONS.map((div) => (
              <SelectItem key={div} value={div}>{div}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div>
        <Label htmlFor="result">Resultat</Label>
        <Select value={result} onValueChange={setResult}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {RESULTS.map((r) => (
              <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div>
        <Label htmlFor="tableUrl">Lenke til tabell (valgfritt)</Label>
        <Input
          id="tableUrl"
          type="url"
          value={tableUrl}
          onChange={(e) => setTableUrl(e.target.value)}
          placeholder="https://www.fotball.no/..."
        />
        <p className="text-xs text-muted-foreground mt-1">
          Legg til lenke til sesongtabellen på fotball.no
        </p>
      </div>

      <div className="flex items-start justify-between gap-4 rounded-lg border p-3">
        <div className="space-y-0.5">
          <Label htmlFor="locked" className="flex items-center gap-2">
            <Lock className="h-4 w-4" /> Lås mot automatisk overskriving
          </Label>
          <p className="text-xs text-muted-foreground">
            Når låst vil ikke scraperen oppdatere plassering, divisjon eller resultat for denne sesongen.
          </p>
        </div>
        <Switch id="locked" checked={locked} onCheckedChange={setLocked} />
      </div>

      <div className="flex justify-end gap-2 pt-4">
        <Button type="button" variant="outline" onClick={onClose}>
          Avbryt
        </Button>
        <Button type="submit" disabled={isPending}>
          {isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          {standing ? 'Oppdater' : 'Legg til'}
        </Button>
      </div>
    </form>
  );
};

const StandingsTable = ({ team }: { team: string }) => {
  const { data: standings, isLoading } = useAdminHistoricalStandings(team);
  const deleteMutation = useDeleteHistoricalStanding();
  const [editingStanding, setEditingStanding] = useState<HistoricalStanding | null>(null);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-32">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Legg til sesong
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Legg til tabellplassering</DialogTitle>
            </DialogHeader>
            <StandingForm team={team} onClose={() => setIsAddDialogOpen(false)} />
          </DialogContent>
        </Dialog>
      </div>

      <div className="border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-20">År</TableHead>
              <TableHead>Divisjon</TableHead>
              <TableHead className="w-24">Plassering</TableHead>
              <TableHead className="w-24">Resultat</TableHead>
              <TableHead>Lenke</TableHead>
              <TableHead className="w-24 text-right">Handlinger</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {standings?.map((standing) => (
              <TableRow key={standing.id}>
                <TableCell className="font-medium">{standing.year}</TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    {standing.division}
                    {standing.locked && (
                      <span className="inline-flex items-center gap-1 text-xs text-amber-600" title="Låst mot scraper">
                        <Lock className="h-3 w-3" /> Låst
                      </span>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  {standing.position ? `${standing.position}. plass` : '–'}
                </TableCell>
                <TableCell>
                  {standing.result === 'promotion' && (
                    <span className="inline-flex items-center gap-1 text-green-600 text-sm">
                      <ArrowUp className="h-3 w-3" /> Opprykk
                    </span>
                  )}
                  {standing.result === 'relegation' && (
                    <span className="inline-flex items-center gap-1 text-red-600 text-sm">
                      <ArrowDown className="h-3 w-3" /> Nedrykk
                    </span>
                  )}
                  {standing.result === 'qualification' && (
                    <span className="inline-flex items-center gap-1 text-amber-600 text-sm">
                      Kvalifisering
                    </span>
                  )}
                  {standing.result === 'normal' && (
                    <span className="text-muted-foreground text-sm">–</span>
                  )}
                </TableCell>
                <TableCell>
                  {standing.table_url ? (
                    <a
                      href={standing.table_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-primary hover:underline text-sm"
                    >
                      <ExternalLink className="h-3 w-3" />
                      Se tabell
                    </a>
                  ) : (
                    <span className="text-muted-foreground text-sm">Ingen lenke</span>
                  )}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-1">
                    <Dialog open={editingStanding?.id === standing.id} onOpenChange={(open) => !open && setEditingStanding(null)}>
                      <DialogTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setEditingStanding(standing)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Rediger tabellplassering</DialogTitle>
                        </DialogHeader>
                        <StandingForm
                          standing={standing}
                          team={team}
                          onClose={() => setEditingStanding(null)}
                        />
                      </DialogContent>
                    </Dialog>

                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Slett tabellplassering?</AlertDialogTitle>
                          <AlertDialogDescription>
                            Er du sikker på at du vil slette {standing.year}-sesongen? Denne handlingen kan ikke angres.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Avbryt</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => deleteMutation.mutate(standing.id)}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          >
                            Slett
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {(!standings || standings.length === 0) && (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                  Ingen tabellplasseringer registrert for {team}.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};

const AdminStandings = () => {
  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold">Tabellhistorikk</h1>
            <p className="text-muted-foreground">Administrer historiske tabellplasseringer</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <CombinedStandingsGraphic />
            <StandingsGraphicGenerator team="A-laget" />
            <StandingsGraphicGenerator team="B-laget" />
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Tabellplasseringer</CardTitle>
            <CardDescription>
              Legg til, rediger eller slett historiske tabellplasseringer for A-laget og B-laget
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="A-laget">
              <TabsList className="mb-6">
                {TEAMS.map((team) => (
                  <TabsTrigger key={team} value={team}>{team}</TabsTrigger>
                ))}
              </TabsList>
              {TEAMS.map((team) => (
                <TabsContent key={team} value={team}>
                  <StandingsTable team={team} />
                </TabsContent>
              ))}
            </Tabs>
          </CardContent>
        </Card>

        <BackgroundLibrary />
      </div>
    </AdminLayout>
  );
};

export default AdminStandings;
