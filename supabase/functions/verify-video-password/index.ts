import { createClient } from 'npm:@supabase/supabase-js@2.112.4';
import { compareSync, hashSync } from "https://deno.land/x/bcrypt@v0.4.1/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { video_id, password } = await req.json();

    if (!video_id || !password) {
      return new Response(
        JSON.stringify({ valid: false, error: "Missing video_id or password" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data, error } = await supabase
      .from("site_videos")
      .select("protected_password, video_url")
      .eq("id", video_id)
      .eq("status", "published")
      .eq("is_protected", true)
      .single();

    if (error || !data) {
      return new Response(
        JSON.stringify({ valid: false, error: "Video not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Support both bcrypt hashed and legacy plaintext passwords
    let valid = false;
    const stored = data.protected_password;
    if (stored && stored.startsWith("$2")) {
      valid = compareSync(password, stored);
    } else {
      valid = stored === password;
      if (valid && stored) {
        const hash = hashSync(password);
        await supabase
          .from("site_videos")
          .update({ protected_password: hash })
          .eq("id", video_id);
      }
    }

    return new Response(
      JSON.stringify(valid ? { valid: true, video_url: data.video_url } : { valid: false }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ valid: false, error: "Internal error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
