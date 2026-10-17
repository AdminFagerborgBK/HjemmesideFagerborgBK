/**
 * Fotball.no Matches Scraper
 * 
 * Uses Playwright to scrape match fixtures from fotball.no team pages
 * (React SPA that requires JavaScript rendering).
 * 
 * The /hjem/ page shows ALL matches including league and cup (NM),
 * with a structured HTML table under "Alle kamper".
 * 
 * Runs via GitHub Actions daily, or manually.
 * 
 * Environment variables:
 * - SUPABASE_URL: Supabase project URL
 * - MATCHES_SYNC_SECRET: Secret for authentication to edge function
 */

import { createHash } from 'node:crypto';
import { appendFileSync, readFileSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';


const TEAMS = [
  { name: 'A-laget', fiksId: '311' },
  { name: 'B-laget', fiksId: '6458' },
];

const MAX_ATTEMPTS = 3;
const RETRY_DELAY_MS = 5000;

export class SourceUnavailableError extends Error {
  constructor(message, options) {
    super(message, options);
    this.name = 'SourceUnavailableError';
    this.code = 'SOURCE_UNAVAILABLE';
  }
}

function isSourceFailure(error) {
  return error instanceof SourceUnavailableError ||
    error?.name === 'TimeoutError' ||
    (error instanceof Error && /^page\.goto: net::ERR_/.test(error.message));
}

export async function loadTeamPage(page, team, readMatches = async () => undefined) {
  const url = `https://www.fotball.no/fotballdata/lag/hjem/?fiksId=${team.fiksId}`;
  console.log(`[Scraper] Scraping ${team.name} from ${url}`);
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const response = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
      if (response && !response.ok()) {
        throw new SourceUnavailableError(`fotball.no returned HTTP ${response.status()}`);
      }
      // Wait for the "Alle kamper" table (Hjemmelag/Bortelag headers) instead of
      // networkidle, which can hang forever on pages with persistent requests.
      // state: 'attached' — the match table can be in the DOM but hidden until its tab renders
      await page.waitForSelector('table', { state: 'attached', timeout: 30000 });
      await page.waitForFunction(() => {
        return Array.from(document.querySelectorAll('table')).some((t) => {
          const txt = (t.textContent || '').toLowerCase();
          return txt.includes('hjemmelag') && txt.includes('bortelag');
        });
      }, undefined, { timeout: 30000 });
      await page.waitForTimeout(1500);
      return await readMatches();
    } catch (err) {
      if (!isSourceFailure(err)) throw err;
      console.error(`[Scraper] ${team.name} attempt ${attempt}/${MAX_ATTEMPTS} failed: ${err.message}`);
      if (attempt < MAX_ATTEMPTS) {
        await page.waitForTimeout(RETRY_DELAY_MS);
      } else {
        await page.screenshot({ path: `matches-${team.fiksId}-error.png`, fullPage: true }).catch(() => {});
        throw new SourceUnavailableError(`${team.name}: fotball.no unavailable after ${MAX_ATTEMPTS} attempts: ${err.message}`, { cause: err });
      }
    }
  }
}

