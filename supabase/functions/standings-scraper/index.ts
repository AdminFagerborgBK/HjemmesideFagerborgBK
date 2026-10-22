/**
 * Standings Scraper Edge Function
 * 
 * Scrapes standings from fotball.no and updates the standings table.
 * Parses the desktop table and fetches club logos from individual team pages.
 */

import { SourceUnavailableError, readSource, sourceText, recordStatus, configuredClient, errorText } from '../_shared/sourceAvailability.ts';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2.112.4'
import { requireAdminOrSecret } from '../_shared/adminAuth.ts'
import { readSportsSeason, teamConfig, assertManifest, type SportsSeason } from '../_shared/sportsSeason.ts'

interface TeamStanding {
  team: string;
  team_name: string;
  position: number;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goals_for: number;
  goals_against: number;
  goal_difference: number;
  points: number;
  form: string[];
  league: string;
  season: string;
  logo_url: string | null;
  team_url: string | null;
}

const FETCH_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
};

/**
 * Fetch the club logo URL from a team's page.
 * The logo is in: <img class="a_clubLogo" src="https://images.fotball.no/clublogos/171.png">
 */
async function fetchTeamLogo(teamPageUrl: string): Promise<string | null> {
  try {
    const resp = await readSource(teamPageUrl, async r => r);
    if (!resp.ok) return null;
    const html = await resp.text();
    const logoMatch = html.match(/<img[^>]*class="a_clubLogo"[^>]*src="([^"]+)"/);
    if (logoMatch) return logoMatch[1];
    const altMatch = html.match(/clublogos\/(\d+)\.png/);
    if (altMatch) return `https://images.fotball.no/clublogos/${altMatch[1]}.png`;
    return null;
  } catch (error) {
    if (!(error instanceof SourceUnavailableError)) throw error;
    return null;
  }
}

/**
 * Extract team fiksId from a fotball.no team URL.
 */
function extractTeamFiksId(teamPageUrl: string): string | null {
  const match = teamPageUrl.match(/fiksId=(\d+)/);
  return match ? match[1] : null;
}

/**
 * Fetch the last 5 league match results for all teams in a tournament.
 * Returns a map keyed by team fiksId with entries like "W:3-1:Opponent Name".
 */
async function fetchLeagueForms(leagueFiksId: string): Promise<Record<string, string[]>> {
  try {
    const kamperUrl = `https://www.fotball.no/fotballdata/turnering/hjem/?fiksId=${leagueFiksId}&underside=kamper`;
    const resp = await readSource(kamperUrl, async r => r);
    if (!resp.ok) return {};

    const html = await resp.text();
    const formMap: Record<string, string[]> = {};
    const rowRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/g;
    let rowMatch;

    while ((rowMatch = rowRegex.exec(html)) !== null) {
      const row = rowMatch[1];
      const scoreMatch = row.match(/(\d+)\s*-\s*(\d+)/);
      if (!scoreMatch) continue;

      const teamLinks = [...row.matchAll(/<a[^>]*href="[^"]*\/fotballdata\/lag\/[^"]*fiksId=(\d+)[^"]*"[^>]*>([\s\S]*?)<\/a>/g)];
      if (teamLinks.length < 2) continue;

      // Extract match (kamp) link to fotball.no, if present
      const kampMatch = row.match(/href="([^"]*\/fotballdata\/kamp\/[^"]*fiksId=(\d+)[^"]*)"/);
      const kampUrl = kampMatch
        ? (kampMatch[1].startsWith('http') ? kampMatch[1] : `https://www.fotball.no${kampMatch[1].replace(/&amp;/g, '&')}`)
        : '';

      const homeFiksId = teamLinks[0][1];
      const awayFiksId = teamLinks[1][1];
      const homeTeamName = decodeHtmlEntities(teamLinks[0][2].trim());
      const awayTeamName = decodeHtmlEntities(teamLinks[1][2].trim());
      const homeScore = parseInt(scoreMatch[1]);
      const awayScore = parseInt(scoreMatch[2]);

      const homeResult = homeScore > awayScore ? 'W' : homeScore < awayScore ? 'L' : 'D';
      const awayResult = awayScore > homeScore ? 'W' : awayScore < homeScore ? 'L' : 'D';

      if (!formMap[homeFiksId]) formMap[homeFiksId] = [];
      if (!formMap[awayFiksId]) formMap[awayFiksId] = [];

      // Format: "RESULT:SCORE:OPPONENT:URL" (URL may be empty)
      formMap[homeFiksId].push(`${homeResult}:${homeScore}-${awayScore}:${awayTeamName}:${kampUrl}`);
      formMap[awayFiksId].push(`${awayResult}:${awayScore}-${homeScore}:${homeTeamName}:${kampUrl}`);
    }

    for (const teamFiksId of Object.keys(formMap)) {
      formMap[teamFiksId] = formMap[teamFiksId].slice(-5);
    }

    return formMap;
  } catch (err) {
    if (!(err instanceof SourceUnavailableError)) throw err;
    console.error(`[Standings] Error fetching league forms for ${leagueFiksId}:`, err);
    return {};
  }
}

