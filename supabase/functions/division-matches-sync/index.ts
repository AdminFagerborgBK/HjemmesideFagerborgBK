import { createClient } from 'npm:@supabase/supabase-js@2.112.4';
import { SourceUnavailableError, readSource, recordStatus, configuredClient } from '../_shared/sourceAvailability.ts';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
// @ts-ignore - npm specifier resolved at runtime
import * as XLSX from 'npm:xlsx@0.18.5';
import { requireAdminOrSecret } from '../_shared/adminAuth.ts';

const DIVISION_FIKS_ID = '205403';
const EXCEL_URL = `https://www.fotball.no/footballapi/Calendar/DownloadTournamentExcelCalendar?tournamentId=${DIVISION_FIKS_ID}`;

interface ParsedMatch {
  fiks_id: string;
  division_fiks_id: string;
  round_number: number | null;
  match_date: string;
  home_team: string;
  away_team: string;
  home_score: number | null;
  away_score: number | null;
  status: string;
  venue: string | null;
  match_url: string | null;
}

/**
 * Parse the official fotball.no Excel calendar.
 * Columns: Runde | Dato | Dag | Tid | Hjemmelag | Resultat | Bortelag | Bane | Turnering | Kampnummer | Spillform
 */
export function parseExcel(buffer: ArrayBuffer): ParsedMatch[] {
  // @ts-ignore
  const bytes = new Uint8Array(buffer);
  if (bytes[0] !== 80 || bytes[1] !== 75) throw new SourceUnavailableError('Not an XLSX/ZIP file');
  let wb;
  try { wb = XLSX.read(bytes, { type: 'array', cellDates: true }); }
  catch (error) {
    // Known decoder failures, not arbitrary exceptions from application code.
    if (error instanceof Error && /zip|file|xml|worksheet|unsupported|corrupt|bad|invalid|unrecognized|expected/i.test(error.message)) throw new SourceUnavailableError(`Invalid XLSX: ${error.message}`);
    throw error;
  }
  // @ts-ignore
  const ws = wb.Sheets[wb.SheetNames[0]];
  if (!ws) throw new SourceUnavailableError('Missing calendar worksheet');
  // @ts-ignore
  const rows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true });
  if (!ws || rows.length < 2 || !['Runde', 'Dato', 'Dag', 'Tid', 'Hjemmelag', 'Resultat', 'Bortelag', 'Bane', 'Turnering', 'Kampnummer'].every((v, i) => rows[0]?.[i] === v)) throw new SourceUnavailableError('Empty/invalid calendar headers');

  const out: ParsedMatch[] = [];
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.every(v => v == null || v === '')) continue;
    if (row.length < 10) throw new SourceUnavailableError('Incomplete calendar row');
    const [runde, dato, _dag, tid, hjemme, resultat, borte, bane, _turnering, kampnr] = row;
    if (!hjemme || !borte || !kampnr) throw new SourceUnavailableError('Missing team or match ID');

    if (!/^\d+$/.test(String(runde)) || !/^\d+$/.test(String(kampnr).trim()) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(String(tid))) throw new SourceUnavailableError('Invalid calendar round, ID or time');
    let matchDate: Date;
    if (dato instanceof Date) {
      // Excel gave us a date; combine with tid (HH:MM string)
      const tidStr = String(tid || '12:00');
      const [hh, mm] = tidStr.split(':').map((n) => parseInt(n));
      matchDate = new Date(Date.UTC(
        dato.getUTCFullYear(), dato.getUTCMonth(), dato.getUTCDate(),
        (hh || 12) - 2, mm || 0  // Oslo is UTC+2 in summer (CEST)
      ));
    } else {
      // Fallback: try to parse string
      matchDate = new Date(String(dato));
    }

    if (!Number.isFinite(matchDate.getTime())) throw new SourceUnavailableError('Invalid calendar date');
    let homeScore: number | null = null;
    let awayScore: number | null = null;
    let status = 'upcoming';
    if (resultat && String(resultat).trim() !== '-') {
      const rm = String(resultat).match(/(\d+)\s*-\s*(\d+)/);
      if (!rm) throw new SourceUnavailableError('Invalid calendar result');
      if (rm) {
        homeScore = parseInt(rm[1]);
        awayScore = parseInt(rm[2]);
        status = 'finished';
      }
    }

    out.push({
      fiks_id: String(kampnr).trim(),
      division_fiks_id: DIVISION_FIKS_ID,
      round_number: runde != null ? parseInt(String(runde)) : null,
      match_date: matchDate.toISOString(),
      home_team: String(hjemme).trim(),
      away_team: String(borte).trim(),
      home_score: homeScore,
      away_score: awayScore,
      status,
      venue: bane ? String(bane).trim() : null,
      match_url: null,
    });
  }

  const teams = new Set(out.flatMap(m => [m.home_team, m.away_team]));
  if (teams.size !== 12 || out.length !== 132 || new Set(out.map(m => m.fiks_id)).size !== out.length) throw new SourceUnavailableError('Incomplete or duplicate 2026 division calendar');
  const pairs = new Map<string, number>();
  for (const m of out) {
    if (m.home_team === m.away_team) throw new SourceUnavailableError('Invalid matchup');
    const key = JSON.stringify([m.home_team, m.away_team].sort());
    pairs.set(key, (pairs.get(key) ?? 0) + 1);
  }
  if (pairs.size !== 66 || [...pairs.values()].some(count => count !== 2)) throw new SourceUnavailableError('Incomplete division matchups');
  const dedup = new Map<string, ParsedMatch>();
  for (const m of out) dedup.set(m.fiks_id, m);
  return Array.from(dedup.values());
}

export function createHandler(deps: any = {}) {
return async (req: Request) => {
  const env = deps.env ?? ((key: string) => Deno.env.get(key));
  let supabase: any;
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
  supabase = configuredClient(env, deps.createClient ?? createClient);
  const unauth = await (deps.auth ?? requireAdminOrSecret)(req);
  if (unauth) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

    console.log(`[division-matches-sync] Fetching ${EXCEL_URL}`);
    const matches = await (deps.load ?? (() => readSource(EXCEL_URL, async res => {
      let buffer;
      try { buffer = await res.arrayBuffer(); } catch (error) {
        if (error instanceof TypeError || error instanceof DOMException) throw new SourceUnavailableError('Source body interrupted');
        throw error;
      }
      return parseExcel(buffer);
    })))();
    console.log(`[division-matches-sync] Parsed ${matches.length} matches`);

    const { error } = await supabase
      .from('division_matches')
      .upsert(matches, { onConflict: 'fiks_id' });

    if (error) {
      console.error('[division-matches-sync] Upsert error:', error);
      await recordStatus(supabase, 'division-matches-sync', false, { error: error.message });
      return new Response(JSON.stringify({ error: error.message, matches_preview: matches.slice(0, 3) }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    await recordStatus(supabase, 'division-matches-sync', true, { count: matches.length });
    return new Response(JSON.stringify({
      success: true,
      upserted: matches.length,
      sample: matches.slice(0, 3),
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('[division-matches-sync] Error:', err);
    const source = err instanceof SourceUnavailableError;
    try { if (supabase) await recordStatus(supabase, 'division-matches-sync', false, { error: String(err) }); }
    catch (statusError) { return new Response(JSON.stringify({ success: false, error: String(statusError) }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }); }
    if (source) return new Response(JSON.stringify({ success: false, source_unavailable: true, code: 'SOURCE_UNAVAILABLE', error: String(err) }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
};
}
if (import.meta.main) Deno.serve(createHandler());
