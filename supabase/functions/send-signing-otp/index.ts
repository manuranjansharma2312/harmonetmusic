import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const { token } = await req.json();

    // Get recipient
    const { data: recipient } = await supabase
      .from("signature_recipients")
      .select("*, signature_documents(*)")
      .eq("signing_token", token)
      .single();

    if (!recipient) throw new Error("Invalid token");

    // Get latest OTP
    const { data: otpData } = await supabase
      .from("signature_otp_logs")
      .select("*")
      .eq("recipient_id", recipient.id)
      .eq("verified", false)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (!otpData) throw new Error("No OTP found");

    // Get SMTP account
    const { data: emailAccounts } = await supabase
      .from("email_accounts")
      .select("*")
      .eq("is_default", true)
      .eq("is_enabled", true)
      .limit(1);

    const account = emailAccounts?.[0];

    // Log the OTP email
    await supabase.from("email_send_logs").insert({
      template_key: "signature_otp",
      template_label: "Signing OTP",
      recipient_email: recipient.email,
      subject: `Your signing verification code: ${otpData.otp_code}`,
      body_html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2>Verification Code</h2>
          <p>Hello ${recipient.name},</p>
          <p>Your verification code for signing "${recipient.signature_documents?.title}" is:</p>
          <div style="background: #f5f5f5; padding: 20px; border-radius: 8px; text-align: center; margin: 20px 0;">
            <span style="font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #2563eb;">${otpData.otp_code}</span>
          </div>
          <p style="color: #666;">This code expires in 10 minutes.</p>
          <p style="color: #999; font-size: 12px; margin-top: 20px;">
            If you did not request this code, please ignore this email.
          </p>
        </div>
      `,
      status: "sent",
    });

    // Log audit
    await supabase.from("signature_audit_logs").insert({
      document_id: recipient.document_id,
      recipient_id: recipient.id,
      action: "otp_requested",
      metadata: { email: recipient.email },
    });

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
