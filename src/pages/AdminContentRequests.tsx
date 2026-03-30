import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { DashboardLayout } from '@/components/DashboardLayout';
import { GlassCard } from '@/components/GlassCard';
import { StatusBadge } from '@/components/StatusBadge';
import { RejectReasonModal } from '@/components/RejectReasonModal';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { toast } from 'sonner';
import { CopyButton } from '@/components/CopyButton';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { Download, Trash2 } from 'lucide-react';
import { TablePagination, paginateItems } from '@/components/TablePagination';
import { useTeamPermissions } from '@/hooks/useTeamPermissions';

const REQUEST_TYPES: Record<string, string> = {
  copyright_claim: 'Copyright Claim Removal',
  instagram_link: 'Instagram Link To Song',
  content_id_merge: 'Content ID Merge',
  oac_apply: 'Official Artist Channel Apply',
  takedown: 'Takedown',
  playlist_pitching: 'Playlist Pitching',
  custom_support: 'Custom Support',
};

const FIELD_LABELS: Record<string, string> = {
  song_title: 'Song Title',
  copyright_company: 'Copyright Company',
  video_link: 'Video Link',
  isrc: 'ISRC',
  instagram_audio_link: 'Instagram Audio Link',
  instagram_profile_link: 'Instagram Profile Link',
  official_artist_channel_link: 'Official Artist Channel Link',
  release_topic_video_link: 'Release Topic Video Link',
  artist_name: 'Artist Name',
  channel_link: 'Channel Link',
  topic_channel_link: 'Topic Channel Link',
  release_link_1: 'Release Link 1',
  release_link_2: 'Release Link 2',
  release_link_3: 'Release Link 3',
  reason_for_takedown: 'Reason for Takedown',
  transaction_id: 'Transaction ID',
  payment_screenshot_url: 'Payment Screenshot',
};

const DATA_FIELDS = Object.keys(FIELD_LABELS);

// Type-specific fields for export
const TYPE_FIELDS: Record<string, string[]> = {
  copyright_claim: ['song_title', 'copyright_company', 'video_link'],
  instagram_link: ['isrc', 'instagram_audio_link', 'instagram_profile_link'],
  content_id_merge: ['song_title', 'official_artist_channel_link', 'release_topic_video_link'],
  oac_apply: ['artist_name', 'channel_link', 'topic_channel_link', 'release_link_1', 'release_link_2', 'release_link_3'],
  takedown: ['song_title', 'reason_for_takedown', 'transaction_id', 'payment_screenshot_url'],
  playlist_pitching: ['song_title', 'reason_for_takedown'],
  custom_support: ['song_title', 'reason_for_takedown'],
};

