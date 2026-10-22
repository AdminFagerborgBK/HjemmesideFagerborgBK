import { useMemo, useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import Header from '@/components/Header';
import Seo from '@/components/Seo';
import Footer from '@/components/Footer';
import { useSportsSeason, teamConfig } from '@/hooks/useSportsSeason';
import { useStandings } from '@/hooks/useStandings';
import { useDivisionMatches, type DivisionMatch } from '@/hooks/useDivisionMatches';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/components/ui/hover-card';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

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
      case 'D': return 'bg-amber-500';
      case 'L': return 'bg-red-500';
      default: return 'bg-muted';
    }
  };

  const label = parsed.result === 'W' ? 'Seier' : parsed.result === 'D' ? 'Uavgjort' : parsed.result === 'L' ? 'Tap' : '';
  const hasDetails = parsed.score && parsed.opponent;
  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    const isTouch =
      typeof window !== 'undefined' &&
      window.matchMedia &&
      window.matchMedia('(hover: none)').matches;

    if (isTouch && hasDetails && !detailsShown) {
      e.preventDefault();
      setDetailsShown(true);
      setOpen(true);
      return;
    }
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
          className={`standings-form-dot inline-block shrink-0 w-2.5 h-2.5 md:w-3 md:h-3 rounded-full ${getColor()} ${parsed.url ? 'cursor-pointer' : 'cursor-default'} hover:ring-2 hover:ring-primary/30 transition-shadow focus:outline-none focus:ring-2 focus:ring-primary/40`}
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

/** View mode for the table */
type ViewMode =
  | { kind: 'current' }
  | { kind: 'round'; round: number } // 0 = latest finished round
  | { kind: 'lastN'; n: number }
  | { kind: 'venue'; venue: 'home' | 'away' };

interface ComputedRow {
  team: string;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goals_for: number;
  goals_against: number;
  goal_difference: number;
  points: number;
  logo_url: string | null;
  team_url: string | null;
  form?: string[];
}

/** Build a standings table from a list of completed matches. */
const buildTable = (
  matches: DivisionMatch[],
  meta: Map<string, { logo_url: string | null; team_url: string | null }>
): ComputedRow[] => {
  const map = new Map<string, ComputedRow>();
  const ensure = (team: string): ComputedRow => {
    let r = map.get(team);
    if (!r) {
      const m = meta.get(team);
      r = {
        team,
        played: 0, won: 0, drawn: 0, lost: 0,
        goals_for: 0, goals_against: 0, goal_difference: 0, points: 0,
        logo_url: m?.logo_url ?? null,
        team_url: m?.team_url ?? null,
      };
      map.set(team, r);
    }
    return r;
  };
  for (const m of matches) {
    if (m.status !== 'finished' || m.home_score == null || m.away_score == null) continue;
    const h = ensure(m.home_team);
    const a = ensure(m.away_team);
    h.played++; a.played++;
    h.goals_for += m.home_score; h.goals_against += m.away_score;
    a.goals_for += m.away_score; a.goals_against += m.home_score;
    if (m.home_score > m.away_score) { h.won++; h.points += 3; a.lost++; }
    else if (m.home_score < m.away_score) { a.won++; a.points += 3; h.lost++; }
    else { h.drawn++; a.drawn++; h.points++; a.points++; }
  }
  for (const r of map.values()) r.goal_difference = r.goals_for - r.goals_against;
  return Array.from(map.values()).sort((x, y) =>
    y.points - x.points || y.goal_difference - x.goal_difference || y.goals_for - x.goals_for || x.team.localeCompare(y.team)
  );
};

