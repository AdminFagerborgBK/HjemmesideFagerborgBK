export interface SportsTeam {
  team: 'A-laget' | 'B-laget';
  tournament_id: string;
  team_id: string;
  expected_teams: number;
  league: string;
  club_name: string;
}
export interface SportsSeason { season: number; timezone: 'Europe/Oslo'; teams: SportsTeam[] }

export function validateSportsSeason(value: unknown): SportsSeason {
  if (!value || typeof value !== 'object') throw new Error('Sports season configuration missing');
  const c = value as SportsSeason;
  if (!Number.isInteger(c.season) || c.season < 2000 || c.season > 2200 || c.timezone !== 'Europe/Oslo' || !Array.isArray(c.teams) || c.teams.length !== 2) throw new Error('Invalid sports season configuration');
  for (const t of c.teams) {
    if (!['A-laget','B-laget'].includes(t.team) || !/^\d+$/.test(t.tournament_id) || !/^\d+$/.test(t.team_id) || !Number.isInteger(t.expected_teams) || t.expected_teams < 2 || t.expected_teams > 32 || !t.league?.trim() || !t.club_name?.trim()) throw new Error('Invalid sports team configuration');
  }
  if (new Set(c.teams.map(t => t.team)).size !== 2 || new Set(c.teams.map(t => t.tournament_id)).size !== 2) throw new Error('Duplicate sports configuration');
  return c;
}

export async function readSportsSeason(db: any, season?: number): Promise<SportsSeason> {
  let q = db.from('sports_seasons').select('season,timezone,teams');
  q = season === undefined ? q.eq('is_active', true) : q.eq('season', season);
  const { data, error } = await q.single();
  if (error) throw new Error(`Cannot read sports configuration: ${error.message}`);
  return validateSportsSeason(data);
}

export function teamConfig(config: SportsSeason, team: string): SportsTeam {
  const found = config.teams.find(t => t.team === team);
  if (!found) throw new Error(`Missing team configuration: ${team}`);
  return found;
}

export function assertManifest(config: SportsSeason, manifest: unknown) {
  const supplied = validateSportsSeason(manifest);
  const normalize = (c: SportsSeason) => JSON.stringify({ season: c.season, timezone: c.timezone, teams: [...c.teams].sort((a,b) => a.team.localeCompare(b.team)).map(t => [t.team,t.tournament_id,t.team_id,t.expected_teams,t.league,t.club_name]) });
  if (normalize(config) !== normalize(supplied)) throw new Error('GitHub season manifest does not match active backend configuration');
}