import { useState } from 'react';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { 
  useAdminUsers, 
  useAddAdminUser, 
  useRemoveUserRole, 
  useRoleDefinitions,
  useUpdateUserRole,
  useSendPasswordReset 
} from '@/hooks/useAdminUsers';
import { useAdminAuth } from '@/hooks/useAdminAuth';
import { Loader2, UserPlus, Trash2, ShieldCheck, Users, Mail, KeyRound } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

const AdminUsers = () => {
  const { roles } = useAdminAuth();
  const isSuperAdmin = roles.includes('superadmin');
  const { data: adminUsers, isLoading } = useAdminUsers();
  const { data: roleDefinitions } = useRoleDefinitions();
  const addUser = useAddAdminUser();
  const removeRole = useRemoveUserRole();
  const updateRole = useUpdateUserRole();
  const sendPasswordReset = useSendPasswordReset();
  const { toast } = useToast();

  const [newEmail, setNewEmail] = useState('');
  const [newRole, setNewRole] = useState<'site_admin' | 'superadmin'>('site_admin');
  const [newAdminRoleId, setNewAdminRoleId] = useState<string>('');

  if (!isSuperAdmin) {
    return (
      <AdminLayout>
        <div className="flex flex-col items-center justify-center h-64 gap-4">
          <ShieldCheck className="h-16 w-16 text-muted-foreground" />
          <p className="text-muted-foreground">Kun superadmin kan administrere brukere</p>
        </div>
      </AdminLayout>
    );
  }

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEmail.trim()) return;

    try {
      await addUser.mutateAsync({ 
        email: newEmail.trim(), 
        role: newRole,
        adminRoleId: newRole === 'site_admin' ? newAdminRoleId : undefined
      });
      setNewEmail('');
      setNewAdminRoleId('');
      toast({ 
        title: 'Bruker lagt til', 
        description: `${newEmail} har fått ${newRole}-tilgang. En e-post er sendt for å sette passord.` 
      });
    } catch {
      // Error handled in hook
    }
  };

  const handleRemoveRole = async (userId: string, role: string) => {
    try {
      await removeRole.mutateAsync({ userId, role: role as 'site_admin' | 'superadmin' });
      toast({ title: 'Rolle fjernet' });
    } catch {
      // Error handled in hook
    }
  };

  const handleUpdateAdminRole = async (userId: string, adminRoleId: string) => {
    try {
      await updateRole.mutateAsync({ userId, adminRoleId });
    } catch {
      // Error handled in hook
    }
  };

  const handleSendPasswordReset = async (email: string) => {
    try {
      await sendPasswordReset.mutateAsync(email);
    } catch {
      // Error handled in hook
    }
  };

  const getRoleBadgeVariant = (role: string) => {
    switch (role) {
      case 'superadmin':
        return 'destructive';
      case 'site_admin':
        return 'default';
      default:
        return 'secondary';
    }
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Brukeradministrasjon</h1>
          <p className="text-muted-foreground">Administrer admin-brukere og roller</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UserPlus className="h-5 w-5" />
              Legg til admin-bruker
            </CardTitle>
            <CardDescription>
              Legg til en bruker som admin. Hvis brukeren ikke finnes, blir de opprettet og får en e-post for å sette passord.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleAddUser} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="email">E-post</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="bruker@example.com"
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="role">Hovedrolle</Label>
                  <Select value={newRole} onValueChange={(v) => setNewRole(v as 'site_admin' | 'superadmin')}>
                    <SelectTrigger id="role">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="site_admin">Site Admin</SelectItem>
                      <SelectItem value="superadmin">Superadmin</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              
              {newRole === 'site_admin' && roleDefinitions && (
                <div className="space-y-2">
                  <Label htmlFor="adminRole">Tilgangsnivå</Label>
                  <Select value={newAdminRoleId} onValueChange={setNewAdminRoleId}>
                    <SelectTrigger id="adminRole">
                      <SelectValue placeholder="Velg tilgangsnivå..." />
                    </SelectTrigger>
                    <SelectContent>
                      {roleDefinitions.map(rd => (
                        <SelectItem key={rd.id} value={rd.id}>
                          {rd.display_name} - {rd.description}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              
              <Button type="submit" disabled={addUser.isPending}>
                {addUser.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <UserPlus className="h-4 w-4 mr-2" />}
                Legg til og send invitasjon
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Admin-brukere
            </CardTitle>
            <CardDescription>
              Oversikt over alle brukere med admin-tilgang
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center h-32">
                <Loader2 className="h-6 w-6 animate-spin" />
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>E-post</TableHead>
                    <TableHead>Rolle</TableHead>
                    <TableHead>Tilgangsnivå</TableHead>
                    <TableHead>Lagt til</TableHead>
                    <TableHead className="w-32">Handlinger</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {adminUsers?.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-muted-foreground">
                        Ingen admin-brukere funnet
                      </TableCell>
                    </TableRow>
                  ) : (
                    adminUsers?.map((user) => (
                      <TableRow key={user.id}>
                        <TableCell className="font-medium">{user.email || 'Ukjent e-post'}</TableCell>
                        <TableCell>
                          <Badge variant={getRoleBadgeVariant(user.role)}>
                            {user.role}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {user.role === 'site_admin' ? (
                            <Select 
                              value={user.admin_role_id || ''} 
                              onValueChange={(v) => handleUpdateAdminRole(user.user_id, v)}
                            >
                              <SelectTrigger className="w-40">
                                <SelectValue placeholder="Velg..." />
                              </SelectTrigger>
                              <SelectContent>
                                {roleDefinitions?.map(rd => (
                                  <SelectItem key={rd.id} value={rd.id}>
                                    {rd.display_name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          ) : (
                            <span className="text-muted-foreground">Full tilgang</span>
                          )}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {new Date(user.created_at).toLocaleDateString('nb-NO')}
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button 
                              variant="ghost" 
                              size="icon"
                              title="Send passord-reset e-post"
                              onClick={() => handleSendPasswordReset(user.email)}
                              disabled={sendPasswordReset.isPending}
                            >
                              <Mail className="h-4 w-4" />
                            </Button>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive">
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Fjern admin-tilgang?</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Er du sikker på at du vil fjerne {user.role}-rollen fra {user.email}?
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Avbryt</AlertDialogCancel>
                                  <AlertDialogAction onClick={() => handleRemoveRole(user.user_id, user.role)}>
                                    Fjern
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
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <KeyRound className="h-5 w-5" />
              Tilgangsnivåer
            </CardTitle>
            <CardDescription>
              Forhåndsdefinerte roller med ulike tilganger
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-2">
              {roleDefinitions?.map(rd => (
                <div key={rd.id} className="border rounded-lg p-4">
                  <h3 className="font-semibold">{rd.display_name}</h3>
                  <p className="text-sm text-muted-foreground mb-2">{rd.description}</p>
                  <div className="flex flex-wrap gap-1">
                    {rd.permissions.map(p => (
                      <Badge key={p} variant="outline" className="text-xs">
                        {p.replace('_', ' ')}
                      </Badge>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
};

export default AdminUsers;
