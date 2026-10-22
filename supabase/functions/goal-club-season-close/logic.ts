export const ACCOUNT_NUMBER = '1600.20.64026';
export const DUE_DAYS = 14;

export interface MatchRow { competition: string; status: string; is_home: boolean; home_score: number | null; away_score: number | null; is_cancelled: boolean; match_date: string }
export interface StandingRow { team_name: string; played: number; position: number; points: number; won: number; drawn: number; lost: number; goals_for: number; goals_against: number; league: string }

const counts = (m: MatchRow) => !/trening/i.test(m.competition);

/** Season is over when every competitive A match that year is finished/cancelled and Fagerborg has played all league rounds. */
export function isSeasonComplete(matches: MatchRow[], standings: StandingRow[], expectedTeams = standings.length, clubName = 'Fagerborg'): boolean {
  const comp = matches.filter(counts);
  if (!comp.length) return false;
  if (comp.some((m) => !m.is_cancelled && m.status !== 'finished')) return false;
  const fb = standings.find((s) => s.team_name === clubName);
  if (!fb || standings.length !== expectedTeams || expectedTeams < 2) return false;
  return fb.played >= 2 * (expectedTeams - 1);
}

/** Fagerborg goals in league + NM (friendlies excluded). */
export function seasonGoals(matches: MatchRow[]): number {
  return matches.filter((m) => counts(m) && !m.is_cancelled && m.status === 'finished')
    .reduce((s, m) => s + ((m.is_home ? m.home_score : m.away_score) ?? 0), 0);
}

export function invoiceReference(season: number, entryId: string): string {
  return `MK${season}-${entryId.replace(/-/g, '').slice(0, 6).toUpperCase()}`;
}

export function winnerIds(entries: { id: string; goal_guess: number }[], goals: number): Set<string> {
  if (!entries.length) return new Set();
  const best = Math.min(...entries.map((e) => Math.abs(e.goal_guess - goals)));
  return new Set(entries.filter((e) => Math.abs(e.goal_guess - goals) === best).map((e) => e.id));
}

export function dueDate(from: Date): string {
  const d = new Date(from.getTime() + DUE_DAYS * 86400000);
  return d.toISOString().slice(0, 10);
}

export function seasonEntries<T extends {season:number}>(entries:T[],season:number):T[] { return entries.filter(e=>e.season===season); }
