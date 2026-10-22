import { useParams } from 'react-router-dom';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { RosterForm } from '@/components/admin/RosterForm';
import { useSiteRosterMember } from '@/hooks/useSiteRoster';
import { Loader2 } from 'lucide-react';

const AdminRosterEdit = () => {
  const { id } = useParams<{ id: string }>();
  const isNew = id === 'new';
  const { data: member, isLoading } = useSiteRosterMember(isNew ? '' : id || '');

  if (!isNew && isLoading) {
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
        <div>
          <h1 className="text-3xl font-bold">
            {isNew ? 'Legg til person' : 'Rediger person'}
          </h1>
          <p className="text-muted-foreground">
            {isNew ? 'Legg til en ny person i spillerstallen' : 'Gjør endringer'}
          </p>
        </div>

        <RosterForm 
          member={isNew ? null : member} 
          mode={isNew ? 'create' : 'edit'} 
        />
      </div>
    </AdminLayout>
  );
};

export default AdminRosterEdit;
