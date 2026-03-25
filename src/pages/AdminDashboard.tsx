import { useEffect, useState } from 'react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { StatCard } from '@/components/StatCard';
import { GlassCard } from '@/components/GlassCard';
import { supabase } from '@/integrations/supabase/client';
import {
  Music, Clock, CheckCircle, XCircle, Loader2, Users, Disc3,
  TrendingUp, Wallet, FileText, UsersRound, ArrowUpRight, ArrowDownRight
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, AreaChart, Area, LineChart, Line
} from 'recharts';
import { format, subMonths, parseISO } from 'date-fns';

const CHART_COLORS = [
  'hsl(0, 67%, 35%)',
  'hsl(45, 80%, 45%)',
  'hsl(140, 60%, 40%)',
  'hsl(200, 70%, 50%)',
  'hsl(280, 60%, 50%)',
  'hsl(30, 80%, 50%)',
];

export default function AdminDashboard() {
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

  useEffect(() => {
    fetchAll();
  }, []);

  async function fetchAll() {
    const [
      songsRes, releasesRes, profilesRes, labelsRes, subLabelsRes,
      withdrawalsRes, contentRes, reportRes, recentSongsRes
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
    ]);

    if (songsRes.data) {
      const d = songsRes.data;
      setSongStats({
        total: d.length,
        pending: d.filter(s => s.status === 'pending').length,
        approved: d.filter(s => s.status === 'approved').length,
        rejected: d.filter(s => s.status === 'rejected').length,
      });

      // Monthly songs (last 6 months)
      const now = new Date();
      const monthlyMap: Record<string, number> = {};
      for (let i = 5; i >= 0; i--) {
        const m = format(subMonths(now, i), 'MMM yyyy');
        monthlyMap[m] = 0;
      }
      // We don't have created_at in the status-only query, so use recentSongsRes for trend
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

    if (reportRes.data && reportRes.data.length > 0) {
      // Monthly revenue aggregation
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

      const sorted = Object.entries(monthMap)
        .sort(([a], [b]) => a.localeCompare(b))
        .slice(-8)
        .map(([month, data]) => ({
          month: month.length > 7 ? month.substring(0, 7) : month,
          revenue: Math.round(data.revenue * 100) / 100,
          streams: data.streams,
        }));
      setMonthlyRevenue(sorted);

      const topStoresSorted = Object.entries(storeMap)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 6)
        .map(([name, value]) => ({ name, value }));
      setTopStores(topStoresSorted);
    }

    if (recentSongsRes.data) {
      setRecentSongs(recentSongsRes.data);

      // Build monthly song submissions
      const now = new Date();
      const monthlyMap: Record<string, number> = {};
      for (let i = 5; i >= 0; i--) {
        monthlyMap[format(subMonths(now, i), 'MMM')] = 0;
      }
      // Get all songs with created_at for the chart
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

  return (
    <DashboardLayout>
      <div className="mb-6 sm:mb-8">
        <h1 className="text-2xl sm:text-3xl font-display font-bold text-foreground">Admin Dashboard</h1>
        <p className="text-muted-foreground mt-1 text-sm sm:text-base">Platform overview and analytics.</p>
      </div>

      {/* Top Stats Row */}
      <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-3 sm:gap-4 mb-6">
        <StatCard title="Total Users" value={userCount} icon={Users} color="hsla(200, 70%, 40%, 0.3)" />
        <StatCard title="Total Songs" value={songStats.total} icon={Music} />
        <StatCard title="Total Releases" value={releaseStats.total} icon={Disc3} color="hsla(280, 60%, 40%, 0.3)" />
        <StatCard title="Labels" value={labelCount} icon={FileText} color="hsla(30, 80%, 40%, 0.3)" />
        <StatCard title="Sub Labels" value={subLabelCount} icon={UsersRound} color="hsla(200, 60%, 35%, 0.3)" />
        <StatCard title="Pending Requests" value={contentRequestCount} icon={Clock} color="hsla(45, 80%, 40%, 0.3)" />
      </div>

      {/* Song & Release Status + Pending Withdrawals */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        {/* Song Status Pie */}
        <GlassCard className="animate-fade-in">
          <h3 className="text-sm font-semibold text-foreground mb-4">Song Status Breakdown</h3>
          {statusData.length > 0 ? (
            <div className="h-52">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={statusData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={80}
                    dataKey="value"
                    strokeWidth={0}
                  >
                    {statusData.map((entry, index) => (
                      <Cell key={index} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ background: 'hsl(0 0% 12%)', border: '1px solid hsl(0 0% 20%)', borderRadius: '8px', color: 'hsl(0 0% 90%)' }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground text-center py-16">No song data</p>
          )}
          <div className="flex justify-center gap-4 mt-2">
            {statusData.map(d => (
              <div key={d.name} className="flex items-center gap-1.5 text-xs">
                <div className="h-2.5 w-2.5 rounded-full" style={{ background: d.color }} />
                <span className="text-muted-foreground">{d.name}: {d.value}</span>
              </div>
            ))}
          </div>
        </GlassCard>

        {/* Release Status Pie */}
        <GlassCard className="animate-fade-in">
          <h3 className="text-sm font-semibold text-foreground mb-4">Release Status Breakdown</h3>
          {releaseStatusData.length > 0 ? (
            <div className="h-52">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={releaseStatusData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={80}
                    dataKey="value"
                    strokeWidth={0}
                  >
                    {releaseStatusData.map((entry, index) => (
                      <Cell key={index} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ background: 'hsl(0 0% 12%)', border: '1px solid hsl(0 0% 20%)', borderRadius: '8px', color: 'hsl(0 0% 90%)' }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground text-center py-16">No release data</p>
          )}
          <div className="flex justify-center gap-4 mt-2">
            {releaseStatusData.map(d => (
              <div key={d.name} className="flex items-center gap-1.5 text-xs">
                <div className="h-2.5 w-2.5 rounded-full" style={{ background: d.color }} />
                <span className="text-muted-foreground">{d.name}: {d.value}</span>
              </div>
            ))}
          </div>
        </GlassCard>

        {/* Withdrawal Summary */}
        <GlassCard className="animate-fade-in">
          <h3 className="text-sm font-semibold text-foreground mb-4">Withdrawal Overview</h3>
          <div className="space-y-4 mt-6">
            <div className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg" style={{ background: 'hsla(45, 80%, 40%, 0.2)' }}>
                  <Clock className="h-4 w-4 text-foreground" />
                </div>
                <span className="text-sm text-muted-foreground">Pending</span>
              </div>
              <span className="text-lg font-bold text-foreground">{withdrawalStats.pending}</span>
            </div>
            <div className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg" style={{ background: 'hsla(140, 60%, 30%, 0.2)' }}>
                  <CheckCircle className="h-4 w-4 text-foreground" />
                </div>
                <span className="text-sm text-muted-foreground">Paid</span>
              </div>
              <span className="text-lg font-bold text-foreground">{withdrawalStats.paid}</span>
            </div>
            <div className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg" style={{ background: 'hsla(200, 70%, 40%, 0.2)' }}>
                  <Wallet className="h-4 w-4 text-foreground" />
                </div>
                <span className="text-sm text-muted-foreground">Total Paid Out</span>
              </div>
              <span className="text-lg font-bold text-foreground">₹{withdrawalStats.totalAmount.toLocaleString()}</span>
            </div>
          </div>
        </GlassCard>
      </div>

      {/* Revenue Trend Area Chart */}
      {monthlyRevenue.length > 0 && (
        <GlassCard className="mb-6 animate-fade-in">
          <h3 className="text-sm font-semibold text-foreground mb-4">Revenue Trend (Monthly)</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={monthlyRevenue}>
                <defs>
                  <linearGradient id="adminRevenueGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(0, 67%, 35%)" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="hsl(0, 67%, 35%)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(0 0% 20%)" />
                <XAxis dataKey="month" tick={{ fill: 'hsl(0 0% 55%)', fontSize: 11 }} />
                <YAxis tick={{ fill: 'hsl(0 0% 55%)', fontSize: 11 }} />
                <Tooltip contentStyle={{ background: 'hsl(0 0% 12%)', border: '1px solid hsl(0 0% 20%)', borderRadius: '8px', color: 'hsl(0 0% 90%)' }} />
                <Area type="monotone" dataKey="revenue" stroke="hsl(0, 67%, 40%)" fill="url(#adminRevenueGrad)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </GlassCard>
      )}

      {/* Streams by Store + Monthly Submissions */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        {topStores.length > 0 && (
          <GlassCard className="animate-fade-in">
            <h3 className="text-sm font-semibold text-foreground mb-4">Streams by Store</h3>
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={topStores} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(0 0% 20%)" />
                  <XAxis type="number" tick={{ fill: 'hsl(0 0% 55%)', fontSize: 11 }} />
                  <YAxis dataKey="name" type="category" tick={{ fill: 'hsl(0 0% 55%)', fontSize: 11 }} width={100} />
                  <Tooltip contentStyle={{ background: 'hsl(0 0% 12%)', border: '1px solid hsl(0 0% 20%)', borderRadius: '8px', color: 'hsl(0 0% 90%)' }} />
                  <Bar dataKey="value" fill="hsl(0, 67%, 35%)" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </GlassCard>
        )}

        {monthlySongs.length > 0 && (
          <GlassCard className="animate-fade-in">
            <h3 className="text-sm font-semibold text-foreground mb-4">Song Submissions (Last 6 Months)</h3>
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthlySongs}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(0 0% 20%)" />
                  <XAxis dataKey="month" tick={{ fill: 'hsl(0 0% 55%)', fontSize: 11 }} />
                  <YAxis tick={{ fill: 'hsl(0 0% 55%)', fontSize: 11 }} />
                  <Tooltip contentStyle={{ background: 'hsl(0 0% 12%)', border: '1px solid hsl(0 0% 20%)', borderRadius: '8px', color: 'hsl(0 0% 90%)' }} />
                  <Bar dataKey="count" fill="hsl(200, 70%, 45%)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </GlassCard>
        )}
      </div>

      {/* Recent Submissions Table */}
      <GlassCard className="animate-fade-in">
        <h3 className="text-sm font-semibold text-foreground mb-4">Recent Song Submissions</h3>
        {recentSongs.length > 0 ? (
          <div className="overflow-x-auto">
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
                    <td className="py-2.5 px-3">
                      <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${
                        s.status === 'approved' ? 'bg-green-500/15 text-green-400' :
                        s.status === 'rejected' ? 'bg-red-500/15 text-red-400' :
                        'bg-yellow-500/15 text-yellow-400'
                      }`}>
                        {s.status === 'approved' ? <CheckCircle className="h-3 w-3" /> :
                         s.status === 'rejected' ? <XCircle className="h-3 w-3" /> :
                         <Clock className="h-3 w-3" />}
                        {s.status.charAt(0).toUpperCase() + s.status.slice(1)}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-muted-foreground text-xs">
                      {format(new Date(s.created_at), 'dd MMM yyyy')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground text-center py-8">No recent submissions</p>
        )}
      </GlassCard>
    </DashboardLayout>
  );
}
