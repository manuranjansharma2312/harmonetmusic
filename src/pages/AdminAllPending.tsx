import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { DashboardLayout } from '@/components/DashboardLayout';
import { StatusBadge } from '@/components/StatusBadge';
import { TablePagination, paginateItems } from '@/components/TablePagination';
import { useTeamPermissions } from '@/hooks/useTeamPermissions';
import { toast } from 'sonner';
import { format, isValid } from 'date-fns';

const safeFormat = (dateStr: string, fmt: string = 'dd MMM yyyy') => {
  const d = new Date(dateStr);
  return isValid(d) ? format(d, fmt) : '—';
};

const ACRONYMS = ['oac', 'cms', 'id', 'url', 'api', 'csv', 'upc', 'isrc', 'ai'];
const formatLabel = (val: string) =>
  val?.replace(/_/g, ' ').replace(/\b\w+/g, w =>
    ACRONYMS.includes(w.toLowerCase()) ? w.toUpperCase() : w.charAt(0).toUpperCase() + w.slice(1)
  ) || '—';
import {
  Users, ListMusic, Tag, Headset, Video, Wallet, Megaphone, UsersRound, Youtube,
  Sparkles, CheckCircle, XCircle, Eye, Loader2, Clock, Link2, FileSignature,
} from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';

type PendingCategory = {
  key: string;
  label: string;
  icon: any;
  table: string;
  statusField: string;
  statusValue: string;
  extraFilter?: { field: string; value: string };
  columns: { key: string; label: string; render?: (row: any) => React.ReactNode }[];
  actions: ('approve' | 'reject' | 'view')[];
  approveStatus: string;
  rejectStatus: string;
  viewLink?: (row: any) => string;
};

