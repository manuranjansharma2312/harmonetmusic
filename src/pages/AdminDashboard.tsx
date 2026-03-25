import { useEffect, useState } from 'react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { StatCard } from '@/components/StatCard';
import { GlassCard } from '@/components/GlassCard';
import { StatusBadge } from '@/components/StatusBadge';
import { supabase } from '@/integrations/supabase/client';
import { formatRevenue } from '@/lib/formatNumbers';
import {
  Music, Clock, CheckCircle, XCircle, Loader2, Users, Disc3,
  Wallet, FileText, UsersRound, Tag, MessageSquare, ArrowRight
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, AreaChart, Area
} from 'recharts';
import { format, subMonths } from 'date-fns';
import { useNavigate } from 'react-router-dom';

const CHART_COLORS = [
  'hsl(0, 67%, 35%)',
  'hsl(45, 80%, 45%)',
  'hsl(140, 60%, 40%)',
  'hsl(200, 70%, 50%)',
  'hsl(280, 60%, 50%)',
  'hsl(30, 80%, 50%)',
];

const tooltipStyle = {
  background: 'hsl(0 0% 12%)',
  border: '1px solid hsl(0 0% 20%)',
  borderRadius: '8px',
  color: 'hsl(0 0% 90%)',
  fontSize: '12px',
};

