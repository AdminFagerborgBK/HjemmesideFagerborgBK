import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Radio } from 'lucide-react';
import { useMatches } from '@/hooks/useMatches';
import { useOpponentLogos, findOpponentLogo, getOpponentDisplayName } from '@/hooks/useOpponentLogos';
import { useSiteSetting } from '@/hooks/useSiteSettings';
import fagerborgLogo from '@/assets/fagerborg-logo.png';
import { formatOsloDateUpper, formatOsloTime } from '@/lib/osloTime';

type TeamTab = 'A-laget' | 'B-laget';

const isMatchLive = (matchDate: string) => {
  const now = Date.now();
  const start = new Date(matchDate).getTime();
  return now >= start && now <= start + 2 * 60 * 60 * 1000;
};

const isMatchPendingResult = (matchDate: string) => {
  const now = Date.now();
  return now > new Date(matchDate).getTime() + 2 * 60 * 60 * 1000;
};

const MatchCenter = () => {
  const [activeTab, setActiveTab] = useState<TeamTab>('A-laget');
  const { data: matches, isLoading } = useMatches(activeTab);
  const { data: logoMap } = useOpponentLogos();
  const { value: showLivestream } = useSiteSetting('show_livestream');

  const formatMatchDate = (dateStr: string) => {
    return formatOsloDateUpper(dateStr);
  };

  const formatTime = (dateStr: string) => {
    return formatOsloTime(dateStr);
  };

  // Get last played match and next upcoming match
  const { lastMatch, nextMatch } = useMemo(() => {
    if (!matches || matches.length === 0) return { lastMatch: null, nextMatch: null };
    
    const nonCancelled = matches.filter(m => !(m as any).is_cancelled);
    const finished = nonCancelled.filter(m => m.status === 'finished').sort((a, b) => 
      new Date(b.match_date).getTime() - new Date(a.match_date).getTime()
    );
    const upcoming = nonCancelled.filter(m => m.status === 'upcoming').sort((a, b) => 
      new Date(a.match_date).getTime() - new Date(b.match_date).getTime()
    );
    
    return {
      lastMatch: finished[0] || null,
      nextMatch: upcoming[0] || null
    };
  }, [matches]);

  const displayMatches = [lastMatch, nextMatch].filter(Boolean);

  return (
    <section className="py-8 md:py-16 bg-fagerborg-gradient" id="kamper">
      {/* Tabs */}
      <div className="container mx-auto px-4 mb-6 md:mb-10">
        <div className="flex justify-center">
          <div className="inline-flex bg-white/10 rounded-full p-1">
            {(['A-laget', 'B-laget'] as TeamTab[]).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-4 sm:px-8 py-2 sm:py-2.5 rounded-full font-semibold text-xs sm:text-sm transition-all ${
                  activeTab === tab
                    ? 'bg-white text-primary'
                    : 'text-white/80 hover:text-white'
                }`}
              >
                {tab.toUpperCase()}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Matches Grid */}
      <div className="container mx-auto px-4">
        {isLoading ? (
          <div className="text-center text-white py-8">Laster kamper...</div>
        ) : displayMatches.length === 0 ? (
          <div className="text-center text-white/70 py-8">Ingen kamper funnet</div>
        ) : (
          <div className="grid md:grid-cols-2 gap-4 md:gap-6 max-w-4xl mx-auto">
            {displayMatches.map((match) => match && (
              <div
                key={match.id}
                className="bg-white rounded-xl md:rounded-2xl p-4 sm:p-6 md:p-8 shadow-elevated"
              >
                {/* Date and Competition */}
                <div className="text-center mb-4 md:mb-8">
                  <p className="text-xs sm:text-sm md:text-base font-bold text-foreground">{formatMatchDate(match.match_date)}</p>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide mt-1">
                    {match.competition}
                  </p>
                </div>

                {/* Row 1: Logos + Score/Time */}
                <div className="flex items-center justify-center gap-2 sm:gap-4 md:gap-6 mb-2">
                  {/* Home Logo */}
                  <div className="flex justify-center flex-1">
                    {match.is_home ? (
                      <img src={fagerborgLogo} alt="Fagerborg BK" className="w-10 h-10 sm:w-14 sm:h-14 md:w-20 md:h-20 object-contain" />
                    ) : (() => {
                      const opponentLogo = findOpponentLogo(logoMap, match.opponent, (match as any).opponent_logo_url);
                      return opponentLogo ? (
                        <img src={opponentLogo} alt={match.opponent} className="w-10 h-10 sm:w-14 sm:h-14 md:w-20 md:h-20 object-contain" />
                      ) : (
                        <div className="w-10 h-10 sm:w-14 sm:h-14 md:w-20 md:h-20 bg-muted rounded-full flex items-center justify-center">
                          <span className="text-sm sm:text-lg md:text-xl font-bold text-muted-foreground">{match.opponent.charAt(0)}</span>
                        </div>
                      );
                    })()}
                  </div>

                  {/* Score or Time */}
                  <div className="px-2 sm:px-4 md:px-6 py-2 md:py-3 bg-muted rounded-lg md:rounded-xl min-w-[60px] sm:min-w-[80px] md:min-w-[100px] text-center flex-shrink-0">
                    {match.status === 'finished' ? (
                      <span className="text-lg sm:text-2xl md:text-3xl font-bold">{match.home_score} - {match.away_score}</span>
                    ) : isMatchLive(match.match_date) ? (
                      <span className="text-xs sm:text-sm font-bold text-destructive uppercase tracking-wide">Spilles nå</span>
                    ) : isMatchPendingResult(match.match_date) ? (
                      <span className="text-xs font-medium text-muted-foreground">Avventer resultat</span>
                    ) : (
                      <span className="text-lg sm:text-2xl md:text-3xl font-bold">
                        {(match as any).time_tbd ? 'TBD' : formatTime(match.match_date)}
                      </span>
                    )}
                  </div>

                  {/* Away Logo */}
                  <div className="flex justify-center flex-1">
                    {!match.is_home ? (
                      <img src={fagerborgLogo} alt="Fagerborg BK" className="w-10 h-10 sm:w-14 sm:h-14 md:w-20 md:h-20 object-contain" />
                    ) : (() => {
                      const opponentLogo = findOpponentLogo(logoMap, match.opponent, (match as any).opponent_logo_url);
                      return opponentLogo ? (
                        <img src={opponentLogo} alt={match.opponent} className="w-10 h-10 sm:w-14 sm:h-14 md:w-20 md:h-20 object-contain" />
                      ) : (
                        <div className="w-10 h-10 sm:w-14 sm:h-14 md:w-20 md:h-20 bg-muted rounded-full flex items-center justify-center">
                          <span className="text-sm sm:text-lg md:text-xl font-bold text-muted-foreground">{match.opponent.charAt(0)}</span>
                        </div>
                      );
                    })()}
                  </div>
                </div>

                {/* Row 2: Team Names + Se live in center */}
                <div className="flex items-center justify-center gap-2 sm:gap-4 md:gap-6 mb-4 md:mb-6">
                  <div className="flex-1 text-center">
                     <span className="text-xs sm:text-sm font-semibold truncate block">
                       {match.is_home ? 'Fagerborg' : getOpponentDisplayName(logoMap, match.opponent)}
                     </span>
                  </div>
                   <div className="min-w-[60px] sm:min-w-[80px] md:min-w-[100px] flex justify-center flex-shrink-0">
                    {match.status === 'upcoming' && match.id === nextMatch?.id && !isMatchPendingResult(match.match_date) && showLivestream && activeTab === 'A-laget' && (
                      <Link
                        to="/videoer/direktesendinger"
                        className="inline-flex items-center gap-1 bg-destructive/10 text-destructive px-2 py-0.5 rounded-full text-xs font-semibold hover:bg-destructive/20 transition-colors"
                      >
                        <Radio className="w-2.5 h-2.5 animate-pulse" />
                        Se live
                      </Link>
                    )}
                  </div>
                  <div className="flex-1 text-center">
                     <span className="text-xs sm:text-sm font-semibold truncate block">
                       {!match.is_home ? 'Fagerborg' : getOpponentDisplayName(logoMap, match.opponent)}
                     </span>
                  </div>
                </div>

                {/* Venue */}
                <p className="text-center text-xs text-muted-foreground uppercase tracking-wide mb-4 md:mb-6">
                  {(match as any).venue_maps_url ? (
                    <a
                      href={(match as any).venue_maps_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="hover:text-primary transition-colors underline underline-offset-2"
                    >
                      {match.venue}
                    </a>
                  ) : (
                    match.venue
                  )}
                </p>

                {/* Match Centre Button */}
                <Link 
                  to={`/kamper?highlight=${match.id}${activeTab === 'B-laget' ? '&lag=B-laget' : ''}${match.status === 'finished' ? '&filter=finished' : ''}`}
                  className="w-full py-2.5 md:py-3.5 bg-primary text-primary-foreground font-semibold rounded-lg md:rounded-xl flex items-center justify-center gap-2 hover:bg-primary/90 transition-colors text-sm md:text-base"
                  onClick={() => window.scrollTo(0, 0)}
                >
                  Kampinfo
                  <ArrowRight className="w-3.5 h-3.5 md:w-4 md:h-4" />
                </Link>
              </div>
            ))}
          </div>
        )}

        {/* View All Link */}
        <div className="text-center mt-6 md:mt-10">
          <Link 
            to={activeTab === 'B-laget' ? '/kamper?lag=B-laget' : '/kamper'}
            className="inline-flex items-center gap-2 text-white hover:text-secondary font-semibold transition-colors text-sm md:text-base"
          >
            Se alle kamper
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    </section>
  );
};

export default MatchCenter;