import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
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

    // Validate UUID format to prevent injection
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(document_id)) throw new Error("Invalid document ID");

    const { data: doc, error } = await supabase
      .from("signature_documents")
      .select("title, signed_pdf_url, status, updated_at")
      .eq("id", document_id)
      .single();

    if (error || !doc) {
      return new Response(JSON.stringify({ status: "error", message: "Document not found" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (doc.status !== "completed" || !doc.signed_pdf_url) {
      return new Response(JSON.stringify({ status: "error", message: "Document not available" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check 7-day expiry from completion date (updated_at)
    const completedAt = new Date(doc.updated_at);
    const daysDiff = (Date.now() - completedAt.getTime()) / (1000 * 60 * 60 * 24);

    if (daysDiff > 7) {
      return new Response(JSON.stringify({ status: "expired", title: doc.title }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Generate a 1-hour signed URL
    const { data: signedUrl } = await supabase.storage
      .from("signature-documents")
      .createSignedUrl(doc.signed_pdf_url, 3600);

    if (!signedUrl?.signedUrl) {
      return new Response(JSON.stringify({ status: "error", message: "Failed to generate download link" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({
      status: "ready",
      title: doc.title,
      download_url: signedUrl.signedUrl,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error: any) {
    return new Response(JSON.stringify({ status: "error", message: error.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
