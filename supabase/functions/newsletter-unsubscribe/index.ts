import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'npm:@supabase/supabase-js@2.112.4';

serve(async (req) => {
  const url = new URL(req.url);
  const memberId = url.searchParams.get("id");
  const email = url.searchParams.get("email");

  if (!memberId || !email) {
    return new Response(html("Ugyldig avmeldingslenke."), {
      status: 400,
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  }

  const serviceClient = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  // Verify email matches the member ID
  const { data: member } = await serviceClient
    .from("memberships")
    .select("id, email")
    .eq("id", memberId)
    .single();

  if (!member || member.email.toLowerCase() !== email.toLowerCase()) {
    return new Response(html("Kunne ikke bekrefte avmelding. Kontakt post@fagerborgbk.no."), {
      status: 400,
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  }

  await serviceClient
    .from("memberships")
    .update({ newsletter_opt_out: true })
    .eq("id", memberId);

  // Log
  await serviceClient.from("activity_log").insert({
    type: "newsletter_unsubscribe",
    payload: { member_id: memberId, email },
  });

  // Send the member to the branded preferences page where they can re-subscribe
  const prefsUrl = `https://www.fagerborgbk.no/nyhetsbrev?id=${memberId}&email=${encodeURIComponent(email)}`;
  return new Response(null, { status: 302, headers: { Location: prefsUrl } });
});

function html(message: string): string {
  return `<!DOCTYPE html>
<html lang="nb">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Fagerborg BK – Nyhetsbrev</title>
<style>body{font-family:system-ui,sans-serif;display:flex;justify-content:center;align-items:center;min-height:100vh;margin:0;background:#f5f5f5;color:#1a2b4a}
.card{background:white;border-radius:12px;padding:2rem;max-width:400px;text-align:center;box-shadow:0 4px 20px rgba(0,0,0,0.1)}</style>
</head>
<body><div class="card"><h2>Fagerborg BK</h2><p>${message}</p></div></body></html>`;
}
