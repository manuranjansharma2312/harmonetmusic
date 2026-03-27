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

    // Verify user is admin
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

    const { test_email } = await req.json();
    if (!test_email) {
      return new Response(JSON.stringify({ error: "test_email is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get SMTP settings
    const { data: settings, error: settingsError } = await supabase
      .from("email_settings")
      .select("*")
      .limit(1)
      .single();

    if (settingsError || !settings) {
      return new Response(JSON.stringify({ error: "Email settings not configured" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!settings.is_enabled) {
      return new Response(JSON.stringify({ error: "Email system is disabled" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!settings.smtp_host || !settings.smtp_username || !settings.smtp_password) {
      return new Response(JSON.stringify({ error: "SMTP settings incomplete" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const subject = "Test Email from Harmonet Music";
    const htmlBody = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h2 style="color: #333;">✅ Test Email Successful</h2>
        <p style="color: #666; line-height: 1.6;">
          This is a test email sent from your email notification system.
          If you're reading this, your SMTP configuration is working correctly!
        </p>
        <div style="background: #f5f5f5; padding: 15px; border-radius: 8px; margin: 20px 0;">
          <p style="margin: 5px 0; color: #444;"><strong>SMTP Host:</strong> ${settings.smtp_host}</p>
          <p style="margin: 5px 0; color: #444;"><strong>SMTP Port:</strong> ${settings.smtp_port}</p>
          <p style="margin: 5px 0; color: #444;"><strong>Encryption:</strong> ${settings.smtp_encryption}</p>
          <p style="margin: 5px 0; color: #444;"><strong>From:</strong> ${settings.from_name} &lt;${settings.from_email || settings.smtp_username}&gt;</p>
        </div>
        <p style="color: #999; font-size: 12px;">
          Sent at: ${new Date().toISOString()}
        </p>
      </div>
    `;

    let sendStatus = "sent";
    let errorMessage: string | null = null;

    try {
      const client = new SmtpClient();

      const connectConfig: any = {
        hostname: settings.smtp_host,
        port: settings.smtp_port || 587,
        username: settings.smtp_username,
        password: settings.smtp_password,
      };

      if (settings.smtp_encryption === "tls") {
        await client.connectTLS(connectConfig);
      } else if (settings.smtp_encryption === "ssl") {
        await client.connectTLS(connectConfig);
      } else {
        await client.connect(connectConfig);
      }

      await client.send({
        from: settings.from_email || settings.smtp_username,
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

    // Log the email send attempt
    await supabase.from("email_send_logs").insert({
      template_key: "test_email",
      template_label: "Test Email",
      recipient_email: test_email,
      subject,
      status: sendStatus,
      error_message: errorMessage,
      sent_by: user.id,
    });

    if (sendStatus === "failed") {
      return new Response(
        JSON.stringify({ error: `Failed to send: ${errorMessage}` }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ success: true, message: `Test email sent to ${test_email}` }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: err.message || "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
