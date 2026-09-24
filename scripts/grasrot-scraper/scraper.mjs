/**
 * Grasrotandelen Scraper
 * 
 * Bruker Playwright for å scrape statistikk fra Norsk Tipping sin
 * Grasrotandelen-side (React SPA som krever JavaScript).
 * 
 * Kjøres via GitHub Actions ukentlig, eller manuelt.
 * 
 * Miljøvariabler:
 * - SUPABASE_URL: Supabase prosjekt-URL
 * - GRASROT_UPSERT_SECRET: Secret for autentisering mot edge function
 */

import { chromium } from 'playwright';

const GRASROT_URL = 'https://www.norsk-tipping.no/grasrotandelen/statistikk/iframe/996145530';
const FAGERBORG_ORG_NR = '996145530';

async function scrapeGrasrotData() {
  console.log('[Scraper] Starting Grasrotandelen scrape...');
  console.log(`[Scraper] URL: ${GRASROT_URL}`);
  
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  });
  const page = await context.newPage();

  try {
    // Navigate to page and wait for content
    await page.goto(GRASROT_URL, { waitUntil: 'networkidle', timeout: 60000 });
    console.log('[Scraper] Page loaded, waiting for React content...');
    
    // Wait for the statistics to render
    // The page structure may vary - these are common selectors to try
    await page.waitForTimeout(5000); // Give React time to hydrate
    
    // Take a screenshot for debugging
    await page.screenshot({ path: 'grasrot-page.png', fullPage: true });
    console.log('[Scraper] Screenshot saved to grasrot-page.png');
    
    // Get the page content for parsing
    const content = await page.content();
    console.log(`[Scraper] Page content length: ${content.length} chars`);
    
    // Try to find the data in various ways
    const rows = [];
    
    // Method 1: Look for table rows with year and amount
    const tableRows = await page.$$eval('table tr, .statistics-row, [class*="row"]', (elements) => {
      const data = [];
      for (const el of elements) {
        const text = el.textContent || '';
        // Look for year (20XX) and amount patterns
        const yearMatch = text.match(/20[12]\d/);
        const amountMatch = text.match(/[\d\s,]+(?:kr|NOK)?/i);
        if (yearMatch && amountMatch) {
          data.push({ text, year: yearMatch[0] });
        }
      }
      return data;
    });
    
    if (tableRows.length > 0) {
      console.log(`[Scraper] Found ${tableRows.length} potential data rows in tables`);
    }
    
    // Method 2: Look for specific text patterns in the page
    const allText = await page.evaluate(() => document.body.innerText);
    console.log('[Scraper] Page text (first 2000 chars):', allText.substring(0, 2000));
    
    // Parse amounts from text using regex
    // Format: "2024: 38 097 kr" or "38 097,00 kr (2024)"
    const yearAmountPattern = /(\d{4})[:\s]+([0-9\s]+(?:[,.]?\d{2})?)\s*(?:kr|NOK)/gi;
    const amountYearPattern = /([0-9\s]+(?:[,.]?\d{2})?)\s*(?:kr|NOK)[^\d]*(\d{4})/gi;
    
    let match;
    while ((match = yearAmountPattern.exec(allText)) !== null) {
      const year = parseInt(match[1]);
      const amountStr = match[2].replace(/\s/g, '').replace(',', '.');
      const amount = parseFloat(amountStr);
      if (year >= 2015 && year <= 2030 && amount > 0) {
        rows.push({ year, amount_nok: amount });
        console.log(`[Scraper] Found: ${year} = ${amount} NOK`);
      }
    }
    
    while ((match = amountYearPattern.exec(allText)) !== null) {
      const year = parseInt(match[2]);
      const amountStr = match[1].replace(/\s/g, '').replace(',', '.');
      const amount = parseFloat(amountStr);
      if (year >= 2015 && year <= 2030 && amount > 0) {
        // Avoid duplicates
        if (!rows.find(r => r.year === year)) {
          rows.push({ year, amount_nok: amount });
          console.log(`[Scraper] Found (alt pattern): ${year} = ${amount} NOK`);
        }
      }
    }
    
    // Method 3: Try to find data in script tags (preloaded state)
    const scriptData = await page.evaluate(() => {
      const scripts = Array.from(document.querySelectorAll('script'));
      for (const script of scripts) {
        const content = script.textContent || '';
        if (content.includes('__PRELOADED_STATE__') || content.includes('statistikk')) {
          return content.substring(0, 5000);
        }
      }
      return null;
    });
    
    if (scriptData) {
      console.log('[Scraper] Found script data:', scriptData.substring(0, 500));
    }
    
    await browser.close();
    
    if (rows.length === 0) {
      console.error('[Scraper] No data found! The page structure may have changed.');
      console.error('[Scraper] Please check the screenshot and update the selectors.');
      process.exit(1);
    }
    
    // Sort by year descending
    rows.sort((a, b) => b.year - a.year);
    
    console.log(`[Scraper] Successfully scraped ${rows.length} years of data`);
    return rows;
    
  } catch (error) {
    console.error('[Scraper] Error during scraping:', error);
    await page.screenshot({ path: 'grasrot-error.png', fullPage: true });
    await browser.close();
    throw error;
  }
}

async function postToSupabase(rows) {
  const supabaseUrl = process.env.SUPABASE_URL;
  const upsertSecret = process.env.GRASROT_UPSERT_SECRET;
  
  if (!supabaseUrl) {
    throw new Error('SUPABASE_URL environment variable is not set');
  }
  
  if (!upsertSecret) {
    throw new Error('GRASROT_UPSERT_SECRET environment variable is not set');
  }
  
  const endpoint = `${supabaseUrl}/functions/v1/grasrot-upsert`;
  console.log(`[Scraper] Posting ${rows.length} rows to ${endpoint}`);
  
  const payload = {
    source_url: GRASROT_URL,
    rows: rows,
  };
  
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-grasrot-secret': upsertSecret,
    },
    body: JSON.stringify(payload),
  });
  
  const result = await response.json();
  
  if (!response.ok) {
    console.error('[Scraper] API error:', response.status, result);
    throw new Error(`API returned ${response.status}: ${JSON.stringify(result)}`);
  }
  
  console.log('[Scraper] Successfully posted data:', result);
  return result;
}

async function main() {
  try {
    console.log('[Scraper] === Grasrotandelen Scraper ===');
    console.log(`[Scraper] Date: ${new Date().toISOString()}`);
    
    const rows = await scrapeGrasrotData();
    console.log('[Scraper] Scraped data:', JSON.stringify(rows, null, 2));
    
    const result = await postToSupabase(rows);
    console.log('[Scraper] === Complete ===');
    console.log(`[Scraper] Updated ${result.updated_count} rows`);
    
  } catch (error) {
    console.error('[Scraper] Fatal error:', error);
    process.exit(1);
  }
}

main();