const buildLastNTable = (
  matches: DivisionMatch[],
  n: number,
  meta: Map<string, { logo_url: string | null; team_url: string | null }>
): ComputedRow[] => {
  const sorted = [...matches]
    .filter(m => m.status === 'finished' && m.home_score != null && m.away_score != null)
    .sort((a, b) => new Date(b.match_date).getTime() - new Date(a.match_date).getTime());
  const byTeam = new Map<string, DivisionMatch[]>();
  for (const m of sorted) {
    for (const team of [m.home_team, m.away_team]) {
      const arr = byTeam.get(team) || [];
      if (arr.length < n) arr.push(m);
      byTeam.set(team, arr);
    }
  }
  const rows: ComputedRow[] = [];
  for (const [team, ms] of byTeam.entries()) {
    const info = meta.get(team);
    const r: ComputedRow = {
      team, played: 0, won: 0, drawn: 0, lost: 0,
      goals_for: 0, goals_against: 0, goal_difference: 0, points: 0,
      logo_url: info?.logo_url ?? null, team_url: info?.team_url ?? null,
    };
    for (const m of ms) {
      const isHome = m.home_team === team;
      const gf = isHome ? m.home_score! : m.away_score!;
      const ga = isHome ? m.away_score! : m.home_score!;
      r.played++;
      r.goals_for += gf;
      r.goals_against += ga;
      if (gf > ga) { r.won++; r.points += 3; }
      else if (gf < ga) { r.lost++; }
      else { r.drawn++; r.points++; }
    }
    r.goal_difference = r.goals_for - r.goals_against;
    rows.push(r);
  }
  return rows.sort((x, y) =>
    y.points - x.points || y.goal_difference - x.goal_difference || y.goals_for - x.goals_for || x.team.localeCompare(y.team)
  );
};

/** Build standings restricted to home or away matches per team, with form. */
const buildVenueTable = (
  matches: DivisionMatch[],
  venue: 'home' | 'away',
  meta: Map<string, { logo_url: string | null; team_url: string | null }>
): ComputedRow[] => {
  const byTeam = new Map<string, { row: ComputedRow; form: { date: string; entry: string }[] }>();
  const ensure = (team: string) => {
    let v = byTeam.get(team);
    if (!v) {
      const m = meta.get(team);
      v = {
        row: {
          team, played: 0, won: 0, drawn: 0, lost: 0,
          goals_for: 0, goals_against: 0, goal_difference: 0, points: 0,
          logo_url: m?.logo_url ?? null, team_url: m?.team_url ?? null,
        },
        form: [],
      };
      byTeam.set(team, v);
    }
    return v;
  };
  const finished = matches.filter(m => m.status === 'finished' && m.home_score != null && m.away_score != null);
  for (const m of finished) {
    const team = venue === 'home' ? m.home_team : m.away_team;
    const opponent = venue === 'home' ? m.away_team : m.home_team;
    const gf = venue === 'home' ? m.home_score! : m.away_score!;
    const ga = venue === 'home' ? m.away_score! : m.home_score!;
    const v = ensure(team);
    v.row.played++;
    v.row.goals_for += gf;
    v.row.goals_against += ga;
    let result: 'W' | 'D' | 'L';
    if (gf > ga) { v.row.won++; v.row.points += 3; result = 'W'; }
    else if (gf < ga) { v.row.lost++; result = 'L'; }
    else { v.row.drawn++; v.row.points++; result = 'D'; }
    v.form.push({
      date: m.match_date,
      entry: `${result}:${gf}-${ga}:${opponent}:${m.match_url ?? ''}`,
    });
  }
  const rows: ComputedRow[] = [];
  for (const v of byTeam.values()) {
    v.row.goal_difference = v.row.goals_for - v.row.goals_against;
    v.row.form = v.form
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
      .slice(-5)
      .map(f => f.entry);
    rows.push(v.row);
  }
  return rows.sort((x, y) =>
    y.points - x.points || y.goal_difference - x.goal_difference || y.goals_for - x.goals_for || x.team.localeCompare(y.team)
  );
};

