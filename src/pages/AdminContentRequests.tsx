import { useState, useEffect } from 'react';
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
  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [rejectTarget, setRejectTarget] = useState<any | null>(null);
  const [userInfoMap, setUserInfoMap] = useState<Record<string, { name: string; displayId?: number }>>({});
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

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
        const infoMap: Record<string, { name: string; displayId?: number }> = {};
        profiles?.forEach((p: any) => {
          infoMap[p.user_id] = {
            name: p.user_type === 'label' ? (p.record_label_name || p.email) : (p.artist_name || p.email),
            displayId: p.display_id,
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
  }, [filterType]);

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

  // Selection helpers
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
      <div className="space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <h1 className="text-2xl font-bold text-foreground">Content Management Requests</h1>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={exportCSV}>
              <Download className="h-4 w-4 mr-1" />
              {selectedIds.size > 0 ? `Export ${selectedIds.size} Selected` : 'Export All CSV'}
            </Button>
            {selectedIds.size > 0 && (
              <Button size="sm" variant="destructive" onClick={() => setShowDeleteConfirm(true)}>
                <Trash2 className="h-4 w-4 mr-1" />
                Delete {selectedIds.size}
              </Button>
            )}
          </div>
        </div>

        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => setFilterType('all')}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${filterType === 'all' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-muted/80'}`}
          >
            All
          </button>
          {Object.entries(REQUEST_TYPES).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setFilterType(key)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${filterType === key ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-muted/80'}`}
            >
              {label}
            </button>
          ))}
        </div>

        <GlassCard>
          <div className="p-6">
            {loading ? (
              <p className="text-muted-foreground text-center py-8">Loading...</p>
            ) : requests.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">No requests found.</p>
            ) : (
              <div className="space-y-4">
                {/* Select All */}
                <div className="flex items-center gap-2 pb-2 border-b border-border">
                  <Checkbox
                    checked={selectedIds.size === requests.length && requests.length > 0}
                    onCheckedChange={toggleSelectAll}
                  />
                  <span className="text-sm text-muted-foreground">
                    {selectedIds.size > 0 ? `${selectedIds.size} of ${requests.length} selected` : 'Select all'}
                  </span>
                </div>

                {requests.map((item) => (
                  <div key={item.id} className={`border rounded-lg p-4 space-y-3 transition-colors ${selectedIds.has(item.id) ? 'border-primary bg-primary/5' : 'border-border'}`}>
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <div className="flex items-center gap-2">
                        <Checkbox
                          checked={selectedIds.has(item.id)}
                          onCheckedChange={() => toggleSelect(item.id)}
                        />
                        <span className="text-xs font-medium px-2 py-1 rounded bg-accent text-accent-foreground">
                          {REQUEST_TYPES[item.request_type] || item.request_type}
                        </span>
                        <span className="text-sm text-muted-foreground">
                          {new Date(item.created_at).toLocaleDateString()}
                        </span>
                        {userInfoMap[item.user_id] && (
                          <span className="text-xs text-muted-foreground">
                            By: {userInfoMap[item.user_id].name}
                            {userInfoMap[item.user_id].displayId && (
                              <span className="font-mono font-bold text-primary ml-1">(#{userInfoMap[item.user_id].displayId})</span>
                            )}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <select
                          value={item.status}
                          onChange={(e) => handleStatusChange(item, e.target.value)}
                          className="text-sm bg-background border border-border rounded px-2 py-1"
                        >
                          <option value="pending">Pending</option>
                          <option value="applied">Applied</option>
                          <option value="rejected">Rejected</option>
                        </select>
                        <StatusBadge status={item.status} />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                      {DATA_FIELDS.map((field) =>
                        item[field] ? (
                          <div key={field}>
                            <span className="text-xs text-muted-foreground">{FIELD_LABELS[field]}:</span>
                            {field === 'payment_screenshot_url' ? (
                              <img src={item[field]} alt="Payment" className="max-h-32 rounded-lg border mt-1 object-contain" />
                            ) : (
                              <div className="flex items-center gap-1">
                                <p className="text-sm text-foreground break-all">{item[field]}</p>
                                <CopyButton value={item[field]} />
                              </div>
                            )}
                          </div>
                        ) : null
                      )}
                    </div>

                    {item.status === 'rejected' && item.rejection_reason && (
                      <div className="p-2 rounded bg-destructive/10 border border-destructive/20">
                        <span className="text-xs font-medium text-destructive">Rejection Reason:</span>
                        <p className="text-sm text-destructive">{item.rejection_reason}</p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
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
