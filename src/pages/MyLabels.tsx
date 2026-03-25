import { useEffect, useState, useMemo } from 'react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { GlassCard } from '@/components/GlassCard';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { StatusBadge } from '@/components/StatusBadge';
import { Loader2, Upload, Plus, Trash2, Tag, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { toast } from 'sonner';
import { TablePagination, paginateItems } from '@/components/TablePagination';

type Label = {
  id: string;
  label_name: string;
  b2b_url: string | null;
  status: string;
  rejection_reason: string | null;
  created_at: string;
};

export default function MyLabels() {
  const { user } = useAuth();
  const [labels, setLabels] = useState<Label[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [labelName, setLabelName] = useState('');
  const [b2bFile, setB2bFile] = useState<File | null>(null);
  const [deleteLabel, setDeleteLabel] = useState<Label | null>(null);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState<number | 'all'>(10);

  const paginated = useMemo(() => paginateItems(labels, page, pageSize), [labels, page, pageSize]);

  const inputClass =
    'w-full px-4 py-3 rounded-lg bg-muted/50 border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary transition-all text-sm';

  const fetchLabels = async () => {
    if (!user) return;
    const { data } = await supabase
      .from('labels')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });
    setLabels((data as Label[]) || []);
    setLoading(false);
  };

  useEffect(() => { fetchLabels(); }, [user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !labelName.trim() || !b2bFile) {
      if (!b2bFile) { toast.error('B2B document (PDF) is required'); return; }
      return;
    }

    setSubmitting(true);
    try {
      let b2b_url: string | null = null;

      if (b2bFile) {
        const path = `${user.id}/${Date.now()}-${b2bFile.name}`;
        const { error } = await supabase.storage.from('b2b-documents').upload(path, b2bFile);
        if (error) throw error;
        b2b_url = path;
      }

      const { error } = await supabase.from('labels').insert({
        user_id: user.id,
        label_name: labelName.trim(),
        b2b_url,
      });

      if (error) throw error;
      toast.success('Label submitted for approval!');
      setLabelName('');
      setB2bFile(null);
      setShowForm(false);
      fetchLabels();
    } catch (err: any) {
      toast.error(err.message || 'Failed to submit label');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteLabel) return;
    const { error } = await supabase.from('labels').delete().eq('id', deleteLabel.id);
    if (error) { toast.error(error.message); return; }
    toast.success('Label deleted');
    setDeleteLabel(null);
    fetchLabels();
  };

  const handleDownloadB2b = async (b2bPath: string) => {
    const { data, error } = await supabase.storage.from('b2b-documents').createSignedUrl(b2bPath, 300);
    if (error || !data?.signedUrl) {
      toast.error('Failed to get download link');
      return;
    }
    window.open(data.signedUrl, '_blank');
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="mb-6 sm:mb-8">
        <h1 className="text-2xl sm:text-3xl font-display font-bold text-foreground">My Labels</h1>
        <p className="text-muted-foreground mt-1 text-sm sm:text-base">
          Add your label names. Approved labels will appear in © Line and ℗ Line dropdowns.
        </p>
      </div>

      {!showForm && (
        <Button onClick={() => setShowForm(true)} className="mb-6 gap-2 btn-primary-gradient text-primary-foreground font-semibold">
          <Plus className="h-4 w-4" /> Add New Label
        </Button>
      )}

      {showForm && (
        <GlassCard glow className="mb-6 animate-fade-in">
          <h2 className="text-lg font-semibold text-foreground mb-4">Add New Label</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-1">Label Name *</label>
              <input className={inputClass} value={labelName} onChange={(e) => setLabelName(e.target.value)} required placeholder="Enter label name" />
            </div>
            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-1">
                B2B Document (PDF) <span className="text-xs text-muted-foreground">— optional</span>
              </label>
              <div className="relative">
                <input type="file" accept=".pdf,application/pdf" onChange={(e) => setB2bFile(e.target.files?.[0] || null)} className="hidden" id="b2b-upload" />
                <label htmlFor="b2b-upload" className={`${inputClass} flex min-w-0 cursor-pointer items-center gap-2`}>
                  <Upload className="h-4 w-4 shrink-0" />
                  <span className="truncate">{b2bFile?.name || 'Choose PDF file'}</span>
                </label>
              </div>
            </div>
            <div className="flex gap-3">
              <Button type="button" variant="outline" onClick={() => { setShowForm(false); setLabelName(''); setB2bFile(null); }} className="flex-1">Cancel</Button>
              <Button type="submit" disabled={submitting} className="flex-1 btn-primary-gradient font-semibold text-primary-foreground">
                {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                Submit Label
              </Button>
            </div>
          </form>
        </GlassCard>
      )}

      {labels.length === 0 ? (
        <GlassCard className="animate-fade-in text-center py-12">
          <Tag className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground">No labels yet. Add your first label!</p>
        </GlassCard>
      ) : (
        <div className="space-y-3">
          {paginated.map((label) => (
            <GlassCard key={label.id} className="animate-fade-in">
              <div className="flex items-center gap-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Tag className="h-5 w-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-foreground">{label.label_name}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-xs text-muted-foreground">{new Date(label.created_at).toLocaleDateString()}</span>
                    {label.b2b_url && (
                      <button onClick={() => handleDownloadB2b(label.b2b_url!)} className="flex items-center gap-1 text-xs text-primary hover:text-primary/80 transition-colors">
                        <FileText className="h-3 w-3" /> View B2B
                      </button>
                    )}
                  </div>
                </div>
                <StatusBadge status={label.status} />
                {label.status === 'rejected' && label.rejection_reason && (
                  <p className="text-xs text-destructive max-w-[200px]" title={label.rejection_reason}>
                    Reason: {label.rejection_reason}
                  </p>
                )}
                {label.status === 'pending' && (
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setDeleteLabel(label)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                )}
              </div>
            </GlassCard>
          ))}
          <TablePagination
            totalItems={labels.length}
            currentPage={page}
            pageSize={pageSize}
            onPageChange={setPage}
            onPageSizeChange={setPageSize}
            itemLabel="labels"
          />
        </div>
      )}

      {deleteLabel && (
        <ConfirmDialog title="Delete Label" message={`Are you sure you want to delete "${deleteLabel.label_name}"?`} onConfirm={handleDelete} onCancel={() => setDeleteLabel(null)} />
      )}
    </DashboardLayout>
  );
}