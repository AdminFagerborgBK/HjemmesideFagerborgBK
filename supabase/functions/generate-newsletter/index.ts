import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'npm:@supabase/supabase-js@2.112.4';
import { osloWallTimeToIso } from '../_shared/osloWallTime.mjs';
import { readSportsSeason } from '../_shared/sportsSeason.ts';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const serviceClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Optional body: { auto_send?: boolean, audience?: string }
    let body: any = {};
    try { body = await req.json(); } catch { /* no body */ }
    const autoSend = body?.auto_send === true;
    const audience = body?.audience ?? "all";

    // Auth: admin user, service role key, or shared cron secret
    const authHeader = req.headers.get("Authorization") || "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const secretHeader = req.headers.get("x-sync-secret");
    const cronSecrets = [
      Deno.env.get("CRON_SYNC_SECRET"),
      Deno.env.get("MATCHES_SYNC_SECRET"),
      Deno.env.get("NEWSLETTER_CRON_SECRET"),
    ].filter((s): s is string => !!s);
    const isCron =
      authHeader === `Bearer ${serviceRoleKey}` ||
      (!!secretHeader && cronSecrets.includes(secretHeader));

    if (!isCron) {
      // User-triggered, verify admin
      const supabase = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_ANON_KEY")!,
        { global: { headers: { Authorization: authHeader } } }
      );
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Unauthorized");
      const { data: isAdmin } = await serviceClient.rpc("is_admin", { _user_id: user.id });
      if (!isAdmin) throw new Error("Forbidden");
    }

    // Current month boundaries
    const now = new Date();
    const osloDate = new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Oslo'}).format(now);
    const [year, month] = osloDate.split('-').map(Number);
    const monthKey=()=> `${year}-${String(month).padStart(2,'0')}`;
    const boundary=(offset:number)=>{
      const date=new Date(Date.UTC(year,month-1+offset,1,12));
      return osloWallTimeToIso(date.toISOString().slice(0,10),'00:00');
    };
    const monthStart = boundary(0);
    const config=await readSportsSeason(serviceClient);

    // Never generate/send twice for the same month
    const { data: existingThisMonth, error: existingError } = await serviceClient
      .from("newsletters")
      .select("id, status")
      .gte("generated_at", monthStart)
      .lt('generated_at',boundary(1))
      .limit(1);
    if(existingError) throw existingError;
    if (isCron && existingThisMonth && existingThisMonth.length > 0) {
      return new Response(JSON.stringify({ success: true, skipped: true, reason: "Nyhetsbrev finnes allerede denne måneden" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const monthEnd = new Date(Date.parse(boundary(1))-1).toISOString();
    // Previous month boundaries
    const prevMonthStart = boundary(-1);
    const prevMonthEnd = new Date(Date.parse(monthStart)-1).toISOString();
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const since = thirtyDaysAgo.toISOString();

    // Fetch data
    const [newsRes, matchesRes, prevMatchesRes, videosRes, upcomingMatchesRes, standingsRes] = await Promise.all([
      serviceClient.from("news").select("title, excerpt, slug, published_at, image_url")
        .eq("is_published", true).gte("published_at", since).order("published_at", { ascending: false }).limit(10),
      serviceClient.from("matches").select("opponent, match_date, venue, home_score, away_score, is_home, status, competition")
        .gte("match_date", monthStart).lte("match_date", monthEnd).order("match_date", { ascending: true }),
      // Previous month's results
      serviceClient.from("matches").select("opponent, match_date, venue, home_score, away_score, is_home, status, competition")
        .gte("match_date", prevMonthStart).lte("match_date", prevMonthEnd).order("match_date", { ascending: true }),
      serviceClient.from("site_videos").select("title, description, video_url, published_at")
        .eq("status", "published").gte("published_at", since).order("published_at", { ascending: false }).limit(5),
      serviceClient.from("matches").select("id")
        .gte("match_date", monthStart)
        .lt("match_date", boundary(2))
        .limit(1),
      // Current standings for Fagerborg teams
      serviceClient.from("standings").select("team_name, position, played, won, drawn, lost, goals_for, goals_against, points, league, season")
        .eq('season',String(config.season))
        .order("position", { ascending: true }),
    ]);
    for (const result of [newsRes,matchesRes,prevMatchesRes,videosRes,upcomingMatchesRes,standingsRes]) if(result.error) throw result.error;

    const news = newsRes.data || [];
    const matches = matchesRes.data || [];
    const prevMatches = (prevMatchesRes.data || []).filter((m: any) => m.home_score !== null);
    const videos = videosRes.data || [];
    const hasUpcomingMatches = (upcomingMatchesRes.data || []).length > 0;
    const standings = standingsRes.data || [];

    // Find Fagerborg in standings
    const fbStandings = standings.filter((s: any) => 
      s.team_name?.toLowerCase().includes("fagerborg")
    );

    // Skip newsletter during summer break
    const currentMonth = month-1;
    const isSummerMonth = currentMonth >= 5 && currentMonth <= 7;
    if (isCron && isSummerMonth && !hasUpcomingMatches && news.length === 0) {
      return new Response(JSON.stringify({ success: true, skipped: true, reason: "Sommerferie – ingen kamper eller nyheter" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const monthName = now.toLocaleDateString("nb-NO", {timeZone:'Europe/Oslo', month: "long", year: "numeric" });
    const prevMonthName = new Date(prevMonthStart).toLocaleDateString("nb-NO", {timeZone:'Europe/Oslo', month: "long" });

    const formatMatch = (m: any) => {
      const score = m.home_score !== null ? `${m.home_score}-${m.away_score}` : "Ikke spilt ennå";
      const dateStr = new Date(m.match_date).toLocaleDateString("nb-NO", {timeZone:'Europe/Oslo', day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" });
      return `- ${dateStr}: ${m.is_home ? "Fagerborg" : m.opponent} vs ${m.is_home ? m.opponent : "Fagerborg"} (${m.venue}) – ${score} [${m.competition}]`;
    };

    const prompt = `Du er nyhetsbrev-redaktør for Fagerborg BK (Fagerborg BK), en fotballklubb i Oslo.
Lag et HTML-nyhetsbrev for ${monthName}. Bruk klubbens farger (mørkeblå #1a2b4a og gul #d4a843).
Skriv på norsk. Hold det kort og engasjerende. Inkluder en header med klubblogo og en footer med avmeldingslenke.

Bruk {{UNSUBSCRIBE_URL}} som plassholder for avmeldingslenken.
Bruk https://www.fagerborgbk.no som base-URL for lenker.
VIKTIG: Bruk NØYAKTIG denne bilde-URL-en for klubblogoen i headeren, ingen andre: https://fagerborgbk.no/images/fagerborg-logo-email.png

Siste nyheter:
${news.map(n => `- "${n.title}" (${n.published_at?.slice(0,10)}): ${n.excerpt || ""} [/nyheter/${n.slug}]`).join("\n")}

Resultater fra ${prevMonthName}:
${prevMatches.length > 0 ? prevMatches.map(formatMatch).join("\n") : "Ingen kamper forrige måned."}

Kamper denne måneden (${monthName}, kronologisk rekkefølge):
${matches.length > 0 ? matches.map(formatMatch).join("\n") : "Ingen kamper denne måneden."}

Tabellplassering:
${fbStandings.length > 0 ? fbStandings.map((s: any) => `- ${s.team_name} i ${s.league} (${s.season}): ${s.position}. plass – ${s.played} kamper, ${s.won}S/${s.drawn}U/${s.lost}T, ${s.goals_for}-${s.goals_against}, ${s.points} poeng`).join("\n") : "Tabelldata ikke tilgjengelig."}

Siste videoer:
${videos.map(v => `- "${v.title}": ${v.description || ""} [${v.video_url}]`).join("\n")}

${news.length === 0 && matches.length === 0 && prevMatches.length === 0 && videos.length === 0 ? "Det har vært en rolig måned. Lag et kort nyhetsbrev som ser fremover." : ""}

Vis kampene i kronologisk rekkefølge (tidligst dato først). Skill mellom spilte kamper (vis resultat) og kommende kamper.
Inkluder en seksjon med forrige måneds resultater og en seksjon med tabellplassering med kort kommentar.
Returner KUN HTML-koden, ingen markdown-formatering rundt.`;

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: "Du genererer HTML-nyhetsbrev for en norsk fotballklubb. Returner kun ren HTML." },
          { role: "user", content: prompt },
        ],
      }),
    });

    if (!aiRes.ok) {
      const errText = await aiRes.text();
      console.error("AI error:", aiRes.status, errText);
      throw new Error(`AI gateway error: ${aiRes.status}`);
    }

    const aiData = await aiRes.json();
    let html: string = aiData.choices?.[0]?.message?.content || "";
    // Strip markdown code fences if present
    html = html.replace(/^```html\n?/i, "").replace(/\n?```$/i, "").trim();

    // Make sure every image points to a real asset (the model sometimes invents logo paths)
    const LOGO_URL = "https://fagerborgbk.no/images/fagerborg-logo-email.png";
    html = html.replace(/src=["']([^"']+)["']/gi, (match, url) => {
      const u = String(url);
      if (/logo/i.test(u) || !/^https?:\/\//i.test(u)) return `src="${LOGO_URL}"`;
      if (u.includes("fagerborgbk.lovable.app")) return `src="${u.replace("fagerborgbk.lovable.app", "fagerborgbk.no")}"`;
      return match;
    });
    html = html.replace(/https:\/\/fagerborgbk\.lovable\.app/g, "https://fagerborgbk.no");

    const subject = `Fagerborg BK – Nyhetsbrev ${monthName}`;

    // Save draft
    const { data: newsletter, error: insertErr } = await serviceClient
      .from("newsletters")
      .insert({ subject, body_html: html, status: "draft", automatic_month:isCron?monthKey():null })
      .select()
      .single();

    if (insertErr?.code==='23505' && isCron) return new Response(JSON.stringify({success:true,skipped:true,reason:'Månedens automatiske utkast finnes allerede'}),{headers:{...corsHeaders,'Content-Type':'application/json'}});
    if (insertErr) throw insertErr;

    // Automatic send (first Monday of the month)
    let sendResult: any = null;
    if (autoSend) {
      try {
        const sendRes = await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/send-newsletter`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ newsletter_id: newsletter.id, audience }),
        });
        sendResult = await sendRes.json().catch(() => null);
        if (!sendRes.ok || sendResult?.success!==true) throw new Error(`Automatisk utsending feilet [${sendRes.status}]: ${JSON.stringify(sendResult)}`);
      } catch (e) {
        throw e;
      }
    }

    // Send admin notification email
    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    if (RESEND_API_KEY) {
      try {
        const sentOk = sendResult?.success === true;
        const notification = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${RESEND_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: "Fagerborg BK <noreply@support.fagerborgbk.no>",
            to: ["post@fagerborgbk.no"],
            subject: autoSend
              ? (sentOk ? `📬 Nyhetsbrev sendt ut: ${subject}` : `⚠️ Automatisk nyhetsbrev feilet: ${subject}`)
              : `📰 Nyhetsbrev-utkast klart: ${subject}`,
            html: autoSend
              ? (sentOk
                  ? `<p>Månedens nyhetsbrev ble generert og sendt automatisk til ${sendResult?.sent_count ?? 0} mottakere.</p>
<p>Se det i <a href="https://fagerborgbk.lovable.app/admin/newsletters">admin-panelet</a>.</p>`
                  : `<p>Månedens nyhetsbrev ble generert, men den automatiske utsendingen feilet.</p>
<p>Utkastet ligger klart i <a href="https://fagerborgbk.lovable.app/admin/newsletters">admin-panelet</a> for manuell sending.</p>`)
              : `<p>Et nytt nyhetsbrev-utkast er generert og venter på godkjenning.</p>
<p>Gå til <a href="https://fagerborgbk.lovable.app/admin/newsletters">admin-panelet</a> for å se og sende det.</p>`,
          }),
        });
        if (!notification.ok) throw new Error(`Adminvarsel feilet [${notification.status}]: ${await notification.text()}`);
      } catch (e) {
        throw e;
      }
    }

    return new Response(JSON.stringify({ success: true, newsletter, auto_send: autoSend, send: sendResult }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("generate-newsletter error:", e);
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
