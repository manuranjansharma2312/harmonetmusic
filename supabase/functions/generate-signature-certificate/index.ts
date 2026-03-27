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

    // Verify admin
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

    const { document_id } = await req.json();
    if (!document_id) throw new Error("document_id required");

    // Fetch document
    const { data: doc, error: docErr } = await supabase
      .from("signature_documents")
      .select("*")
      .eq("id", document_id)
      .single();
    if (docErr || !doc) throw new Error("Document not found");

    // Fetch recipients
    const { data: recipients } = await supabase
      .from("signature_recipients")
      .select("*")
      .eq("document_id", document_id)
      .order("signing_order");

    // Fetch audit logs
    const { data: auditLogs } = await supabase
      .from("signature_audit_logs")
      .select("*")
      .eq("document_id", document_id)
      .order("created_at", { ascending: true });

    // Fetch company details
    const { data: company } = await supabase
      .from("company_details")
      .select("*")
      .limit(1)
      .single();

    const companyName = company?.company_name || "Harmonet Music";
    const companyAddress = company?.address || "";

    // Generate certificate HTML
    const now = new Date().toISOString();
    const certificateId = `CERT-${document_id.slice(0, 8).toUpperCase()}-${Date.now().toString(36).toUpperCase()}`;

    const recipientRows = (recipients || []).map((r: any, i: number) => `
      <tr>
        <td style="padding:8px;border:1px solid #ddd;">${i + 1}</td>
        <td style="padding:8px;border:1px solid #ddd;">${escapeHtml(r.name)}</td>
        <td style="padding:8px;border:1px solid #ddd;">${escapeHtml(r.email)}</td>
        <td style="padding:8px;border:1px solid #ddd;">${r.status === 'signed' ? '✅ Signed' : '⏳ Pending'}</td>
        <td style="padding:8px;border:1px solid #ddd;">${r.signed_at ? formatDate(r.signed_at) : '-'}</td>
        <td style="padding:8px;border:1px solid #ddd;">${r.signature_type || '-'}</td>
        <td style="padding:8px;border:1px solid #ddd;">${escapeHtml(r.ip_address || '-')}</td>
      </tr>
    `).join('');

    const auditRows = (auditLogs || []).map((log: any) => `
      <tr>
        <td style="padding:6px;border:1px solid #ddd;font-size:12px;">${formatActionLabel(log.action)}</td>
        <td style="padding:6px;border:1px solid #ddd;font-size:12px;">${escapeHtml(log.ip_address || '-')}</td>
        <td style="padding:6px;border:1px solid #ddd;font-size:12px;">${formatDate(log.created_at)}</td>
        <td style="padding:6px;border:1px solid #ddd;font-size:12px;max-width:200px;overflow:hidden;text-overflow:ellipsis;">${escapeHtml((log.user_agent || '-').substring(0, 60))}</td>
      </tr>
    `).join('');

    const signatureImages = (recipients || [])
      .filter((r: any) => r.status === 'signed' && r.signature_data)
      .map((r: any) => `
        <div style="margin:10px 0;padding:10px;border:1px solid #eee;border-radius:4px;">
          <p style="margin:0 0 5px;font-size:12px;color:#666;">Signature of ${escapeHtml(r.name)} (${escapeHtml(r.email)})</p>
          <img src="${r.signature_data}" style="max-height:60px;max-width:250px;" />
          <p style="margin:5px 0 0;font-size:11px;color:#999;">Signed at: ${formatDate(r.signed_at)} | IP: ${r.ip_address || 'N/A'} | Type: ${r.signature_type || 'N/A'}</p>
        </div>
      `).join('');

    const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>Certificate of Completion</title></head>
