import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'npm:@supabase/supabase-js@2.112.4';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * Returns the YouTube cover image for a site_video WITHOUT exposing the
 * YouTube URL/ID to the client (important for password-protected videos).
 * GET /video-thumbnail?video_id=<uuid>
 */
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const videoId = new URL(req.url).searchParams.get("video_id");
  if (!videoId || !/^[0-9a-f-]{36}$/i.test(videoId)) {
    return new Response("Invalid video_id", { status: 400, headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const { data, error } = await supabase
    .from("site_videos")
    .select("video_url, status")
    .eq("id", videoId)
    .maybeSingle();

  if (error || !data || data.status !== "published" || !data.video_url) {
    return new Response("Not found", { status: 404, headers: corsHeaders });
  }

  const m = String(data.video_url).match(
    /(?:youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|live\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{6,20})/,
  );
  if (!m) return new Response("No YouTube cover", { status: 404, headers: corsHeaders });

  const candidates = [
    `https://i.ytimg.com/vi/${m[1]}/maxresdefault.jpg`,
    `https://i.ytimg.com/vi/${m[1]}/hqdefault.jpg`,
  ];

  for (const url of candidates) {
    try {
      const resp = await fetch(url);
      if (!resp.ok) continue;
      const contentType = resp.headers.get("Content-Type") || "image/jpeg";
      if (!contentType.toLowerCase().startsWith("image/")) continue;
      const blob = await resp.blob();
      if (blob.size < 2000) continue; // YouTube placeholder grey image
      return new Response(blob, {
        headers: {
          ...corsHeaders,
          "Content-Type": contentType,
          "Cache-Control": "public, max-age=86400",
        },
      });
    } catch { /* try next */ }
  }

  return new Response("Cover unavailable", { status: 404, headers: corsHeaders });
});
