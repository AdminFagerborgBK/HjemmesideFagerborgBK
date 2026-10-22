import { Link } from 'react-router-dom';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAdminNews, useDeleteNews, useToggleFeatured, useDeletedNews, useRestoreNews, usePermanentlyDeleteNews, useReorderFeatured } from '@/hooks/useAdminNews';
import { Plus, Edit, Trash2, Loader2, FileText, Star, Eye, Facebook, RotateCcw, Trash, CalendarClock, ArrowUp, ArrowDown } from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
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

const AdminPosts = () => {
  const { data: news, isLoading } = useAdminNews();
  const { data: trashedNews, isLoading: isLoadingTrash } = useDeletedNews();
  const deleteNews = useDeleteNews();
  const toggleFeatured = useToggleFeatured();
  const restoreNews = useRestoreNews();
  const permanentlyDeleteNews = usePermanentlyDeleteNews();
  const reorderFeatured = useReorderFeatured();

  if (isLoading) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      </AdminLayout>
    );
  }

  const trashCount = trashedNews?.length || 0;

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold">Nyheter</h1>
            <p className="text-muted-foreground">
              Administrer nyheter og innlegg ({news?.length || 0} totalt)
            </p>
          </div>
          <Link to="/admin/posts/new">
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Ny nyhet
            </Button>
          </Link>
        </div>

        {(() => {
          const featured = (news || [])
            .filter(a => a.is_featured)
            .sort((a, b) => {
              const ao = (a as any).carousel_order ?? 0;
              const bo = (b as any).carousel_order ?? 0;
              if (ao !== bo) return ao - bo;
              return new Date(b.published_at || 0).getTime() - new Date(a.published_at || 0).getTime();
            });

          const move = (index: number, dir: -1 | 1) => {
            const target = index + dir;
            if (target < 0 || target >= featured.length) return;
            const ids = featured.map(a => a.id);
            [ids[index], ids[target]] = [ids[target], ids[index]];
            reorderFeatured.mutate(ids);
          };

          return (
            <Card>
              <CardContent className="p-4 space-y-3">
                <p className="text-sm text-muted-foreground">
                  <Star className="h-3.5 w-3.5 inline mr-1" />
                  {featured.length}/3 fremhevede artikler i karusellen.
                  {featured.length >= 3 && ' Den eldste fjernes automatisk ved ny fremheving.'}
                </p>
                {featured.length > 1 && (
                  <div className="space-y-2">
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      Rekkefølge i karusellen
                    </p>
                    {featured.map((article, index) => (
                      <div key={article.id} className="flex items-center gap-2 rounded-md border p-2">
                        <span className="w-6 text-center text-sm font-semibold text-muted-foreground">
                          {index + 1}
                        </span>
                        <span className="flex-1 min-w-0 truncate text-sm">{article.title}</span>
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-8 w-8"
                          disabled={index === 0 || reorderFeatured.isPending}
                          onClick={() => move(index, -1)}
                          title="Flytt opp"
                        >
                          <ArrowUp className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-8 w-8"
                          disabled={index === featured.length - 1 || reorderFeatured.isPending}
                          onClick={() => move(index, 1)}
                          title="Flytt ned"
                        >
                          <ArrowDown className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })()}

        <Tabs defaultValue="published">
          <TabsList>
            <TabsTrigger value="published">Publisert</TabsTrigger>
            <TabsTrigger value="trash" className="gap-1.5">
              <Trash className="h-3.5 w-3.5" />
              Søppelkurv
              {trashCount > 0 && (
                <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-xs">{trashCount}</Badge>
              )}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="published" className="space-y-4 mt-4">
            {!news?.length ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <FileText className="h-12 w-12 text-muted-foreground mb-4" />
                  <h3 className="text-lg font-medium">Ingen nyheter ennå</h3>
                  <p className="text-muted-foreground mb-4">Opprett din første nyhet</p>
                  <Link to="/admin/posts/new">
                    <Button>
                      <Plus className="h-4 w-4 mr-2" />
                      Opprett nyhet
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            ) : (
              news.map(article => (
                <Card key={article.id}>
                  <CardContent className="flex items-center gap-4 p-4">
                    {article.image_url ? (
                      <img 
                        src={article.image_url} 
                        alt="" 
                        className="w-20 h-20 object-cover rounded-lg"
                      />
                    ) : (
                      <div className="w-20 h-20 bg-muted rounded-lg flex items-center justify-center">
                        <FileText className="h-8 w-8 text-muted-foreground" />
                      </div>
                    )}
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <h3 className="font-medium truncate">{article.title}</h3>
                        <Badge variant={article.is_published ? 'default' : 'secondary'}>
                          {article.is_published ? 'Publisert' : 'Utkast'}
                        </Badge>
                        {article.is_published && article.published_at && new Date(article.published_at) > new Date() && (
                          <Badge variant="outline" className="gap-1 text-amber-600 border-amber-300">
                            <CalendarClock className="h-3 w-3" />
                            Planlagt {new Date(article.published_at).toLocaleDateString('nb-NO', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                          </Badge>
                        )}
                        {article.is_featured && (
                          <Badge variant="outline" className="gap-1">
                            <Star className="h-3 w-3" />
                            Fremhevet
                          </Badge>
                        )}
                        {(article as any).facebook_post_id && (
                          <Badge variant="outline" className="gap-1 text-[#1877F2] border-[#1877F2]/30">
                            <Facebook className="h-3 w-3" />
                            Facebook
                          </Badge>
                        )}
                        <Badge variant="outline">{article.category}</Badge>
                      </div>
                      <p className="text-sm text-muted-foreground truncate">{article.excerpt}</p>
                      <div className="flex items-center gap-4 text-xs text-muted-foreground mt-1">
                        <span>
                          {article.published_at 
                            ? format(new Date(article.published_at), 'd. MMMM yyyy', { locale: nb })
                            : 'Ikke publisert'}
                        </span>
                        <span className="flex items-center gap-1">
                          <Eye className="h-3 w-3" />
                          {article.view_count || 0} visninger
                        </span>
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <Button 
                        variant={article.is_featured ? "default" : "outline"} 
                        size="icon"
                        onClick={() => toggleFeatured.mutate({ 
                          id: article.id, 
                          is_featured: !article.is_featured 
                        })}
                        title={article.is_featured ? 'Fjern fremheving' : 'Fremhev'}
                      >
                        <Star className={`h-4 w-4 ${article.is_featured ? 'fill-current' : ''}`} />
                      </Button>
                      <Link to={`/admin/posts/${article.id}`}>
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
                            <AlertDialogTitle>Flytt til søppelkurven?</AlertDialogTitle>
                            <AlertDialogDescription>
                              "{article.title}" flyttes til søppelkurven. Du kan gjenopprette den senere.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Avbryt</AlertDialogCancel>
                            <AlertDialogAction onClick={() => deleteNews.mutate(article.id)}>
                              Flytt til søppelkurv
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </TabsContent>

          <TabsContent value="trash" className="space-y-4 mt-4">
            {isLoadingTrash ? (
              <div className="flex items-center justify-center h-32">
                <Loader2 className="h-6 w-6 animate-spin" />
              </div>
            ) : !trashedNews?.length ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <Trash className="h-12 w-12 text-muted-foreground mb-4" />
                  <h3 className="text-lg font-medium">Søppelkurven er tom</h3>
                  <p className="text-muted-foreground">Slettede nyheter vil vises her</p>
                </CardContent>
              </Card>
            ) : (
              trashedNews.map(article => (
                <Card key={article.id} className="opacity-75">
                  <CardContent className="flex items-center gap-4 p-4">
                    {article.image_url ? (
                      <img 
                        src={article.image_url} 
                        alt="" 
                        className="w-20 h-20 object-cover rounded-lg grayscale"
                      />
                    ) : (
                      <div className="w-20 h-20 bg-muted rounded-lg flex items-center justify-center">
                        <FileText className="h-8 w-8 text-muted-foreground" />
                      </div>
                    )}
                    
                    <div className="flex-1 min-w-0">
                      <h3 className="font-medium truncate">{article.title}</h3>
                      <p className="text-sm text-muted-foreground truncate">{article.excerpt}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Slettet {formatDistanceToNow(new Date((article as any).deleted_at), { addSuffix: true, locale: nb })}
                      </p>
                    </div>

                    <div className="flex gap-2">
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => restoreNews.mutate(article.id)}
                        className="gap-1.5"
                      >
                        <RotateCcw className="h-4 w-4" />
                        Gjenopprett
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="destructive" size="sm">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Slett permanent?</AlertDialogTitle>
                            <AlertDialogDescription>
                              "{article.title}" vil bli permanent slettet. Denne handlingen kan ikke angres.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Avbryt</AlertDialogCancel>
                            <AlertDialogAction 
                              onClick={() => permanentlyDeleteNews.mutate(article.id)}
                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            >
                              Slett permanent
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </TabsContent>
        </Tabs>
      </div>
    </AdminLayout>
  );
};

export default AdminPosts;
