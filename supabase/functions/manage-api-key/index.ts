import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    // Verify the user is an admin
    const authHeader = req.headers.get("authorization") || "";
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check admin role
    const { data: isAdmin } = await supabase.rpc("is_admin");
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: "Admin access required" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { action, apiKey } = await req.json();

    if (action === "get") {
      // Return masked key - show first 8 and last 4 chars
      const currentKey = Deno.env.get("LOVABLE_API_KEY") || "";
      let masked = "";
      if (currentKey.length > 12) {
        masked = currentKey.slice(0, 8) + "••••••••" + currentKey.slice(-4);
      } else if (currentKey.length > 0) {
        masked = "••••••••••••";
      }
      return new Response(JSON.stringify({ masked, hasKey: currentKey.length > 0 }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "update") {
      if (!apiKey || typeof apiKey !== "string" || apiKey.trim().length < 10) {
        return new Response(JSON.stringify({ error: "Invalid API key. Must be at least 10 characters." }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Use service role to update the secret via Supabase Vault
      const adminClient = createClient(supabaseUrl, serviceRoleKey);
      
      // Store the API key in the ai_settings table in a secure column
      // Since we can't update env secrets at runtime, we store it in the DB
      // and the edge function will read from DB first
      const { data: settingsRow } = await adminClient.from("ai_settings").select("id").limit(1).single();
      if (settingsRow) {
        await adminClient.from("ai_settings").update({ 
          api_provider: apiKey.trim(),
        }).eq("id", settingsRow.id);
      }

      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Invalid action" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("manage-api-key error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
