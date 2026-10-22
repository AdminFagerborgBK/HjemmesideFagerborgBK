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

    const body = await req.json().catch(() => ({}));
    const action = body.action;

    const clientKey = Deno.env.get("TIKTOK_CLIENT_KEY");
    const clientSecret = Deno.env.get("TIKTOK_CLIENT_SECRET");

    // ACTION: check — check TikTok connection status
    if (!action || action === "check") {
      // Read stored tokens from site_settings
      const { data: tokenRow } = await supabase
        .from("site_settings")
        .select("value")
        .eq("key", "tiktok_access_token")
        .single();
      const { data: openIdRow } = await supabase
        .from("site_settings")
        .select("value")
        .eq("key", "tiktok_open_id")
        .single();
      const { data: usernameRow } = await supabase
        .from("site_settings")
        .select("value")
        .eq("key", "tiktok_username")
        .single();

      const accessToken = typeof tokenRow?.value === "string" ? tokenRow.value : null;
      const openId = typeof openIdRow?.value === "string" ? openIdRow.value : null;
      const username = typeof usernameRow?.value === "string" ? usernameRow.value : null;

      if (!clientKey || !clientSecret) {
        return json({
          success: true,
          status: "not_configured",
          message: "TikTok er ikke konfigurert. TIKTOK_CLIENT_KEY eller TIKTOK_CLIENT_SECRET mangler.",
        });
      }

      if (!accessToken || !openId) {
        return json({
          success: true,
          status: "not_connected",
          message: "TikTok er ikke koblet til. Klikk «Koble til TikTok» for å autorisere.",
        });
      }

      // Try to verify token by calling user info
      try {
        const infoResp = await fetch(
          "https://open.tiktokapis.com/v2/user/info/?fields=display_name,avatar_url",
          { headers: { Authorization: `Bearer ${accessToken}` } }
        );
        const infoResult = await infoResp.json();

        if (infoResult.error?.code && infoResult.error.code !== "ok") {
          // Token might be expired, try refresh
          const refreshed = await refreshToken(supabase, clientKey, clientSecret);
          if (refreshed) {
            return json({
              success: true,
              status: "valid",
              message: `Koblet til TikTok${username ? ` (@${username})` : ""}. Token ble automatisk fornyet.`,
              username,
              open_id: openId,
            });
          }
          return json({
            success: true,
            status: "expired",
            message: "TikTok-token er utløpt og kunne ikke fornyes. Koble til på nytt.",
            username,
          });
        }

        const displayName = infoResult.data?.user?.display_name || username;
        return json({
          success: true,
          status: "valid",
          message: `Koblet til TikTok${displayName ? ` (${displayName})` : ""}`,
          username: displayName,
          open_id: openId,
        });
      } catch {
        return json({
          success: true,
          status: "expired",
          message: "Kunne ikke verifisere TikTok-tilkobling.",
        });
      }
    }

    // ACTION: oauth_url — generate TikTok OAuth URL
    if (action === "oauth_url") {
      const redirectUri = body.redirect_uri;
      if (!redirectUri) throw new Error("Mangler redirect_uri");
      if (!clientKey) throw new Error("Mangler TIKTOK_CLIENT_KEY");

      const csrfState = crypto.randomUUID();
      // Store CSRF state
      await supabase
        .from("site_settings")
        .upsert(
          { key: "tiktok_csrf_state", value: csrfState, updated_at: new Date().toISOString() },
          { onConflict: "key" }
        );

      const scopes = "user.info.basic,video.publish,video.upload";
      const oauthUrl =
        `https://www.tiktok.com/v2/auth/authorize/?client_key=${clientKey}` +
        `&scope=${scopes}` +
        `&response_type=code` +
        `&redirect_uri=${encodeURIComponent(redirectUri)}` +
        `&state=${csrfState}`;

      return json({ success: true, oauth_url: oauthUrl });
    }

    // ACTION: oauth_callback — exchange code for tokens
    if (action === "oauth_callback") {
      const code = body.code;
      const state = body.state;
      const redirectUri = body.redirect_uri;
      if (!code) throw new Error("Mangler OAuth-kode");
      if (!redirectUri) throw new Error("Mangler redirect_uri");
      if (!clientKey || !clientSecret) throw new Error("Mangler TikTok-credentials");

      // Verify CSRF state
      const { data: csrfRow } = await supabase
        .from("site_settings")
        .select("value")
        .eq("key", "tiktok_csrf_state")
        .single();
      if (state && csrfRow?.value && csrfRow.value !== state) {
        throw new Error("Ugyldig state-parameter (CSRF-beskyttelse)");
      }

      console.log("[tiktok-auth] Exchanging code for token...");

      const tokenResp = await fetch("https://open.tiktokapis.com/v2/oauth/token/", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          client_key: clientKey,
          client_secret: clientSecret,
          code,
          grant_type: "authorization_code",
          redirect_uri: redirectUri,
        }),
      });
      const tokenResult = await tokenResp.json();

      if (tokenResult.error || !tokenResult.access_token) {
        const errMsg = tokenResult.error_description || tokenResult.error || "Token-utveksling feilet";
        throw new Error(errMsg);
      }

      const accessToken = tokenResult.access_token;
      const refreshTokenVal = tokenResult.refresh_token;
      const openId = tokenResult.open_id;
      const expiresIn = tokenResult.expires_in; // seconds

      console.log("[tiktok-auth] Got access token, open_id:", openId);

      // Get user info
      let username = "";
      try {
        const infoResp = await fetch(
          "https://open.tiktokapis.com/v2/user/info/?fields=display_name",
          { headers: { Authorization: `Bearer ${accessToken}` } }
        );
        const infoResult = await infoResp.json();
        username = infoResult.data?.user?.display_name || "";
      } catch { /* ignore */ }

      // Save tokens to site_settings
      const now = new Date().toISOString();
      await supabase.from("site_settings").upsert([
        { key: "tiktok_access_token", value: accessToken, updated_at: now },
        { key: "tiktok_refresh_token", value: refreshTokenVal, updated_at: now },
        { key: "tiktok_open_id", value: openId, updated_at: now },
        { key: "tiktok_username", value: username, updated_at: now },
        { key: "tiktok_token_expires_at", value: new Date(Date.now() + expiresIn * 1000).toISOString(), updated_at: now },
      ], { onConflict: "key" });

      console.log("[tiktok-auth] Saved tokens to site_settings");

      return json({
        success: true,
        message: `TikTok koblet til${username ? ` som ${username}` : ""}! 🎉`,
        username,
        open_id: openId,
      });
    }

    // ACTION: disconnect — remove TikTok tokens
    if (action === "disconnect") {
      const keysToDelete = [
        "tiktok_access_token",
        "tiktok_refresh_token",
        "tiktok_open_id",
        "tiktok_username",
        "tiktok_token_expires_at",
        "tiktok_csrf_state",
      ];
      for (const key of keysToDelete) {
        await supabase.from("site_settings").delete().eq("key", key);
      }
      return json({ success: true, message: "TikTok er frakoblet." });
    }

    throw new Error(`Ukjent action: ${action}`);
  } catch (err) {
    console.error("[tiktok-auth] Error:", err);
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

async function refreshToken(
  supabase: ReturnType<typeof createClient>,
  clientKey: string,
  clientSecret: string
): Promise<boolean> {
  try {
    const { data: refreshRow } = await supabase
      .from("site_settings")
      .select("value")
      .eq("key", "tiktok_refresh_token")
      .single();

    const refreshTokenVal = typeof refreshRow?.value === "string" ? refreshRow.value : null;
    if (!refreshTokenVal) return false;

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

    if (result.error || !result.access_token) return false;

    const now = new Date().toISOString();
    await supabase.from("site_settings").upsert([
      { key: "tiktok_access_token", value: result.access_token, updated_at: now },
      { key: "tiktok_refresh_token", value: result.refresh_token, updated_at: now },
      { key: "tiktok_token_expires_at", value: new Date(Date.now() + result.expires_in * 1000).toISOString(), updated_at: now },
    ], { onConflict: "key" });

    console.log("[tiktok-auth] Token refreshed successfully");
    return true;
  } catch (err) {
    console.error("[tiktok-auth] Refresh failed:", err);
    return false;
  }
}
