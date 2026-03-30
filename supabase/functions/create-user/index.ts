import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const adminClient = createClient(supabaseUrl, serviceKey);

    // Verify caller is admin
    const authHeader = req.headers.get("Authorization")!;
    const callerClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user } } = await callerClient.auth.getUser();
    if (!user) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const { data: roleData } = await adminClient.from("user_roles").select("role").eq("user_id", user.id).eq("role", "admin").maybeSingle();
    if (!roleData) return new Response(JSON.stringify({ error: "Admin only" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const body = await req.json();
    const {
      email, password, user_type, artist_name, record_label_name,
      legal_name, whatsapp_country_code, whatsapp_number,
      country, state, address, hidden_cut_percent,
      instagram_link, facebook_link, spotify_link, youtube_link,
    } = body;

    // Validate required fields
    if (!email || !password || !user_type || !legal_name || !whatsapp_number || !country || !state || !address) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (user_type === 'artist' && !artist_name) {
      return new Response(JSON.stringify({ error: "Artist name is required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    if (user_type === 'record_label' && !record_label_name) {
      return new Response(JSON.stringify({ error: "Record label name is required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Create user in auth
    const { data: newUser, error: createError } = await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });

    if (createError || !newUser?.user) {
      return new Response(JSON.stringify({ error: createError?.message || "Failed to create user" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const userId = newUser.user.id;

    // Assign user role
    await adminClient.from("user_roles").insert({ user_id: userId, role: "user" });

    // Create profile
    const { error: profileError } = await adminClient.from("profiles").insert({
      user_id: userId,
      email,
      user_type,
      artist_name: user_type === 'artist' ? artist_name : null,
      record_label_name: user_type === 'record_label' ? record_label_name : null,
      legal_name,
      whatsapp_country_code: whatsapp_country_code || '+91',
      whatsapp_number,
      country,
      state,
      address,
      hidden_cut_percent: hidden_cut_percent || 0,
      instagram_link: instagram_link || null,
      facebook_link: facebook_link || null,
      spotify_link: spotify_link || null,
      youtube_link: youtube_link || null,
      verification_status: 'verified',
    });

    if (profileError) {
      // Cleanup: delete the auth user if profile creation fails
      await adminClient.auth.admin.deleteUser(userId);
      return new Response(JSON.stringify({ error: profileError.message }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({ success: true, user_id: userId }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
