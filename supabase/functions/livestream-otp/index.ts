import { createClient } from 'npm:@supabase/supabase-js@2.112.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

function generateCode(): string {
  const digits = '0123456789';
  let code = '';
  const arr = new Uint8Array(6);
  crypto.getRandomValues(arr);
  for (const b of arr) code += digits[b % 10];
  return code;
}

/** Resolves the stream URL server-side: match-specific URL first, then the global setting. */
async function resolveStreamUrl(
  supabase: ReturnType<typeof createClient>,
  matchId: string,
): Promise<string | null> {
  if (matchId && matchId !== '00000000-0000-0000-0000-000000000000') {
    const { data: match } = await supabase
      .from('matches')
      .select('livestream_url')
      .eq('id', matchId)
      .maybeSingle();
    const url = (match as { livestream_url?: string | null } | null)?.livestream_url;
    if (url) return url;
  }
  const { data: setting } = await supabase
    .from('site_settings')
    .select('value')
    .eq('key', 'livestream_url')
    .maybeSingle();
  const raw = (setting as { value?: unknown } | null)?.value;
  return typeof raw === 'string' && raw.trim() ? raw : null;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    const { action, email, match_id, code, video_id, access_token } = await req.json();

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    if (action === 'send') {
      // Validate inputs
      if (!email || !match_id) {
        return new Response(JSON.stringify({ error: 'E-post og kamp-ID er påkrevd' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const normalizedEmail = email.trim().toLowerCase();

      // Check if email exists in memberships
      const { data: member } = await supabase
        .from('memberships')
        .select('id, first_name, status')
        .eq('email', normalizedEmail)
        .maybeSingle();

      if (!member) {
        return new Response(JSON.stringify({ error: 'not_member' }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Rate limit: max 3 codes per email per match per hour
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
      const { count } = await supabase
        .from('livestream_otp')
        .select('id', { count: 'exact', head: true })
        .eq('email', normalizedEmail)
        .eq('match_id', match_id)
        .gte('created_at', oneHourAgo);

      if ((count ?? 0) >= 3) {
        return new Response(JSON.stringify({ error: 'rate_limited' }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Generate and store OTP (valid for 15 minutes)
      const otpCode = generateCode();
      const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();

      await supabase.from('livestream_otp').insert({
        email: normalizedEmail,
        code: otpCode,
        match_id,
        expires_at: expiresAt,
      });

      // Get match info for email (skip for video-access dummy ID)
      const isVideoAccess = match_id === '00000000-0000-0000-0000-000000000000';
      let opponentName = 'motstander';
      if (!isVideoAccess) {
        const { data: match } = await supabase
          .from('matches')
          .select('opponent, match_date')
          .eq('id', match_id)
          .single();
        opponentName = match?.opponent || 'motstander';
      }

      // Send OTP via Resend
      const resendApiKey = Deno.env.get('RESEND_API_KEY');
      if (!resendApiKey) {
        console.error('RESEND_API_KEY not configured');
        return new Response(JSON.stringify({ error: 'Email service not configured' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const firstName = member.first_name || '';
      const greeting = firstName && firstName !== 'Ikke oppgitt' ? `Hei ${firstName}!` : 'Hei!';

      const emailSubject = isVideoAccess
        ? `Din kode for videotilgang: ${otpCode}`
        : `Din kode for direktesendingen: ${otpCode}`;
      const emailContext = isVideoAccess
        ? 'å se beskyttede videoer på fagerborgbk.no'
        : `å se direktesendingen av kampen mot <strong>${opponentName}</strong>`;

      const htmlBody = `
        <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; background: #ffffff;">
          <div style="background: #1a1a2e; padding: 24px; text-align: center; border-radius: 12px 12px 0 0;">
            <h1 style="color: #ffffff; font-size: 20px; margin: 0;">Fagerborg BK</h1>
            <p style="color: rgba(255,255,255,0.7); font-size: 13px; margin: 6px 0 0;">Direktesending</p>
          </div>
          <div style="padding: 32px 24px;">
            <p style="font-size: 16px; color: #1a1a1a; margin: 0 0 8px;">${greeting}</p>
            <p style="font-size: 14px; color: #555; margin: 0 0 24px;">
              Her er din engangskode for ${emailContext}:
            </p>
            <div style="background: #f4f4f8; border-radius: 12px; padding: 24px; text-align: center; margin: 0 0 24px;">
              <p style="font-size: 36px; font-weight: bold; letter-spacing: 8px; color: #1a1a2e; margin: 0;">${otpCode}</p>
              <p style="font-size: 12px; color: #888; margin: 8px 0 0;">Koden er gyldig i 15 minutter</p>
            </div>
            <p style="font-size: 13px; color: #888; margin: 0;">
              Hvis du ikke ba om denne koden, kan du ignorere denne e-posten.
            </p>
          </div>
        </div>
      `;

      const emailRes = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${resendApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: 'Fagerborg BK <post@support.fagerborgbk.no>',
          to: [normalizedEmail],
          subject: emailSubject,
          html: htmlBody,
        }),
      });

      if (!emailRes.ok) {
        const errText = await emailRes.text();
        console.error('Resend error:', errText);
        return new Response(JSON.stringify({ error: 'Kunne ikke sende e-post' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      console.log('OTP sent to:', normalizedEmail);
      return new Response(JSON.stringify({ status: 'sent' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });

    } else if (action === 'verify') {
      if (!email || !match_id || !code) {
        return new Response(JSON.stringify({ error: 'Alle felt er påkrevd' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const normalizedEmail = email.trim().toLowerCase();

      // Find valid, unused OTP
      const { data: otp } = await supabase
        .from('livestream_otp')
        .select('id')
        .eq('email', normalizedEmail)
        .eq('match_id', match_id)
        .eq('code', code)
        .eq('used', false)
        .gte('expires_at', new Date().toISOString())
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!otp) {
        return new Response(JSON.stringify({ valid: false, error: 'invalid_code' }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Mark as used
      await supabase
        .from('livestream_otp')
        .update({ used: true })
        .eq('id', otp.id);

      // Optionally return a protected video URL when unlocking via member OTP
      let video_url: string | undefined;
      if (video_id) {
        const { data: v } = await supabase
          .from('site_videos')
          .select('video_url')
          .eq('id', video_id)
          .eq('status', 'published')
          .eq('is_protected', true)
          .maybeSingle();
        if (v?.video_url) video_url = v.video_url;
      }

      // Issue a short-lived access token and hand out the livestream URL
      const accessToken = crypto.randomUUID() + crypto.randomUUID().replace(/-/g, '');
      const accessExpires = new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString();
      await supabase.from('livestream_access').insert({
        token: accessToken,
        match_id,
        email: normalizedEmail,
        expires_at: accessExpires,
      });

      const livestream_url = await resolveStreamUrl(supabase, match_id);

      return new Response(
        JSON.stringify({ valid: true, video_url, access_token: accessToken, livestream_url }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );

    } else if (action === 'stream_url') {
      // Return the livestream URL only for a valid server-issued access token,
      // or when the club has explicitly turned the member gate off.
      if (!match_id) {
        return new Response(JSON.stringify({ error: 'Kamp-ID er påkrevd' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      let granted = false;
      const token = typeof access_token === 'string' ? access_token : null;
      if (token) {
        const { data: access } = await supabase
          .from('livestream_access')
          .select('id')
          .eq('token', token)
          .eq('match_id', match_id)
          .gte('expires_at', new Date().toISOString())
          .maybeSingle();
        granted = !!access;
      }

      if (!granted) {
        const { data: setting } = await supabase
          .from('site_settings')
          .select('value')
          .eq('key', 'livestream_require_otp')
          .maybeSingle();
        const raw = (setting as { value?: unknown } | null)?.value;
        granted = raw === false || raw === 'false';
      }

      if (!granted) {
        return new Response(JSON.stringify({ livestream_url: null }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const livestream_url = await resolveStreamUrl(supabase, match_id);
      return new Response(JSON.stringify({ livestream_url }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });

    } else {
      return new Response(JSON.stringify({ error: 'Invalid action' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
  } catch (error) {
    console.error('Error:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
