import { useState } from 'react';
import { Link } from 'react-router-dom';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Checkbox } from '@/components/ui/checkbox';
import { useSiteRoster, useDeleteSiteRosterMember, useUpdateSiteRosterMember, useSiteRosterTrash, useRestoreSiteRosterMember, usePermanentDeleteSiteRosterMember, ROSTER_CATEGORIES } from '@/hooks/useSiteRoster';
import { Plus, Edit, Trash2, Loader2, Users, Eye, EyeOff, RotateCcw, Archive } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

const AdminRoster = () => {
  const { data: roster, isLoading } = useSiteRoster(true);
  const { data: trash } = useSiteRosterTrash();
  const deleteMember = useDeleteSiteRosterMember();
  const updateMember = useUpdateSiteRosterMember();
  const restoreMember = useRestoreSiteRosterMember();
  const permanentDelete = usePermanentDeleteSiteRosterMember();
  const [teamFilter, setTeamFilter] = useState<'alle' | 'A-laget' | 'B-laget'>('alle');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [showTrash, setShowTrash] = useState(false);

  const toggleSelect = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const selectAll = () => {
    if (!filteredRoster.length) return;
    if (selected.size === filteredRoster.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(filteredRoster.map(m => m.id)));
    }
  };

  const bulkSetStatus = async (status: 'active' | 'inactive') => {
    for (const id of selected) {
      await updateMember.mutateAsync({ id, status });
    }
    setSelected(new Set());
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

  const filteredRoster = roster?.filter(m => {
    if (teamFilter === 'alle') return true;
    // Staff categories don't have a team filter
    if (['Trenere', 'Ledere', 'Styret', 'Andre'].includes(m.category)) return true;
    return m.team === teamFilter;
  }) || [];

  const groupedRoster = ROSTER_CATEGORIES.reduce((acc, category) => {
    const members = filteredRoster.filter(m => m.category === category);
    if (members.length > 0) {
      acc[category] = members;
    }
    return acc;
  }, {} as Record<string, typeof roster>);

  const allSelected = filteredRoster.length ? selected.size === filteredRoster.length : false;

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold">Spillerstall</h1>
            <p className="text-muted-foreground">Administrer spillere, trenere og styret</p>
          </div>
          <div className="flex gap-2">
            <Button variant={showTrash ? 'default' : 'outline'} onClick={() => setShowTrash(!showTrash)}>
              <Archive className="h-4 w-4 mr-2" />
              Søppelpost {trash?.length ? `(${trash.length})` : ''}
            </Button>
            <Link to="/admin/roster/new">
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Legg til person
              </Button>
            </Link>
          </div>
        </div>

        {showTrash ? (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Søppelpost</CardTitle>
            </CardHeader>
            <CardContent>
              {!trash?.length ? (
                <p className="text-muted-foreground text-center py-8">Søppelposten er tom</p>
              ) : (
                <div className="space-y-3">
                  {trash.map(member => (
                    <div key={member.id} className="flex items-center gap-4 p-3 rounded-lg hover:bg-muted/50 transition-colors">
                      <Avatar className="h-10 w-10">
                        <AvatarImage src={member.photo_url || ''} alt={member.full_name} />
                        <AvatarFallback>{member.full_name.split(' ').map(n => n[0]).join('').slice(0, 2)}</AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <span className="font-medium">{member.full_name}</span>
                        <p className="text-xs text-muted-foreground">
                          Slettet {new Date(member.deleted_at).toLocaleDateString('nb-NO')}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm" onClick={() => restoreMember.mutate(member.id)} disabled={restoreMember.isPending}>
                          <RotateCcw className="h-3.5 w-3.5 mr-1.5" />
                          Gjenopprett
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="destructive" size="sm">
                              <Trash2 className="h-3.5 w-3.5 mr-1.5" />
                              Slett permanent
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Slett permanent?</AlertDialogTitle>
                              <AlertDialogDescription>
                                Er du sikker på at du vil slette {member.full_name} permanent? Denne handlingen kan ikke angres.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Avbryt</AlertDialogCancel>
                              <AlertDialogAction onClick={() => permanentDelete.mutate(member.id)}>
                                Slett permanent
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        ) : (
          <>
            {roster?.length ? (
              <div className="flex items-center gap-3 flex-wrap">
                <div className="flex gap-1 border border-border rounded-lg p-0.5">
                  {(['alle', 'A-laget', 'B-laget'] as const).map(t => (
                    <button
                      key={t}
                      onClick={() => { setTeamFilter(t); setSelected(new Set()); }}
                      className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                        teamFilter === t ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      {t === 'alle' ? 'Alle' : t}
                    </button>
                  ))}
                </div>

                <div className="h-6 w-px bg-border" />

                <div className="flex items-center gap-2">
                  <Checkbox
                    checked={allSelected}
                    onCheckedChange={selectAll}
                    id="select-all"
                  />
                  <label htmlFor="select-all" className="text-sm cursor-pointer">
                    Velg alle ({selected.size}/{filteredRoster.length})
                  </label>
                </div>
                {selected.size > 0 && (
                  <>
                    <Button size="sm" variant="outline" onClick={() => bulkSetStatus('active')} disabled={updateMember.isPending}>
                      <Eye className="h-3.5 w-3.5 mr-1.5" />
                      Sett aktiv ({selected.size})
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => bulkSetStatus('inactive')} disabled={updateMember.isPending}>
                      <EyeOff className="h-3.5 w-3.5 mr-1.5" />
                      Sett inaktiv ({selected.size})
                    </Button>
                  </>
                )}
              </div>
            ) : null}

            {!roster?.length ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <Users className="h-12 w-12 text-muted-foreground mb-4" />
                  <h3 className="text-lg font-medium">Ingen personer ennå</h3>
                  <p className="text-muted-foreground mb-4">Legg til den første personen</p>
                  <Link to="/admin/roster/new">
                    <Button>
                      <Plus className="h-4 w-4 mr-2" />
                      Legg til person
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-8">
                {Object.entries(groupedRoster).map(([category, members]) => (
                  <Card key={category}>
                    <CardHeader>
                      <CardTitle className="text-lg">{category}</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        {members?.map(member => (
                          <div 
                            key={member.id} 
                            className="flex items-center gap-4 p-3 rounded-lg hover:bg-muted/50 transition-colors"
                          >
                            <Checkbox
                              checked={selected.has(member.id)}
                              onCheckedChange={() => toggleSelect(member.id)}
                            />
                            <Avatar className="h-12 w-12">
                              <AvatarImage src={member.photo_url || ''} alt={member.full_name} />
                              <AvatarFallback>
                                {member.full_name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                              </AvatarFallback>
                            </Avatar>
                            
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                {member.shirt_number && (
                                  <span className="text-sm font-bold text-muted-foreground">
                                    #{member.shirt_number}
                                  </span>
                                )}
                                <span className="font-medium">{member.full_name}</span>
                                <Badge
                                  variant={member.status === 'active' ? 'default' : 'secondary'}
                                  className="cursor-pointer"
                                  onClick={() => updateMember.mutate({
                                    id: member.id,
                                    status: member.status === 'active' ? 'inactive' : 'active',
                                  })}
                                >
                                  {member.status === 'active' ? 'Aktiv' : 'Inaktiv'}
                                </Badge>
                              </div>
                              {member.role_or_position && (
                                <p className="text-sm text-muted-foreground">{member.role_or_position}</p>
                              )}
                            </div>

                            <div className="flex gap-2">
                              <Link to={`/admin/roster/${member.id}`}>
                                <Button variant="outline" size="icon">
                                  <Edit className="h-4 w-4" />
                                </Button>
                              </Link>
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button variant="outline" size="icon">
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Flytt til søppelpost?</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      {member.full_name} flyttes til søppelposten og kan gjenopprettes senere.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Avbryt</AlertDialogCancel>
                                    <AlertDialogAction onClick={() => deleteMember.mutate(member.id)}>
                                      Flytt til søppelpost
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </AdminLayout>
  );
};

export default AdminRoster;
