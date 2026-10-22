import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'npm:@supabase/supabase-js@2.112.4';
import { providerFailure } from '../_shared/providerFailure.ts';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface PostRequest {
  action?: "delete";
  message?: string;
  link?: string;
  image_url?: string;
  video_url?: string;
  facebook_post_id?: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Auth check - only admins can post
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("Ingen autorisasjon");
    }

    const token = authHeader.replace("Bearer ", "");
    const anonClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!);
    const { data: { user }, error: authError } = await anonClient.auth.getUser(token);
    if (authError || !user) {
      throw new Error("Ugyldig bruker");
    }

    // Check admin role
    const { data: roles } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id);

    const isAdmin = roles?.some(
      (r: { role: string }) => r.role === "site_admin" || r.role === "superadmin"
    );
    if (!isAdmin) {
      throw new Error("Ingen tilgang");
    }

    // Get Facebook credentials: prefer site_settings, fall back to env var
    let pageAccessToken = Deno.env.get("FACEBOOK_PAGE_ACCESS_TOKEN");
    const pageId = Deno.env.get("FACEBOOK_PAGE_ID");

    const { data: storedToken } = await supabase
      .from("site_settings")
      .select("value")
      .eq("key", "facebook_page_access_token")
      .single();
    if (storedToken?.value && typeof storedToken.value === "string" && storedToken.value.length > 10) {
      pageAccessToken = storedToken.value;
      console.log("[facebook-post] Using token from site_settings");
    }

    if (!pageAccessToken || !pageId) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Facebook er ikke konfigurert ennå. Legg til FACEBOOK_PAGE_ACCESS_TOKEN og FACEBOOK_PAGE_ID.",
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body: PostRequest = await req.json();

    // Handle DELETE action
    if (body.action === "delete" && body.facebook_post_id) {
      console.log("[facebook-post] Deleting FB post:", body.facebook_post_id);

      const fbResponse = await fetch(
        `https://graph.facebook.com/v21.0/${body.facebook_post_id}`,
        {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ access_token: pageAccessToken }),
        }
      );

      const fbResult = await fbResponse.json();

      if (!fbResponse.ok) {
        console.error(providerFailure('Facebook', fbResponse.status));
        // If the post doesn't exist or we lack permissions, treat as already deleted
        const errorCode = fbResult.error?.code;
        const errorSubcode = fbResult.error?.error_subcode;
        if (errorCode === 100 || errorCode === 200) {
          console.log("[facebook-post] Post not found or no access — treating as already deleted");
        } else {
          throw new Error(providerFailure('Facebook', fbResponse.status));
        }
      }

      console.log("[facebook-post] Successfully deleted FB post");
      return new Response(
        JSON.stringify({ success: true }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Handle POST action
    console.log("[facebook-post] Posting to Facebook:", { message: body.message?.substring(0, 100), hasLink: !!body.link, hasImage: !!body.image_url, hasVideo: !!body.video_url });

    let fbResponse;

    if (body.video_url) {
      // Publish as a Reel / video
      console.log("[facebook-post] Publishing video/reel to Facebook");
      fbResponse = await fetch(
        `https://graph.facebook.com/v21.0/${pageId}/videos`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            file_url: body.video_url,
            description: body.message,
            published: true,
            access_token: pageAccessToken,
          }),
        }
      );
    } else if (body.image_url) {
      fbResponse = await fetch(
        `https://graph.facebook.com/v21.0/${pageId}/photos`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            url: body.image_url,
            message: body.message,
            published: true,
            access_token: pageAccessToken,
          }),
        }
      );
    } else {
      const postData: Record<string, string> = {
        message: body.message ?? '',
        access_token: pageAccessToken,
      };
      if (body.link) {
        postData.link = body.link;
      }

      fbResponse = await fetch(
        `https://graph.facebook.com/v21.0/${pageId}/feed`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(postData),
        }
      );
    }

    const fbResult = await fbResponse.json();

    if (!fbResponse.ok) {
      console.error(providerFailure('Facebook', fbResponse.status));
      throw new Error(providerFailure('Facebook', fbResponse.status));
    }

    const postId = fbResult.id || fbResult.post_id;
    console.log("[facebook-post] Successfully posted to Facebook:", postId);

    // Also publish to the Page story when we have media (stories require photo or video)
    let storyId: string | null = null;
    let storyError: string | null = null;
    if (body.image_url || body.video_url) {
      try {
        const storyEndpoint = body.video_url
          ? `https://graph.facebook.com/v21.0/${pageId}/video_stories`
          : `https://graph.facebook.com/v21.0/${pageId}/photo_stories`;
        const storyPayload: Record<string, string> = body.video_url
          ? { file_url: body.video_url, access_token: pageAccessToken }
          : { photo_url: body.image_url ?? '', access_token: pageAccessToken };

        console.log("[facebook-post] Publishing to Facebook story:", storyEndpoint);
        const storyResponse = await fetch(storyEndpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(storyPayload),
        });
        const storyResult = await storyResponse.json();

        if (!storyResponse.ok) {
          storyError = providerFailure('Facebook', storyResponse.status);
          console.error(storyError);
        } else {
          storyId = storyResult.id || storyResult.post_id || null;
          console.log("[facebook-post] Successfully published story:", storyId);
        }
      } catch {
        console.error('[facebook-post] Story publish failed');
        storyError = 'Story kunne ikke publiseres. Hovedinnlegget er publisert.';
      }
    }

    return new Response(
      JSON.stringify({ success: true, post_id: postId, story_id: storyId, story_error: storyError }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch {
    console.error('[facebook-post] Request failed');
    const msg = 'Facebook-handlingen kunne ikke fullføres. Kontroller tilkoblingen og innlegget før du prøver igjen.';
    return new Response(
      JSON.stringify({ success: false, error: msg }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