async function scrapeTeamMatches(page, team) {
  // Use /hjem/ page which shows ALL matches (league + NM/cup) in one table
  const matches = await loadTeamPage(page, team, async () => {
  
  // Parse the structured "Alle kamper" table
  const rows = await page.evaluate(() => {
    const rows = [];
    let incomplete = false;
    
    // Find all tables on the page - the "Alle kamper" section has a full table
    // with columns: Dato, Dag, Tid, Hjemmelag, Resultat, Bortelag, Bane, Turnering, Kampnr, Spillform
    const tables = document.querySelectorAll('table');
    
    for (const table of tables) {
      const headerRow = table.querySelector('thead tr, tr:first-child');
      if (!headerRow) continue;
      
      const headers = Array.from(headerRow.querySelectorAll('th, td')).map(h => h.textContent?.trim().toLowerCase() || '');
      
      // Look for the table that has "hjemmelag" and "bortelag" columns
      const hjemmeIdx = headers.findIndex(h => h.includes('hjemmelag'));
      const borteIdx = headers.findIndex(h => h.includes('bortelag'));
      const datoIdx = headers.findIndex(h => h.includes('dato'));
      const tidIdx = headers.findIndex(h => h.includes('tid'));
      const baneIdx = headers.findIndex(h => h.includes('bane'));
      const turneringIdx = headers.findIndex(h => h.includes('turnering'));
      const kampnrIdx = headers.findIndex(h => h.includes('kampnr'));
      const resultatIdx = headers.findIndex(h => h.includes('resultat'));
      
      if (hjemmeIdx === -1 || borteIdx === -1) continue;
      
      // Found the right table, parse body rows
      const bodyRows = table.querySelectorAll('tbody tr');
      
      for (const row of bodyRows) {
        const cells = row.querySelectorAll('td');
        if (cells.length < Math.max(hjemmeIdx, borteIdx) + 1) { incomplete = true; continue; }
        
        // Extract date from link text (DD.MM.YYYY)
        const datoCell = datoIdx >= 0 ? cells[datoIdx] : null;
        const dateText = datoCell?.textContent?.trim() || '';
        const dateMatch = dateText.match(/(\d{2}\.\d{2}\.\d{4})/);
        if (!dateMatch) { incomplete = true; continue; }
        
        // Extract time
        const tidCell = tidIdx >= 0 ? cells[tidIdx] : null;
        const timeText = tidCell?.textContent?.trim() || '';
        const timeMatch = timeText.match(/(\d{2}:\d{2})/);
        if (!timeMatch) { incomplete = true; continue; }
        
        // Extract team names from link text
        const homeTeam = cells[hjemmeIdx]?.textContent?.trim() || '';
        const awayTeam = cells[borteIdx]?.textContent?.trim() || '';
        if (!homeTeam || !awayTeam) { incomplete = true; continue; }
        
        // Extract venue
        const venue = baneIdx >= 0 ? (cells[baneIdx]?.textContent?.trim() || 'Ukjent') : 'Ukjent';
        
        // Extract competition/turnering
        const competition = turneringIdx >= 0 ? (cells[turneringIdx]?.textContent?.trim() || '') : '';
        
        // Extract fiksId from match detail link
        let matchFiksId = null;
        const allLinks = row.querySelectorAll('a');
        for (const link of allLinks) {
          const href = link.getAttribute('href') || '';
          const fiksMatch = href.match(/\/fotballdata\/kamp\/\?fiksId=(\d+)/);
          if (fiksMatch) {
            matchFiksId = fiksMatch[1];
            break;
          }
        }
        
        // Fallback: try kampnr cell
        if (!matchFiksId && kampnrIdx >= 0) {
          const kampNrText = cells[kampnrIdx]?.textContent?.trim() || '';
          // kampNr is the 11-digit number, but we prefer fiksId from links
          const kampNrLink = cells[kampnrIdx]?.querySelector('a');
          if (kampNrLink) {
            const href = kampNrLink.getAttribute('href') || '';
            const fiksMatch = href.match(/\/fotballdata\/kamp\/\?fiksId=(\d+)/);
            if (fiksMatch) matchFiksId = fiksMatch[1];
          }
        }
        
        if (!matchFiksId) { incomplete = true; continue; }
        
        // Parse result
        const resultatText = resultatIdx >= 0 ? (cells[resultatIdx]?.textContent?.trim() || '') : '';
        let homeScore = null;
        let awayScore = null;
        let status = 'upcoming';
        
        const resultMatch = resultatText.match(/(\d+)\s*-\s*(\d+)/);
        if (resultMatch) {
          homeScore = parseInt(resultMatch[1]);
          awayScore = parseInt(resultMatch[2]);
          status = 'finished';
        }
        
        // Determine if Fagerborg is home
        const isFagerborg = (name) => name.toLowerCase().includes('fagerborg');
        const isHome = isFagerborg(homeTeam);
        const opponent = isHome ? awayTeam : homeTeam;
        
        rows.push({
          date: dateMatch[1],
          time: timeMatch[1],
          homeTeam,
          awayTeam,
          venue,
          competition,
          kampNr: matchFiksId,
          isHome,
          opponent,
          homeScore,
          awayScore,
          status,
        });
      }
      
      // We found and parsed the right table, no need to check others
      if (rows.length > 0) break;
    }
    
    return { rows, incomplete };
  });
  if (rows.incomplete || rows.rows.length === 0) {
    throw new SourceUnavailableError(`${team.name}: fotball.no returned empty or incomplete match data`);
  }
  for (const match of rows.rows) {
    const [day, month, year] = match.date.split('.');
    if (!Number.isFinite(new Date(`${year}-${month}-${day}T${match.time}:00+02:00`).getTime())) {
      throw new SourceUnavailableError(`${team.name}: fotball.no returned an invalid match date`);
    }
  }
  return rows.rows;
  });

  await page.screenshot({ path: `matches-${team.fiksId}.png`, fullPage: true });
  
  console.log(`[Scraper] Found ${matches.length} matches for ${team.name}`);
  
  return matches.map(m => {
    const [day, month, year] = m.date.split('.');
    // CEST/CET timezone offset
    const matchDate = new Date(`${year}-${month}-${day}T${m.time}:00+02:00`);
    
    return {
      team: team.name,
      opponent: m.opponent,
      match_date: matchDate.toISOString(),
      venue: m.venue,
      is_home: m.isHome,
      home_score: m.homeScore,
      away_score: m.awayScore,
      competition: m.competition,
      status: m.status,
      fiks_id: m.kampNr,
    };
  });
}

