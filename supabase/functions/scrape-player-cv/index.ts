import { requireAdminOrSecret } from '../_shared/adminAuth.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-sync-secret',
};

function isAllowedHost(raw: string, allowedHosts: string[]): URL | null {
  let u: URL;
  try { u = new URL(raw); } catch { return null; }
  if (u.protocol !== 'https:' && u.protocol !== 'http:') return null;
  const host = u.hostname.toLowerCase();
  if (!allowedHosts.some(h => host === h || host.endsWith('.' + h))) return null;
  return u;
}

interface CareerEntry {
  club: string;
  seasons: string;
  appearances: number;
  goals: number;
  division?: string;
}

const SENIOR_CATEGORIES = ['voksen', 'senior', 'a-lag', 'topp'];

function isSeniorCategory(category: string): boolean {
  const lower = category.toLowerCase().trim();
  if (!lower) return false;
  return SENIOR_CATEGORIES.some(s => lower.includes(s));
}

function isFutsalTeam(team: string): boolean {
  return team.toLowerCase().includes('futsal');
}

function normalizeDivision(div: string): string {
  if (!div) return div;
  const m = div.match(/^(\d+)\.?\s*(?:divisjon|div\.?\s*(?:avd\.?\s*\d+)?)/i);
  if (m) return `${m[1]}. div.`;
  return div;
}

function normalizeTeamName(name: string): string {
  return name
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/\s*(Fotball|Fotb\.|FK|IL|IF|BK|SK|Idrettslag|Idrettsforening|Ballklubb|Sportsforening|Sportsklubb)\s*/gi, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ').replace(/&oslash;/g, 'ø').replace(/&Oslash;/g, 'Ø')
    .replace(/&aelig;/g, 'æ').replace(/&AElig;/g, 'Æ').replace(/&aring;/g, 'å').replace(/&Aring;/g, 'Å')
    .replace(/&ouml;/g, 'ö').replace(/&uuml;/g, 'ü').replace(/&auml;/g, 'ä')
    .replace(/&quot;/g, '"').replace(/&apos;/g, "'");
}

function decodeCells(rowHtml: string): string[] {
  const cells: string[] = [];
  const cellRe = /<td[^>]*>([\s\S]*?)<\/td>/gi;
  let cellMatch;
  while ((cellMatch = cellRe.exec(rowHtml)) !== null) {
    cells.push(decodeHtmlEntities(cellMatch[1].replace(/<[^>]*>/g, '').trim()));
  }
  return cells;
}

