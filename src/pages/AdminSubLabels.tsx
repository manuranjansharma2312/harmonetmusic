import { useEffect, useState, useMemo } from 'react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { GlassCard } from '@/components/GlassCard';
import { supabase } from '@/integrations/supabase/client';
import { StatusBadge } from '@/components/StatusBadge';
import { Loader2, Users, Eye, Trash2, FileText, Search, Pencil, LogIn } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { RejectReasonModal } from '@/components/RejectReasonModal';
import { TablePagination, paginateItems } from '@/components/TablePagination';
import { useImpersonate } from '@/hooks/useImpersonate';
import { useNavigate } from 'react-router-dom';

type SubLabel = {
  id: string;
  parent_user_id: string;
  sub_user_id: string | null;
  parent_label_name: string;
  sub_label_name: string;
  agreement_start_date: string;
  agreement_end_date: string;
  email: string;
  phone: string;
  percentage_cut: number;
  b2b_url: string | null;
  status: string;
  rejection_reason: string | null;
  created_at: string;
};

const inputClass =
  'w-full px-4 py-3 rounded-lg bg-muted/50 border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary transition-all text-sm';

export default function AdminSubLabels() {
  const [subLabels, setSubLabels] = useState<SubLabel[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [viewSL, setViewSL] = useState<SubLabel | null>(null);
  const [deleteSL, setDeleteSL] = useState<SubLabel | null>(null);
  const [rejectSL, setRejectSL] = useState<SubLabel | null>(null);
  const [editSL, setEditSL] = useState<SubLabel | null>(null);
  const [editStart, setEditStart] = useState('');
  const [editEnd, setEditEnd] = useState('');
  const [editCut, setEditCut] = useState('');
  const [editSubLabelName, setEditSubLabelName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editParentLabelName, setEditParentLabelName] = useState('');
  const [editStatus, setEditStatus] = useState('');
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState<number | 'all'>(10);

  const fetchAll = async () => {
    const { data } = await supabase
      .from('sub_labels')
      .select('*')
      .order('created_at', { ascending: false });
    setSubLabels((data as SubLabel[]) || []);
    setLoading(false);
  };

  useEffect(() => { fetchAll(); }, []);

  const filtered = useMemo(() => {
    let result = subLabels;
    if (statusFilter !== 'all') {
      result = result.filter(sl => sl.status === statusFilter);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(sl =>
        sl.sub_label_name.toLowerCase().includes(q) ||
        sl.parent_label_name.toLowerCase().includes(q) ||
        sl.email.toLowerCase().includes(q)
      );
    }
    return result;
  }, [subLabels, search, statusFilter]);

  const updateStatus = async (sl: SubLabel, status: string, rejection_reason?: string) => {
    const { error } = await supabase.from('sub_labels').update({ status, rejection_reason: rejection_reason || null }).eq('id', sl.id);
    if (error) { toast.error(error.message); return; }

    // Also update profile verification_status
    if (sl.sub_user_id) {
      const verificationMap: Record<string, string> = {
        active: 'verified',
        rejected: 'rejected',
        suspended: 'suspended',
        pending: 'pending',
      };
      await supabase.from('profiles').update({
        verification_status: verificationMap[status] || 'pending',
      }).eq('user_id', sl.sub_user_id);
    }

    toast.success(`Sub label ${status}`);
    fetchAll();
  };

  const handleDelete = async () => {
    if (!deleteSL) return;
    // Delete the sub_labels record
    const { error } = await supabase.from('sub_labels').delete().eq('id', deleteSL.id);
    if (error) { toast.error(error.message); return; }

    // Also delete the auth user if exists
    if (deleteSL.sub_user_id) {
      await supabase.functions.invoke('delete-users', {
        body: { userIds: [deleteSL.sub_user_id] },
      });
    }

    toast.success('Sub label deleted');
    setDeleteSL(null);
    fetchAll();
  };

  const handleEditSave = async () => {
    if (!editSL) return;
    const newStatus = editStatus;
    const { error } = await supabase.from('sub_labels').update({
      sub_label_name: editSubLabelName.trim(),
      parent_label_name: editParentLabelName.trim(),
      email: editEmail.trim(),
      phone: editPhone.trim(),
      agreement_start_date: editStart,
      agreement_end_date: editEnd,
      percentage_cut: parseFloat(editCut) || 0,
      status: newStatus,
    }).eq('id', editSL.id);
    if (error) { toast.error(error.message); return; }

    // Update profile verification_status if sub_user_id exists
    if (editSL.sub_user_id) {
      const verificationMap: Record<string, string> = {
        active: 'verified', rejected: 'rejected', suspended: 'suspended', pending: 'pending',
      };
      await supabase.from('profiles').update({
        verification_status: verificationMap[newStatus] || 'pending',
      }).eq('user_id', editSL.sub_user_id);
    }

    toast.success('Sub label updated');
    setEditSL(null);
    fetchAll();
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
      <div className="mb-6 sm:mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-display font-bold text-foreground">Sub Labels Management</h1>
          <p className="text-muted-foreground mt-1 text-sm sm:text-base">
            Approve, reject, suspend, and manage all sub labels.
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
          <Select value={statusFilter} onValueChange={(val) => { setStatusFilter(val); setPage(0); }}>
            <SelectTrigger className="w-full sm:w-[140px]">
              <SelectValue placeholder="Filter status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="rejected">Rejected</SelectItem>
              <SelectItem value="suspended">Suspended</SelectItem>
            </SelectContent>
          </Select>
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search sub labels..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>
      </div>

      {filtered.length === 0 ? (
        <GlassCard className="animate-fade-in text-center py-12">
          <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground">No sub labels found.</p>
        </GlassCard>
      ) : (
        <div className="space-y-3">
          {paginateItems(filtered, page, pageSize).map((sl) => (
            <GlassCard key={sl.id} className="animate-fade-in">
              <div className="flex flex-wrap items-center gap-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary shrink-0">
                  <Users className="h-5 w-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-foreground">{sl.sub_label_name}</p>
                  <div className="flex flex-wrap items-center gap-2 mt-1">
                    <span className="text-xs text-muted-foreground">Parent: {sl.parent_label_name}</span>
                    <span className="text-xs text-muted-foreground">•</span>
                    <span className="text-xs text-muted-foreground">{sl.email}</span>
                    <span className="text-xs text-muted-foreground">•</span>
                    <span className="text-xs text-muted-foreground">Cut: {sl.percentage_cut}%</span>
                  </div>
                </div>
                <StatusBadge status={sl.status === 'active' ? 'approved' : sl.status} />
                <Select value={sl.status} onValueChange={(val) => {
                  if (val === 'rejected') { setRejectSL(sl); }
                  else { updateStatus(sl, val); }
                }}>
                  <SelectTrigger className="w-[130px] h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="rejected">Rejected</SelectItem>
                    <SelectItem value="suspended">Suspended</SelectItem>
                  </SelectContent>
                </Select>
                <div className="flex gap-1">
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setViewSL(sl)} title="View">
                    <Eye className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setEditSL(sl); setEditSubLabelName(sl.sub_label_name); setEditParentLabelName(sl.parent_label_name); setEditEmail(sl.email); setEditPhone(sl.phone); setEditStart(sl.agreement_start_date); setEditEnd(sl.agreement_end_date); setEditCut(String(sl.percentage_cut)); setEditStatus(sl.status); }} title="Edit">
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setDeleteSL(sl)} title="Delete">
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </div>
            </GlassCard>
          ))}
          <div className="rounded-lg bg-card/50 border border-border/50 overflow-hidden">
            <TablePagination totalItems={filtered.length} currentPage={page} pageSize={pageSize} onPageChange={setPage} onPageSizeChange={setPageSize} itemLabel="sub labels" />
          </div>
        </div>
      )}

      {/* View Modal */}
      {viewSL && (
        <Dialog open={!!viewSL} onOpenChange={() => setViewSL(null)}>
          <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
            <DialogHeader><DialogTitle>{viewSL.sub_label_name}</DialogTitle></DialogHeader>
            <div className="space-y-3 text-sm">
              <Detail label="Parent Label" value={viewSL.parent_label_name} />
              <Detail label="Sub Label Name" value={viewSL.sub_label_name} />
              <Detail label="Email" value={viewSL.email} />
              <Detail label="Phone" value={viewSL.phone || '—'} />
              <Detail label="Percentage Cut" value={`${viewSL.percentage_cut}%`} />
              <Detail label="Agreement Start" value={new Date(viewSL.agreement_start_date).toLocaleDateString()} />
              <Detail label="Agreement End" value={new Date(viewSL.agreement_end_date).toLocaleDateString()} />
              <Detail label="Status" value={viewSL.status} />
              {viewSL.rejection_reason && <Detail label="Rejection Reason" value={viewSL.rejection_reason} />}
              {viewSL.b2b_url && (
                <div>
                  <p className="text-muted-foreground text-xs">B2B Document</p>
                  <button onClick={() => handleDownloadB2b(viewSL.b2b_url!)} className="flex items-center gap-1 text-sm text-primary hover:text-primary/80 transition-colors">
                    <FileText className="h-4 w-4" /> View B2B PDF
                  </button>
                </div>
              )}
              <Detail label="Created" value={new Date(viewSL.created_at).toLocaleString()} />
            </div>
            <DialogFooter><Button variant="outline" onClick={() => setViewSL(null)}>Close</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Edit Modal */}
      {editSL && (
        <Dialog open={!!editSL} onOpenChange={() => setEditSL(null)}>
          <DialogContent className="max-w-md max-h-[80vh] overflow-y-auto">
            <DialogHeader><DialogTitle>Edit Sub Label</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-muted-foreground mb-1">Parent Label Name</label>
                <input className={inputClass} type="text" value={editParentLabelName} onChange={(e) => setEditParentLabelName(e.target.value)} />
              </div>
              <div>
                <label className="block text-sm font-medium text-muted-foreground mb-1">Sub Label Name</label>
                <input className={inputClass} type="text" value={editSubLabelName} onChange={(e) => setEditSubLabelName(e.target.value)} />
              </div>
              <div>
                <label className="block text-sm font-medium text-muted-foreground mb-1">Email</label>
                <input className={inputClass} type="email" value={editEmail} onChange={(e) => setEditEmail(e.target.value)} />
              </div>
              <div>
                <label className="block text-sm font-medium text-muted-foreground mb-1">Phone</label>
                <input className={inputClass} type="tel" value={editPhone} onChange={(e) => setEditPhone(e.target.value)} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-muted-foreground mb-1">Agreement Start Date</label>
                  <input className={inputClass} type="date" value={editStart} onChange={(e) => setEditStart(e.target.value)} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-muted-foreground mb-1">Agreement End Date</label>
                  <input className={inputClass} type="date" value={editEnd} onChange={(e) => setEditEnd(e.target.value)} />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-muted-foreground mb-1">Percentage Cut %</label>
                <input className={inputClass} type="text" inputMode="decimal" value={editCut} onChange={(e) => { if (/^\d*\.?\d*$/.test(e.target.value)) setEditCut(e.target.value); }} />
              </div>
              <div>
                <label className="block text-sm font-medium text-muted-foreground mb-1">Status</label>
                <Select value={editStatus} onValueChange={setEditStatus}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="rejected">Rejected</SelectItem>
                    <SelectItem value="suspended">Suspended</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditSL(null)}>Cancel</Button>
              <Button onClick={handleEditSave} className="btn-primary-gradient text-primary-foreground font-semibold">Save</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Delete Confirm */}
      {deleteSL && (
        <ConfirmDialog
          title="Delete Sub Label"
          message={`Are you sure you want to delete "${deleteSL.sub_label_name}"? This will also delete their account.`}
          onConfirm={handleDelete}
          onCancel={() => setDeleteSL(null)}
        />
      )}

      {/* Reject Modal */}
      {rejectSL && (
        <RejectReasonModal
          open={!!rejectSL}
          title={`Reject "${rejectSL.sub_label_name}"`}
          onConfirm={(reason) => { updateStatus(rejectSL, 'rejected', reason); setRejectSL(null); }}
          onCancel={() => setRejectSL(null)}
        />
      )}
    </DashboardLayout>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-muted-foreground text-xs">{label}</p>
      <p className="text-foreground break-all">{value}</p>
    </div>
  );
}