export default function AdminDashboard() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [songStats, setSongStats] = useState({ total: 0, pending: 0, approved: 0, rejected: 0 });
  const [releaseStats, setReleaseStats] = useState({ total: 0, pending: 0, approved: 0, rejected: 0 });
  const [userCount, setUserCount] = useState(0);
  const [labelCount, setLabelCount] = useState(0);
  const [subLabelCount, setSubLabelCount] = useState(0);
  const [withdrawalStats, setWithdrawalStats] = useState({ pending: 0, paid: 0, totalAmount: 0 });
  const [contentRequestCount, setContentRequestCount] = useState(0);
  const [monthlyRevenue, setMonthlyRevenue] = useState<{ month: string; revenue: number; streams: number }[]>([]);
  const [recentSongs, setRecentSongs] = useState<any[]>([]);
  const [topStores, setTopStores] = useState<{ name: string; value: number }[]>([]);
  const [monthlySongs, setMonthlySongs] = useState<{ month: string; count: number }[]>([]);
  const [pendingLabels, setPendingLabels] = useState<any[]>([]);
  const [pendingReleases, setPendingReleases] = useState<any[]>([]);
  const [pendingContentRequests, setPendingContentRequests] = useState<any[]>([]);
  const [pendingWithdrawals, setPendingWithdrawals] = useState<any[]>([]);

  useEffect(() => {
    fetchAll();
  }, []);

  async function fetchAll() {
    const [
      songsRes, releasesRes, profilesRes, labelsRes, subLabelsRes,
      withdrawalsRes, contentRes, reportRes, recentSongsRes,
      pendingLabelsRes, pendingReleasesRes, pendingContentRes, pendingWithdrawalsRes
    ] = await Promise.all([
      supabase.from('songs').select('status'),
      supabase.from('releases').select('status'),
      supabase.from('profiles').select('id'),
      supabase.from('labels').select('id'),
      supabase.from('sub_labels').select('id'),
      supabase.from('withdrawal_requests').select('status, amount'),
      supabase.from('content_requests').select('id, status').eq('status', 'pending'),
      supabase.from('report_entries').select('reporting_month, net_generated_revenue, streams, store'),
      supabase.from('songs').select('id, title, artist, status, created_at').order('created_at', { ascending: false }).limit(5),
      supabase.from('labels').select('id, label_name, created_at').eq('status', 'pending').order('created_at', { ascending: false }).limit(5),
      supabase.from('releases').select('id, album_name, ep_name, content_type, release_type, created_at').eq('status', 'pending').order('created_at', { ascending: false }).limit(5),
      supabase.from('content_requests').select('id, request_type, song_title, artist_name, created_at').eq('status', 'pending').order('created_at', { ascending: false }).limit(5),
      supabase.from('withdrawal_requests').select('id, amount, created_at, user_id').eq('status', 'pending').order('created_at', { ascending: false }).limit(5),
    ]);

    if (songsRes.data) {
      const d = songsRes.data;
      setSongStats({
        total: d.length,
        pending: d.filter(s => s.status === 'pending').length,
        approved: d.filter(s => s.status === 'approved').length,
        rejected: d.filter(s => s.status === 'rejected').length,
      });
    }

    if (releasesRes.data) {
      const d = releasesRes.data;
      setReleaseStats({
        total: d.length,
        pending: d.filter(s => s.status === 'pending').length,
        approved: d.filter(s => s.status === 'approved').length,
        rejected: d.filter(s => s.status === 'rejected').length,
      });
    }

    setUserCount(profilesRes.data?.length || 0);
    setLabelCount(labelsRes.data?.length || 0);
    setSubLabelCount(subLabelsRes.data?.length || 0);

    if (withdrawalsRes.data) {
      const d = withdrawalsRes.data;
      setWithdrawalStats({
        pending: d.filter(w => w.status === 'pending').length,
        paid: d.filter(w => w.status === 'paid').length,
        totalAmount: d.filter(w => w.status === 'paid').reduce((acc, w) => acc + Number(w.amount), 0),
      });
    }

    setContentRequestCount(contentRes.data?.length || 0);
    setPendingLabels(pendingLabelsRes.data || []);
    setPendingReleases(pendingReleasesRes.data || []);
    setPendingContentRequests(pendingContentRes.data || []);
    setPendingWithdrawals(pendingWithdrawalsRes.data || []);

    if (reportRes.data && reportRes.data.length > 0) {
      const monthMap: Record<string, { revenue: number; streams: number }> = {};
      const storeMap: Record<string, number> = {};

      reportRes.data.forEach((r: any) => {
        const month = r.reporting_month;
        if (!monthMap[month]) monthMap[month] = { revenue: 0, streams: 0 };
        monthMap[month].revenue += Number(r.net_generated_revenue || 0);
        monthMap[month].streams += Number(r.streams || 0);

        const store = r.store || 'Unknown';
        storeMap[store] = (storeMap[store] || 0) + Number(r.streams || 0);
      });

      setMonthlyRevenue(
        Object.entries(monthMap)
          .sort(([a], [b]) => a.localeCompare(b))
          .slice(-8)
          .map(([month, data]) => ({
            month: month.length > 7 ? month.substring(0, 7) : month,
            revenue: Math.round(data.revenue * 100) / 100,
            streams: data.streams,
          }))
      );

      setTopStores(
        Object.entries(storeMap)
          .sort(([, a], [, b]) => b - a)
          .slice(0, 6)
          .map(([name, value]) => ({ name, value }))
      );
    }

    if (recentSongsRes.data) {
      setRecentSongs(recentSongsRes.data);

      const now = new Date();
      const monthlyMap: Record<string, number> = {};
      for (let i = 5; i >= 0; i--) {
        monthlyMap[format(subMonths(now, i), 'MMM')] = 0;
      }
      const { data: allSongs } = await supabase.from('songs').select('created_at');
      if (allSongs) {
        allSongs.forEach((s: any) => {
          const m = format(new Date(s.created_at), 'MMM');
          if (monthlyMap[m] !== undefined) monthlyMap[m]++;
        });
      }
      setMonthlySongs(Object.entries(monthlyMap).map(([month, count]) => ({ month, count })));
    }

    setLoading(false);
  }

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    );
  }

  const statusData = [
    { name: 'Pending', value: songStats.pending, color: CHART_COLORS[1] },
    { name: 'Approved', value: songStats.approved, color: CHART_COLORS[2] },
    { name: 'Rejected', value: songStats.rejected, color: CHART_COLORS[0] },
  ].filter(d => d.value > 0);

  const releaseStatusData = [
    { name: 'Pending', value: releaseStats.pending, color: CHART_COLORS[1] },
    { name: 'Approved', value: releaseStats.approved, color: CHART_COLORS[2] },
    { name: 'Rejected', value: releaseStats.rejected, color: CHART_COLORS[0] },
  ].filter(d => d.value > 0);

  const getReleaseName = (r: any) => r.album_name || r.ep_name || r.content_type || 'Untitled';

  const formatRequestType = (type: string) =>
    type.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

  return (
    <DashboardLayout>
      <div className="mb-4 sm:mb-6 lg:mb-8">
        <h1 className="text-xl sm:text-2xl lg:text-3xl font-display font-bold text-foreground">Admin Dashboard</h1>
        <p className="text-muted-foreground mt-1 text-xs sm:text-sm lg:text-base">Platform overview and analytics.</p>
      </div>

      {/* Top Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-2 sm:gap-3 lg:gap-4 mb-4 sm:mb-6">
        <StatCard title="Total Users" value={userCount} icon={Users} color="hsla(200, 70%, 40%, 0.3)" />
        <StatCard title="Total Songs" value={songStats.total} icon={Music} />
        <StatCard title="Total Releases" value={releaseStats.total} icon={Disc3} color="hsla(280, 60%, 40%, 0.3)" />
        <StatCard title="Labels" value={labelCount} icon={FileText} color="hsla(30, 80%, 40%, 0.3)" />
        <StatCard title="Sub Labels" value={subLabelCount} icon={UsersRound} color="hsla(200, 60%, 35%, 0.3)" />
        <StatCard title="Pending Requests" value={contentRequestCount} icon={Clock} color="hsla(45, 80%, 40%, 0.3)" />
      </div>

      {/* Pending Requests Section */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4 mb-4 sm:mb-6">
        {/* Pending Songs */}
        <PendingListCard
          title="Pending Songs"
          icon={Music}
          items={recentSongs.filter(s => s.status === 'pending')}
          emptyText="No pending songs"
          onViewAll={() => navigate('/admin/submissions')}
          renderItem={(s) => (
            <div key={s.id} className="flex items-center justify-between gap-2 p-2.5 sm:p-3 rounded-lg bg-muted/20 hover:bg-muted/30 transition-colors">
              <div className="min-w-0 flex-1">
                <p className="text-xs sm:text-sm font-medium text-foreground truncate">{s.title}</p>
                <p className="text-[10px] sm:text-xs text-muted-foreground truncate">{s.artist}</p>
              </div>
              <span className="text-[10px] sm:text-xs text-muted-foreground shrink-0">{format(new Date(s.created_at), 'dd MMM')}</span>
            </div>
          )}
        />

        {/* Pending Labels */}
        <PendingListCard
          title="Pending Labels"
          icon={Tag}
          items={pendingLabels}
          emptyText="No pending labels"
          onViewAll={() => navigate('/admin/labels')}
          renderItem={(l) => (
            <div key={l.id} className="flex items-center justify-between gap-2 p-2.5 sm:p-3 rounded-lg bg-muted/20 hover:bg-muted/30 transition-colors">
              <div className="min-w-0 flex-1">
                <p className="text-xs sm:text-sm font-medium text-foreground truncate">{l.label_name}</p>
              </div>
              <span className="text-[10px] sm:text-xs text-muted-foreground shrink-0">{format(new Date(l.created_at), 'dd MMM')}</span>
            </div>
          )}
        />

        {/* Pending Releases */}
        <PendingListCard
          title="Pending Releases"
          icon={Disc3}
          items={pendingReleases}
          emptyText="No pending releases"
          onViewAll={() => navigate('/admin/submissions')}
          renderItem={(r) => (
            <div key={r.id} className="flex items-center justify-between gap-2 p-2.5 sm:p-3 rounded-lg bg-muted/20 hover:bg-muted/30 transition-colors">
              <div className="min-w-0 flex-1">
                <p className="text-xs sm:text-sm font-medium text-foreground truncate">{getReleaseName(r)}</p>
                <p className="text-[10px] sm:text-xs text-muted-foreground">{r.content_type}</p>
              </div>
              <span className="text-[10px] sm:text-xs text-muted-foreground shrink-0">{format(new Date(r.created_at), 'dd MMM')}</span>
            </div>
          )}
        />

        {/* Pending Content Requests */}
        <PendingListCard
          title="Pending Content Requests"
          icon={MessageSquare}
          items={pendingContentRequests}
          emptyText="No pending requests"
          onViewAll={() => navigate('/admin/content-requests')}
          renderItem={(c) => (
            <div key={c.id} className="flex items-center justify-between gap-2 p-2.5 sm:p-3 rounded-lg bg-muted/20 hover:bg-muted/30 transition-colors">
              <div className="min-w-0 flex-1">
                <p className="text-xs sm:text-sm font-medium text-foreground truncate">{formatRequestType(c.request_type)}</p>
                <p className="text-[10px] sm:text-xs text-muted-foreground truncate">{c.song_title || c.artist_name || '—'}</p>
              </div>
              <span className="text-[10px] sm:text-xs text-muted-foreground shrink-0">{format(new Date(c.created_at), 'dd MMM')}</span>
            </div>
          )}
        />
      </div>

      {/* Pending Withdrawals */}
      {pendingWithdrawals.length > 0 && (
        <GlassCard className="mb-4 sm:mb-6 animate-fade-in">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs sm:text-sm font-semibold text-foreground flex items-center gap-2">
              <Wallet className="h-4 w-4 text-primary" />
              Pending Withdrawals
            </h3>
            <button onClick={() => navigate('/admin/revenue')} className="text-[10px] sm:text-xs text-primary hover:underline flex items-center gap-1">
              View All <ArrowRight className="h-3 w-3" />
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 sm:gap-3">
            {pendingWithdrawals.map(w => (
              <div key={w.id} className="flex items-center justify-between gap-2 p-2.5 sm:p-3 rounded-lg bg-muted/20">
                <div className="min-w-0">
                  <p className="text-xs sm:text-sm font-bold text-foreground">₹{Number(w.amount).toLocaleString()}</p>
                  <p className="text-[10px] sm:text-xs text-muted-foreground">{format(new Date(w.created_at), 'dd MMM yyyy')}</p>
                </div>
                <StatusBadge status="pending" />
              </div>
            ))}
          </div>
        </GlassCard>
      )}

      {/* Charts Row: Song & Release Pies + Withdrawal Summary */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 mb-4 sm:mb-6">
        <GlassCard className="animate-fade-in">
          <h3 className="text-xs sm:text-sm font-semibold text-foreground mb-3 sm:mb-4">Song Status</h3>
          {statusData.length > 0 ? (
            <div className="h-40 sm:h-52">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={statusData} cx="50%" cy="50%" innerRadius={35} outerRadius={60} dataKey="value" strokeWidth={0}>
                    {statusData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                  </Pie>
                  <Tooltip contentStyle={tooltipStyle} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground text-center py-12 sm:py-16">No song data</p>
          )}
          <div className="flex flex-wrap justify-center gap-2 sm:gap-4 mt-2">
            {statusData.map(d => (
              <div key={d.name} className="flex items-center gap-1 text-[10px] sm:text-xs">
                <div className="h-2 w-2 rounded-full" style={{ background: d.color }} />
                <span className="text-muted-foreground">{d.name}: {d.value}</span>
              </div>
            ))}
          </div>
        </GlassCard>

        <GlassCard className="animate-fade-in">
          <h3 className="text-xs sm:text-sm font-semibold text-foreground mb-3 sm:mb-4">Release Status</h3>
          {releaseStatusData.length > 0 ? (
            <div className="h-40 sm:h-52">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={releaseStatusData} cx="50%" cy="50%" innerRadius={35} outerRadius={60} dataKey="value" strokeWidth={0}>
                    {releaseStatusData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                  </Pie>
                  <Tooltip contentStyle={tooltipStyle} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground text-center py-12 sm:py-16">No release data</p>
          )}
          <div className="flex flex-wrap justify-center gap-2 sm:gap-4 mt-2">
            {releaseStatusData.map(d => (
              <div key={d.name} className="flex items-center gap-1 text-[10px] sm:text-xs">
                <div className="h-2 w-2 rounded-full" style={{ background: d.color }} />
                <span className="text-muted-foreground">{d.name}: {d.value}</span>
              </div>
            ))}
          </div>
        </GlassCard>

        <GlassCard className="animate-fade-in md:col-span-2 lg:col-span-1">
          <h3 className="text-xs sm:text-sm font-semibold text-foreground mb-3 sm:mb-4">Withdrawal Overview</h3>
          <div className="space-y-3 sm:space-y-4 mt-2 sm:mt-6">
            <div className="flex items-center justify-between p-2.5 sm:p-3 rounded-lg bg-muted/30">
              <div className="flex items-center gap-2 sm:gap-3">
                <div className="p-1.5 sm:p-2 rounded-lg" style={{ background: 'hsla(45, 80%, 40%, 0.2)' }}>
                  <Clock className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-foreground" />
                </div>
                <span className="text-xs sm:text-sm text-muted-foreground">Pending</span>
              </div>
              <span className="text-sm sm:text-lg font-bold text-foreground">{withdrawalStats.pending}</span>
            </div>
            <div className="flex items-center justify-between p-2.5 sm:p-3 rounded-lg bg-muted/30">
              <div className="flex items-center gap-2 sm:gap-3">
                <div className="p-1.5 sm:p-2 rounded-lg" style={{ background: 'hsla(140, 60%, 30%, 0.2)' }}>
                  <CheckCircle className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-foreground" />
                </div>
                <span className="text-xs sm:text-sm text-muted-foreground">Paid</span>
              </div>
              <span className="text-sm sm:text-lg font-bold text-foreground">{withdrawalStats.paid}</span>
            </div>
            <div className="flex items-center justify-between p-2.5 sm:p-3 rounded-lg bg-muted/30">
              <div className="flex items-center gap-2 sm:gap-3">
                <div className="p-1.5 sm:p-2 rounded-lg" style={{ background: 'hsla(200, 70%, 40%, 0.2)' }}>
                  <Wallet className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-foreground" />
                </div>
                <span className="text-xs sm:text-sm text-muted-foreground">Total Paid</span>
              </div>
              <span className="text-sm sm:text-lg font-bold text-foreground">₹{withdrawalStats.totalAmount.toLocaleString()}</span>
            </div>
          </div>
        </GlassCard>
      </div>

      {/* Revenue Trend */}
      {monthlyRevenue.length > 0 && (
        <GlassCard className="mb-4 sm:mb-6 animate-fade-in">
          <h3 className="text-xs sm:text-sm font-semibold text-foreground mb-3 sm:mb-4">Revenue Trend (Monthly)</h3>
          <div className="h-48 sm:h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={monthlyRevenue}>
                <defs>
                  <linearGradient id="adminRevenueGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(0, 67%, 35%)" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="hsl(0, 67%, 35%)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(0 0% 20%)" />
                <XAxis dataKey="month" tick={{ fill: 'hsl(0 0% 55%)', fontSize: 10 }} />
                <YAxis tick={{ fill: 'hsl(0 0% 55%)', fontSize: 10 }} width={50} />
                <Tooltip contentStyle={tooltipStyle} />
                <Area type="monotone" dataKey="revenue" stroke="hsl(0, 67%, 40%)" fill="url(#adminRevenueGrad)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </GlassCard>
      )}

      {/* Streams by Store + Monthly Submissions */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4 mb-4 sm:mb-6">
        {topStores.length > 0 && (
          <GlassCard className="animate-fade-in">
            <h3 className="text-xs sm:text-sm font-semibold text-foreground mb-3 sm:mb-4">Streams by Store</h3>
            <div className="h-44 sm:h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={topStores} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(0 0% 20%)" />
                  <XAxis type="number" tick={{ fill: 'hsl(0 0% 55%)', fontSize: 10 }} />
                  <YAxis dataKey="name" type="category" tick={{ fill: 'hsl(0 0% 55%)', fontSize: 10 }} width={80} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Bar dataKey="value" fill="hsl(0, 67%, 35%)" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </GlassCard>
        )}

        {monthlySongs.length > 0 && (
          <GlassCard className="animate-fade-in">
            <h3 className="text-xs sm:text-sm font-semibold text-foreground mb-3 sm:mb-4">Song Submissions (6 Months)</h3>
            <div className="h-44 sm:h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthlySongs}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(0 0% 20%)" />
                  <XAxis dataKey="month" tick={{ fill: 'hsl(0 0% 55%)', fontSize: 10 }} />
                  <YAxis tick={{ fill: 'hsl(0 0% 55%)', fontSize: 10 }} width={30} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Bar dataKey="count" fill="hsl(200, 70%, 45%)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </GlassCard>
        )}
      </div>

      {/* Recent Song Submissions Table */}
      <GlassCard className="animate-fade-in">
        <h3 className="text-xs sm:text-sm font-semibold text-foreground mb-3 sm:mb-4">Recent Song Submissions</h3>
        {recentSongs.length > 0 ? (
          <>
            {/* Desktop table */}
            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/50">
                    <th className="text-left py-2 px-3 text-muted-foreground font-medium text-xs">Title</th>
                    <th className="text-left py-2 px-3 text-muted-foreground font-medium text-xs">Artist</th>
                    <th className="text-left py-2 px-3 text-muted-foreground font-medium text-xs">Status</th>
                    <th className="text-left py-2 px-3 text-muted-foreground font-medium text-xs">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {recentSongs.map((s: any) => (
                    <tr key={s.id} className="border-b border-border/30 hover:bg-muted/20 transition-colors">
                      <td className="py-2.5 px-3 text-foreground font-medium truncate max-w-[200px]">{s.title}</td>
                      <td className="py-2.5 px-3 text-muted-foreground truncate max-w-[150px]">{s.artist}</td>
                      <td className="py-2.5 px-3"><StatusBadge status={s.status} /></td>
                      <td className="py-2.5 px-3 text-muted-foreground text-xs">{format(new Date(s.created_at), 'dd MMM yyyy')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {/* Mobile card list */}
            <div className="sm:hidden space-y-2">
              {recentSongs.map((s: any) => (
                <div key={s.id} className="p-3 rounded-lg bg-muted/20">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-foreground truncate">{s.title}</p>
                      <p className="text-xs text-muted-foreground truncate">{s.artist}</p>
                    </div>
                    <StatusBadge status={s.status} />
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-1.5">{format(new Date(s.created_at), 'dd MMM yyyy')}</p>
                </div>
              ))}
            </div>
          </>
        ) : (
          <p className="text-xs text-muted-foreground text-center py-8">No recent submissions</p>
        )}
      </GlassCard>
    </DashboardLayout>
  );
}

function PendingListCard({
  title,
  icon: Icon,
  items,
  emptyText,
  onViewAll,
  renderItem,
}: {
  title: string;
  icon: any;
  items: any[];
  emptyText: string;
  onViewAll: () => void;
  renderItem: (item: any) => React.ReactNode;
}) {
  return (
    <GlassCard className="animate-fade-in">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-xs sm:text-sm font-semibold text-foreground flex items-center gap-2">
          <Icon className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-primary" />
          {title}
          {items.length > 0 && (
            <span className="ml-1 inline-flex items-center justify-center h-4 sm:h-5 min-w-[16px] sm:min-w-[20px] px-1 rounded-full text-[10px] sm:text-xs font-bold bg-primary/20 text-primary">
              {items.length}
            </span>
          )}
        </h3>
        <button onClick={onViewAll} className="text-[10px] sm:text-xs text-primary hover:underline flex items-center gap-1">
          View All <ArrowRight className="h-2.5 w-2.5 sm:h-3 sm:w-3" />
        </button>
      </div>
      {items.length > 0 ? (
        <div className="space-y-1.5 sm:space-y-2">{items.map(renderItem)}</div>
      ) : (
        <p className="text-xs text-muted-foreground text-center py-6 sm:py-8">{emptyText}</p>
      )}
    </GlassCard>
  );
}
