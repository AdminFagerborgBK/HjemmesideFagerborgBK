import { useParams, Link } from 'react-router-dom';
import Header from '@/components/Header';
import Seo from '@/components/Seo';
import Footer from '@/components/Footer';
import LatestVideos from '@/components/LatestVideos';
import { useSiteSetting } from '@/hooks/useSiteSettings';
import { useUpcomingMatches } from '@/hooks/useMatches';
import { formatOsloDateLong, formatOsloTime } from '@/lib/osloTime';
import { useState, useEffect } from 'react';
import { Radio, Calendar, Clock, Volume2, VolumeX, ArrowRight } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import LivestreamGate from '@/components/LivestreamGate';
import { useLivestreamUrl } from '@/hooks/useLivestreamUrl';

const categoryLabels: Record<string, { title: string; description: string }> = {
  hoydepunkter: {
    title: 'Høydepunkter',
    description: 'Se høydepunkter fra Fagerborg BKs kamper',
  },
  'match-day': {
    title: 'Match Day',
    description: 'Se Match Day-klipp fra Fagerborg BKs kamper',
  },
  'full-kamp': {
    title: 'Full kamp',
    description: 'Se hele kampen fra Fagerborg BK',
  },
  podcast: {
    title: 'Podcast',
    description: 'Lytt til podcasten til Fagerborg BK',
  },
  inside: {
    title: 'Inside',
    description: 'Bli med bak kulissene i Inside Fagerborg',
  },
  direktesendinger: {
    title: 'Direktesendinger',
    description: 'Se direktesendinger fra Fagerborg BKs kamper',
  },
};

/** Convert any YouTube/Hudl URL to an embed URL with desired params */
const getEmbedUrl = (url: string, opts: { autoplay?: boolean; mute?: boolean } = {}): string => {
  if (!url) return url;
  const { autoplay = true, mute = false } = opts;

  const params = new URLSearchParams();
  if (autoplay) params.set('autoplay', '1');
  if (mute) params.set('mute', '1');
  params.set('rel', '0');
  params.set('modestbranding', '1');
  const qs = params.toString();

  // Already an embed URL
  if (url.includes('youtube.com/embed/')) {
    const base = url.split('?')[0];
    return `${base}?${qs}`;
  }
  // Vimeo
  if (url.includes('player.vimeo.com')) return url;
  // Hudl – pass through as-is (they handle their own embed params)
  if (url.includes('hudl.com')) return url;

  // youtube.com/watch?v=ID
  const ytWatch = url.match(/youtube\.com\/watch\?(?:.*&)?v=([a-zA-Z0-9_-]+)/);
  if (ytWatch) return `https://www.youtube.com/embed/${ytWatch[1]}?${qs}`;

  // youtu.be/ID
  const ytShort = url.match(/youtu\.be\/([a-zA-Z0-9_-]+)/);
  if (ytShort) return `https://www.youtube.com/embed/${ytShort[1]}?${qs}`;

  // youtube.com/live/ID
  const ytLive = url.match(/youtube\.com\/live\/([a-zA-Z0-9_-]+)/);
  if (ytLive) return `https://www.youtube.com/embed/${ytLive[1]}?${qs}`;

  return url;
};

const trackLivestreamClick = async (matchId: string, action: 'donated' | 'skipped') => {
  await supabase.from('livestream_stats').insert({ match_id: matchId, action });
};

