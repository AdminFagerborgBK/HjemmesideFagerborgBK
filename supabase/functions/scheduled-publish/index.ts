import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'npm:@supabase/supabase-js@2.112.4';
import { requireAdminOrSecret } from "../_shared/adminAuth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-sync-secret",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const unauthorized = await requireAdminOrSecret(req);
  if (unauthorized) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const now = new Date().toISOString();
    const results: string[] = [];

    // --- Process scheduled NEWS ---
    const { data: scheduledNews, error: newsErr } = await supabase
      .from("news")
      .select("id, title, slug, excerpt, content, image_url, scheduled_facebook")
      .eq("is_published", true)
      .eq("scheduled_facebook", true)
      .is("facebook_post_id", null)
      .lte("published_at", now)
      .is("deleted_at", null);

    if (newsErr) {
      console.error("[scheduled-publish] Error fetching news:", newsErr);
    }

    if (scheduledNews && scheduledNews.length > 0) {
      // Get Facebook credentials
      const pageAccessToken = await getPageAccessToken(supabase);
      const pageId = Deno.env.get("FACEBOOK_PAGE_ID");

      if (pageAccessToken && pageId) {
        for (const article of scheduledNews) {
          try {
            const siteUrl = "https://fagerborgbk.lovable.app";
            const articleUrl = `${siteUrl}/nyheter/${article.slug}`;
            const message = `📰 ${article.title}\n\n${article.excerpt || (article.content || "").substring(0, 200)}...\n\nLes mer: ${articleUrl}`;

            // If the article has an image, publish it as a photo post so Facebook
            // uses the actual article image instead of scraping a cached og:image.
            const usePhoto = !!article.image_url;

            const endpoint = usePhoto
              ? `https://graph.facebook.com/v21.0/${pageId}/photos`
              : `https://graph.facebook.com/v21.0/${pageId}/feed`;

            const postData: Record<string, string | boolean> = usePhoto
              ? {
                  url: article.image_url as string,
                  message,
                  published: true,
                  access_token: pageAccessToken,
                }
              : {
                  message,
                  link: articleUrl,
                  access_token: pageAccessToken,
                };

            const fbResponse = await fetch(
              endpoint,
              {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(postData),
              }
            );


            const fbResult = await fbResponse.json();

            if (fbResponse.ok) {
              const postId = fbResult.id || fbResult.post_id;
              await supabase
                .from("news")
                .update({ facebook_post_id: postId, scheduled_facebook: false })
                .eq("id", article.id);
              results.push(`✅ News "${article.title}" → Facebook (${postId})`);
            } else {
              console.error(`[scheduled-publish] FB error for news ${article.id}:`, fbResult);
              results.push(`❌ News "${article.title}" → FB error: ${fbResult.error?.message}`);
            }
          } catch (err) {
            console.error(`[scheduled-publish] Error posting news ${article.id}:`, err);
            results.push(`❌ News "${article.title}" → Error: ${err}`);
          }
        }
      } else {
        results.push("⚠️ Facebook not configured, skipping news");
      }
    }

    // --- Process scheduled VIDEOS ---
    const { data: scheduledVideos, error: vidErr } = await supabase
      .from("site_videos")
      .select("id, title, description, video_url, thumbnail_url, category, scheduled_facebook, scheduled_tiktok")
      .eq("status", "published")
      .lte("published_at", now)
      .or("scheduled_facebook.eq.true,scheduled_tiktok.eq.true");

    if (vidErr) {
      console.error("[scheduled-publish] Error fetching videos:", vidErr);
    }

    if (scheduledVideos && scheduledVideos.length > 0) {
      const pageAccessToken = await getPageAccessToken(supabase);
      const pageId = Deno.env.get("FACEBOOK_PAGE_ID");

      for (const video of scheduledVideos) {
        // Facebook
        if (video.scheduled_facebook && pageAccessToken && pageId) {
          try {
            const hashtags = "#fagerborgbk #fotball #oslo";
            const message = `🎬 ${video.title}\n\n${video.description || "Ny video fra Fagerborg BK!"}\n\n${hashtags}`;
            const cleanVideoUrl = video.video_url.split("?")[0];
            const isDirectVideo = cleanVideoUrl.match(/\.(mp4|mov|avi|wmv|webm)$/i);

            let fbResponse;
            if (isDirectVideo) {
              fbResponse = await fetch(
                `https://graph.facebook.com/v21.0/${pageId}/videos`,
                {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    file_url: cleanVideoUrl,
                    description: message,
                    published: true,
                    access_token: pageAccessToken,
                  }),
                }
              );
            } else {
              fbResponse = await fetch(
                `https://graph.facebook.com/v21.0/${pageId}/feed`,
                {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    message: message + "\n\n▶️ Se videoen her:",
                    link: video.video_url,
                    access_token: pageAccessToken,
                  }),
                }
              );
            }

            const fbResult = await fbResponse.json();
            if (fbResponse.ok) {
              await supabase
                .from("site_videos")
                .update({ scheduled_facebook: false })
                .eq("id", video.id);
              results.push(`✅ Video "${video.title}" → Facebook`);
            } else {
              console.error(`[scheduled-publish] FB error for video ${video.id}:`, fbResult);
              results.push(`❌ Video "${video.title}" → FB error: ${fbResult.error?.message}`);
            }
          } catch (err) {
            results.push(`❌ Video "${video.title}" → FB Error: ${err}`);
          }
        }

        // TikTok
        if (video.scheduled_tiktok) {
          try {
            // Get TikTok tokens from settings
            const { data: tiktokSettings } = await supabase
              .from("site_settings")
              .select("key, value")
              .in("key", ["tiktok_access_token", "tiktok_open_id"]);

            const accessToken = tiktokSettings?.find(s => s.key === "tiktok_access_token")?.value;
            const openId = tiktokSettings?.find(s => s.key === "tiktok_open_id")?.value;

            if (accessToken && openId) {
              // Call the existing tiktok-publish function
              const { error: tiktokErr } = await supabase.functions.invoke("tiktok-publish", {
                body: {
                  video_url: video.video_url,
                  title: video.title,
                  description: video.description,
                },
              });

              if (!tiktokErr) {
                await supabase
                  .from("site_videos")
                  .update({ scheduled_tiktok: false })
                  .eq("id", video.id);
                results.push(`✅ Video "${video.title}" → TikTok`);
              } else {
                results.push(`❌ Video "${video.title}" → TikTok error: ${tiktokErr.message}`);
              }
            } else {
              results.push(`⚠️ TikTok not configured, skipping video "${video.title}"`);
            }
          } catch (err) {
            results.push(`❌ Video "${video.title}" → TikTok Error: ${err}`);
          }
        }
      }
    }

    console.log("[scheduled-publish] Results:", results);

    return new Response(
      JSON.stringify({ success: true, processed: results }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[scheduled-publish] Error:", error);
    return new Response(
      JSON.stringify({ success: false, error: String(error) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

async function getPageAccessToken(supabase: any): Promise<string | null> {
  let token = Deno.env.get("FACEBOOK_PAGE_ACCESS_TOKEN") || null;

  const { data: storedToken } = await supabase
    .from("site_settings")
    .select("value")
    .eq("key", "facebook_page_access_token")
    .single();

  if (storedToken?.value && typeof storedToken.value === "string" && storedToken.value.length > 10) {
    token = storedToken.value;
  }

  return token;
}
