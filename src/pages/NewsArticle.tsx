import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, Calendar, User, Share2, Video } from 'lucide-react';
import { useEffect } from 'react';
import Header from '@/components/Header';
import Seo from '@/components/Seo';
import Footer from '@/components/Footer';
import { useNewsArticle } from '@/hooks/useNews';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import fagerborgLogo from '@/assets/fagerborg-logo.png';
import { format } from 'date-fns';
import { nb } from 'date-fns/locale';

function renderInlineFormatting(text: string) {
  // Split on **bold** and [link](url) patterns
  const parts = text.split(/(\*\*[^*]+\*\*|\[[^\]]+\]\([^)]+\))/g);
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={i}>{part.slice(2, -2)}</strong>;
    }
    const linkMatch = part.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
    if (linkMatch) {
      return (
        <a key={i} href={linkMatch[2]} target="_blank" rel="noopener noreferrer" className="text-primary underline hover:text-primary/80">
          {linkMatch[1]}
        </a>);

    }
    return part;
  });
}

function renderContentBlock(line: string, index: number) {
  // Image embed
  const imgMatch = line.match(/^!\[([^\]]*)\]\(([^)]+)\)$/);
  if (imgMatch) {
    return (
      <figure key={index} className="my-8">
        <img src={imgMatch[2]} alt={imgMatch[1]} className="w-full rounded-lg" />
        {imgMatch[1] && (
          <figcaption className="text-sm text-muted-foreground mt-2 text-center">
            {imgMatch[1]}
          </figcaption>
        )}
      </figure>
    );
  }

  // YouTube embed: {{youtube:URL}}
  const ytEmbedMatch = line.trim().match(/^\{\{youtube:(.+?)\}\}$/);
  if (ytEmbedMatch) {
    const url = ytEmbedMatch[1];
    const vidMatch = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\s]+)/);
    const embedSrc = vidMatch ? `https://www.youtube.com/embed/${vidMatch[1]}` : url;
    return (
      <div key={index} className="my-8 aspect-video rounded-lg overflow-hidden bg-muted">
        <iframe
          src={embedSrc}
          title="YouTube-video"
          className="w-full h-full"
          allowFullScreen
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        />
      </div>
    );
  }

  // TikTok embed: {{tiktok:URL}}
  const ttEmbedMatch = line.trim().match(/^\{\{tiktok:(.+?)\}\}$/);
  if (ttEmbedMatch) {
    const ttUrl = ttEmbedMatch[1];
    // Extract video ID for oEmbed
    const videoIdMatch = ttUrl.match(/\/video\/(\d+)/);
    const videoId = videoIdMatch ? videoIdMatch[1] : null;
    return (
      <div key={index} className="my-8 flex justify-center">
        <div className="w-full max-w-[400px]">
          {videoId ? (
            <blockquote
              className="tiktok-embed rounded-lg overflow-hidden"
              cite={ttUrl}
              data-video-id={videoId}
            >
              <a href={ttUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 p-4 bg-muted rounded-lg hover:bg-muted/80 transition-colors">
                <svg className="h-8 w-8 flex-shrink-0" viewBox="0 0 24 24" fill="currentColor"><path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1v-3.5a6.37 6.37 0 00-.79-.05A6.34 6.34 0 003.15 15.2a6.34 6.34 0 006.34 6.34 6.34 6.34 0 006.34-6.34V9.42a8.16 8.16 0 004.76 1.52v-3.4a4.85 4.85 0 01-1-.85z"/></svg>
                <span className="text-sm font-medium">Se video på TikTok</span>
              </a>
            </blockquote>
          ) : (
            <a href={ttUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 p-4 bg-muted rounded-lg hover:bg-muted/80 transition-colors">
              <svg className="h-8 w-8 flex-shrink-0" viewBox="0 0 24 24" fill="currentColor"><path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1v-3.5a6.37 6.37 0 00-.79-.05A6.34 6.34 0 003.15 15.2a6.34 6.34 0 006.34 6.34 6.34 6.34 0 006.34-6.34V9.42a8.16 8.16 0 004.76 1.52v-3.4a4.85 4.85 0 01-1-.85z"/></svg>
              <span className="text-sm font-medium">Se video på TikTok</span>
            </a>
          )}
        </div>
      </div>
    );
  }

  // Full match link: {{full_kamp:MATCH_ID}}
  const fmMatch = line.trim().match(/^\{\{full_kamp:(.+?)\}\}$/);
  if (fmMatch) {
    return <FullMatchEmbed key={index} matchId={fmMatch[1]} />;
  }

  if (!line.trim()) return null;
  return (
    <p key={index} className="text-foreground mb-4 leading-relaxed">
      {renderInlineFormatting(line)}
    </p>
  );
}

function FullMatchEmbed({ matchId }: { matchId: string }) {
  const { data: videos } = useQuery({
    queryKey: ['full-match-embed', matchId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('site_videos_public')
        .select('id, title, thumbnail_url, is_protected')
        .eq('match_id', matchId)
        .eq('status', 'published')
        .eq('category', 'full_match');
      if (error) throw error;
      return data;
    },
  });

  if (!videos || videos.length === 0) return null;

  const video = videos[0];
  return (
    <Link
      to={`/video/${video.id}`}
      className="my-8 flex items-center gap-4 p-4 bg-muted rounded-lg hover:bg-muted/80 transition-colors group no-underline"
    >
      <div className="flex-shrink-0 w-16 h-16 bg-primary/10 rounded-lg flex items-center justify-center group-hover:bg-primary/20 transition-colors">
        <Video className="h-8 w-8 text-primary" />
      </div>
      <div>
        <p className="font-semibold text-foreground group-hover:text-primary transition-colors">
          {video.title || 'Se full kamp'}
        </p>
        <p className="text-sm text-muted-foreground">
          {video.is_protected ? 'Kun for medlemmer' : 'Se hele kampen'}
        </p>
      </div>
    </Link>
  );
}

const NewsArticle = () => {
  const { slug } = useParams<{slug: string;}>();
  const { data: article, isLoading } = useNewsArticle(slug || '');

  // Fetch highlight videos for the linked match
  const matchId = (article as any)?.match_id;
  const showHighlights = (article as any)?.show_match_highlights;
  const { data: highlights } = useQuery({
    queryKey: ['match-highlights', matchId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('site_videos_public')
        .select('*')
        .eq('match_id', matchId)
        .eq('status', 'published')
        .eq('category', 'highlights');
      if (error) throw error;
      return data;
    },
    enabled: !!matchId && !!showHighlights,
  });

  // Load TikTok embed script if article contains TikTok embeds
  useEffect(() => {
    if (article?.content?.includes('{{tiktok:')) {
      const existing = document.getElementById('tiktok-embed-script');
      if (!existing) {
        const script = document.createElement('script');
        script.id = 'tiktok-embed-script';
        script.src = 'https://www.tiktok.com/embed.js';
        script.async = true;
        document.body.appendChild(script);
      } else {
        // Re-trigger TikTok embed rendering
        (window as any).tiktokEmbed?.lib?.render?.();
      }
    }
  }, [article?.content]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="pt-20">
          <div className="container mx-auto px-4 py-12">
            <div className="text-center text-muted-foreground">Laster artikkel...</div>
          </div>
        </main>
        <Footer />
      </div>);

  }

  if (!article) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="pt-20">
          <div className="container mx-auto px-4 py-12 text-center">
            <h1 className="text-2xl font-bold mb-4">Artikkel ikke funnet</h1>
            <Link to="/nyheter">
              <button className="bg-primary text-primary-foreground px-4 py-2 rounded">Tilbake til nyheter</button>
            </Link>
          </div>
        </main>
        <Footer />
      </div>);

  }

  const focalY = (article as any).image_focal_y ?? 50;
  const rawImage = article.image_url || fagerborgLogo;
  // Cache-bust storage images using updated_at to ensure edits are reflected immediately
  const heroImage = rawImage.includes('supabase.co/storage') ?
  `${rawImage}${rawImage.includes('?') ? '&' : '?'}v=${new Date(article.updated_at).getTime()}` :
  rawImage;

  return (
    <div className="min-h-screen bg-background">
      <Seo
        title={`${article.title.slice(0, 44)} | Fagerborg BK`}
        description={(article.excerpt || article.title).slice(0, 155)}
        path={`/nyheter/${article.slug}`}
        type="article"
        image={article.image_url || undefined}
        jsonLd={{
          '@context': 'https://schema.org',
          '@type': 'NewsArticle',
          headline: article.title,
          description: article.excerpt || undefined,
          image: article.image_url || undefined,
          datePublished: article.published_at,
          dateModified: article.updated_at,
          author: { '@type': 'Person', name: article.author },
          publisher: { '@id': 'https://fagerborgbk.no/#organization' },
          mainEntityOfPage: `https://fagerborgbk.no/nyheter/${article.slug}`,
        }}
      />
      <Header />

      <main>
        {/* Full-bleed hero with title overlay – Chelsea style */}
      <section className="relative w-full overflow-hidden bg-fagerborg-navy">
          {/* Background blurred fill for letterbox effect */}
          <img
            src={heroImage}
            alt=""
            aria-hidden="true"
            className="absolute inset-0 w-full h-full object-cover scale-110 blur-2xl opacity-60" />

          {/* Main image – entire image visible, with top padding so header doesn't cover it */}
          <div className="relative max-w-5xl mx-auto pt-20 pb-32 md:pb-36 lg:pb-40">
            <img
              src={heroImage}
              alt={article.title}
              className="w-full h-auto block" />
          </div>

          {/* Gradient overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent pointer-events-none" />

          {/* Back button */}
          <Link
            to="/nyheter"
            className="absolute top-20 left-4 md:left-8 z-10 inline-flex items-center gap-2 text-white/80 hover:text-white text-sm transition-colors">
            <ArrowLeft className="w-4 h-4" />
            Tilbake til nyheter
          </Link>

          {/* Title on image – always below the image */}
          <div className="absolute bottom-0 inset-x-0 p-6 md:p-12 lg:p-16 z-10">
            <div className="max-w-4xl mx-auto">
              <h1 className="text-2xl md:text-5xl lg:text-6xl font-bold text-white leading-tight">
                {article.title}
              </h1>
            </div>
          </div>
        </section>

        {/* Meta bar */}
        <div className="border-b border-border">
          <div className="max-w-4xl mx-auto px-6 md:px-12 lg:px-16 py-4 flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-6 text-sm text-muted-foreground">
              <span className="text-primary font-bold uppercase tracking-wider text-xs">
                {article.category}
              </span>
              <span className="flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5" />
                {format(new Date(article.published_at), 'd. MMMM yyyy', { locale: nb })}
              </span>
              <span className="flex items-center gap-1.5">
                <User className="w-3.5 h-3.5" />
                {article.author}
              </span>
            </div>
            <button
              className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-primary transition-colors"
              onClick={async () => {
                const url = window.location.href;
                if (navigator.share) {
                  try {
                    await navigator.share({ title: article.title, url });
                  } catch {}
                } else {
                  await navigator.clipboard.writeText(url);
                  alert('Lenke kopiert!');
                }
              }}>

              <Share2 className="w-4 h-4" />
              Del
            </button>
          </div>
        </div>

        {/* Article content */}
        <article className="max-w-4xl mx-auto px-6 md:px-12 lg:px-16 py-8 md:py-12">
          {article.excerpt &&
          <p className="text-lg md:text-xl mb-8 leading-relaxed text-primary font-extrabold">
              {article.excerpt}
            </p>
          }

          <div className="prose prose-lg max-w-none">
            {article.content.split('\n').map((line, index) => renderContentBlock(line, index))}
          </div>

          {/* Match highlights */}
          {highlights && highlights.length > 0 && (
            <div className="mt-12 pt-8 border-t border-border">
              <div className="space-y-6">
                {highlights.map((video) => {
                  const videoUrl = video.video_url || '';
                  let embedUrl = videoUrl;
                  const ytMatch = videoUrl.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\s]+)/);
                  if (ytMatch) {
                    embedUrl = `https://www.youtube.com/embed/${ytMatch[1]}`;
                  }
                  return (
                    <div key={video.id} className="space-y-2">
                      <h3 className="font-semibold text-foreground">{video.title}</h3>
                      <div className="aspect-video rounded-lg overflow-hidden bg-muted">
                        <iframe
                          src={embedUrl}
                          title={video.title || 'Video'}
                          className="w-full h-full"
                          allowFullScreen
                          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </article>
      </main>

      <Footer />
    </div>);

};

export default NewsArticle;