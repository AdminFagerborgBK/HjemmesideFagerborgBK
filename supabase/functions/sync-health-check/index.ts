import { createClient } from 'npm:@supabase/supabase-js@2.112.4';
import { requireAdminOrSecret } from "../_shared/adminAuth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-sync-secret",
};

const ALERT_COOLDOWN_HOURS = 12;

// Jobs that actually run today.
// - "stale": runs unconditionally on a schedule → alert if no success within staleHours.
// - "error": change-gated (only called when source data changed, can be silent for
//   weeks off-season) → alert only if the latest recorded attempt failed.
// Jobs with no sync_status row yet are skipped (never run ≠ broken).
const JOBS: Array<{ key: string; mode: "stale" | "error"; staleHours: number }> = [
  { key: "grasrot-scrape", mode: "stale", staleHours: 48 },
  { key: "matches-upsert", mode: "error", staleHours: 0 },
  { key: "division-matches-sync", mode: "error", staleHours: 0 },
  { key: "standings-scraper", mode: "error", staleHours: 0 },
  { key: "sync-matches", mode: "error", staleHours: 0 }, // manual/admin runs
];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const unauthorized = await requireAdminOrSecret(req);
  if (unauthorized) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
  const ALERT_TO = "post@fagerborgbk.no";
  const FROM = "Fagerborg BK <noreply@support.fagerborgbk.no>";

  const now = Date.now();
  const alerts: Array<{ job: string; ageHours: number; staleHours: number; lastError: string | null }> = [];

  for (const { key, mode, staleHours } of JOBS) {
    const { data } = await supabase
      .from("sync_status")
      .select("*")
      .eq("job_key", key)
      .maybeSingle();
    if (!data) continue;

    const lastSuccess = data.last_success_at ? new Date(data.last_success_at).getTime() : 0;
    const lastAttempt = data.last_attempt_at ? new Date(data.last_attempt_at).getTime() : 0;
    const ageHours = lastSuccess ? (now - lastSuccess) / 3_600_000 : Infinity;
    const failing = mode === "stale"
      ? ageHours > staleHours
      : !!data.last_error && lastAttempt > lastSuccess;
    if (failing) {
      alerts.push({ job: key, ageHours: Math.round(ageHours * 10) / 10, staleHours, lastError: data.last_error ?? null });
    }
  }

  // Cooldown — don't send if alerted in last N hours
  const { data: lastAlert } = await supabase
    .from("sync_status").select("*").eq("job_key", "_health_alert").maybeSingle();
  const sinceLastAlert = lastAlert?.last_success_at
    ? (now - new Date(lastAlert.last_success_at).getTime()) / 3_600_000
    : Infinity;

  let emailSent = false;
  if (alerts.length > 0 && RESEND_API_KEY && sinceLastAlert > ALERT_COOLDOWN_HOURS) {
    const html = `
      <h2>⚠️ Sync-jobber er utdaterte</h2>
      <p>Følgende jobber har ikke kjørt vellykket innen sin terskel:</p>
      <ul>
        ${alerts.map(a => `<li><strong>${a.job}</strong> — ${a.ageHours}t siden suksess ${a.staleHours ? ` (terskel: ${a.staleHours}t)` : " (siste kjøring feilet)"}${a.lastError ? `<br/><small>Feil: ${a.lastError}</small>` : ""}</li>`).join("")}
      </ul>
      <p>Sjekk admin: <a href="https://www.fagerborgbk.no/admin/sync-status">Sync-status</a></p>
    `;
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: FROM,
        to: [ALERT_TO],
        subject: "⚠️ Fagerborg BK – Sync-jobb utdatert",
        html,
      }),
    });
    emailSent = res.ok;
    if (res.ok) {
      const iso = new Date().toISOString();
      await supabase.from("sync_status").upsert({
        job_key: "_health_alert",
        last_attempt_at: iso,
        last_success_at: iso,
        last_details: { alerts },
        updated_at: iso,
      }, { onConflict: "job_key" });
    }
  }

  // Do not leak raw internal error text in the response payload.
  const safeAlerts = alerts.map((a) => ({
    job: a.job,
    ageHours: a.ageHours,
    hasError: !!a.lastError,
  }));

  return new Response(JSON.stringify({ alerts: safeAlerts, emailSent }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});