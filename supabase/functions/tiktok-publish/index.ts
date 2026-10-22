import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'npm:@supabase/supabase-js@2.112.4';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Auth check
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Ingen autorisasjon");
    const token = authHeader.replace("Bearer ", "");
    const anonClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!);
    const { data: { user }, error: authError } = await anonClient.auth.getUser(token);
    if (authError || !user) throw new Error("Ugyldig bruker");

    const { data: roles } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id);
    const isAdmin = roles?.some((r: { role: string }) => r.role === "site_admin" || r.role === "superadmin");
    if (!isAdmin) throw new Error("Ingen tilgang");

    const body = await req.json();
    const { video_url, title, description, video_id } = body;

    if (!video_url) throw new Error("Mangler video_url");

    // Get stored access token
    const { data: tokenRow } = await supabase
      .from("site_settings")
      .select("value")
      .eq("key", "tiktok_access_token")
      .single();
    const accessToken = typeof tokenRow?.value === "string" ? tokenRow.value : null;

    if (!accessToken) {
      throw new Error("TikTok er ikke koblet til. Gå til Innstillinger for å koble til.");
    }

    // Generate caption
    const caption = generateCaption(title, description);

    console.log("[tiktok-publish] Publishing video:", title);
    console.log("[tiktok-publish] Caption:", caption);
    console.log("[tiktok-publish] Video URL:", video_url);

    // TikTok Content Posting API v2 — init upload with PULL_FROM_URL
    const initResp = await fetch("https://open.tiktokapis.com/v2/post/publish/video/init/", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json; charset=UTF-8",
      },
      body: JSON.stringify({
        post_info: {
          title: caption.substring(0, 150),
          privacy_level: "PUBLIC_TO_EVERYONE",
          disable_duet: false,
          disable_comment: false,
          disable_stitch: false,
          video_cover_timestamp_ms: 1000,
        },
        source_info: {
          source: "PULL_FROM_URL",
          video_url: video_url,
        },
      }),
    });

    const initResult = await initResp.json();
    console.log("[tiktok-publish] Init result:", JSON.stringify(initResult));

    if (initResult.error?.code && initResult.error.code !== "ok") {
      const errCode = initResult.error.code;
      const errMsg = initResult.error.message || errCode;

      // If token expired, try to refresh and retry
      if (errCode === "access_token_invalid" || errCode === "token_expired") {
        const clientKey = Deno.env.get("TIKTOK_CLIENT_KEY")!;
        const clientSecret = Deno.env.get("TIKTOK_CLIENT_SECRET")!;
        const refreshed = await refreshAndRetry(supabase, clientKey, clientSecret, video_url, caption);
        if (refreshed.success) {
          // Log success
          await logActivity(supabase, "tiktok_publish", { video_id, title, publish_id: refreshed.publish_id });
          return json({ success: true, message: "Video publisert på TikTok!", publish_id: refreshed.publish_id });
        }
      }

      // Handle "not approved" gracefully
      if (errCode === "scope_not_authorized" || errCode === "spam_risk_too_many_posts" || errMsg.includes("not authorized")) {
        console.log("[tiktok-publish] API not authorized, marking as pending");
        return json({
          success: false,
          status: "pending",
          error: `TikTok API ikke godkjent ennå: ${errMsg}. Bruk manuell publisering.`,
        });
      }

      throw new Error(`TikTok-feil: ${errMsg}`);
    }

    const publishId = initResult.data?.publish_id;
    console.log("[tiktok-publish] Success! Publish ID:", publishId);

    // Log activity
    await logActivity(supabase, "tiktok_publish", { video_id, title, publish_id: publishId });

    return json({
      success: true,
      message: "Video sendt til TikTok for publisering!",
      publish_id: publishId,
    });
  } catch (err) {
    console.error("[tiktok-publish] Error:", err);
    return new Response(
      JSON.stringify({ success: false, error: err instanceof Error ? err.message : "Noe gikk galt" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

function json(data: unknown) {
  return new Response(JSON.stringify(data), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function generateCaption(title: string, description?: string): string {
  let caption = title || "Ny video fra Fagerborg BK";
  if (description) {
    caption += `\n\n${description}`;
  }
  caption += "\n\n#fagerborgbk #fotball #oslo #norskfotball #fagerborg";
  // TikTok caption limit ~2200 chars
  return caption.substring(0, 2200);
}

async function logActivity(
  supabase: ReturnType<typeof createClient>,
  type: string,
  payload: Record<string, unknown>
) {
  try {
    await supabase.from("activity_log").insert({ type, payload });
  } catch { /* ignore */ }
}

async function refreshAndRetry(
  supabase: ReturnType<typeof createClient>,
  clientKey: string,
  clientSecret: string,
  videoUrl: string,
  caption: string
): Promise<{ success: boolean; publish_id?: string }> {
  try {
    const { data: refreshRow } = await supabase
      .from("site_settings")
      .select("value")
      .eq("key", "tiktok_refresh_token")
      .single();
    const refreshTokenVal = typeof refreshRow?.value === "string" ? refreshRow.value : null;
    if (!refreshTokenVal) return { success: false };

    const resp = await fetch("https://open.tiktokapis.com/v2/oauth/token/", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_key: clientKey,
        client_secret: clientSecret,
        grant_type: "refresh_token",
        refresh_token: refreshTokenVal,
      }),
    });
    const result = await resp.json();
    if (result.error || !result.access_token) return { success: false };

    const now = new Date().toISOString();
    await supabase.from("site_settings").upsert([
      { key: "tiktok_access_token", value: result.access_token, updated_at: now },
      { key: "tiktok_refresh_token", value: result.refresh_token, updated_at: now },
      { key: "tiktok_token_expires_at", value: new Date(Date.now() + result.expires_in * 1000).toISOString(), updated_at: now },
    ], { onConflict: "key" });

    // Retry publish
    const retryResp = await fetch("https://open.tiktokapis.com/v2/post/publish/video/init/", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${result.access_token}`,
        "Content-Type": "application/json; charset=UTF-8",
      },
      body: JSON.stringify({
        post_info: {
          title: caption.substring(0, 150),
          privacy_level: "PUBLIC_TO_EVERYONE",
          disable_duet: false,
          disable_comment: false,
          disable_stitch: false,
        },
        source_info: {
          source: "PULL_FROM_URL",
          video_url: videoUrl,
        },
      }),
    });
    const retryResult = await retryResp.json();
    if (retryResult.error?.code && retryResult.error.code !== "ok") return { success: false };
    return { success: true, publish_id: retryResult.data?.publish_id };
  } catch {
    return { success: false };
  }
}
