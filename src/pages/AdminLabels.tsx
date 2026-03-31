import { useEffect, useState, useMemo } from 'react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { GlassCard } from '@/components/GlassCard';
import { supabase } from '@/integrations/supabase/client';
import { StatusBadge } from '@/components/StatusBadge';
import { Loader2, Tag, FileText, Trash2, Pencil, Check, X, CheckSquare, Search, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { RejectReasonModal } from '@/components/RejectReasonModal';
import { TablePagination, paginateItems } from '@/components/TablePagination';
import { toast } from 'sonner';
import { useTeamPermissions } from '@/hooks/useTeamPermissions';
import { Checkbox } from '@/components/ui/checkbox';
import { CopyButton } from '@/components/CopyButton';

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
  const { isTeam, canDelete } = useTeamPermissions();
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
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkDeleteConfirm, setBulkDeleteConfirm] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const filteredLabels = useMemo(() => {
    if (!searchQuery.trim()) return labels;
    const q = searchQuery.toLowerCase();
    return labels.filter(l =>
      l.label_name.toLowerCase().includes(q) ||
      l.status.toLowerCase().includes(q) ||
      (userEmails[l.user_id] || '').toLowerCase().includes(q) ||
      (userDisplayIds[l.user_id]?.toString() || '').includes(q)
    );
  }, [labels, searchQuery, userEmails, userDisplayIds]);

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
      const { data: subLabelsData } = await supabase.from('sub_labels').select('sub_user_id, sub_label_name, parent_label_name');
      const slMap: Record<string, { sub_label_name: string; parent_label_name: string }> = {};
      subLabelsData?.forEach((sl: any) => { if (sl.sub_user_id) slMap[sl.sub_user_id] = { sub_label_name: sl.sub_label_name, parent_label_name: sl.parent_label_name }; });

      const emailMap: Record<string, string> = {};
      const displayIdMap: Record<string, number> = {};
      const typeMap: Record<string, string> = {};
      profiles?.forEach((p: any) => {
        emailMap[p.user_id] = p.user_type === 'label'
          ? (p.record_label_name || p.email)
          : (p.artist_name || p.email);
        if (p.display_id) displayIdMap[p.user_id] = p.display_id;
        typeMap[p.user_id] = p.user_type;
      });
      const missingIds = userIds.filter(id => !emailMap[id]);
      if (missingIds.length > 0) {
        const { data: authEmails } = await supabase.rpc('get_auth_emails', { _user_ids: missingIds });
        authEmails?.forEach((ae: any) => { emailMap[ae.user_id] = ae.email; });
      }
      setUserEmails(emailMap);
      setUserDisplayIds(displayIdMap);
      setUserTypes(typeMap);
      setSubLabelInfo(slMap);
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

  const handleBulkDelete = async () => {
    const ids = [...selected];
    const toDelete = labels.filter(l => ids.includes(l.id));
    // Delete B2B files from storage
    const b2bPaths = toDelete.map(l => l.b2b_url).filter(Boolean) as string[];
    if (b2bPaths.length > 0) {
      await supabase.storage.from('b2b-documents').remove(b2bPaths);
    }
    const { error } = await supabase.from('labels').delete().in('id', ids);
    if (error) toast.error(error.message);
    else { toast.success(`${ids.length} label(s) deleted`); setSelected(new Set()); fetchLabels(); }
    setBulkDeleteConfirm(false);
  };

  const paginatedLabels = paginateItems(filteredLabels, page, pageSize);
  const allPageSelected = paginatedLabels.length > 0 && paginatedLabels.every(l => selected.has(l.id));

  const handleExportCSV = () => {
    const source = selected.size > 0
      ? filteredLabels.filter(l => selected.has(l.id))
      : filteredLabels;
    const rows = source.map(l => ({
      'Label Name': l.label_name,
      'Status': l.status,
      'Submitted By': userEmails[l.user_id] || l.user_id,
      'User #ID': userDisplayIds[l.user_id] || '',
      'User Type': userTypes[l.user_id] || '',
      'Rejection Reason': l.rejection_reason || '',
      'B2B Document': l.b2b_url ? 'Yes' : 'No',
      'Created At': new Date(l.created_at).toLocaleDateString(),
    }));
    if (rows.length === 0) { toast.error('No data to export'); return; }
    const headers = Object.keys(rows[0]);
    const csv = [headers.join(','), ...rows.map(r => headers.map(h => `"${String((r as any)[h]).replace(/"/g, '""')}"`).join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `labels-export-${Date.now()}.csv`; a.click();
    URL.revokeObjectURL(url);
    toast.success(`${source.length} label(s) exported`);
  };

  const toggleSelectAll = () => {
    if (allPageSelected) {
      const next = new Set(selected);
      paginatedLabels.forEach(l => next.delete(l.id));
      setSelected(next);
    } else {
      const next = new Set(selected);
      paginatedLabels.forEach(l => next.add(l.id));
      setSelected(next);
    }
  };

  const toggleSelect = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id); else next.add(id);
    setSelected(next);
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
      {/* Header */}
      <div className="mb-4 sm:mb-6">
        <h1 className="text-xl sm:text-2xl lg:text-3xl font-display font-bold text-foreground">Manage Labels</h1>
        <p className="text-muted-foreground mt-1 text-xs sm:text-sm">
          Review, approve, or reject user label submissions. {filteredLabels.length} total labels.
        </p>
      </div>

      {/* Search + Export Bar */}
      <GlassCard className="mb-4 !p-3 sm:!p-4">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              className={`${inputClass} pl-9`}
              placeholder="Search by label name, user, status..."
              value={searchQuery}
              onChange={(e) => { setSearchQuery(e.target.value); setPage(0); }}
            />
          </div>
          <Button variant="outline" onClick={handleExportCSV} className="gap-2 shrink-0 h-9 text-xs sm:text-sm">
            <Download className="h-4 w-4" />
            <span>{selected.size > 0 ? `Export ${selected.size} Selected` : 'Export CSV'}</span>
          </Button>
        </div>
      </GlassCard>

      {/* Bulk Action Bar */}
      {selected.size > 0 && canDelete && (
        <div className="flex flex-wrap items-center gap-2 sm:gap-3 p-2.5 sm:p-3 rounded-lg bg-primary/5 border border-primary/20 mb-4 animate-fade-in">
          <CheckSquare className="h-4 w-4 text-primary shrink-0" />
          <span className="text-xs sm:text-sm font-medium text-foreground">{selected.size} selected</span>
          <div className="flex gap-2 ml-auto">
            <Button size="sm" variant="destructive" onClick={() => setBulkDeleteConfirm(true)} className="h-7 sm:h-8 text-xs">
              <Trash2 className="h-3.5 w-3.5 mr-1" /> Delete
            </Button>
            <Button size="sm" variant="outline" onClick={() => setSelected(new Set())} className="h-7 sm:h-8 text-xs">
              Clear
            </Button>
          </div>
        </div>
      )}

      {filteredLabels.length === 0 ? (
        <GlassCard className="animate-fade-in text-center py-12">
          <Tag className="h-10 w-10 sm:h-12 sm:w-12 text-muted-foreground mx-auto mb-3" />
          <p className="text-muted-foreground text-sm">{searchQuery ? 'No labels match your search.' : 'No labels submitted yet.'}</p>
        </GlassCard>
      ) : (
        <GlassCard className="!p-0 overflow-hidden">
          {/* Table view */}
          <div className="responsive-table-wrap">
            <table className="w-full min-w-[700px] text-sm">
              <thead>
                <tr className="border-b border-border/50 bg-muted/30">
                  {canDelete && (
                    <th className="p-3 w-10">
                      <Checkbox checked={allPageSelected} onCheckedChange={toggleSelectAll} />
                    </th>
                  )}
                  <th className="p-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Label</th>
                  <th className="p-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Submitted By</th>
                  <th className="p-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">B2B</th>
                  <th className="p-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Date</th>
                  <th className="p-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Status</th>
                  <th className="p-3 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/30">
                {paginatedLabels.map((label) => (
                  <tr key={label.id} className="hover:bg-muted/20 transition-colors group">
                    {canDelete && (
                      <td className="p-3">
                        <Checkbox checked={selected.has(label.id)} onCheckedChange={() => toggleSelect(label.id)} />
                      </td>
                    )}
                    {/* Label Name */}
                    <td className="p-3">
                      {editingId === label.id ? (
                        <div className="flex items-center gap-1.5">
                          <input
                            className="px-2 py-1 rounded bg-muted/50 border border-border text-foreground text-sm focus:outline-none focus:ring-1 focus:ring-primary w-full max-w-[200px]"
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                            autoFocus
                            onKeyDown={(e) => e.key === 'Enter' && handleSaveEdit(label)}
                          />
                          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => handleSaveEdit(label)}>
                            <Check className="h-3.5 w-3.5 text-emerald-500" />
                          </Button>
                          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setEditingId(null)}>
                            <X className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      ) : (
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-1.5">
                            <Tag className="h-3.5 w-3.5 text-primary shrink-0" />
                            <span className="font-semibold text-foreground truncate max-w-[180px]">{label.label_name}</span>
                            <CopyButton value={label.label_name} />
                            <Button size="icon" variant="ghost" className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => { setEditingId(label.id); setEditName(label.label_name); }}>
                              <Pencil className="h-3 w-3" />
                            </Button>
                          </div>
                          {label.status === 'rejected' && label.rejection_reason && (
                            <p className="text-[11px] text-destructive truncate max-w-[220px]" title={label.rejection_reason}>
                              Reason: {label.rejection_reason}
                            </p>
                          )}
                        </div>
                      )}
                    </td>
                    {/* Submitted By */}
                    <td className="p-3">
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-1">
                          <span className="text-foreground text-xs font-medium truncate max-w-[150px]">
                            {userEmails[label.user_id] || label.user_id.slice(0, 8)}
                          </span>
                          {userEmails[label.user_id] && <CopyButton value={userEmails[label.user_id]} />}
                        </div>
                        <div className="flex items-center gap-1.5">
                          {userDisplayIds[label.user_id] && (
                            <span className="font-mono text-[11px] font-bold text-primary">#{userDisplayIds[label.user_id]}</span>
                          )}
                          {userTypes[label.user_id] === 'sub_label' && subLabelInfo[label.user_id] && (
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-primary/10 text-primary text-[10px]">
                              {subLabelInfo[label.user_id].sub_label_name}
                            </span>
                          )}
                        </div>
                      </div>
                    </td>
                    {/* B2B */}
                    <td className="p-3">
                      {label.b2b_url ? (
                        <div className="flex items-center gap-1.5">
                          <button onClick={() => handleDownloadB2b(label.b2b_url!)} className="inline-flex items-center gap-1 text-xs text-primary hover:text-primary/80 transition-colors">
                            <FileText className="h-3.5 w-3.5" /> View
                          </button>
                          {canDelete && (
                            <button onClick={() => setDeleteTarget({ type: 'b2b', label })} className="text-[11px] text-destructive hover:text-destructive/80 transition-colors">
                              Delete
                            </button>
                          )}
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </td>
                    {/* Date */}
                    <td className="p-3">
                      <span className="text-xs text-muted-foreground whitespace-nowrap">{new Date(label.created_at).toLocaleDateString()}</span>
                    </td>
                    {/* Status */}
                    <td className="p-3">
                      <select
                        className="px-2.5 py-1.5 rounded-md bg-muted/50 border border-border text-foreground text-xs focus:outline-none focus:ring-2 focus:ring-primary cursor-pointer"
                        value={label.status}
                        onChange={(e) => handleStatusChange(label, e.target.value)}
                      >
                        {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
                      </select>
                    </td>
                    {/* Actions */}
                    <td className="p-3 text-right">
                      {canDelete && (
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setDeleteTarget({ type: 'label', label })}>
                          <Trash2 className="h-3.5 w-3.5 text-destructive" />
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {/* Pagination */}
          <TablePagination totalItems={filteredLabels.length} currentPage={page} pageSize={pageSize} onPageChange={setPage} onPageSizeChange={setPageSize} itemLabel="labels" />
        </GlassCard>
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

      {bulkDeleteConfirm && (
        <ConfirmDialog
          title="Bulk Delete Labels"
          message={`Are you sure you want to delete ${selected.size} label(s) and their B2B documents?`}
          onConfirm={handleBulkDelete}
          onCancel={() => setBulkDeleteConfirm(false)}
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