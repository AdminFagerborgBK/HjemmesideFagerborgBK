import { createClient } from 'npm:@supabase/supabase-js@2.112.4';
import { htmlEscape } from '../_shared/adminAuth.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const SPOND_SIGNUP_URL = 'https://club.spond.com/landing/signup/fagerborgbk/form/86D1CF4D294B4642A3EEB39CE4A34049';

interface JoinRequest {
  email: string;
  turnstile_token: string;
  website?: string;
  name?: string;
  phone?: string;
  member_role?: string;
  team?: string;
  source?: string;
}

async function verifyTurnstile(token: string, ip: string): Promise<boolean> {
  const secret = Deno.env.get('TURNSTILE_SECRET_KEY');
  if (!secret) {
    console.error('TURNSTILE_SECRET_KEY not configured');
    return false;
  }
  try {
    const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ secret, response: token, remoteip: ip }),
    });
    const result = await response.json();
    console.log('Turnstile verification result:', result);
    return result.success === true;
  } catch (error) {
    console.error('Turnstile verification error:', error);
    return false;
  }
}

function buildMemberWelcomeHtml(memberName: string): string {
  const safeName = htmlEscape(memberName);
  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff; border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden;">
      <div style="background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%); padding: 32px 24px; text-align: center;">
        <h1 style="color: #ffffff; margin: 0; font-size: 24px;">Velkommen til Fagerborg BK! ⚽</h1>
      </div>
      <div style="padding: 24px;">
        <p style="font-size: 16px; color: #333;">Hei${memberName !== 'Ikke oppgitt' ? ` ${safeName}` : ''},</p>
        <p style="font-size: 15px; color: #555; line-height: 1.6;">
          Takk for at du har meldt deg inn i Fagerborg BK! Vi er glade for å ha deg med på laget.
        </p>
        <p style="font-size: 15px; color: #555; line-height: 1.6;">
          For å fullføre innmeldingen må du registrere deg i Spond – klubbens medlemssystem. 
          Medlemskapet ditt blir registrert hos <strong>Norges idrettsforbund (NIF)</strong> gjennom Spond.
        </p>
        <p style="font-size: 15px; color: #555; line-height: 1.6;">
          <strong>Viktig:</strong> Velg «Støttemedlem» som medlemskategori når du registrerer deg.
        </p>
        <div style="text-align: center; margin: 24px 0;">
          <a href="${SPOND_SIGNUP_URL}" style="background-color: #1a1a2e; color: #ffffff; padding: 14px 32px; text-decoration: none; border-radius: 6px; display: inline-block; font-size: 16px; font-weight: bold;">
            Registrer deg i Spond →
          </a>
        </div>
        <p style="font-size: 13px; color: #999; line-height: 1.5; border-top: 1px solid #eee; padding-top: 16px; margin-top: 24px;">
          Medlemskapet ditt aktiveres etter godkjenning og registrering i Spond. 
          Ta kontakt på <a href="mailto:post@fagerborgbk.no" style="color: #1a1a2e;">post@fagerborgbk.no</a> hvis du har spørsmål.
        </p>
      </div>
    </div>
  `;
}

function buildExistingMemberHtml(): string {
  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff; border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden;">
      <div style="background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%); padding: 32px 24px; text-align: center;">
        <h1 style="color: #ffffff; margin: 0; font-size: 24px;">Fagerborg BK</h1>
      </div>
      <div style="padding: 24px;">
        <p style="font-size: 16px; color: #333;">Hei,</p>
        <p style="font-size: 15px; color: #555; line-height: 1.6;">
          Vi ser at du allerede er registrert som medlem i Fagerborg BK – flott!
        </p>
        <p style="font-size: 15px; color: #555; line-height: 1.6;">
          Hvis du ikke allerede har registrert deg i Spond, kan du gjøre det nå. 
          Medlemskapet ditt blir registrert hos <strong>Norges idrettsforbund (NIF)</strong> gjennom Spond.
        </p>
        <p style="font-size: 15px; color: #555; line-height: 1.6;">
          <strong>Viktig:</strong> Velg «Støttemedlem» som medlemskategori når du registrerer deg.
        </p>
        <div style="text-align: center; margin: 24px 0;">
          <a href="${SPOND_SIGNUP_URL}" style="background-color: #1a1a2e; color: #ffffff; padding: 14px 32px; text-decoration: none; border-radius: 6px; display: inline-block; font-size: 16px; font-weight: bold;">
            Registrer deg i Spond →
          </a>
        </div>
        <p style="font-size: 13px; color: #999; line-height: 1.5; border-top: 1px solid #eee; padding-top: 16px; margin-top: 24px;">
          Du kan også logge inn på spillerportalen: <a href="https://spiller.fagerborgbk.no" style="color: #1a1a2e;">spiller.fagerborgbk.no</a>
        </p>
      </div>
    </div>
  `;
}

