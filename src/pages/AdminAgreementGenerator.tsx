import { useState, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { GlassCard } from "@/components/GlassCard";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Plus, Trash2, Download, Eye } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import jsPDF from "jspdf";

const COUNTRY_CODES = [
  "+91", "+1", "+44", "+61", "+971", "+86", "+81", "+49", "+33", "+39",
  "+7", "+55", "+27", "+82", "+62", "+60", "+65", "+66", "+84", "+234",
];

interface GovtId {
  idName: string;
  idNumber: string;
}

export default function AdminAgreementGenerator() {
  const [templateId, setTemplateId] = useState("");
  const [dateOfAgreement, setDateOfAgreement] = useState("");
  const [artistLabelName, setArtistLabelName] = useState("");
  const [legalName, setLegalName] = useState("");
  const [address, setAddress] = useState("");
  const [countryCode, setCountryCode] = useState("+91");
  const [mobileNumber, setMobileNumber] = useState("");
  const [email, setEmail] = useState("");
  const [govtIds, setGovtIds] = useState<GovtId[]>([{ idName: "", idNumber: "" }]);
  const [clientRevenue, setClientRevenue] = useState("");
  const [harmonetRevenue, setHarmonetRevenue] = useState("");
  const [previewHtml, setPreviewHtml] = useState("");
  const [showPreview, setShowPreview] = useState(false);
  const previewRef = useRef<HTMLDivElement>(null);

  const { data: templates = [] } = useQuery({
    queryKey: ["agreement-templates"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("agreement_templates")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const addGovtId = () => setGovtIds([...govtIds, { idName: "", idNumber: "" }]);
  const removeGovtId = (i: number) => setGovtIds(govtIds.filter((_, idx) => idx !== i));
  const updateGovtId = (i: number, field: keyof GovtId, value: string) => {
    const updated = [...govtIds];
    updated[i][field] = value;
    setGovtIds(updated);
  };

  const getReplacedContent = () => {
    const template = templates.find((t: any) => t.id === templateId);
    if (!template) return "";

    const govtIdText = govtIds
      .filter((g) => g.idName && g.idNumber)
      .map((g) => `${g.idName}: ${g.idNumber}`)
      .join(", ");

    let html = template.content as string;
    html = html.replace(/\{\{date_of_agreement\}\}/g, dateOfAgreement);
    html = html.replace(/\{\{artist_label_name\}\}/g, artistLabelName);
    html = html.replace(/\{\{legal_name\}\}/g, legalName);
    html = html.replace(/\{\{address\}\}/g, address);
    html = html.replace(/\{\{mobile_number\}\}/g, `${countryCode} ${mobileNumber}`);
    html = html.replace(/\{\{email\}\}/g, email);
    html = html.replace(/\{\{govt_ids\}\}/g, govtIdText);
    html = html.replace(/\{\{client_revenue_percent\}\}/g, `${clientRevenue}%`);
    html = html.replace(/\{\{harmonet_revenue_percent\}\}/g, `${harmonetRevenue}%`);
    return html;
  };

  const handlePreview = () => {
    if (!templateId) {
      toast.error("Select a template first");
      return;
    }
    setPreviewHtml(getReplacedContent());
    setShowPreview(true);
  };

  const handleDownload = () => {
    if (!templateId) {
      toast.error("Select a template first");
      return;
    }
    const html = getReplacedContent();
    const templateName = templates.find((t: any) => t.id === templateId)?.name || "Agreement";

    const doc = new jsPDF("p", "mm", "a4");
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 15;
    const maxWidth = pageWidth - margin * 2;

    // Parse HTML to plain text for PDF
    const tempDiv = document.createElement("div");
    tempDiv.innerHTML = html;
    const text = tempDiv.innerText || tempDiv.textContent || "";

    doc.setFont("helvetica", "normal");
    doc.setFontSize(11);

    const lines = doc.splitTextToSize(text, maxWidth);
    let y = 20;
    const lineHeight = 6;
    const pageHeight = doc.internal.pageSize.getHeight();

    for (const line of lines) {
      if (y + lineHeight > pageHeight - 15) {
        doc.addPage();
        y = 20;
      }
      doc.text(line, margin, y);
      y += lineHeight;
    }

    doc.save(`${templateName.replace(/\s+/g, "_")}.pdf`);
    toast.success("PDF downloaded!");
  };

  return (
    <DashboardLayout>
      <div className="space-y-6 max-w-3xl mx-auto">
        <div>
          <h1 className="text-2xl font-bold">Generate Agreement PDF</h1>
          <p className="text-muted-foreground text-sm">Fill the form and generate a PDF from a template</p>
        </div>

        <GlassCard>
          <div className="space-y-4">
            <div>
              <Label>Select Template</Label>
              <Select value={templateId} onValueChange={setTemplateId}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose a template" />
                </SelectTrigger>
                <SelectContent>
                  {templates.map((t: any) => (
                    <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label>Date of Agreement</Label>
                <Input type="date" value={dateOfAgreement} onChange={(e) => setDateOfAgreement(e.target.value)} />
              </div>
              <div>
                <Label>Artist / Label Name</Label>
                <Input value={artistLabelName} onChange={(e) => setArtistLabelName(e.target.value)} placeholder="Artist or Label name" />
              </div>
              <div>
                <Label>Legal Name (Authorised Representative)</Label>
                <Input value={legalName} onChange={(e) => setLegalName(e.target.value)} placeholder="Full legal name" />
              </div>
              <div>
                <Label>Email Address</Label>
                <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="email@example.com" />
              </div>
              <div className="sm:col-span-2">
                <Label>Residential / Business Address</Label>
                <Input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Full address" />
              </div>
              <div>
                <Label>Mobile Number</Label>
                <div className="flex gap-2">
                  <Select value={countryCode} onValueChange={setCountryCode}>
                    <SelectTrigger className="w-24 flex-shrink-0">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {COUNTRY_CODES.map((c) => (
                        <SelectItem key={c} value={c}>{c}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Input value={mobileNumber} onChange={(e) => setMobileNumber(e.target.value)} placeholder="Mobile number" />
                </div>
              </div>
            </div>

            {/* Govt IDs */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <Label>Government ID(s)</Label>
                <Button type="button" size="sm" variant="outline" onClick={addGovtId}>
                  <Plus className="h-4 w-4 mr-1" /> Add ID
                </Button>
              </div>
              <div className="space-y-2">
                {govtIds.map((g, i) => (
                  <div key={i} className="flex gap-2 items-center">
                    <Input
                      value={g.idName}
                      onChange={(e) => updateGovtId(i, "idName", e.target.value)}
                      placeholder="ID Name (e.g. Aadhar, PAN)"
                      className="flex-1"
                    />
                    <Input
                      value={g.idNumber}
                      onChange={(e) => updateGovtId(i, "idNumber", e.target.value)}
                      placeholder="ID Number"
                      className="flex-1"
                    />
                    {govtIds.length > 1 && (
                      <Button type="button" size="icon" variant="ghost" onClick={() => removeGovtId(i)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label>Client (Artist / Label) Revenue %</Label>
                <Input type="number" value={clientRevenue} onChange={(e) => setClientRevenue(e.target.value)} placeholder="e.g. 80" />
              </div>
              <div>
                <Label>Harmonet Music Revenue %</Label>
                <Input type="number" value={harmonetRevenue} onChange={(e) => setHarmonetRevenue(e.target.value)} placeholder="e.g. 20" />
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <Button onClick={handlePreview}>
                <Eye className="h-4 w-4 mr-2" /> Preview
              </Button>
              <Button variant="secondary" onClick={handleDownload}>
                <Download className="h-4 w-4 mr-2" /> Download PDF
              </Button>
            </div>
          </div>
        </GlassCard>
      </div>

      <Dialog open={showPreview} onOpenChange={setShowPreview}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Agreement Preview</DialogTitle>
          </DialogHeader>
          <div
            ref={previewRef}
            className="tutorial-content text-foreground bg-white text-black p-6 rounded-md"
            dangerouslySetInnerHTML={{ __html: previewHtml }}
          />
          <div className="flex justify-end pt-4">
            <Button onClick={handleDownload}>
              <Download className="h-4 w-4 mr-2" /> Download PDF
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
