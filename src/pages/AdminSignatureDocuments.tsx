import { useState, useEffect } from 'react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { GlassCard } from '@/components/GlassCard';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { StatusBadge } from '@/components/StatusBadge';
import { TablePagination } from '@/components/TablePagination';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Plus, Send, Eye, FileSignature, Trash2, RefreshCw, Upload } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { ConfirmDialog } from '@/components/ConfirmDialog';

interface Recipient {
  name: string;
  email: string;
}

export default function AdminSignatureDocuments() {
  const navigate = useNavigate();
  const [documents, setDocuments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [recipients, setRecipients] = useState<Recipient[]>([{ name: '', email: '' }]);
  const [page, setPage] = useState(1);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const perPage = 10;

  const fetchDocuments = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('signature_documents')
      .select('*')
      .order('created_at', { ascending: false });
    if (!error) setDocuments(data || []);
    setLoading(false);
  };

  useEffect(() => { fetchDocuments(); }, []);

  const computeHash = async (file: File): Promise<string> => {
    const buffer = await file.arrayBuffer();
    const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
    return Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
  };

  const handleCreate = async () => {
    if (!title.trim() || !pdfFile) {
      toast.error('Title and PDF file are required');
      return;
    }
    const validRecipients = recipients.filter(r => r.name.trim() && r.email.trim());
    if (validRecipients.length === 0) {
      toast.error('At least one recipient is required');
      return;
    }

    setCreating(true);
    try {
      // Upload PDF
      const fileExt = pdfFile.name.split('.').pop();
      const filePath = `${crypto.randomUUID()}.${fileExt}`;
      const { error: uploadError } = await supabase.storage
        .from('signature-documents')
        .upload(filePath, pdfFile, { contentType: 'application/pdf' });
      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('signature-documents')
        .getPublicUrl(filePath);

      // Compute SHA-256 hash
      const hash = await computeHash(pdfFile);

      // Create document
      const { data: { user } } = await supabase.auth.getUser();
      const { data: doc, error: docError } = await supabase
        .from('signature_documents')
        .insert({
          title: title.trim(),
          description: description.trim(),
          document_url: filePath,
          document_hash: hash,
          created_by: user!.id,
          status: 'draft',
          expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        })
        .select()
        .single();
      if (docError) throw docError;

      // Create recipients
      for (let i = 0; i < validRecipients.length; i++) {
        const token = crypto.randomUUID() + '-' + crypto.randomUUID();
        await supabase.from('signature_recipients').insert({
          document_id: doc.id,
          name: validRecipients[i].name.trim(),
          email: validRecipients[i].email.trim().toLowerCase(),
          signing_order: i + 1,
          signing_token: token,
          token_expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        });
      }

      toast.success('Document created successfully');
      setCreateOpen(false);
      setTitle('');
      setDescription('');
      setPdfFile(null);
      setRecipients([{ name: '', email: '' }]);
      fetchDocuments();
    } catch (err: any) {
      toast.error(err.message || 'Failed to create document');
    }
    setCreating(false);
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    const { error } = await supabase.from('signature_documents').delete().eq('id', deleteId);
    if (error) toast.error('Failed to delete');
    else {
      toast.success('Document deleted');
      fetchDocuments();
    }
    setDeleteId(null);
  };

  const handleSend = async (docId: string) => {
    try {
      // Update status to sent
      await supabase.from('signature_documents').update({ status: 'sent' }).eq('id', docId);
      
      // Call edge function to send emails
      const { error } = await supabase.functions.invoke('send-signing-email', {
        body: { document_id: docId },
      });
      if (error) throw error;
      
      toast.success('Document sent for signing');
      fetchDocuments();
    } catch (err: any) {
      toast.error(err.message || 'Failed to send');
    }
  };

  const paginatedDocs = documents.slice((page - 1) * perPage, page * perPage);
  const totalPages = Math.ceil(documents.length / perPage);

  const statusColor = (s: string) => {
    switch (s) {
      case 'draft': return 'secondary';
      case 'sent': return 'default';
      case 'completed': return 'default';
      default: return 'secondary';
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">E-Signature Documents</h1>
            <p className="text-muted-foreground text-sm">Upload, send, and manage signature requests</p>
          </div>
          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger asChild>
              <Button><Plus className="h-4 w-4 mr-2" /> New Document</Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Create Signature Document</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 mt-4">
                <div>
                  <Label>Document Title *</Label>
                  <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="Distribution Agreement" />
                </div>
                <div>
                  <Label>Description</Label>
                  <Textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="Optional description..." rows={2} />
                </div>
                <div>
                  <Label>Upload PDF *</Label>
                  <div className="mt-1">
                    <label className="flex items-center gap-2 px-4 py-3 border-2 border-dashed rounded-lg cursor-pointer hover:bg-muted/50 transition-colors">
                      <Upload className="h-5 w-5 text-muted-foreground" />
                      <span className="text-sm text-muted-foreground">
                        {pdfFile ? pdfFile.name : 'Click to upload PDF'}
                      </span>
                      <input
                        type="file"
                        accept=".pdf"
                        className="hidden"
                        onChange={e => setPdfFile(e.target.files?.[0] || null)}
                      />
                    </label>
                  </div>
                </div>
                <div>
                  <Label>Recipients</Label>
                  <div className="space-y-2 mt-1">
                    {recipients.map((r, i) => (
                      <div key={i} className="flex gap-2">
                        <Input
                          placeholder="Name"
                          value={r.name}
                          onChange={e => {
                            const updated = [...recipients];
                            updated[i].name = e.target.value;
                            setRecipients(updated);
                          }}
                        />
                        <Input
                          placeholder="Email"
                          type="email"
                          value={r.email}
                          onChange={e => {
                            const updated = [...recipients];
                            updated[i].email = e.target.value;
                            setRecipients(updated);
                          }}
                        />
                        {recipients.length > 1 && (
                          <Button variant="ghost" size="icon" onClick={() => setRecipients(recipients.filter((_, j) => j !== i))}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    ))}
                    <Button variant="outline" size="sm" onClick={() => setRecipients([...recipients, { name: '', email: '' }])}>
                      <Plus className="h-3 w-3 mr-1" /> Add Recipient
                    </Button>
                  </div>
                </div>
                <Button className="w-full" onClick={handleCreate} disabled={creating}>
                  {creating ? 'Creating...' : 'Create Document'}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        <GlassCard>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Title</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={4} className="text-center py-8 text-muted-foreground">Loading...</TableCell></TableRow>
              ) : paginatedDocs.length === 0 ? (
                <TableRow><TableCell colSpan={4} className="text-center py-8 text-muted-foreground">No documents yet</TableCell></TableRow>
              ) : paginatedDocs.map(doc => (
                <TableRow key={doc.id}>
                  <TableCell className="font-medium">{doc.title}</TableCell>
                  <TableCell>
                    <Badge variant={statusColor(doc.status) as any}>
                      {doc.status === 'completed' ? '✅ Completed' : doc.status === 'sent' ? '📨 Sent' : '📝 Draft'}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {format(new Date(doc.created_at), 'dd MMM yyyy')}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button variant="ghost" size="icon" onClick={() => navigate(`/admin/signature/${doc.id}`)}>
                        <Eye className="h-4 w-4" />
                      </Button>
                      {doc.status === 'draft' && (
                        <>
                          <Button variant="ghost" size="icon" onClick={() => navigate(`/admin/signature/${doc.id}/fields`)}>
                            <FileSignature className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => handleSend(doc.id)}>
                            <Send className="h-4 w-4" />
                          </Button>
                        </>
                      )}
                      {doc.status === 'sent' && (
                        <Button variant="ghost" size="icon" onClick={() => handleSend(doc.id)} title="Resend">
                          <RefreshCw className="h-4 w-4" />
                        </Button>
                      )}
                      <Button variant="ghost" size="icon" onClick={() => setDeleteId(doc.id)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {totalPages > 1 && (
            <div className="p-4 border-t">
              <TablePagination currentPage={page} totalPages={totalPages} onPageChange={setPage} />
            </div>
          )}
        </GlassCard>
      </div>

      <ConfirmDialog
        open={!!deleteId}
        onOpenChange={() => setDeleteId(null)}
        onConfirm={handleDelete}
        title="Delete Document"
        description="This will permanently delete this document and all related data."
      />
    </DashboardLayout>
  );
}
