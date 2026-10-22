import { createClient } from 'npm:@supabase/supabase-js@2.112.4';

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

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    // Parse the request body to determine the action
    let body: {
      action?: string;
      id?: string;
      status?: string;
      notes?: string;
      newsletter_opt_out?: boolean;
      interests?: string[];
    } = {};
    
    try {
      body = await req.json();
    } catch {
      // No body or invalid JSON - treat as list action
      body = { action: 'list' };
    }

    const { action = 'list', id, status, notes, newsletter_opt_out, interests } = body;

    console.log('Admin memberships action:', action, 'id:', id);

    // LIST - Get all memberships
    if (action === 'list') {
      const { data, error } = await supabase
        .from('memberships')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error listing memberships:', error);
        throw error;
      }

      return new Response(JSON.stringify(data), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // UPDATE - Update membership status
    if (action === 'update') {
      if (!id) {
        return new Response(JSON.stringify({ error: 'ID is required' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const updateData: Record<string, unknown> = {};
      if (status) updateData.status = status;
      if (notes !== undefined) updateData.notes = notes;
      if (typeof newsletter_opt_out === 'boolean') updateData.newsletter_opt_out = newsletter_opt_out;
      if (Array.isArray(interests)) {
        const allowed = ['kamper', 'ungdom', 'dugnad', 'arrangementer', 'sponsor'];
        updateData.interests = interests.filter((i) => typeof i === 'string' && allowed.includes(i));
      }

      const { error } = await supabase
        .from('memberships')
        .update(updateData)
        .eq('id', id);

      if (error) {
        console.error('Error updating membership:', error);
        throw error;
      }

      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // DELETE - Remove membership
    if (action === 'delete') {
      if (!id) {
        return new Response(JSON.stringify({ error: 'ID is required' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      console.log('Deleting membership with id:', id);

      const { error } = await supabase
        .from('memberships')
        .delete()
        .eq('id', id);

      if (error) {
        console.error('Error deleting membership:', error);
        throw error;
      }

      console.log('Successfully deleted membership:', id);

      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ error: 'Invalid action' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in admin-memberships:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
