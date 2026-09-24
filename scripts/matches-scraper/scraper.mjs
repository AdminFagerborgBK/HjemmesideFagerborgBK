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

import { chromium } from 'playwright';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';


const TEAMS = [
  { name: 'A-laget', fiksId: '311' },
  { name: 'B-laget', fiksId: '6458' },
];

async function scrapeTeamMatches(page, team) {
  // Use /hjem/ page which shows ALL matches (league + NM/cup) in one table
  const url = `https://www.fotball.no/fotballdata/lag/hjem/?fiksId=${team.fiksId}`;
  console.log(`[Scraper] Scraping ${team.name} from ${url}`);
  
  await page.goto(url, { waitUntil: 'networkidle', timeout: 60000 });
  await page.waitForTimeout(3000);
  
  await page.screenshot({ path: `matches-${team.fiksId}.png`, fullPage: true });
  
  // Parse the structured "Alle kamper" table
  const matches = await page.evaluate(() => {
    const rows = [];
    
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
        if (cells.length < Math.max(hjemmeIdx, borteIdx) + 1) continue;
        
        // Extract date from link text (DD.MM.YYYY)
        const datoCell = datoIdx >= 0 ? cells[datoIdx] : null;
        const dateText = datoCell?.textContent?.trim() || '';
        const dateMatch = dateText.match(/(\d{2}\.\d{2}\.\d{4})/);
        if (!dateMatch) continue;
        
        // Extract time
        const tidCell = tidIdx >= 0 ? cells[tidIdx] : null;
        const timeText = tidCell?.textContent?.trim() || '';
        const timeMatch = timeText.match(/(\d{2}:\d{2})/);
        if (!timeMatch) continue;
        
        // Extract team names from link text
        const homeTeam = cells[hjemmeIdx]?.textContent?.trim() || '';
        const awayTeam = cells[borteIdx]?.textContent?.trim() || '';
        if (!homeTeam || !awayTeam) continue;
        
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
        
        if (!matchFiksId) continue;
        
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
    
    return rows;
  });
  
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

async function postToSupabase(matches) {
  const supabaseUrl = process.env.SUPABASE_URL;
  const syncSecret = process.env.MATCHES_SYNC_SECRET;
  
  if (!supabaseUrl) {
    throw new Error('SUPABASE_URL environment variable is not set');
  }
  
  if (!syncSecret) {
    throw new Error('MATCHES_SYNC_SECRET environment variable is not set');
  }
  
  const endpoint = `${supabaseUrl}/functions/v1/matches-upsert`;
  console.log(`[Scraper] Posting ${matches.length} matches to ${endpoint}`);
  
  const response = await fetch(endpoint, {
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
  
  console.log('[Scraper] Successfully posted data:', result);
  return result;
}

/**
 * Only contact the backend when the scraped data actually differs from the
 * previous run. The previous fingerprint is restored/saved by GitHub Actions.
 */
const FINGERPRINT_FILE = process.env.FINGERPRINT_FILE || 'fingerprint.txt';

function fingerprint(matches) {
  const normalised = [...matches]
    .map((m) => JSON.stringify(m, Object.keys(m).sort()))
    .sort()
    .join('\n');
  return createHash('sha256').update(normalised).digest('hex');
}

function readPreviousFingerprint() {
  try {
    return readFileSync(FINGERPRINT_FILE, 'utf8').trim();
  } catch {
    return null;
  }
}

async function main() {
  try {
    console.log('[Scraper] === Matches Scraper ===');
    console.log(`[Scraper] Date: ${new Date().toISOString()}`);

    const matches = await scrapeAllTeams();
    console.log('[Scraper] Scraped matches:', JSON.stringify(matches.slice(0, 5), null, 2), '...');

    const hash = fingerprint(matches);
    const previous = readPreviousFingerprint();

    if (matches.length > 0 && previous === hash && process.env.FORCE_SYNC !== 'true') {
      console.log('[Scraper] Source data unchanged — skipping backend sync.');
      console.log('[Scraper] === Complete (no change) ===');
      return;
    }

    const result = await postToSupabase(matches);
    if (matches.length > 0) {
      writeFileSync(FINGERPRINT_FILE, hash);
    }
    console.log('[Scraper] === Complete ===');
    console.log(`[Scraper] Updated ${result.updated_count || matches.length} matches`);

  } catch (error) {
    console.error('[Scraper] Fatal error:', error);
    process.exit(1);
  }
}


main();
