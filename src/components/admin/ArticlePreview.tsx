import { Calendar, User, Video } from 'lucide-react';
import { format } from 'date-fns';
import { nb } from 'date-fns/locale';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import fagerborgLogo from '@/assets/fagerborg-logo.png';

interface ArticlePreviewProps {
  title: string;
  excerpt: string;
  content: string;
  imageUrl: string;
  category: string;
  author: string;
  imageFocalY: number;
}

function renderInlineFormatting(text: string) {
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
        </a>
      );
    }
    return part;
  });
}

function FullMatchEmbedPreview({ matchId }: { matchId: string }) {
  const { data: videos } = useQuery({
    queryKey: ['full-match-embed-preview', matchId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('site_videos_public')
        .select('id, title, is_protected')
        .eq('match_id', matchId)
        .eq('status', 'published')
        .eq('category', 'full_match');
      if (error) throw error;
      return data;
    },
  });

  if (!videos || videos.length === 0) {
    return (
      <div className="my-6 flex items-center gap-4 p-4 bg-muted rounded-lg opacity-60">
        <div className="flex-shrink-0 w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center">
          <Video className="h-6 w-6 text-primary" />
        </div>
        <div>
          <p className="font-semibold text-foreground text-sm">Full kamp (ingen video funnet)</p>
        </div>
      </div>
    );
  }

  const video = videos[0];
  return (
    <div className="my-6 flex items-center gap-4 p-4 bg-muted rounded-lg">
      <div className="flex-shrink-0 w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center">
        <Video className="h-6 w-6 text-primary" />
      </div>
      <div>
        <p className="font-semibold text-foreground text-sm">{video.title || 'Se full kamp'}</p>
        <p className="text-xs text-muted-foreground">{video.is_protected ? 'Kun for medlemmer' : 'Se hele kampen'}</p>
      </div>
    </div>
  );
}

function renderPreviewBlock(line: string, index: number) {
  const imgMatch = line.match(/^!\[([^\]]*)\]\(([^)]+)\)$/);
  if (imgMatch) {
    return (
      <figure key={index} className="my-6">
        <img src={imgMatch[2]} alt={imgMatch[1]} className="w-full rounded-lg" />
        {imgMatch[1] && (
          <figcaption className="text-xs text-muted-foreground mt-1 text-center">{imgMatch[1]}</figcaption>
        )}
      </figure>
    );
  }

  const ytEmbedMatch = line.trim().match(/^\{\{youtube:(.+?)\}\}$/);
  if (ytEmbedMatch) {
    const url = ytEmbedMatch[1];
    const vidMatch = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\s]+)/);
    const embedSrc = vidMatch ? `https://www.youtube.com/embed/${vidMatch[1]}` : url;
    return (
      <div key={index} className="my-6 aspect-video rounded-lg overflow-hidden bg-muted">
        <iframe src={embedSrc} title="YouTube" className="w-full h-full" allowFullScreen />
      </div>
    );
  }

  const ttEmbedMatch = line.trim().match(/^\{\{tiktok:(.+?)\}\}$/);
  if (ttEmbedMatch) {
    return (
      <div key={index} className="my-6 flex justify-center">
        <a href={ttEmbedMatch[1]} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 p-3 bg-muted rounded-lg hover:bg-muted/80 transition-colors">
          <svg className="h-6 w-6 flex-shrink-0" viewBox="0 0 24 24" fill="currentColor"><path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1v-3.5a6.37 6.37 0 00-.79-.05A6.34 6.34 0 003.15 15.2a6.34 6.34 0 006.34 6.34 6.34 6.34 0 006.34-6.34V9.42a8.16 8.16 0 004.76 1.52v-3.4a4.85 4.85 0 01-1-.85z"/></svg>
          <span className="text-sm font-medium">Se video på TikTok</span>
        </a>
      </div>
    );
  }

  const fmMatch = line.trim().match(/^\{\{full_kamp:(.+?)\}\}$/);
  if (fmMatch) {
    return <FullMatchEmbedPreview key={index} matchId={fmMatch[1]} />;
  }

  if (!line.trim()) return null;
  return (
    <p key={index} className="text-foreground mb-3 leading-relaxed text-sm">
      {renderInlineFormatting(line)}
    </p>
  );
}

export function ArticlePreview({ title, excerpt, content, imageUrl, category, author, imageFocalY }: ArticlePreviewProps) {
  const heroImage = imageUrl || fagerborgLogo;

  return (
    <div className="bg-background rounded-lg border overflow-hidden">
      {/* Mini hero */}
      <div className="relative w-full overflow-hidden bg-fagerborg-navy">
        <img src={heroImage} alt="" aria-hidden="true" className="absolute inset-0 w-full h-full object-cover scale-110 blur-2xl opacity-60" />
        <div className="relative max-w-full mx-auto pt-4 pb-16">
          <img src={heroImage} alt={title || 'Forhåndsvisning'} className="w-full h-auto block max-h-[300px] object-contain" />
        </div>
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent pointer-events-none" />
        <div className="absolute bottom-0 inset-x-0 p-4 z-10">
          <h1 className="text-lg md:text-2xl font-bold text-white leading-tight">
            {title || 'Tittel på artikkelen'}
          </h1>
        </div>
      </div>

      {/* Meta bar */}
      <div className="border-b border-border px-4 py-2 flex items-center gap-4 text-xs text-muted-foreground">
        <span className="text-primary font-bold uppercase tracking-wider">{category}</span>
        <span className="flex items-center gap-1">
          <Calendar className="w-3 h-3" />
          {format(new Date(), 'd. MMMM yyyy', { locale: nb })}
        </span>
        <span className="flex items-center gap-1">
          <User className="w-3 h-3" />
          {author}
        </span>
      </div>

      {/* Content */}
      <div className="p-4 md:p-6">
        {excerpt && (
          <p className="text-sm md:text-base mb-4 leading-relaxed text-primary font-extrabold">
            {excerpt}
          </p>
        )}
        <div className="prose prose-sm max-w-none">
          {content.split('\n').map((line, index) => renderPreviewBlock(line, index))}
        </div>
      </div>
    </div>
  );
}
