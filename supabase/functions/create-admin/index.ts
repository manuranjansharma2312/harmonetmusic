import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

serve(async (req) => {
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  };

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const adminEmail = "admin@musicdist.com";
    const adminPassword = "admin123456";

    // Check if admin already exists
    const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers();
    const existing = existingUsers?.users?.find((u) => u.email === adminEmail);

    if (existing) {
      // Make sure they have admin role
      await supabaseAdmin.from("user_roles").upsert(
        { user_id: existing.id, role: "admin" },
        { onConflict: "user_id,role" }
      );
      return new Response(
        JSON.stringify({ message: "Admin already exists", email: adminEmail }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create admin user
    const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email: adminEmail,
      password: adminPassword,
      email_confirm: true,
    });

    if (createError) throw createError;

    // The trigger auto-creates 'user' role, update it to admin
    await supabaseAdmin.from("user_roles")
      .update({ role: "admin" })
      .eq("user_id", newUser.user.id);

    return new Response(
      JSON.stringify({ message: "Admin created", email: adminEmail, password: adminPassword }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