<body style="font-family:Arial,Helvetica,sans-serif;max-width:800px;margin:0 auto;padding:40px;color:#333;">
  
  <!-- Header -->
  <div style="text-align:center;border-bottom:3px solid #1a1a1a;padding-bottom:20px;margin-bottom:30px;">
    <h1 style="margin:0;font-size:28px;color:#1a1a1a;letter-spacing:1px;">CERTIFICATE OF COMPLETION</h1>
    <p style="margin:5px 0 0;font-size:14px;color:#666;">Electronic Signature Verification Certificate</p>
    <p style="margin:5px 0 0;font-size:12px;color:#999;">Certificate ID: ${certificateId}</p>
  </div>

  <!-- Document Info -->
  <div style="background:#f8f9fa;padding:20px;border-radius:8px;margin-bottom:25px;">
    <h2 style="margin:0 0 15px;font-size:18px;color:#1a1a1a;">Document Information</h2>
    <table style="width:100%;font-size:14px;">
      <tr><td style="padding:4px 0;color:#666;width:180px;">Document Title:</td><td style="padding:4px 0;font-weight:bold;">${escapeHtml(doc.title)}</td></tr>
      <tr><td style="padding:4px 0;color:#666;">Description:</td><td style="padding:4px 0;">${escapeHtml(doc.description || 'N/A')}</td></tr>
      <tr><td style="padding:4px 0;color:#666;">Document ID:</td><td style="padding:4px 0;font-family:monospace;">${doc.id}</td></tr>
      <tr><td style="padding:4px 0;color:#666;">Status:</td><td style="padding:4px 0;font-weight:bold;color:${doc.status === 'completed' ? '#16a34a' : '#ea580c'};">${doc.status.toUpperCase()}</td></tr>
      <tr><td style="padding:4px 0;color:#666;">Created:</td><td style="padding:4px 0;">${formatDate(doc.created_at)}</td></tr>
      <tr><td style="padding:4px 0;color:#666;">Completed:</td><td style="padding:4px 0;">${doc.status === 'completed' ? formatDate(doc.updated_at) : 'Pending'}</td></tr>
      <tr><td style="padding:4px 0;color:#666;">SHA-256 Hash:</td><td style="padding:4px 0;font-family:monospace;font-size:12px;word-break:break-all;">${escapeHtml(doc.document_hash)}</td></tr>
    </table>
  </div>

  <!-- Issued By -->
  <div style="background:#f0f4ff;padding:15px;border-radius:8px;margin-bottom:25px;">
    <h3 style="margin:0 0 8px;font-size:15px;">Issued By</h3>
    <p style="margin:0;font-size:14px;font-weight:bold;">${escapeHtml(companyName)}</p>
    ${companyAddress ? `<p style="margin:3px 0 0;font-size:13px;color:#666;">${escapeHtml(companyAddress)}</p>` : ''}
  </div>

  <!-- Signers -->
  <div style="margin-bottom:25px;">
    <h2 style="font-size:18px;color:#1a1a1a;margin-bottom:10px;">Signer Details</h2>
    <table style="width:100%;border-collapse:collapse;font-size:13px;">
      <thead>
        <tr style="background:#1a1a1a;color:#fff;">
          <th style="padding:8px;text-align:left;">#</th>
          <th style="padding:8px;text-align:left;">Name</th>
          <th style="padding:8px;text-align:left;">Email</th>
          <th style="padding:8px;text-align:left;">Status</th>
          <th style="padding:8px;text-align:left;">Signed At</th>
          <th style="padding:8px;text-align:left;">Type</th>
          <th style="padding:8px;text-align:left;">IP Address</th>
        </tr>
      </thead>
      <tbody>${recipientRows}</tbody>
    </table>
  </div>

  <!-- Signatures -->
  ${signatureImages ? `
  <div style="margin-bottom:25px;">
    <h2 style="font-size:18px;color:#1a1a1a;margin-bottom:10px;">Captured Signatures</h2>
    ${signatureImages}
  </div>
  ` : ''}

  <!-- Audit Trail -->
  <div style="margin-bottom:25px;">
    <h2 style="font-size:18px;color:#1a1a1a;margin-bottom:10px;">Complete Audit Trail</h2>
    <table style="width:100%;border-collapse:collapse;font-size:12px;">
      <thead>
        <tr style="background:#f1f5f9;">
          <th style="padding:6px;text-align:left;border:1px solid #ddd;">Action</th>
          <th style="padding:6px;text-align:left;border:1px solid #ddd;">IP Address</th>
          <th style="padding:6px;text-align:left;border:1px solid #ddd;">Timestamp</th>
          <th style="padding:6px;text-align:left;border:1px solid #ddd;">User Agent</th>
        </tr>
      </thead>
      <tbody>${auditRows || '<tr><td colspan="4" style="padding:10px;text-align:center;color:#999;">No audit logs</td></tr>'}</tbody>
    </table>
  </div>

  <!-- Legal Disclaimer -->
  <div style="border-top:2px solid #1a1a1a;padding-top:20px;margin-top:30px;">
    <h3 style="font-size:14px;margin:0 0 10px;">Legal Disclaimer</h3>
    <p style="font-size:11px;color:#666;line-height:1.6;">
      This certificate confirms that the above-mentioned document was electronically signed by the listed parties 
      using a verified electronic signature process. The document's integrity is verified through SHA-256 cryptographic 
      hashing. Each signer's identity was verified via Email OTP (One-Time Password) before signing.
    </p>
    <p style="font-size:11px;color:#666;line-height:1.6;">
      This electronic signature is legally valid and enforceable under the <strong>Information Technology Act, 2000 
      (India)</strong> — Sections 5 and 10A, which recognize electronic signatures as equivalent to handwritten 
      signatures for private commercial agreements. This certificate does not constitute a government-issued 
      Digital Signature Certificate (DSC) under Section 35 of the IT Act.
    </p>
    <p style="font-size:11px;color:#666;line-height:1.6;">
      The complete audit trail above serves as evidence of the signing process, including timestamps, 
      IP addresses, and device information for each action taken during the signing workflow.
    </p>
  </div>

  <!-- Footer -->
  <div style="text-align:center;margin-top:30px;padding-top:15px;border-top:1px solid #eee;">
    <p style="font-size:11px;color:#999;">
      Certificate generated on ${formatDate(now)} | ${escapeHtml(companyName)}
    </p>
    <p style="font-size:10px;color:#bbb;">
      This is a system-generated certificate. No manual signature is required.
    </p>
  </div>
</body>
</html>`;

    return new Response(JSON.stringify({ 
      success: true, 
      certificate_html: html,
      certificate_id: certificateId 
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

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleString('en-IN', { 
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hour12: true, timeZone: 'Asia/Kolkata'
  }) + ' IST';
}

function formatActionLabel(action: string): string {
  const labels: Record<string, string> = {
    'email_sent': '📧 Email Sent',
    'document_viewed': '👁️ Document Viewed',
    'otp_requested': '🔑 OTP Requested',
    'otp_verified': '✅ OTP Verified',
    'document_signed': '✍️ Document Signed',
  };
  return labels[action] || action;
}