/* ─── Pre-kickoff blurred preview ──────────────────────────────────────── */
const BlurredPreview = ({
  livestreamUrl,
  opponent,
  matchId,
  donationChoice,
  onDonationChoice,
}: {
  livestreamUrl: string;
  opponent: string;
  matchId: string;
  donationChoice: null | 'donated' | 'skipped';
  onDonationChoice: (choice: 'donated' | 'skipped') => void;
}) => {
  const [audioEnabled, setAudioEnabled] = useState(false);
  const [iframeKey, setIframeKey] = useState(0);

  const toggleAudio = () => {
    setAudioEnabled((prev) => !prev);
    setIframeKey((k) => k + 1);
  };

  const handleChoice = (choice: 'donated' | 'skipped') => {
    onDonationChoice(choice);
    // Note: tracking is handled by parent via onDonationChoice
  };

  return (
    <div className="max-w-4xl mx-auto mt-10 px-4">
      <p className="text-center text-sm text-muted-foreground mb-3 font-medium flex items-center justify-center gap-1.5">
        <Radio className="w-3.5 h-3.5 text-destructive animate-pulse" />
        Sending pågår — bildet vises ved kampstart
      </p>

      <div className="relative aspect-video rounded-xl overflow-hidden shadow-lg bg-black">
        {/* Iframe — blurred visually, audio controllable */}
        <iframe
          key={iframeKey}
          src={getEmbedUrl(livestreamUrl, { autoplay: true, mute: !audioEnabled })}
          className="w-full h-full"
          style={{ filter: 'blur(5px)', transform: 'scale(1.02)' }}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        />

        {/* Dark overlay */}
        <div className="absolute inset-0 bg-black/50 pointer-events-none" />

        {/* Center overlay — Vipps prompt or confirmed state */}
        {donationChoice === null ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center px-4">
            <div className="bg-black/70 backdrop-blur-sm rounded-2xl px-6 py-6 text-center max-w-sm w-full">
              <Radio className="w-6 h-6 text-white animate-pulse mx-auto mb-3" />
              <p className="text-white font-bold text-lg mb-1">Fagerborg vs {opponent}</p>
              <p className="text-white/70 text-xs mb-4">Sending pågår — bildet vises ved kampstart</p>

              <div className="bg-white/10 rounded-xl px-4 py-3 mb-4">
                <p className="text-white/60 text-xs uppercase tracking-wider mb-0.5">Vipps-nummer</p>
                <p className="text-white font-bold text-3xl">#12220</p>
                <p className="text-white/50 text-xs mt-0.5">Fagerborg BKb</p>
              </div>

              <p className="text-white/60 text-xs mb-4">
                Sendingene drives av dugnadsinnsats. Vipps gjerne en liten sum for å støtte — helt frivillig!
              </p>

              <div className="space-y-2">
                <button
                  onClick={() => handleChoice('donated')}
                  className="w-full py-2.5 bg-[#ff5b24] hover:bg-[#e54e1c] text-white font-semibold rounded-xl transition-colors text-sm pointer-events-auto"
                >
                  Jeg har vippset — vis kampen 🙌
                </button>
                <button
                  onClick={() => handleChoice('skipped')}
                  className="w-full py-2.5 bg-white/10 hover:bg-white/20 text-white/80 rounded-xl transition-colors text-sm pointer-events-auto"
                >
                  Jeg donerer neste gang 🤝
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
            <div className="bg-black/60 backdrop-blur-sm rounded-2xl px-6 py-4 text-center">
              <Radio className="w-6 h-6 text-white animate-pulse mx-auto mb-2" />
              <p className="text-white font-semibold text-sm">
                {donationChoice === 'donated' ? '🙌 Takk for støtten!' : 'Sendingen starter ved kampstart'}
              </p>
              <p className="text-white/60 text-xs mt-1">Bildet vises automatisk ved kampstart</p>
            </div>
          </div>
        )}

        {/* Audio toggle — bottom right */}
        <button
          onClick={toggleAudio}
          className="absolute bottom-3 right-3 flex items-center gap-2 bg-black/70 hover:bg-black/90 text-white text-xs font-semibold px-3 py-2 rounded-full transition-colors pointer-events-auto"
          aria-label={audioEnabled ? 'Slå av lyd' : 'Slå på lyd'}
        >
          {audioEnabled ? (
            <><Volume2 className="w-4 h-4" /> Lyd på</>
          ) : (
            <><VolumeX className="w-4 h-4" /> Lyd av</>
          )}
        </button>
      </div>
    </div>
  );
};

