import { AdminLayout } from '@/components/admin/AdminLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useAdminNews } from '@/hooks/useAdminNews';
import { useSiteVideos } from '@/hooks/useSiteVideos';

import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import { FileText, Video, Mail, Download, FileEdit, Users, Zap, BookOpen, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { downloadManual } from '@/lib/generateManual';
import fagerborgLogo from '@/assets/fagerborg-logo.png';

const AdminDashboard = () => {
  const { data: news } = useAdminNews();
  const { data: videos } = useSiteVideos(true);

  const { data: newsletterStats } = useQuery({
    queryKey: ['dashboard-newsletter-stats'],
    queryFn: async () => {
      const { data: newsletters, error } = await supabase
        .from('newsletters')
        .select('status, sent_count');
      if (error) throw error;
      const sent = newsletters?.filter(n => n.status === 'sent') || [];
      const drafts = newsletters?.filter(n => n.status === 'draft') || [];
      return { sent: sent.length, drafts: drafts.length, totalRecipients: sent.reduce((sum, n) => sum + (n.sent_count || 0), 0) };
    },
  });

  const stats = [
    { 
      label: 'Nyheter', 
      count: news?.length || 0, 
      published: news?.filter(n => n.is_published).length || 0,
      icon: FileText,
      path: '/admin/posts',
      color: 'bg-blue-500'
    },
    { 
      label: 'Videoer', 
      count: videos?.length || 0, 
      published: videos?.filter(v => v.status === 'published').length || 0,
      icon: Video,
      path: '/admin/videos',
      color: 'bg-purple-500'
    },
    { 
      label: 'Nyhetsbrev', 
      count: (newsletterStats?.sent || 0) + (newsletterStats?.drafts || 0), 
      published: newsletterStats?.sent || 0,
      icon: Mail,
      path: '/admin/newsletters',
      color: 'bg-amber-500'
    },
  ];

  const quickLinks = [
    { label: 'Opprett nytt innlegg', icon: FileText, path: '/admin/posts/new', color: 'text-blue-500' },
    { label: 'Legg til video', icon: Video, path: '/admin/videos/new', color: 'text-purple-500' },
    { label: 'Legg til person', icon: Users, path: '/admin/roster/new', color: 'text-green-500' },
    { label: 'Rediger sider', icon: FileEdit, path: '/admin/pages', color: 'text-orange-500' },
  ];

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Oversikt</h1>
          <p className="text-muted-foreground">Velkommen til administrasjonspanelet</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {stats.map(({ label, count, published, icon: Icon, path, color }) => (
            <Link key={path} to={path}>
              <Card className="hover:shadow-lg transition-shadow cursor-pointer">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    {label}
                  </CardTitle>
                  <div className={`p-2 rounded-lg ${color}`}>
                    <Icon className="h-5 w-5 text-white" />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">{count}</div>
                  <p className="text-xs text-muted-foreground">
                    {published} publisert / aktiv
                  </p>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card className="border-l-4 border-l-primary">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/10">
                  <Zap className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <CardTitle className="text-lg">Hurtiglenker</CardTitle>
                  <CardDescription>Kom raskt i gang</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-1">
              {quickLinks.map(({ label, icon: Icon, path, color }) => (
                <Link key={path} to={path} className="flex items-center justify-between p-3 rounded-lg hover:bg-muted transition-colors group">
                  <div className="flex items-center gap-3">
                    <Icon className={`h-5 w-5 ${color}`} />
                    <span className="font-medium">{label}</span>
                  </div>
                  <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                </Link>
              ))}
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-secondary overflow-hidden">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-3">
                <img src={fagerborgLogo} alt="Fagerborg BK" className="h-10 w-10 object-contain" />
                <div>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <BookOpen className="h-5 w-5" />
                    Brukermanual
                  </CardTitle>
                  <CardDescription>Komplett guide til admin-panelet</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Illustrert manual med guider for alle funksjoner – fra publisering til kampstyring.
              </p>
              <Button onClick={() => downloadManual()} className="gap-2 w-full">
                <Download className="h-4 w-4" />
                Last ned brukermanual (HTML)
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </AdminLayout>
  );
};

export default AdminDashboard;
