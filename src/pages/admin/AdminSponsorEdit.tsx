import { useParams } from 'react-router-dom';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { SponsorForm } from '@/components/admin/SponsorForm';
import { useSiteSponsor } from '@/hooks/useSiteSponsors';
import { Loader2 } from 'lucide-react';

const AdminSponsorEdit = () => {
  const { id } = useParams<{ id: string }>();
  const isNew = id === 'new';
  const { data: sponsor, isLoading } = useSiteSponsor(isNew ? '' : id || '');

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
            {isNew ? 'Legg til sponsor' : 'Rediger sponsor'}
          </h1>
          <p className="text-muted-foreground">
            {isNew ? 'Legg til en ny sponsor eller partner' : 'Gjør endringer'}
          </p>
        </div>

        <SponsorForm 
          sponsor={isNew ? null : sponsor} 
          mode={isNew ? 'create' : 'edit'} 
        />
      </div>
    </AdminLayout>
  );
};

export default AdminSponsorEdit;