export default function AdminContentRequests() {
  const { isTeam, canDelete } = useTeamPermissions();
  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [rejectTarget, setRejectTarget] = useState<any | null>(null);
  const [userInfoMap, setUserInfoMap] = useState<Record<string, { name: string; displayId?: number; userType?: string; subLabelName?: string; parentLabelName?: string }>>({});
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState<number | 'all'>(10);

  const paginated = useMemo(() => paginateItems(requests, page, pageSize), [requests, page, pageSize]);

  // Reset page on filter change
  useEffect(() => { setPage(0); }, [filterType, filterStatus]);

  const fetchRequests = async () => {
    let query = supabase
      .from('content_requests')
      .select('*')
      .order('created_at', { ascending: false });
    if (filterType !== 'all') {
      query = query.eq('request_type', filterType);
    }
    if (filterStatus !== 'all') {
      query = query.eq('status', filterStatus);
    }
    const { data, error } = await query;
    if (!error && data) {
      setRequests(data);
      const userIds = [...new Set(data.map((r: any) => r.user_id))];
      if (userIds.length > 0) {
        const { data: profiles } = await supabase.from('profiles').select('user_id, email, artist_name, record_label_name, user_type, display_id').in('user_id', userIds);
        const { data: subLabelsData } = await supabase.from('sub_labels').select('sub_user_id, sub_label_name, parent_label_name');
        const subLabelMap: Record<string, { sub_label_name: string; parent_label_name: string }> = {};
        subLabelsData?.forEach((sl: any) => { if (sl.sub_user_id) subLabelMap[sl.sub_user_id] = { sub_label_name: sl.sub_label_name, parent_label_name: sl.parent_label_name }; });

        const infoMap: Record<string, { name: string; displayId?: number; userType?: string; subLabelName?: string; parentLabelName?: string }> = {};
        profiles?.forEach((p: any) => {
          infoMap[p.user_id] = {
            name: p.user_type === 'label' ? (p.record_label_name || p.email) : (p.artist_name || p.email),
            displayId: p.display_id,
            userType: p.user_type,
            subLabelName: subLabelMap[p.user_id]?.sub_label_name,
            parentLabelName: subLabelMap[p.user_id]?.parent_label_name,
          };
        });
        const missingIds = userIds.filter((id: string) => !infoMap[id]);
        if (missingIds.length > 0) {
          const { data: authEmails } = await supabase.rpc('get_auth_emails', { _user_ids: missingIds });
          authEmails?.forEach((ae: any) => { infoMap[ae.user_id] = { name: ae.email }; });
        }
        setUserInfoMap(infoMap);
      }
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchRequests();
    setSelectedIds(new Set());
  }, [filterType, filterStatus]);

  const handleStatusChange = async (item: any, newStatus: string) => {
    if (newStatus === 'rejected') {
      setRejectTarget(item);
      return;
    }
    const { error } = await supabase
      .from('content_requests')
      .update({ status: newStatus, rejection_reason: null })
      .eq('id', item.id);
    if (error) toast.error('Failed to update status');
    else {
      toast.success('Status updated');
      fetchRequests();
    }
  };

  const handleRejectConfirm = async (reason: string) => {
    if (!rejectTarget) return;
    const { error } = await supabase
      .from('content_requests')
      .update({ status: 'rejected', rejection_reason: reason })
      .eq('id', rejectTarget.id);
    if (error) toast.error('Failed to reject');
    else {
      toast.success('Request rejected');
      fetchRequests();
    }
    setRejectTarget(null);
  };

  const handleDeleteScreenshot = async (itemId: string, screenshotUrl: string) => {
    const marker = '/storage/v1/object/public/promotion-screenshots/';
    const idx = screenshotUrl.indexOf(marker);
    if (idx !== -1) {
      const path = decodeURIComponent(screenshotUrl.substring(idx + marker.length));
      await supabase.storage.from('promotion-screenshots').remove([path]);
    }
    const { error } = await supabase
      .from('content_requests')
      .update({ payment_screenshot_url: null })
      .eq('id', itemId);
    if (error) toast.error('Failed to delete screenshot');
    else {
      toast.success('Screenshot deleted');
      fetchRequests();
    }
  };


  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === requests.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(requests.map(r => r.id)));
    }
  };

  // Export CSV
  const exportCSV = () => {
    const items = selectedIds.size > 0
      ? requests.filter(r => selectedIds.has(r.id))
      : requests;
    if (items.length === 0) { toast.error('No items to export'); return; }

    // Determine which fields to export based on filter or item types
    const exportFields = filterType !== 'all' && TYPE_FIELDS[filterType]
      ? TYPE_FIELDS[filterType]
      : DATA_FIELDS;

    const headers = ['Type', 'Status', 'User', 'User ID', 'Date', ...exportFields.map(f => FIELD_LABELS[f] || f), 'Rejection Reason'];
    const rows = items.map(item => {
      const user = userInfoMap[item.user_id];
      return [
        REQUEST_TYPES[item.request_type] || item.request_type,
        item.status,
        user?.name || '',
        user?.displayId ? `#${user.displayId}` : '',
        new Date(item.created_at).toLocaleDateString(),
        ...exportFields.map(f => item[f] || ''),
        item.rejection_reason || '',
      ];
    });

    const csvContent = [headers, ...rows]
      .map(row => row.map((cell: string) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      .join('\n');

    const typeName = filterType !== 'all'
      ? (REQUEST_TYPES[filterType] || filterType).replace(/\s+/g, '-').toLowerCase()
      : 'all-requests';
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${typeName}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`Exported ${items.length} ${REQUEST_TYPES[filterType] || ''} entries`);
  };

  // Bulk delete
  const handleBulkDelete = async () => {
    const ids = Array.from(selectedIds);
    const { error } = await supabase
      .from('content_requests')
      .delete()
      .in('id', ids);
    if (error) toast.error('Failed to delete');
    else {
      toast.success(`Deleted ${ids.length} request(s)`);
      setSelectedIds(new Set());
      fetchRequests();
    }
    setShowDeleteConfirm(false);
  };

  return (
    <DashboardLayout>
      <div className="space-y-4 sm:space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <h1 className="text-xl sm:text-2xl font-bold text-foreground">Content Management Requests</h1>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={exportCSV}>
              <Download className="h-4 w-4 mr-1" />
              <span className="hidden sm:inline">{selectedIds.size > 0 ? `Export ${selectedIds.size} Selected` : 'Export All CSV'}</span>
              <span className="sm:hidden">Export</span>
            </Button>
            {selectedIds.size > 0 && canDelete && (
              <Button size="sm" variant="destructive" onClick={() => setShowDeleteConfirm(true)}>
                <Trash2 className="h-4 w-4 mr-1" />
                Delete {selectedIds.size}
              </Button>
            )}
          </div>
        </div>

        <div className="overflow-x-auto -mx-2 px-2 pb-1">
          <div className="flex gap-2 w-max sm:w-auto sm:flex-wrap">
            <button
              onClick={() => setFilterType('all')}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${filterType === 'all' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-muted/80'}`}
            >
              All Types
            </button>
            {Object.entries(REQUEST_TYPES).map(([key, label]) => (
              <button
                key={key}
                onClick={() => setFilterType(key)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${filterType === key ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-muted/80'}`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex gap-2 flex-wrap">
          {['all', 'pending', 'applied', 'rejected'].map((s) => (
            <button
              key={s}
              onClick={() => setFilterStatus(s)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${filterStatus === s ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-muted/80'}`}
            >
              {s === 'all' ? 'All Status' : s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>

        <GlassCard className="p-0 sm:p-0">
          {loading ? (
            <p className="text-muted-foreground text-center py-8">Loading...</p>
          ) : requests.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">No requests found.</p>
          ) : (
            <div className="responsive-table-wrap">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/30">
                    <th className="px-3 py-3 text-left">
                      <Checkbox
                        checked={selectedIds.size === requests.length && requests.length > 0}
                        onCheckedChange={toggleSelectAll}
                      />
                    </th>
                    <th className="px-3 py-3 text-left text-xs font-semibold text-muted-foreground uppercase whitespace-nowrap">Type</th>
                    <th className="px-3 py-3 text-left text-xs font-semibold text-muted-foreground uppercase whitespace-nowrap">Submitted By</th>
                    <th className="px-3 py-3 text-left text-xs font-semibold text-muted-foreground uppercase whitespace-nowrap">Date</th>
                    <th className="px-3 py-3 text-left text-xs font-semibold text-muted-foreground uppercase whitespace-nowrap">Details</th>
                    <th className="px-3 py-3 text-left text-xs font-semibold text-muted-foreground uppercase whitespace-nowrap">Status</th>
                    <th className="px-3 py-3 text-left text-xs font-semibold text-muted-foreground uppercase whitespace-nowrap">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {paginated.map((item) => {
                    const fields = (TYPE_FIELDS[item.request_type] || DATA_FIELDS).filter(f => item[f]);
                    const userInfo = userInfoMap[item.user_id];
                    return (
                      <tr key={item.id} className={`border-b border-border/50 hover:bg-muted/20 transition-colors ${selectedIds.has(item.id) ? 'bg-primary/5' : ''}`}>
                        <td className="px-3 py-3">
                          <Checkbox
                            checked={selectedIds.has(item.id)}
                            onCheckedChange={() => toggleSelect(item.id)}
                          />
                        </td>
                        <td className="px-3 py-3">
                          <span className="text-xs font-medium px-2 py-1 rounded bg-accent text-accent-foreground whitespace-nowrap">
                            {REQUEST_TYPES[item.request_type] || item.request_type}
                          </span>
                        </td>
                        <td className="px-3 py-3 min-w-[150px]">
                          {userInfo ? (
                            <div className="text-xs">
                              <span className="text-foreground font-medium">{userInfo.name}</span>
                              {userInfo.displayId && (
                                <span className="font-mono font-bold text-primary ml-1">(#{userInfo.displayId})</span>
                              )}
                              {userInfo.userType === 'sub_label' && userInfo.subLabelName && (
                                <div className="mt-0.5">
                                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-primary/10 text-primary text-xs">
                                    {userInfo.subLabelName}
                                  </span>
                                  <span className="text-muted-foreground ml-1">↳ {userInfo.parentLabelName}</span>
                                </div>
                              )}
                            </div>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </td>
                        <td className="px-3 py-3 whitespace-nowrap text-xs text-muted-foreground">
                          {new Date(item.created_at).toLocaleDateString()}
                        </td>
                        <td className="px-3 py-3 min-w-[250px]">
                          <div className="space-y-1">
                            {fields.map((field) => (
                              <div key={field} className="text-xs">
                                <span className="text-muted-foreground">{FIELD_LABELS[field]}: </span>
                                {field === 'payment_screenshot_url' ? (
                                  <div className="relative inline-block mt-1">
                                    <img src={item[field]} alt="Payment" className="max-h-20 rounded border object-contain" />
                                    <button
                                      onClick={() => handleDeleteScreenshot(item.id, item[field])}
                                      className="absolute -top-1 -right-1 p-0.5 rounded-full bg-destructive text-destructive-foreground hover:opacity-90"
                                      title="Delete screenshot"
                                    >
                                      <Trash2 className="h-2.5 w-2.5" />
                                    </button>
                                  </div>
                                ) : (
                                  <span className="text-foreground break-all inline-flex items-center gap-1">
                                    {item[field]}
                                    <CopyButton value={item[field]} />
                                  </span>
                                )}
                              </div>
                            ))}
                            {item.status === 'rejected' && item.rejection_reason && (
                              <div className="mt-1 p-1.5 rounded bg-destructive/10 border border-destructive/20">
                                <span className="text-xs font-medium text-destructive">Reason: </span>
                                <span className="text-xs text-destructive">{item.rejection_reason}</span>
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="px-3 py-3">
                          <StatusBadge status={item.status} />
                        </td>
                        <td className="px-3 py-3">
                          <select
                            value={item.status}
                            onChange={(e) => handleStatusChange(item, e.target.value)}
                            className="text-xs bg-background border border-border rounded px-2 py-1"
                          >
                            <option value="pending">Pending</option>
                            <option value="applied">Applied</option>
                            <option value="rejected">Rejected</option>
                          </select>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          <TablePagination
            totalItems={requests.length}
            currentPage={page}
            pageSize={pageSize}
            onPageChange={setPage}
            onPageSizeChange={setPageSize}
            itemLabel="requests"
          />
        </GlassCard>
      </div>

      <RejectReasonModal
        open={!!rejectTarget}
        title="Reject Content Request"
        onConfirm={handleRejectConfirm}
        onCancel={() => setRejectTarget(null)}
      />

      {showDeleteConfirm && (
        <ConfirmDialog
          title="Delete Selected Requests"
          message={`Are you sure you want to permanently delete ${selectedIds.size} selected request(s)? This action cannot be undone.`}
          onConfirm={handleBulkDelete}
          onCancel={() => setShowDeleteConfirm(false)}
        />
      )}
    </DashboardLayout>
  );
}
