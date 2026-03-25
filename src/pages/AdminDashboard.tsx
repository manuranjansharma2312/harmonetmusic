import { useEffect, useState } from 'react';
import { WorldMapChart } from '@/components/WorldMapChart';
import { DashboardLayout } from '@/components/DashboardLayout';
import { GlassCard } from '@/components/GlassCard';
import { StatusBadge } from '@/components/StatusBadge';
import { supabase } from '@/integrations/supabase/client';
import { formatRevenue, formatStreams } from '@/lib/formatNumbers';
import {
  Disc3, Clock, CheckCircle, XCircle, Loader2, Users,
  Wallet, FileText, UsersRound, Tag, MessageSquare, ArrowRight,
  TrendingUp, TrendingDown, Music, BarChart3, Activity, DollarSign
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, AreaChart, Area, LineChart, Line, Legend, RadialBarChart, RadialBar
} from 'recharts';
import { format, subMonths, startOfMonth, isAfter } from 'date-fns';
import { useNavigate } from 'react-router-dom';

const CHART_COLORS = [
  'hsl(0, 67%, 35%)',
  'hsl(45, 80%, 45%)',
  'hsl(140, 60%, 40%)',
  'hsl(200, 70%, 50%)',
  'hsl(280, 60%, 50%)',
  'hsl(30, 80%, 50%)',
];

const STORE_COLORS: Record<string, string> = {
  Spotify: '#1DB954',
  'Apple Music': '#FA2D48',
  'YouTube Music': '#FF0000',
  YouTube: '#FF0000',
  JioSaavn: '#2BC5B4',
  Gaana: '#E72C30',
  Wynk: '#1E90FF',
  Amazon: '#FF9900',
  Hungama: '#EF2D56',
  Instagram: '#E1306C',
  Facebook: '#1877F2',
  TikTok: '#000000',
};

const tooltipStyle = {
  background: 'hsl(0 0% 10%)',
  border: '1px solid hsl(0 0% 18%)',
  borderRadius: '12px',
  color: 'hsl(0 0% 90%)',
  fontSize: '12px',
  boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
  padding: '10px 14px',
};

