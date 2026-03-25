import { useEffect, useState, useMemo } from 'react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { GlassCard } from '@/components/GlassCard';
import { supabase } from '@/integrations/supabase/client';
import { StatusBadge } from '@/components/StatusBadge';
import { Loader2, Tag, FileText, Trash2, Pencil, Check, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { RejectReasonModal } from '@/components/RejectReasonModal';
import { TablePagination, paginateItems } from '@/components/TablePagination';
import { toast } from 'sonner';

type Label = {
  id: string;
  user_id: string;
  label_name: string;
  b2b_url: string | null;
  status: string;
  rejection_reason: string | null;
  created_at: string;
};

const STATUS_OPTIONS = ['pending', 'approved', 'rejected', 'suspended'];

export default function AdminLabels() {
  const [labels, setLabels] = useState<Label[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<{ type: 'label' | 'b2b'; label: Label } | null>(null);
  const [userEmails, setUserEmails] = useState<Record<string, string>>({});
  const [userDisplayIds, setUserDisplayIds] = useState<Record<string, number>>({});
  const [userTypes, setUserTypes] = useState<Record<string, string>>({});
  const [subLabelInfo, setSubLabelInfo] = useState<Record<string, { sub_label_name: string; parent_label_name: string }>>({});
  const [rejectTarget, setRejectTarget] = useState<Label | null>(null);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState<number | 'all'>(10);

  const inputClass =
    'w-full px-3 py-2 rounded-lg bg-muted/50 border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary transition-all text-sm';

  const fetchLabels = async () => {
    const { data } = await supabase
      .from('labels')
      .select('*')
      .order('created_at', { ascending: false });
    const labelsData = (data as Label[]) || [];
    setLabels(labelsData);

    // Fetch user emails
    const userIds = [...new Set(labelsData.map(l => l.user_id))];
    if (userIds.length > 0) {
      const { data: profiles } = await supabase.from('profiles').select('user_id, email, artist_name, record_label_name, user_type, display_id').in('user_id', userIds);
      const emailMap: Record<string, string> = {};
      const displayIdMap: Record<string, number> = {};
      profiles?.forEach((p: any) => {
        emailMap[p.user_id] = p.user_type === 'label'
          ? (p.record_label_name || p.email)
          : (p.artist_name || p.email);
        if (p.display_id) displayIdMap[p.user_id] = p.display_id;
      });
      // Fallback for missing profiles
      const missingIds = userIds.filter(id => !emailMap[id]);
      if (missingIds.length > 0) {
        const { data: authEmails } = await supabase.rpc('get_auth_emails', { _user_ids: missingIds });
        authEmails?.forEach((ae: any) => { emailMap[ae.user_id] = ae.email; });
      }
      setUserEmails(emailMap);
      setUserDisplayIds(displayIdMap);
    }
    setLoading(false);
  };

  useEffect(() => { fetchLabels(); }, []);

  const handleStatusChange = async (label: Label, newStatus: string) => {
    if (newStatus === 'rejected') {
      setRejectTarget(label);
      return;
    }
    const { error } = await supabase.from('labels').update({ status: newStatus, rejection_reason: null }).eq('id', label.id);
    if (error) { toast.error(error.message); return; }
    toast.success(`Label status updated to ${newStatus}`);
    fetchLabels();
  };

  const handleRejectConfirm = async (reason: string) => {
    if (!rejectTarget) return;
    const { error } = await supabase.from('labels').update({ status: 'rejected', rejection_reason: reason }).eq('id', rejectTarget.id);
    if (error) { toast.error(error.message); return; }
    toast.success('Label rejected');
    setRejectTarget(null);
    fetchLabels();
  };

  const handleSaveEdit = async (label: Label) => {
    if (!editName.trim()) return;
    const { error } = await supabase.from('labels').update({ label_name: editName.trim() }).eq('id', label.id);
    if (error) { toast.error(error.message); return; }
    toast.success('Label name updated');
    setEditingId(null);
    fetchLabels();
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    if (deleteTarget.type === 'label') {
      // Delete B2B file first if exists
      if (deleteTarget.label.b2b_url) {
        await supabase.storage.from('b2b-documents').remove([deleteTarget.label.b2b_url]);
      }
      const { error } = await supabase.from('labels').delete().eq('id', deleteTarget.label.id);
      if (error) { toast.error(error.message); return; }
      toast.success('Label deleted');
    } else {
      // Delete only B2B
      if (deleteTarget.label.b2b_url) {
        await supabase.storage.from('b2b-documents').remove([deleteTarget.label.b2b_url]);
      }
      const { error } = await supabase.from('labels').update({ b2b_url: null }).eq('id', deleteTarget.label.id);
      if (error) { toast.error(error.message); return; }
      toast.success('B2B document deleted');
    }
    setDeleteTarget(null);
    fetchLabels();
  };

  const handleDownloadB2b = async (b2bPath: string) => {
    const { data, error } = await supabase.storage.from('b2b-documents').createSignedUrl(b2bPath, 300);
    if (error || !data?.signedUrl) { toast.error('Failed to get download link'); return; }
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
        <h1 className="text-2xl sm:text-3xl font-display font-bold text-foreground">Manage Labels</h1>
        <p className="text-muted-foreground mt-1 text-sm sm:text-base">
          Review, approve, or reject user label submissions. {labels.length} total labels.
        </p>
      </div>

      {labels.length === 0 ? (
        <GlassCard className="animate-fade-in text-center py-12">
          <Tag className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground">No labels submitted yet.</p>
        </GlassCard>
      ) : (
        <div className="space-y-3">
          {paginateItems(labels, page, pageSize).map((label) => (
            <GlassCard key={label.id} className="animate-fade-in">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary shrink-0">
                  <Tag className="h-5 w-5" />
                </div>

                <div className="flex-1 min-w-0 space-y-1">
                  {editingId === label.id ? (
                    <div className="flex items-center gap-2">
                      <input className={inputClass} value={editName} onChange={(e) => setEditName(e.target.value)} autoFocus />
                      <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => handleSaveEdit(label)}><Check className="h-4 w-4 text-green-500" /></Button>
                      <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setEditingId(null)}><X className="h-4 w-4" /></Button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-foreground">{label.label_name}</p>
                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => { setEditingId(label.id); setEditName(label.label_name); }}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  )}
                  <p className="text-xs text-muted-foreground">
                    By: {userEmails[label.user_id] || label.user_id.slice(0, 8)} {userDisplayIds[label.user_id] ? <span className="font-mono font-bold text-primary">(#{userDisplayIds[label.user_id]})</span> : null} • {new Date(label.created_at).toLocaleDateString()}
                  </p>
                  {label.status === 'rejected' && label.rejection_reason && (
                    <p className="text-xs text-destructive mt-1">Reason: {label.rejection_reason}</p>
                  )}
                  {label.b2b_url && (
                    <div className="flex items-center gap-2">
                      <button onClick={() => handleDownloadB2b(label.b2b_url!)} className="flex items-center gap-1 text-xs text-primary hover:text-primary/80 transition-colors">
                        <FileText className="h-3 w-3" /> View B2B
                      </button>
                      <button onClick={() => setDeleteTarget({ type: 'b2b', label })} className="text-xs text-destructive hover:text-destructive/80 transition-colors">
                        Delete B2B
                      </button>
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <select
                    className="px-3 py-1.5 rounded-lg bg-muted/50 border border-border text-foreground text-xs focus:outline-none focus:ring-2 focus:ring-primary"
                    value={label.status}
                    onChange={(e) => handleStatusChange(label, e.target.value)}
                  >
                    {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
                  </select>
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setDeleteTarget({ type: 'label', label })}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </div>
            </GlassCard>
          ))}
          <div className="rounded-lg bg-card/50 border border-border/50 overflow-hidden">
            <TablePagination totalItems={labels.length} currentPage={page} pageSize={pageSize} onPageChange={setPage} onPageSizeChange={setPageSize} itemLabel="labels" />
          </div>
        </div>
      )}

      {deleteTarget && (
        <ConfirmDialog
          title={deleteTarget.type === 'label' ? 'Delete Label' : 'Delete B2B Document'}
          message={deleteTarget.type === 'label'
            ? `Are you sure you want to delete "${deleteTarget.label.label_name}" and its B2B document?`
            : `Are you sure you want to delete the B2B document for "${deleteTarget.label.label_name}"?`
          }
          onConfirm={handleDeleteConfirm}
          onCancel={() => setDeleteTarget(null)}
        />
      )}

      <RejectReasonModal
        open={!!rejectTarget}
        title="Reject Label"
        onConfirm={handleRejectConfirm}
        onCancel={() => setRejectTarget(null)}
      />
    </DashboardLayout>
  );
}