import { useState, useEffect, useMemo, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Calendar, MapPin, Trophy, ExternalLink, Play, Film, Video } from 'lucide-react';
import Header from '@/components/Header';
import Seo from '@/components/Seo';
import Footer from '@/components/Footer';
import { useMatches } from '@/hooks/useMatches';
import { useSportsSeason } from '@/hooks/useSportsSeason';
import { useSportsSeasons } from '@/hooks/useSportsSeasons';
import { availableYears, osloYear } from '@/lib/seasonYears';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useOpponentLogos, findOpponentLogo, getOpponentDisplayName } from '@/hooks/useOpponentLogos';
import { useSiteVideos } from '@/hooks/useSiteVideos';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { isEmbeddableVideo, isDirectVideoFile, getVideoEmbedUrl } from '@/lib/videoUrl';
import fagerborgLogo from '@/assets/fagerborg-logo.png';
import { formatOsloDateLong, formatOsloDateShort, formatOsloTime } from '@/lib/osloTime';

type TeamTab = 'A-laget' | 'B-laget';
type StatusTab = 'all' | 'upcoming' | 'finished';

const getMatchUrl = (fiksId: string | null) => {
  if (!fiksId) return null;
  return `https://www.fotball.no/fotballdata/kamp/?fiksId=${fiksId}`;
};

