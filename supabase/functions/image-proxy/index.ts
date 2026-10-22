import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// SSRF protection: only allow fetching images from these known hosts.
const ALLOWED_HOST_SUFFIXES = [
  "fotball.no",
  "nifs.no",
  "norsk-tipping.no",
  "supabase.co",
  "supabase.in",
  "lovable.app",
  "lovable.dev",
  "googleusercontent.com",
  "gstatic.com",
];

function isAllowedUrl(raw: string): URL | null {
  let u: URL;
  try { u = new URL(raw); } catch { return null; }
  if (u.protocol !== "https:" && u.protocol !== "http:") return null;
  const host = u.hostname.toLowerCase();
  // Block private / loopback / metadata hosts by name
  if (
    host === "localhost" ||
    host === "0.0.0.0" ||
    host === "169.254.169.254" ||
    /^127\./.test(host) ||
    /^10\./.test(host) ||
    /^192\.168\./.test(host) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(host)
  ) return null;
  if (!ALLOWED_HOST_SUFFIXES.some(s => host === s || host.endsWith("." + s))) return null;
  return u;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const url = new URL(req.url);
  const imageUrl = url.searchParams.get("url");

  if (!imageUrl) {
    return new Response("Missing url parameter", { status: 400, headers: corsHeaders });
  }

  const target = isAllowedUrl(imageUrl);
  if (!target) {
    return new Response("URL not allowed", { status: 400, headers: corsHeaders });
  }

  try {
    const resp = await fetch(target.toString(), { redirect: "manual" });
    if (resp.status >= 300 && resp.status < 400) {
      return new Response("Redirects are not allowed", { status: 400, headers: corsHeaders });
    }
    if (!resp.ok) {
      return new Response("Failed to fetch image", { status: resp.status, headers: corsHeaders });
    }
    const contentType = resp.headers.get("Content-Type") || "image/png";
    if (!contentType.toLowerCase().startsWith("image/")) {
      return new Response("Not an image", { status: 400, headers: corsHeaders });
    }
    const blob = await resp.blob();
    return new Response(blob, {
      headers: {
        ...corsHeaders,
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=86400",
      },
    });
  } catch (_error) {
    return new Response("Error fetching image", { status: 500, headers: corsHeaders });
  }
});
