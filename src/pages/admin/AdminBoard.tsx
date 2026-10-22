import { useState, useEffect, useRef } from 'react';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { useBoardMembers, useUpdateBoardMembers, BoardMember } from '@/hooks/useBoardMembers';
import { useAllUsers } from '@/hooks/useAdminUsers';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Plus, Trash2, Save, GripVertical, Users, UserCheck } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAdminAuth } from '@/hooks/useAdminAuth';

const AdminBoard = () => {
  const { data: members = [], isLoading } = useBoardMembers();
  const { data: allUsers = [], isLoading: loadingUsers } = useAllUsers();
  const updateMembers = useUpdateBoardMembers();
  const { roles } = useAdminAuth();
  const isSuperAdmin = roles.includes('superadmin');
  const { toast } = useToast();
  const [editedMembers, setEditedMembers] = useState<BoardMember[] | null>(null);
  const newMemberRef = useRef<HTMLDivElement>(null);
  const [shouldScroll, setShouldScroll] = useState(false);
  
  const currentMembers = editedMembers ?? members;

  useEffect(() => {
    if (shouldScroll && newMemberRef.current) {
      newMemberRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
      setShouldScroll(false);
    }
  }, [shouldScroll, currentMembers]);
  
  const handleAddMember = () => {
    const newMember: BoardMember = {
      id: crypto.randomUUID(),
      name: '',
      role: '',
      email: '',
      userId: undefined,
    };
    setEditedMembers([...currentMembers, newMember]);
    setShouldScroll(true);
  };

  const handleSelectUser = (memberId: string, userId: string) => {
    const user = allUsers.find(u => u.id === userId);
    if (user) {
      setEditedMembers(
        currentMembers.map(m => m.id === memberId ? { 
          ...m, 
          email: user.email,
          userId: user.id,
          // Keep name if already set, otherwise leave empty for manual entry
          name: m.name || ''
        } : m)
      );
    }
  };
  
  const handleUpdateMember = (id: string, field: keyof BoardMember, value: string) => {
    setEditedMembers(
      currentMembers.map(m => m.id === id ? { ...m, [field]: value } : m)
    );
  };
  
  const handleRemoveMember = (id: string) => {
    setEditedMembers(currentMembers.filter(m => m.id !== id));
  };
  
  const handleSave = async () => {
    try {
      await updateMembers.mutateAsync(currentMembers);
      setEditedMembers(null);
      toast({
        title: 'Lagret',
        description: 'Styremedlemmene er oppdatert.',
      });
    } catch {
      toast({
        title: 'Feil',
        description: 'Kunne ikke lagre endringene.',
        variant: 'destructive',
      });
    }
  };
  
  const hasChanges = editedMembers !== null;
  
  if (isLoading) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </AdminLayout>
    );
  }
  
  return (
    <AdminLayout>
      <div className="max-w-3xl">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Users className="h-6 w-6" />
              Styret
            </h1>
            <p className="text-muted-foreground">Administrer styremedlemmer som vises på Om klubben-siden</p>
          </div>
          <div className="flex gap-2">
            <Button onClick={handleAddMember} variant="outline">
              <Plus className="h-4 w-4 mr-2" />
              Legg til
            </Button>
            <Button onClick={handleSave} disabled={!hasChanges || updateMembers.isPending}>
              <Save className="h-4 w-4 mr-2" />
              {updateMembers.isPending ? 'Lagrer...' : 'Lagre'}
            </Button>
          </div>
        </div>

        {isSuperAdmin && allUsers.length > 0 && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <UserCheck className="h-5 w-5" />
                Velg fra registrerte brukere
              </CardTitle>
              <CardDescription>
                Du kan velge styremedlemmer fra listen over registrerte brukere
              </CardDescription>
            </CardHeader>
          </Card>
        )}
        
        {currentMembers.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Ingen styremedlemmer lagt til ennå.</p>
              <Button onClick={handleAddMember} variant="outline" className="mt-4">
                <Plus className="h-4 w-4 mr-2" />
                Legg til første medlem
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {currentMembers.map((member, index) => (
              <Card key={member.id} ref={index === currentMembers.length - 1 ? newMemberRef : undefined}>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <GripVertical className="h-4 w-4" />
                      <span className="text-sm font-medium">Medlem {index + 1}</span>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleRemoveMember(member.id)}
                      className="text-destructive hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {isSuperAdmin && allUsers.length > 0 && (
                    <div className="space-y-2">
                      <Label>Velg bruker (valgfritt)</Label>
                      <Select 
                        value={member.userId || ''} 
                        onValueChange={(v) => handleSelectUser(member.id, v)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Velg fra registrerte brukere..." />
                        </SelectTrigger>
                        <SelectContent>
                          {allUsers.map(user => (
                            <SelectItem key={user.id} value={user.id}>
                              {user.email}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                  <div className="grid md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor={`name-${member.id}`}>Navn</Label>
                      <Input
                        id={`name-${member.id}`}
                        value={member.name}
                        onChange={(e) => handleUpdateMember(member.id, 'name', e.target.value)}
                        placeholder="Ola Nordmann"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor={`role-${member.id}`}>Rolle</Label>
                      <Input
                        id={`role-${member.id}`}
                        value={member.role}
                        onChange={(e) => handleUpdateMember(member.id, 'role', e.target.value)}
                        placeholder="Leder"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor={`email-${member.id}`}>E-post (valgfritt)</Label>
                    <Input
                      id={`email-${member.id}`}
                      type="email"
                      value={member.email || ''}
                      onChange={(e) => handleUpdateMember(member.id, 'email', e.target.value)}
                      placeholder="ola@fagerborgbk.no"
                    />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </AdminLayout>
  );
};

export default AdminBoard;
