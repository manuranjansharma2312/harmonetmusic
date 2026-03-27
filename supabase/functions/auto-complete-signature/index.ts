import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const { document_id } = await req.json();
    if (!document_id) throw new Error("document_id required");

    // Check if auto-send is enabled
    const { data: settings } = await supabase
      .from("signature_settings")
      .select("auto_send_completion")
      .limit(1)
      .maybeSingle();

    if (!(settings as any)?.auto_send_completion) {
      return new Response(JSON.stringify({ skipped: true, reason: "auto_send_completion disabled" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Step 1: Generate certificate
    const certRes = await fetch(`${supabaseUrl}/functions/v1/generate-signature-certificate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${serviceKey}`,
      },
      body: JSON.stringify({ document_id }),
    });

    const certData = await certRes.json();
    if (!certRes.ok || !certData.success) {
      throw new Error(certData.error || "Certificate generation failed");
    }

    // Step 2: Send completion email
    const emailRes = await fetch(`${supabaseUrl}/functions/v1/send-completion-email`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${serviceKey}`,
      },
      body: JSON.stringify({ document_id, auto_triggered: true }),
    });

    const emailData = await emailRes.json();

    return new Response(JSON.stringify({
      success: true,
      certificate: certData,
      emails: emailData,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
