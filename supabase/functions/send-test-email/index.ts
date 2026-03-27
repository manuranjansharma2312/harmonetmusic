import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { SmtpClient } from "https://deno.land/x/smtp@v0.7.0/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Strip HTML tags for plain-text fallback
function htmlToPlainText(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<\/div>/gi, '\n')
    .replace(/<\/h[1-6]>/gi, '\n\n')
    .replace(/<li>/gi, '• ')
    .replace(/<\/li>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

// Generate proper Message-ID header
function generateMessageId(domain: string): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 15);
  return `<${timestamp}.${random}@${domain}>`;
}

// Extract domain from email
function getDomain(email: string): string {
  return email.split('@')[1] || 'harmonetmusic.com';
}

// Wrap HTML in proper email-safe structure with anti-spam best practices
function wrapHtmlEmail(bodyContent: string, previewText: string = ''): string {
  return `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <meta name="x-apple-disable-message-reformatting">
  <meta name="format-detection" content="telephone=no,address=no,email=no,date=no,url=no">
  <title></title>
  <!--[if mso]><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml><![endif]-->
</head>
<body style="margin:0;padding:0;word-spacing:normal;background-color:#f5f5f5;">
  ${previewText ? `<div style="display:none;font-size:1px;color:#f5f5f5;line-height:1px;max-height:0px;max-width:0px;opacity:0;overflow:hidden;">${previewText}</div>` : ''}
  <table role="presentation" style="width:100%;border:none;border-spacing:0;background-color:#f5f5f5;">
    <tr>
      <td align="center" style="padding:20px 0;">
        <table role="presentation" style="width:600px;max-width:100%;border:none;border-spacing:0;background-color:#ffffff;border-radius:8px;">
          <tr>
            <td style="padding:30px 40px;">
              ${bodyContent}
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const anonClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!);
    const { data: { user }, error: authError } = await anonClient.auth.getUser(
      authHeader.replace("Bearer ", "")
    );
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: roleData } = await supabase.rpc("has_role", {
      _user_id: user.id,
      _role: "admin",
    });
    if (!roleData) {
      return new Response(JSON.stringify({ error: "Admin access required" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { test_email, account_id } = await req.json();
    if (!test_email) {
      return new Response(JSON.stringify({ error: "test_email is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get the specific account or the default one
    let account: any = null;
    if (account_id) {
      const { data } = await supabase
        .from("email_accounts")
        .select("*")
        .eq("id", account_id)
        .single();
      account = data;
    }
    if (!account) {
      const { data } = await supabase
        .from("email_accounts")
        .select("*")
        .eq("is_default", true)
        .limit(1)
        .single();
      account = data;
    }
    if (!account) {
      const { data } = await supabase
        .from("email_accounts")
        .select("*")
        .eq("is_enabled", true)
        .limit(1)
        .single();
      account = data;
    }

    // Also try legacy email_settings table if no account found
    if (!account) {
      const { data: settings } = await supabase
        .from("email_settings")
        .select("*")
        .limit(1)
        .single();
      if (settings && settings.is_enabled && settings.smtp_host) {
        account = {
          account_name: "Legacy Settings",
          smtp_host: settings.smtp_host,
          smtp_port: settings.smtp_port,
          smtp_username: settings.smtp_username,
          smtp_password: settings.smtp_password,
          smtp_encryption: settings.smtp_encryption,
          from_email: settings.from_email,
          from_name: settings.from_name,
          is_enabled: settings.is_enabled,
        };
      }
    }

    if (!account) {
      return new Response(JSON.stringify({ error: "No email account configured" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!account.smtp_host || !account.smtp_username || !account.smtp_password) {
      return new Response(JSON.stringify({ error: "SMTP settings incomplete for this account" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const fromEmail = account.from_email || account.smtp_username;
    const fromName = account.from_name || 'Harmonet Music';
    const fromDomain = getDomain(fromEmail);
    const messageId = generateMessageId(fromDomain);
    const subject = `Test Email from ${account.account_name || 'Harmonet Music'}`;
    
    // Anti-spam: proper structured HTML email
    const innerContent = `
      <h2 style="color:#333333;font-family:Arial,Helvetica,sans-serif;font-size:22px;font-weight:bold;margin:0 0 20px 0;">✅ Test Email Successful</h2>
      <p style="color:#555555;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.6;margin:0 0 20px 0;">
        This is a test email sent from your email notification system.
        If you're reading this, your SMTP configuration is working correctly!
      </p>
      <table role="presentation" style="width:100%;border:none;border-spacing:0;background-color:#f5f5f5;border-radius:8px;margin:20px 0;">
        <tr><td style="padding:15px;">
          <p style="margin:5px 0;color:#444444;font-family:Arial,Helvetica,sans-serif;font-size:13px;"><strong>Account:</strong> ${account.account_name || 'N/A'}</p>
          <p style="margin:5px 0;color:#444444;font-family:Arial,Helvetica,sans-serif;font-size:13px;"><strong>SMTP Host:</strong> ${account.smtp_host}</p>
          <p style="margin:5px 0;color:#444444;font-family:Arial,Helvetica,sans-serif;font-size:13px;"><strong>SMTP Port:</strong> ${account.smtp_port}</p>
          <p style="margin:5px 0;color:#444444;font-family:Arial,Helvetica,sans-serif;font-size:13px;"><strong>Encryption:</strong> ${account.smtp_encryption}</p>
          <p style="margin:5px 0;color:#444444;font-family:Arial,Helvetica,sans-serif;font-size:13px;"><strong>From:</strong> ${fromName} &lt;${fromEmail}&gt;</p>
        </td></tr>
      </table>
      <p style="color:#999999;font-family:Arial,Helvetica,sans-serif;font-size:11px;margin:20px 0 0 0;">Sent at: ${new Date().toISOString()}</p>
      <p style="color:#999999;font-family:Arial,Helvetica,sans-serif;font-size:11px;margin:5px 0 0 0;">© ${new Date().getFullYear()} ${fromName}. All rights reserved.</p>
    `;

    const htmlBody = wrapHtmlEmail(innerContent, 'Your SMTP configuration is working correctly!');
    
    // Anti-spam: generate plain-text version
    const plainText = htmlToPlainText(innerContent);

    let sendStatus = "sent";
    let errorMessage: string | null = null;

    try {
      const client = new SmtpClient();
      const connectConfig: any = {
        hostname: account.smtp_host,
        port: account.smtp_port || 587,
        username: account.smtp_username,
        password: account.smtp_password,
      };

      if (account.smtp_encryption === "tls" || account.smtp_encryption === "ssl") {
        await client.connectTLS(connectConfig);
      } else {
        await client.connect(connectConfig);
      }

      // Anti-spam: use proper "Name <email>" format for From
      const formattedFrom = `${fromName} <${fromEmail}>`;

      await client.send({
        from: formattedFrom,
        to: test_email,
        subject,
        content: plainText,
        html: htmlBody,
        headers: {
          "Message-ID": messageId,
          "X-Mailer": "Harmonet Music Mailer",
          "MIME-Version": "1.0",
          "X-Priority": "3",
          "Precedence": "bulk",
          ...(account.reply_to_email ? { "Reply-To": account.reply_to_email } : {}),
          "List-Unsubscribe": `<mailto:unsubscribe@${fromDomain}?subject=unsubscribe>`,
        },
      });

      await client.close();
    } catch (smtpError: any) {
      sendStatus = "failed";
      errorMessage = smtpError.message || "SMTP connection failed";
    }

    await supabase.from("email_send_logs").insert({
      template_key: "test_email",
      template_label: `Test Email (${account.account_name || 'default'})`,
      recipient_email: test_email,
      subject,
      status: sendStatus,
      error_message: errorMessage,
      sent_by: user.id,
      body_html: htmlBody,
    });

    if (sendStatus === "failed") {
      return new Response(
        JSON.stringify({ error: `Failed to send: ${errorMessage}` }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ success: true, message: `Test email sent to ${test_email} via ${account.account_name || 'default account'}` }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: err.message || "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
