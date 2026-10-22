import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'npm:@supabase/supabase-js@2.112.4'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

    // Create admin client with service role
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey)

    // Get the authorization header to verify the requesting user
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Create a client with the user's token to verify they're an admin
    const supabaseClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authHeader } }
    })

    // Get the current user
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser()
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Check if the user is a superadmin
    const { data: roles } = await supabaseAdmin
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .in('role', ['superadmin'])

    if (!roles || roles.length === 0) {
      return new Response(
        JSON.stringify({ error: 'Only superadmins can access this endpoint' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const { action, email, role, userId, adminRoleId } = await req.json()

    // List all registered users (for board member selection)
    if (action === 'list-all-users') {
      const { data: authUsers, error: listError } = await supabaseAdmin.auth.admin.listUsers()
      if (listError) throw listError

      const users = authUsers.users.map(u => ({
        id: u.id,
        email: u.email,
        created_at: u.created_at,
      }))

      return new Response(
        JSON.stringify({ data: users }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // List role definitions
    if (action === 'list-role-definitions') {
      const { data: roleDefs, error } = await supabaseAdmin
        .from('admin_role_definitions')
        .select('*')
        .order('name')

      if (error) throw error

      return new Response(
        JSON.stringify({ data: roleDefs }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (action === 'list') {
      // Get all admin roles with their role definitions
      const { data: adminRoles, error: rolesError } = await supabaseAdmin
        .from('user_roles')
        .select('*, admin_role_definitions(*)')
        .in('role', ['site_admin', 'superadmin'])
        .order('created_at', { ascending: false })

      if (rolesError) throw rolesError

      // Get user emails for each role
      const enrichedRoles = await Promise.all(
        adminRoles.map(async (roleEntry) => {
          const { data: authUser } = await supabaseAdmin.auth.admin.getUserById(roleEntry.user_id)
          return {
            ...roleEntry,
            email: authUser?.user?.email || 'Ukjent e-post',
            admin_role: roleEntry.admin_role_definitions
          }
        })
      )

      return new Response(
        JSON.stringify({ data: enrichedRoles }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (action === 'add') {
      if (!email || !role) {
        return new Response(
          JSON.stringify({ error: 'Email and role are required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      // Find user by email
      const { data: authUsers, error: listError } = await supabaseAdmin.auth.admin.listUsers()
      if (listError) throw listError

      let targetUser = authUsers.users.find(u => u.email === email)
      
      // If user doesn't exist, create an invited user
      if (!targetUser) {
        const tempPassword = crypto.randomUUID()
        const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
          email,
          password: tempPassword,
          email_confirm: true, // Auto-confirm email since we're inviting them
        })
        
        if (createError) {
          return new Response(
            JSON.stringify({ error: `Kunne ikke opprette bruker: ${createError.message}` }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }
        
        targetUser = newUser.user
        
        // Send password reset email so user can set their own password
        const baseUrl = Deno.env.get('SITE_URL') || supabaseUrl.replace('.supabase.co', '.lovable.app')
        const { error: resetError } = await supabaseAdmin.auth.admin.generateLink({
          type: 'recovery',
          email,
          options: {
            redirectTo: `${baseUrl}/auth?type=recovery`,
          }
        })
        
        if (resetError) {
          console.error('Could not generate reset link:', resetError)
        }
      }

      // Add the role
      const { data, error: insertError } = await supabaseAdmin
        .from('user_roles')
        .insert({ 
          user_id: targetUser.id, 
          role,
          admin_role_id: adminRoleId || null
        })
        .select()
        .single()

      if (insertError) {
        if (insertError.message.includes('duplicate')) {
          return new Response(
            JSON.stringify({ error: 'Brukeren har allerede denne rollen' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }
        throw insertError
      }

      // Log the action
      await supabaseAdmin.from('activity_log').insert({
        type: 'admin_role_added',
        payload: { email, role, admin_role_id: adminRoleId, added_by: user.id }
      })

      return new Response(
        JSON.stringify({ data: { ...data, email } }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (action === 'update-role') {
      if (!userId || !adminRoleId) {
        return new Response(
          JSON.stringify({ error: 'User ID and admin role ID are required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      const { error: updateError } = await supabaseAdmin
        .from('user_roles')
        .update({ admin_role_id: adminRoleId })
        .eq('user_id', userId)
        .eq('role', 'site_admin')

      if (updateError) throw updateError

      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (action === 'remove') {
      if (!userId || !role) {
        return new Response(
          JSON.stringify({ error: 'User ID and role are required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      // Remove the role
      const { error: deleteError } = await supabaseAdmin
        .from('user_roles')
        .delete()
        .eq('user_id', userId)
        .eq('role', role)

      if (deleteError) throw deleteError

      // Log the action
      await supabaseAdmin.from('activity_log').insert({
        type: 'admin_role_removed',
        payload: { user_id: userId, role, removed_by: user.id }
      })

      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (action === 'send-password-reset') {
      if (!email) {
        return new Response(
          JSON.stringify({ error: 'Email is required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      const baseUrl = Deno.env.get('SITE_URL') || 'https://fagerborgbk.lovable.app'
      
      const { error: resetError } = await supabaseAdmin.auth.resetPasswordForEmail(email, {
        redirectTo: `${baseUrl}/auth?type=recovery`,
      })

      if (resetError) throw resetError

      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    return new Response(
      JSON.stringify({ error: 'Unknown action' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    console.error('Error:', error)
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
