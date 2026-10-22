import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'npm:@supabase/supabase-js@2.112.4';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const ALLOWED_INTERESTS = ["kamper", "ungdom", "dugnad", "arrangementer", "sponsor"];

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json();
    const action: string = body?.action ?? "get";
    const memberId: string = body?.id ?? "";
    const email: string = body?.email ?? "";

    if (!memberId || !email) return json({ error: "Ugyldig lenke" }, 400);

    const serviceClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: member } = await serviceClient
      .from("memberships")
      .select("id, email, first_name, last_name, membership_type, status, newsletter_opt_out, interests, team_group")
      .eq("id", memberId)
      .maybeSingle();

    if (!member || member.email.toLowerCase() !== email.toLowerCase()) {
      return json({ error: "Kunne ikke bekrefte identiteten din. Kontakt post@fagerborgbk.no." }, 403);
    }

    if (action === "get") {
      return json({
        member: {
          first_name: member.first_name,
          email: member.email,
          membership_type: member.membership_type,
          newsletter_opt_out: member.newsletter_opt_out,
          interests: member.interests ?? [],
          team_group: member.team_group ?? null,
        },
      });
    }

    if (action === "update") {
      const optOut = body?.newsletter_opt_out === true;
      const interests: string[] = Array.isArray(body?.interests)
        ? body.interests.filter((i: unknown) => typeof i === "string" && ALLOWED_INTERESTS.includes(i))
        : (member.interests ?? []);

      const { error } = await serviceClient
        .from("memberships")
        .update({ newsletter_opt_out: optOut, interests })
        .eq("id", memberId);
      if (error) throw error;

      await serviceClient.from("activity_log").insert({
        type: optOut ? "newsletter_unsubscribe" : "newsletter_preferences_updated",
        payload: { member_id: memberId, opt_out: optOut, interests },
      });

      return json({ success: true, newsletter_opt_out: optOut, interests });
    }

    return json({ error: "Ukjent handling" }, 400);
  } catch (e: any) {
    console.error("newsletter-preferences error:", e);
    return json({ error: e.message ?? "Ukjent feil" }, 500);
  }
});
