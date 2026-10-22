/**
 * Grasrotandelen Upsert Edge Function
 * 
 * Sikret endepunkt for å motta data fra ekstern scraper (GitHub Actions + Playwright).
 * Krever x-grasrot-secret header for autentisering.
 * 
 * POST body:
 * {
 *   "source_url": "https://www.norsk-tipping.no/grasrotandelen/statistikk/iframe/996145530",
 *   "rows": [
 *     { "year": 2026, "amount_nok": 2878.00, "num_supporters": 42 },
 *     { "year": 2025, "amount_nok": 38097.00, "num_supporters": 45 }
 *   ]
 * }
 */

import { createClient } from 'npm:@supabase/supabase-js@2.112.4';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-grasrot-secret",
};

interface GrasrotRow {
  year: number;
  amount_nok: number;
  num_supporters?: number;
}

interface UpsertPayload {
  source_url: string;
  rows: GrasrotRow[];
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  // Only allow POST
  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ error: "Method not allowed" }),
      { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  try {
    // Check for required secret
    const upsertSecret = Deno.env.get("GRASROT_UPSERT_SECRET");
    if (!upsertSecret) {
      console.error("[grasrot-upsert] GRASROT_UPSERT_SECRET is not configured");
      return new Response(
        JSON.stringify({ error: "Server configuration error: GRASROT_UPSERT_SECRET not set" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate secret header
    const providedSecret = req.headers.get("x-grasrot-secret");
    if (!providedSecret || providedSecret !== upsertSecret) {
      console.warn("[grasrot-upsert] Unauthorized request - invalid or missing secret");
      return new Response(
        JSON.stringify({ error: "Unauthorized: Invalid or missing x-grasrot-secret header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Parse body
    const payload: UpsertPayload = await req.json();
    console.log("[grasrot-upsert] Received payload:", JSON.stringify(payload, null, 2));

    // Validate payload
    if (!payload.rows || !Array.isArray(payload.rows) || payload.rows.length === 0) {
      return new Response(
        JSON.stringify({ error: "Invalid payload: 'rows' must be a non-empty array" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate each row
    for (const row of payload.rows) {
      if (typeof row.year !== "number" || row.year < 2000 || row.year > 2100) {
        return new Response(
          JSON.stringify({ error: `Invalid year: ${row.year}` }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (typeof row.amount_nok !== "number" || row.amount_nok < 0) {
        return new Response(
          JSON.stringify({ error: `Invalid amount_nok for year ${row.year}` }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // Create Supabase client with service role
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const now = new Date().toISOString();
    let successCount = 0;
    let errorMessage: string | null = null;

    // Upsert each row
    for (const row of payload.rows) {
      const { error } = await supabase
        .from("grasrot_yearly")
        .upsert({
          year: row.year,
          amount_nok: row.amount_nok,
          num_supporters: row.num_supporters ?? 0,
          is_confirmed: row.year < new Date().getFullYear(),
          source_note: payload.source_url || "GitHub Actions Scraper",
          updated_at: now,
        }, { onConflict: "year" });

      if (error) {
        console.error(`[grasrot-upsert] Error upserting year ${row.year}:`, error);
        errorMessage = error.message;
      } else {
        successCount++;
        console.log(`[grasrot-upsert] Upserted year ${row.year}: ${row.amount_nok} NOK`);
      }
    }

    // Update fetch status
    const { error: statusError } = await supabase
      .from("grasrot_fetch_status")
      .update({
        last_attempt_at: now,
        last_success_at: errorMessage ? null : now,
        last_error: errorMessage,
        updated_at: now,
      })
      .eq("id", 1);

    if (statusError) {
      console.error("[grasrot-upsert] Error updating fetch status:", statusError);
    }

    // Log to activity_log
    const { error: logError } = await supabase
      .from("activity_log")
      .insert({
        type: "grasrot_updated",
        payload: {
          row_count: successCount,
          source_url: payload.source_url,
          years: payload.rows.map(r => r.year),
        },
      });

    if (logError) {
      console.error("[grasrot-upsert] Error logging activity:", logError);
    }

    console.log(`[grasrot-upsert] Successfully upserted ${successCount}/${payload.rows.length} rows`);

    return new Response(
      JSON.stringify({
        success: true,
        updated_count: successCount,
        total_count: payload.rows.length,
        message: errorMessage 
          ? `Partially updated with error: ${errorMessage}` 
          : `Successfully updated ${successCount} rows`,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("[grasrot-upsert] Unexpected error:", error);
    
    // Try to update fetch status with error
    try {
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const supabase = createClient(supabaseUrl, supabaseServiceKey);
      
      await supabase
        .from("grasrot_fetch_status")
        .update({
          last_attempt_at: new Date().toISOString(),
          last_error: error instanceof Error ? error.message : "Unknown error",
          updated_at: new Date().toISOString(),
        })
        .eq("id", 1);
    } catch (e) {
      console.error("[grasrot-upsert] Could not update fetch status:", e);
    }

    return new Response(
      JSON.stringify({ 
        error: "Internal server error",
        message: error instanceof Error ? error.message : "Unknown error"
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
