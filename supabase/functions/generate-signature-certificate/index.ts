import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { PDFDocument, rgb, StandardFonts } from "https://esm.sh/pdf-lib@1.17.1";

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

    // Fetch all data in parallel
    const [docRes, recipientsRes, auditRes, companyRes] = await Promise.all([
      supabase.from("signature_documents").select("*").eq("id", document_id).single(),
      supabase.from("signature_recipients").select("*").eq("document_id", document_id).order("signing_order"),
      supabase.from("signature_audit_logs").select("*").eq("document_id", document_id).order("created_at", { ascending: true }),
      supabase.from("company_details").select("*").limit(1).single(),
    ]);

    const doc = docRes.data;
    if (!doc) throw new Error("Document not found");
    const recipients = recipientsRes.data || [];
    const auditLogs = auditRes.data || [];
    const company = companyRes.data;

    const companyName = company?.company_name || "Harmonet Music";
    const companyAddress = company?.address || "";
    const certificateId = `CERT-${document_id.slice(0, 8).toUpperCase()}-${Date.now().toString(36).toUpperCase()}`;
    const now = new Date();

    // Extract storage path from document_url (handle both full URLs and plain paths)
    let storagePath = doc.document_url;
    if (storagePath.startsWith("http")) {
      const match = storagePath.match(/signature-documents\/(.+)/);
      if (match) storagePath = match[1];
    }

    const { data: pdfFileData, error: downloadErr } = await supabase.storage
      .from("signature-documents")
      .download(storagePath);
    if (downloadErr || !pdfFileData) throw new Error(`Failed to download original document: ${downloadErr?.message || 'no data'} (path: ${storagePath})`);

    const originalPdfBytes = new Uint8Array(await pdfFileData.arrayBuffer());

    // Load original PDF and create certificate pages
    const pdfDoc = await PDFDocument.load(originalPdfBytes);
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    const PAGE_W = 595.28; // A4 width
    const PAGE_H = 841.89; // A4 height
    const MARGIN = 50;
    const MAX_W = PAGE_W - MARGIN * 2;

    // Helper to draw wrapped text
    const drawWrapped = (page: any, text: string, x: number, y: number, size: number, usedFont: any, maxW: number, color = rgb(0.2, 0.2, 0.2)) => {
      const words = text.split(' ');
      let line = '';
      let curY = y;
      for (const word of words) {
        const test = line ? `${line} ${word}` : word;
        if (usedFont.widthOfTextAtSize(test, size) > maxW && line) {
          page.drawText(line, { x, y: curY, size, font: usedFont, color });
          curY -= size + 4;
          line = word;
        } else {
          line = test;
        }
      }
      if (line) {
        page.drawText(line, { x, y: curY, size, font: usedFont, color });
        curY -= size + 4;
      }
      return curY;
    };

    // ---- Certificate Page 1: Header + Document Info + Signers ----
    let page = pdfDoc.addPage([PAGE_W, PAGE_H]);
    let y = PAGE_H - MARGIN;

    // Header
    page.drawText("CERTIFICATE OF COMPLETION", { x: MARGIN, y, size: 20, font: fontBold, color: rgb(0.1, 0.1, 0.1) });
    y -= 22;
    page.drawText("Electronic Signature Verification Certificate", { x: MARGIN, y, size: 10, font, color: rgb(0.4, 0.4, 0.4) });
    y -= 14;
    page.drawText(`Certificate ID: ${certificateId}`, { x: MARGIN, y, size: 8, font, color: rgb(0.5, 0.5, 0.5) });
    y -= 6;
    page.drawLine({ start: { x: MARGIN, y }, end: { x: PAGE_W - MARGIN, y }, thickness: 2, color: rgb(0.1, 0.1, 0.1) });
    y -= 24;

    // Document Information
    page.drawText("Document Information", { x: MARGIN, y, size: 13, font: fontBold, color: rgb(0.1, 0.1, 0.1) });
    y -= 20;

    const infoRows = [
      ["Document Title", doc.title],
      ["Description", doc.description || "N/A"],
      ["Document ID", doc.id],
      ["Status", doc.status.toUpperCase()],
      ["Created", formatDate(doc.created_at)],
      ["Completed", doc.status === "completed" ? formatDate(doc.updated_at) : "Pending"],
      ["SHA-256 Hash", doc.document_hash],
    ];

    for (const [label, value] of infoRows) {
      page.drawText(`${label}:`, { x: MARGIN, y, size: 9, font: fontBold, color: rgb(0.4, 0.4, 0.4) });
      const valStr = String(value);
      if (valStr.length > 60) {
        y = drawWrapped(page, valStr, MARGIN + 130, y, 9, font, MAX_W - 130);
      } else {
        page.drawText(valStr, { x: MARGIN + 130, y, size: 9, font, color: rgb(0.2, 0.2, 0.2) });
        y -= 15;
      }
    }

    // Issued By
    y -= 10;
    page.drawText("Issued By", { x: MARGIN, y, size: 13, font: fontBold, color: rgb(0.1, 0.1, 0.1) });
    y -= 18;
    page.drawText(companyName, { x: MARGIN, y, size: 10, font: fontBold, color: rgb(0.2, 0.2, 0.2) });
    y -= 14;
    if (companyAddress) {
      y = drawWrapped(page, companyAddress, MARGIN, y, 9, font, MAX_W, rgb(0.4, 0.4, 0.4));
      y -= 4;
    }

    // Signer Details
    y -= 10;
    page.drawText("Signer Details", { x: MARGIN, y, size: 13, font: fontBold, color: rgb(0.1, 0.1, 0.1) });
    y -= 20;

    // Table header
    const cols = [MARGIN, MARGIN + 20, MARGIN + 140, MARGIN + 280, MARGIN + 340, MARGIN + 420];
    const headerLabels = ["#", "Name", "Email", "Status", "Signed At", "IP Address"];
    page.drawRectangle({ x: MARGIN, y: y - 2, width: MAX_W, height: 16, color: rgb(0.1, 0.1, 0.1) });
    headerLabels.forEach((h, i) => {
      page.drawText(h, { x: cols[i] + 4, y: y + 2, size: 8, font: fontBold, color: rgb(1, 1, 1) });
    });
    y -= 18;

    for (let i = 0; i < recipients.length; i++) {
      const r = recipients[i];
      if (y < MARGIN + 40) {
        page = pdfDoc.addPage([PAGE_W, PAGE_H]);
        y = PAGE_H - MARGIN;
      }
      const rowData = [
        `${i + 1}`,
        r.name || "",
        r.email || "",
        r.status === "signed" ? "Signed" : "Pending",
        r.signed_at ? formatDate(r.signed_at) : "-",
        r.ip_address || "-",
      ];
      rowData.forEach((val, ci) => {
        const maxColW = ci < cols.length - 1 ? (cols[ci + 1] - cols[ci] - 8) : 70;
        const display = font.widthOfTextAtSize(val, 8) > maxColW ? val.substring(0, Math.floor(maxColW / 4)) + "..." : val;
        page.drawText(display, { x: cols[ci] + 4, y, size: 8, font, color: r.status === "signed" && ci === 3 ? rgb(0.09, 0.65, 0.26) : rgb(0.2, 0.2, 0.2) });
      });
      y -= 14;
      page.drawLine({ start: { x: MARGIN, y: y + 10 }, end: { x: PAGE_W - MARGIN, y: y + 10 }, thickness: 0.5, color: rgb(0.85, 0.85, 0.85) });
    }

    // ---- Certificate Page 2: Audit Trail + Legal ----
    y -= 20;
    if (y < MARGIN + 200) {
      page = pdfDoc.addPage([PAGE_W, PAGE_H]);
      y = PAGE_H - MARGIN;
    }

    page.drawText("Complete Audit Trail", { x: MARGIN, y, size: 13, font: fontBold, color: rgb(0.1, 0.1, 0.1) });
    y -= 20;

    // Audit header
    const auditCols = [MARGIN, MARGIN + 120, MARGIN + 220, MARGIN + 360];
    const auditHeaders = ["Action", "IP Address", "Timestamp", "User Agent"];
    page.drawRectangle({ x: MARGIN, y: y - 2, width: MAX_W, height: 16, color: rgb(0.94, 0.96, 0.97) });
    auditHeaders.forEach((h, i) => {
      page.drawText(h, { x: auditCols[i] + 4, y: y + 2, size: 8, font: fontBold, color: rgb(0.3, 0.3, 0.3) });
    });
    y -= 18;

    for (const log of auditLogs) {
      if (y < MARGIN + 40) {
        page = pdfDoc.addPage([PAGE_W, PAGE_H]);
        y = PAGE_H - MARGIN;
      }
      const actionLabel = formatActionLabel(log.action);
      const logData = [
        actionLabel,
        log.ip_address || "-",
        formatDate(log.created_at),
        (log.user_agent || "-").substring(0, 30),
      ];
      logData.forEach((val, ci) => {
        page.drawText(val, { x: auditCols[ci] + 4, y, size: 7, font, color: rgb(0.3, 0.3, 0.3) });
      });
      y -= 13;
      page.drawLine({ start: { x: MARGIN, y: y + 9 }, end: { x: PAGE_W - MARGIN, y: y + 9 }, thickness: 0.3, color: rgb(0.9, 0.9, 0.9) });
    }

    // Legal Disclaimer
    y -= 20;
    if (y < MARGIN + 120) {
      page = pdfDoc.addPage([PAGE_W, PAGE_H]);
      y = PAGE_H - MARGIN;
    }
    page.drawLine({ start: { x: MARGIN, y }, end: { x: PAGE_W - MARGIN, y }, thickness: 1.5, color: rgb(0.1, 0.1, 0.1) });
    y -= 18;
    page.drawText("Legal Disclaimer", { x: MARGIN, y, size: 11, font: fontBold, color: rgb(0.1, 0.1, 0.1) });
    y -= 16;

    const legalTexts = [
      "This certificate confirms that the above-mentioned document was electronically signed by the listed parties using a verified electronic signature process. The document's integrity is verified through SHA-256 cryptographic hashing. Each signer's identity was verified via Email OTP (One-Time Password) before signing.",
      "This electronic signature is legally valid and enforceable under the Information Technology Act, 2000 (India) — Sections 5 and 10A, which recognize electronic signatures as equivalent to handwritten signatures for private commercial agreements. This certificate does not constitute a government-issued Digital Signature Certificate (DSC) under Section 35 of the IT Act.",
      "The complete audit trail above serves as evidence of the signing process, including timestamps, IP addresses, and device information for each action taken during the signing workflow.",
    ];

    for (const txt of legalTexts) {
      y = drawWrapped(page, txt, MARGIN, y, 8, font, MAX_W, rgb(0.4, 0.4, 0.4));
      y -= 8;
    }

    // Footer
    y -= 12;
    page.drawLine({ start: { x: MARGIN, y }, end: { x: PAGE_W - MARGIN, y }, thickness: 0.5, color: rgb(0.9, 0.9, 0.9) });
    y -= 14;
    page.drawText(`Certificate generated on ${formatDate(now.toISOString())} | ${companyName}`, { x: MARGIN, y, size: 8, font, color: rgb(0.6, 0.6, 0.6) });
    y -= 12;
    page.drawText("This is a system-generated certificate. No manual signature is required.", { x: MARGIN, y, size: 7, font, color: rgb(0.7, 0.7, 0.7) });

    // Save combined PDF
    const combinedPdfBytes = await pdfDoc.save();
    const signedFileName = `signed/${document_id}_signed.pdf`;

    const { error: uploadErr } = await supabase.storage
      .from("signature-documents")
      .upload(signedFileName, combinedPdfBytes, {
        contentType: "application/pdf",
        upsert: true,
      });
    if (uploadErr) throw new Error(`Upload failed: ${uploadErr.message}`);

    // Update document with signed PDF URL
    await supabase
      .from("signature_documents")
      .update({ signed_pdf_url: signedFileName, certificate_url: certificateId })
      .eq("id", document_id);

    return new Response(JSON.stringify({
      success: true,
      certificate_id: certificateId,
      signed_pdf_url: signedFileName,
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

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleString("en-IN", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
    hour12: true, timeZone: "Asia/Kolkata",
  }) + " IST";
}

function formatActionLabel(action: string): string {
  const labels: Record<string, string> = {
    "email_sent": "Email Sent",
    "document_viewed": "Document Viewed",
    "otp_requested": "OTP Requested",
    "otp_verified": "OTP Verified",
    "document_signed": "Document Signed",
  };
  return labels[action] || action;
}
