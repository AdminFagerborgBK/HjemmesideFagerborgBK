import fagerborgLogo from '@/assets/fagerborg-logo.png';
import { useOpponentLogos, findOpponentLogo, getOpponentDisplayName } from '@/hooks/useOpponentLogos';
import { formatOsloDateLong } from '@/lib/osloTime';

export interface ThumbMatch {
  id: string;
  opponent: string;
  opponent_logo_url?: string | null;
  is_home: boolean;
  home_score: number | null;
  away_score: number | null;
  match_date: string;
  competition: string | null;
  venue: string | null;
  status: string | null;
}

/**
 * Scoreboard-style video cover, used when a video has no explicit thumbnail
 * and no YouTube URL to derive one from (e.g. protected full-match videos).
 */
const VideoMatchThumb = ({ match }: { match: ThumbMatch }) => {
  const { data: logoMap } = useOpponentLogos();
  const opponentLogo = findOpponentLogo(logoMap, match.opponent, match.opponent_logo_url ?? null);
  const opponentName = getOpponentDisplayName(logoMap, match.opponent);

  const homeName = match.is_home ? 'Fagerborg' : opponentName;
  const awayName = match.is_home ? opponentName : 'Fagerborg';
  const homeLogo = match.is_home ? fagerborgLogo : opponentLogo;
  const awayLogo = match.is_home ? opponentLogo : fagerborgLogo;

  const hasScore =
    match.status === 'finished' && match.home_score !== null && match.away_score !== null;

  const Crest = ({ src, name }: { src: string | null | undefined; name: string }) =>
    src ? (
      <img src={src} alt={name} className="w-10 h-10 md:w-14 md:h-14 object-contain" />
    ) : (
      <div className="w-10 h-10 md:w-14 md:h-14 rounded-full bg-muted flex items-center justify-center text-sm font-bold text-muted-foreground">
        {name.charAt(0)}
      </div>
    );

  return (
    <div className="w-full h-full bg-muted flex flex-col items-center justify-center px-3 py-4 text-center">
      <p className="text-[10px] md:text-xs font-bold uppercase tracking-wide text-foreground">
        {formatOsloDateLong(match.match_date)}
      </p>
      {match.competition && (
        <p className="text-[9px] md:text-[11px] uppercase tracking-[0.18em] text-muted-foreground mb-2">
          {match.competition}
        </p>
      )}

      <div className="flex items-center justify-center gap-3 md:gap-5 w-full">
        <div className="flex flex-col items-center gap-1 flex-1 min-w-0">
          <Crest src={homeLogo} name={homeName} />
          <span className="text-[10px] md:text-xs font-semibold truncate max-w-full">{homeName}</span>
        </div>

        <div className="px-3 md:px-4 py-1.5 md:py-2 rounded-lg bg-secondary text-secondary-foreground font-bold text-base md:text-xl">
          {hasScore ? `${match.home_score} - ${match.away_score}` : 'Full kamp'}
        </div>

        <div className="flex flex-col items-center gap-1 flex-1 min-w-0">
          <Crest src={awayLogo} name={awayName} />
          <span className="text-[10px] md:text-xs font-semibold truncate max-w-full">{awayName}</span>
        </div>
      </div>

      {match.venue && (
        <p className="mt-2 text-[9px] md:text-[11px] uppercase tracking-[0.14em] text-muted-foreground truncate max-w-full">
          {match.venue}
        </p>
      )}
    </div>
  );
};

export default VideoMatchThumb;