function MiniStatCard({ title, value, icon: Icon, color, trend }: {
  title: string; value: string | number; icon: any; color: string; trend?: { value: number; label: string };
}) {
  return (
    <GlassCard className="!p-3 sm:!p-4 animate-fade-in group hover:scale-[1.02] transition-transform duration-200">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-[10px] sm:text-xs text-muted-foreground font-medium uppercase tracking-wider">{title}</p>
          <p className="text-lg sm:text-xl lg:text-2xl font-bold font-display mt-1 whitespace-nowrap text-foreground">{value}</p>
          {trend && (
            <div className={`flex items-center gap-1 mt-1.5 ${trend.value >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
              {trend.value >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
              <span className="text-[10px] sm:text-xs font-medium">{trend.value >= 0 ? '+' : ''}{trend.value}% {trend.label}</span>
            </div>
          )}
        </div>
        <div
          className="rounded-xl p-2 sm:p-2.5 shrink-0 transition-all duration-200 group-hover:scale-110"
          style={{ background: color }}
        >
          <Icon className="h-4 w-4 sm:h-5 sm:w-5 text-foreground" />
        </div>
      </div>
    </GlassCard>
  );
}

export default function AdminDashboard() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [releaseStats, setReleaseStats] = useState({ total: 0, pending: 0, approved: 0, rejected: 0 });
  const [userCount, setUserCount] = useState(0);
  const [labelCount, setLabelCount] = useState(0);
  const [subLabelCount, setSubLabelCount] = useState(0);
  const [withdrawalStats, setWithdrawalStats] = useState({ pending: 0, paid: 0, totalAmount: 0, pendingAmount: 0 });
  const [contentRequestCount, setContentRequestCount] = useState(0);
  const [totalRevenue, setTotalRevenue] = useState(0);
  const [totalStreams, setTotalStreams] = useState(0);
  const [monthlyRevenue, setMonthlyRevenue] = useState<{ month: string; revenue: number; streams: number }[]>([]);
  const [topStores, setTopStores] = useState<{ name: string; value: number; color: string }[]>([]);
  const [topTracks, setTopTracks] = useState<{ name: string; streams: number }[]>([]);
  const [topArtists, setTopArtists] = useState<{ name: string; streams: number }[]>([]);
  const [monthlyReleases, setMonthlyReleases] = useState<{ month: string; count: number }[]>([]);
  const [monthlyUsers, setMonthlyUsers] = useState<{ month: string; count: number }[]>([]);
  const [pendingLabels, setPendingLabels] = useState<any[]>([]);
  const [pendingReleases, setPendingReleases] = useState<any[]>([]);
  const [recentReleases, setRecentReleases] = useState<any[]>([]);
  const [pendingContentRequests, setPendingContentRequests] = useState<any[]>([]);
  const [pendingWithdrawals, setPendingWithdrawals] = useState<any[]>([]);
  const [countryData, setCountryData] = useState<{ name: string; streams: number }[]>([]);

  useEffect(() => { fetchAll(); }, []);

  async function fetchAll() {
    const [
      releasesRes, profilesRes, labelsRes, subLabelsRes,
      withdrawalsRes, contentRes, reportRes, ytReportRes,
      pendingLabelsRes, pendingReleasesRes, pendingContentRes, pendingWithdrawalsRes,
      recentReleasesRes
    ] = await Promise.all([
      supabase.from('releases').select('status, created_at'),
      supabase.from('profiles').select('id, created_at'),
      supabase.from('labels').select('id'),
      supabase.from('sub_labels').select('id'),
      supabase.from('withdrawal_requests').select('status, amount'),
      supabase.from('content_requests').select('id, status').eq('status', 'pending'),
      supabase.from('report_entries').select('reporting_month, net_generated_revenue, streams, store, track, artist, country'),
      supabase.from('youtube_report_entries').select('reporting_month, net_generated_revenue, streams, store, track, artist, country'),
      supabase.from('labels').select('id, label_name, created_at').eq('status', 'pending').order('created_at', { ascending: false }).limit(5),
      supabase.from('releases').select('id, album_name, ep_name, content_type, release_type, created_at').eq('status', 'pending').order('created_at', { ascending: false }).limit(5),
      supabase.from('content_requests').select('id, request_type, song_title, artist_name, created_at').eq('status', 'pending').order('created_at', { ascending: false }).limit(5),
      supabase.from('withdrawal_requests').select('id, amount, created_at, user_id').eq('status', 'pending').order('created_at', { ascending: false }).limit(5),
      supabase.from('releases').select('id, album_name, ep_name, content_type, status, created_at').order('created_at', { ascending: false }).limit(5),
    ]);

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
        pendingAmount: d.filter(w => w.status === 'pending').reduce((acc, w) => acc + Number(w.amount), 0),
      });
    }

    setContentRequestCount(contentRes.data?.length || 0);
    setPendingLabels(pendingLabelsRes.data || []);
    setPendingReleases(pendingReleasesRes.data || []);
    setPendingContentRequests(pendingContentRes.data || []);
    setPendingWithdrawals(pendingWithdrawalsRes.data || []);
    setRecentReleases(recentReleasesRes.data || []);

    const allReports = [...(reportRes.data || []), ...(ytReportRes.data || [])];

    if (allReports.length > 0) {
      let totalRev = 0;
      let totalStr = 0;
      const monthMap: Record<string, { revenue: number; streams: number }> = {};
      const storeMap: Record<string, number> = {};
      const trackMap: Record<string, number> = {};
      const artistMap: Record<string, number> = {};
      const countryMap: Record<string, number> = {};

      allReports.forEach((r: any) => {
        const rev = Number(r.net_generated_revenue || 0);
        const str = Number(r.streams || 0);
        totalRev += rev;
        totalStr += str;

        const month = r.reporting_month;
        if (!monthMap[month]) monthMap[month] = { revenue: 0, streams: 0 };
        monthMap[month].revenue += rev;
        monthMap[month].streams += str;

        const store = r.store || 'Unknown';
        storeMap[store] = (storeMap[store] || 0) + str;

        if (r.track) trackMap[r.track] = (trackMap[r.track] || 0) + str;
        if (r.artist) artistMap[r.artist] = (artistMap[r.artist] || 0) + str;
        if (r.country) countryMap[r.country] = (countryMap[r.country] || 0) + str;
      });

      setTotalRevenue(totalRev);
      setTotalStreams(totalStr);

      setMonthlyRevenue(
        Object.entries(monthMap).sort(([a], [b]) => a.localeCompare(b)).slice(-8)
          .map(([month, data]) => ({
            month: month.length > 7 ? month.substring(0, 7) : month,
            revenue: Math.round(data.revenue * 100) / 100,
            streams: data.streams,
          }))
      );

      setTopStores(
        Object.entries(storeMap).sort(([, a], [, b]) => b - a).slice(0, 6)
          .map(([name, value]) => ({ name, value, color: STORE_COLORS[name] || CHART_COLORS[0] }))
      );

      setTopTracks(
        Object.entries(trackMap).sort(([, a], [, b]) => b - a).slice(0, 5)
          .map(([name, streams]) => ({ name: name.length > 25 ? name.substring(0, 25) + '…' : name, streams }))
      );

      setTopArtists(
        Object.entries(artistMap).sort(([, a], [, b]) => b - a).slice(0, 5)
          .map(([name, streams]) => ({ name: name.length > 20 ? name.substring(0, 20) + '…' : name, streams }))
      );

      setCountryData(
        Object.entries(countryMap).sort(([, a], [, b]) => b - a).slice(0, 8)
          .map(([name, streams]) => ({ name, streams }))
      );
    }

    // Monthly releases + users trend (last 6 months)
    const now = new Date();
    const monthlyRelMap: Record<string, number> = {};
    const monthlyUserMap: Record<string, number> = {};
    for (let i = 5; i >= 0; i--) {
      const key = format(subMonths(now, i), 'MMM');
      monthlyRelMap[key] = 0;
      monthlyUserMap[key] = 0;
    }

    if (releasesRes.data) {
      releasesRes.data.forEach((r: any) => {
        const m = format(new Date(r.created_at), 'MMM');
        if (monthlyRelMap[m] !== undefined) monthlyRelMap[m]++;
      });
    }

    if (profilesRes.data) {
      (profilesRes.data as any[]).forEach((p: any) => {
        const m = format(new Date(p.created_at), 'MMM');
        if (monthlyUserMap[m] !== undefined) monthlyUserMap[m]++;
      });
    }

    setMonthlyReleases(Object.entries(monthlyRelMap).map(([month, count]) => ({ month, count })));
    setMonthlyUsers(Object.entries(monthlyUserMap).map(([month, count]) => ({ month, count })));
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

  const releaseStatusData = [
    { name: 'Pending', value: releaseStats.pending, color: CHART_COLORS[1] },
    { name: 'Approved', value: releaseStats.approved, color: CHART_COLORS[2] },
    { name: 'Rejected', value: releaseStats.rejected, color: CHART_COLORS[0] },
  ].filter(d => d.value > 0);

  const getReleaseName = (r: any) => r.album_name || r.ep_name || r.content_type || 'Untitled';
  const formatRequestType = (type: string) => type.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

  const totalStoreStreams = topStores.reduce((a, b) => a + b.value, 0);

  return (
    <DashboardLayout>
      <div className="mb-4 sm:mb-6 lg:mb-8">
        <h1 className="text-xl sm:text-2xl lg:text-3xl font-display font-bold text-foreground">Admin Dashboard</h1>
        <p className="text-muted-foreground mt-1 text-xs sm:text-sm lg:text-base">Platform overview and analytics</p>
      </div>

      {/* Hero Stats Row */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-8 gap-2 sm:gap-3 mb-4 sm:mb-6">
        <MiniStatCard title="Users" value={userCount} icon={Users} color="hsla(200, 70%, 40%, 0.25)" />
        <MiniStatCard title="Releases" value={releaseStats.total} icon={Disc3} color="hsla(0, 67%, 25%, 0.3)" />
        <MiniStatCard title="Pending" value={releaseStats.pending} icon={Clock} color="hsla(45, 80%, 40%, 0.25)" />
        <MiniStatCard title="Approved" value={releaseStats.approved} icon={CheckCircle} color="hsla(140, 60%, 30%, 0.25)" />
        <MiniStatCard title="Labels" value={labelCount} icon={FileText} color="hsla(30, 80%, 40%, 0.25)" />
        <MiniStatCard title="Sub Labels" value={subLabelCount} icon={UsersRound} color="hsla(200, 60%, 35%, 0.25)" />
        <MiniStatCard title="Total Revenue" value={formatRevenue(totalRevenue)} icon={DollarSign} color="hsla(140, 60%, 35%, 0.25)" />
        <MiniStatCard title="Total Streams" value={formatStreams(totalStreams)} icon={BarChart3} color="hsla(280, 60%, 40%, 0.25)" />
      </div>

      {/* Financial Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-3 mb-4 sm:mb-6">
        <GlassCard className="!p-3 sm:!p-4 animate-fade-in border-l-4" style={{ borderLeftColor: 'hsl(45, 80%, 45%)' }}>
          <div className="flex items-center gap-2 mb-2">
            <Clock className="h-4 w-4 text-yellow-400" />
            <span className="text-[10px] sm:text-xs text-muted-foreground uppercase tracking-wider font-medium">Pending Withdrawals</span>
          </div>
          <p className="text-lg sm:text-xl font-bold text-foreground">{formatRevenue(withdrawalStats.pendingAmount)}</p>
          <p className="text-[10px] sm:text-xs text-muted-foreground mt-1">{withdrawalStats.pending} requests</p>
        </GlassCard>
        <GlassCard className="!p-3 sm:!p-4 animate-fade-in border-l-4" style={{ borderLeftColor: 'hsl(140, 60%, 40%)' }}>
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle className="h-4 w-4 text-emerald-400" />
            <span className="text-[10px] sm:text-xs text-muted-foreground uppercase tracking-wider font-medium">Total Paid</span>
          </div>
          <p className="text-lg sm:text-xl font-bold text-foreground">{formatRevenue(withdrawalStats.totalAmount)}</p>
          <p className="text-[10px] sm:text-xs text-muted-foreground mt-1">{withdrawalStats.paid} completed</p>
        </GlassCard>
        <GlassCard className="!p-3 sm:!p-4 animate-fade-in border-l-4" style={{ borderLeftColor: 'hsl(200, 70%, 50%)' }}>
          <div className="flex items-center gap-2 mb-2">
            <MessageSquare className="h-4 w-4 text-blue-400" />
            <span className="text-[10px] sm:text-xs text-muted-foreground uppercase tracking-wider font-medium">Pending Requests</span>
          </div>
          <p className="text-lg sm:text-xl font-bold text-foreground">{contentRequestCount}</p>
          <p className="text-[10px] sm:text-xs text-muted-foreground mt-1">content requests</p>
        </GlassCard>
      </div>

      {/* Revenue & Streams Dual Chart */}
      <GlassCard className="mb-4 sm:mb-6 animate-fade-in">
        <h3 className="text-sm sm:text-base font-semibold text-foreground mb-4 flex items-center gap-2">
          <Activity className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
          Revenue & Streams Trend
        </h3>
        {monthlyRevenue.length > 0 ? (
          <div className="h-56 sm:h-72">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={monthlyRevenue}>
                <defs>
                  <linearGradient id="adminRevenueGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(0, 67%, 35%)" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="hsl(0, 67%, 35%)" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="adminStreamsGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(200, 70%, 50%)" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="hsl(200, 70%, 50%)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(0 0% 16%)" />
                <XAxis dataKey="month" tick={{ fill: 'hsl(0 0% 55%)', fontSize: 10 }} axisLine={{ stroke: 'hsl(0 0% 20%)' }} />
                <YAxis yAxisId="left" tick={{ fill: 'hsl(0 0% 55%)', fontSize: 10 }} width={55} axisLine={{ stroke: 'hsl(0 0% 20%)' }} />
                <YAxis yAxisId="right" orientation="right" tick={{ fill: 'hsl(0 0% 55%)', fontSize: 10 }} width={55} axisLine={{ stroke: 'hsl(0 0% 20%)' }} />
                <Tooltip contentStyle={tooltipStyle} />
                <Legend wrapperStyle={{ fontSize: '11px', color: 'hsl(0 0% 60%)' }} />
                <Area yAxisId="left" type="monotone" dataKey="revenue" stroke="hsl(0, 67%, 40%)" fill="url(#adminRevenueGrad)" strokeWidth={2.5} name="Revenue (₹)" dot={{ r: 3, fill: 'hsl(0, 67%, 40%)' }} />
                <Area yAxisId="right" type="monotone" dataKey="streams" stroke="hsl(200, 70%, 50%)" fill="url(#adminStreamsGrad)" strokeWidth={2} name="Streams" dot={{ r: 2.5, fill: 'hsl(200, 70%, 50%)' }} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground text-center py-16">No revenue data yet</p>
        )}
      </GlassCard>

      {/* Release Status Donut + Platform Distribution + User Growth */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 mb-4 sm:mb-6">
        {/* Release Status Donut */}
        <GlassCard className="animate-fade-in">
          <h3 className="text-xs sm:text-sm font-semibold text-foreground mb-3">Release Status</h3>
          {releaseStatusData.length > 0 ? (
            <>
              <div className="h-44 sm:h-52 relative">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={releaseStatusData} cx="50%" cy="50%" innerRadius={45} outerRadius={70} dataKey="value" strokeWidth={0} paddingAngle={3}>
                      {releaseStatusData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                    </Pie>
                    <Tooltip contentStyle={tooltipStyle} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="text-center">
                    <p className="text-xl sm:text-2xl font-bold text-foreground">{releaseStats.total}</p>
                    <p className="text-[10px] text-muted-foreground">Total</p>
                  </div>
                </div>
              </div>
              <div className="flex flex-wrap justify-center gap-3 mt-2">
                {releaseStatusData.map(d => (
                  <div key={d.name} className="flex items-center gap-1.5 text-[10px] sm:text-xs">
                    <div className="h-2.5 w-2.5 rounded-full" style={{ background: d.color }} />
                    <span className="text-muted-foreground">{d.name}: <span className="text-foreground font-medium">{d.value}</span></span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <p className="text-xs text-muted-foreground text-center py-16">No release data</p>
          )}
        </GlassCard>

        {/* Platform Distribution */}
        {topStores.length > 0 && (
          <GlassCard className="animate-fade-in">
            <h3 className="text-xs sm:text-sm font-semibold text-foreground mb-3">Platform Distribution</h3>
            <div className="space-y-2.5 sm:space-y-3">
              {topStores.map((store, i) => {
                const pct = totalStoreStreams > 0 ? (store.value / totalStoreStreams) * 100 : 0;
                return (
                  <div key={store.name}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs text-foreground font-medium">{store.name}</span>
                      <span className="text-[10px] sm:text-xs text-muted-foreground">{formatStreams(store.value)} ({pct.toFixed(1)}%)</span>
                    </div>
                    <div className="h-2 rounded-full bg-muted/40 overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-700"
                        style={{ width: `${pct}%`, background: store.color }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </GlassCard>
        )}

        {/* User Growth */}
        <GlassCard className="animate-fade-in">
          <h3 className="text-xs sm:text-sm font-semibold text-foreground mb-3">User Registrations (6 Months)</h3>
          <div className="h-44 sm:h-52">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthlyUsers}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(0 0% 16%)" />
                <XAxis dataKey="month" tick={{ fill: 'hsl(0 0% 55%)', fontSize: 10 }} axisLine={{ stroke: 'hsl(0 0% 20%)' }} />
                <YAxis tick={{ fill: 'hsl(0 0% 55%)', fontSize: 10 }} width={30} axisLine={{ stroke: 'hsl(0 0% 20%)' }} />
                <Tooltip contentStyle={tooltipStyle} />
                <Bar dataKey="count" name="Users" radius={[6, 6, 0, 0]}>
                  {monthlyUsers.map((_, i) => (
                    <Cell key={i} fill={`hsl(200, 70%, ${35 + i * 5}%)`} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </GlassCard>
      </div>

      {/* Top Tracks + Top Artists + Release Submissions */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 sm:gap-4 mb-4 sm:mb-6">
        {/* Top Tracks */}
        <GlassCard className="animate-fade-in">
          <h3 className="text-xs sm:text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
            <Music className="h-4 w-4 text-primary" />
            Top Tracks
          </h3>
          {topTracks.length > 0 ? (
            <div className="space-y-2">
              {topTracks.map((track, i) => (
                <div key={track.name} className="flex items-center gap-3 p-2.5 rounded-lg bg-muted/20 hover:bg-muted/30 transition-colors">
                  <span className="text-xs font-bold text-primary w-5 text-center">#{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs sm:text-sm font-medium text-foreground truncate">{track.name}</p>
                    <p className="text-[10px] text-muted-foreground">{formatStreams(track.streams)} streams</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground text-center py-12">No track data</p>
          )}
        </GlassCard>

        {/* Top Artists */}
        <GlassCard className="animate-fade-in">
          <h3 className="text-xs sm:text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
            <Users className="h-4 w-4 text-primary" />
            Top Artists
          </h3>
          {topArtists.length > 0 ? (
            <div className="space-y-2">
              {topArtists.map((artist, i) => (
                <div key={artist.name} className="flex items-center gap-3 p-2.5 rounded-lg bg-muted/20 hover:bg-muted/30 transition-colors">
                  <div className="h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold" style={{ background: CHART_COLORS[i % CHART_COLORS.length] + '33', color: CHART_COLORS[i % CHART_COLORS.length] }}>
                    {i + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs sm:text-sm font-medium text-foreground truncate">{artist.name}</p>
                    <p className="text-[10px] text-muted-foreground">{formatStreams(artist.streams)} streams</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground text-center py-12">No artist data</p>
          )}
        </GlassCard>

        {/* Release Submissions Trend */}
        <GlassCard className="animate-fade-in">
          <h3 className="text-xs sm:text-sm font-semibold text-foreground mb-3">Release Submissions (6 Mo)</h3>
          <div className="h-44 sm:h-52">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={monthlyReleases}>
                <defs>
                  <linearGradient id="releaseTrend" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(45, 80%, 45%)" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="hsl(45, 80%, 45%)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(0 0% 16%)" />
                <XAxis dataKey="month" tick={{ fill: 'hsl(0 0% 55%)', fontSize: 10 }} axisLine={{ stroke: 'hsl(0 0% 20%)' }} />
                <YAxis tick={{ fill: 'hsl(0 0% 55%)', fontSize: 10 }} width={30} axisLine={{ stroke: 'hsl(0 0% 20%)' }} />
                <Tooltip contentStyle={tooltipStyle} />
                <Area type="monotone" dataKey="count" stroke="hsl(45, 80%, 45%)" fill="url(#releaseTrend)" strokeWidth={2} name="Releases" dot={{ r: 3, fill: 'hsl(45, 80%, 45%)' }} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </GlassCard>
      </div>

      {/* Country Distribution - World Map */}
      {countryData.length > 0 && (
        <GlassCard className="mb-4 sm:mb-6 animate-fade-in">
          <h3 className="text-xs sm:text-sm font-semibold text-foreground mb-3 sm:mb-4 flex items-center gap-2">
            <Globe className="h-4 w-4 text-primary" />
            Streams by Country
          </h3>
          <WorldMapChart data={countryData} />
        </GlassCard>
      )}

      {/* Pending Requests Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4 mb-4 sm:mb-6">
        <PendingListCard title="Pending Releases" icon={Disc3} items={pendingReleases} emptyText="No pending releases" onViewAll={() => navigate('/admin/submissions')}
          renderItem={(r) => (
            <div key={r.id} className="flex items-center justify-between gap-2 p-2.5 sm:p-3 rounded-lg bg-muted/20 hover:bg-muted/30 transition-colors">
              <div className="min-w-0 flex-1">
                <p className="text-xs sm:text-sm font-medium text-foreground truncate">{getReleaseName(r)}</p>
                <p className="text-[10px] sm:text-xs text-muted-foreground capitalize">{r.content_type}</p>
              </div>
              <span className="text-[10px] sm:text-xs text-muted-foreground shrink-0">{format(new Date(r.created_at), 'dd MMM')}</span>
            </div>
          )}
        />
        <PendingListCard title="Pending Labels" icon={Tag} items={pendingLabels} emptyText="No pending labels" onViewAll={() => navigate('/admin/labels')}
          renderItem={(l) => (
            <div key={l.id} className="flex items-center justify-between gap-2 p-2.5 sm:p-3 rounded-lg bg-muted/20 hover:bg-muted/30 transition-colors">
              <div className="min-w-0 flex-1">
                <p className="text-xs sm:text-sm font-medium text-foreground truncate">{l.label_name}</p>
              </div>
              <span className="text-[10px] sm:text-xs text-muted-foreground shrink-0">{format(new Date(l.created_at), 'dd MMM')}</span>
            </div>
          )}
        />
        <PendingListCard title="Pending Content Requests" icon={MessageSquare} items={pendingContentRequests} emptyText="No pending requests" onViewAll={() => navigate('/admin/content-requests')}
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

      {/* Recent Releases */}
      <GlassCard className="animate-fade-in">
        <h3 className="text-xs sm:text-sm font-semibold text-foreground mb-3 sm:mb-4">Recent Releases</h3>
        {recentReleases.length > 0 ? (
          <>
            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/50">
                    <th className="text-left py-2 px-3 text-muted-foreground font-medium text-xs">Release</th>
                    <th className="text-left py-2 px-3 text-muted-foreground font-medium text-xs">Type</th>
                    <th className="text-left py-2 px-3 text-muted-foreground font-medium text-xs">Status</th>
                    <th className="text-left py-2 px-3 text-muted-foreground font-medium text-xs">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {recentReleases.map((r: any) => (
                    <tr key={r.id} className="border-b border-border/30 hover:bg-muted/20 transition-colors">
                      <td className="py-2.5 px-3 text-foreground font-medium truncate max-w-[200px]">{getReleaseName(r)}</td>
                      <td className="py-2.5 px-3 text-muted-foreground capitalize text-xs">{r.content_type}</td>
                      <td className="py-2.5 px-3"><StatusBadge status={r.status} /></td>
                      <td className="py-2.5 px-3 text-muted-foreground text-xs">{format(new Date(r.created_at), 'dd MMM yyyy')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="sm:hidden space-y-2">
              {recentReleases.map((r: any) => (
                <div key={r.id} className="p-3 rounded-lg bg-muted/20">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-foreground truncate">{getReleaseName(r)}</p>
                      <p className="text-xs text-muted-foreground capitalize">{r.content_type}</p>
                    </div>
                    <StatusBadge status={r.status} />
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-1.5">{format(new Date(r.created_at), 'dd MMM yyyy')}</p>
                </div>
              ))}
            </div>
          </>
        ) : (
          <p className="text-xs text-muted-foreground text-center py-8">No recent releases</p>
        )}
      </GlassCard>
    </DashboardLayout>
  );
}

function PendingListCard({ title, icon: Icon, items, emptyText, onViewAll, renderItem }: {
  title: string; icon: any; items: any[]; emptyText: string; onViewAll: () => void; renderItem: (item: any) => React.ReactNode;
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
