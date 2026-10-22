import { createClient } from 'npm:@supabase/supabase-js@2.112.4';
import { Resend } from 'npm:resend@4.0.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

async function verifyAdmin(authHeader: string | null): Promise<{ isAdmin: boolean; userId?: string }> {
  if (!authHeader) return { isAdmin: false };

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } },
  });

  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return { isAdmin: false };

  const supabaseService = createClient(supabaseUrl, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  const { data: isAdmin } = await supabaseService.rpc('is_admin', { _user_id: user.id });

  return { isAdmin: !!isAdmin, userId: user.id };
}

interface EmailRequest {
  to: string[];
  subject: string;
  html: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const authHeader = req.headers.get('Authorization');
  const { isAdmin } = await verifyAdmin(authHeader);

  if (!isAdmin) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const resendApiKey = Deno.env.get('RESEND_API_KEY');
  if (!resendApiKey) {
    console.error('RESEND_API_KEY is not configured');
    return new Response(JSON.stringify({ error: 'Email service not configured' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const resend = new Resend(resendApiKey);

  try {
    const { to, subject, html }: EmailRequest = await req.json();

    if (!to || to.length === 0 || !subject || !html) {
      return new Response(JSON.stringify({ error: 'Missing required fields: to, subject, html' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`Sending email to ${to.length} recipient(s): ${to.join(', ')}`);

    // Send to each recipient individually for better deliverability
    const results = [];
    for (const recipient of to) {
      try {
        const { data, error } = await resend.emails.send({
          from: 'Fagerborg BK <post@support.fagerborgbk.no>',
          to: [recipient],
          subject,
          html,
        });

        if (error) {
          console.error(`Failed to send to ${recipient}:`, error);
          results.push({ email: recipient, success: false, error: error.message });
        } else {
          console.log(`Successfully sent to ${recipient}:`, data);
          results.push({ email: recipient, success: true, id: data?.id });
        }
      } catch (err) {
        console.error(`Exception sending to ${recipient}:`, err);
        results.push({ email: recipient, success: false, error: String(err) });
      }
    }

    const successful = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;

    return new Response(JSON.stringify({ 
      success: true, 
      sent: successful,
      failed,
      results 
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error sending email:', error);
    return new Response(JSON.stringify({ error: 'Failed to send email' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
