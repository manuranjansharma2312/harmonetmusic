import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Verify caller is admin
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: { user: caller } } = await supabaseAdmin.auth.getUser(
      authHeader.replace("Bearer ", "")
    );
    if (!caller) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: isAdmin } = await supabaseAdmin.rpc("has_role", {
      _user_id: caller.id,
      _role: "admin",
    });
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { action, api_key } = await req.json();

    if (action === "get_status") {
      // Only return whether a key is set and masked version — never the full key
      const key = Deno.env.get("CUSTOM_AI_API_KEY") || "";
      const hasKey = key.length > 0;
      const masked = hasKey ? key.slice(0, 6) + "••••••••" + key.slice(-4) : "";
      return new Response(JSON.stringify({ has_key: hasKey, masked_key: masked }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "save_key") {
      if (!api_key || typeof api_key !== "string" || api_key.trim().length < 5) {
        return new Response(JSON.stringify({ error: "Invalid API key" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Store the key in ai_settings for the edge function to read with service role
      // This is safe because only edge functions with service role can read it
      await supabaseAdmin.from("ai_settings").update({
        custom_api_key: api_key.trim(),
        updated_at: new Date().toISOString(),
        updated_by: caller.id,
      }).neq("id", "00000000-0000-0000-0000-000000000000"); // update all rows

      return new Response(JSON.stringify({ success: true, message: "API key saved securely" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "remove_key") {
      await supabaseAdmin.from("ai_settings").update({
        custom_api_key: null,
        updated_at: new Date().toISOString(),
        updated_by: caller.id,
      }).neq("id", "00000000-0000-0000-0000-000000000000");

      return new Response(JSON.stringify({ success: true, message: "API key removed" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Invalid action" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
