import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

/**
 * Fetches all team logos from the standings table and creates a lookup map.
 * Used to display opponent logos in match lists.
 */
export const useOpponentLogos = () => {
  return useQuery({
    queryKey: ['opponent-logos'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('standings')
        .select('team_name, logo_url')
        .not('logo_url', 'is', null);

      if (error) throw error;

      const logoMap = new Map<string, string>();
      for (const row of data || []) {
        if (row.logo_url) {
          logoMap.set(row.team_name, row.logo_url);
        }
      }
      return logoMap;
    },
    staleTime: 1000 * 60 * 60, // 1 hour cache
  });
};

/**
 * Manual alias map: maps raw opponent names from fotball.no (matches table)
 * to the canonical short name used in the standings table.
 * Add new entries here when an opponent's match-name does not match its
 * standings-name well enough for fuzzy lookup.
 */
const OPPONENT_ALIASES: Record<string, string> = {
  'høybråten stovner il': 'HSIL',
  'høybr/stovn menn 1': 'HSIL',
  'høybr/stovn': 'HSIL',
  'frigg oslo fk menn senior 2': 'Frigg 2',
  'frigg oslo fk 2': 'Frigg 2',
  'korsvoll': 'Korsvoll 2',
  'bygdø monolitten': 'Monolitten Idrettslag',
  'frisk asker herrer': 'Frisk Asker',
  'furuset senior 2': 'Furuset 2',
  'jutul menn 1': 'Jutul',
  'lille tøyen menn 1': 'Lille Tøyen',
  'sagene menn 2': 'Sagene 2',
  'sterling menn': 'Sterling',
};

const normalizeKey = (s: string) => s.trim().toLowerCase().replace(/\s+/g, ' ');

const normalizeTeamName = (name: string) => {
  const words = normalizeKey(name)
    .replace(/[.,]/g, ' ')
    .split(/\s+/)
    .filter((word) => !['idrettslag', 'if', 'fk', 'bk', 'il', 'herrer', 'senior', 'menn'].includes(word));

  // Fotball.no commonly adds "Menn 1" to first teams, while the table omits it.
  if (words.at(-1) === '1') words.pop();
  return words.join(' ');
};

/**
 * Resolve the canonical display name for an opponent, preferring the
 * standings team name so matches and table stay consistent.
 */
export const getOpponentDisplayName = (
  logoMap: Map<string, string> | undefined,
  opponentName: string
): string => {
  const key = normalizeKey(opponentName);
  if (OPPONENT_ALIASES[key]) return OPPONENT_ALIASES[key];
  if (!logoMap) return opponentName;
  if (logoMap.has(opponentName)) return opponentName;
  for (const teamName of logoMap.keys()) {
    if (normalizeKey(teamName) === key) return teamName;
  }
  return opponentName;
};

/**
 * Find the best matching logo for an opponent name.
 * First checks the match-level opponent_logo_url, then standings lookup.
 */
export const findOpponentLogo = (
  logoMap: Map<string, string> | undefined,
  opponentName: string,
  matchOpponentLogoUrl?: string | null
): string | null => {
  // Priority 1: match-level logo (uploaded in admin)
  if (matchOpponentLogoUrl) {
    return matchOpponentLogoUrl;
  }

  if (!logoMap) return null;

  // Priority 1b: manual alias map (handles abbreviations like HSIL)
  const aliasTarget = OPPONENT_ALIASES[normalizeKey(opponentName)];
  if (aliasTarget) {
    const aliasLogo = logoMap.get(aliasTarget);
    if (aliasLogo) return aliasLogo;
  }

  // Priority 2: Exact match in standings
  const exactLogo = logoMap.get(opponentName);
  if (exactLogo) return exactLogo;

  // Priority 3: Normalize Fotball.no squad labels while preserving reserve-team
  // numbers, e.g. "Sagene Menn 2" -> "Sagene 2" and "Jutul Menn 1" -> "Jutul".
  const normalizedOpponentName = normalizeTeamName(opponentName);
  for (const [teamName, logoUrl] of logoMap.entries()) {
    if (normalizeTeamName(teamName) === normalizedOpponentName) return logoUrl;
  }

  // Priority 4: Match with/without trailing number for legacy match names.
  for (const [teamName, logoUrl] of logoMap.entries()) {
    const normalizedTeam = teamName.replace(/\s*\d+$/, '').toLowerCase();
    const normalizedOpponent = opponentName.replace(/\s*\d+$/, '').toLowerCase();
    if (normalizedTeam === normalizedOpponent) {
      return logoUrl;
    }
  }

  // Priority 5: Partial match - strip common suffixes like IF, FK, BK, IL, Idrettslag
  for (const [teamName, logoUrl] of logoMap.entries()) {
    const cleanTeam = teamName.replace(/\s*(Idrettslag|IF|FK|BK|IL)\s*/gi, ' ').replace(/\s+/g, ' ').trim().toLowerCase();
    const cleanOpponent = opponentName.replace(/\s*(Idrettslag|IF|FK|BK|IL)\s*/gi, ' ').replace(/\s+/g, ' ').trim().toLowerCase();
    const baseTeam = cleanTeam.replace(/\s*\d+$/, '');
    const baseOpponent = cleanOpponent.replace(/\s*\d+$/, '');
    if (baseTeam === baseOpponent) {
      return logoUrl;
    }
  }

  // Priority 6: Starts-with match
  for (const [teamName, logoUrl] of logoMap.entries()) {
    if (
      opponentName.toLowerCase().startsWith(teamName.toLowerCase()) ||
      teamName.toLowerCase().startsWith(opponentName.toLowerCase())
    ) {
      return logoUrl;
    }
  }

  return null;
};
