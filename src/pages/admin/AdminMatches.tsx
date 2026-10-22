import { useState } from 'react';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { useAdminMatches, useDeleteMatch } from '@/hooks/useAdminMatches';
import { Loader2, Plus, Pencil, Trash2, Calendar } from 'lucide-react';
import { Link } from 'react-router-dom';
import { formatOsloDateShort, formatOsloTime } from '@/lib/osloTime';
import { MatchGraphicGenerator } from '@/components/admin/MatchGraphicGenerator';
import { useOpponentLogos, findOpponentLogo } from '@/hooks/useOpponentLogos';

type TeamFilter = 'all' | 'A-laget' | 'B-laget';

const AdminMatches = () => {
  const [teamFilter, setTeamFilter] = useState<TeamFilter>('all');
  const { data: matches, isLoading } = useAdminMatches(teamFilter === 'all' ? undefined : teamFilter);
  const { data: logoMap } = useOpponentLogos();
  const deleteMatch = useDeleteMatch();

  const handleDelete = async (id: string) => {
    await deleteMatch.mutateAsync(id);
  };

  const getStatusBadge = (match: any) => {
    if (match.is_cancelled) {
      return <Badge variant="destructive" className="bg-orange-500 hover:bg-orange-600">Avlyst</Badge>;
    }
    switch (match.status) {
      case 'upcoming':
        return <Badge variant="secondary">Kommende</Badge>;
      case 'finished':
        return <Badge variant="default">Ferdig</Badge>;
      case 'live':
        return <Badge variant="destructive">Live</Badge>;
      default:
        return <Badge variant="outline">{match.status}</Badge>;
    }
  };

  const isTrainingMatch = (competition: string) => {
    return competition.toLowerCase().includes('trening');
  };

  if (isLoading) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Kamper</h1>
            <p className="text-muted-foreground">Administrer treningskamper og andre kamper</p>
          </div>
          <Link to="/admin/matches/new">
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Legg til kamp
            </Button>
          </Link>
        </div>

        {/* Filter tabs */}
        <div className="flex gap-2">
          {(['all', 'A-laget', 'B-laget'] as TeamFilter[]).map((filter) => (
            <Button
              key={filter}
              variant={teamFilter === filter ? 'default' : 'outline'}
              size="sm"
              onClick={() => setTeamFilter(filter)}
            >
              {filter === 'all' ? 'Alle lag' : filter}
            </Button>
          ))}
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Kampprogram
            </CardTitle>
            <CardDescription>
              Seriekamper synkroniseres automatisk fra Fotball.no. Her kan du legge til treningskamper og cuper manuelt.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Dato</TableHead>
                  <TableHead>Lag</TableHead>
                  <TableHead>Motstander</TableHead>
                  <TableHead>Turnering</TableHead>
                  <TableHead>Sted</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Resultat</TableHead>
                  <TableHead className="w-24"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {!matches || matches.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                      Ingen kamper funnet
                    </TableCell>
                  </TableRow>
                ) : (
                  matches.map((match) => (
                    <TableRow key={match.id} className={isTrainingMatch(match.competition) ? 'bg-muted/30' : ''}>
                      <TableCell className="font-medium">
                        <div className="flex flex-col">
                          <span>{formatOsloDateShort(match.match_date)}</span>
                          <span className="text-xs text-muted-foreground">{formatOsloTime(match.match_date)}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{match.team}</Badge>
                      </TableCell>
                      <TableCell>
                        <span className={match.is_home ? '' : 'text-muted-foreground'}>
                          {match.is_home ? 'vs ' : '@ '}
                        </span>
                        {match.opponent}
                      </TableCell>
                      <TableCell>
                        <span className={isTrainingMatch(match.competition) ? 'font-medium text-primary' : ''}>
                          {match.competition}
                        </span>
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {match.venue}
                      </TableCell>
                      <TableCell>
                        {getStatusBadge(match)}
                      </TableCell>
                      <TableCell>
                        {match.status === 'finished' && match.home_score !== null && match.away_score !== null ? (
                          <span className="font-bold">
                            {match.is_home 
                              ? `${match.home_score}-${match.away_score}`
                              : `${match.away_score}-${match.home_score}`
                            }
                          </span>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <MatchGraphicGenerator match={match} resolvedOpponentLogo={findOpponentLogo(logoMap, match.opponent, match.opponent_logo_url)} />
                          <Link to={`/admin/matches/${match.id}`}>
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
                                <AlertDialogTitle>Slett kamp?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Er du sikker på at du vil slette kampen mot {match.opponent}? Denne handlingen kan ikke angres.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Avbryt</AlertDialogCancel>
                                <AlertDialogAction onClick={() => handleDelete(match.id)}>
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
      </div>
    </AdminLayout>
  );
};

export default AdminMatches;
