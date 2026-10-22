import { useQuery } from '@tanstack/react-query';
import { Instagram, ArrowUpRight, Play } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';

const PROFILE_URL = 'https://www.instagram.com/fagerborg_bk/';
const MAX_POSTS = 3;

export interface InstagramCardPost {
  id: string;
  title: string;
  alt_text: string | null;
  image_url: string;
  instagram_url: string;
  is_video: boolean;
  focus_x: number;
  focus_y: number;
}

const InstagramFeed = () => {
  const { data: posts, isLoading } = useQuery({
    queryKey: ['instagram-posts-public'],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('instagram-feed', {
        body: { action: 'feed' },
      });
      if (error) throw error;
      return (data?.posts ?? []).slice(0, MAX_POSTS) as InstagramCardPost[];
    },
    retry: false,
  });

  const hasPosts = !!posts && posts.length > 0;

  return (
    <section aria-labelledby="instagram-heading" className="border-t border-border/50 bg-background py-10 md:py-12">
      <div className="container mx-auto px-4">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 id="instagram-heading" className="flex items-center gap-2 text-lg font-semibold text-foreground">
              <Instagram className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
              Rundt laget
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">Glimt fra Fagerborg BK på Instagram</p>
          </div>
          <Button asChild variant="ghost" size="sm" className="gap-1 text-muted-foreground">
            <a href={PROFILE_URL} target="_blank" rel="noopener noreferrer">
              Følg @fagerborg_bk <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
            </a>
          </Button>
        </div>

        {isLoading ? (
          <div className="grid gap-6 md:grid-cols-3">
            {Array.from({ length: 3 }, (_, i) => (
              <div key={i} className="animate-pulse rounded-xl border border-border">
                <div className="aspect-[4/5] bg-muted" />
              </div>
            ))}
          </div>
        ) : hasPosts ? (
          <ul className="-mx-4 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-2 md:mx-0 md:grid md:grid-cols-3 md:gap-6 md:overflow-visible md:px-0 md:pb-0">
            {(posts ?? []).map((post) => (
              <li
                key={post.id}
                className="w-[72%] shrink-0 snap-start md:w-auto md:shrink"
              >
                <a
                  href={post.instagram_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group block overflow-hidden rounded-xl border border-border bg-card transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                >
                  <div className="relative aspect-[4/5] overflow-hidden">
                    <img
                      src={post.image_url}
                      alt={post.alt_text || post.title}
                      loading="lazy"
                      className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                      style={{ objectPosition: `${post.focus_x}% ${post.focus_y}%` }}
                    />
                    {post.is_video && (
                      <span
                        className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-background/80 text-foreground backdrop-blur-sm"
                        aria-label="Videoinnlegg"
                      >
                        <Play className="h-3.5 w-3.5 fill-current ml-0.5" aria-hidden="true" />
                      </span>
                    )}
                  </div>
                  <div className="p-4">
                    <h3 className="line-clamp-2 text-sm font-semibold text-foreground group-hover:text-primary transition-colors">
                      {post.title}
                    </h3>
                  </div>
                </a>
              </li>
            ))}
          </ul>
        ) : (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border px-5 py-4">
            <p className="text-sm text-muted-foreground">
              Vi deler bilder og glimt fra hverdagen i Fagerborg BK på Instagram.
            </p>
            <Button asChild variant="outline" size="sm" className="gap-1">
              <a href={PROFILE_URL} target="_blank" rel="noopener noreferrer">
                <Instagram className="h-4 w-4" aria-hidden="true" />
                Følg @fagerborg_bk <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
              </a>
            </Button>
          </div>
        )}
      </div>
    </section>
  );
};

export default InstagramFeed;
