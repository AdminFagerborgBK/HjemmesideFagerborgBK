import { useParams } from 'react-router-dom';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { VideoForm } from '@/components/admin/VideoForm';
import { useSiteVideo } from '@/hooks/useSiteVideos';
import { Loader2 } from 'lucide-react';

const AdminVideoEdit = () => {
  const { id } = useParams<{ id: string }>();
  const isNew = id === 'new';
  const { data: video, isLoading } = useSiteVideo(isNew ? '' : id || '');

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
            {isNew ? 'Ny video' : 'Rediger video'}
          </h1>
          <p className="text-muted-foreground">
            {isNew ? 'Legg til en ny video' : 'Gjør endringer i videoen'}
          </p>
        </div>

        <VideoForm 
          video={isNew ? null : video} 
          mode={isNew ? 'create' : 'edit'} 
        />
      </div>
    </AdminLayout>
  );
};

export default AdminVideoEdit;
