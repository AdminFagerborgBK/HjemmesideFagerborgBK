import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { useSportsSeason, teamConfig } from '@/hooks/useSportsSeason';
import { useStandings } from '@/hooks/useStandings';
import { Skeleton } from '@/components/ui/skeleton';
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/components/ui/hover-card';

/** Parse form string like "W:3-1:Opponent:URL" into parts */
const parseFormEntry = (entry: string) => {
  const parts = entry.split(':');
  if (parts.length >= 4) {
    const url = parts.slice(3).join(':');
    return { result: parts[0], score: parts[1], opponent: parts[2], url: url || null };
  }
  if (parts.length === 3) {
    return { result: parts[0], score: parts[1], opponent: parts[2], url: null };
  }
  return { result: entry, score: null, opponent: null, url: null };
};

const FormIndicator = ({ result }: { result: string }) => {
  const parsed = parseFormEntry(result);
  const [open, setOpen] = useState(false);
  const [detailsShown, setDetailsShown] = useState(false);

  const getColor = () => {
    switch (parsed.result) {
      case 'W': return 'bg-green-500';
      case 'D': return 'bg-gray-400';
      case 'L': return 'bg-red-500';
      default: return 'bg-muted';
    }
  };

  const label = parsed.result === 'W' ? 'Seier' : parsed.result === 'D' ? 'Uavgjort' : parsed.result === 'L' ? 'Tap' : '';
  const hasDetails = parsed.score && parsed.opponent;
  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    // Detect touch / coarse pointer devices that cannot hover
    const isTouch =
      typeof window !== 'undefined' &&
      window.matchMedia &&
      window.matchMedia('(hover: none)').matches;

    if (isTouch && hasDetails && !detailsShown) {
      // First tap: just reveal the details
      e.preventDefault();
      setDetailsShown(true);
      setOpen(true);
      return;
    }
    // Desktop click, or second tap on touch: open the link
    if (parsed.url) window.open(parsed.url, '_blank', 'noopener,noreferrer');
    setOpen(false);
    setDetailsShown(false);
  };

  return (
    <HoverCard
      openDelay={100}
      closeDelay={50}
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) setDetailsShown(false);
      }}
    >
      <HoverCardTrigger asChild>
        <button
          type="button"
          onClick={handleClick}
          className={`inline-block w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-full ${getColor()} ${parsed.url ? 'cursor-pointer' : 'cursor-default'} hover:ring-2 hover:ring-primary/30 transition-shadow focus:outline-none focus:ring-2 focus:ring-primary/40`}
          aria-label={hasDetails ? `${parsed.score} vs ${parsed.opponent}` : label}
        />
      </HoverCardTrigger>
      <HoverCardContent side="top" className="text-xs px-3 py-1.5 w-auto max-w-[220px]" align="center">
        {hasDetails ? (
          <div>
            <div>{parsed.score} vs {parsed.opponent}</div>
            {parsed.url && <div className="text-muted-foreground mt-0.5">Klikk for detaljer →</div>}
          </div>
        ) : (
          <span>{label}</span>
        )}
      </HoverCardContent>
    </HoverCard>
  );
};