/**
 * Decode common HTML entities to proper characters.
 */
function decodeHtmlEntities(str: string): string {
  return str
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(parseInt(code)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, ' ');
}

/**
 * Parse the desktop standings table from fotball.no HTML.
 * Each row: Position | Team (link with fiksId) | Played | Won | Drawn | Lost | "GF - GA" | Diff | Points
 */
export function parseStandingsHtml(html: string, team: 'A-laget' | 'B-laget', league: string, config: SportsSeason): { standings: TeamStanding[], teamPageUrls: string[] } {
  const standings: TeamStanding[] = [];
  const teamPageUrls: string[] = [];

  // Find the desktop table (a_tableStandings with tablesorter)
  const tableMatch = html.match(/<div[^>]*class="[^"]*a_tableStandings[^"]*"[^>]*>[\s\S]*?<table[^>]*class="[^"]*tablesorter[^"]*"[^>]*>([\s\S]*?)<\/table>/);
  if (!tableMatch) {
    console.error('[Standings] Could not find standings table in HTML');
    throw new SourceUnavailableError('Missing standings table');
  }

  const tbodyMatch = tableMatch[1].match(/<tbody>([\s\S]*?)<\/tbody>/);
  if (!tbodyMatch) throw new SourceUnavailableError('Missing standings body');

  const rows = tbodyMatch[1].split(/<tr[^>]*>/).filter(r => r.includes('</td>'));

  for (const row of rows) {
    const cells: string[] = [];
    const tdRegex = /<td[^>]*>([\s\S]*?)<\/td>/g;
    let tdMatch;
    while ((tdMatch = tdRegex.exec(row)) !== null) {
      cells.push(tdMatch[1].trim());
    }

    if (cells.length < 9) throw new SourceUnavailableError('Incomplete standings row');
    if (![0,2,3,4,5,8].every(i => /^\d+$/.test(cells[i].trim()))) throw new SourceUnavailableError('Invalid standings statistics');

    const position = parseInt(cells[0].replace(/\s/g, '')) || 0;

    const linkMatch = cells[1].match(/<a[^>]*href="([^"]*)"[^>]*>\s*(.*?)\s*<\/a>/s);
    if (!linkMatch || !linkMatch[2].trim()) throw new SourceUnavailableError('Missing standings team');
    
    const teamName = decodeHtmlEntities(linkMatch[2].trim());
    const teamPageUrl = linkMatch[1].startsWith('http') 
      ? linkMatch[1] 
      : `https://www.fotball.no${linkMatch[1]}`;
    teamPageUrls.push(teamPageUrl);

    const played = parseInt(cells[2]) || 0;
    const won = parseInt(cells[3]) || 0;
    const drawn = parseInt(cells[4]) || 0;
    const lost = parseInt(cells[5]) || 0;

    const goalsMatch = cells[6].match(/(\d+)\s*-\s*(\d+)/);
    if (!goalsMatch) throw new SourceUnavailableError('Invalid standings goals');
    if (played !== won + drawn + lost) throw new SourceUnavailableError('Inconsistent standings statistics');
    const goalsFor = goalsMatch ? parseInt(goalsMatch[1]) : 0;
    const goalsAgainst = goalsMatch ? parseInt(goalsMatch[2]) : 0;
    // Compute goal difference ourselves; fotball.no sometimes uses non-ASCII minus
    // characters (−, –) that parseInt does not handle, leading to 0 for negatives.
    const goalDifference = goalsFor - goalsAgainst;
    const points = parseInt(cells[8]) || 0;

    standings.push({
      team,
      team_name: teamName,
      position,
      played, won, drawn, lost,
      goals_for: goalsFor,
      goals_against: goalsAgainst,
      goal_difference: goalDifference,
      points,
      form: [],
      league,
      season: String(config.season),
      logo_url: null,
      team_url: teamPageUrl,
    });
  }

  const configured = teamConfig(config, team);
  const expected = configured.expected_teams;
  if (standings.length !== expected || new Set(standings.map(s => s.team_name)).size !== expected ||
      !standings.some(s => s.team_name === configured.club_name) ||
      !Array.from({ length: expected }, (_, i) => i + 1).every(p => standings.some(s => s.position === p))) {
    throw new SourceUnavailableError(`Incomplete ${team} standings: expected ${expected} unique teams`);
  }
  // Sort by position, then points desc
  standings.sort((a, b) => a.position !== b.position ? a.position - b.position : b.points - a.points);
  standings.forEach((s, i) => { s.position = i + 1; });

  return { standings, teamPageUrls };
}

