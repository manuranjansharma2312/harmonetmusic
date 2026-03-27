import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function escapeHtml(str: string): string {
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

async function sendSmtp(account: any, to: string, subject: string, html: string) {
  const client = new SMTPClient({
    connection: {
      hostname: account.smtp_host,
      port: account.smtp_port,
      tls: account.smtp_encryption === "ssl",
      auth: {
        username: account.smtp_username,
        password: account.smtp_password,
      },
    },
  });

  await client.send({
    from: `${account.from_name} <${account.from_email}>`,
    to,
    subject,
    content: "Please view this email in an HTML-compatible client.",
    html,
    headers: {
      "Reply-To": account.reply_to_email || account.from_email,
    },
  });

  await client.close();
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const { token } = await req.json();
    if (!token) throw new Error("Token required");

    // Get recipient with document info
    const { data: recipient } = await supabase
      .from("signature_recipients")
      .select("*, signature_documents(*)")
      .eq("signing_token", token)
      .single();

    if (!recipient) throw new Error("Invalid token");

    // Get latest unverified OTP
    const { data: otpData } = await supabase
      .from("signature_otp_logs")
      .select("*")
      .eq("recipient_id", recipient.id)
      .eq("verified", false)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (!otpData) throw new Error("No OTP found");

    // Get default SMTP account
    const { data: emailAccounts } = await supabase
      .from("email_accounts")
      .select("*")
      .eq("is_default", true)
      .eq("is_enabled", true)
      .limit(1);

    const account = emailAccounts?.[0];
    if (!account) throw new Error("No email account configured");

    // Get company details
    const { data: company } = await supabase
      .from("company_details")
      .select("company_name")
      .limit(1)
      .maybeSingle();

    const companyName = company?.company_name || "Harmonet Music";
    const docTitle = (recipient as any).signature_documents?.title || "Document";

    const subject = `Your signing verification code: ${otpData.otp_code}`;
    const emailHtml = `
      <div style="font-family: Arial, Helvetica, sans-serif; max-width: 600px; margin: 0 auto; padding: 30px; color: #333;">
        <div style="border-bottom: 2px solid #1a1a1a; padding-bottom: 15px; margin-bottom: 25px;">
          <h2 style="margin: 0; color: #1a1a1a;">${escapeHtml(companyName)}</h2>
        </div>

        <h3 style="color: #2563eb; margin: 0 0 10px;">Verification Code</h3>
        
        <p>Hello ${escapeHtml(recipient.name)},</p>
        
        <p>Your verification code for signing "<strong>${escapeHtml(docTitle)}</strong>" is:</p>
        
        <div style="background: #f8f9fa; padding: 24px; border-radius: 8px; text-align: center; margin: 24px 0; border: 1px solid #e9ecef;">
          <span style="font-size: 36px; font-weight: bold; letter-spacing: 10px; color: #1a1a1a;">${otpData.otp_code}</span>
        </div>
        
        <p style="color: #666; font-size: 13px;">This code expires in <strong>10 minutes</strong>. Do not share this code with anyone.</p>

        <hr style="border: none; border-top: 1px solid #eee; margin: 25px 0;">
        
        <p style="color: #999; font-size: 11px;">
          If you did not request this code, please ignore this email.
        </p>
        <p style="color: #bbb; font-size: 10px;">
          ${escapeHtml(companyName)} | Secured Electronic Signature System
        </p>
      </div>
    `;

    let status = "sent";
    let errorMessage = null;

    try {
      await sendSmtp(account, recipient.email, subject, emailHtml);
    } catch (smtpErr: any) {
      status = "failed";
      errorMessage = smtpErr.message || "SMTP send failed";
    }

    // Log email
    await supabase.from("email_send_logs").insert({
      template_key: "signature_otp",
      template_label: "Signing OTP",
      recipient_email: recipient.email,
      subject,
      body_html: emailHtml,
      status,
      error_message: errorMessage,
    });

    // Log audit
    await supabase.from("signature_audit_logs").insert({
      document_id: recipient.document_id,
      recipient_id: recipient.id,
      action: "otp_requested",
      metadata: { email: recipient.email, status },
    });

    if (status === "failed") {
      throw new Error(`Failed to send OTP email: ${errorMessage}`);
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