// Build a map: normalizedTeamName -> array of { division, totalApps }
// A team can appear in multiple divisions (e.g. promotions/relegations)
function parseTeamDivisionsFromHtml(html: string): Map<string, { division: string; totalApps: number }[]> {
  const result = new Map<string, { division: string; totalApps: number }[]>();

  const tournamentSection = html.match(/Turneringsstatistikk[\s\S]*?(<table[\s\S]*?<\/table>)/i);
  if (!tournamentSection) return result;

  const tableHtml = tournamentSection[1];
  const rowRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  const skipCategories = ['futsal', 'gutter', 'g19', 'g16', 'g15', 'g14', 'g13', 'jenter', 'j19', 'j16', 'ungdom', 'sluttspill'];

  let rowMatch;
  while ((rowMatch = rowRegex.exec(tableHtml)) !== null) {
    const cells = decodeCells(rowMatch[1]);
    if (cells.length < 3) continue;

    const category = cells[0].trim();
    const teamsCell = cells[1].trim();

    const catLower = category.toLowerCase();
    if (skipCategories.some(s => catLower.includes(s))) continue;
    if (catLower.includes('futsal')) continue;
    // Skip NM/cup categories - they don't represent league division
    if (catLower.startsWith('nm')) continue;

    let division = category
      .replace(/\s*(Menn|Kvinner|Herrer)\s*(og høyere)?/gi, '')
      .trim();
    division = normalizeDivision(division);

    // Extract team names and their match counts from "TeamName (count), ..." format
    const teamMatches = teamsCell.match(/([^,(]+?)\s*\((\d+)\)/g);
    if (teamMatches) {
      for (const tm of teamMatches) {
        const nameMatch = tm.match(/(.+?)\s*\((\d+)\)/);
        if (!nameMatch) continue;
        const teamName = nameMatch[1].trim();
        const apps = parseInt(nameMatch[2]) || 0;
        const normalized = normalizeTeamName(teamName);

        if (!result.has(normalized)) {
          result.set(normalized, []);
        }
        const entries = result.get(normalized)!;
        // Check if this division already exists for this team
        const existing = entries.find(e => e.division === division);
        if (existing) {
          existing.totalApps += apps;
        } else {
          entries.push({ division, totalApps: apps });
        }
      }
    }
  }

  return result;
}

function parseCareerFromHtml(html: string): CareerEntry[] {
  const teamDivisions = parseTeamDivisionsFromHtml(html);

  let seasonTable = '';
  const sectionRegex = /Sesongstatistikk[\s\S]*?(<table[\s\S]*?<\/table>)/i;
  const sectionMatch = html.match(sectionRegex);
  if (sectionMatch) {
    seasonTable = sectionMatch[1];
  }
  if (!seasonTable) return [];

  const rowRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;

  // Collect raw season entries
  const rawEntries: { year: number; team: string; normalized: string; appearances: number; goals: number }[] = [];

  let rowMatch;
  while ((rowMatch = rowRegex.exec(seasonTable)) !== null) {
    const cells = decodeCells(rowMatch[1]);
    if (cells.length < 5) continue;

    const season = cells[0];
    const team = cells[1];
    const ageCategory = cells[2] || '';
    const appearances = parseInt(cells[3]) || 0;
    const goals = parseInt(cells[4]) || 0;

    const isFutsal = season.toLowerCase().includes('futsal') ||
                     isFutsalTeam(team) ||
                     ageCategory.toLowerCase().includes('futsal');
    if (!team || !season || isFutsal || !isSeniorCategory(ageCategory)) continue;

    const yearMatch = season.match(/(\d{4})/);
    if (!yearMatch) continue;
    const year = parseInt(yearMatch[1]);

    rawEntries.push({
      year,
      team: team.trim(),
      normalized: normalizeTeamName(team.trim()),
      appearances,
      goals,
    });
  }

  // For each team, check if it has multiple divisions in the tournament table.
  // If so, we need to figure out which seasons belong to which division.
  // 
  // Strategy: For a team with divisions [4. div (44 apps), 5. div (18 apps)],
  // sort season entries by year descending, and greedily assign to divisions
  // based on typical promotion/relegation patterns (higher division = more recent).
  // 
  // Better strategy: use cumulative match counts. Sort seasons by year desc.
  // The tournament table gives total apps per division. Walk through seasons
  // and assign to the highest division first until its quota is filled.
  
  // Group raw entries by normalized team
  const teamSeasons = new Map<string, typeof rawEntries>();
  for (const entry of rawEntries) {
    if (!teamSeasons.has(entry.normalized)) {
      teamSeasons.set(entry.normalized, []);
    }
    teamSeasons.get(entry.normalized)!.push(entry);
  }

  // For each team, assign divisions to seasons
  const assignedEntries: (typeof rawEntries[0] & { division?: string })[] = [];

  for (const [normalized, seasons] of teamSeasons) {
    const divs = teamDivisions.get(normalized);
    
    if (!divs || divs.length === 0) {
      // No division info - add without division
      for (const s of seasons) {
        assignedEntries.push({ ...s });
      }
      continue;
    }

    if (divs.length === 1) {
      // Single division - simple case
      for (const s of seasons) {
        assignedEntries.push({ ...s, division: divs[0].division });
      }
      continue;
    }

    // Multiple divisions! Sort divisions by level (lower number = higher division)
    const sortedDivs = [...divs].sort((a, b) => {
      const numA = parseInt(a.division) || 99;
      const numB = parseInt(b.division) || 99;
      return numA - numB;
    });

    // Sort seasons by year descending (most recent first)
    const sortedSeasons = [...seasons].sort((a, b) => b.year - a.year);

    // Assign seasons to divisions using remaining quota approach
    // Most recent seasons likely belong to the highest (lowest number) division
    const divQuotas = sortedDivs.map(d => ({ ...d, remaining: d.totalApps }));

    for (const s of sortedSeasons) {
      let assigned = false;
      // Try to assign to a division that still has remaining quota
      for (const dq of divQuotas) {
        if (dq.remaining >= s.appearances) {
          assignedEntries.push({ ...s, division: dq.division });
          dq.remaining -= s.appearances;
          assigned = true;
          break;
        }
      }
      if (!assigned) {
        // If no exact fit, assign to the one with most remaining
        const best = divQuotas.reduce((a, b) => a.remaining >= b.remaining ? a : b);
        assignedEntries.push({ ...s, division: best.division });
        best.remaining -= s.appearances;
      }
    }
  }

  // Now group by normalized team + division
  const clubDivMap = new Map<string, {
    displayName: string;
    division: string | undefined;
    years: Set<number>;
    appearances: number;
    goals: number;
  }>();

  for (const entry of assignedEntries) {
    const key = `${entry.normalized}::${entry.division || ''}`;
    const existing = clubDivMap.get(key);
    if (existing) {
      existing.years.add(entry.year);
      existing.appearances += entry.appearances;
      existing.goals += entry.goals;
      if (entry.team.length < existing.displayName.length) {
        existing.displayName = entry.team;
      }
    } else {
      clubDivMap.set(key, {
        displayName: entry.team,
        division: entry.division,
        years: new Set([entry.year]),
        appearances: entry.appearances,
        goals: entry.goals,
      });
    }
  }

  const result: CareerEntry[] = [];
  for (const [, data] of clubDivMap) {
    const sortedYears = [...data.years].sort((a, b) => a - b);

    let seasons: string;
    if (sortedYears.length === 1) {
      seasons = String(sortedYears[0]);
    } else {
      const ranges: string[] = [];
      let rangeStart = sortedYears[0];
      let prev = sortedYears[0];
      for (let i = 1; i <= sortedYears.length; i++) {
        const curr = sortedYears[i];
        if (curr === prev + 1) {
          prev = curr;
        } else {
          ranges.push(rangeStart === prev ? String(rangeStart) : `${rangeStart}–${prev}`);
          rangeStart = curr;
          prev = curr;
        }
      }
      seasons = ranges.join(', ');
    }

    result.push({
      club: data.displayName,
      seasons,
      appearances: data.appearances,
      goals: data.goals,
      division: data.division,
    });
  }

  result.sort((a, b) => {
    const yearA = parseInt(a.seasons.split('–').pop()?.split(',').pop()?.trim() || '0');
    const yearB = parseInt(b.seasons.split('–').pop()?.split(',').pop()?.trim() || '0');
    return yearB - yearA;
  });

  return result;
}

function extractPlayerName(html: string): string | null {
  const match = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
  if (match) {
    return decodeHtmlEntities(match[1].replace(/<[^>]*>/g, '').trim());
  }
  return null;
}

function extractBirthDateFromNifs(html: string): string | null {
  const match = html.match(/F[øo]dselsdato:[\s\S]*?(\d{4}-\d{2}-\d{2})/i);
  if (match) return match[1];
  return null;
}

function extractNameFromNifs(html: string): string | null {
  const match = html.match(/Navn:<\/div>\s*<div[^>]*>\s*([\s\S]*?)\s*<\/div>/i);
  if (match) {
    const name = match[1].replace(/<[^>]*>/g, '').trim();
    if (name) return name;
  }
  return null;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const unauth = await requireAdminOrSecret(req);
    if (unauth) return new Response(unauth.body, { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    const { url, nifs_url } = await req.json();

    if (nifs_url) {
      const nifsTarget = isAllowedHost(nifs_url, ['nifs.no']);
      if (!nifsTarget) {
        return new Response(
          JSON.stringify({ success: false, error: 'Ugyldig nifs.no URL' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.log('Fetching birth date from nifs.no:', nifsTarget.toString());
      const nifsResponse = await fetch(nifsTarget.toString(), {
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; FagerborgBK/1.0)', 'Accept': 'text/html' },
      });

      if (!nifsResponse.ok) {
        return new Response(
          JSON.stringify({ success: false, error: `Kunne ikke hente nifs-profil (${nifsResponse.status})` }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const nifsHtml = await nifsResponse.text();
      const birthDate = extractBirthDateFromNifs(nifsHtml);
      const nifsName = extractNameFromNifs(nifsHtml);

      return new Response(
        JSON.stringify({ success: true, data: { birth_date: birthDate, name: nifsName } }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const target = url ? isAllowedHost(url, ['fotball.no']) : null;
    if (!target) {
      return new Response(
        JSON.stringify({ success: false, error: 'Ugyldig fotball.no URL' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!target.searchParams.has('underside')) {
      target.searchParams.set('underside', 'statistikk');
    }
    const fetchUrl = target.toString();

    console.log('Fetching player CV from:', fetchUrl);

    const response = await fetch(fetchUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; FagerborgBK/1.0)', 'Accept': 'text/html' },
    });

    if (!response.ok) {
      return new Response(
        JSON.stringify({ success: false, error: `Kunne ikke hente profil (${response.status})` }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const html = await response.text();
    const career = parseCareerFromHtml(html);
    const name = extractPlayerName(html);

    console.log(`Parsed ${career.length} career entries for ${name}`);

    return new Response(
      JSON.stringify({ success: true, data: { name, career } }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error scraping player CV:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
