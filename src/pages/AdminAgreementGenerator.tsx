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
  { code: "+93", flag: "🇦🇫", name: "Afghanistan" },
  { code: "+355", flag: "🇦🇱", name: "Albania" },
  { code: "+213", flag: "🇩🇿", name: "Algeria" },
  { code: "+376", flag: "🇦🇩", name: "Andorra" },
  { code: "+244", flag: "🇦🇴", name: "Angola" },
  { code: "+54", flag: "🇦🇷", name: "Argentina" },
  { code: "+374", flag: "🇦🇲", name: "Armenia" },
  { code: "+61", flag: "🇦🇺", name: "Australia" },
  { code: "+43", flag: "🇦🇹", name: "Austria" },
  { code: "+994", flag: "🇦🇿", name: "Azerbaijan" },
  { code: "+973", flag: "🇧🇭", name: "Bahrain" },
  { code: "+880", flag: "🇧🇩", name: "Bangladesh" },
  { code: "+375", flag: "🇧🇾", name: "Belarus" },
  { code: "+32", flag: "🇧🇪", name: "Belgium" },
  { code: "+501", flag: "🇧🇿", name: "Belize" },
  { code: "+229", flag: "🇧🇯", name: "Benin" },
  { code: "+975", flag: "🇧🇹", name: "Bhutan" },
  { code: "+591", flag: "🇧🇴", name: "Bolivia" },
  { code: "+387", flag: "🇧🇦", name: "Bosnia" },
  { code: "+55", flag: "🇧🇷", name: "Brazil" },
  { code: "+673", flag: "🇧🇳", name: "Brunei" },
  { code: "+359", flag: "🇧🇬", name: "Bulgaria" },
  { code: "+855", flag: "🇰🇭", name: "Cambodia" },
  { code: "+237", flag: "🇨🇲", name: "Cameroon" },
  { code: "+1", flag: "🇨🇦", name: "Canada" },
  { code: "+56", flag: "🇨🇱", name: "Chile" },
  { code: "+86", flag: "🇨🇳", name: "China" },
  { code: "+57", flag: "🇨🇴", name: "Colombia" },
  { code: "+506", flag: "🇨🇷", name: "Costa Rica" },
  { code: "+385", flag: "🇭🇷", name: "Croatia" },
  { code: "+53", flag: "🇨🇺", name: "Cuba" },
  { code: "+357", flag: "🇨🇾", name: "Cyprus" },
  { code: "+420", flag: "🇨🇿", name: "Czech Republic" },
  { code: "+45", flag: "🇩🇰", name: "Denmark" },
  { code: "+593", flag: "🇪🇨", name: "Ecuador" },
  { code: "+20", flag: "🇪🇬", name: "Egypt" },
  { code: "+372", flag: "🇪🇪", name: "Estonia" },
  { code: "+251", flag: "🇪🇹", name: "Ethiopia" },
  { code: "+358", flag: "🇫🇮", name: "Finland" },
  { code: "+33", flag: "🇫🇷", name: "France" },
  { code: "+995", flag: "🇬🇪", name: "Georgia" },
  { code: "+49", flag: "🇩🇪", name: "Germany" },
  { code: "+233", flag: "🇬🇭", name: "Ghana" },
  { code: "+30", flag: "🇬🇷", name: "Greece" },
  { code: "+502", flag: "🇬🇹", name: "Guatemala" },
  { code: "+852", flag: "🇭🇰", name: "Hong Kong" },
  { code: "+36", flag: "🇭🇺", name: "Hungary" },
  { code: "+354", flag: "🇮🇸", name: "Iceland" },
  { code: "+91", flag: "🇮🇳", name: "India" },
  { code: "+62", flag: "🇮🇩", name: "Indonesia" },
  { code: "+98", flag: "🇮🇷", name: "Iran" },
  { code: "+964", flag: "🇮🇶", name: "Iraq" },
  { code: "+353", flag: "🇮🇪", name: "Ireland" },
  { code: "+972", flag: "🇮🇱", name: "Israel" },
  { code: "+39", flag: "🇮🇹", name: "Italy" },
  { code: "+81", flag: "🇯🇵", name: "Japan" },
  { code: "+962", flag: "🇯🇴", name: "Jordan" },
  { code: "+7", flag: "🇰🇿", name: "Kazakhstan" },
  { code: "+254", flag: "🇰🇪", name: "Kenya" },
  { code: "+965", flag: "🇰🇼", name: "Kuwait" },
  { code: "+996", flag: "🇰🇬", name: "Kyrgyzstan" },
  { code: "+856", flag: "🇱🇦", name: "Laos" },
  { code: "+371", flag: "🇱🇻", name: "Latvia" },
  { code: "+961", flag: "🇱🇧", name: "Lebanon" },
  { code: "+218", flag: "🇱🇾", name: "Libya" },
  { code: "+370", flag: "🇱🇹", name: "Lithuania" },
  { code: "+352", flag: "🇱🇺", name: "Luxembourg" },
  { code: "+853", flag: "🇲🇴", name: "Macau" },
  { code: "+60", flag: "🇲🇾", name: "Malaysia" },
  { code: "+960", flag: "🇲🇻", name: "Maldives" },
  { code: "+356", flag: "🇲🇹", name: "Malta" },
  { code: "+52", flag: "🇲🇽", name: "Mexico" },
  { code: "+373", flag: "🇲🇩", name: "Moldova" },
  { code: "+976", flag: "🇲🇳", name: "Mongolia" },
  { code: "+212", flag: "🇲🇦", name: "Morocco" },
  { code: "+258", flag: "🇲🇿", name: "Mozambique" },
  { code: "+95", flag: "🇲🇲", name: "Myanmar" },
  { code: "+977", flag: "🇳🇵", name: "Nepal" },
  { code: "+31", flag: "🇳🇱", name: "Netherlands" },
  { code: "+64", flag: "🇳🇿", name: "New Zealand" },
  { code: "+234", flag: "🇳🇬", name: "Nigeria" },
  { code: "+850", flag: "🇰🇵", name: "North Korea" },
  { code: "+389", flag: "🇲🇰", name: "North Macedonia" },
  { code: "+47", flag: "🇳🇴", name: "Norway" },
  { code: "+968", flag: "🇴🇲", name: "Oman" },
  { code: "+92", flag: "🇵🇰", name: "Pakistan" },
  { code: "+507", flag: "🇵🇦", name: "Panama" },
  { code: "+595", flag: "🇵🇾", name: "Paraguay" },
  { code: "+51", flag: "🇵🇪", name: "Peru" },
  { code: "+63", flag: "🇵🇭", name: "Philippines" },
  { code: "+48", flag: "🇵🇱", name: "Poland" },
  { code: "+351", flag: "🇵🇹", name: "Portugal" },
  { code: "+974", flag: "🇶🇦", name: "Qatar" },
  { code: "+40", flag: "🇷🇴", name: "Romania" },
  { code: "+7", flag: "🇷🇺", name: "Russia" },
  { code: "+966", flag: "🇸🇦", name: "Saudi Arabia" },
  { code: "+221", flag: "🇸🇳", name: "Senegal" },
  { code: "+381", flag: "🇷🇸", name: "Serbia" },
  { code: "+65", flag: "🇸🇬", name: "Singapore" },
  { code: "+421", flag: "🇸🇰", name: "Slovakia" },
  { code: "+386", flag: "🇸🇮", name: "Slovenia" },
  { code: "+27", flag: "🇿🇦", name: "South Africa" },
  { code: "+82", flag: "🇰🇷", name: "South Korea" },
  { code: "+34", flag: "🇪🇸", name: "Spain" },
  { code: "+94", flag: "🇱🇰", name: "Sri Lanka" },
  { code: "+249", flag: "🇸🇩", name: "Sudan" },
  { code: "+46", flag: "🇸🇪", name: "Sweden" },
  { code: "+41", flag: "🇨🇭", name: "Switzerland" },
  { code: "+963", flag: "🇸🇾", name: "Syria" },
  { code: "+886", flag: "🇹🇼", name: "Taiwan" },
  { code: "+992", flag: "🇹🇯", name: "Tajikistan" },
  { code: "+255", flag: "🇹🇿", name: "Tanzania" },
  { code: "+66", flag: "🇹🇭", name: "Thailand" },
  { code: "+216", flag: "🇹🇳", name: "Tunisia" },
  { code: "+90", flag: "🇹🇷", name: "Turkey" },
  { code: "+993", flag: "🇹🇲", name: "Turkmenistan" },
  { code: "+256", flag: "🇺🇬", name: "Uganda" },
  { code: "+380", flag: "🇺🇦", name: "Ukraine" },
  { code: "+971", flag: "🇦🇪", name: "UAE" },
  { code: "+44", flag: "🇬🇧", name: "United Kingdom" },
  { code: "+1", flag: "🇺🇸", name: "United States" },
  { code: "+598", flag: "🇺🇾", name: "Uruguay" },
  { code: "+998", flag: "🇺🇿", name: "Uzbekistan" },
  { code: "+58", flag: "🇻🇪", name: "Venezuela" },
  { code: "+84", flag: "🇻🇳", name: "Vietnam" },
  { code: "+967", flag: "🇾🇪", name: "Yemen" },
  { code: "+260", flag: "🇿🇲", name: "Zambia" },
  { code: "+263", flag: "🇿🇼", name: "Zimbabwe" },
];

