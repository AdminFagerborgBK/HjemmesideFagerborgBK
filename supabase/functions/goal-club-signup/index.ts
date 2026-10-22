import { createClient } from 'npm:@supabase/supabase-js@2.112.4';
import { z } from 'npm:zod@3.25.76';
import { readSportsSeason } from '../_shared/sportsSeason.ts';
import { htmlEscape } from '../_shared/adminAuth.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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
    const { name, is_company, phone, email, amount_per_goal, goal_guess, is_anonymous } = z.object({ name:z.string().trim().min(2).max(200),email:z.string().trim().email().max(255).transform(v=>v.toLowerCase()),phone:z.string().max(50).optional().default(''),is_company:z.boolean().optional().default(false),is_anonymous:z.boolean().optional().default(false),amount_per_goal:z.number().int().min(5).max(10000),goal_guess:z.number().int().min(0).max(500)}).parse(await req.json());

    if (!name || !email || goal_guess === undefined || !amount_per_goal) {
      return new Response(JSON.stringify({ error: 'Missing required fields' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!supabaseUrl || !supabaseServiceKey) throw new Error('Tjenesten er ikke konfigurert');
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const {season:requestedSeason}=await readSportsSeason(supabase);

    const { data, error } = await supabase
      .from('goal_club_entries')
      .insert({ season:requestedSeason, name, is_company: is_company || false, phone: phone || null, email, amount_per_goal, goal_guess, is_anonymous: is_anonymous || false })
      .select()
      .single();

    if (error) {
      console.error('Insert error:', error);
      return new Response(JSON.stringify({ error: 'Failed to register' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const season=data.season;
    const resendApiKey = Deno.env.get('RESEND_API_KEY');
    if (resendApiKey) {
      const type = is_company ? 'Selskap' : 'Privatperson';
      const safeName = htmlEscape(name);
      const safeEmail = htmlEscape(email);
      const safePhone = htmlEscape(phone || 'Ikke oppgitt');
      const safeAmount = htmlEscape(amount_per_goal);
      const safeGuess = htmlEscape(goal_guess);

      // 1. Admin notification email
      try {
        const adminHtml = `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #1a1a1a;">Ny påmelding i Målklubben ${season} ⚽</h2>
            <table style="border-collapse: collapse; width: 100%; margin: 16px 0;">
              <tr><td style="padding: 8px; border: 1px solid #ddd; font-weight: bold;">Type</td><td style="padding: 8px; border: 1px solid #ddd;">${type}</td></tr>
              <tr><td style="padding: 8px; border: 1px solid #ddd; font-weight: bold;">Navn</td><td style="padding: 8px; border: 1px solid #ddd;">${safeName}</td></tr>
              <tr><td style="padding: 8px; border: 1px solid #ddd; font-weight: bold;">E-post</td><td style="padding: 8px; border: 1px solid #ddd;">${safeEmail}</td></tr>
              <tr><td style="padding: 8px; border: 1px solid #ddd; font-weight: bold;">Telefon</td><td style="padding: 8px; border: 1px solid #ddd;">${safePhone}</td></tr>
              <tr><td style="padding: 8px; border: 1px solid #ddd; font-weight: bold;">Beløp per mål</td><td style="padding: 8px; border: 1px solid #ddd;">${safeAmount} kr</td></tr>
              <tr><td style="padding: 8px; border: 1px solid #ddd; font-weight: bold;">Måltips</td><td style="padding: 8px; border: 1px solid #ddd;">${safeGuess} mål</td></tr>
            </table>
            <p style="margin-top: 16px;">
              <a href="https://fagerborgbk.lovable.app/admin/goal-club" style="background-color: #1a1a1a; color: #ffffff; padding: 10px 20px; text-decoration: none; border-radius: 4px; display: inline-block;">
                Se i admin-panelet
              </a>
            </p>
          </div>
        `;

        await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${resendApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from: 'Fagerborg BK <post@support.fagerborgbk.no>',
            to: ['post@fagerborgbk.no', 'guillaume@fagerborgbk.no'],
            subject: `Ny i Målklubben: ${safeName} (${safeAmount} kr/mål)`,
            html: adminHtml,
          }),
        });
        console.log('Admin notification sent');
      } catch (emailError) {
        console.error('Admin email failed:', emailError);
      }

      // 2. Confirmation email to the member
      try {
        const confirmationHtml = `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #1a1a1a;">
            <div style="text-align: center; padding: 24px 0;">
              <h1 style="color: #1a365d; margin: 0; font-size: 24px;">Velkommen til Målklubben ${season}! ⚽</h1>
            </div>
            <div style="padding: 24px; background: #f8fafc; border-radius: 12px; margin: 16px 0;">
              <p style="margin: 0 0 16px; font-size: 16px;">Hei ${safeName},</p>
              <p style="margin: 0 0 16px; line-height: 1.6;">
                Takk for at du melder deg inn i Målklubben ${season}! Din støtte betyr mye for Fagerborg BK.
              </p>
              <p style="margin: 0 0 8px; font-weight: bold;">Din påmelding:</p>
              <table style="border-collapse: collapse; width: 100%; margin: 8px 0 16px;">
                <tr>
                  <td style="padding: 10px 12px; background: #ffffff; border: 1px solid #e2e8f0; font-weight: 600;">Inngangsbeløp per scoring</td>
                  <td style="padding: 10px 12px; background: #ffffff; border: 1px solid #e2e8f0;">${safeAmount} kr</td>
                </tr>
                <tr>
                  <td style="padding: 10px 12px; background: #ffffff; border: 1px solid #e2e8f0; font-weight: 600;">Ditt måltips</td>
                  <td style="padding: 10px 12px; background: #ffffff; border: 1px solid #e2e8f0;">${safeGuess} mål</td>
                </tr>
              </table>
              <p style="margin: 0 0 16px; line-height: 1.6;">
                Du vil motta en faktura ved sesongslutt basert på antall mål scoret av Fagerborg i serie og NM gjennom ${season}-sesongen.
              </p>
              <p style="margin: 0 0 16px; line-height: 1.6;">
                Den som gjetter nærmest antall mål vinner en premie! 🏆
              </p>
            </div>
            <div style="text-align: center; padding: 16px 0; color: #64748b; font-size: 13px;">
              <p style="margin: 0;">Med vennlig hilsen,<br/><strong>Fagerborg BK</strong></p>
            </div>
          </div>
        `;

        await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${resendApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from: 'Fagerborg BK <noreply@support.fagerborgbk.no>',
            to: [email],
            subject: `Velkommen til Målklubben ${season}! ⚽`,
            html: confirmationHtml,
          }),
        });
        console.log('Confirmation email sent to', email);
      } catch (emailError) {
        console.error('Confirmation email failed:', emailError);
      }
    }

    return new Response(JSON.stringify({ status: 'created', id: data.id }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: error instanceof z.ZodError ? 400 : 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});