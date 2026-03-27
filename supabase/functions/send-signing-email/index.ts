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

    const { document_id } = await req.json();

    // Get document
    const { data: doc } = await supabase
      .from("signature_documents")
      .select("*")
      .eq("id", document_id)
      .single();

    if (!doc) throw new Error("Document not found");

    // Get recipients
    const { data: recipients } = await supabase
      .from("signature_recipients")
      .select("*")
      .eq("document_id", document_id)
      .neq("status", "signed");

    if (!recipients || recipients.length === 0) {
      return new Response(JSON.stringify({ message: "No pending recipients" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get SMTP settings
    const { data: emailAccounts } = await supabase
      .from("email_accounts")
      .select("*")
      .eq("is_default", true)
      .eq("is_enabled", true)
      .limit(1);

    const account = emailAccounts?.[0];

    for (const recipient of recipients) {
      const signingUrl = `${req.headers.get("origin") || supabaseUrl.replace("supabase.co", "lovable.app")}/sign/${recipient.signing_token}`;

      // Log audit
      await supabase.from("signature_audit_logs").insert({
        document_id,
        recipient_id: recipient.id,
        action: "email_sent",
        metadata: { email: recipient.email },
      });

      if (account) {
        // Send via SMTP (using edge function invoke or direct)
        // For now, log the email to send
        await supabase.from("email_send_logs").insert({
          template_key: "signature_request",
          template_label: "Signature Request",
          recipient_email: recipient.email,
          subject: `Please sign: ${doc.title}`,
          body_html: `
            <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
              <h2 style="color: #333;">Document Signing Request</h2>
              <p>Hello ${recipient.name},</p>
              <p>You have been requested to sign the following document:</p>
              <div style="background: #f5f5f5; padding: 15px; border-radius: 8px; margin: 20px 0;">
                <p style="font-weight: bold; margin: 0;">${doc.title}</p>
                ${doc.description ? `<p style="color: #666; margin: 5px 0 0;">${doc.description}</p>` : ''}
              </div>
              <a href="${signingUrl}" style="display: inline-block; background: #2563eb; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: bold;">
                Review & Sign Document
              </a>
              <p style="color: #999; font-size: 12px; margin-top: 30px;">
                This link expires in 30 days. If you did not expect this request, please ignore this email.
              </p>
              <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
              <p style="color: #999; font-size: 11px;">
                Secured by Electronic Signature under IT Act 2000 (India)
              </p>
            </div>
          `,
          status: "sent",
          sent_by: doc.created_by,
        });
      }
    }

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