const LeagueTableContent = ({ team }: { team: 'A-laget' | 'B-laget' }) => {
  const { data: standings, isLoading } = useStandings(team);
  const {data:config}=useSportsSeason();
  const selected=config?teamConfig(config,team):undefined;
  const { data: divisionMatches } = useDivisionMatches(selected?.tournament_id);
  const supportsExplorer = !!selected;

  const [mode, setMode] = useState<ViewMode>({ kind: 'current' });

  const teamHighlight = selected?.club_name;
  const leagueName = selected?`${selected.league} - Oslo`:'';

  // Build metadata map (logo + team url) from current standings
  const teamMeta = useMemo(() => {
    const m = new Map<string, { logo_url: string | null; team_url: string | null }>();
    for (const s of standings || []) {
      m.set(s.team_name, { logo_url: s.logo_url, team_url: s.team_url });
    }
    return m;
  }, [standings]);

  const finishedMatches = useMemo(
    () => (divisionMatches || []).filter(m => m.status === 'finished' && m.home_score != null && m.away_score != null),
    [divisionMatches]
  );

  const availableRounds = useMemo(() => {
    const set = new Set<number>();
    for (const m of finishedMatches) {
      if (m.round_number != null) set.add(m.round_number);
    }
    return Array.from(set).sort((a, b) => a - b);
  }, [finishedMatches]);

  const latestRound = availableRounds.length ? availableRounds[availableRounds.length - 1] : 0;
  const effectiveRound = mode.kind === 'round' && mode.round === 0 ? latestRound : (mode.kind === 'round' ? mode.round : 0);

  const computedRows: ComputedRow[] | null = useMemo(() => {
    if (mode.kind === 'current') return null;
    if (mode.kind === 'round') {
      const filtered = finishedMatches.filter(m => m.round_number != null && m.round_number <= effectiveRound);
      return buildTable(filtered, teamMeta);
    }
    if (mode.kind === 'venue') {
      return buildVenueTable(finishedMatches, mode.venue, teamMeta);
    }
    return buildLastNTable(finishedMatches, mode.n, teamMeta);
  }, [mode, finishedMatches, effectiveRound, teamMeta]);

  // Unified row data: either DB standings or computed rows mapped to common shape
  type Row = {
    key: string;
    team_name: string;
    played: number; won: number; drawn: number; lost: number;
    goals_for: number; goals_against: number; goal_difference: number; points: number;
    form: string[]; logo_url: string | null; team_url: string | null;
  };
  const rows: Row[] = mode.kind === 'current'
    ? (standings || []).map(s => ({
        key: s.id, team_name: s.team_name,
        played: s.played, won: s.won, drawn: s.drawn, lost: s.lost,
        goals_for: s.goals_for, goals_against: s.goals_against, goal_difference: s.goal_difference,
        points: s.points, form: s.form || [], logo_url: s.logo_url, team_url: s.team_url,
      }))
    : (computedRows || []).map(r => ({
        key: r.team, team_name: r.team,
        played: r.played, won: r.won, drawn: r.drawn, lost: r.lost,
        goals_for: r.goals_for, goals_against: r.goals_against, goal_difference: r.goal_difference,
        points: r.points, form: r.form ?? [], logo_url: r.logo_url, team_url: r.team_url,
      }));

  const showForm = mode.kind === 'current' || mode.kind === 'venue';

  return (
    <>
    <div>
      <div className="mb-4 md:mb-6">
        <h3 className="text-base md:text-lg font-semibold text-primary">{leagueName}</h3>
        <p className="text-xs md:text-sm text-muted-foreground">Sesong {config?.season}</p>
      </div>

      {supportsExplorer && availableRounds.length > 0 && (
        <div className="mb-4 md:mb-5 flex flex-wrap items-center gap-2">
          <Button
            type="button"
            size="sm"
            variant={mode.kind === 'current' ? 'default' : 'outline'}
            onClick={() => setMode({ kind: 'current' })}
            className="rounded-full"
          >
            Aktuell
          </Button>
          <Button
            type="button"
            size="sm"
            variant={mode.kind === 'lastN' && mode.n === 5 ? 'default' : 'outline'}
            onClick={() => setMode({ kind: 'lastN', n: 5 })}
            className="rounded-full"
          >
            Siste 5
          </Button>
          <Button
            type="button"
            size="sm"
            variant={mode.kind === 'lastN' && mode.n === 10 ? 'default' : 'outline'}
            onClick={() => setMode({ kind: 'lastN', n: 10 })}
            className="rounded-full"
          >
            Siste 10
          </Button>
          <Button
            type="button"
            size="sm"
            variant={mode.kind === 'lastN' && mode.n === 15 ? 'default' : 'outline'}
            onClick={() => setMode({ kind: 'lastN', n: 15 })}
            className="rounded-full"
          >
            Siste 15
          </Button>
          <Button
            type="button"
            size="sm"
            variant={mode.kind === 'venue' && mode.venue === 'home' ? 'default' : 'outline'}
            onClick={() => setMode({ kind: 'venue', venue: 'home' })}
            className="rounded-full"
          >
            Hjemme
          </Button>
          <Button
            type="button"
            size="sm"
            variant={mode.kind === 'venue' && mode.venue === 'away' ? 'default' : 'outline'}
            onClick={() => setMode({ kind: 'venue', venue: 'away' })}
            className="rounded-full"
          >
            Borte
          </Button>
          <div className="ml-auto flex items-center gap-2">
            <span className="text-xs text-muted-foreground hidden sm:inline">Etter runde:</span>
            <Select
              value={mode.kind === 'round' ? String(mode.round) : ''}
              onValueChange={(v) => setMode({ kind: 'round', round: parseInt(v) })}
            >
              <SelectTrigger
                className={`h-8 w-[140px] rounded-full text-xs ${mode.kind === 'round' ? 'bg-primary text-primary-foreground border-primary' : ''}`}
              >
                <SelectValue placeholder="Velg runde" />
              </SelectTrigger>
              <SelectContent>
                {availableRounds.map(r => (
                  <SelectItem key={r} value={String(r)}>Runde {r}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      )}

      {mode.kind === 'round' && (
        <p className="text-xs text-muted-foreground mb-2">
          Tabell etter runde {effectiveRound}
        </p>
      )}
      {mode.kind === 'lastN' && (
        <p className="text-xs text-muted-foreground mb-2">
          Tabell basert på hvert lags siste {mode.n} kamper
        </p>
      )}
      {mode.kind === 'venue' && (
        <p className="text-xs text-muted-foreground mb-2">
          {mode.venue === 'home'
            ? 'Tabell basert kun på hjemmekamper'
            : 'Tabell basert kun på bortekamper'}
        </p>
      )}

      <div className="full-standings bg-card rounded-xl shadow-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs md:text-sm">
            <colgroup>
              <col className="standings-rank" />
              <col className="standings-team" />
              <col className="standings-stat" span={4} />
              <col className="standings-goals" />
              <col className="standings-difference" />
              <col className="standings-points" />
              {showForm && <col className="standings-form" />}
            </colgroup>
            <thead>
              <tr className="border-b border-border bg-muted/50">
                <th className="px-2 md:px-4 py-3 text-left font-semibold text-muted-foreground w-8 md:w-12">#</th>
                <th className="px-2 md:px-4 py-3 text-left font-semibold text-muted-foreground">Lag</th>
                <th className="px-1 md:px-4 py-3 text-center font-semibold text-muted-foreground w-8 md:w-12">S</th>
                <th className="px-1 md:px-4 py-3 text-center font-semibold text-muted-foreground w-8 md:w-12">V</th>
                <th className="px-1 md:px-4 py-3 text-center font-semibold text-muted-foreground w-8 md:w-12">U</th>
                <th className="px-1 md:px-4 py-3 text-center font-semibold text-muted-foreground w-8 md:w-12">T</th>
                <th className="px-1 md:px-4 py-3 text-center font-semibold text-muted-foreground w-14 md:w-20">Mål</th>
                <th className="px-1 md:px-4 py-3 text-center font-semibold text-muted-foreground w-10 md:w-16">MF</th>
                <th className="px-1 md:px-4 py-3 text-center font-semibold text-muted-foreground w-8 md:w-14">P</th>
                {showForm && (
                  <th aria-label="Siste fem kamper" className="px-1 md:px-4 py-3 text-center font-semibold text-muted-foreground w-24 md:w-36" />
                )}
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                Array.from({ length: 10 }).map((_, i) => (
                  <tr key={i} className="border-b border-border/50">
                    <td className="px-2 md:px-4 py-3"><Skeleton className="h-4 md:h-5 w-4 md:w-5" /></td>
                    <td className="px-2 md:px-4 py-3"><Skeleton className="h-4 md:h-5 w-20 md:w-32" /></td>
                    <td className="px-1 md:px-4 py-3"><Skeleton className="h-4 md:h-5 w-4 md:w-5 mx-auto" /></td>
                    <td className="px-1 md:px-4 py-3"><Skeleton className="h-4 md:h-5 w-4 md:w-5 mx-auto" /></td>
                    <td className="px-1 md:px-4 py-3"><Skeleton className="h-4 md:h-5 w-4 md:w-5 mx-auto" /></td>
                    <td className="px-1 md:px-4 py-3"><Skeleton className="h-4 md:h-5 w-4 md:w-5 mx-auto" /></td>
                    <td className="px-1 md:px-4 py-3"><Skeleton className="h-4 md:h-5 w-10 md:w-14 mx-auto" /></td>
                    <td className="px-1 md:px-4 py-3"><Skeleton className="h-4 md:h-5 w-6 md:w-8 mx-auto" /></td>
                    <td className="px-1 md:px-4 py-3"><Skeleton className="h-4 md:h-5 w-4 md:w-6 mx-auto" /></td>
                    {showForm && (
                      <td className="px-1 md:px-4 py-3"><Skeleton className="h-5 md:h-6 w-24 md:w-32 mx-auto" /></td>
                    )}
                  </tr>
                ))
              ) : rows.map((row, index) => (
                <tr 
                  key={row.key} 
                  className={`border-b border-border/50 transition-colors hover:bg-muted/30 ${
                    row.team_name === teamHighlight ? 'bg-primary/5 hover:bg-primary/10' : ''
                  } ${mode.kind === 'current' ? (index < 2 ? 'border-l-4 border-l-green-500' : index >= (rows.length - 2) ? 'border-l-4 border-l-red-500' : '') : ''}`}
                >
                  <td className="px-2 md:px-4 py-3 font-bold text-sm md:text-lg">{index + 1}</td>
                  <td className={`px-2 md:px-4 py-3 font-semibold ${row.team_name === teamHighlight ? 'text-primary' : ''}`}>
                    <a 
                      href={row.team_url || '#'} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 md:gap-3 hover:underline"
                      onClick={(e) => !row.team_url && e.preventDefault()}
                    >
                      {row.logo_url && (
                        <img 
                          src={row.logo_url} 
                          alt={`${row.team_name} logo`} 
                          className="w-5 h-5 md:w-7 md:h-7 object-contain flex-shrink-0"
                        />
                      )}
                      <span className="standings-team-name truncate text-xs md:text-sm">{row.team_name}</span>
                    </a>
                  </td>
                  <td className="px-1 md:px-4 py-3 text-center">{row.played}</td>
                  <td className="px-1 md:px-4 py-3 text-center text-green-600 font-medium">{row.won}</td>
                  <td className="px-1 md:px-4 py-3 text-center text-amber-600 font-medium">{row.drawn}</td>
                  <td className="px-1 md:px-4 py-3 text-center text-red-600 font-medium">{row.lost}</td>
                  <td className="px-1 md:px-4 py-3 text-center font-medium whitespace-nowrap">{row.goals_for} - {row.goals_against}</td>
                  <td className="px-1 md:px-4 py-3 text-center font-medium">
                    {row.goal_difference > 0 ? `+${row.goal_difference}` : row.goal_difference}
                  </td>
                  <td className="px-1 md:px-4 py-3 text-center font-bold text-sm md:text-lg">{row.points}</td>
                  {showForm && (
                    <td className="px-1 md:px-4 py-3">
                      <div className="standings-form-dots flex gap-1 justify-center">
                        {row.form.length > 0 ? (
                          row.form.slice(-5).map((result, i) => (
                            <FormIndicator key={i} result={result} />
                          ))
                        ) : (
                          Array.from({ length: 5 }).map((_, i) => (
                            <span key={i} className="standings-form-dot inline-block shrink-0 w-2.5 h-2.5 md:w-3 md:h-3 rounded-full bg-muted" />
                          ))
                        )}
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Legend - Responsive */}
      <div className="mt-4 md:mt-6 flex flex-wrap gap-3 md:gap-6 text-xs md:text-sm text-muted-foreground">
        {showForm && (
          <div className="flex items-center gap-2 md:gap-3">
            <div className="flex items-center gap-1"><FormIndicator result="W" /><span>Seier</span></div>
            <div className="flex items-center gap-1"><FormIndicator result="D" /><span>Uavgjort</span></div>
            <div className="flex items-center gap-1"><FormIndicator result="L" /><span>Tap</span></div>
          </div>
        )}
        {mode.kind === 'current' && (
          <>
            <div className="flex items-center gap-1.5 md:gap-2">
              <div className="w-1 h-4 md:h-5 bg-green-500" />
              <span>Opprykk</span>
            </div>
            <div className="flex items-center gap-1.5 md:gap-2">
              <div className="w-1 h-4 md:h-5 bg-red-500" />
              <span>Nedrykk</span>
            </div>
          </>
        )}
      </div>
    </div>
    </>
  );
};

const LeagueTableFull = () => {
  return (
    <div className="min-h-screen bg-background">
      <Seo
        title="Ligatabell med hjemme- og bortetabell | Fagerborg BK"
        description="Full ligatabell for Fagerborg BK med hjemmetabell, bortetabell og form for de fem siste kampene."
        path="/tabell"
      />
      <Header />
      <main className="pt-20">
        <section className="bg-fagerborg-gradient py-8 md:py-12">
          <div className="container mx-auto px-4 text-center">
            <h1 className="text-2xl md:text-5xl font-bold text-white mb-2 md:mb-4">Ligatabell</h1>
            <p className="text-white/80 text-sm md:text-lg">Fullstendig tabell for A- og B-laget</p>
          </div>
        </section>

        <section className="py-6 md:py-12">
          <div className="container mx-auto px-4 max-w-6xl">
            <Tabs defaultValue="a-laget" className="w-full">
              <TabsList className="grid w-full max-w-xs md:max-w-md grid-cols-2 mb-6 md:mb-8">
                <TabsTrigger value="a-laget" className="text-sm md:text-base">A-laget</TabsTrigger>
                <TabsTrigger value="b-laget" className="text-sm md:text-base">B-laget</TabsTrigger>
              </TabsList>
              <TabsContent value="a-laget">
                <LeagueTableContent team="A-laget" />
              </TabsContent>
              <TabsContent value="b-laget">
                <LeagueTableContent team="B-laget" />
              </TabsContent>
            </Tabs>

            <div className="mt-8 text-center">
              <Link
                to="/om-klubben#tabeller"
                className="inline-flex items-center gap-2 text-sm font-medium text-primary hover:text-primary/80 transition-colors"
              >
                Se historiske tabellplasseringer →
              </Link>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
};

export default LeagueTableFull;