async function scrapeAllTeams() {
  console.log('[Scraper] Starting matches scrape...');
  
  const { chromium } = await import('playwright');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  });
  const page = await context.newPage();
  
  const allMatches = [];
  
  try {
    for (const team of TEAMS) {
      const matches = await scrapeTeamMatches(page, team);
      allMatches.push(...matches);
    }
  } finally {
    await browser.close();
  }
  
  console.log(`[Scraper] Total matches scraped: ${allMatches.length}`);
  return allMatches;
}

function validateConfig(env) {
  const supabaseUrl = env.SUPABASE_PROJECT_URL || env.SUPABASE_URL;
  const syncSecret = env.MATCHES_SYNC_SECRET;
  
  if (!supabaseUrl) {
    throw new Error('SUPABASE_PROJECT_URL / SUPABASE_URL environment variable is not set');
  }
  
  if (!syncSecret) {
    throw new Error('MATCHES_SYNC_SECRET environment variable is not set');
  }
  const parsed = new URL(supabaseUrl);
  if (!['https:', 'http:'].includes(parsed.protocol)) throw new Error('Invalid backend URL');
  return { supabaseUrl, syncSecret };
}

export async function postToSupabase(matches, env = process.env, fetchImpl = fetch) {
  const { supabaseUrl, syncSecret } = validateConfig(env);
  
  const endpoint = `${supabaseUrl}/functions/v1/matches-upsert`;
  console.log(`[Scraper] Posting ${matches.length} matches to ${endpoint}`);
  
  const response = await fetchImpl(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-matches-secret': syncSecret,
    },
    body: JSON.stringify({ matches }),
  });
  
  const result = await response.json();
  
  if (!response.ok) {
    console.error('[Scraper] API error:', response.status, result);
    throw new Error(`API returned ${response.status}: ${JSON.stringify(result)}`);
  }
  if (result.success === false || result.error_count > 0) {
    throw new Error(`Backend sync failed or partially failed: ${JSON.stringify(result)}`);
  }
  
  console.log('[Scraper] Successfully posted data:', result);
  return result;
}

/**
 * Only contact the backend when the scraped data actually differs from the
 * previous run. The previous fingerprint is restored/saved by GitHub Actions.
 */
const FINGERPRINT_FILE = process.env.FINGERPRINT_FILE || 'fingerprint.txt';

export function fingerprint(matches) {
  const normalised = [...matches]
    .map((m) => JSON.stringify(m, Object.keys(m).sort()))
    .sort()
    .join('\n');
  return createHash('sha256').update(normalised).digest('hex');
}

function readPreviousFingerprint(file) {
  try {
    return readFileSync(file, 'utf8').trim();
  } catch (error) {
    if (error.code === 'ENOENT') return null;
    throw error;
  }
}

export async function main({ env = process.env, scrape = scrapeAllTeams, fetchImpl = fetch,
  fingerprintFile = env.FINGERPRINT_FILE || FINGERPRINT_FILE } = {}) {
  const output = (name, value) => {
    if (env.GITHUB_OUTPUT) appendFileSync(env.GITHUB_OUTPUT, `${name}=${value}\n`);
  };
  try {
    output('scrape_success', 'false');
    output('source_unavailable', 'false');
    validateConfig(env);
    console.log('[Scraper] === Matches Scraper ===');
    console.log(`[Scraper] Date: ${new Date().toISOString()}`);

    const matches = await scrape();
    if (matches.length === 0) throw new SourceUnavailableError('fotball.no returned no matches');
    console.log('[Scraper] Scraped matches:', JSON.stringify(matches.slice(0, 5), null, 2), '...');

    const hash = fingerprint(matches);
    const previous = readPreviousFingerprint(fingerprintFile);

    if (previous === hash && env.FORCE_SYNC !== 'true') {
      console.log('[Scraper] Source data unchanged — skipping backend sync.');
      console.log('[Scraper] === Complete (no change) ===');
      output('scrape_success', 'true');
      return 0;
    }

    const result = await postToSupabase(matches, env, fetchImpl);
    if (matches.length > 0) {
      writeFileSync(fingerprintFile, hash);
    }
    output('scrape_success', 'true');
    console.log('[Scraper] === Complete ===');
    console.log(`[Scraper] Updated ${result.updated_count || matches.length} matches`);
    return 0;

  } catch (error) {
    if (error instanceof SourceUnavailableError) {
      output('source_unavailable', 'true');
      const message = error.message.replace(/%/g, '%25').replace(/\r/g, '%0D').replace(/\n/g, '%0A');
      console.warn(`::warning title=SOURCE_UNAVAILABLE::${message}. Existing match data and fingerprint retained; next hourly run will retry.`);
      return 0;
    }
    console.error('[Scraper] Fatal error:', error);
    return 1;
  }
}


if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exitCode = await main();
}