interface GovtId {
  idName: string;
  idNumber: string;
}

export default function AdminAgreementGenerator() {
  const [templateId, setTemplateId] = useState("");
  const [clientType, setClientType] = useState("Artist");
  const [dateOfAgreement, setDateOfAgreement] = useState("");
  const [artistLabelName, setArtistLabelName] = useState("");
  const [legalName, setLegalName] = useState("");
  const [address, setAddress] = useState("");
  const [countryCode, setCountryCode] = useState("India|+91");
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
    html = html.replace(/\{\{client_type\}\}/g, clientType);
    html = html.replace(/\{\{date_of_agreement\}\}/g, dateOfAgreement);
    html = html.replace(/\{\{artist_label_name\}\}/g, artistLabelName);
    html = html.replace(/\{\{legal_name\}\}/g, legalName);
    html = html.replace(/\{\{address\}\}/g, address);
    html = html.replace(/\{\{mobile_number\}\}/g, `${countryCode.split("|")[1]} ${mobileNumber}`);
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
    const pageHeight = doc.internal.pageSize.getHeight();
    let y = 20;

    const addText = (text: string, fontSize: number, fontStyle: string, lineHeight: number, extraSpaceBefore = 0) => {
      doc.setFont("helvetica", fontStyle);
      doc.setFontSize(fontSize);
      const lines = doc.splitTextToSize(text.trim(), maxWidth);
      for (const line of lines) {
        if (y + lineHeight + extraSpaceBefore > pageHeight - 15) {
          doc.addPage();
          y = 20;
          extraSpaceBefore = 0;
        }
        if (extraSpaceBefore > 0) { y += extraSpaceBefore; extraSpaceBefore = 0; }
        doc.text(line, margin, y);
        y += lineHeight;
      }
    };

    const addHr = () => {
      if (y + 4 > pageHeight - 15) { doc.addPage(); y = 20; }
      y += 2;
      doc.setDrawColor(0);
      doc.setLineWidth(0.3);
      doc.line(margin, y, pageWidth - margin, y);
      y += 4;
    };

    const tempDiv = document.createElement("div");
    tempDiv.innerHTML = html;

    const processNode = (node: Node) => {
      if (node.nodeType === Node.TEXT_NODE) {
        const text = node.textContent?.trim();
        if (text) addText(text, 11, "normal", 5.5);
        return;
      }
      if (node.nodeType !== Node.ELEMENT_NODE) return;
      const el = node as HTMLElement;
      const tag = el.tagName.toLowerCase();

      if (tag === "hr") { addHr(); return; }
      if (tag === "h1") { addText(el.textContent || "", 18, "bold", 8, 4); y += 2; return; }
      if (tag === "h2") { addText(el.textContent || "", 14, "bold", 7, 6); y += 1; return; }
      if (tag === "h3") { addText(el.textContent || "", 12, "bold", 6.5, 4); y += 1; return; }
      if (tag === "h4" || tag === "h5" || tag === "h6") { addText(el.textContent || "", 11, "bold", 6, 3); return; }

      if (tag === "strong" || tag === "b") {
        addText(el.textContent || "", 11, "bold", 5.5);
        return;
      }

      if (tag === "ul" || tag === "ol") {
        const items = el.querySelectorAll(":scope > li");
        items.forEach((li, idx) => {
          const bullet = tag === "ul" ? "•" : `${idx + 1}.`;
          const text = li.textContent?.trim() || "";
          if (y + 6 > pageHeight - 15) { doc.addPage(); y = 20; }
          doc.setFont("helvetica", "normal");
          doc.setFontSize(11);
          doc.text(bullet, margin + 2, y);
          const liLines = doc.splitTextToSize(text, maxWidth - 10);
          for (const line of liLines) {
            if (y + 5.5 > pageHeight - 15) { doc.addPage(); y = 20; }
            doc.text(line, margin + 8, y);
            y += 5.5;
          }
        });
        y += 2;
        return;
      }

      if (tag === "br") { y += 4; return; }

      if (tag === "p" || tag === "div" || tag === "td" || tag === "th") {
        // Process children to handle mixed bold/normal inline content
        const hasOnlyText = el.children.length === 0;
        if (hasOnlyText) {
          addText(el.textContent || "", 11, "normal", 5.5);
        } else {
          for (const child of Array.from(el.childNodes)) {
            processNode(child);
          }
        }
        if (tag === "p") y += 2;
        return;
      }

      if (tag === "table") {
        const rows = el.querySelectorAll("tr");
        rows.forEach((row) => {
          const cells = row.querySelectorAll("td, th");
          cells.forEach((cell) => {
            for (const child of Array.from(cell.childNodes)) {
              processNode(child);
            }
          });
          y += 2;
        });
        return;
      }

      // Fallback: process children
      for (const child of Array.from(el.childNodes)) {
        processNode(child);
      }
    };

    for (const child of Array.from(tempDiv.childNodes)) {
      processNode(child);
    }

    const fileName = artistLabelName.trim()
      ? `${artistLabelName.trim()} - Distribution Agreement.pdf`
      : `${templateName.replace(/\s+/g, "_")}.pdf`;
    doc.save(fileName);
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
                <Label>Client Type</Label>
                <Select value={clientType} onValueChange={setClientType}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Artist">Artist</SelectItem>
                    <SelectItem value="Record Label">Record Label</SelectItem>
                  </SelectContent>
                </Select>
              </div>
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
                    <SelectTrigger className="w-[200px] flex-shrink-0">
                      <SelectValue>
                        {(() => {
                          const parts = countryCode.split("|");
                          const c = COUNTRY_CODES.find(c => c.name === parts[0]);
                          return c ? `${c.flag} ${c.name} (${c.code})` : countryCode;
                        })()}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent className="max-h-60">
                      {COUNTRY_CODES.map((c) => (
                        <SelectItem key={`${c.name}-${c.code}`} value={`${c.name}|${c.code}`}>
                          {c.flag} {c.name} ({c.code})
                        </SelectItem>
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
              <Button className="bg-black hover:bg-black/90 text-white" onClick={handleDownload}>
                <Download className="h-4 w-4 mr-2" /> Download PDF
              </Button>
            </div>
          </div>
        </GlassCard>
      </div>

      <Dialog open={showPreview} onOpenChange={setShowPreview}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto overflow-x-hidden">
          <DialogHeader>
            <DialogTitle>Agreement Preview</DialogTitle>
          </DialogHeader>
          <div
            ref={previewRef}
            className="agreement-preview p-6 rounded-md overflow-x-hidden"
            style={{ backgroundColor: "white", color: "black" }}
            dangerouslySetInnerHTML={{ __html: previewHtml }}
          />
          <div className="flex justify-end pt-4">
            <Button className="bg-black hover:bg-black/90 text-white" onClick={handleDownload}>
              <Download className="h-4 w-4 mr-2" /> Download PDF
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