const categories: PendingCategory[] = [
  {
    key: 'users', label: 'Users', icon: Users,
    table: 'profiles', statusField: 'verification_status', statusValue: 'pending',
    columns: [
      { key: 'display_id', label: '#ID', render: (r) => `#${r.display_id}` },
      { key: 'legal_name', label: 'Name' },
      { key: 'email', label: 'Email' },
      { key: 'user_type', label: 'Type', render: (r: any) => formatLabel(r.user_type) },
      { key: 'created_at', label: 'Registered', render: (r) => safeFormat(r.created_at) },
    ],
    actions: ['approve', 'reject'],
    approveStatus: 'verified', rejectStatus: 'rejected',
  },
  {
    key: 'releases', label: 'Releases', icon: ListMusic,
    table: 'releases', statusField: 'status', statusValue: 'pending',
    columns: [
      { key: 'album_name', label: 'Release', render: (r) => r.album_name || r.ep_name || '—' },
      { key: 'content_type', label: 'Type', render: (r: any) => formatLabel(r.content_type) },
      { key: 'release_date', label: 'Date', render: (r) => safeFormat(r.release_date) },
      { key: 'created_at', label: 'Submitted', render: (r) => safeFormat(r.created_at) },
    ],
    actions: ['approve', 'reject', 'view'],
    approveStatus: 'approved', rejectStatus: 'rejected',
    viewLink: () => '/admin/submissions',
  },
  {
    key: 'labels', label: 'Labels', icon: Tag,
    table: 'labels', statusField: 'status', statusValue: 'pending',
    columns: [
      { key: 'label_name', label: 'Label Name' },
      { key: 'created_at', label: 'Submitted', render: (r) => safeFormat(r.created_at) },
    ],
    actions: ['approve', 'reject'],
    approveStatus: 'approved', rejectStatus: 'rejected',
  },
  {
    key: 'support', label: 'Support Requests', icon: Headset,
    table: 'content_requests', statusField: 'status', statusValue: 'pending',
    columns: [
      { key: 'request_type', label: 'Type', render: (r: any) => formatLabel(r.request_type) },
      { key: 'song_title', label: 'Song', render: (r) => r.song_title || r.artist_name || '—' },
      { key: 'created_at', label: 'Submitted', render: (r) => safeFormat(r.created_at) },
    ],
    actions: ['approve', 'reject', 'view'],
    approveStatus: 'approved', rejectStatus: 'rejected',
    viewLink: () => '/admin/content-requests',
  },
  {
    key: 'videos', label: 'Videos', icon: Video,
    table: 'video_submissions', statusField: 'status', statusValue: 'pending',
    columns: [
      { key: 'submission_type', label: 'Type', render: (r: any) => formatLabel(r.submission_type) },
      { key: 'created_at', label: 'Submitted', render: (r) => safeFormat(r.created_at) },
    ],
    actions: ['approve', 'reject', 'view'],
    approveStatus: 'approved', rejectStatus: 'rejected',
    viewLink: () => '/admin/video-submissions',
  },
  {
    key: 'withdrawals', label: 'Withdrawals', icon: Wallet,
    table: 'withdrawal_requests', statusField: 'status', statusValue: 'pending',
    columns: [
      { key: 'amount', label: 'Amount', render: (r) => `₹${Number(r.amount).toLocaleString()}` },
      { key: 'created_at', label: 'Requested', render: (r) => safeFormat(r.created_at) },
    ],
    actions: ['approve', 'reject'],
    approveStatus: 'approved', rejectStatus: 'rejected',
  },
  {
    key: 'cms_withdrawals', label: 'CMS Withdrawals', icon: Wallet,
    table: 'cms_withdrawal_requests', statusField: 'status', statusValue: 'pending',
    columns: [
      { key: 'amount', label: 'Amount', render: (r) => `₹${Number(r.amount).toLocaleString()}` },
      { key: 'created_at', label: 'Requested', render: (r) => safeFormat(r.created_at) },
    ],
    actions: ['approve', 'reject'],
    approveStatus: 'approved', rejectStatus: 'rejected',
  },
  {
    key: 'promotions', label: 'Promotions', icon: Megaphone,
    table: 'promotion_orders', statusField: 'status', statusValue: 'pending',
    columns: [
      { key: 'total_amount', label: 'Amount', render: (r) => `₹${Number(r.total_amount).toLocaleString()}` },
      { key: 'transaction_id', label: 'Txn ID', render: (r) => r.transaction_id || '—' },
      { key: 'created_at', label: 'Ordered', render: (r) => safeFormat(r.created_at) },
    ],
    actions: ['approve', 'reject'],
    approveStatus: 'approved', rejectStatus: 'rejected',
  },
  {
    key: 'sub_labels', label: 'Sub Labels', icon: UsersRound,
    table: 'sub_labels', statusField: 'status', statusValue: 'pending',
    columns: [
      { key: 'sub_label_name', label: 'Sub Label' },
      { key: 'email', label: 'Email' },
      { key: 'parent_label_name', label: 'Parent' },
      { key: 'created_at', label: 'Created', render: (r) => safeFormat(r.created_at) },
    ],
    actions: ['approve', 'reject'],
    approveStatus: 'active', rejectStatus: 'rejected',
  },
  {
    key: 'cms_links', label: 'CMS Links', icon: Youtube,
    table: 'youtube_cms_links', statusField: 'status', statusValue: 'pending',
    columns: [
      { key: 'channel_name', label: 'Channel' },
      { key: 'channel_url', label: 'URL' },
      { key: 'created_at', label: 'Submitted', render: (r) => safeFormat(r.created_at) },
    ],
    actions: ['approve', 'reject'],
    approveStatus: 'linked', rejectStatus: 'rejected',
  },
  {
    key: 'ai_orders', label: 'AI Plan Orders', icon: Sparkles,
    table: 'ai_plan_orders', statusField: 'status', statusValue: 'pending',
    columns: [
      { key: 'transaction_id', label: 'Txn ID' },
      { key: 'created_at', label: 'Ordered', render: (r) => safeFormat(r.created_at) },
    ],
    actions: ['approve', 'reject'],
    approveStatus: 'approved', rejectStatus: 'rejected',
  },
  {
    key: 'smart_links', label: 'Smart Links', icon: Link2,
    table: 'smart_links', statusField: 'status', statusValue: 'pending',
    columns: [
      { key: 'title', label: 'Title' },
      { key: 'artist_name', label: 'Artist' },
      { key: 'created_at', label: 'Created', render: (r: any) => safeFormat(r.created_at) },
    ],
    actions: ['approve', 'reject'],
    approveStatus: 'approved', rejectStatus: 'rejected',
  },
  {
    key: 'signatures', label: 'E-Signatures', icon: FileSignature,
    table: 'signature_documents', statusField: 'status', statusValue: 'sent',
    columns: [
      { key: 'title', label: 'Document' },
      { key: 'description', label: 'Description', render: (r: any) => r.description || '—' },
      { key: 'created_at', label: 'Created', render: (r: any) => safeFormat(r.created_at) },
    ],
    actions: ['view'],
    approveStatus: 'completed', rejectStatus: 'voided',
    viewLink: () => '/admin/signatures',
  },
];

