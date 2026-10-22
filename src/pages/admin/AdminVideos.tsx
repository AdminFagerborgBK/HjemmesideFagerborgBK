import { Link } from 'react-router-dom';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useSiteVideos, useDeleteSiteVideo } from '@/hooks/useSiteVideos';
import { Plus, Edit, Trash2, Loader2, Video, Eye } from 'lucide-react';
import { TikTokPublishButton } from '@/components/admin/TikTokPublishButton';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { nb } from 'date-fns/locale';
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

const AdminVideos = () => {
  const { data: videos, isLoading } = useSiteVideos(true);
  const deleteVideo = useDeleteSiteVideo();

  const { data: clickCounts } = useQuery({
    queryKey: ['video-click-counts'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('video_clicks' as any)
        .select('video_id');
      if (error) throw error;
      const counts: Record<string, number> = {};
      (data as any[] | null)?.forEach((row) => {
        counts[row.video_id] = (counts[row.video_id] || 0) + 1;
      });
      return counts;
    },
  });
  const totalClicks = clickCounts ? Object.values(clickCounts).reduce((a, b) => a + b, 0) : 0;

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
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold">Videoer</h1>
            <p className="text-muted-foreground">
              Administrer videoer · {totalClicks.toLocaleString('nb-NO')} totale visninger
            </p>
          </div>
          <Link to="/admin/videos/new">
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Ny video
            </Button>
          </Link>
        </div>

        {!videos?.length ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Video className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium">Ingen videoer ennå</h3>
              <p className="text-muted-foreground mb-4">Legg til din første video</p>
              <Link to="/admin/videos/new">
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Legg til video
                </Button>
              </Link>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {videos.map(video => (
              <Card key={video.id}>
                <CardContent className="p-0">
                  {video.thumbnail_url ? (
                    <img 
                      src={video.thumbnail_url} 
                      alt="" 
                      className="w-full h-40 object-cover rounded-t-lg"
                    />
                  ) : (
                    <div className="w-full h-40 bg-muted rounded-t-lg flex items-center justify-center">
                      <Video className="h-12 w-12 text-muted-foreground" />
                    </div>
                  )}
                  
                  <div className="p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <h3 className="font-medium truncate flex-1">{video.title}</h3>
                      <Badge variant={video.status === 'published' ? 'default' : 'secondary'}>
                        {video.status === 'published' ? 'Publisert' : 'Utkast'}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mb-4">
                      {format(new Date(video.created_at), 'd. MMMM yyyy', { locale: nb })}
                    </p>

                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-3">
                      <Eye className="h-3.5 w-3.5" />
                      <span className="font-medium text-foreground">
                        {(clickCounts?.[video.id] || 0).toLocaleString('nb-NO')}
                      </span>
                      <span>visninger</span>
                    </div>

                    <div className="flex gap-2 flex-wrap">
                      {video.status === 'published' && video.category === 'highlights' && (
                        <TikTokPublishButton
                          videoUrl={video.video_url}
                          title={video.title}
                          description={video.description || undefined}
                          videoId={video.id}
                        />
                      )}
                      <Link to={`/admin/videos/${video.id}`} className="flex-1">
                        <Button variant="outline" size="sm" className="w-full">
                          <Edit className="h-4 w-4 mr-2" />
                          Rediger
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
                            <AlertDialogTitle>Slett video?</AlertDialogTitle>
                            <AlertDialogDescription>
                              Er du sikker på at du vil slette "{video.title}"?
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Avbryt</AlertDialogCancel>
                            <AlertDialogAction onClick={() => deleteVideo.mutate(video.id)}>
                              Slett
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
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

export default AdminVideos;
