import { createClient } from 'npm:@supabase/supabase-js@2.112.4';

/**
 * Returns null when the request is authorized (admin JWT or shared secret),
 * or a 401 Response otherwise. The shared secret allows cron/server-to-server
 * callers to invoke the function without an admin session.
 */
export async function requireAdminOrSecret(req: Request): Promise<Response | null> {
  const secretHeader = req.headers.get("x-sync-secret");
  const expectedSecrets = [
    Deno.env.get("MATCHES_SYNC_SECRET"),
    Deno.env.get("CRON_SYNC_SECRET"),
    Deno.env.get("MANUAL_SYNC_SECRET"),
  ].filter((s): s is string => !!s);
  if (secretHeader && expectedSecrets.includes(secretHeader)) {
    return null;
  }

  const authHeader = req.headers.get("Authorization");
  if (authHeader?.startsWith("Bearer ")) {
    try {
      const supabase = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_ANON_KEY")!,
        { global: { headers: { Authorization: authHeader } } },
      );
      const token = authHeader.replace("Bearer ", "");
      const { data: userData } = await supabase.auth.getUser(token);
      if (userData?.user) {
        const { data: isAdmin } = await supabase.rpc("is_admin", {
          _user_id: userData.user.id,
        });
        if (isAdmin) return null;
      }
    } catch (_e) {
      // fall through to 401
    }
  }

  return new Response(
    JSON.stringify({ error: "Unauthorized" }),
    { status: 401, headers: { "Content-Type": "application/json" } },
  );
}

export function htmlEscape(input: unknown): string {
  return String(input ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}