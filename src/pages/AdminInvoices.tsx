import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { DashboardLayout } from '@/components/DashboardLayout';
import { GlassCard } from '@/components/GlassCard';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { TablePagination } from '@/components/TablePagination';
import { toast } from 'sonner';
import { Plus, Trash2, Download, Eye, Pencil, X, FileText } from 'lucide-react';
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
  const perPage = 10;

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

  const totalPages = Math.ceil(invoices.length / perPage);
  const paged = invoices.slice((page - 1) * perPage, page * perPage);

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

  const generatePDF = (inv: Invoice) => {
    const doc = new jsPDF();
    const { harmonetShare, totalTax, net } = calcTotals(inv.amount, inv.harmonet_share_percent, inv.taxes);

    // Header
    doc.setFontSize(22);
    doc.setFont('helvetica', 'bold');
    doc.text('INVOICE', 14, 22);

    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('Harmonet Music', 14, 32);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);

    // Invoice details
    doc.text(`Invoice Date: ${format(new Date(inv.invoice_date), 'dd MMM yyyy')}`, 140, 22);
    doc.text(`User ID: ${inv.user_display_id}`, 140, 28);

    doc.setDrawColor(100, 100, 255);
    doc.setLineWidth(0.5);
    doc.line(14, 38, 196, 38);

    // Bill To
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text('Bill To:', 14, 46);
    doc.setFont('helvetica', 'normal');
    doc.text(inv.billing_name, 14, 52);

    // Items table
    const tableRows = inv.items.map((item, i) => [
      String(i + 1),
      item.description,
      `₹${Number(item.amount).toFixed(2)}`,
    ]);

    autoTable(doc, {
      startY: 60,
      head: [['#', 'Description', 'Amount']],
      body: tableRows,
      theme: 'grid',
      headStyles: { fillColor: [79, 70, 229], textColor: 255, fontStyle: 'bold' },
      styles: { fontSize: 10 },
      columnStyles: { 0: { cellWidth: 15 }, 2: { halign: 'right', cellWidth: 40 } },
    });

    const finalY = (doc as any).lastAutoTable.finalY + 10;

    // Summary
    const summaryX = 120;
    doc.setFont('helvetica', 'normal');
    doc.text('Subtotal:', summaryX, finalY);
    doc.text(`₹${inv.amount.toFixed(2)}`, 180, finalY, { align: 'right' });

    doc.text(`Harmonet Share (${inv.harmonet_share_percent}%):`, summaryX, finalY + 7);
    doc.text(`- ₹${harmonetShare.toFixed(2)}`, 180, finalY + 7, { align: 'right' });

    let taxY = finalY + 14;
    inv.taxes.forEach(t => {
      const tAmt = (inv.amount * t.percent) / 100;
      doc.text(`${t.name} (${t.percent}%):`, summaryX, taxY);
      doc.text(`- ₹${tAmt.toFixed(2)}`, 180, taxY, { align: 'right' });
      taxY += 7;
    });

    doc.setDrawColor(100, 100, 255);
    doc.line(summaryX, taxY, 190, taxY);
    taxY += 7;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.text('Net Payable:', summaryX, taxY);
    doc.text(`₹${net.toFixed(2)}`, 180, taxY, { align: 'right' });

    // Footer
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(130);
    doc.text('This is a computer-generated invoice by Harmonet Music.', 14, 280);

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

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Generate Invoice</h1>
            <p className="text-muted-foreground text-sm">Create and manage invoices</p>
          </div>
          <Button onClick={openCreate} className="gap-2">
            <Plus className="h-4 w-4" /> New Invoice
          </Button>
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
                  <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">No invoices yet</TableCell></TableRow>
                ) : paged.map(inv => {
                  const { net } = calcTotals(inv.amount, inv.harmonet_share_percent, inv.taxes);
                  return (
                    <TableRow key={inv.id}>
                      <TableCell className="font-medium">{inv.billing_name}</TableCell>
                      <TableCell>{inv.user_display_id}</TableCell>
                      <TableCell>{format(new Date(inv.invoice_date), 'dd MMM yyyy')}</TableCell>
                      <TableCell>₹{inv.amount.toFixed(2)}</TableCell>
                      <TableCell className="font-semibold text-emerald-400">₹{net.toFixed(2)}</TableCell>
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
          {totalPages > 1 && <TablePagination currentPage={page} totalPages={totalPages} onPageChange={setPage} />}
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
                    <Input
                      placeholder="Description"
                      value={item.description}
                      onChange={e => updateItem(i, 'description', e.target.value)}
                      className="flex-1"
                    />
                    <Input
                      type="number"
                      placeholder="Amount"
                      value={item.amount || ''}
                      onChange={e => updateItem(i, 'amount', e.target.value)}
                      className="w-32"
                    />
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
                <span>Net Payable</span><span className="text-emerald-400">₹{formNet.toFixed(2)}</span>
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
            const { harmonetShare, totalTax, net } = calcTotals(previewInvoice.amount, previewInvoice.harmonet_share_percent, previewInvoice.taxes);
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
                    <span>Net Payable</span><span className="text-emerald-400">₹{net.toFixed(2)}</span>
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

      <ConfirmDialog
        open={!!deleteId}
        onOpenChange={(o) => !o && setDeleteId(null)}
        title="Delete Invoice"
        description="Are you sure you want to delete this invoice?"
        onConfirm={handleDelete}
      />
    </DashboardLayout>
  );
}
