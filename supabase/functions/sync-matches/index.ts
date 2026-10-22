import { createClient } from 'npm:@supabase/supabase-js@2.112.4';
import { requireAdminOrSecret } from '../_shared/adminAuth.ts';
import { osloWallTimeToIso } from '../_shared/osloWallTime.mjs';
import { readSportsSeason } from '../_shared/sportsSeason.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-sync-secret',
};

interface ParsedMatch {
  fiksId: string;
  homeTeam: string;
  awayTeam: string;
  venue: string;
  matchDate: string; // ISO
  competition: string;
  homeScore: number | null;
  awayScore: number | null;
  status: 'upcoming' | 'finished';
}

/** Unfold iCal lines (lines starting with whitespace continue the previous one). */
function unfoldIcal(text: string): string[] {
  const raw = text.split(/\r?\n/);
  const out: string[] = [];
  for (const l of raw) {
    if (/^[ \t]/.test(l) && out.length) {
      out[out.length - 1] += l.slice(1);
    } else {
      out.push(l);
    }
  }
  return out;
}

function parseIcalDate(value: string): string | null {
  // 20260408T201500 (local — TZID=Europe/Oslo) → treat as Oslo wall time
  const m = value.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})$/);
  if (!m) return null;
  const [, y, mo, d, h, mi, s] = m;
  return osloWallTimeToIso(`${y}-${mo}-${d}`, `${h}:${mi}:${s}`);
}

function parseIcal(text: string, ourTeamLabel: string): ParsedMatch[] {
  const lines = unfoldIcal(text);
  const events: ParsedMatch[] = [];
  let cur: Partial<ParsedMatch> & { _summary?: string; _desc?: string } | null = null;

  for (const line of lines) {
    if (line === 'BEGIN:VEVENT') { cur = {}; continue; }
    if (line === 'END:VEVENT') {
      if (cur && cur.fiksId && cur._summary) {
        // Parse "Home - Away" from summary
        const [home, away] = cur._summary.split(' - ').map(s => s.trim());
        if (home && away) {
          // Strip generic suffixes like "Menn Senior A"
          const clean = (s: string) =>
            s.replace(/\s+(Menn|Kvinner)\s+Senior\s+[A-Z]\d?$/i, '')
             .replace(/\s+Senior\s+[A-Z]\d?$/i, '')
             .trim();
          // Extract competition from description first line
          let competition = '';
          if (cur._desc) {
            const first = cur._desc.split('\\n')[0] || '';
            competition = first.replace(/\s*\(runde\s+\d+\)\s*$/i, '').trim();
          }
          events.push({
            fiksId: cur.fiksId,
            homeTeam: clean(home),
            awayTeam: clean(away),
            venue: cur.venue || '',
            matchDate: cur.matchDate || '',
            competition,
            homeScore: null,
            awayScore: null,
            status: 'upcoming',
          });
        }
      }
      cur = null;
      continue;
    }
    if (!cur) continue;

    if (line.startsWith('SUMMARY:')) cur._summary = line.slice(8);
    else if (line.startsWith('DESCRIPTION:')) cur._desc = line.slice(12);
    else if (line.startsWith('LOCATION:')) cur.venue = line.slice(9);
    else if (line.startsWith('URL:')) {
      const m = line.match(/fiksId=(\d+)/);
      if (m) cur.fiksId = m[1];
    }
    else if (line.startsWith('DTSTART')) {
      const v = line.split(':').slice(1).join(':');
      const iso = parseIcalDate(v);
      if (iso) cur.matchDate = iso;
    }
  }
  return events;
}