async function scrapeStandings(fiksId: string, team: 'A-laget' | 'B-laget', league: string, config: SportsSeason): Promise<TeamStanding[]> {
  const url = `https://www.fotball.no/fotballdata/turnering/tabell/?fiksId=${fiksId}`;
  console.log(`[Standings] Scraping ${team} from ${url}`);
  
  const { standings, teamPageUrls } = await readSource(url, async response => parseStandingsHtml(await sourceText(response), team, league, config));
  console.log(`[Standings] Parsed ${standings.length} teams, fetching logos and form...`);

  const [logos, formMap] = await Promise.all([
    Promise.all(teamPageUrls.map(u => fetchTeamLogo(u))),
    fetchLeagueForms(fiksId),
  ]);
  
  for (let i = 0; i < standings.length && i < logos.length; i++) {
    standings[i].logo_url = logos[i];

    const teamFiksId = extractTeamFiksId(standings[i].team_url ?? '');
    if (teamFiksId && formMap[teamFiksId]) {
      standings[i].form = formMap[teamFiksId];
    }
  }

  const logosFound = logos.filter(Boolean).length;
  const formsFound = standings.filter(s => s.form.length > 0).length;
  console.log(`[Standings] ${team}: ${standings.length} teams, ${logosFound} logos, ${formsFound} forms found`);
  
  return standings;
}

