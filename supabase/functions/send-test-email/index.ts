import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { SmtpClient } from "https://deno.land/x/smtp@v0.7.0/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

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
      // Fallback to default account
      const { data } = await supabase
        .from("email_accounts")
        .select("*")
        .eq("is_default", true)
        .limit(1)
        .single();
      account = data;
    }
    if (!account) {
      // Fallback to any enabled account
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

    const subject = `Test Email from ${account.account_name || 'Harmonet Music'}`;
    const htmlBody = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h2 style="color: #333;">✅ Test Email Successful</h2>
        <p style="color: #666; line-height: 1.6;">
          This is a test email sent from your email notification system.
          If you're reading this, your SMTP configuration is working correctly!
        </p>
        <div style="background: #f5f5f5; padding: 15px; border-radius: 8px; margin: 20px 0;">
          <p style="margin: 5px 0; color: #444;"><strong>Account:</strong> ${account.account_name || 'N/A'}</p>
          <p style="margin: 5px 0; color: #444;"><strong>SMTP Host:</strong> ${account.smtp_host}</p>
          <p style="margin: 5px 0; color: #444;"><strong>SMTP Port:</strong> ${account.smtp_port}</p>
          <p style="margin: 5px 0; color: #444;"><strong>Encryption:</strong> ${account.smtp_encryption}</p>
          <p style="margin: 5px 0; color: #444;"><strong>From:</strong> ${account.from_name || ''} &lt;${account.from_email || account.smtp_username}&gt;</p>
        </div>
        <p style="color: #999; font-size: 12px;">Sent at: ${new Date().toISOString()}</p>
      </div>
    `;

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

      await client.send({
        from: account.from_email || account.smtp_username,
        to: test_email,
        subject,
        content: "Test email - view in HTML-compatible client",
        html: htmlBody,
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