const Matches = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [playingUrl, setPlayingUrl] = useState<string | null>(null);
  const initialTeam = (searchParams.get('lag') as TeamTab) || 'A-laget';
  const [activeTeam, setActiveTeam] = useState<TeamTab>(initialTeam);

  useEffect(() => {
    const lag = searchParams.get('lag') as TeamTab;
    if (lag === 'A-laget' || lag === 'B-laget') {
      setActiveTeam(lag);
    }
  }, [searchParams]);
  const highlightParam = searchParams.get('highlight');
  const filterParam = searchParams.get('filter') as StatusTab | null;
  const [activeStatus, setActiveStatus] = useState<StatusTab>(
    filterParam === 'finished' ? 'finished' : filterParam === 'all' ? 'all' : 'upcoming'
  );
  const [highlightedMatchId, setHighlightedMatchId] = useState<string | null>(null);
  const hasScrolledRef = useRef(false);
  const { data: allMatches, isLoading } = useMatches(activeTeam);
  const { data: activeSeason } = useSportsSeason();
  const { data: seasons } = useSportsSeasons();
  const [pickedYear, setPickedYear] = useState<number | null>(null);
  const selectedYear = pickedYear ?? activeSeason?.season;
  const years = useMemo(
    () => availableYears(seasons ?? [], activeSeason?.season, (allMatches ?? []).map(m => m.match_date)),
    [seasons, activeSeason, allMatches]
  );
  const { data: logoMap } = useOpponentLogos();
  const { data: allVideos } = useSiteVideos();
  const matchRefs = useRef<Record<string, HTMLDivElement | null>>({});

  // Map match_id -> videos grouped by category
  const matchVideos = useMemo(() => {
    type V = { id: string; video_url: string | null; is_protected: boolean };
    const map: Record<string, { highlights?: V, full_match?: V, match_day?: V }> = {};
    if (!allVideos) return map;
    for (const v of allVideos) {
      if (!v.match_id) continue;
      if (!map[v.match_id]) map[v.match_id] = {};
      const entry: V = { id: v.id, video_url: v.video_url, is_protected: v.is_protected };
      if (v.category === 'highlights') map[v.match_id].highlights = entry;
      if (v.category === 'full_match') map[v.match_id].full_match = entry;
      if (v.category === 'match_day') map[v.match_id].match_day = entry;
    }
    return map;
  }, [allVideos]);

  const openVideo = (video: { id: string; video_url: string | null; is_protected: boolean }) => {
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

    // Protected videos need the unlock flow on the video page
    if (video.is_protected || !video.video_url) {
      navigate(`/videoer?v=${video.id}`);
      return;
    }
    if (!isEmbeddableVideo(video.video_url)) {
      window.open(video.video_url, '_blank', 'noopener');
      return;
    }
    setPlayingUrl(video.video_url);
  };

  const filteredMatches = useMemo(() => {
    const filtered = allMatches?.filter(match => {
      if (selectedYear !== undefined && osloYear(match.match_date) !== selectedYear) return false;
      if (activeStatus === 'upcoming') return match.status === 'upcoming' && !(match as any).is_cancelled;
      if (activeStatus === 'finished') return match.status === 'finished';
      return true; // 'all'
    });
    // Show newest results first when viewing finished matches
    if (activeStatus === 'finished' && filtered) {
      return [...filtered].sort((a, b) => new Date(b.match_date).getTime() - new Date(a.match_date).getTime());
    }
    return filtered;
  }, [allMatches, activeStatus, selectedYear]);

  // Scroll to and highlight a specific match (from URL param or last finished) — only once
  useEffect(() => {
    if (!filteredMatches || filteredMatches.length === 0) return;
    if (hasScrolledRef.current) return;
    
    let targetId: string | null = null;
    
    if (highlightParam && filteredMatches.some(m => m.id === highlightParam)) {
      targetId = highlightParam;
    }
    
    if (targetId) {
      hasScrolledRef.current = true;
      setHighlightedMatchId(targetId);
      setTimeout(() => {
        matchRefs.current[targetId!]?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        setTimeout(() => setHighlightedMatchId(null), 1000);
      }, 200);
    }
  }, [filteredMatches, highlightParam]);

  const formatMatchDate = (dateStr: string) => {
    return formatOsloDateLong(dateStr);
  };

  const formatTime = (dateStr: string) => {
    return formatOsloTime(dateStr);
  };

  const getOpponentLogo = (match: any) => {
    return findOpponentLogo(logoMap, match.opponent, (match as any).opponent_logo_url);
  };

  const getOpponentName = (opponent: string) => getOpponentDisplayName(logoMap, opponent);

  return (
    <div className="min-h-screen bg-background">
      <Seo
        title="Kamper og kampprogram | Fagerborg BK"
        description="Se kampprogram, resultater og terminliste for A-laget og B-laget til Fagerborg BK."
        path="/kamper"
      />
      <Header />
      
      <main className="pt-20">
        {/* Hero Section */}
        <section className="bg-fagerborg-gradient py-8 md:py-16">
          <div className="container mx-auto px-4">
            <h1 className="text-2xl md:text-5xl font-bold text-white mb-2 md:mb-4">Kamper</h1>
            <p className="text-white/80 text-sm md:text-lg">
              Følg med på alle kampene til Fagerborg BK
            </p>
          </div>
        </section>

        {/* Filters */}
        <section className="py-4 md:py-8 bg-card border-b border-border">
          <div className="container mx-auto px-4">
            <h2 className="sr-only">Filtrer kamper</h2>
            <div className="flex flex-col gap-3 md:flex-row md:gap-4 md:items-center md:justify-between">
              {/* Team Tabs */}
              <div className="flex gap-2">
                {(['A-laget', 'B-laget'] as TeamTab[]).map((team) => (
                  <button
                    key={team}
                    onClick={() => setActiveTeam(team)}
                    className={`px-4 md:px-6 py-2 rounded-full font-semibold text-xs md:text-sm transition-all ${
                      activeTeam === team
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted text-muted-foreground hover:bg-muted/80'
                    }`}
                  >
                    {team}
                  </button>
                ))}
              </div>

              {/* Year + Status */}
              <div className="flex flex-wrap items-center gap-2">
                <Select value={selectedYear !== undefined ? String(selectedYear) : undefined} onValueChange={v => setPickedYear(Number(v))}>
                  <SelectTrigger className="h-9 w-24 text-xs md:text-sm" aria-label="Velg år">
                    <SelectValue placeholder="År" />
                  </SelectTrigger>
                  <SelectContent>
                    {years.map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
                  </SelectContent>
                </Select>
                {[
                  { key: 'all', label: 'Alle' },
                  { key: 'upcoming', label: 'Kommende' },
                  { key: 'finished', label: 'Resultater' },
                ].map((status) => (
                  <button
                    key={status.key}
                    onClick={() => setActiveStatus(status.key as StatusTab)}
                    className={`px-3 md:px-4 py-2 rounded-lg text-xs md:text-sm font-medium transition-colors ${
                      activeStatus === status.key
                        ? 'bg-secondary text-secondary-foreground'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    {status.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Matches List */}
        <section className="py-6 md:py-12">
          <div className="container mx-auto px-4">
            {isLoading ? (
              <div className="text-center py-12 text-muted-foreground">Laster kamper...</div>
            ) : !filteredMatches || filteredMatches.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                Ingen kamper funnet
              </div>
            ) : (
              <div className="space-y-3 md:space-y-4 max-w-4xl mx-auto">
                {filteredMatches.map((match, index) => {
                  const opponentLogo = getOpponentLogo(match);
                  const venueMapsUrl = (match as any).venue_maps_url;
                  const finishedMatches = filteredMatches.filter(m => m.status === 'finished');
                  const lastFinishedMatch = finishedMatches[finishedMatches.length - 1];
                  const isLastFinishedMatch = lastFinishedMatch?.id === match.id;
                  const isHighlighted = highlightedMatchId === match.id;
                  return (
                    <div
                      key={match.id}
                      ref={(el) => { matchRefs.current[match.id] = el; }}
                      className={`bg-card rounded-xl p-4 md:p-6 shadow-card hover:shadow-elevated transition-all duration-300 ${
                        isHighlighted ? 'ring-2 ring-primary bg-primary/5' : ''
                      }`}
                    >
                      {/* Date and Competition - Mobile Layout */}
                      <div className="flex flex-wrap items-center gap-2 md:gap-4 mb-3 md:mb-4 text-xs md:text-sm">
                        <div className="flex items-center gap-1.5 text-muted-foreground">
                          <Calendar className="w-3.5 h-3.5 md:w-4 md:h-4" />
                          <span className="hidden sm:inline">{formatMatchDate(match.match_date)}</span>
                          <span className="sm:hidden">{formatOsloDateShort(match.match_date)}</span>
                          {!(match as any).time_tbd && <span className="font-medium">{formatTime(match.match_date)}</span>}
                          {(match as any).time_tbd && <span className="font-medium italic">Tid kommer</span>}
                        </div>
                        <div className="flex items-center gap-1.5 text-muted-foreground">
                          <Trophy className="w-3.5 h-3.5 md:w-4 md:h-4" />
                          <span className="truncate max-w-[80px] sm:max-w-none">{match.competition}</span>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-1.5 text-muted-foreground text-xs md:text-sm mb-3 md:mb-4">
                        <MapPin className="w-3.5 h-3.5 md:w-4 md:h-4 flex-shrink-0" />
                        {(match as any).venue_tbd ? (
                          <span className="truncate italic">Sted kommer</span>
                        ) : venueMapsUrl ? (
                          <a 
                            href={venueMapsUrl} 
                            target="_blank" 
                            rel="noopener noreferrer" 
                            className="truncate hover:text-primary transition-colors underline underline-offset-2"
                          >
                            {match.venue}
                          </a>
                        ) : (
                          <span className="truncate">{match.venue}</span>
                        )}
                      </div>

                      {/* Match Row - Responsive */}
                      <div className="flex items-center justify-between gap-2">
                        {/* Home Team */}
                        <div className="flex items-center gap-2 md:gap-4 flex-1 min-w-0">
                          {match.is_home ? (
                            <img
                              src={fagerborgLogo}
                              alt="Fagerborg BK"
                              className="w-8 h-8 md:w-12 md:h-12 object-contain flex-shrink-0"
                            />
                          ) : opponentLogo ? (
                            <img
                              src={opponentLogo}
                              alt={match.opponent}
                              className="w-8 h-8 md:w-12 md:h-12 object-contain flex-shrink-0"
                            />
                          ) : (
                            <div className="w-8 h-8 md:w-12 md:h-12 bg-muted rounded-full flex items-center justify-center flex-shrink-0">
                              <span className="text-sm md:text-lg font-bold text-muted-foreground">
                                {match.opponent.charAt(0)}
                              </span>
                            </div>
                          )}
                          <span className="font-semibold text-xs sm:text-sm md:text-lg truncate">
                            {match.is_home ? 'Fagerborg' : getOpponentName(match.opponent)}
                          </span>
                        </div>

                        {/* Score */}
                        <div className="px-3 md:px-6 py-2 md:py-3 bg-muted rounded-lg text-center min-w-[60px] md:min-w-[100px] flex-shrink-0">
                        {(match as any).is_cancelled ? (
                            <span className="text-sm md:text-lg font-bold text-orange-500">Avlyst</span>
                          ) : match.status === 'finished' ? (
                            <span className="text-sm md:text-lg font-bold">
                              {match.home_score} - {match.away_score}
                            </span>
                          ) : match.status === 'live' ? (
                            <span className="text-sm md:text-lg font-bold text-destructive animate-pulse">LIVE</span>
                          ) : (
                            <span className="text-sm md:text-lg font-bold text-primary">
                              {(match as any).time_tbd ? 'TBD' : formatTime(match.match_date)}
                            </span>
                          )}
                        </div>

                        {/* Away Team */}
                        <div className="flex items-center gap-2 md:gap-4 flex-1 justify-end min-w-0">
                          <span className="font-semibold text-xs sm:text-sm md:text-lg truncate text-right">
                            {!match.is_home ? 'Fagerborg' : getOpponentName(match.opponent)}
                          </span>
                          {!match.is_home ? (
                            <img
                              src={fagerborgLogo}
                              alt="Fagerborg BK"
                              className="w-8 h-8 md:w-12 md:h-12 object-contain flex-shrink-0"
                            />
                          ) : opponentLogo ? (
                            <img
                              src={opponentLogo}
                              alt={match.opponent}
                              className="w-8 h-8 md:w-12 md:h-12 object-contain flex-shrink-0"
                            />
                          ) : (
                            <div className="w-8 h-8 md:w-12 md:h-12 bg-muted rounded-full flex items-center justify-center flex-shrink-0">
                              <span className="text-sm md:text-lg font-bold text-muted-foreground">
                                {match.opponent.charAt(0)}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Links row */}
                      {(match.fiks_id || matchVideos[match.id]) && (
                        <div className="mt-4 pt-3 border-t border-border flex flex-wrap gap-x-5 gap-y-2">
                          {matchVideos[match.id]?.highlights && (
                            <button
                              type="button"
                              onClick={() => openVideo(matchVideos[match.id].highlights!)}
                              className="inline-flex items-center gap-1.5 text-sm text-primary hover:text-primary/80 transition-colors font-medium"
                            >
                              <Play className="w-3.5 h-3.5" />
                              Høydepunkter
                            </button>
                          )}
                          {matchVideos[match.id]?.match_day && (
                            <button
                              type="button"
                              onClick={() => openVideo(matchVideos[match.id].match_day!)}
                              className="inline-flex items-center gap-1.5 text-sm text-primary hover:text-primary/80 transition-colors font-medium"
                            >
                              <Video className="w-3.5 h-3.5" />
                              Match Day
                            </button>
                          )}
                          {matchVideos[match.id]?.full_match && (
                            <button
                              type="button"
                              onClick={() => openVideo(matchVideos[match.id].full_match!)}
                              className="inline-flex items-center gap-1.5 text-sm text-primary hover:text-primary/80 transition-colors font-medium"
                            >
                              <Film className="w-3.5 h-3.5" />
                              Full kamp
                            </button>
                          )}
                          {match.fiks_id && (
                            <a
                              href={getMatchUrl(match.fiks_id) || '#'}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-primary transition-colors"
                            >
                              Kampinfo
                              <ExternalLink className="w-3.5 h-3.5" />
                            </a>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </section>
      </main>

      <Dialog open={!!playingUrl} onOpenChange={(open) => !open && setPlayingUrl(null)}>
        <DialogContent className="max-w-4xl p-0 overflow-hidden">
          <div className="aspect-video">
            {playingUrl && (
              isDirectVideoFile(playingUrl) ? (
                <video src={playingUrl} className="w-full h-full bg-black" controls autoPlay playsInline />
              ) : (
                <iframe
                  src={getVideoEmbedUrl(playingUrl)}
                  className="w-full h-full"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              )
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Footer />
    </div>
  );
};

export default Matches;