/* ─── Main livestream section ───────────────────────────────────────────── */
const LivestreamSection = () => {
  // Direktesending er kun for A-laget (5. divisjon)
  const { data: upcomingMatches } = useUpcomingMatches(1, 'A-laget');
  const nextMatch = upcomingMatches?.[0];
  const [timeLeft, setTimeLeft] = useState({ days: 0, hours: 0, minutes: 0, seconds: 0 });
  const [hasStarted, setHasStarted] = useState(false);
  const [donationChoice, setDonationChoice] = useState<null | 'donated' | 'skipped'>(null);

  // The stream link is never in public match data — the server hands it out only
  // after member verification (or when the club disabled gating).
  const livestreamUrl = useLivestreamUrl(nextMatch?.id);

  useEffect(() => {
    if (!nextMatch) return;
    const target = new Date(nextMatch.match_date).getTime();

    const update = () => {
      const now = Date.now();
      const diff = target - now;
      if (diff <= 0) {
        setHasStarted(true);
        setTimeLeft({ days: 0, hours: 0, minutes: 0, seconds: 0 });
      } else {
        setHasStarted(false);
        setTimeLeft({
          days: Math.floor(diff / (1000 * 60 * 60 * 24)),
          hours: Math.floor((diff / (1000 * 60 * 60)) % 24),
          minutes: Math.floor((diff / (1000 * 60)) % 60),
          seconds: Math.floor((diff / 1000) % 60),
        });
      }
    };

    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [nextMatch]);

  if (!nextMatch) {
    return (
      <div className="container mx-auto px-4 py-16 text-center">
        <Radio className="w-16 h-16 mx-auto mb-6 text-muted-foreground opacity-50" />
        <h2 className="text-2xl font-bold mb-2">Ingen planlagte direktesendinger</h2>
        <p className="text-muted-foreground">Følg med for oppdateringer!</p>
      </div>
  );
  }

  /* ── AFTER KICKOFF ── */
  if (hasStarted && livestreamUrl) {
    // If user already answered the Vipps prompt pre-kickoff, go straight to stream
    if (donationChoice === null) {
      return (
        <LivestreamGate matchId={nextMatch.id} matchDate={nextMatch.match_date}>
          <div className="container mx-auto px-4 py-16">
            <div className="max-w-md mx-auto text-center">
              <div className="bg-card rounded-2xl p-8 shadow-card border border-border/50">
                <div className="text-4xl mb-4">⚽</div>
                <h2 className="text-2xl font-bold mb-2">Fagerborg vs {nextMatch.opponent}</h2>
                <p className="text-muted-foreground text-sm mb-6">
                  Direktesendingene drives av dugnadsinnsats. Vipps gjerne en symbolsk sum (f.eks. 20 kr) til klubben for å støtte dette — helt frivillig!
                </p>
                <div className="bg-muted rounded-xl px-6 py-4 mb-6">
                  <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Vipps-nummer</p>
                  <p className="text-4xl font-bold text-primary">#12220</p>
                  <p className="text-xs text-muted-foreground mt-1">Fagerborg BKb</p>
                </div>
                <div className="space-y-3">
                  <button
                    onClick={() => { setDonationChoice('donated'); trackLivestreamClick(nextMatch.id, 'donated'); }}
                    className="w-full py-3 bg-[#ff5b24] hover:bg-[#e54e1c] text-white font-semibold rounded-xl transition-colors text-sm"
                  >
                    Jeg har vippset — vis kampen 🙌
                  </button>
                  <button
                    onClick={() => { setDonationChoice('skipped'); trackLivestreamClick(nextMatch.id, 'skipped'); }}
                    className="w-full py-3 border border-border text-muted-foreground hover:text-foreground rounded-xl transition-colors text-sm"
                  >
                    Jeg donerer neste gang 🤝
                  </button>
                </div>
              </div>
            </div>
          </div>
        </LivestreamGate>
      );
    }

    // Show stream (already answered)
    return (
      <LivestreamGate matchId={nextMatch.id} matchDate={nextMatch.match_date}>
        <div className="container mx-auto px-4 py-8 md:py-12">
          <div className="max-w-4xl mx-auto">
            <div className="inline-flex items-center gap-2 bg-destructive/10 text-destructive px-4 py-2 rounded-full mb-6">
              <Radio className="w-4 h-4 animate-pulse" />
              <span className="text-sm font-bold uppercase tracking-wider">Live nå</span>
            </div>
            <h2 className="text-2xl md:text-3xl font-bold mb-4">
              Fagerborg vs {nextMatch.opponent}
            </h2>
            <div className="aspect-video rounded-xl overflow-hidden shadow-lg">
              <iframe
                src={getEmbedUrl(livestreamUrl, { autoplay: true, mute: false })}
                className="w-full h-full"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
                allowFullScreen
              />
            </div>
            <p className="text-sm text-muted-foreground mt-4 mb-6">
              {nextMatch.competition} · {nextMatch.venue}
            </p>

            {donationChoice === 'skipped' && (
              <div className="bg-card border border-border/60 rounded-xl p-5 flex flex-col sm:flex-row items-center gap-4">
                <div className="flex-1 text-center sm:text-left">
                  <p className="font-semibold text-sm">Liker du sendingen? 🙌</p>
                  <p className="text-muted-foreground text-xs mt-0.5">
                    Vipps gjerne til <strong>#12220</strong> (Fagerborg BKb) for å støtte klubbens direktesendinger.
                  </p>
                </div>
                <div className="flex-shrink-0 bg-muted rounded-lg px-4 py-2 text-center">
                  <p className="text-xs text-muted-foreground">Vipps</p>
                  <p className="text-xl font-bold text-primary">#12220</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </LivestreamGate>
    );
  }

  /* ── BEFORE KICKOFF ── */
  return (
    <LivestreamGate matchId={nextMatch.id} matchDate={nextMatch.match_date}>
      <div className="container mx-auto px-4 pb-16">
        {/* Countdown */}
        <div className="max-w-2xl mx-auto text-center pt-12 md:pt-20">
          <div className="inline-flex items-center gap-2 bg-destructive/10 text-destructive px-4 py-2 rounded-full mb-8">
            <Radio className="w-4 h-4 animate-pulse" />
            <span className="text-sm font-bold uppercase tracking-wider">Neste direktesending</span>
          </div>

          <h2 className="text-3xl md:text-4xl font-bold mb-2">
            Fagerborg vs {nextMatch.opponent}
          </h2>

          <div className="flex items-center justify-center gap-4 text-muted-foreground mb-10">
            <div className="flex items-center gap-1.5">
              <Calendar className="w-4 h-4" />
              <span>{formatOsloDateLong(nextMatch.match_date)}</span>
            </div>
            {!(nextMatch as any).time_tbd && (
              <div className="flex items-center gap-1.5">
                <Clock className="w-4 h-4" />
                <span>{formatOsloTime(nextMatch.match_date)}</span>
              </div>
            )}
          </div>

          <div className="grid grid-cols-4 gap-3 md:gap-6 max-w-lg mx-auto">
            {[
              { value: timeLeft.days, label: 'Dager' },
              { value: timeLeft.hours, label: 'Timer' },
              { value: timeLeft.minutes, label: 'Min' },
              { value: timeLeft.seconds, label: 'Sek' },
            ].map((unit) => (
              <div key={unit.label} className="bg-card rounded-xl p-4 md:p-6 shadow-card">
                <div className="text-3xl md:text-5xl font-bold text-primary tabular-nums">
                  {String(unit.value).padStart(2, '0')}
                </div>
                <div className="text-xs md:text-sm text-muted-foreground mt-1 uppercase tracking-wide font-medium">
                  {unit.label}
                </div>
              </div>
            ))}
          </div>

          <p className="text-sm text-muted-foreground mt-8">
            Sendingen starter automatisk ved kampstart
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Medlemsverifisering åpner 1 time før kampstart
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            {nextMatch.competition} · {nextMatch.venue}
          </p>
        </div>

        {/* Blurred pre-match preview — only if stream URL is set */}
        {livestreamUrl && (
          <BlurredPreview
            livestreamUrl={livestreamUrl}
            opponent={nextMatch.opponent}
            matchId={nextMatch.id}
            donationChoice={donationChoice}
            onDonationChoice={(choice) => {
              setDonationChoice(choice);
              trackLivestreamClick(nextMatch.id, choice);
            }}
          />
        )}
      </div>
    </LivestreamGate>
  );
};

/* ─── Page ──────────────────────────────────────────────────────────────── */
const VideoCategory = () => {
  const { category } = useParams<{ category: string }>();
  const meta = categoryLabels[category || ''];
  const isDirektesending = category === 'direktesendinger';
  const { value: showLivestream } = useSiteSetting('show_livestream');

  if (!meta) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="pt-20">
          <section className="bg-fagerborg-gradient py-8 md:py-16">
            <div className="container mx-auto px-4">
              <h1 className="text-2xl md:text-5xl font-bold text-white">Se</h1>
            </div>
          </section>
          <LatestVideos />
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Seo
        title={`${meta.title} fra Fagerborg BK | Videoer`}
        description={`${meta.description} Se alle videoer i kategorien ${meta.title} fra Fagerborg BK.`}
        path={`/videoer/${category}`}
      />
      <Header />

      <main className="pt-20">
        <section className="bg-fagerborg-gradient py-8 md:py-16">
          <div className="container mx-auto px-4">
            <h1 className="text-2xl md:text-5xl font-bold text-white mb-2 md:mb-4">{meta.title}</h1>
            <p className="text-white/80 text-sm md:text-lg">{meta.description}</p>
          </div>
        </section>

        {isDirektesending ? (
          showLivestream !== false ? (
            <LivestreamSection />
          ) : (
            <div className="container mx-auto px-4 py-16 text-center">
              <Radio className="w-16 h-16 mx-auto mb-6 text-muted-foreground opacity-50" />
              <h2 className="text-2xl font-bold mb-2">Direktesendinger er ikke tilgjengelig</h2>
              <p className="text-muted-foreground">Følg med for oppdateringer!</p>
            </div>
          )
        ) : (
          <>
            <div className="container mx-auto px-4 pt-8 md:pt-12">
              <Link
                to="/videoer"
                className="inline-flex items-center gap-2 bg-primary text-primary-foreground font-semibold px-5 py-3 rounded-full hover:opacity-90 transition-opacity"
              >
                Se alle videoer
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
            <LatestVideos category={category} limit={undefined} paginate pageSize={12} hideAllLink />
          </>
        )}
      </main>

      <Footer />
    </div>
  );
};

export default VideoCategory;
