import { useState } from 'react';
import { format } from 'date-fns';
import { nb } from 'date-fns/locale';
import { Users, Mail, Trash2, CheckCircle, Clock, XCircle, MoreHorizontal, UserPlus, Target, ExternalLink } from 'lucide-react';
import { Link } from 'react-router-dom';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { MemberEmailDialog } from '@/components/admin/MemberEmailDialog';
import { FollowUpEmailDialog } from '@/components/admin/FollowUpEmailDialog';
import { useMemberships } from '@/hooks/useMemberships';
import { useMembershipEmail } from '@/hooks/useMembershipEmail';
import { useFollowUpEmail } from '@/hooks/useFollowUpEmail';
import { useToast } from '@/hooks/use-toast';

const statusConfig = {
  pending: { label: 'Venter', icon: Clock, variant: 'secondary' as const },
  active: { label: 'Aktiv', icon: CheckCircle, variant: 'default' as const },
  expired: { label: 'Utløpt', icon: XCircle, variant: 'outline' as const },
  cancelled: { label: 'Kansellert', icon: XCircle, variant: 'destructive' as const },
};

const AdminMembers = () => {
  const { toast } = useToast();
  const {
    memberships,
    isLoading,
    selectedIds,
    toggleSelect,
    setSelected,
    clearSelection,
    updateStatus,
    deleteMembership,
  } = useMemberships();

  const {
    settings,
    updateSettings,
    subject,
    setSubject,
    generateHtmlForMember,
    generateKidForMember,
    sendEmails,
    resetSettings,
  } = useMembershipEmail();

  const {
    settings: followUpSettings,
    updateSettings: updateFollowUpSettings,
    subject: followUpSubject,
    setSubject: setFollowUpSubject,
    generateHtmlForMember: generateFollowUpHtml,
    sendEmails: sendFollowUpEmails,
  } = useFollowUpEmail();

  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [emailDialogOpen, setEmailDialogOpen] = useState(false);
  const [followUpDialogOpen, setFollowUpDialogOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'club' | 'malklubben'>('club');

  // Klubbmedlemmer = de som faktisk har meldt seg inn (standard medlemskap).
  // Målklubben = personer som har meldt seg på Målklubben (membership_type='malklubben'),
  // som typisk får nyhetsbrev men ikke er fullverdige klubbmedlemmer.
  const clubMembers = memberships.filter((m: any) => (m.membership_type || 'standard') === 'standard');
  const malklubbenMembers = memberships.filter((m: any) => m.membership_type === 'malklubben');
  const visibleMembers = activeTab === 'club' ? clubMembers : malklubbenMembers;

  const selectedMembers = visibleMembers.filter(m => selectedIds.has(m.id));

  const handleTabChange = (value: string) => {
    setActiveTab(value as 'club' | 'malklubben');
    clearSelection();
  };

  const allVisibleSelected = visibleMembers.length > 0 && visibleMembers.every(m => selectedIds.has(m.id));
  const toggleSelectAllVisible = () => {
    if (allVisibleSelected) {
      clearSelection();
    } else {
      setSelected(new Set(visibleMembers.map(m => m.id)));
    }
  };

  const openEmailDialog = () => {
    if (selectedMembers.length === 0) {
      toast({ title: 'Ingen valgt', description: 'Velg minst ett medlem', variant: 'destructive' });
      return;
    }
    setEmailDialogOpen(true);
  };

  const openFollowUpDialog = () => {
    if (selectedMembers.length === 0) {
      toast({ title: 'Ingen valgt', description: 'Velg minst ett medlem', variant: 'destructive' });
      return;
    }
    setFollowUpDialogOpen(true);
  };

  const handleSendEmails = () => {
    sendEmails.mutate(selectedMembers, {
      onSuccess: () => {
        setEmailDialogOpen(false);
        clearSelection();
      },
    });
  };

  const handleSendFollowUp = () => {
    sendFollowUpEmails.mutate(selectedMembers, {
      onSuccess: () => {
        setFollowUpDialogOpen(false);
        clearSelection();
      },
    });
  };

  const handleDelete = () => {
    if (deleteId) {
      deleteMembership.mutate(deleteId);
      setDeleteId(null);
    }
  };

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
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <Users className="h-8 w-8" />
              Medlemmer
            </h1>
            <p className="text-muted-foreground mt-1">
              {clubMembers.length} klubbmedlemmer · {malklubbenMembers.length} i Målklubben
            </p>
          </div>
          
          {selectedIds.size > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">
                {selectedIds.size} valgt
              </span>
              <Button variant="outline" size="sm" onClick={clearSelection}>
                Fjern valg
              </Button>
              <Button variant="outline" onClick={openEmailDialog}>
                <Mail className="h-4 w-4 mr-2" />
                Betalings-e-post
              </Button>
              <Button onClick={openFollowUpDialog}>
                <UserPlus className="h-4 w-4 mr-2" />
                Spond-e-post
              </Button>
            </div>
          )}
        </div>

        <Tabs value={activeTab} onValueChange={handleTabChange}>
          <TabsList>
            <TabsTrigger value="club" className="gap-2">
              <Users className="h-4 w-4" />
              Klubbmedlemmer ({clubMembers.length})
            </TabsTrigger>
            <TabsTrigger value="malklubben" className="gap-2">
              <Target className="h-4 w-4" />
              Målklubben ({malklubbenMembers.length})
            </TabsTrigger>
          </TabsList>
        </Tabs>

        {activeTab === 'malklubben' && (
          <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 text-sm text-muted-foreground flex items-start justify-between gap-3 flex-wrap">
            <div>
              Dette er personer fra Målklubben som har krysset av for å motta nyhetsbrev.
              De er <strong>ikke</strong> fullverdige klubbmedlemmer. Komplett register med beløp per mål
              og måltips (for fakturering ved sesongslutt) finnes i Målklubben-administrasjonen.
            </div>
            <Button asChild variant="outline" size="sm">
              <Link to="/admin/goal-club">
                <ExternalLink className="h-4 w-4 mr-2" />
                Åpne Målklubb-registeret
              </Link>
            </Button>
          </div>
        )}

        <div className="bg-card rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">
                  <Checkbox
                    checked={allVisibleSelected}
                    onCheckedChange={toggleSelectAllVisible}
                  />
                </TableHead>
                <TableHead>Navn</TableHead>
                <TableHead>E-post</TableHead>
                <TableHead>Telefon</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Registrert</TableHead>
                <TableHead className="w-12"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visibleMembers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                    {activeTab === 'club' ? 'Ingen klubbmedlemmer registrert ennå' : 'Ingen i Målklubben ennå'}
                  </TableCell>
                </TableRow>
              ) : (
                visibleMembers.map((member) => {
                  const status = statusConfig[member.status as keyof typeof statusConfig] || statusConfig.pending;
                  const StatusIcon = status.icon;

                  return (
                    <TableRow key={member.id}>
                      <TableCell>
                        <Checkbox
                          checked={selectedIds.has(member.id)}
                          onCheckedChange={() => toggleSelect(member.id)}
                        />
                      </TableCell>
                      <TableCell className="font-medium">
                        {member.first_name} {member.last_name}
                      </TableCell>
                      <TableCell>{member.email}</TableCell>
                      <TableCell>{member.phone || '-'}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="capitalize">
                          {member.membership_type === 'standard' ? 'Medlem' : member.membership_type}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={status.variant} className="gap-1">
                          <StatusIcon className="h-3 w-3" />
                          {status.label}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {format(new Date(member.created_at), 'd. MMM yyyy', { locale: nb })}
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              onClick={() => updateStatus.mutate({ id: member.id, status: 'active' })}
                            >
                              <CheckCircle className="h-4 w-4 mr-2" />
                              Sett som aktiv
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => updateStatus.mutate({ id: member.id, status: 'pending' })}
                            >
                              <Clock className="h-4 w-4 mr-2" />
                              Sett som venter
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => updateStatus.mutate({ id: member.id, status: 'cancelled' })}
                            >
                              <XCircle className="h-4 w-4 mr-2" />
                              Kanseller
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              className="text-destructive"
                              onClick={() => setDeleteId(member.id)}
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              Slett
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Delete confirmation dialog */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Slett medlem?</AlertDialogTitle>
            <AlertDialogDescription>
              Er du sikker på at du vil slette dette medlemmet? Denne handlingen kan ikke angres.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Avbryt</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">
              Slett
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <MemberEmailDialog
        open={emailDialogOpen}
        onOpenChange={setEmailDialogOpen}
        selectedMembers={selectedMembers}
        settings={settings}
        updateSettings={updateSettings}
        subject={subject}
        setSubject={setSubject}
        onSend={handleSendEmails}
        onReset={resetSettings}
        isSending={sendEmails.isPending}
        generatePreview={generateHtmlForMember}
        generateKid={generateKidForMember}
      />

      <FollowUpEmailDialog
        open={followUpDialogOpen}
        onOpenChange={setFollowUpDialogOpen}
        selectedMembers={selectedMembers}
        settings={followUpSettings}
        updateSettings={updateFollowUpSettings}
        subject={followUpSubject}
        setSubject={setFollowUpSubject}
        onSend={handleSendFollowUp}
        isSending={sendFollowUpEmails.isPending}
        generatePreview={generateFollowUpHtml}
      />
    </AdminLayout>
  );
};

export default AdminMembers;
