import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'npm:@supabase/supabase-js@2.112.4';
import { requireAdminOrSecret } from '../_shared/adminAuth.ts';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-sync-secret, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface TokenDebugData {
  is_valid: boolean;
  expires_at?: number;
  scopes?: string[];
  type?: string;
  error?: { message: string; code: number };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  // Auth check - admin JWT or shared cron secret (x-sync-secret)
  const unauth = await requireAdminOrSecret(req);
  if (unauth) {
    return new Response(JSON.stringify({ success: false, error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);


    const body = await req.json().catch(() => ({}));
    const action = body.action;

    // Get token: prefer site_settings (dynamically updated), fall back to env var
    const pageId = Deno.env.get("FACEBOOK_PAGE_ID");
    const appId = Deno.env.get("FACEBOOK_APP_ID");
    const appSecret = Deno.env.get("FACEBOOK_APP_SECRET");

    let pageAccessToken = Deno.env.get("FACEBOOK_PAGE_ACCESS_TOKEN");
    const { data: storedToken } = await supabase
      .from("site_settings")
      .select("value")
      .eq("key", "facebook_page_access_token")
      .single();
    if (storedToken?.value && typeof storedToken.value === "string" && storedToken.value.length > 10) {
      pageAccessToken = storedToken.value;
      console.log("[facebook-token-health] Using token from site_settings");
    }

    if (!pageAccessToken || !pageId) {
      return new Response(
        JSON.stringify({
          success: true,
          status: "not_configured",
          message: "Facebook er ikke konfigurert. Mangler FACEBOOK_PAGE_ACCESS_TOKEN eller FACEBOOK_PAGE_ID.",
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ACTION: check — inspect current token
    if (!action || action === "check") {
      console.log("[facebook-token-health] Checking token health...");

      // Debug the token using Facebook's debug_token endpoint
      const debugUrl = `https://graph.facebook.com/v21.0/debug_token?input_token=${pageAccessToken}&access_token=${appId}|${appSecret}`;
      const debugResp = await fetch(debugUrl);
      const debugResult = await debugResp.json();

      if (!debugResp.ok || debugResult.error) {
        // If we can't debug with app credentials, try a simpler check
        const meResp = await fetch(
          `https://graph.facebook.com/v21.0/me?access_token=${pageAccessToken}&fields=id,name`
        );
        const meResult = await meResp.json();

        if (!meResp.ok) {
          return new Response(
            JSON.stringify({
              success: true,
              status: "expired",
              message: meResult.error?.message || "Token er ugyldig eller utløpt",
              token_prefix: pageAccessToken.substring(0, 10) + "...",
            }),
            { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        return new Response(
          JSON.stringify({
            success: true,
            status: "valid",
            message: `Token fungerer for side: ${meResult.name}`,
            page_name: meResult.name,
            page_id: meResult.id,
            expires_at: null,
            is_permanent: true, // Can't determine without debug_token
            token_prefix: pageAccessToken.substring(0, 10) + "...",
          }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const debugData: TokenDebugData = debugResult.data;
      const expiresAt = debugData.expires_at;
      const isValid = debugData.is_valid;
      const isPermanent = expiresAt === 0; // 0 means never expires
      const now = Math.floor(Date.now() / 1000);
      const daysUntilExpiry = expiresAt && expiresAt > 0
        ? Math.floor((expiresAt - now) / 86400)
        : null;

      let status = "valid";
      let message = "Token er gyldig";

      if (!isValid) {
        status = "expired";
        message = "Token er utløpt eller ugyldig";
      } else if (isPermanent) {
        status = "valid";
        message = "Token er permanent og utløper aldri";
      } else if (daysUntilExpiry !== null && daysUntilExpiry <= 7) {
        status = "expiring_soon";
        message = `Token utløper om ${daysUntilExpiry} dag${daysUntilExpiry !== 1 ? "er" : ""}`;
      } else if (daysUntilExpiry !== null) {
        status = "valid";
        message = `Token er gyldig i ${daysUntilExpiry} dager til`;
      }

      // Get page name
      let pageName = null;
      if (isValid) {
        const meResp = await fetch(
          `https://graph.facebook.com/v21.0/me?access_token=${pageAccessToken}&fields=name`
        );
        const meResult = await meResp.json();
        pageName = meResult.name;
      }

      return new Response(
        JSON.stringify({
          success: true,
          status,
          message,
          is_valid: isValid,
          is_permanent: isPermanent,
          expires_at: expiresAt && expiresAt > 0 ? new Date(expiresAt * 1000).toISOString() : null,
          days_until_expiry: daysUntilExpiry,
          scopes: debugData.scopes,
          page_name: pageName,
          page_id: pageId,
          token_prefix: pageAccessToken.substring(0, 10) + "...",
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ACTION: oauth_url — return the Facebook OAuth URL for the admin to authorize
    if (action === "oauth_url") {
      const redirectUri = body.redirect_uri;
      if (!redirectUri) throw new Error("Mangler redirect_uri");
      if (!appId) throw new Error("Mangler FACEBOOK_APP_ID");

      const oauthUrl = `https://www.facebook.com/v21.0/dialog/oauth?client_id=${appId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=pages_show_list,pages_manage_posts,pages_read_engagement&response_type=code`;

      return new Response(
        JSON.stringify({ success: true, oauth_url: oauthUrl }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ACTION: oauth_callback — exchange OAuth code for permanent page token
    if (action === "oauth_callback") {
      const code = body.code;
      const redirectUri = body.redirect_uri;
      if (!code) throw new Error("Mangler OAuth-kode");
      if (!redirectUri) throw new Error("Mangler redirect_uri");
      if (!appId || !appSecret) throw new Error("Mangler FACEBOOK_APP_ID eller FACEBOOK_APP_SECRET");

      console.log("[facebook-token-health] OAuth callback, exchanging code...");

      // Step 1: Exchange code for short-lived user token
      const tokenResp = await fetch(
        `https://graph.facebook.com/v21.0/oauth/access_token?client_id=${appId}&redirect_uri=${encodeURIComponent(redirectUri)}&client_secret=${appSecret}&code=${code}`
      );
      const tokenResult = await tokenResp.json();
      if (!tokenResp.ok || tokenResult.error) {
        throw new Error(`OAuth-utveksling feilet: ${tokenResult.error?.message || JSON.stringify(tokenResult)}`);
      }
      const shortLivedToken = tokenResult.access_token;
      console.log("[facebook-token-health] Got short-lived user token from OAuth");

      // Step 2: Exchange for long-lived user token
      const longLivedResp = await fetch(
        `https://graph.facebook.com/v21.0/oauth/access_token?grant_type=fb_exchange_token&client_id=${appId}&client_secret=${appSecret}&fb_exchange_token=${shortLivedToken}`
      );
      const longLivedResult = await longLivedResp.json();
      if (!longLivedResp.ok || longLivedResult.error) {
        throw new Error(`Kunne ikke utveksle token: ${longLivedResult.error?.message || JSON.stringify(longLivedResult)}`);
      }
      const longLivedToken = longLivedResult.access_token;
      console.log("[facebook-token-health] Got long-lived user token");

      // Step 3: Get user info
      const meResp = await fetch(
        `https://graph.facebook.com/v21.0/me?access_token=${longLivedToken}&fields=id,name`
      );
      const meResult = await meResp.json();
      console.log("[facebook-token-health] User:", JSON.stringify(meResult));

      // Step 4: Get permanent page token via /accounts
      const pagesResp = await fetch(
        `https://graph.facebook.com/v21.0/${meResult.id}/accounts?access_token=${longLivedToken}`
      );
      const pagesResult = await pagesResp.json();

      if (!pagesResult.data || pagesResult.data.length === 0) {
        throw new Error("Ingen sider funnet. Kontoen må være administrator for Facebook-siden.");
      }

      const targetPage = pagesResult.data.find((p: { id: string }) => p.id === pageId);
      if (!targetPage) {
        const available = pagesResult.data.map((p: { id: string; name: string }) => `${p.name} (${p.id})`).join(", ");
        throw new Error(`Fant ikke side med ID ${pageId}. Tilgjengelige: ${available}`);
      }

      const permanentPageToken = targetPage.access_token;
      console.log("[facebook-token-health] Got permanent page token for:", targetPage.name);

      // Verify permanence
      const verifyResp = await fetch(
        `https://graph.facebook.com/v21.0/debug_token?input_token=${permanentPageToken}&access_token=${appId}|${appSecret}`
      );
      const verifyResult = await verifyResp.json();
      const isPermanent = verifyResult.data?.expires_at === 0;

      // Save token to site_settings so it persists
      await supabase
        .from("site_settings")
        .upsert(
          { key: "facebook_page_access_token", value: permanentPageToken, updated_at: new Date().toISOString() },
          { onConflict: "key" }
        );
      console.log("[facebook-token-health] Saved new token to site_settings");

      return new Response(
        JSON.stringify({
          success: true,
          new_token: permanentPageToken,
          page_name: targetPage.name,
          page_id: targetPage.id,
          is_permanent: isPermanent,
          message: isPermanent
            ? `Permanent token generert og lagret for ${targetPage.name}! 🎉`
            : `Token generert og lagret for ${targetPage.name}`,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ACTION: exchange — convert short-lived user token to long-lived, then get permanent page token
    if (action === "exchange") {
      const userToken = body.user_token;
      if (!userToken) throw new Error("Mangler user_token for token-utveksling");

      if (!appId || !appSecret) {
        throw new Error("Mangler FACEBOOK_APP_ID eller FACEBOOK_APP_SECRET for token-utveksling");
      }

      console.log("[facebook-token-health] Exchanging token...");

      // Step 1: Exchange short-lived for long-lived token
      const longLivedResp = await fetch(
        `https://graph.facebook.com/v21.0/oauth/access_token?grant_type=fb_exchange_token&client_id=${appId}&client_secret=${appSecret}&fb_exchange_token=${userToken}`
      );
      const longLivedResult = await longLivedResp.json();

      if (!longLivedResp.ok || longLivedResult.error) {
        throw new Error(
          `Kunne ikke utveksle token: ${longLivedResult.error?.message || JSON.stringify(longLivedResult)}`
        );
      }

      const longLivedToken = longLivedResult.access_token;
      console.log("[facebook-token-health] Got long-lived token");

      // Step 2: Check what the token resolves to
      const meResp = await fetch(
        `https://graph.facebook.com/v21.0/me?access_token=${longLivedToken}&fields=id,name`
      );
      const meResult = await meResp.json();
      console.log("[facebook-token-health] /me result:", JSON.stringify(meResult));
      
      if (!meResp.ok || meResult.error) {
        throw new Error(
          `Kunne ikke verifisere token: ${meResult.error?.message || JSON.stringify(meResult)}`
        );
      }

      // Check token expiry info
      const debugResp = await fetch(
        `https://graph.facebook.com/v21.0/debug_token?input_token=${longLivedToken}&access_token=${appId}|${appSecret}`
      );
      const debugResult = await debugResp.json();
      const tokenIsPermanent = debugResult.data?.expires_at === 0;
      const tokenType = debugResult.data?.type;
      console.log("[facebook-token-health] Debug:", JSON.stringify(debugResult.data));

      // If /me returns the page ID, the input was a page token
      if (meResult.id === pageId) {
        console.log("[facebook-token-health] Token resolves to page:", meResult.name);
        
        if (tokenIsPermanent) {
          // Save to site_settings
          await supabase
            .from("site_settings")
            .upsert(
              { key: "facebook_page_access_token", value: longLivedToken, updated_at: new Date().toISOString() },
              { onConflict: "key" }
            );
          console.log("[facebook-token-health] Saved page token to site_settings");

          return new Response(
            JSON.stringify({
              success: true,
              new_token: longLivedToken,
              page_name: meResult.name,
              page_id: meResult.id,
              is_permanent: true,
              message: `Permanent token generert og lagret for ${meResult.name}`,
            }),
            { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        // Not permanent — can't make a page token permanent without a user token
        const expiresAt = debugResult.data?.expires_at;
        const expiresDate = expiresAt ? new Date(expiresAt * 1000).toLocaleString("nb-NO") : "ukjent";
        throw new Error(
          `Tokenet peker til Facebook-siden din, men er ikke permanent (utløper: ${expiresDate}). ` +
          "For å få et permanent token trenger vi et User Access Token. " +
          "I Graph API Explorer: sørg for at du velger 'User Token' under 'User or Page' og at du IKKE har valgt en spesifikk side. " +
          "Tokenet som genereres skal peke til din bruker, ikke til siden."
        );
      }

      // Step 3: It's a user token — get permanent page access token
      const userId = meResult.id;
      console.log("[facebook-token-health] Getting pages for user:", userId, meResult.name);
      const pagesResp = await fetch(
        `https://graph.facebook.com/v21.0/${userId}/accounts?access_token=${longLivedToken}`
      );
      const pagesResult = await pagesResp.json();
      console.log("[facebook-token-health] Pages result:", JSON.stringify(pagesResult));

      if (!pagesResp.ok || pagesResult.error) {
        throw new Error(
          `Kunne ikke hente sider (kode ${pagesResult.error?.code}): ${pagesResult.error?.message || JSON.stringify(pagesResult)}`
        );
      }
      
      if (!pagesResult.data || pagesResult.data.length === 0) {
        throw new Error(
          "Ingen sider funnet. Brukeren som genererte tokenet må være administrator for Facebook-siden."
        );
      }

      const targetPage = pagesResult.data?.find(
        (p: { id: string }) => p.id === pageId
      );

      if (!targetPage) {
        const availablePages = pagesResult.data?.map(
          (p: { id: string; name: string }) => `${p.name} (${p.id})`
        ).join(", ");
        throw new Error(
          `Fant ikke side med ID ${pageId}. Tilgjengelige sider: ${availablePages || "ingen"}`
        );
      }

      const permanentPageToken = targetPage.access_token;
      console.log("[facebook-token-health] Got permanent page token for:", targetPage.name);

      // Verify the new token is permanent
      const verifyResp = await fetch(
        `https://graph.facebook.com/v21.0/debug_token?input_token=${permanentPageToken}&access_token=${appId}|${appSecret}`
      );
      const verifyResult = await verifyResp.json();
      const isPermanent = verifyResult.data?.expires_at === 0;

      // Save token to site_settings
      await supabase
        .from("site_settings")
        .upsert(
          { key: "facebook_page_access_token", value: permanentPageToken, updated_at: new Date().toISOString() },
          { onConflict: "key" }
        );
      console.log("[facebook-token-health] Saved exchange token to site_settings");

      return new Response(
        JSON.stringify({
          success: true,
          new_token: permanentPageToken,
          page_name: targetPage.name,
          page_id: targetPage.id,
          is_permanent: isPermanent,
          message: isPermanent
            ? `Permanent token generert og lagret for ${targetPage.name}`
            : `Token generert og lagret for ${targetPage.name} (utløper ${new Date((verifyResult.data?.expires_at || 0) * 1000).toISOString()})`,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    throw new Error(`Ukjent action: ${action}`);
  } catch (error) {
    console.error("[facebook-token-health] Error:", error);
    const msg = error instanceof Error ? error.message : "Ukjent feil";
    return new Response(
      JSON.stringify({ success: false, error: msg }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
