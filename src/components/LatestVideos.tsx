import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useSearchParams, useLocation } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { Play, ArrowRight, Lock, ExternalLink, Mail, Loader2 } from 'lucide-react';
import { useSiteVideos } from '@/hooks/useSiteVideos';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import heroMatch1 from '@/assets/hero-match-1.jpg';
import VideoMatchThumb, { type ThumbMatch } from '@/components/VideoMatchThumb';
import VideoFrameThumb from '@/components/VideoFrameThumb';
import { HOMEPAGE_MOBILE_VIDEO_LIMIT, HOMEPAGE_VIDEO_LIMIT } from '@/lib/homepageMedia';

interface LatestVideosProps {
  category?: string;
  limit?: number;
  /** Homepage-only layout: 2x2 on large screens (xl+), three across from tablet width, three stacked on mobile. */
  homepage?: boolean;
  title?: string;
  hideAllLink?: boolean;
  /** Show a "Last inn flere" button instead of rendering every video at once */
  paginate?: boolean;
  /** How many videos to show per page when paginate is on */
  pageSize?: number;
}

const LatestVideos = ({ category, limit = 6, title, hideAllLink, paginate, pageSize = 12, homepage = false }: LatestVideosProps) => {
  const { data: allVideos, isLoading } = useSiteVideos();
  const location = useLocation();
  const [visibleCount, setVisibleCount] = useState(pageSize);

  // Match data for scoreboard-style covers on videos without a thumbnail
  const matchIds = Array.from(
    new Set((allVideos ?? []).map((v) => v.match_id).filter((id): id is string => !!id))
  );
  const { data: matchMap } = useQuery({
    queryKey: ['video-thumb-matches', matchIds.sort().join(',')],
    enabled: matchIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('matches_public')
        .select('id, opponent, opponent_logo_url, is_home, home_score, away_score, match_date, competition, venue, status')
        .in('id', matchIds);
      if (error) throw error;
      const map = new Map<string, ThumbMatch>();
      for (const m of (data ?? []) as any[]) map.set(m.id, m as ThumbMatch);
      return map;
    },
  });

  // Map URL category param to DB category value
  const categoryMap: Record<string, string> = {
    hoydepunkter: 'highlights',
    'match-day': 'match_day',
    'full-kamp': 'full_match',
    podcast: 'podcast',
    inside: 'inside',
    direktesendinger: 'livestream',
  };

  const dbCategory = category ? categoryMap[category] : undefined;
  const videos = dbCategory
    ? allVideos?.filter((v) => v.category === dbCategory)
    : allVideos;

  // Reset pagination when the category changes
  useEffect(() => {
    setVisibleCount(pageSize);
  }, [category, pageSize]);

  const visibleVideos = videos
    ? paginate
      ? videos.slice(0, visibleCount)
      : limit
        ? videos.slice(0, limit)
        : videos
    : [];
  const hasMore = paginate && !!videos && videos.length > visibleVideos.length;

  const computedTitle = category
    ? { hoydepunkter: 'Høydepunkter', 'match-day': 'Match Day', 'full-kamp': 'Full kamp', podcast: 'Podcast', inside: 'Inside', direktesendinger: 'Direktesendinger' }[category] || 'Videoer'
    : 'Siste Videoer';
  const sectionTitle = title ?? computedTitle;
  const isOnAllVideosPage = location.pathname === '/videoer';
  const showAllLink = !category && !hideAllLink && !isOnAllVideosPage;
  const [selectedVideo, setSelectedVideo] = useState<string | null>(null);
  const [passwordDialogOpen, setPasswordDialogOpen] = useState(false);
  const [pendingVideo, setPendingVideo] = useState<{ id: string; url: string } | null>(null);
  const [passwordInput, setPasswordInput] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [verifiedUrl, setVerifiedUrl] = useState<string | null>(null);
  const [coverFailed, setCoverFailed] = useState<Record<string, boolean>>({});

  // OTP member verification state
  const [otpMode, setOtpMode] = useState(false);
  const [otpStep, setOtpStep] = useState<'email' | 'otp'>('email');
  const [otpEmail, setOtpEmail] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [otpLoading, setOtpLoading] = useState(false);
  const [otpError, setOtpError] = useState('');

  const isMemberVerified = () => localStorage.getItem('fbk_member_verified') === 'true';

  // Auto-open video from ?v= query param
  const [searchParams, setSearchParams] = useSearchParams();
  useEffect(() => {
    const videoId = searchParams.get('v');
    if (!videoId || !allVideos || allVideos.length === 0) return;
    const video = allVideos.find((v) => v.id === videoId);
    if (!video) return;
    // Clear the param so it doesn't re-trigger
    searchParams.delete('v');
    setSearchParams(searchParams, { replace: true });
    handleVideoClick(video);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allVideos, searchParams]);

  const handleVideoClick = (video: { id: string; video_url: string | null; is_protected: boolean }) => {
    // Track view (fire-and-forget)
    (async () => {
      try {
        let vid = localStorage.getItem('fbk_visitor_id');
        if (!vid) {
          vid = crypto.randomUUID();
          localStorage.setItem('fbk_visitor_id', vid);
        }
        await supabase.from('video_clicks').insert({ video_id: video.id, visitor_id: vid });
      } catch {/* ignore */}
    })();
    if (video.is_protected) {
      // Protected videos: URL is not exposed by the public view.
      // The unlock flow fetches the URL from the server after password/OTP.
      setPendingVideo({ id: video.id, url: '' });
      setPasswordDialogOpen(true);
      setPasswordInput('');
      setPasswordError('');
      setVerifiedUrl(null);
      setOtpMode(false);
      setOtpStep('email');
      setOtpEmail('');
      setOtpCode('');
      setOtpError('');
    } else if (!video.video_url) {
      return;
    } else if (!isEmbeddable(video.video_url)) {
      window.open(video.video_url, '_blank', 'noopener');
    } else {
      setSelectedVideo(video.video_url);
    }
  };

  const handlePasswordSubmit = async () => {
    if (!pendingVideo) return;
    setIsVerifying(true);
    setPasswordError('');
    try {
      const { data, error } = await supabase.functions.invoke('verify-video-password', {
        body: { video_id: pendingVideo.id, password: passwordInput },
      });
      if (error) throw error;
      if (data?.valid && data.video_url) {
        const unlocked: string = data.video_url;
        if (!isEmbeddable(unlocked)) {
          setVerifiedUrl(unlocked);
        } else {
          setSelectedVideo(unlocked);
          setPasswordDialogOpen(false);
          setPendingVideo(null);
          setPasswordInput('');
        }
      } else {
        setPasswordError('Feil passord');
      }
    } catch {
      setPasswordError('Noe gikk galt, prøv igjen');
    } finally {
      setIsVerifying(false);
    }
  };

  const handleOtpSend = async () => {
    if (!otpEmail.trim()) return;
    setOtpLoading(true);
    setOtpError('');
    try {
      const { data, error } = await supabase.functions.invoke('livestream-otp', {
        body: { action: 'send', email: otpEmail.trim(), match_id: '00000000-0000-0000-0000-000000000000' },
      });
      if (error) throw error;
      if (data?.error === 'not_member') {
        setOtpError('Denne e-posten er ikke registrert som medlem.');
      } else if (data?.error) {
        setOtpError(data.error);
      } else {
        setOtpStep('otp');
      }
    } catch {
      setOtpError('Noe gikk galt. Prøv igjen.');
    } finally {
      setOtpLoading(false);
    }
  };

  const handleOtpVerify = async () => {
    if (otpCode.length !== 6) return;
    setOtpLoading(true);
    setOtpError('');
    try {
      const { data, error } = await supabase.functions.invoke('livestream-otp', {
        body: {
          action: 'verify',
          email: otpEmail.trim(),
          match_id: '00000000-0000-0000-0000-000000000000',
          code: otpCode,
          video_id: pendingVideo?.id,
        },
      });
      if (error) throw error;
      if (data?.valid && data.video_url) {
        localStorage.setItem('fbk_member_verified', 'true');
        const unlocked: string = data.video_url;
        if (!isEmbeddable(unlocked)) {
          setVerifiedUrl(unlocked);
        } else {
          setSelectedVideo(unlocked);
          setPasswordDialogOpen(false);
          setPendingVideo(null);
        }
      } else {
        setOtpError('Ugyldig eller utløpt kode.');
        setOtpCode('');
      }
    } catch {
      setOtpError('Noe gikk galt. Prøv igjen.');
    } finally {
      setOtpLoading(false);
    }
  };

  const isEmbeddable = (url: string | null) => {
    if (!url) return false;
    return /youtube\.com|youtu\.be|vimeo\.com|supabase\.co|\/__l5e\/assets-v1\/|\/videos\//i.test(url) && !/veo\.co/i.test(url);
  };

  /** Extract YouTube video ID from any YouTube URL format */
  const getYouTubeId = (url: string | null): string | null => {
    if (!url) return null;
    const m = url.match(/(?:youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|live\/)|youtu\.be\/)([a-zA-Z0-9_-]+)/);
    return m ? m[1] : null;
  };

  /** Get thumbnail: use explicit thumbnail, fall back to YouTube auto-thumbnail */
  const getThumbnail = (video: { thumbnail_url: string | null; video_url: string | null }) => {
    if (video.thumbnail_url) return video.thumbnail_url;
    const ytId = getYouTubeId(video.video_url);
    if (ytId) return `https://img.youtube.com/vi/${ytId}/hqdefault.jpg`;
    return heroMatch1;
  };

  /**
   * For protected videos the URL is hidden, so we ask the backend for the
   * YouTube cover image (it never reveals the YouTube ID to the client).
   */
  const getProxyThumbnail = (video: { id: string; thumbnail_url: string | null; video_url: string | null }) => {
    if (video.thumbnail_url || video.video_url) return null;
    if (coverFailed[video.id]) return null;
    return `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/video-thumbnail?video_id=${video.id}`;
  };

  /** Scoreboard cover when no image cover can be resolved at all */
  const getMatchThumb = (video: { id: string; thumbnail_url: string | null; video_url: string | null; match_id: string | null }) => {
    if (video.thumbnail_url || getYouTubeId(video.video_url)) return null;
    if (getFrameThumbUrl(video)) return null;
    if (getProxyThumbnail(video)) return null;
    if (!video.match_id) return null;
    return matchMap?.get(video.match_id) ?? null;
  };

  /** For uploaded video files: use an actual frame from the video as cover */
  const getFrameThumbUrl = (video: { thumbnail_url: string | null; video_url: string | null }) => {
    if (video.thumbnail_url || getYouTubeId(video.video_url)) return null;
    const url = video.video_url;
    if (!url || !/^https?:\/\//i.test(url)) return null;
    return isDirectVideoFile(url) ? url : null;
  };

  const getEmbedUrl = (url: string) => {
    // YouTube watch
    const youtubeMatch = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&]+)/);
    if (youtubeMatch) {
      return `https://www.youtube.com/embed/${youtubeMatch[1]}`;
    }
    // YouTube live
    const ytLive = url.match(/youtube\.com\/live\/([a-zA-Z0-9_-]+)/);
    if (ytLive) {
      return `https://www.youtube.com/embed/${ytLive[1]}`;
    }
    // Vimeo
    const vimeoMatch = url.match(/vimeo\.com\/(\d+)/);
    if (vimeoMatch) {
      return `https://player.vimeo.com/video/${vimeoMatch[1]}`;
    }
    return url;
  };

  /** Is this a direct video file URL (should use native <video>, not iframe)? */
  const isDirectVideoFile = (url: string) => {
    return /\.(mp4|mov|webm|m4v|ogg)(\?|$)/i.test(url) || /\/storage\/v1\/object\/public\//i.test(url) || /\/__l5e\/assets-v1\//i.test(url) || /\/videos\//i.test(url);
  };

  if (isLoading) {
    return (
      <section className="py-12 bg-background">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-2xl md:text-3xl font-bold text-foreground">
              {sectionTitle}
            </h2>
          </div>
          <div className={homepage ? 'grid grid-cols-1 sm:grid-cols-3 xl:grid-cols-2 gap-6' : 'grid sm:grid-cols-2 lg:grid-cols-3 gap-6'}>
            {Array.from({ length: homepage ? HOMEPAGE_VIDEO_LIMIT : 3 }, (_, i) => (
              <div key={i} className={`animate-pulse ${homepage && i >= HOMEPAGE_MOBILE_VIDEO_LIMIT ? 'hidden xl:block' : ''}`}>
                <div className="bg-muted rounded-xl aspect-video mb-4" />
                <div className="h-5 bg-muted rounded w-3/4" />
              </div>
            ))}
          </div>
        </div>
      </section>
    );
  }

  // If no videos from database, show empty state
  if (!videos || videos.length === 0) {
    return (
      <section className="py-12 bg-background">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-2xl md:text-3xl font-bold text-foreground">
              {sectionTitle}
            </h2>
          </div>
          <div className="text-center py-12 text-muted-foreground">
            <Play className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>Ingen videoer publisert ennå</p>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="py-12 bg-background">
      {videos && videos.length > 0 && (
        <Helmet>
          <script type="application/ld+json">
            {JSON.stringify(
              visibleVideos
                .map((video) => {
                  const thumb = getThumbnail(video);
                  const absThumb = thumb.startsWith('http')
                    ? thumb
                    : `https://fagerborgbk.no${thumb.startsWith('/') ? '' : '/'}${thumb}`;
                  const rawUrl = video.video_url || undefined;
                  const ytId = getYouTubeId(video.video_url);
                  const embedUrl = ytId
                    ? `https://www.youtube.com/embed/${ytId}`
                    : undefined;
                  // Google requires either contentUrl or embedUrl. Videos without a
                  // public URL (e.g. protected full matches) are skipped entirely.
                  const contentUrl =
                    !ytId && rawUrl && /^https?:\/\//i.test(rawUrl) ? rawUrl : undefined;
                  if (!contentUrl && !embedUrl) return null;
                  return {
                    '@context': 'https://schema.org',
                    '@type': 'VideoObject',
                    name: video.title,
                    description: video.description || video.title,
                    thumbnailUrl: [absThumb],
                    uploadDate: video.published_at || video.created_at,
                    ...(contentUrl ? { contentUrl } : {}),
                    ...(embedUrl ? { embedUrl } : {}),
                  };
                })
                .filter(Boolean)
            )}
          </script>
        </Helmet>
      )}
      <div className="container mx-auto px-4">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-8">
          <h2 className="text-2xl md:text-3xl font-bold text-foreground">
            {sectionTitle}
          </h2>
          {showAllLink && (
            <a 
              href="/videoer" 
              className="text-primary hover:text-primary/80 font-semibold flex items-center gap-1 transition-colors"
            >
              Se alle videoer
              <ArrowRight className="w-4 h-4" />
            </a>
          )}
        </div>

        <div className={homepage ? 'grid grid-cols-1 sm:grid-cols-3 xl:grid-cols-2 gap-6' : 'grid sm:grid-cols-2 lg:grid-cols-3 gap-6'}>
          {visibleVideos.map((video, index) => (
            <article
              key={video.id}
              className={`group cursor-pointer ${homepage && index >= HOMEPAGE_MOBILE_VIDEO_LIMIT ? 'hidden xl:block' : ''}`}
              style={{ animationDelay: `${index * 100}ms` }}
              onClick={() => handleVideoClick(video)}
            >
              <div className="relative overflow-hidden rounded-xl aspect-video mb-4">
                {(() => {
                  const thumbMatch = getMatchThumb(video);
                  const proxy = getProxyThumbnail(video);
                  const frameUrl = getFrameThumbUrl(video);
                  return frameUrl ? (
                    <div className="w-full h-full group-hover:scale-105 transition-transform duration-500">
                      <VideoFrameThumb url={frameUrl} />
                    </div>
                  ) : thumbMatch ? (
                    <div className="w-full h-full group-hover:scale-105 transition-transform duration-500">
                      <VideoMatchThumb match={thumbMatch} />
                    </div>
                  ) : proxy ? (
                    <img
                      src={proxy}
                      alt={video.title}
                      loading="lazy"
                      onError={() => setCoverFailed((prev) => ({ ...prev, [video.id]: true }))}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                  ) : (
                    <img
                      src={getThumbnail(video)}
                      alt={video.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                  );
                })()}
                {!getMatchThumb(video) && (
                  <div className="absolute inset-0 bg-black/30 group-hover:bg-black/40 transition-colors" />
                )}
                
                {/* Play icon — bottom left, subtle */}
                {isEmbeddable(video.video_url) && (
                  <div className="absolute bottom-3 left-3 w-9 h-9 bg-black/50 backdrop-blur-sm rounded-lg flex items-center justify-center group-hover:bg-black/70 transition-colors">
                    <Play className="w-4 h-4 text-white/80 fill-current ml-0.5" />
                  </div>
                )}

                {/* External link icon — bottom right, subtle */}
                {!isEmbeddable(video.video_url) && (
                  <div className="absolute bottom-3 right-3 w-9 h-9 bg-black/50 backdrop-blur-sm rounded-lg flex items-center justify-center group-hover:bg-black/70 transition-colors">
                    <ExternalLink className="w-4 h-4 text-white/80" />
                  </div>
                )}

                {/* Category Badge */}
                {(video.category === 'highlights' || video.category === 'full_match' || video.category === 'match_day' || video.category === 'inside') && (
                  <span className="absolute top-3 left-3 px-2 py-1 bg-primary text-primary-foreground text-xs font-bold rounded">
                    {video.category === 'highlights' ? 'Høydepunkter' : video.category === 'full_match' ? 'Full kamp' : video.category === 'inside' ? 'Inside' : 'Match Day'}
                  </span>
                )}

                {/* Protected Badge */}
                {video.is_protected && (
                  <span className="absolute top-3 right-3 px-2 py-1 bg-white text-foreground text-xs font-bold rounded flex items-center gap-1">
                    <Lock className="w-3 h-3" />
                    Passord
                  </span>
                )}
              </div>

              <h3 className="font-semibold text-foreground group-hover:text-primary transition-colors line-clamp-2">
                {video.title}
              </h3>
              {video.description && video.category === 'full_match' && (
                <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                  {video.description}
                </p>
              )}
            </article>
          ))}
        </div>

        {hasMore && (
          <div className="mt-10 flex flex-col items-center gap-2">
            <Button
              variant="outline"
              size="lg"
              className="rounded-full px-8"
              onClick={() => setVisibleCount((c) => c + pageSize)}
            >
              Last inn flere videoer
            </Button>
            <p className="text-xs text-muted-foreground">
              Viser {visibleVideos.length} av {videos.length}
            </p>
          </div>
        )}
      </div>

      {/* Video Player Dialog */}
      <Dialog open={!!selectedVideo} onOpenChange={(open) => !open && setSelectedVideo(null)}>
        <DialogContent className="max-w-4xl p-0 overflow-hidden">
          <div className="aspect-video">
            {selectedVideo && (
              isDirectVideoFile(selectedVideo) ? (
                <video
                  src={selectedVideo}
                  className="w-full h-full bg-black"
                  controls
                  autoPlay
                  playsInline
                />
              ) : (
                <iframe
                  src={getEmbedUrl(selectedVideo)}
                  className="w-full h-full"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              )
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Password / OTP Dialog */}
      <Dialog open={passwordDialogOpen} onOpenChange={setPasswordDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Lock className="w-5 h-5" />
              Passordbeskyttet video
            </DialogTitle>
            <DialogDescription>
              {otpMode
                ? 'Verifiser medlemskapet ditt med e-post for å låse opp alle beskyttede videoer.'
                : 'Skriv inn passordet du har fått, eller verifiser deg som medlem.'}
            </DialogDescription>
          </DialogHeader>

          {verifiedUrl ? (
            <div className="space-y-4 pt-4">
              <p className="text-sm text-muted-foreground">Tilgang godkjent! Trykk på knappen under for å åpne videoen.</p>
              <div className="flex justify-center">
                <a
                  href={verifiedUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 bg-primary text-primary-foreground font-semibold px-6 py-3 rounded-lg hover:bg-primary/90 transition-colors"
                  onClick={() => {
                    setPasswordDialogOpen(false);
                    setVerifiedUrl(null);
                    setPendingVideo(null);
                  }}
                >
                  <ExternalLink className="w-4 h-4" />
                  Åpne video
                </a>
              </div>
            </div>
          ) : otpMode ? (
            /* OTP member verification */
            <div className="space-y-4 pt-4">
              {otpStep === 'email' ? (
                <>
                  <Input
                    type="email"
                    placeholder="din@epost.no"
                    value={otpEmail}
                    onChange={(e) => { setOtpEmail(e.target.value); setOtpError(''); }}
                    onKeyDown={(e) => e.key === 'Enter' && handleOtpSend()}
                    className="text-center"
                    autoFocus
                  />
                  {otpError && <p className="text-sm text-destructive">{otpError}</p>}
                  <Button onClick={handleOtpSend} className="w-full gap-2" disabled={otpLoading || !otpEmail.trim()}>
                    {otpLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mail className="w-4 h-4" />}
                    Send engangskode
                  </Button>
                </>
              ) : (
                <>
                  <p className="text-sm text-muted-foreground text-center">
                    Vi har sendt en 6-sifret kode til <strong>{otpEmail}</strong>
                  </p>
                  <div className="flex justify-center">
                    <InputOTP maxLength={6} value={otpCode} onChange={setOtpCode}>
                      <InputOTPGroup>
                        <InputOTPSlot index={0} />
                        <InputOTPSlot index={1} />
                        <InputOTPSlot index={2} />
                        <InputOTPSlot index={3} />
                        <InputOTPSlot index={4} />
                        <InputOTPSlot index={5} />
                      </InputOTPGroup>
                    </InputOTP>
                  </div>
                  {otpError && <p className="text-sm text-destructive">{otpError}</p>}
                  <Button onClick={handleOtpVerify} className="w-full" disabled={otpLoading || otpCode.length !== 6}>
                    {otpLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                    Verifiser
                  </Button>
                  <button
                    onClick={() => { setOtpStep('email'); setOtpCode(''); setOtpError(''); }}
                    className="text-xs text-muted-foreground hover:text-foreground transition-colors w-full text-center"
                  >
                    Bruk en annen e-post
                  </button>
                </>
              )}
              <div className="pt-2 border-t border-border/50">
                <button
                  onClick={() => { setOtpMode(false); setOtpError(''); }}
                  className="text-xs text-muted-foreground hover:text-foreground transition-colors w-full text-center"
                >
                  ← Bruk passord i stedet
                </button>
              </div>
            </div>
          ) : (
            /* Password entry */
            <div className="space-y-4 pt-4">
              <Input
                type="password"
                placeholder="Skriv inn passord"
                value={passwordInput}
                onChange={(e) => {
                  setPasswordInput(e.target.value);
                  setPasswordError('');
                }}
                onKeyDown={(e) => e.key === 'Enter' && handlePasswordSubmit()}
              />
              {passwordError && (
                <p className="text-sm text-destructive">{passwordError}</p>
              )}
              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={() => setPasswordDialogOpen(false)}>
                  Avbryt
                </Button>
                <Button onClick={handlePasswordSubmit} disabled={isVerifying}>
                  {isVerifying ? 'Sjekker...' : 'Se video'}
                </Button>
              </div>
              <div className="pt-2 border-t border-border/50">
                <button
                  onClick={() => setOtpMode(true)}
                  className="text-xs text-muted-foreground hover:text-foreground transition-colors w-full text-center flex items-center justify-center gap-1.5"
                >
                  <Mail className="w-3 h-3" />
                  Er du medlem? Verifiser med e-post i stedet
                </button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </section>
  );
};

export default LatestVideos;
