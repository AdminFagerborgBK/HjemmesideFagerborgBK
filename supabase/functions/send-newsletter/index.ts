import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'npm:@supabase/supabase-js@2.112.4';
import { deliveryOutcome, assertTestRecipient } from './policy.ts';
import { issueNewsletterToken } from '../_shared/newsletterToken.mjs';
import { deliverRecorded } from './delivery.mjs';
import { providerFailure } from '../_shared/providerFailure.ts';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};


const SITE_URL = "https://www.fagerborgbk.no";

/** Adds the mandatory unsubscribe / preferences footer if the template lacks one */
function withFooter(html: string): string {
  if (html.includes("{{UNSUBSCRIBE_URL}}")) return html;
  return `${html}
<div style="margin-top:32px;padding-top:16px;border-top:1px solid #e5e7eb;font-family:Arial,sans-serif;font-size:12px;color:#6b7280;text-align:center">
  <p style="margin:0 0 6px">Du mottar denne e-posten fordi du er registrert hos Fagerborg BK.</p>
  <p style="margin:0"><a href="{{PREFERENCES_URL}}" style="color:#6b7280">Endre hva du vil motta</a> &nbsp;·&nbsp; <a href="{{UNSUBSCRIBE_URL}}" style="color:#6b7280">Meld deg av nyhetsbrevet</a></p>
</div>`;
}

interface Segment {
  status?: "active" | "all";
  membership_types?: string[];
  team_groups?: string[];
  interests?: string[];
}