async function fetchResultFromMatchPage(fiksId: string): Promise<{ homeScore: number; awayScore: number } | null> {
  try {
    const response = await fetch(`https://www.fotball.no/fotballdata/kamp/?fiksId=${fiksId}`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
    });
    if (!response.ok) return null;
    const html = await response.text();
    // Restrict to the main match card. The page also lists head-to-head
    // history further down (inside <li class=atomicOneThirdWidth>...</li>),
    // so we must not let the regex fall through to those entries.
    const cutoff = html.search(/<li[^>]*class=["']?atomicOneThirdWidth/i);
    const haystack = cutoff > -1 ? html.slice(0, cutoff) : html;
    const scoreMatch = haystack.match(/<div[^>]*class="endResult"[^>]*>\s*(\d+)\s*-\s*(\d+)\s*<\/div>/i);
    if (!scoreMatch) return null;
    return { homeScore: parseInt(scoreMatch[1], 10), awayScore: parseInt(scoreMatch[2], 10) };
  } catch (error) {
    console.error(`[sync] Error fetching match page ${fiksId}:`, error);
    return null;
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const unauth = await requireAdminOrSecret(req);
  if (unauth) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    let teamsToSync: string[] | null = null;
    try {
      const body = await req.json();
      if (body?.teams) teamsToSync = body.teams;
    } catch { /* no body */ }

    const config=await readSportsSeason(supabase);
    const allTeams = config.teams.map(t=>({name:t.team,fiksId:t.team_id}));
    const teams = allTeams.filter(t=>!teamsToSync || teamsToSync.includes(t.name));
    const results: { team: string; updated: number; parsed: number; dbMatches: number }[] = [];

    for (const team of teams) {
      try {
        const url = `https://www.fotball.no/footballapi/Calendar/GetCalendar?teamId=${team.fiksId}`;
        console.log(`[sync] Fetching iCal for ${team.name}: ${url}`);
        const ical = await fetch(url, {
          headers: {
            'User-Agent': 'Mozilla/5.0',
            'Accept': 'text/calendar',
          },
        });
        if (!ical.ok) {
          console.error(`[sync] iCal fetch failed for ${team.name}: ${ical.status}`);
          results.push({ team: team.name, updated: 0, parsed: 0, dbMatches: 0 });
          continue;
        }
        const icalText = await ical.text();
        const parsedMatches = parseIcal(icalText, team.name);
        console.log(`[sync] Parsed ${parsedMatches.length} matches for ${team.name}`);

        for (const pm of parsedMatches.slice(0, 3)) {
          console.log(`[sync] ${pm.homeTeam} vs ${pm.awayTeam} @ ${pm.venue} ${pm.matchDate} (${pm.fiksId})`);
        }

        const { data: dbMatches, error: fetchError } = await supabase
          .from('matches')
          .select('id, opponent, match_date, fiks_id, home_score, away_score, status, venue, is_home, competition')
          .eq('team', team.name)
          .order('match_date', { ascending: true });
        if (fetchError) {
          console.error(`[sync] Error fetching matches:`, fetchError);
          continue;
        }

        let updatedCount = 0;
        const isFagerborg = (name: string) => name.toLowerCase().includes('fagerborg');

        for (const pm of parsedMatches) {
          const isHome = isFagerborg(pm.homeTeam);
          const opponent = isHome ? pm.awayTeam : pm.homeTeam;
          const dbMatch = dbMatches?.find(m => m.fiks_id === pm.fiksId);
          if (!dbMatch) continue;

          let homeScore = pm.homeScore;
          let awayScore = pm.awayScore;
          let status: string = pm.status;

          // For past matches, always fetch detail page to verify score.
          // Re-checking finished matches lets us self-heal if the wrong
          // score was stored earlier (and fotball.no later corrects it).
          // Stop re-checking after 14 days to limit detail-page requests.
          const matchTs = new Date(dbMatch.match_date).getTime();
          const ageDays = (Date.now() - matchTs) / 86_400_000;
          const shouldVerify = matchTs < Date.now()
            && (dbMatch.status !== 'finished' || ageDays < 14);
          if (shouldVerify) {
            const detailResult = await fetchResultFromMatchPage(pm.fiksId);
            if (detailResult) {
              homeScore = detailResult.homeScore;
              awayScore = detailResult.awayScore;
              status = 'finished';
              console.log(`[sync] Detail result: ${pm.homeTeam} ${homeScore}-${awayScore} ${pm.awayTeam} (${pm.fiksId})`);
            }
          }

          const updateData: Record<string, unknown> = {};
          if (pm.matchDate && dbMatch.match_date !== pm.matchDate) updateData.match_date=pm.matchDate;
          if (dbMatch.opponent !== opponent) updateData.opponent = opponent;
          if (dbMatch.is_home !== isHome) updateData.is_home = isHome;
          if (pm.venue && dbMatch.venue !== pm.venue) updateData.venue = pm.venue;
          if (pm.competition && dbMatch.competition !== pm.competition) updateData.competition = pm.competition;
          if (status === 'finished') {
            if (dbMatch.status !== 'finished' || dbMatch.home_score !== homeScore || dbMatch.away_score !== awayScore) {
              updateData.home_score = homeScore;
              updateData.away_score = awayScore;
              updateData.status = 'finished';
            }
          }

          if (Object.keys(updateData).length > 0) {
            const { error: updateError } = await supabase.from('matches').update(updateData).eq('id', dbMatch.id);
            if (updateError) console.error(`[sync] Update error for ${dbMatch.id}:`, updateError);
            else updatedCount++;
          }
        }

        results.push({
          team: team.name,
          updated: updatedCount,
          parsed: parsedMatches.length,
          dbMatches: dbMatches?.length || 0,
        });
      } catch (teamError) {
        console.error(`[sync] Error for ${team.name}:`, teamError);
        results.push({ team: team.name, updated: 0, parsed: 0, dbMatches: 0 });
      }
    }

    const totalUpdated = results.reduce((s, r) => s + r.updated, 0);
    const nowIso = new Date().toISOString();
    await supabase.from('sync_status').upsert({
      job_key: 'sync-matches',
      last_attempt_at: nowIso,
      last_success_at: nowIso,
      last_error: null,
      last_updated_count: totalUpdated,
      last_details: results,
      updated_at: nowIso,
    }, { onConflict: 'job_key' });

    return new Response(JSON.stringify({ success: true, results }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('[sync] Error:', error);
    try {
      const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
      const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
      const supabase = createClient(supabaseUrl, supabaseServiceKey);
      const now = new Date().toISOString();
      await supabase.from('sync_status').upsert({
        job_key: 'sync-matches',
        last_attempt_at: now,
        last_error: String(error),
        updated_at: now,
      }, { onConflict: 'job_key' });
    } catch { /* noop */ }
    return new Response(JSON.stringify({ success: false, error: String(error) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
