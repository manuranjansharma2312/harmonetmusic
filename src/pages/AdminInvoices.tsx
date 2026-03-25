import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { DashboardLayout } from '@/components/DashboardLayout';
import { GlassCard } from '@/components/GlassCard';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Dialog as ConfirmDialogWrapper, DialogContent as ConfirmContent, DialogHeader as ConfirmHeader, DialogTitle as ConfirmTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Plus, Trash2, Download, Eye, Pencil, X, FileText, Search, Settings } from 'lucide-react';
import { TablePagination, paginateItems } from '@/components/TablePagination';
import { Textarea } from '@/components/ui/textarea';
import { format } from 'date-fns';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface InvoiceItem {
  description: string;
  amount: number;
}

interface InvoiceTax {
  name: string;
  percent: number;
}

interface RegistrationId {
  name: string;
  value: string;
}

interface CompanyDetails {
  id?: string;
  company_name: string;
  address: string;
  registration_ids: RegistrationId[];
  logo_url?: string;
}

interface Invoice {
  id: string;
  billing_name: string;
  user_display_id: number;
  invoice_date: string;
  items: InvoiceItem[];
  amount: number;
  harmonet_share_percent: number;
  taxes: InvoiceTax[];
  created_at: string;
}

const emptyForm = {
  billing_name: '',
  user_display_id: '',
  invoice_date: format(new Date(), 'yyyy-MM-dd'),
  items: [{ description: '', amount: 0 }] as InvoiceItem[],
  amount: 0,
  harmonet_share_percent: 0,
  taxes: [] as InvoiceTax[],
};

const emptyCompany: CompanyDetails = {
  company_name: 'Harmonet Music',
  address: '',
  registration_ids: [],
  logo_url: '',
};

// Convert image to base64 for PDF embedding
const loadLogoBase64 = (): Promise<string> => {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(img, 0, 0);
      resolve(canvas.toDataURL('image/png'));
    };
    img.onerror = () => resolve('');
    img.src = '/images/harmonet-logo-color.png';
  });
};

