import { describe, it, expect } from 'vitest';
import { validateSportsSeason, teamConfig, assertManifest } from '../../supabase/functions/_shared/sportsSeason';

const config = { season: 2027, timezone: 'Europe/Oslo', teams: [
  {team:'A-laget',tournament_id:'300001',team_id:'311',expected_teams:14,league:'4. divisjon',club_name:'Fagerborg'},
  {team:'B-laget',tournament_id:'300002',team_id:'6458',expected_teams:12,league:'6. divisjon',club_name:'Fagerborg 2'},
] };
describe('Configurable sports rollover', () => {
  it('2027 reads new IDs, season and team counts without 2026 defaults', () => {
    const c=validateSportsSeason(config);
    expect(c.season).toBe(2027);
    expect(teamConfig(c,'A-laget').tournament_id).toBe('300001');
    expect(teamConfig(c,'B-laget').expected_teams).toBe(12);
    expect(teamConfig(c,'A-laget').expected_teams*(teamConfig(c,'A-laget').expected_teams-1)).toBe(182);
  });
  it('stale manifest is an internal error, not source unavailable', () => {
    expect(() => assertManifest(validateSportsSeason(config), {...config,season:2026})).toThrow('does not match');
  });
  it('missing config never guesses a season', () => {
    expect(() => validateSportsSeason(null)).toThrow('missing');
  });
});