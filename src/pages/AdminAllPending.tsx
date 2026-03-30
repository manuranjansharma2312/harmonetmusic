import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { DashboardLayout } from '@/components/DashboardLayout';
import { StatusBadge } from '@/components/StatusBadge';
import { TablePagination, paginateItems } from '@/components/TablePagination';
import { toast } from 'sonner';
import { format } from 'date-fns';
import {
  Users, ListMusic, Tag, Headset, Video, Wallet, Megaphone, UsersRound, Youtube,
  Sparkles, CheckCircle, XCircle, Eye, Loader2, Clock,
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
      { key: 'user_type', label: 'Type' },
      { key: 'created_at', label: 'Registered', render: (r) => format(new Date(r.created_at), 'dd MMM yyyy') },
    ],
    actions: ['approve', 'reject'],
    approveStatus: 'verified', rejectStatus: 'rejected',
  },
  {
    key: 'releases', label: 'Releases', icon: ListMusic,
    table: 'releases', statusField: 'status', statusValue: 'pending',
    columns: [
      { key: 'album_name', label: 'Release', render: (r) => r.album_name || r.ep_name || '—' },
      { key: 'content_type', label: 'Type' },
      { key: 'release_date', label: 'Date', render: (r) => format(new Date(r.release_date), 'dd MMM yyyy') },
      { key: 'created_at', label: 'Submitted', render: (r) => format(new Date(r.created_at), 'dd MMM yyyy') },
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
      { key: 'created_at', label: 'Submitted', render: (r) => format(new Date(r.created_at), 'dd MMM yyyy') },
    ],
    actions: ['approve', 'reject'],
    approveStatus: 'approved', rejectStatus: 'rejected',
  },
  {
    key: 'support', label: 'Support Requests', icon: Headset,
    table: 'content_requests', statusField: 'status', statusValue: 'pending',
    columns: [
      { key: 'request_type', label: 'Type', render: (r) => r.request_type?.replace(/_/g, ' ') },
      { key: 'song_title', label: 'Song', render: (r) => r.song_title || r.artist_name || '—' },
      { key: 'created_at', label: 'Submitted', render: (r) => format(new Date(r.created_at), 'dd MMM yyyy') },
    ],
    actions: ['approve', 'reject', 'view'],
    approveStatus: 'approved', rejectStatus: 'rejected',
    viewLink: () => '/admin/content-requests',
  },
  {
    key: 'videos', label: 'Videos', icon: Video,
    table: 'video_submissions', statusField: 'status', statusValue: 'pending',
    columns: [
      { key: 'submission_type', label: 'Type' },
      { key: 'created_at', label: 'Submitted', render: (r) => format(new Date(r.created_at), 'dd MMM yyyy') },
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
      { key: 'created_at', label: 'Requested', render: (r) => format(new Date(r.created_at), 'dd MMM yyyy') },
    ],
    actions: ['approve', 'reject'],
    approveStatus: 'approved', rejectStatus: 'rejected',
  },
  {
    key: 'cms_withdrawals', label: 'CMS Withdrawals', icon: Wallet,
    table: 'cms_withdrawal_requests', statusField: 'status', statusValue: 'pending',
    columns: [
      { key: 'amount', label: 'Amount', render: (r) => `₹${Number(r.amount).toLocaleString()}` },
      { key: 'created_at', label: 'Requested', render: (r) => format(new Date(r.created_at), 'dd MMM yyyy') },
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
      { key: 'created_at', label: 'Ordered', render: (r) => format(new Date(r.created_at), 'dd MMM yyyy') },
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
      { key: 'created_at', label: 'Created', render: (r) => format(new Date(r.created_at), 'dd MMM yyyy') },
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
      { key: 'created_at', label: 'Submitted', render: (r) => format(new Date(r.created_at), 'dd MMM yyyy') },
    ],
    actions: ['approve', 'reject'],
    approveStatus: 'linked', rejectStatus: 'rejected',
  },
  {
    key: 'ai_orders', label: 'AI Plan Orders', icon: Sparkles,
    table: 'ai_plan_orders', statusField: 'status', statusValue: 'pending',
    columns: [
      { key: 'transaction_id', label: 'Txn ID' },
      { key: 'created_at', label: 'Ordered', render: (r) => format(new Date(r.created_at), 'dd MMM yyyy') },
    ],
    actions: ['approve', 'reject'],
    approveStatus: 'approved', rejectStatus: 'rejected',
  },
];

export default function AdminAllPending() {
  const navigate = useNavigate();
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [activeTab, setActiveTab] = useState('users');
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const pageSize = 15;

  const [approveId, setApproveId] = useState<string | null>(null);
  const [rejectId, setRejectId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [pageSize, setPageSize] = useState<number | 'all'>(15);

  const activeCategory = categories.find(c => c.key === activeTab)!;

  // Fetch counts for all categories
  useEffect(() => {
    const fetchCounts = async () => {
      const results: Record<string, number> = {};
      await Promise.all(
        categories.map(async (cat) => {
          const { count } = await (supabase.from(cat.table as any) as any)
            .select('id', { count: 'exact', head: true })
            .eq(cat.statusField, cat.statusValue);
          results[cat.key] = count || 0;
        })
      );
      setCounts(results);
    };
    fetchCounts();
  }, []);

  // Fetch data for active tab
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;
      const { data: rows } = await (supabase.from(activeCategory.table as any) as any)
        .select('*')
        .eq(activeCategory.statusField, activeCategory.statusValue)
        .order('created_at', { ascending: false })
        .range(from, to);
      setData(rows || []);
      setLoading(false);
    };
    fetchData();
  }, [activeTab, page]);

  const totalCount = counts[activeTab] || 0;
  const totalPages = Math.ceil(totalCount / pageSize);

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
              All Pending
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              {grandTotal} total pending items across all modules
            </p>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
          {categories.map(cat => {
            const Icon = cat.icon;
            const count = counts[cat.key] || 0;
            return (
              <button
                key={cat.key}
                onClick={() => { setActiveTab(cat.key); setPage(1); }}
                className={`flex flex-col items-center gap-1.5 p-3 rounded-lg border transition-all text-center ${
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

        {/* Data Table */}
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
                        <StatusBadge status="pending" />
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {activeCategory.actions.includes('approve') && (
                            <Button size="sm" variant="ghost" className="h-8 text-green-500 hover:text-green-400 hover:bg-green-500/10"
                              onClick={() => setApproveId(row.id)}>
                              <CheckCircle className="h-4 w-4 mr-1" /> Approve
                            </Button>
                          )}
                          {activeCategory.actions.includes('reject') && (
                            <Button size="sm" variant="ghost" className="h-8 text-red-500 hover:text-red-400 hover:bg-red-500/10"
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
          {totalPages > 1 && (
            <div className="p-3 border-t border-border">
              <TablePagination page={page} totalPages={totalPages} onPageChange={setPage} />
            </div>
          )}
        </div>
      </div>

      <ConfirmDialog
        open={!!approveId}
        onOpenChange={(o) => !o && setApproveId(null)}
        title="Approve Item"
        description="Are you sure you want to approve this item?"
        confirmLabel="Approve"
        onConfirm={handleApprove}
        loading={actionLoading}
      />

      <RejectReasonModal
        open={!!rejectId}
        onOpenChange={(o) => !o && setRejectId(null)}
        onSubmit={handleReject}
        loading={actionLoading}
      />
    </DashboardLayout>
  );
}