/** Builds the recipient list from an audience preset and/or a detailed segment */
async function buildRecipientQuery(serviceClient: any, audience?: string, segment?: Segment) {
  let query = serviceClient
    .from("memberships")
    .select("id, email, first_name, membership_type, team_group, interests")
    .eq("newsletter_opt_out", false);

  const status = segment?.status ?? "active";
  if (status !== "all") query = query.eq("status", "active");

  const presetTypes: Record<string, string> = {
    members: "standard",
    malklubben: "malklubben",
    partners: "partner",
  };
  if (audience && presetTypes[audience]) {
    query = query.eq("membership_type", presetTypes[audience]);
  }

  if (segment?.membership_types?.length) {
    query = query.in("membership_type", segment.membership_types);
  }
  if (segment?.team_groups?.length) {
    query = query.in("team_group", segment.team_groups);
  }
  if (segment?.interests?.length) {
    query = query.overlaps("interests", segment.interests);
  }

  return await query;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  let claimedNewsletter: string | null = null;
  let recoverDelivery: (() => Promise<void>) | null = null;
  try {
    const { newsletter_id, test_send, audience, segment, count_only } = await req.json();
    if (!newsletter_id && !count_only) throw new Error("newsletter_id required");

    const authHeader = req.headers.get("Authorization");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    // Automated sends (cron / generate-newsletter) authenticate with the service role key
    const isCron = authHeader === `Bearer ${serviceRoleKey}`;

    let user: { email?: string } | null = null;
    if (!isCron) {
      const supabase = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_ANON_KEY")!,
        { global: { headers: { Authorization: authHeader ?? "" } } }
      );
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (!authUser) throw new Error("Unauthorized");
      user = authUser;
    }

    const serviceClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      serviceRoleKey
    );
    recoverDelivery = async () => {
      if (!claimedNewsletter) return;
      const {error} = await serviceClient.from('newsletters').update({delivery_state:'partial'}).eq('id',claimedNewsletter).eq('delivery_state','sending');
      if (error) console.error('Newsletter delivery recovery failed; manual reconciliation required');
    };

    if (!isCron) {
      const { data: isAdmin } = await serviceClient.rpc("is_admin", { _user_id: (user as any).id });
      if (!isAdmin) throw new Error("Forbidden");
    }

    // Recipient count preview for the admin segment picker
    if (count_only) {
      const { data: recipients, error: cntErr } = await buildRecipientQuery(serviceClient, audience, segment);
      if (cntErr) throw cntErr;
      return new Response(JSON.stringify({ success: true, count: recipients?.length ?? 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get newsletter
    const { data: newsletter, error: nlErr } = await serviceClient
      .from("newsletters")
      .select("*")
      .eq("id", newsletter_id)
      .single();

    if (nlErr || !newsletter) throw new Error("Newsletter not found");

    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    if (!RESEND_API_KEY) throw new Error("RESEND_API_KEY not configured");

    // TEST SEND: send only to the admin's own email
    if (test_send) {
      if (!user?.email) throw new Error("Test-sending krever innlogget admin");
      const testHtml = withFooter(newsletter.body_html)
        .replace(/<a\b[^>]*href=["']\{\{(?:UNSUBSCRIBE_URL|PREFERENCES_URL)\}\}["'][^>]*>([\s\S]*?)<\/a>/gi, '<span>$1 (deaktivert i test)</span>')
        .replace(/\{\{(?:UNSUBSCRIBE_URL|PREFERENCES_URL)\}\}/g, 'deaktivert i test');

      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${RESEND_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: "Fagerborg BK <noreply@support.fagerborgbk.no>",
          to: assertTestRecipient(user.email),
          subject: `[TEST] ${newsletter.subject}`,
          html: testHtml,
        }),
      });

      if (!res.ok) {
        throw new Error(providerFailure('Resend', res.status));
      }

      return new Response(JSON.stringify({ success: true, test: true, sent_to: user.email }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // FULL SEND
    if (newsletter.status==='sent' || ['sent','sending','partial'].includes(newsletter.delivery_state)) throw new Error("Nyhetsbrevet er sendt eller levering må kontrolleres før ny utsending");

    const { data: members, error: memErr } = await buildRecipientQuery(serviceClient, audience, segment);

    if (memErr) throw memErr;
    if (!members?.length) throw new Error("Ingen aktive medlemmer å sende til");

    let sentCount = 0;
    const errors: string[] = [];

    // Claim once so concurrent requests cannot send the list twice.
    const {data:claimed,error:claimError}=await serviceClient.from('newsletters').update({delivery_state:'sending'}).eq('id',newsletter_id).eq('delivery_state','idle').select('id');
    if(claimError) throw claimError;
    if(!claimed?.length) throw new Error('En utsending pågår allerede');
    claimedNewsletter = newsletter_id;

    for (let i = 0; i < members.length; i += 10) {
      const batch = members.slice(i, i + 10);
      const results = await Promise.allSettled(
        batch.map(async (member: any) => {
          const token = await issueNewsletterToken(member.id, serviceRoleKey);
          const base = `${SITE_URL}/nyhetsbrev#token=${token}`;
          const unsubscribeUrl = base;
          const preferencesUrl = base;
          // Persist intent before contacting the provider. Unknown outcomes stay
          // visible and the whole campaign is blocked from automatic replay.
          const personalizedHtml = withFooter(newsletter.body_html)
            .replace(/\{\{UNSUBSCRIBE_URL\}\}/g, unsubscribeUrl)
            .replace(/\{\{PREFERENCES_URL\}\}/g, preferencesUrl);

          await deliverRecorded({
            recordIntent: async()=>{
              const {data:delivery,error:intentError}=await serviceClient.from('newsletter_recipients').insert({newsletter_id,membership_id:member.id,email:member.email,name:member.first_name??null,status:'pending'}).select('id').single();
              if(intentError || !delivery) throw intentError ?? new Error('Could not record delivery intent');
              return delivery;
            },
            send: async()=>{
          const res = await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${RESEND_API_KEY}`,
              "Content-Type": "application/json",
              "Idempotency-Key": `newsletter-${newsletter_id}-${member.id}`,
            },
            body: JSON.stringify({
              from: "Fagerborg BK <noreply@support.fagerborgbk.no>",
              to: [member.email],
              subject: newsletter.subject,
              html: personalizedHtml,
            }),
          });

          if (!res.ok) {
            return {ok:false,id:null as string|null,error:providerFailure('Resend', res.status)};
          }
          const provider=await res.json();
          return {ok:true,id:typeof provider.id==='string'?provider.id:null,error:null as string|null};
            },
            recordOutcome: async(delivery: {id:string},result: {ok:boolean;id:string|null;error:string|null})=>{
              const {error:persistError}=await serviceClient.from('newsletter_recipients').update({status:result.ok?'sent':'failed',error:result.ok?(result.id?`provider_id:${result.id}`:null):result.error}).eq('id',delivery.id);
              if(persistError) throw new Error('Delivery outcome needs manual reconciliation');
              if(!result.ok) throw new Error(`Email provider rejected delivery: ${result.error}`);
            },
          });
          return member.email;
        })
      );

      for (const r of results) {
        if (r.status === "fulfilled") sentCount++;
        else errors.push('Delivery failed or uncertain; manual reconciliation required');
      }

      if (i + 10 < members.length) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }

    const outcome=deliveryOutcome(sentCount,errors.length);
    const {error:stateError}=await serviceClient
      .from("newsletters")
      .update({ delivery_state: outcome.status, status:outcome.success?'sent':newsletter.status, sent_at: outcome.success?new Date().toISOString():null, sent_count: sentCount })
      .eq("id", newsletter_id).eq('delivery_state','sending');
    if(stateError) throw stateError;

    const {error:activityError}=await serviceClient.from("activity_log").insert({
      type: "newsletter_sent",
      payload: { newsletter_id, subject: newsletter.subject, sent_count: sentCount, errors: errors.length },
    });
    if(activityError) console.error('Newsletter completion audit could not be recorded');

    return new Response(JSON.stringify({ ...outcome, errors }), {
      status: outcome.success ? 200 : 502,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch {
    if (recoverDelivery) await recoverDelivery();
    console.error('Newsletter request failed; check persisted delivery state before retrying');
    return new Response(JSON.stringify({ error: 'Utsendingen kunne ikke fullføres. Kontroller leveringsstatus før du prøver igjen.' }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
