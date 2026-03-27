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

function replaceVars(template: string, vars: Record<string, string>): string {
  let result = template;
  for (const [key, value] of Object.entries(vars)) {
    result = result.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value);
  }
  return result;
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

    const { document_id } = await req.json();

    // Fetch all needed data in parallel
    const [docRes, recipientsRes, emailAccountsRes, companyRes, settingsRes] = await Promise.all([
      supabase.from("signature_documents").select("*").eq("id", document_id).single(),
      supabase.from("signature_recipients").select("*").eq("document_id", document_id).neq("status", "signed"),
      supabase.from("email_accounts").select("*").eq("is_default", true).eq("is_enabled", true).limit(1),
      supabase.from("company_details").select("*").limit(1).single(),
      supabase.from("signature_settings").select("*").limit(1).maybeSingle(),
    ]);

    const doc = docRes.data;
    if (!doc) throw new Error("Document not found");

    const recipients = recipientsRes.data;
    if (!recipients || recipients.length === 0) {
      return new Response(JSON.stringify({ message: "No pending recipients" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const account = emailAccountsRes.data?.[0];
    if (!account) throw new Error("No email account configured. Please set up an email account in Admin Email Settings first.");

    const companyName = companyRes.data?.company_name || "Harmonet Music";
    const sigSettings = settingsRes.data as any;

    const vars = {
      document_title: doc.title,
      company_name: companyName,
    };

    const subjectTemplate = sigSettings?.signing_email_subject || "Please sign: {{document_title}}";
    const bodyIntro = sigSettings?.signing_email_body || "You have been requested to sign the following document.";

    let emailsSent = 0;

    for (const recipient of recipients) {
      const signingUrl = `${req.headers.get("origin") || supabaseUrl.replace("supabase.co", "lovable.app")}/sign/${recipient.signing_token}`;
      const recipientVars = { ...vars, recipient_name: recipient.name };

      const subject = replaceVars(subjectTemplate, recipientVars);
      const introText = replaceVars(bodyIntro, recipientVars);

      const emailHtml = `
        <div style="font-family: Arial, Helvetica, sans-serif; max-width: 600px; margin: 0 auto; padding: 30px; color: #333;">
          <div style="border-bottom: 2px solid #1a1a1a; padding-bottom: 15px; margin-bottom: 25px;">
            <h2 style="margin: 0; color: #1a1a1a;">${escapeHtml(companyName)}</h2>
          </div>

          <h3 style="color: #2563eb; margin: 0 0 10px;">Document Signing Request</h3>
          
          <p>Hello ${escapeHtml(recipient.name)},</p>
          
          <p>${escapeHtml(introText)}</p>
          
          <div style="background: #f8f9fa; padding: 18px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #2563eb;">
            <p style="font-weight: bold; margin: 0 0 5px; font-size: 16px;">${escapeHtml(doc.title)}</p>
            ${doc.description ? `<p style="color: #666; margin: 5px 0 0; font-size: 13px;">${escapeHtml(doc.description)}</p>` : ""}
          </div>

          <div style="text-align: center; margin: 30px 0;">
            <a href="${signingUrl}" style="display: inline-block; background: #1a1a1a; color: white; padding: 14px 32px; border-radius: 6px; text-decoration: none; font-weight: bold; font-size: 14px;">
              Review & Sign Document
            </a>
          </div>

          <p style="color: #999; font-size: 12px; margin-top: 25px;">
            This link expires in ${sigSettings?.default_expiry_days || 30} days. If you did not expect this request, please ignore this email.
          </p>

          <hr style="border: none; border-top: 1px solid #eee; margin: 25px 0;">
          
          <p style="color: #999; font-size: 11px;">
            This is a legally valid electronic signature request under the Information Technology Act, 2000 (India) - Sections 5 and 10A.
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
        emailsSent++;
      } catch (smtpErr: any) {
        status = "failed";
        errorMessage = smtpErr.message || "SMTP send failed";
      }

      await supabase.from("signature_audit_logs").insert({
        document_id,
        recipient_id: recipient.id,
        action: "email_sent",
        metadata: { email: recipient.email, status },
      });

      await supabase.from("email_send_logs").insert({
        template_key: "signature_request",
        template_label: "Signature Request",
        recipient_email: recipient.email,
        subject,
        body_html: emailHtml,
        status,
        error_message: errorMessage,
        sent_by: doc.created_by,
      });
    }

    return new Response(JSON.stringify({ success: true, emails_sent: emailsSent }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