export default function AdminAllPending() {
  const navigate = useNavigate();
  const { isTeam, canDelete, canViewPendingCategory, loaded: permLoaded } = useTeamPermissions();
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [activeTab, setActiveTab] = useState('');
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(0);

  const [approveId, setApproveId] = useState<string | null>(null);
  const [rejectId, setRejectId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [pageSize, setPageSize] = useState<number | 'all'>(15);

  // Filter categories based on team permissions
  const visibleCategories = useMemo(() => {
    if (!permLoaded) return [];
    return categories.filter(c => canViewPendingCategory(c.key));
  }, [permLoaded, canViewPendingCategory]);

  // Set default active tab when visible categories load
  useEffect(() => {
    if (visibleCategories.length > 0 && !activeTab) {
      setActiveTab(visibleCategories[0].key);
    }
  }, [visibleCategories, activeTab]);

  const activeCategory = visibleCategories.find(c => c.key === activeTab) || visibleCategories[0];

  // Fetch counts for visible categories only
  useEffect(() => {
    if (!visibleCategories.length) return;
    const fetchCounts = async () => {
      const results: Record<string, number> = {};
      await Promise.all(
        visibleCategories.map(async (cat) => {
          const { count } = await (supabase.from(cat.table as any) as any)
            .select('id', { count: 'exact', head: true })
            .eq(cat.statusField, cat.statusValue);
          results[cat.key] = count || 0;
        })
      );
      setCounts(results);
    };
    fetchCounts();
  }, [visibleCategories]);

  const effectivePageSize = pageSize === 'all' ? 1000 : pageSize;

  // Fetch data for active tab
  useEffect(() => {
    if (!activeCategory) return;
    const fetchData = async () => {
      setLoading(true);
      const from = page * effectivePageSize;
      const to = from + effectivePageSize - 1;
      const { data: rows } = await (supabase.from(activeCategory.table as any) as any)
        .select('*')
        .eq(activeCategory.statusField, activeCategory.statusValue)
        .order('created_at', { ascending: false })
        .range(from, to);
      setData(rows || []);
      setLoading(false);
    };
    fetchData();
  }, [activeTab, page, effectivePageSize, activeCategory]);

  const totalCount = counts[activeTab] || 0;

  const handleApprove = async () => {
    if (!approveId) return;
    setActionLoading(true);
    const { error } = await (supabase.from(activeCategory.table as any) as any)
      .update({ [activeCategory.statusField]: activeCategory.approveStatus })
      .eq('id', approveId);
    setActionLoading(false);
    setApproveId(null);
    if (error) { toast.error('Failed to approve'); return; }
    toast.success('Approved successfully');
    setData(prev => prev.filter(r => r.id !== approveId));
    setCounts(prev => ({ ...prev, [activeTab]: Math.max(0, (prev[activeTab] || 0) - 1) }));
  };

  const handleReject = async (reason: string) => {
    if (!rejectId) return;
    setActionLoading(true);
    const updatePayload: any = { [activeCategory.statusField]: activeCategory.rejectStatus };
    // Add rejection reason if table supports it
    if (['releases', 'labels', 'content_requests', 'promotion_orders', 'sub_labels', 'ai_plan_orders', 'youtube_cms_links'].includes(activeCategory.table)) {
      updatePayload.rejection_reason = reason;
    }
    const { error } = await (supabase.from(activeCategory.table as any) as any)
      .update(updatePayload)
      .eq('id', rejectId);
    setActionLoading(false);
    setRejectId(null);
    if (error) { toast.error('Failed to reject'); return; }
    toast.success('Rejected');
    setData(prev => prev.filter(r => r.id !== rejectId));
    setCounts(prev => ({ ...prev, [activeTab]: Math.max(0, (prev[activeTab] || 0) - 1) }));
  };

  const grandTotal = Object.values(counts).reduce((s, n) => s + n, 0);

  return (
    <DashboardLayout>
      <div className="space-y-6 w-full">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Clock className="h-6 w-6 text-primary" />
              All Pendings
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              {grandTotal} total pending items across all modules
            </p>
          </div>
        </div>

        {/* Summary Cards - horizontal sliding */}
        <div className="responsive-table-wrap pb-2">
        <div className="flex gap-3 min-w-max">
          {visibleCategories.map(cat => {
            const Icon = cat.icon;
            const count = counts[cat.key] || 0;
            return (
              <button
                key={cat.key}
                onClick={() => { setActiveTab(cat.key); setPage(0); }}
                className={`flex flex-col items-center gap-1.5 p-3 rounded-lg border transition-all text-center min-w-[100px] ${
                  activeTab === cat.key
                    ? 'border-primary bg-primary/10 text-foreground'
                    : 'border-border bg-card/50 text-muted-foreground hover:bg-muted/50'
                }`}
              >
                <Icon className="h-5 w-5" />
                <span className="text-xs font-medium leading-tight">{cat.label}</span>
                <Badge variant={count > 0 ? 'destructive' : 'secondary'} className="text-xs">
                  {count}
                </Badge>
              </button>
            );
          })}
          </div>
        </div>

        {!activeCategory ? (
          <div className="text-center py-12 text-muted-foreground">No sections available</div>
        ) : (
          <div className="rounded-lg border border-border bg-card/50">
            <div className="responsive-table-wrap">
              <table className="w-full text-sm min-w-max">
                <thead>
                  <tr className="border-b border-border bg-muted/30">
                    {activeCategory.columns.map(col => (
                      <th key={col.key} className="px-4 py-3 text-left whitespace-nowrap font-medium text-muted-foreground">
                        {col.label}
                      </th>
                    ))}
                    <th className="px-4 py-3 text-left whitespace-nowrap font-medium text-muted-foreground">Status</th>
                    <th className="px-4 py-3 text-right whitespace-nowrap font-medium text-muted-foreground">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan={activeCategory.columns.length + 2} className="text-center py-12">
                        <Loader2 className="h-6 w-6 animate-spin mx-auto text-primary" />
                      </td>
                    </tr>
                  ) : data.length === 0 ? (
                    <tr>
                      <td colSpan={activeCategory.columns.length + 2} className="text-center py-12 text-muted-foreground">
                        No pending {activeCategory.label.toLowerCase()} found
                      </td>
                    </tr>
                  ) : (
                    data.map(row => (
                      <tr key={row.id} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                        {activeCategory.columns.map(col => (
                          <td key={col.key} className="px-4 py-3 whitespace-nowrap">
                            {col.render ? col.render(row) : (row[col.key] ?? '—')}
                          </td>
                        ))}
                        <td className="px-4 py-3 whitespace-nowrap">
                          <StatusBadge status={activeCategory.statusValue} />
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {activeCategory.actions.includes('approve') && (
                              <Button size="sm" variant="ghost" className="h-8 text-emerald-500 hover:text-emerald-400 hover:bg-accent"
                                onClick={() => setApproveId(row.id)}>
                                <CheckCircle className="h-4 w-4 mr-1" /> Approve
                              </Button>
                            )}
                            {activeCategory.actions.includes('reject') && (
                              <Button size="sm" variant="ghost" className="h-8 text-destructive hover:text-destructive hover:bg-accent"
                                onClick={() => setRejectId(row.id)}>
                                <XCircle className="h-4 w-4 mr-1" /> Reject
                              </Button>
                            )}
                            {activeCategory.actions.includes('view') && activeCategory.viewLink && (
                              <Button size="sm" variant="ghost" className="h-8"
                                onClick={() => navigate(activeCategory.viewLink!(row))}>
                                <Eye className="h-4 w-4 mr-1" /> View
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            <TablePagination
              totalItems={totalCount}
              currentPage={page}
              pageSize={pageSize}
              onPageChange={setPage}
              onPageSizeChange={(s) => { setPageSize(s); setPage(0); }}
            />
          </div>
        )}
      </div>

      {/* Approve Confirm Dialog */}
      <Dialog open={!!approveId} onOpenChange={(o) => !o && setApproveId(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Approve Item</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">Are you sure you want to approve this item?</p>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setApproveId(null)}>Cancel</Button>
            <Button onClick={handleApprove} disabled={actionLoading}>
              {actionLoading ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null} Approve
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reject Reason Dialog */}
      <Dialog open={!!rejectId} onOpenChange={(o) => { if (!o) { setRejectId(null); setRejectReason(''); } }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Reject</DialogTitle></DialogHeader>
          <div className="space-y-2">
            <label className="text-sm font-medium text-muted-foreground">Rejection Reason *</label>
            <Textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="Enter the reason for rejection..."
              className="min-h-[100px]"
              autoFocus
            />
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => { setRejectId(null); setRejectReason(''); }}>Cancel</Button>
            <Button variant="destructive" onClick={() => handleReject(rejectReason)} disabled={!rejectReason.trim() || actionLoading}>
              {actionLoading ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null} Reject
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