const LeagueTable = () => {
  const [selectedTeam, setSelectedTeam] = useState<'A-laget' | 'B-laget'>('A-laget');
  const { data: standings, isLoading } = useStandings(selectedTeam);

  const {data:config}=useSportsSeason();
  const team=config?teamConfig(config,selectedTeam):undefined;
  const leagueName=team?.league;
  const fiksId=team?.tournament_id;
  const teamHighlight=team?.club_name;

  return (
    <section className="py-12 bg-gradient-to-b from-muted/30 to-background">
      <div className="container mx-auto px-4">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h2 className="text-2xl font-bold">Tabell</h2>
            <a 
              href={`https://www.fotball.no/fotballdata/turnering/hjem/?fiksId=${fiksId}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-muted-foreground text-sm hover:text-primary transition-colors underline"
            >
              {leagueName}
            </a>
          </div>
          <Link 
            to="/tabell" 
            className="text-primary hover:text-primary/80 text-sm font-medium flex items-center gap-1 transition-colors"
          >
            Se full tabell <ChevronRight className="w-4 h-4" />
          </Link>
        </div>

      <>
        {/* Team selector */}
        <div className="flex gap-2 mb-6">
          {(['A-laget', 'B-laget'] as const).map((team) => (
            <button
              key={team}
              onClick={() => setSelectedTeam(team)}
              className={`px-4 py-2 text-sm font-medium rounded-lg transition-all ${
                selectedTeam === team
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted hover:bg-muted/80 text-muted-foreground'
              }`}
            >
              {team}
            </button>
          ))}
        </div>

        <div className="bg-card rounded-xl shadow-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/50">
                  <th className="px-2 py-3 text-left font-semibold text-muted-foreground w-8">#</th>
                  <th className="px-2 py-3 text-left font-semibold text-muted-foreground">Lag</th>
                  <th className="px-2 py-3 text-center font-semibold text-muted-foreground w-8">S</th>
                  <th className="px-2 py-3 text-center font-semibold text-muted-foreground w-8 hidden sm:table-cell">V</th>
                  <th className="px-2 py-3 text-center font-semibold text-muted-foreground w-8 hidden sm:table-cell">U</th>
                  <th className="px-2 py-3 text-center font-semibold text-muted-foreground w-8 hidden sm:table-cell">T</th>
                  <th className="px-2 py-3 text-center font-semibold text-muted-foreground w-10">MF</th>
                  <th className="px-2 py-3 text-center font-semibold text-muted-foreground w-8">P</th>
                  <th className="px-2 py-3 text-center font-semibold text-muted-foreground w-16">Form</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i} className="border-b border-border/50">
                      <td className="px-2 py-3"><Skeleton className="h-4 w-4" /></td>
                      <td className="px-2 py-3"><Skeleton className="h-4 w-24" /></td>
                      <td className="px-2 py-3"><Skeleton className="h-4 w-4 mx-auto" /></td>
                      <td className="px-2 py-3 hidden sm:table-cell"><Skeleton className="h-4 w-4 mx-auto" /></td>
                      <td className="px-2 py-3 hidden sm:table-cell"><Skeleton className="h-4 w-4 mx-auto" /></td>
                      <td className="px-2 py-3 hidden sm:table-cell"><Skeleton className="h-4 w-4 mx-auto" /></td>
                      <td className="px-2 py-3 hidden md:table-cell"><Skeleton className="h-4 w-6 mx-auto" /></td>
                      <td className="px-2 py-3"><Skeleton className="h-4 w-4 mx-auto" /></td>
                      <td className="px-2 py-3"><Skeleton className="h-3 w-16 mx-auto" /></td>
                    </tr>
                  ))
                ) : standings?.map((team, index) => (
                  <tr 
                    key={team.id} 
                    className={`border-b border-border/50 transition-colors hover:bg-muted/30 ${
                      team.team_name === teamHighlight ? 'bg-primary/5 hover:bg-primary/10' : ''
                    }`}
                  >
                    <td className="px-2 py-3 font-medium">{index + 1}</td>
                    <td className={`px-2 py-3 font-medium max-w-0 ${team.team_name === teamHighlight ? 'text-primary' : ''}`}>
                      <a 
                        href={team.team_url || '#'} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 hover:underline min-w-0"
                        onClick={(e) => !team.team_url && e.preventDefault()}
                      >
                        {team.logo_url && (
                          <img 
                            src={team.logo_url} 
                            alt={`${team.team_name} logo`} 
                            className="w-5 h-5 object-contain flex-shrink-0"
                          />
                        )}
                        <span className="truncate min-w-0">{team.team_name}</span>
                      </a>
                    </td>
                    <td className="px-2 py-3 text-center text-muted-foreground">{team.played}</td>
                    <td className="px-2 py-3 text-center text-muted-foreground hidden sm:table-cell">{team.won}</td>
                    <td className="px-2 py-3 text-center text-muted-foreground hidden sm:table-cell">{team.drawn}</td>
                    <td className="px-2 py-3 text-center text-muted-foreground hidden sm:table-cell">{team.lost}</td>
                    <td className="px-2 py-3 text-center text-muted-foreground">{team.goal_difference > 0 ? `+${team.goal_difference}` : team.goal_difference}</td>
                    <td className="px-2 py-3 text-center font-bold">{team.points}</td>
                    <td className="px-1 sm:px-2 py-3">
                      <div className="flex gap-0.5 sm:gap-1 justify-center">
                        {team.form && team.form.length > 0 ? (
                          team.form.slice(-5).map((result, i) => (
                            <FormIndicator key={i} result={result} />
                          ))
                        ) : (
                          Array.from({ length: 5 }).map((_, i) => (
                            <span key={i} className="inline-block w-2 h-2 rounded-full bg-muted" />
                          ))
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </>
      </div>
    </section>
  );
};

export default LeagueTable;
