import { useParams } from 'react-router-dom';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { NewsForm } from '@/components/admin/NewsForm';
import { useAdminNewsArticle } from '@/hooks/useAdminNews';
import { Loader2 } from 'lucide-react';

const AdminPostEdit = () => {
  const { id } = useParams<{ id: string }>();
  const isNew = id === 'new';
  const { data: article, isLoading } = useAdminNewsArticle(isNew ? '' : id || '');

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
            {isNew ? 'Ny nyhet' : 'Rediger nyhet'}
          </h1>
          <p className="text-muted-foreground">
            {isNew ? 'Opprett en ny nyhet' : 'Gjør endringer i nyheten'}
          </p>
        </div>

        <NewsForm 
          article={isNew ? null : article} 
          mode={isNew ? 'create' : 'edit'} 
        />
      </div>
    </AdminLayout>
  );
};

export default AdminPostEdit;
