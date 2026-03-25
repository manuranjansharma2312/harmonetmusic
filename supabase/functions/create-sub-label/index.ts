import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Verify calling user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header");

    const token = authHeader.replace("Bearer ", "");
    const { data: { user: callingUser }, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !callingUser) throw new Error("Unauthorized");

    const body = await req.json();
    const {
      email, password, sub_label_name, parent_label_name,
      agreement_start_date, agreement_end_date, phone,
      percentage_cut, withdrawal_threshold, b2b_url,
    } = body;

    if (!email || !password || !sub_label_name || !agreement_start_date || !agreement_end_date) {
      throw new Error("Missing required fields");
    }

    // Create auth user
    const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });

    if (createError) throw createError;
    const newUserId = newUser.user!.id;

    try {
      // Create profile for sub-label user
      const { error: profileError } = await supabaseAdmin.from("profiles").insert({
        user_id: newUserId,
        legal_name: sub_label_name,
        email,
        whatsapp_country_code: "+91",
        whatsapp_number: phone || "",
        country: "India",
        state: "N/A",
        address: "N/A",
        user_type: "sub_label",
        record_label_name: sub_label_name,
        verification_status: "pending",
      });

      if (profileError) throw profileError;

      // Create sub_labels record
      const { error: subLabelError } = await supabaseAdmin.from("sub_labels").insert({
        parent_user_id: callingUser.id,
        sub_user_id: newUserId,
        parent_label_name: parent_label_name || "",
        sub_label_name,
        agreement_start_date,
        agreement_end_date,
        email,
        phone: phone || "",
        percentage_cut: percentage_cut || 0,
        b2b_url: b2b_url || null,
      });

      if (subLabelError) throw subLabelError;

      return new Response(JSON.stringify({ success: true, user_id: newUserId }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    } catch (innerError) {
      // Clean up auth user on failure
      await supabaseAdmin.auth.admin.deleteUser(newUserId);
      throw innerError;
    }
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
