/** Reads Norsk Tipping's official API; source outages never overwrite yearly data. */
import { createClient } from 'npm:@supabase/supabase-js@2.112.4';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { requireAdminOrSecret } from '../_shared/adminAuth.ts';
import { SourceUnavailableError, readSource, sourceText, configuredClient, recordStatus, jsonResponse } from '../_shared/sourceAvailability.ts';

const STATS_URL = 'https://api.norsk-tipping.no/Charity/v1/api/statistics?orgId=996145530';

export function validateStatistics(data: unknown, year: number) {
  if (!data || typeof data !== 'object' || !('statistics' in data) || !Array.isArray(data.statistics) || data.statistics.length === 0) {
    throw new SourceUnavailableError('Empty or invalid Norsk Tipping payload');
  }
  if (!('id' in data) || data.id !== 996145530 || !('status' in data) || data.status !== 'ACTIVE') throw new SourceUnavailableError('Invalid recipient identity/status');
  const years = new Set<number>();
  for (const row of data.statistics) {
    if (!row || !Number.isInteger(row.year) || row.year < 2010 || row.year > year + 1 || years.has(row.year) ||
        typeof row.amount !== 'number' || !Number.isFinite(row.amount) || row.amount < 0 ||
        !Number.isInteger(row.numberOfPersons) || row.numberOfPersons < 0) {
      throw new SourceUnavailableError('Incomplete or invalid Norsk Tipping yearly statistics');
    }
    years.add(row.year);
  }
  if (!Array.from({ length: year - 2009 }, (_, i) => i + 2010).every(y => years.has(y))) throw new SourceUnavailableError('Current year missing from Norsk Tipping statistics');
  return data.statistics.map(row => ({ year: row.year, amount_nok: Math.round(row.amount * 100) / 100, num_supporters: row.numberOfPersons }))
    .filter(row => row.amount_nok > 0 || row.year === year);
}

export async function fetchStatistics(year: number, fetchImpl: typeof fetch = fetch, sleep?: (ms: number) => Promise<unknown>) {
  return await readSource(STATS_URL, async response => {
    const text = await sourceText(response);
    let data: unknown;
    try { data = JSON.parse(text); } catch (error) {
      if (error instanceof SyntaxError) throw new SourceUnavailableError('Invalid Norsk Tipping JSON');
      throw error;
    }
    return validateStatistics(data, year);
  }, fetchImpl, sleep);
}

export function createHandler(deps: any = {}) {
  return async (req: Request) => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
    let db: any;
    const now = (deps.now ?? (() => new Date()))();
    const stamp = now.toISOString();
    const year = Number(new Intl.DateTimeFormat('en', { timeZone: 'Europe/Oslo', year: 'numeric' }).format(now));
    async function status(ok: boolean, error: string | null, count = 0) {
      const row: Record<string, unknown> = { id: 1, last_attempt_at: stamp, last_error: error, updated_at: stamp };
      if (ok) row.last_success_at = stamp;
      const result = await db.from('grasrot_fetch_status').upsert(row);
      if (result.error) throw new Error(`Grasrot status write failed: ${result.error.message}`);
      await recordStatus(db, 'grasrot-scrape', ok, { error: error ?? undefined, count });
    }
    try {
      db = configuredClient(deps.env ?? ((key: string) => Deno.env.get(key)), deps.createClient ?? createClient);
      const unauth = await (deps.auth ?? requireAdminOrSecret)(req);
      if (unauth) return jsonResponse({ success: false, error: 'Unauthorized' }, corsHeaders, 401);
      const rows = await fetchStatistics(year, deps.fetch ?? fetch, deps.sleep);
      // All source rows are validated before the first yearly write.
      let count = 0;
      for (const row of rows) {
        const { data: existing, error: readError } = await db.from('grasrot_yearly')
          .select('id, amount_nok, num_supporters').eq('year', row.year).maybeSingle();
        if (readError) throw new Error(`Grasrot read failed: ${readError.message}`);
        const values = { ...row, is_confirmed: row.year < year, source_note: `Auto-oppdatert fra Norsk Tipping API ${stamp.split('T')[0]}`, updated_at: stamp };
        if (existing && Math.abs(Number(existing.amount_nok) - row.amount_nok) <= 0.01 && existing.num_supporters === row.num_supporters) continue;
        const result = existing ? await db.from('grasrot_yearly').update(values).eq('year', row.year) : await db.from('grasrot_yearly').insert(values);
        if (result.error) throw new Error(`Grasrot write failed: ${result.error.message}`);
        count++;
      }
      await status(true, null, count);
      return jsonResponse({ success: true, updated_count: count, data: rows }, corsHeaders);
    } catch (error) {
      console.error('[grasrot-scrape]', error);
      try { if (db) await status(false, String(error)); }
      catch (statusError) { return jsonResponse({ success: false, error: String(statusError) }, corsHeaders, 500); }
      if (error instanceof SourceUnavailableError) return jsonResponse({ success: false, source_unavailable: true, code: error.code, error: error.message }, corsHeaders);
      return jsonResponse({ success: false, error: String(error) }, corsHeaders, 500);
    }
  };
}
if (import.meta.main) Deno.serve(createHandler());
