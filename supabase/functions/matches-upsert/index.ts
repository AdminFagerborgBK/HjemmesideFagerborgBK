import { createClient } from 'npm:@supabase/supabase-js@2.112.4';
import { recordSyncStatus } from '../_shared/syncStatus.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-matches-secret',
};

async function fetchResultFromMatchPage(fiksId: string): Promise<{ homeScore: number; awayScore: number } | null> {
  try {
    const res = await fetch(`https://www.fotball.no/fotballdata/kamp/?fiksId=${fiksId}`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
    });
    if (!res.ok) return null;
    const html = await res.text();
    // Skip head-to-head card list at bottom of page so we only read the
    // main match's own endResult.
    const cutoff = html.search(/<li[^>]*class=["']?atomicOneThirdWidth/i);
    const haystack = cutoff > -1 ? html.slice(0, cutoff) : html;
    const m = haystack.match(/<div[^>]*class="endResult"[^>]*>\s*(\d+)\s*-\s*(\d+)\s*<\/div>/i);
    if (!m) return null;
    return { homeScore: parseInt(m[1], 10), awayScore: parseInt(m[2], 10) };
  } catch (err) {
    console.error(`[matches-upsert] detail fetch failed for ${fiksId}:`, err);
    return null;
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verify secret
    const secret = req.headers.get('x-matches-secret');
    const expectedSecret = Deno.env.get('MATCHES_SYNC_SECRET');
    
    if (!expectedSecret || secret !== expectedSecret) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    const { matches } = await req.json();
    
    if (!Array.isArray(matches) || matches.length === 0) {
      return new Response(
        JSON.stringify({ error: 'No matches provided' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    // Load venue lookup table
    const { data: venues } = await supabase.from('venues').select('name, maps_url');
    const venueMap = new Map<string, string>();
    if (venues) {
      for (const v of venues) {
        venueMap.set(v.name.toLowerCase(), v.maps_url);
      }
    }
    console.log(`Loaded ${venueMap.size} venue mappings`);
    
    let updatedCount = 0;
    let errorCount = 0;
    
    for (const match of matches) {
      // Auto-fill venue_maps_url from lookup if not already set
      if (!match.venue_maps_url && match.venue) {
        const mapsUrl = venueMap.get(match.venue.toLowerCase());
        if (mapsUrl) {
          match.venue_maps_url = mapsUrl;
        }
      }

      // Fallback: if the team-list scrape says "upcoming" but the match is in the past,
      // try the per-match detail page to grab the final score.
      try {
        const matchTime = match.match_date ? new Date(match.match_date).getTime() : NaN;
        const isPast = !Number.isNaN(matchTime) && matchTime < Date.now();
        const looksUnfinished = match.status !== 'finished'
          && (match.home_score == null || match.away_score == null);
        if (isPast && looksUnfinished && match.fiks_id) {
          const detail = await fetchResultFromMatchPage(String(match.fiks_id));
          if (detail) {
            match.home_score = detail.homeScore;
            match.away_score = detail.awayScore;
            match.status = 'finished';
            console.log(`[matches-upsert] detail result ${match.fiks_id}: ${detail.homeScore}-${detail.awayScore}`);
          }
        }
      } catch (err) {
        console.error('[matches-upsert] detail fallback error:', err);
      }

      const { error } = await supabase
        .from('matches')
        .upsert(match, { 
          onConflict: 'team,fiks_id',
          ignoreDuplicates: false 
        });
      
      if (error) {
        console.error(`Error upserting match ${match.fiks_id}:`, error);
        errorCount++;
      } else {
        updatedCount++;
      }
    }
    
    console.log(`Upserted ${updatedCount} matches, ${errorCount} errors`);
    // Only a fully clean run counts as success: any failed row marks the
    // run as failed/partial and preserves a useful last_error.
    await recordSyncStatus(
      supabase, 'matches-upsert', errorCount === 0,
      errorCount === 0
        ? { count: updatedCount }
        : { count: updatedCount, error: `${errorCount} of ${matches.length} upserts failed` },
    );

    return new Response(
      JSON.stringify({ 
        success: true, 
        updated_count: updatedCount,
        error_count: errorCount 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error:', error);
    try {
      const supabase = createClient(
        Deno.env.get('SUPABASE_URL')!,
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
      );
      await recordSyncStatus(supabase, 'matches-upsert', false, { error: String(error) });
    } catch { /* noop */ }
    return new Response(
      JSON.stringify({ error: String(error) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
