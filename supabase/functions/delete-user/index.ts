import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        // Check auth
        const authHeader = req.headers.get('Authorization')
        if (!authHeader) {
            return new Response(JSON.stringify({ error: 'Missing auth header' }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 401,
            })
        }

        const jwt = authHeader.replace('Bearer ', '')
        const supabaseClient = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_ANON_KEY') ?? ''
        )

        const { data: { user }, error: userError } = await supabaseClient.auth.getUser(jwt)

        if (userError || !user) {
            console.error("Auth error:", userError)
            return new Response(JSON.stringify({ error: 'Invalid user token' }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 401,
            })
        }

        // Verify if caller is Admin
        const { data: profile } = await supabaseClient
            .from('user_profiles')
            .select('role')
            .eq('id', user.id)
            .single()

        if (!profile || profile.role !== 'admin') {
            return new Response(JSON.stringify({ error: 'Unauthorized: only admins can delete users' }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 403,
            })
        }

        // Process request body
        const { userIdToDelete } = await req.json()

        if (!userIdToDelete) {
            return new Response(JSON.stringify({ error: 'Missing userIdToDelete' }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 400,
            })
        }

        // Prevent deleting oneself
        if (user.id === userIdToDelete) {
            return new Response(JSON.stringify({ error: 'Cannot delete your own admin account' }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 400,
            })
        }

        // Use Service Role to actually delete the user
        // The service role bypasses RLS and can execute auth.admin commands
        const supabaseAdmin = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        )

        const { data, error } = await supabaseAdmin.auth.admin.deleteUser(userIdToDelete)

        if (error) {
            throw error
        }

        return new Response(JSON.stringify({ success: true, message: 'User deleted safely' }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200,
        })
    } catch (error: any) {
        return new Response(JSON.stringify({ error: error.message }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 400,
        })
    }
})
