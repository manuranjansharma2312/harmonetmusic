import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
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
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const { document_id, auto_triggered } = await req.json();
    if (!document_id) throw new Error("document_id required");

    // If not auto-triggered, verify admin auth
    if (!auto_triggered) {
      const authHeader = req.headers.get("Authorization");
      if (!authHeader) throw new Error("Unauthorized");
      const token = authHeader.replace("Bearer ", "");
      const { data: { user } } = await supabase.auth.getUser(token);
      if (!user) throw new Error("Unauthorized");

      const { data: roleCheck } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .eq("role", "admin")
        .single();
      if (!roleCheck) throw new Error("Admin access required");
    }

    // Fetch all needed data in parallel
    const [docRes, recipientsRes, companyRes, emailAccountsRes, settingsRes] = await Promise.all([
      supabase.from("signature_documents").select("*").eq("id", document_id).single(),
      supabase.from("signature_recipients").select("*").eq("document_id", document_id).order("signing_order"),
      supabase.from("company_details").select("*").limit(1).single(),
      supabase.from("email_accounts").select("*").eq("is_default", true).eq("is_enabled", true).limit(1),
      supabase.from("signature_settings").select("*").limit(1).maybeSingle(),
    ]);

    const doc = docRes.data;
    if (!doc) throw new Error("Document not found");
    if (doc.status !== "completed") throw new Error("Document not yet completed");

    const recipients = recipientsRes.data;
    if (!recipients || recipients.length === 0) throw new Error("No recipients found");

    const account = emailAccountsRes.data?.[0];
    if (!account) throw new Error("No email account configured. Please set up an email account in Admin Email Settings first.");

    const companyName = companyRes.data?.company_name || "Harmonet Music";
    const sigSettings = settingsRes.data as any;

    // Get signed PDF download URL
    let downloadUrl = "";
    if (doc.signed_pdf_url) {
      const { data: signedUrl } = await supabase.storage
        .from("signature-documents")
        .createSignedUrl(doc.signed_pdf_url, 60 * 60 * 24 * 7);
      if (signedUrl) downloadUrl = signedUrl.signedUrl;
    }
    if (!downloadUrl) throw new Error("Signed PDF not found. Generate certificate first.");

    const subjectTemplate = sigSettings?.completion_email_subject || "Completed: {{document_title}} - Signed Document & Certificate";
    const bodyIntro = sigSettings?.completion_email_body || "The following document has been successfully signed by all parties.";

    let emailsSent = 0;

    for (const recipient of recipients) {
      const vars = {
        document_title: doc.title,
        company_name: companyName,
        recipient_name: recipient.name,
        certificate_id: doc.certificate_url || "N/A",
      };

      const subject = replaceVars(subjectTemplate, vars);
      const introText = replaceVars(bodyIntro, vars);

      const emailHtml = `
        <div style="font-family: Arial, Helvetica, sans-serif; max-width: 600px; margin: 0 auto; padding: 30px; color: #333;">
          <div style="border-bottom: 2px solid #1a1a1a; padding-bottom: 15px; margin-bottom: 25px;">
            <h2 style="margin: 0; color: #1a1a1a;">${escapeHtml(companyName)}</h2>
          </div>

          <h3 style="color: #16a34a; margin: 0 0 10px;">Document Signing Completed</h3>
          
          <p>Hello ${escapeHtml(recipient.name)},</p>
          
          <p>${escapeHtml(introText)}</p>
          
          <div style="background: #f8f9fa; padding: 18px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #16a34a;">
            <p style="font-weight: bold; margin: 0 0 5px; font-size: 16px;">${escapeHtml(doc.title)}</p>
            ${doc.description ? `<p style="color: #666; margin: 5px 0 0; font-size: 13px;">${escapeHtml(doc.description)}</p>` : ""}
            <p style="color: #999; margin: 8px 0 0; font-size: 12px;">Certificate ID: ${doc.certificate_url || "N/A"}</p>
          </div>

          <p style="font-size: 13px; color: #555;">The signed document includes a <strong>Certificate of Completion</strong> as the last page, containing:</p>
          <ul style="font-size: 13px; color: #555; line-height: 1.8;">
            <li>SHA-256 document hash for integrity verification</li>
            <li>Signer details with IP addresses and timestamps</li>
            <li>Complete audit trail of the signing process</li>
            <li>Legal compliance under IT Act 2000 (India)</li>
          </ul>

          <div style="text-align: center; margin: 30px 0;">
            <a href="${downloadUrl}" style="display: inline-block; background: #1a1a1a; color: white; padding: 14px 32px; border-radius: 6px; text-decoration: none; font-weight: bold; font-size: 14px;">
              Download Signed Document
            </a>
          </div>

          <p style="color: #999; font-size: 12px; margin-top: 25px;">
            This download link is valid for 7 days. Please download and save your copy for records.
          </p>

          <hr style="border: none; border-top: 1px solid #eee; margin: 25px 0;">
          
          <p style="color: #999; font-size: 11px;">
            This is a legally valid electronic signature under the Information Technology Act, 2000 (India) - Sections 5 and 10A.
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

      await supabase.from("email_send_logs").insert({
        template_key: "signature_completed",
        template_label: "Signature Completed",
        recipient_email: recipient.email,
        subject,
        body_html: emailHtml,
        status,
        error_message: errorMessage,
        sent_by: doc.created_by,
      });

      await supabase.from("signature_audit_logs").insert({
        document_id,
        recipient_id: recipient.id,
        action: "completion_email_sent",
        metadata: { email: recipient.email, status },
      });
    }

    return new Response(JSON.stringify({ 
      success: true, 
      emails_sent: emailsSent,
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