export default function AdminInvoices() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewInvoice, setPreviewInvoice] = useState<Invoice | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(10);
  const [search, setSearch] = useState('');
  const [logoBase64, setLogoBase64] = useState('');
  const [companyDetailsOpen, setCompanyDetailsOpen] = useState(false);
  const [company, setCompany] = useState<CompanyDetails>(emptyCompany);
  const [companyForm, setCompanyForm] = useState<CompanyDetails>(emptyCompany);
  const [savingCompany, setSavingCompany] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);

  // Load logo base64 from URL
  const loadLogoFromUrl = (url: string): Promise<string> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d')!;
        ctx.drawImage(img, 0, 0);
        resolve(canvas.toDataURL('image/png'));
      };
      img.onerror = () => resolve('');
      img.src = url;
    });
  };

  useEffect(() => { loadLogoBase64().then(setLogoBase64); }, []);

  const fetchCompanyDetails = async () => {
    const { data } = await supabase
      .from('company_details')
      .select('*')
      .limit(1)
      .maybeSingle();
    if (data) {
      const cd: CompanyDetails = {
        id: data.id,
        company_name: data.company_name as string,
        address: data.address as string,
        registration_ids: (data.registration_ids as unknown as RegistrationId[]) || [],
        logo_url: (data as any).logo_url || '',
      };
      setCompany(cd);
      setCompanyForm(cd);
      // If custom logo exists, load it
      if (cd.logo_url) {
        loadLogoFromUrl(cd.logo_url).then(b64 => { if (b64) setLogoBase64(b64); });
      }
    }
  };

  useEffect(() => { fetchCompanyDetails(); }, []);

  const fetchInvoices = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('invoices')
      .select('*')
      .order('created_at', { ascending: false });
    setInvoices((data as unknown as Invoice[]) || []);
    setLoading(false);
  };

  useEffect(() => { fetchInvoices(); }, []);

  const filtered = useMemo(() => {
    if (!search.trim()) return invoices;
    const q = search.toLowerCase();
    return invoices.filter(inv =>
      inv.billing_name.toLowerCase().includes(q) ||
      String(inv.user_display_id).includes(q) ||
      inv.invoice_date.includes(q)
    );
  }, [invoices, search]);

  const totalPages = Math.ceil(filtered.length / pageSize);
  const paged = filtered.slice((page - 1) * pageSize, page * pageSize);

  useEffect(() => { setPage(1); }, [search, pageSize]);

  const calcTotals = (amt: number, sharePercent: number, taxes: InvoiceTax[]) => {
    const harmonetShare = (amt * sharePercent) / 100;
    const totalTax = taxes.reduce((s, t) => s + (amt * t.percent) / 100, 0);
    const net = amt - harmonetShare - totalTax;
    return { harmonetShare, totalTax, net };
  };

  const itemsTotal = form.items.reduce((s, i) => s + (Number(i.amount) || 0), 0);

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm);
    setFormOpen(true);
  };

  const openEdit = (inv: Invoice) => {
    setEditingId(inv.id);
    setForm({
      billing_name: inv.billing_name,
      user_display_id: String(inv.user_display_id),
      invoice_date: inv.invoice_date,
      items: inv.items.length ? inv.items : [{ description: '', amount: 0 }],
      amount: inv.amount,
      harmonet_share_percent: inv.harmonet_share_percent,
      taxes: inv.taxes,
    });
    setFormOpen(true);
  };

  const handleSave = async () => {
    if (!form.billing_name || !form.user_display_id || !form.invoice_date) {
      toast.error('Please fill all required fields');
      return;
    }
    setSaving(true);
    const payload = {
      billing_name: form.billing_name,
      user_display_id: Number(form.user_display_id),
      invoice_date: form.invoice_date,
      items: form.items.filter(i => i.description) as unknown as any,
      amount: itemsTotal,
      harmonet_share_percent: Number(form.harmonet_share_percent),
      taxes: form.taxes as unknown as any,
    };

    if (editingId) {
      const { error } = await supabase.from('invoices').update(payload).eq('id', editingId);
      if (error) toast.error(error.message);
      else { toast.success('Invoice updated'); setFormOpen(false); fetchInvoices(); }
    } else {
      const { error } = await supabase.from('invoices').insert(payload);
      if (error) toast.error(error.message);
      else { toast.success('Invoice created'); setFormOpen(false); fetchInvoices(); }
    }
    setSaving(false);
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    await supabase.from('invoices').delete().eq('id', deleteId);
    toast.success('Invoice deleted');
    setDeleteId(null);
    fetchInvoices();
  };

  const openCompanySettings = () => {
    setCompanyForm({ ...company });
    setCompanyDetailsOpen(true);
  };

  const saveCompanyDetails = async () => {
    setSavingCompany(true);
    const payload = {
      company_name: companyForm.company_name,
      address: companyForm.address,
      registration_ids: companyForm.registration_ids as unknown as any,
      logo_url: companyForm.logo_url || null,
      updated_at: new Date().toISOString(),
    };
    if (companyForm.id) {
      const { error } = await supabase.from('company_details').update(payload).eq('id', companyForm.id);
      if (error) toast.error(error.message);
      else { toast.success('Company details updated'); setCompanyDetailsOpen(false); fetchCompanyDetails(); }
    } else {
      const { error } = await supabase.from('company_details').insert(payload);
      if (error) toast.error(error.message);
      else { toast.success('Company details saved'); setCompanyDetailsOpen(false); fetchCompanyDetails(); }
    }
    setSavingCompany(false);
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast.error('Please upload an image file');
      return;
    }
    setUploadingLogo(true);
    const ext = file.name.split('.').pop();
    const path = `company-logo/logo-${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from('covers').upload(path, file, { upsert: true });
    if (error) {
      toast.error('Failed to upload logo');
      setUploadingLogo(false);
      return;
    }
    const { data: urlData } = supabase.storage.from('covers').getPublicUrl(path);
    setCompanyForm(f => ({ ...f, logo_url: urlData.publicUrl }));
    toast.success('Logo uploaded');
    setUploadingLogo(false);
  };

  const addRegId = () => setCompanyForm(f => ({ ...f, registration_ids: [...f.registration_ids, { name: '', value: '' }] }));
  const removeRegId = (i: number) => setCompanyForm(f => ({ ...f, registration_ids: f.registration_ids.filter((_, idx) => idx !== i) }));
  const updateRegId = (i: number, key: 'name' | 'value', val: string) => {
    setCompanyForm(f => {
      const ids = [...f.registration_ids];
      ids[i] = { ...ids[i], [key]: val };
      return { ...f, registration_ids: ids };
    });
  };

  const generatePDF = (inv: Invoice) => {
    const doc = new jsPDF();
    const pw = doc.internal.pageSize.getWidth();
    const { harmonetShare, net } = calcTotals(inv.amount, inv.harmonet_share_percent, inv.taxes);
    const brandColor: [number, number, number] = [107, 21, 21]; // #6b1515

    // ── Top accent bar ──
    doc.setFillColor(...brandColor);
    doc.rect(0, 0, pw, 4, 'F');

    // ── Logo ──
    if (logoBase64) {
      // Logo is roughly square — use proportional sizing
      doc.addImage(logoBase64, 'PNG', 14, 8, 28, 28);
    } else {
      doc.setFontSize(16);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...brandColor);
      doc.text(company.company_name || 'HARMONET MUSIC', 14, 22);
    }

    // ── INVOICE title ──
    doc.setFontSize(28);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...brandColor);
    doc.text('INVOICE', pw - 14, 26, { align: 'right' });

    // ── Company details beside logo ──
    let compY = 10;
    const compX = 45; // right of the logo
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(80);
    if (company.company_name) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.text(company.company_name, compX, compY);
      compY += 4;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
    }
    if (company.address) {
      const addressLines = doc.splitTextToSize(company.address, 70);
      doc.text(addressLines, compX, compY);
      compY += addressLines.length * 3.5;
    }
    company.registration_ids.forEach(r => {
      if (r.name && r.value) {
        doc.text(`${r.name}: ${r.value}`, compX, compY);
        compY += 3.5;
      }
    });

    const dividerY = Math.max(compY + 2, 39);

    // ── Divider ──
    doc.setDrawColor(...brandColor);
    doc.setLineWidth(0.8);
    doc.line(14, dividerY, pw - 14, dividerY);

    const detailsY = dividerY + 8;

    // ── Invoice details (right side) ──
    doc.setFontSize(9);
    doc.setTextColor(80);
    doc.setFont('helvetica', 'bold');
    doc.text('Invoice Date:', pw - 80, detailsY);
    doc.text('User ID:', pw - 80, detailsY + 7);

    doc.setFont('helvetica', 'normal');
    doc.text(format(new Date(inv.invoice_date), 'dd MMM yyyy'), pw - 14, detailsY, { align: 'right' });
    doc.text(String(inv.user_display_id), pw - 14, detailsY + 7, { align: 'right' });

    // ── Bill To ──
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...brandColor);
    doc.text('BILL TO', 14, detailsY);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(50);
    doc.setFontSize(11);
    doc.text(inv.billing_name, 14, detailsY + 7);

    // ── Items Table ──
    const tableRows = inv.items.map((item, i) => [
      String(i + 1),
      item.description,
      `Rs. ${Number(item.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`,
    ]);

    autoTable(doc, {
      startY: detailsY + 18,
      head: [['#', 'Description', 'Amount (Rs.)']],
      body: tableRows,
      theme: 'striped',
      headStyles: {
        fillColor: brandColor,
        textColor: 255,
        fontStyle: 'bold',
        fontSize: 10,
        cellPadding: 4,
      },
      bodyStyles: {
        fontSize: 9,
        cellPadding: 3.5,
        textColor: [50, 50, 50],
      },
      alternateRowStyles: {
        fillColor: [252, 245, 245],
      },
      columnStyles: {
        0: { cellWidth: 14, halign: 'center' },
        2: { halign: 'right', cellWidth: 45 },
      },
      styles: {
        lineColor: [220, 220, 220],
        lineWidth: 0.3,
      },
      margin: { left: 14, right: 14 },
    });

    const finalY = (doc as any).lastAutoTable.finalY + 12;

    // ── Summary Box ──
    const boxX = pw - 100;
    const boxW = 86;
    let sy = finalY;

    // Background for summary
    const summaryLines = 2 + inv.taxes.length + 1; // subtotal + share + taxes + net
    const boxH = summaryLines * 8 + 16;
    doc.setFillColor(252, 245, 245);
    doc.setDrawColor(220, 200, 200);
    doc.setLineWidth(0.3);
    doc.roundedRect(boxX - 4, sy - 6, boxW + 8, boxH, 3, 3, 'FD');

    doc.setFontSize(9);
    doc.setTextColor(80);
    doc.setFont('helvetica', 'normal');

    doc.text('Subtotal:', boxX, sy);
    doc.text(`Rs. ${inv.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, boxX + boxW, sy, { align: 'right' });
    sy += 8;

    doc.setTextColor(180, 50, 50);
    doc.text(`Harmonet Share (${inv.harmonet_share_percent}%):`, boxX, sy);
    doc.text(`- Rs. ${harmonetShare.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, boxX + boxW, sy, { align: 'right' });
    sy += 8;

    inv.taxes.forEach(t => {
      const tAmt = (inv.amount * t.percent) / 100;
      doc.text(`${t.name} (${t.percent}%):`, boxX, sy);
      doc.text(`- Rs. ${tAmt.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, boxX + boxW, sy, { align: 'right' });
      sy += 8;
    });

    // Net line
    doc.setDrawColor(...brandColor);
    doc.setLineWidth(0.6);
    doc.line(boxX, sy - 2, boxX + boxW, sy - 2);
    sy += 4;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(...brandColor);
    doc.text('Net Payable:', boxX, sy);
    doc.text(`Rs. ${net.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, boxX + boxW, sy, { align: 'right' });

    // ── Footer ──
    const footerY = 272;
    doc.setDrawColor(...brandColor);
    doc.setLineWidth(0.5);
    doc.line(14, footerY, pw - 14, footerY);

    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(140);
    doc.text(`This is a computer-generated invoice by ${company.company_name || 'Harmonet Music'}.`, 14, footerY + 6);
    doc.text('Harmony On Networks', 14, footerY + 11);

    // Bottom accent bar
    doc.setFillColor(...brandColor);
    doc.rect(0, doc.internal.pageSize.getHeight() - 4, pw, 4, 'F');

    return doc;
  };

  const downloadPDF = (inv: Invoice) => {
    const doc = generatePDF(inv);
    doc.save(`Invoice_${inv.user_display_id}_${inv.invoice_date}.pdf`);
  };

  const openPreview = (inv: Invoice) => {
    setPreviewInvoice(inv);
    setPreviewOpen(true);
  };

  // Add/remove items
  const addItem = () => setForm(f => ({ ...f, items: [...f.items, { description: '', amount: 0 }] }));
  const removeItem = (i: number) => setForm(f => ({ ...f, items: f.items.filter((_, idx) => idx !== i) }));
  const updateItem = (i: number, key: keyof InvoiceItem, val: string) => {
    setForm(f => {
      const items = [...f.items];
      (items[i] as any)[key] = key === 'amount' ? Number(val) || 0 : val;
      return { ...f, items };
    });
  };

  // Add/remove taxes
  const addTax = () => setForm(f => ({ ...f, taxes: [...f.taxes, { name: '', percent: 0 }] }));
  const removeTax = (i: number) => setForm(f => ({ ...f, taxes: f.taxes.filter((_, idx) => idx !== i) }));
  const updateTax = (i: number, key: keyof InvoiceTax, val: string) => {
    setForm(f => {
      const taxes = [...f.taxes];
      (taxes[i] as any)[key] = key === 'percent' ? Number(val) || 0 : val;
      return { ...f, taxes };
    });
  };

  const { harmonetShare: formHarmonetShare, totalTax: formTotalTax, net: formNet } = calcTotals(
    itemsTotal,
    Number(form.harmonet_share_percent) || 0,
    form.taxes
  );

  const startItem = (page - 1) * pageSize + 1;
  const endItem = Math.min(page * pageSize, filtered.length);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Generate Invoice</h1>
            <p className="text-muted-foreground text-sm">Create and manage invoices</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={openCompanySettings} className="gap-2">
              <Settings className="h-4 w-4" /> Company Details
            </Button>
            <Button onClick={openCreate} className="gap-2">
              <Plus className="h-4 w-4" /> New Invoice
            </Button>
          </div>
        </div>

        {/* Search Bar */}
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by name, user ID, or date..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>

        <GlassCard>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Billing Name</TableHead>
                  <TableHead>User ID</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Net Payable</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Loading...</TableCell></TableRow>
                ) : paged.length === 0 ? (
                  <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">{search ? 'No matching invoices' : 'No invoices yet'}</TableCell></TableRow>
                ) : paged.map(inv => {
                  const { net } = calcTotals(inv.amount, inv.harmonet_share_percent, inv.taxes);
                  return (
                    <TableRow key={inv.id}>
                      <TableCell className="font-medium">{inv.billing_name}</TableCell>
                      <TableCell>{inv.user_display_id}</TableCell>
                      <TableCell>{format(new Date(inv.invoice_date), 'dd MMM yyyy')}</TableCell>
                      <TableCell>₹{inv.amount.toFixed(2)}</TableCell>
                      <TableCell className="font-semibold text-primary">₹{net.toFixed(2)}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Button variant="ghost" size="icon" onClick={() => openPreview(inv)} title="Preview">
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => downloadPDF(inv)} title="Download PDF">
                            <Download className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => openEdit(inv)} title="Edit">
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => setDeleteId(inv.id)} title="Delete" className="text-destructive">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>

          {/* Pagination */}
          {filtered.length > 0 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-border">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <span>Showing {startItem}–{endItem} of {filtered.length}</span>
                <Select value={String(pageSize)} onValueChange={v => setPageSize(Number(v))}>
                  <SelectTrigger className="w-[70px] h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="10">10</SelectItem>
                    <SelectItem value="25">25</SelectItem>
                    <SelectItem value="50">50</SelectItem>
                  </SelectContent>
                </Select>
                <span>per page</span>
              </div>
              <div className="flex items-center gap-1">
                <Button variant="outline" size="icon" className="h-8 w-8" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                  let pageNum: number;
                  if (totalPages <= 5) pageNum = i + 1;
                  else if (page <= 3) pageNum = i + 1;
                  else if (page >= totalPages - 2) pageNum = totalPages - 4 + i;
                  else pageNum = page - 2 + i;
                  return (
                    <Button
                      key={pageNum}
                      variant={pageNum === page ? 'default' : 'outline'}
                      size="icon"
                      className="h-8 w-8 text-xs"
                      onClick={() => setPage(pageNum)}
                    >
                      {pageNum}
                    </Button>
                  );
                })}
                <Button variant="outline" size="icon" className="h-8 w-8" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </GlassCard>
      </div>

      {/* Create / Edit Dialog */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? 'Edit Invoice' : 'Create Invoice'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label>Billing Name *</Label>
                <Input value={form.billing_name} onChange={e => setForm(f => ({ ...f, billing_name: e.target.value }))} placeholder="Client name" />
              </div>
              <div>
                <Label>User ID *</Label>
                <Input type="number" value={form.user_display_id} onChange={e => setForm(f => ({ ...f, user_display_id: e.target.value }))} placeholder="1, 2, 3..." />
              </div>
              <div>
                <Label>Invoice Date *</Label>
                <Input type="date" value={form.invoice_date} onChange={e => setForm(f => ({ ...f, invoice_date: e.target.value }))} />
              </div>
            </div>

            {/* Items */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <Label className="text-sm font-semibold">Invoice Items</Label>
                <Button type="button" variant="outline" size="sm" onClick={addItem} className="gap-1">
                  <Plus className="h-3 w-3" /> Add Item
                </Button>
              </div>
              <div className="space-y-2">
                {form.items.map((item, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <Input placeholder="Description" value={item.description} onChange={e => updateItem(i, 'description', e.target.value)} className="flex-1" />
                    <Input type="number" placeholder="Amount" value={item.amount || ''} onChange={e => updateItem(i, 'amount', e.target.value)} className="w-32" />
                    {form.items.length > 1 && (
                      <Button type="button" variant="ghost" size="icon" onClick={() => removeItem(i)} className="text-destructive shrink-0">
                        <X className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
              <p className="text-xs text-muted-foreground mt-1">Items Total: ₹{itemsTotal.toFixed(2)}</p>
            </div>

            {/* Harmonet Share */}
            <div className="w-48">
              <Label>Harmonet Music Share %</Label>
              <Input
                type="number"
                value={form.harmonet_share_percent || ''}
                onChange={e => setForm(f => ({ ...f, harmonet_share_percent: Number(e.target.value) || 0 }))}
                placeholder="e.g. 15"
              />
            </div>

            {/* Taxes */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <Label className="text-sm font-semibold">Taxes</Label>
                <Button type="button" variant="outline" size="sm" onClick={addTax} className="gap-1">
                  <Plus className="h-3 w-3" /> Add Tax
                </Button>
              </div>
              {form.taxes.length === 0 && <p className="text-xs text-muted-foreground">No taxes added</p>}
              <div className="space-y-2">
                {form.taxes.map((t, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <Input placeholder="Tax Name (e.g. GST)" value={t.name} onChange={e => updateTax(i, 'name', e.target.value)} className="flex-1" />
                    <Input type="number" placeholder="%" value={t.percent || ''} onChange={e => updateTax(i, 'percent', e.target.value)} className="w-24" />
                    <Button type="button" variant="ghost" size="icon" onClick={() => removeTax(i)} className="text-destructive shrink-0">
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>

            {/* Summary */}
            <div className="rounded-lg border border-border p-4 space-y-1 bg-muted/30">
              <div className="flex justify-between text-sm">
                <span>Subtotal</span><span>₹{itemsTotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm text-destructive">
                <span>Harmonet Share ({form.harmonet_share_percent}%)</span><span>- ₹{formHarmonetShare.toFixed(2)}</span>
              </div>
              {form.taxes.map((t, i) => (
                <div key={i} className="flex justify-between text-sm text-destructive">
                  <span>{t.name || 'Tax'} ({t.percent}%)</span><span>- ₹{((itemsTotal * t.percent) / 100).toFixed(2)}</span>
                </div>
              ))}
              <div className="border-t border-border pt-2 flex justify-between font-bold text-lg">
                <span>Net Payable</span><span className="text-primary">₹{formNet.toFixed(2)}</span>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setFormOpen(false)}>Cancel</Button>
              <Button onClick={handleSave} disabled={saving}>{saving ? 'Saving...' : editingId ? 'Update' : 'Create'}</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Preview Dialog */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><FileText className="h-5 w-5" /> Invoice Preview</DialogTitle>
          </DialogHeader>
          {previewInvoice && (() => {
            const { harmonetShare, net } = calcTotals(previewInvoice.amount, previewInvoice.harmonet_share_percent, previewInvoice.taxes);
            return (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div><span className="text-muted-foreground">Billing Name:</span> <strong>{previewInvoice.billing_name}</strong></div>
                  <div><span className="text-muted-foreground">User ID:</span> <strong>{previewInvoice.user_display_id}</strong></div>
                  <div><span className="text-muted-foreground">Date:</span> <strong>{format(new Date(previewInvoice.invoice_date), 'dd MMM yyyy')}</strong></div>
                </div>

                <div>
                  <p className="text-sm font-semibold mb-2">Items</p>
                  <Table>
                    <TableHeader><TableRow><TableHead>#</TableHead><TableHead>Description</TableHead><TableHead className="text-right">Amount</TableHead></TableRow></TableHeader>
                    <TableBody>
                      {previewInvoice.items.map((item, i) => (
                        <TableRow key={i}>
                          <TableCell>{i + 1}</TableCell>
                          <TableCell>{item.description}</TableCell>
                          <TableCell className="text-right">₹{Number(item.amount).toFixed(2)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                <div className="rounded-lg border border-border p-4 space-y-1 bg-muted/30 text-sm">
                  <div className="flex justify-between"><span>Subtotal</span><span>₹{previewInvoice.amount.toFixed(2)}</span></div>
                  <div className="flex justify-between text-destructive"><span>Harmonet Share ({previewInvoice.harmonet_share_percent}%)</span><span>- ₹{harmonetShare.toFixed(2)}</span></div>
                  {previewInvoice.taxes.map((t, i) => (
                    <div key={i} className="flex justify-between text-destructive">
                      <span>{t.name} ({t.percent}%)</span><span>- ₹{((previewInvoice.amount * t.percent) / 100).toFixed(2)}</span>
                    </div>
                  ))}
                  <div className="border-t border-border pt-2 flex justify-between font-bold text-base">
                    <span>Net Payable</span><span className="text-primary">₹{net.toFixed(2)}</span>
                  </div>
                </div>

                <Button onClick={() => downloadPDF(previewInvoice)} className="w-full gap-2">
                  <Download className="h-4 w-4" /> Download PDF
                </Button>
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>

      {deleteId && (
        <ConfirmDialogWrapper open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
          <ConfirmContent>
            <ConfirmHeader><ConfirmTitle>Delete Invoice</ConfirmTitle></ConfirmHeader>
            <p className="text-sm text-muted-foreground">Are you sure you want to delete this invoice?</p>
            <div className="flex justify-end gap-2 mt-4">
              <Button variant="outline" onClick={() => setDeleteId(null)}>Cancel</Button>
              <Button variant="destructive" onClick={handleDelete}>Delete</Button>
            </div>
          </ConfirmContent>
        </ConfirmDialogWrapper>
      )}

      {/* Company Details Dialog */}
      <Dialog open={companyDetailsOpen} onOpenChange={setCompanyDetailsOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Settings className="h-5 w-5" /> Company Details</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {/* Logo Upload */}
            <div>
              <Label className="text-sm font-semibold">Company Logo</Label>
              <div className="flex items-center gap-4 mt-2">
                {companyForm.logo_url ? (
                  <div className="relative">
                    <img src={companyForm.logo_url} alt="Logo" className="h-16 w-16 object-contain rounded-lg border border-border bg-white p-1" />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="absolute -top-2 -right-2 h-5 w-5 rounded-full bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      onClick={() => setCompanyForm(f => ({ ...f, logo_url: '' }))}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                ) : (
                  <div className="h-16 w-16 rounded-lg border-2 border-dashed border-border flex items-center justify-center text-muted-foreground">
                    <FileText className="h-6 w-6" />
                  </div>
                )}
                <div>
                  <label className="cursor-pointer">
                    <Button type="button" variant="outline" size="sm" disabled={uploadingLogo} asChild>
                      <span>{uploadingLogo ? 'Uploading...' : 'Upload Logo'}</span>
                    </Button>
                    <input type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} />
                  </label>
                  <p className="text-xs text-muted-foreground mt-1">PNG or JPG recommended</p>
                </div>
              </div>
            </div>
            <div>
              <Label>Company Name</Label>
              <Input value={companyForm.company_name} onChange={e => setCompanyForm(f => ({ ...f, company_name: e.target.value }))} placeholder="Harmonet Music" />
            </div>
            <div>
              <Label>Address</Label>
              <Textarea value={companyForm.address} onChange={e => setCompanyForm(f => ({ ...f, address: e.target.value }))} placeholder="Company full address..." rows={3} />
            </div>
            <div>
              <div className="flex items-center justify-between mb-2">
                <Label className="text-sm font-semibold">Registration IDs</Label>
                <Button type="button" variant="outline" size="sm" onClick={addRegId} className="gap-1">
                  <Plus className="h-3 w-3" /> Add ID
                </Button>
              </div>
              {companyForm.registration_ids.length === 0 && <p className="text-xs text-muted-foreground">No registration IDs added</p>}
              <div className="space-y-2">
                {companyForm.registration_ids.map((r, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <Input placeholder="ID Name (e.g. GST)" value={r.name} onChange={e => updateRegId(i, 'name', e.target.value)} className="w-36" />
                    <Input placeholder="ID Number" value={r.value} onChange={e => updateRegId(i, 'value', e.target.value)} className="flex-1" />
                    <Button type="button" variant="ghost" size="icon" onClick={() => removeRegId(i)} className="text-destructive shrink-0">
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setCompanyDetailsOpen(false)}>Cancel</Button>
              <Button onClick={saveCompanyDetails} disabled={savingCompany}>{savingCompany ? 'Saving...' : 'Save'}</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