export function createHandler(deps: any = {}) {
return async (req: Request) => {
  let supabase: any;
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
  supabase = configuredClient(deps.env ?? ((key: string) => Deno.env.get(key)), deps.createClient ?? createClient);
  const unauth = await (deps.auth ?? requireAdminOrSecret)(req);
  if (unauth) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

    console.log('[Standings] Starting scrape...');

    const config: SportsSeason = deps.config ?? await readSportsSeason(supabase);
    const body = req.method === 'POST' ? await req.json().catch(() => ({})) : {};
    if (body.manifest) assertManifest(config, body.manifest);
    const a = teamConfig(config, 'A-laget'), b = teamConfig(config, 'B-laget');
    const [aLaget, bLaget] = await Promise.all([
      (deps.scrape ?? scrapeStandings)(a.tournament_id, a.team, a.league, config),
      (deps.scrape ?? scrapeStandings)(b.tournament_id, b.team, b.league, config)
    ]);

    const allStandings = [...aLaget, ...bLaget];
    if (aLaget.length !== a.expected_teams || bLaget.length !== b.expected_teams) throw new SourceUnavailableError('Incomplete tables');

    // One database transaction validates and replaces BOTH leagues.
    const { error: replaceError } = await supabase.rpc('replace_sports_standings', { p_rows: allStandings });
    if (replaceError) throw replaceError;

    console.log(`[Standings] Done. ${allStandings.length} teams updated.`);

    // Auto-update historical_standings when a season is complete.
    // A season is "complete" when every match in division_matches for that
    // division has status='finished' (and there is at least one match synced).
    const currentYear = Number(aLaget[0]?.season);
    const teamGroups: Array<{ team: 'A-laget' | 'B-laget'; rows: TeamStanding[]; ourName: string; division: string; divisionFiksId: string }> = [
      { team: a.team, rows: aLaget, ourName: a.club_name, division: a.league, divisionFiksId: a.tournament_id },
      { team: b.team, rows: bLaget, ourName: b.club_name, division: b.league, divisionFiksId: b.tournament_id },
    ];

    for (const g of teamGroups) {
      if (g.rows.length === 0) continue;

      const { count: totalMatches, error: totalError } = await supabase
        .from('division_matches')
        .select('id', { count: 'exact', head: true })
        .eq('division_fiks_id', g.divisionFiksId);
      const { count: unfinishedMatches, error: unfinishedError } = await supabase
        .from('division_matches')
        .select('id', { count: 'exact', head: true })
        .eq('division_fiks_id', g.divisionFiksId)
        .neq('status', 'finished');

      if (totalError) throw totalError;
      if (unfinishedError) throw unfinishedError;
      const isComplete = totalMatches === g.rows.length * (g.rows.length - 1) && unfinishedMatches === 0;
      if (!isComplete) {
        console.log(`[Standings] ${g.team} season not complete (total=${totalMatches}, unfinished=${unfinishedMatches})`);
        continue;
      }

      const ours = g.rows.find(r => r.team_name.toLowerCase() === g.ourName.toLowerCase());
      if (!ours) {
        console.log(`[Standings] ${g.team} - could not find ${g.ourName} in standings`);
        continue;
      }

      // Default result rule based on division (admin can override in CMS):
      //   2. div: 1 opp, 2. plass = kvalik, 3 ned
      //   3. div: 1 opp, 3 ned
      //   4. div: 1 opp, 2 ned
      //   5. div og lavere: 2 opp, 2 ned
      const divNum = parseInt((g.division.match(/(\d+)\s*\.?\s*divisjon/i)?.[1]) ?? '0', 10);
      const total = g.rows.length;
      let promoteTop = 2;
      let qualPos = 0; // 0 = ingen kvalik
      let relegateBottom = 2;
      if (divNum === 2) { promoteTop = 1; qualPos = 2; relegateBottom = 3; }
      else if (divNum === 3) { promoteTop = 1; qualPos = 0; relegateBottom = 3; }
      else if (divNum === 4) { promoteTop = 1; qualPos = 0; relegateBottom = 2; }
      else { promoteTop = 2; qualPos = 0; relegateBottom = 2; } // 5. div og lavere

      let result: 'promotion' | 'relegation' | 'qualification' | 'normal' = 'normal';
      if (ours.position <= promoteTop) result = 'promotion';
      else if (qualPos > 0 && ours.position === qualPos) result = 'qualification';
      else if (ours.position >= total - relegateBottom + 1) result = 'relegation';

      const tableUrl = `https://www.fotball.no/fotballdata/turnering/tabell/?fiksId=${g.divisionFiksId}`;

      // Upsert by (team, year): update if exists, otherwise insert.
      const { data: existing, error: readError } = await supabase
        .from('historical_standings')
        .select('id, position, result, locked')
        .eq('team', g.team)
        .eq('year', currentYear)
        .maybeSingle();

      if (readError) throw readError;
      if (existing) {
        if (existing.locked) {
          console.log(`[Standings] historical_standings LOCKED — skipping ${g.team} ${currentYear}`);
          continue;
        }
        // Only update if position is missing or different — don't overwrite a manual result edit.
        const updates: Record<string, unknown> = { position: ours.position, division: g.division, table_url: tableUrl };
        if (!existing.result) updates.result = result;
        const { error: updErr } = await supabase
          .from('historical_standings')
          .update(updates)
          .eq('id', existing.id);
        if (updErr) throw updErr;
        else console.log(`[Standings] historical_standings updated ${g.team} ${currentYear} -> pos ${ours.position}`);
      } else {
        const { error: insErr } = await supabase
          .from('historical_standings')
          .insert({ team: g.team, year: currentYear, division: g.division, position: ours.position, result, table_url: tableUrl });
        if (insErr) throw insErr;
        else console.log(`[Standings] historical_standings inserted ${g.team} ${currentYear} -> pos ${ours.position}`);
      }
    }

    await recordStatus(supabase, 'standings-scraper', true, { count: allStandings.length });
    return new Response(
      JSON.stringify({ 
        success: true,
        updated_count: allStandings.length,
        teams: { 'A-laget': aLaget.length, 'B-laget': bLaget.length }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('[Standings] Error:', error);
    try { if (supabase) await recordStatus(supabase, 'standings-scraper', false, { error: errorText(error) }); }
    catch (statusError) { return new Response(JSON.stringify({ success: false, error: errorText(statusError) }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }); }
    if (error instanceof SourceUnavailableError) return new Response(JSON.stringify({ success: false, source_unavailable: true, code: 'SOURCE_UNAVAILABLE', error: errorText(error) }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    return new Response(
      JSON.stringify({ success: false, error: errorText(error) }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
};
}
if (import.meta.main) Deno.serve(createHandler());