function buildAdminNotificationHtml(memberName: string, memberEmail: string, memberPhone: string, source?: string): string {
  const safeName = htmlEscape(memberName);
  const safeEmail = htmlEscape(memberEmail);
  const safePhone = htmlEscape(memberPhone);
  const safeSource = source ? htmlEscape(source) : '';
  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #1a1a1a;">Ny innmelding i Fagerborg BK</h2>
      <p>En ny person har meldt seg inn i klubben:</p>
      <table style="border-collapse: collapse; width: 100%; margin: 16px 0;">
        <tr><td style="padding: 8px; border: 1px solid #ddd; font-weight: bold;">Navn</td><td style="padding: 8px; border: 1px solid #ddd;">${safeName}</td></tr>
        <tr><td style="padding: 8px; border: 1px solid #ddd; font-weight: bold;">E-post</td><td style="padding: 8px; border: 1px solid #ddd;">${safeEmail}</td></tr>
        <tr><td style="padding: 8px; border: 1px solid #ddd; font-weight: bold;">Telefon</td><td style="padding: 8px; border: 1px solid #ddd;">${safePhone}</td></tr>
        ${safeSource ? `<tr><td style="padding: 8px; border: 1px solid #ddd; font-weight: bold;">Kilde</td><td style="padding: 8px; border: 1px solid #ddd;">${safeSource}</td></tr>` : ''}
      </table>
      <p style="margin-top: 16px;">
        <a href="https://fagerborgbk.lovable.app/admin/members" style="background-color: #1a1a1a; color: #ffffff; padding: 10px 20px; text-decoration: none; border-radius: 4px; display: inline-block;">
          Se i admin-panelet
        </a>
      </p>
    </div>
  `;
}

async function sendEmail(resendApiKey: string, from: string, to: string[], subject: string, html: string) {
  return fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${resendApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ from, to, subject, html }),
  });
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
    const body: JoinRequest = await req.json();
    const { email, turnstile_token, website, name, phone, source } = body;

    // Honeypot check
    if (website && website.trim() !== '') {
      console.log('Honeypot triggered');
      return new Response(JSON.stringify({ status: 'created' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Validate required fields
    if (!email || typeof email !== 'string') {
      return new Response(JSON.stringify({ error: 'Email is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      return new Response(JSON.stringify({ error: 'Invalid email format' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Verify Turnstile token
    if (!turnstile_token) {
      return new Response(JSON.stringify({ error: 'Captcha token is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const isTestToken = turnstile_token === 'XXXX.DUMMY.TOKEN.XXXX';
    if (!isTestToken) {
      const clientIp = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
                       req.headers.get('cf-connecting-ip') || 'unknown';
      const turnstileValid = await verifyTurnstile(turnstile_token, clientIp);
      if (!turnstileValid) {
        return new Response(JSON.stringify({ error: 'Captcha verification failed' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    } else {
      console.log('Skipping Turnstile verification for test token');
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const resendApiKey = Deno.env.get('RESEND_API_KEY');
    const trimmedEmail = email.trim().toLowerCase();

    // Check if member already exists
    const { data: existingMember } = await supabase
      .from('memberships')
      .select('id, email')
      .eq('email', trimmedEmail)
      .maybeSingle();

    if (existingMember) {
      console.log('Member already exists:', email);

      // Send Spond registration link to existing member
      if (resendApiKey) {
        try {
          await sendEmail(
            resendApiKey,
            'Fagerborg BK <noreply@support.fagerborgbk.no>',
            [trimmedEmail],
            'Registrer deg i Spond – Fagerborg BK',
            buildExistingMemberHtml(),
          );
          console.log('Existing member Spond email sent');
        } catch (e) {
          console.error('Failed to send existing member email:', e);
        }
      }

      return new Response(JSON.stringify({ status: 'exists' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Parse name
    let firstName = '';
    let lastName = '';
    if (name && typeof name === 'string') {
      const nameParts = name.trim().split(/\s+/);
      firstName = nameParts[0] || '';
      lastName = nameParts.slice(1).join(' ') || '';
    }

    // Insert new membership
    const { data: newMember, error: insertError } = await supabase
      .from('memberships')
      .insert({
        email: trimmedEmail,
        first_name: firstName || 'Ikke oppgitt',
        last_name: lastName || '',
        phone: phone?.trim() || null,
        status: 'pending',
        membership_type: 'standard',
        notes: source ? `Kilde: ${source}` : null,
      })
      .select()
      .single();

    if (insertError) {
      console.error('Insert error:', insertError);
      return new Response(JSON.stringify({ error: 'Failed to create membership' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('New member created:', newMember.id);

    // Send emails
    if (resendApiKey) {
      const memberName = [firstName, lastName].filter(Boolean).join(' ') || 'Ikke oppgitt';
      const memberPhone = phone?.trim() || 'Ikke oppgitt';

      // 1. Welcome email to new member with Spond link
      try {
        await sendEmail(
          resendApiKey,
          'Fagerborg BK <noreply@support.fagerborgbk.no>',
          [trimmedEmail],
          'Velkommen til Fagerborg BK – registrer deg i Spond ⚽',
          buildMemberWelcomeHtml(memberName),
        );
        console.log('Welcome email sent to new member');
      } catch (e) {
        console.error('Failed to send welcome email:', e);
      }

      // 2. Admin notification
      try {
        await sendEmail(
          resendApiKey,
          'Fagerborg BK <post@support.fagerborgbk.no>',
          ['post@fagerborgbk.no', 'guillaume@fagerborgbk.no'],
          `Ny innmelding: ${memberName}`,
          buildAdminNotificationHtml(memberName, trimmedEmail, memberPhone, source),
        );
        console.log('Admin notification sent');
      } catch (e) {
        console.error('Failed to send admin notification:', e);
      }
    }

    return new Response(JSON.stringify({ status: 'created', id: newMember.id }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error processing join request:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
