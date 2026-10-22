import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';

import { NewsImageUpload } from '@/components/admin/NewsImageUpload';
import { ContentImageInsert } from '@/components/admin/ContentImageInsert';
import { ArticlePreview } from '@/components/admin/ArticlePreview';
import { useCreateNews, useUpdateNews } from '@/hooks/useAdminNews';
import { useFacebookShare } from '@/hooks/useFacebookShare';
import { Loader2, Save, ArrowLeft, Sparkles, Wand2, Facebook, Link2, Video, Clock, CalendarClock, Play, Eye, PenLine } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useMatches } from '@/hooks/useMatches';
import type { News } from '@/lib/supabase-types';

interface NewsFormProps {
  article?: News | null;
  mode: 'create' | 'edit';
}

const CATEGORIES = ['Generelt', 'Kampreferat', 'Intervju', 'Klubbnyheter', 'Spilleroverganger'];

const generateSlug = (title: string) => {
  return title
    .toLowerCase()
    .replace(/æ/g, 'ae')
    .replace(/ø/g, 'o')
    .replace(/å/g, 'a')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
};

export function NewsForm({ article, mode }: NewsFormProps) {
  const navigate = useNavigate();
  const { toast } = useToast();
  const createNews = useCreateNews();
  const updateNews = useUpdateNews();
  const { shareToFacebook, deleteFromFacebook, isSharing, isDeleting } = useFacebookShare();
  const { data: allMatches } = useMatches();

  const [title, setTitle] = useState(article?.title || '');
  const [slug, setSlug] = useState(article?.slug || '');
  const [excerpt, setExcerpt] = useState(article?.excerpt || '');
  const [content, setContent] = useState(article?.content || '');
  const [imageUrl, setImageUrl] = useState(article?.image_url || '');
  const [category, setCategory] = useState(article?.category || 'Generelt');
  const [author, setAuthor] = useState(article?.author || 'Fagerborg BK');
  const [isPublished, setIsPublished] = useState(article?.is_published ?? false);
  const [isFeatured, setIsFeatured] = useState(article?.is_featured ?? false);
  const [scheduledAt, setScheduledAt] = useState<string>('');
  const [useSchedule, setUseSchedule] = useState(false);
  const [imageFocalY, setImageFocalY] = useState((article as any)?.image_focal_y ?? 50);
  const [matchId, setMatchId] = useState<string | null>((article as any)?.match_id ?? null);
  const [showMatchHighlights, setShowMatchHighlights] = useState((article as any)?.show_match_highlights ?? false);
  const [autoSlug, setAutoSlug] = useState(mode === 'create');

  // Sync form state when article data loads (async)
  useEffect(() => {
    if (article) {
      setTitle(article.title || '');
      setSlug(article.slug || '');
      setExcerpt(article.excerpt || '');
      setContent(article.content || '');
      setImageUrl(article.image_url || '');
      setCategory(article.category || 'Generelt');
      setAuthor(article.author || 'Fagerborg BK');
      setIsPublished(article.is_published ?? false);
      setIsFeatured(article.is_featured ?? false);
      setImageFocalY((article as any).image_focal_y ?? 50);
      setMatchId((article as any).match_id ?? null);
      setShowMatchHighlights((article as any).show_match_highlights ?? false);
      setShareOnFacebook(!!(article as any).facebook_post_id || !!(article as any).scheduled_facebook);
      setAutoSlug(false);
      // Check if article has a future published_at (scheduled)
      if (article.published_at && new Date(article.published_at) > new Date()) {
        setUseSchedule(true);
        // Convert to local datetime string for input
        const d = new Date(article.published_at);
        const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
        setScheduledAt(local);
      }
    }
  }, [article]);

  // AI generation state
  const [aiKeywords, setAiKeywords] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [showAiPanel, setShowAiPanel] = useState(false);

  // Facebook share
  const [shareOnFacebook, setShareOnFacebook] = useState(
    !!(article as any)?.facebook_post_id || !!(article as any)?.scheduled_facebook
  );

  // Link dialog state
  const [showLinkDialog, setShowLinkDialog] = useState(false);
  const [linkText, setLinkText] = useState('');
  const [linkUrl, setLinkUrl] = useState('');
  const [linkCursorPos, setLinkCursorPos] = useState<number | null>(null);

  // Embed dialog state
  const [showEmbedDialog, setShowEmbedDialog] = useState(false);
  const [embedType, setEmbedType] = useState<'tiktok' | 'youtube' | 'full_kamp'>('tiktok');
  const [embedUrl, setEmbedUrl] = useState('');

  // Preview state
  const [showPreview, setShowPreview] = useState(false);

  const insertEmbed = (type: string, url: string) => {
    const tag = `{{${type}:${url}}}`;
    const textarea = document.getElementById('content') as HTMLTextAreaElement | null;
    const pos = textarea?.selectionStart ?? content.length;
    const before = content.slice(0, pos);
    const after = content.slice(pos);
    const nlBefore = before.length > 0 && !before.endsWith('\n') ? '\n' : '';
    const nlAfter = after.length > 0 && !after.startsWith('\n') ? '\n' : '';
    setContent(before + nlBefore + tag + nlAfter + after);
  };

  useEffect(() => {
    if (autoSlug && title) {
      setSlug(generateSlug(title));
    }
  }, [title, autoSlug]);

  const handleGenerateArticle = async () => {
    if (!aiKeywords.trim()) {
      toast({
        title: 'Mangler stikkord',
        description: 'Skriv inn stikkord for å generere en artikkel',
        variant: 'destructive',
      });
      return;
    }

    setIsGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke('generate-news', {
        body: { keywords: aiKeywords, category },
      });

      if (error) throw error;

      if (data?.success && data?.article) {
        setTitle(data.article.title);
        setExcerpt(data.article.excerpt);
        setContent(data.article.content);
        setAutoSlug(true);
        toast({
          title: 'Artikkel generert',
          description: 'Du kan nå redigere og legge til bilde før publisering',
        });
        setShowAiPanel(false);
        setAiKeywords('');
      } else {
        throw new Error(data?.error || 'Kunne ikke generere artikkel');
      }
    } catch (error) {
      console.error('Error generating article:', error);
      toast({
        title: 'Feil ved generering',
        description: error instanceof Error ? error.message : 'Noe gikk galt',
        variant: 'destructive',
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Determine published_at
    let publishedAt: string | undefined;
    if (useSchedule && scheduledAt && isPublished) {
      publishedAt = new Date(scheduledAt).toISOString();
    } else {
      const wasPublished = article?.is_published ?? false;
      const isBeingPublishedForFirstTime = !wasPublished && isPublished;
      if (mode === 'create' && isPublished) {
        publishedAt = new Date().toISOString();
      } else if (mode === 'edit' && isBeingPublishedForFirstTime) {
        publishedAt = new Date().toISOString();
      }
    }
    
    const isScheduled = useSchedule && scheduledAt && new Date(scheduledAt) > new Date();
    
    const data = {
      title,
      slug,
      excerpt: excerpt || null,
      content,
      image_url: imageUrl || null,
      category,
      author,
      is_published: isPublished,
      is_featured: isFeatured,
      image_focal_y: imageFocalY,
      match_id: matchId,
      show_match_highlights: showMatchHighlights,
      // If scheduled for Facebook, save intent in DB; cron will handle it
      scheduled_facebook: isScheduled && shareOnFacebook && !(article as any)?.facebook_post_id,
      ...(publishedAt && { published_at: publishedAt }),
    };

    let savedArticleId: string | undefined;

    if (mode === 'create') {
      const created = await createNews.mutateAsync(data);
      savedArticleId = created?.id;
    } else if (article) {
      await updateNews.mutateAsync({ id: article.id, ...data });
      savedArticleId = article.id;
    }

    // Share on Facebook immediately only if NOT scheduled
    if (shareOnFacebook && isPublished && !isScheduled && !(article as any)?.facebook_post_id) {
      const siteUrl = 'https://fagerborgbk.lovable.app';
      const articleUrl = `${siteUrl}/nyheter/${slug}`;
      const fbMessage = `📰 ${title}\n\n${excerpt || content.substring(0, 200)}...\n\nLes mer på fagerborgbk.no`;
      
      await shareToFacebook({
        message: fbMessage,
        link: articleUrl,
        image_url: imageUrl || undefined,
        news_id: savedArticleId,
      });
    }

    // Remove from Facebook if toggle is off and was previously shared
    if (!shareOnFacebook && (article as any)?.facebook_post_id && savedArticleId) {
      await deleteFromFacebook(savedArticleId, (article as any).facebook_post_id);
    }

    navigate('/admin/posts');
  };

  const isPending = createNews.isPending || updateNews.isPending || isSharing || isDeleting;

  return (
    <>
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="flex items-center gap-4">
        <Button type="button" variant="ghost" onClick={() => navigate('/admin/posts')}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Tilbake
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          {/* AI Generator Card */}
          {mode === 'create' && (
            <Card className="border-primary/20 bg-primary/5">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Sparkles className="h-5 w-5 text-primary" />
                  AI Nyhetsgenerator
                </CardTitle>
              </CardHeader>
              <CardContent>
                {!showAiPanel ? (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setShowAiPanel(true)}
                    className="w-full"
                  >
                    <Wand2 className="h-4 w-4 mr-2" />
                    Generer artikkel med AI
                  </Button>
                ) : (
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="ai-keywords">Stikkord</Label>
                      <Textarea
                        id="ai-keywords"
                        value={aiKeywords}
                        onChange={(e) => setAiKeywords(e.target.value)}
                        placeholder="F.eks: 3-1 seier mot Bækkelaget, hat-trick, hjemmekamp, 5. divisjon"
                        rows={3}
                      />
                      <p className="text-xs text-muted-foreground">
                        Beskriv hendelsen med nøkkelord. AI-en genererer tittel, ingress og artikkel.
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        onClick={handleGenerateArticle}
                        disabled={isGenerating}
                        className="flex-1"
                      >
                        {isGenerating ? (
                          <>
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            Genererer...
                          </>
                        ) : (
                          <>
                            <Sparkles className="h-4 w-4 mr-2" />
                            Generer
                          </>
                        )}
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        onClick={() => setShowAiPanel(false)}
                      >
                        Avbryt
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>{showPreview ? 'Forhåndsvisning' : 'Innhold'}</CardTitle>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setShowPreview(!showPreview)}
              >
                {showPreview ? <><PenLine className="h-4 w-4 mr-1" />Rediger</> : <><Eye className="h-4 w-4 mr-1" />Forhåndsvisning</>}
              </Button>
            </CardHeader>
            <CardContent>
              {showPreview ? (
                <ArticlePreview
                  title={title}
                  excerpt={excerpt}
                  content={content}
                  imageUrl={imageUrl}
                  category={category}
                  author={author}
                  imageFocalY={imageFocalY}
                />
              ) : (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="title">Tittel *</Label>
                    <Input
                      id="title"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      required
                      placeholder="Skriv tittel..."
                    />
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="slug">URL-slug *</Label>
                      <label className="flex items-center gap-2 text-sm">
                        <Switch
                          checked={autoSlug}
                          onCheckedChange={setAutoSlug}
                        />
                        Auto-generer
                      </label>
                    </div>
                    <Input
                      id="slug"
                      value={slug}
                      onChange={(e) => {
                        setAutoSlug(false);
                        setSlug(e.target.value);
                      }}
                      required
                      placeholder="url-vennlig-tittel"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="excerpt">Utdrag</Label>
                    <Textarea
                      id="excerpt"
                      value={excerpt}
                      onChange={(e) => setExcerpt(e.target.value)}
                      rows={2}
                      placeholder="Kort beskrivelse som vises i oversikten..."
                    />
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="content">Innhold *</Label>
                      <div className="flex items-center gap-2 flex-wrap">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            const textarea = document.getElementById('content') as HTMLTextAreaElement | null;
                            setLinkCursorPos(textarea?.selectionStart ?? content.length);
                            setLinkText('');
                            setLinkUrl('');
                            setShowLinkDialog(true);
                          }}
                        >
                          <Link2 className="h-4 w-4 mr-1" />
                          Lenke
                        </Button>
                        <ContentImageInsert
                          onInsert={(tag) => {
                            const textarea = document.getElementById('content') as HTMLTextAreaElement | null;
                            if (textarea) {
                              const pos = textarea.selectionStart ?? content.length;
                              const before = content.slice(0, pos);
                              const after = content.slice(pos);
                              const needsNewlineBefore = before.length > 0 && !before.endsWith('\n') ? '\n' : '';
                              const needsNewlineAfter = after.length > 0 && !after.startsWith('\n') ? '\n' : '';
                              setContent(before + needsNewlineBefore + tag + needsNewlineAfter + after);
                            } else {
                              setContent(content + '\n' + tag + '\n');
                            }
                          }}
                        />
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => { setEmbedType('youtube'); setEmbedUrl(''); setShowEmbedDialog(true); }}
                        >
                          <Play className="h-4 w-4 mr-1" />
                          YouTube
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => { setEmbedType('tiktok'); setEmbedUrl(''); setShowEmbedDialog(true); }}
                        >
                          <svg className="h-4 w-4 mr-1" viewBox="0 0 24 24" fill="currentColor"><path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1v-3.5a6.37 6.37 0 00-.79-.05A6.34 6.34 0 003.15 15.2a6.34 6.34 0 006.34 6.34 6.34 6.34 0 006.34-6.34V9.42a8.16 8.16 0 004.76 1.52v-3.4a4.85 4.85 0 01-1-.85z"/></svg>
                          TikTok
                        </Button>
                        {matchId && (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              insertEmbed('full_kamp', matchId);
                            }}
                          >
                            <Video className="h-4 w-4 mr-1" />
                            Full kamp
                          </Button>
                        )}
                      </div>
                    </div>
                    <Textarea
                      id="content"
                      value={content}
                      onChange={(e) => setContent(e.target.value)}
                      rows={15}
                      required
                      placeholder="Skriv nyheten her..."
                    />
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Publisering</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <Label htmlFor="is-published">Publisert</Label>
                <Switch
                  id="is-published"
                  checked={isPublished}
                  onCheckedChange={(checked) => {
                    setIsPublished(checked);
                    if (!checked) setUseSchedule(false);
                  }}
                />
              </div>

              {isPublished && (
                <div className="space-y-3 pt-2 border-t">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <CalendarClock className="h-4 w-4 text-muted-foreground" />
                      <Label htmlFor="use-schedule" className="text-sm">Planlegg publisering</Label>
                    </div>
                    <Switch
                      id="use-schedule"
                      checked={useSchedule}
                      onCheckedChange={setUseSchedule}
                    />
                  </div>
                  {useSchedule && (
                    <div className="space-y-1.5">
                      <Input
                        type="datetime-local"
                        value={scheduledAt}
                        onChange={(e) => setScheduledAt(e.target.value)}
                        min={new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16)}
                      />
                      {scheduledAt && new Date(scheduledAt) > new Date() && (
                        <p className="text-xs text-amber-600 flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          Publiseres {new Date(scheduledAt).toLocaleString('nb-NO', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              )}

              <div className="flex items-center justify-between">
                <Label htmlFor="is-featured">Fremhevet</Label>
                <Switch
                  id="is-featured"
                  checked={isFeatured}
                  onCheckedChange={setIsFeatured}
                />
              </div>

              {isPublished && mode === 'edit' && (
                <div className="flex items-center justify-between gap-2 pt-2 border-t">
                  <div className="flex items-center gap-2 min-w-0">
                    <Facebook className="h-4 w-4 shrink-0 text-[#1877F2]" />
                    <Label htmlFor="share-facebook" className="text-sm leading-snug">
                      {(article as any)?.facebook_post_id ? 'Publisert på Facebook' : 'Del på Facebook'}
                    </Label>
                  </div>
                  <Switch
                    id="share-facebook"
                    className="shrink-0"
                    checked={shareOnFacebook}
                    onCheckedChange={setShareOnFacebook}
                  />
                </div>
              )}
              {isPublished && mode === 'create' && (
                <div className="flex items-center justify-between gap-2 pt-2 border-t">
                  <div className="flex items-center gap-2 min-w-0">
                    <Facebook className="h-4 w-4 shrink-0 text-[#1877F2]" />
                    <Label htmlFor="share-facebook" className="text-sm leading-snug">Del på Facebook</Label>
                  </div>
                  <Switch
                    id="share-facebook"
                    className="shrink-0"
                    checked={shareOnFacebook}
                    onCheckedChange={setShareOnFacebook}
                  />
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="category">Kategori</Label>
                <Select value={category} onValueChange={setCategory}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map(cat => (
                      <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="author">Forfatter</Label>
                <Input
                  id="author"
                  value={author}
                  onChange={(e) => setAuthor(e.target.value)}
                  placeholder="Fagerborg BK"
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Bilde</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <NewsImageUpload
                value={imageUrl}
                onChange={setImageUrl}
                onFocalYChange={setImageFocalY}
                focalY={imageFocalY}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Video className="h-5 w-5" />
                Kamp & høydepunkter
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Tilknyttet kamp</Label>
                <Select 
                  value={matchId || 'none'} 
                  onValueChange={(v) => {
                    const selected = v === 'none' ? null : v;
                    setMatchId(selected);
                    if (!selected) {
                      setShowMatchHighlights(false);
                    } else {
                      setCategory('Kampreferat');
                    }
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Velg kamp..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Ingen kamp</SelectItem>
                    {(allMatches || [])
                      .filter(m => (m as any).status !== 'upcoming')
                      .sort((a, b) => new Date(b.match_date).getTime() - new Date(a.match_date).getTime())
                      .map(m => {
                        const d = new Date(m.match_date);
                        const dateStr = d.toLocaleDateString('nb-NO', { day: '2-digit', month: '2-digit', year: '2-digit' });
                        const status = (m as any).status === 'finished'
                          ? ' ✓'
                          : (m as any).status === 'upcoming' ? ' (kommende)' : '';
                        const label = `${dateStr} – ${m.is_home ? 'Fagerborg' : m.opponent} vs ${m.is_home ? m.opponent : 'Fagerborg'}${status}`;
                        return <SelectItem key={m.id} value={m.id}>{label}</SelectItem>;
                      })}
                  </SelectContent>
                </Select>
              </div>

              {matchId && (
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="show-highlights">Vis høydepunkter</Label>
                    <p className="text-xs text-muted-foreground">
                      Embed tilknyttede videoer nederst i artikkelen
                    </p>
                  </div>
                  <Switch
                    id="show-highlights"
                    checked={showMatchHighlights}
                    onCheckedChange={setShowMatchHighlights}
                  />
                </div>
              )}
            </CardContent>
          </Card>

          <Button type="submit" className="w-full" disabled={isPending}>
            {isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Lagrer...
              </>
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" />
                {mode === 'create' ? 'Opprett nyhet' : 'Lagre endringer'}
              </>
            )}
          </Button>
        </div>
      </div>
    </form>

      <Dialog open={showLinkDialog} onOpenChange={setShowLinkDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Sett inn lenke</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="link-text">Lenketekst</Label>
              <Input
                id="link-text"
                value={linkText}
                onChange={(e) => setLinkText(e.target.value)}
                placeholder="Klikk her"
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="link-url">URL</Label>
              <Input
                id="link-url"
                value={linkUrl}
                onChange={(e) => setLinkUrl(e.target.value)}
                placeholder="https://..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowLinkDialog(false)}>Avbryt</Button>
            <Button
              onClick={() => {
                if (!linkText || !linkUrl) return;
                const tag = `[${linkText}](${linkUrl})`;
                const pos = linkCursorPos ?? content.length;
                const before = content.slice(0, pos);
                const after = content.slice(pos);
                setContent(before + tag + after);
                setShowLinkDialog(false);
              }}
              disabled={!linkText || !linkUrl}
            >
              Sett inn
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showEmbedDialog} onOpenChange={setShowEmbedDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {embedType === 'tiktok' ? 'Sett inn TikTok-video' : 'Sett inn YouTube-video'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="embed-url">
                {embedType === 'tiktok' ? 'TikTok-URL' : 'YouTube-URL'}
              </Label>
              <Input
                id="embed-url"
                value={embedUrl}
                onChange={(e) => setEmbedUrl(e.target.value)}
                placeholder={embedType === 'tiktok' ? 'https://www.tiktok.com/@bruker/video/...' : 'https://youtube.com/watch?v=...'}
                autoFocus
              />
              <p className="text-xs text-muted-foreground">
                {embedType === 'tiktok'
                  ? 'Lim inn lenken til TikTok-videoen. Den vil vises som en embed i artikkelen.'
                  : 'Lim inn lenken til YouTube-videoen. Den vil vises som en embed i artikkelen.'}
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowEmbedDialog(false)}>Avbryt</Button>
            <Button
              onClick={() => {
                if (!embedUrl) return;
                insertEmbed(embedType, embedUrl);
                setShowEmbedDialog(false);
              }}
              disabled={!embedUrl}
            >
              Sett inn
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
