import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { NoticePopup } from '@/components/NoticePopup';
import { DashboardLayout } from '@/components/DashboardLayout';
import { StatCard } from '@/components/StatCard';
import { GlassCard } from '@/components/GlassCard';
import { StatusBadge } from '@/components/StatusBadge';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useImpersonate } from '@/hooks/useImpersonate';
import {
  Music, Clock, CheckCircle, XCircle, Loader2, Copy, X, BookOpen, ArrowRight,
  Disc3, Wallet, DollarSign, BarChart3
} from 'lucide-react';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { TutorialContent } from '@/components/TutorialContent';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, BarChart, Bar
} from 'recharts';
import { format } from 'date-fns';

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

export default function UserDashboard() {
  const { user } = useAuth();
  const { isImpersonating, impersonatedUserId, impersonatedEmail, stopImpersonating } = useImpersonate();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [displayId, setDisplayId] = useState<number | null>(null);

  const [songStats, setSongStats] = useState({ total: 0, pending: 0, approved: 0, rejected: 0 });
  const [releaseStats, setReleaseStats] = useState({ total: 0, pending: 0, approved: 0, rejected: 0 });
  const [totalRevenue, setTotalRevenue] = useState(0);
  const [totalStreams, setTotalStreams] = useState(0);
  const [monthlyRevenue, setMonthlyRevenue] = useState<{ month: string; revenue: number; streams: number }[]>([]);
  const [topTracks, setTopTracks] = useState<{ name: string; streams: number }[]>([]);
  const [topStores, setTopStores] = useState<{ name: string; value: number }[]>([]);
  const [recentSongs, setRecentSongs] = useState<any[]>([]);
  const [recentReleases, setRecentReleases] = useState<any[]>([]);
  const [withdrawalBalance, setWithdrawalBalance] = useState({ pending: 0, paid: 0 });

  const effectiveUserId = isImpersonating ? impersonatedUserId : user?.id;

  useEffect(() => {
    if (!effectiveUserId) return;
    fetchAll();
  }, [effectiveUserId]);

  async function fetchAll() {
    if (!effectiveUserId) return;

    const [songsRes, releasesRes, profileRes, reportRes, ytReportRes, withdrawalRes, recentRes, recentReleasesRes] = await Promise.all([
      supabase.from('songs').select('status').eq('user_id', effectiveUserId),
      supabase.from('releases').select('status').eq('user_id', effectiveUserId),
      supabase.from('profiles').select('display_id, hidden_cut_percent').eq('user_id', effectiveUserId).single(),
      supabase.from('report_entries').select('reporting_month, net_generated_revenue, streams, store, track'),
      supabase.from('youtube_report_entries').select('reporting_month, net_generated_revenue, streams'),
      supabase.from('withdrawal_requests').select('status, amount').eq('user_id', effectiveUserId),
      supabase.from('songs').select('id, title, artist, status, created_at').eq('user_id', effectiveUserId).order('created_at', { ascending: false }).limit(5),
      supabase.from('releases').select('id, album_name, ep_name, content_type, status, created_at').eq('user_id', effectiveUserId).order('created_at', { ascending: false }).limit(5),
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

    if (profileRes.data) {
      setDisplayId((profileRes.data as any).display_id);
    }

    const hiddenCut = profileRes.data ? Number((profileRes.data as any).hidden_cut_percent || 0) : 0;
    const cutMultiplier = (100 - hiddenCut) / 100;

    const allReports = [...(reportRes.data || []), ...(ytReportRes.data || [])];

    if (allReports.length > 0) {
      let totalRev = 0;
      let totalStr = 0;
      const monthMap: Record<string, { revenue: number; streams: number }> = {};
      const storeMap: Record<string, number> = {};
      const trackMap: Record<string, number> = {};

      allReports.forEach((r: any) => {
        const rev = Number(r.net_generated_revenue || 0) * cutMultiplier;
        const str = Number(r.streams || 0);
        totalRev += rev;
        totalStr += str;

        const month = r.reporting_month;
        if (!monthMap[month]) monthMap[month] = { revenue: 0, streams: 0 };
        monthMap[month].revenue += rev;
        monthMap[month].streams += str;

        if (r.store) storeMap[r.store] = (storeMap[r.store] || 0) + str;
        if (r.track) trackMap[r.track] = (trackMap[r.track] || 0) + str;
      });

      setTotalRevenue(Math.round(totalRev * 100) / 100);
      setTotalStreams(totalStr);

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
        Object.entries(storeMap).sort(([, a], [, b]) => b - a).slice(0, 5).map(([name, value]) => ({ name, value }))
      );

      setTopTracks(
        Object.entries(trackMap).sort(([, a], [, b]) => b - a).slice(0, 5)
          .map(([name, streams]) => ({ name: name.length > 20 ? name.substring(0, 20) + '…' : name, streams }))
      );
    }

    if (withdrawalRes.data) {
      const d = withdrawalRes.data;
      setWithdrawalBalance({
        pending: d.filter(w => w.status === 'pending').reduce((acc, w) => acc + Number(w.amount), 0),
        paid: d.filter(w => w.status === 'paid').reduce((acc, w) => acc + Number(w.amount), 0),
      });
    }

    setRecentSongs(recentRes.data || []);
    setRecentReleases(recentReleasesRes.data || []);
    setLoading(false);
  }

  const copyUserId = () => {
    if (displayId) {
      navigator.clipboard.writeText(`#${displayId}`);
      toast.success('User ID copied!');
    }
  };

  const handleStopImpersonating = () => {
    stopImpersonating();
    navigate('/admin/users');
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

  const songStatusData = [
    { name: 'Pending', value: songStats.pending, color: CHART_COLORS[1] },
    { name: 'Approved', value: songStats.approved, color: CHART_COLORS[2] },
    { name: 'Rejected', value: songStats.rejected, color: CHART_COLORS[0] },
  ].filter(d => d.value > 0);

  const pendingSongs = recentSongs.filter(s => s.status === 'pending');
  const pendingReleases = recentReleases.filter(r => r.status === 'pending');

  return (
    <DashboardLayout>
      {isImpersonating && (
        <div className="mb-4 sm:mb-6 p-3 sm:p-4 rounded-xl bg-blue-500/15 border border-blue-500/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 animate-fade-in">
          <div className="min-w-0">
            <p className="text-xs sm:text-sm font-medium text-blue-400">Viewing as user</p>
            <p className="text-[10px] sm:text-xs text-blue-300/70 break-all">{impersonatedEmail}</p>
          </div>
          <button
            onClick={handleStopImpersonating}
            className="flex w-full sm:w-auto items-center justify-center gap-2 px-3 sm:px-4 py-2 rounded-lg bg-blue-500/20 text-blue-400 text-xs sm:text-sm font-medium hover:bg-blue-500/30 transition-all"
          >
            <X className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            Back to Admin
          </button>
        </div>
      )}

      <div className="mb-4 sm:mb-6 lg:mb-8">
        <h1 className="text-xl sm:text-2xl lg:text-3xl font-display font-bold text-foreground">Dashboard</h1>
        <p className="text-muted-foreground mt-1 text-xs sm:text-sm lg:text-base">Welcome back! Here's your overview.</p>
      </div>

      {displayId && (
        <GlassCard className="mb-4 sm:mb-6 !p-3 sm:!p-4 animate-fade-in">
          <div className="flex items-center justify-between">
            <div className="min-w-0">
              <p className="text-[10px] sm:text-xs text-muted-foreground">Your User ID</p>
              <p className="font-mono text-base sm:text-lg font-bold text-foreground mt-0.5">#{displayId}</p>
            </div>
            <button
              onClick={copyUserId}
              className="p-1.5 sm:p-2 rounded-lg hover:bg-muted/50 text-muted-foreground hover:text-foreground transition-all"
              title="Copy ID"
            >
              <Copy className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            </button>
          </div>
        </GlassCard>
      )}

      {/* Top Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-2 sm:gap-3 lg:gap-4 mb-4 sm:mb-6">
        <StatCard title="Total Songs" value={songStats.total} icon={Music} />
        <StatCard title="Pending" value={songStats.pending} icon={Clock} color="hsla(45, 80%, 40%, 0.3)" />
        <StatCard title="Approved" value={songStats.approved} icon={CheckCircle} color="hsla(140, 60%, 30%, 0.3)" />
        <StatCard title="Releases" value={releaseStats.total} icon={Disc3} color="hsla(280, 60%, 40%, 0.3)" />
        <StatCard title="Total Streams" value={totalStreams} icon={BarChart3} color="hsla(200, 70%, 40%, 0.3)" />
        <StatCard title="Revenue" value={totalRevenue} icon={DollarSign} color="hsla(140, 60%, 35%, 0.3)" />
      </div>

      {/* Pending Songs & Releases */}
      {(pendingSongs.length > 0 || pendingReleases.length > 0) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4 mb-4 sm:mb-6">
          {pendingSongs.length > 0 && (
            <GlassCard className="animate-fade-in">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-xs sm:text-sm font-semibold text-foreground flex items-center gap-2">
                  <Music className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-primary" />
                  Pending Songs
                  <span className="ml-1 inline-flex items-center justify-center h-4 sm:h-5 min-w-[16px] sm:min-w-[20px] px-1 rounded-full text-[10px] sm:text-xs font-bold bg-primary/20 text-primary">
                    {pendingSongs.length}
                  </span>
                </h3>
                <button onClick={() => navigate('/my-songs')} className="text-[10px] sm:text-xs text-primary hover:underline flex items-center gap-1">
                  View All <ArrowRight className="h-2.5 w-2.5 sm:h-3 sm:w-3" />
                </button>
              </div>
              <div className="space-y-1.5 sm:space-y-2">
                {pendingSongs.map(s => (
                  <div key={s.id} className="flex items-center justify-between gap-2 p-2.5 sm:p-3 rounded-lg bg-muted/20">
                    <div className="min-w-0 flex-1">
                      <p className="text-xs sm:text-sm font-medium text-foreground truncate">{s.title}</p>
                      <p className="text-[10px] sm:text-xs text-muted-foreground truncate">{s.artist}</p>
                    </div>
                    <span className="text-[10px] sm:text-xs text-muted-foreground shrink-0">{format(new Date(s.created_at), 'dd MMM')}</span>
                  </div>
                ))}
              </div>
            </GlassCard>
          )}

          {pendingReleases.length > 0 && (
            <GlassCard className="animate-fade-in">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-xs sm:text-sm font-semibold text-foreground flex items-center gap-2">
                  <Disc3 className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-primary" />
                  Pending Releases
                  <span className="ml-1 inline-flex items-center justify-center h-4 sm:h-5 min-w-[16px] sm:min-w-[20px] px-1 rounded-full text-[10px] sm:text-xs font-bold bg-primary/20 text-primary">
                    {pendingReleases.length}
                  </span>
                </h3>
                <button onClick={() => navigate('/my-releases')} className="text-[10px] sm:text-xs text-primary hover:underline flex items-center gap-1">
                  View All <ArrowRight className="h-2.5 w-2.5 sm:h-3 sm:w-3" />
                </button>
              </div>
              <div className="space-y-1.5 sm:space-y-2">
                {pendingReleases.map(r => (
                  <div key={r.id} className="flex items-center justify-between gap-2 p-2.5 sm:p-3 rounded-lg bg-muted/20">
                    <div className="min-w-0 flex-1">
                      <p className="text-xs sm:text-sm font-medium text-foreground truncate">{r.album_name || r.ep_name || 'Untitled'}</p>
                      <p className="text-[10px] sm:text-xs text-muted-foreground">{r.content_type}</p>
                    </div>
                    <span className="text-[10px] sm:text-xs text-muted-foreground shrink-0">{format(new Date(r.created_at), 'dd MMM')}</span>
                  </div>
                ))}
              </div>
            </GlassCard>
          )}
        </div>
      )}

      {/* Revenue Trend + Song Status */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 sm:gap-4 mb-4 sm:mb-6">
        <GlassCard className="lg:col-span-2 animate-fade-in">
          <h3 className="text-xs sm:text-sm font-semibold text-foreground mb-3 sm:mb-4">Revenue Trend</h3>
          {monthlyRevenue.length > 0 ? (
            <div className="h-44 sm:h-56">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={monthlyRevenue}>
                  <defs>
                    <linearGradient id="userRevenueGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(0, 67%, 35%)" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="hsl(0, 67%, 35%)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(0 0% 20%)" />
                  <XAxis dataKey="month" tick={{ fill: 'hsl(0 0% 55%)', fontSize: 10 }} />
                  <YAxis tick={{ fill: 'hsl(0 0% 55%)', fontSize: 10 }} width={45} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Area type="monotone" dataKey="revenue" stroke="hsl(0, 67%, 40%)" fill="url(#userRevenueGrad)" strokeWidth={2} name="Revenue (₹)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground text-center py-16 sm:py-20">No revenue data yet</p>
          )}
        </GlassCard>

        <GlassCard className="animate-fade-in">
          <h3 className="text-xs sm:text-sm font-semibold text-foreground mb-3 sm:mb-4">Song Status</h3>
          {songStatusData.length > 0 ? (
            <>
              <div className="h-36 sm:h-44">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={songStatusData} cx="50%" cy="50%" innerRadius={35} outerRadius={55} dataKey="value" strokeWidth={0}>
                      {songStatusData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                    </Pie>
                    <Tooltip contentStyle={tooltipStyle} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="flex flex-wrap justify-center gap-2 sm:gap-3 mt-1">
                {songStatusData.map(d => (
                  <div key={d.name} className="flex items-center gap-1 text-[10px] sm:text-xs">
                    <div className="h-2 w-2 rounded-full" style={{ background: d.color }} />
                    <span className="text-muted-foreground">{d.name}: {d.value}</span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <p className="text-xs text-muted-foreground text-center py-12 sm:py-16">No songs yet</p>
          )}
        </GlassCard>
      </div>

      {/* Top Tracks + Top Stores */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4 mb-4 sm:mb-6">
        {topTracks.length > 0 && (
          <GlassCard className="animate-fade-in">
            <h3 className="text-xs sm:text-sm font-semibold text-foreground mb-3 sm:mb-4">Top Tracks by Streams</h3>
            <div className="h-44 sm:h-52">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={topTracks} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(0 0% 20%)" />
                  <XAxis type="number" tick={{ fill: 'hsl(0 0% 55%)', fontSize: 10 }} />
                  <YAxis dataKey="name" type="category" tick={{ fill: 'hsl(0 0% 55%)', fontSize: 9 }} width={90} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Bar dataKey="streams" fill="hsl(0, 67%, 35%)" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </GlassCard>
        )}

        {topStores.length > 0 && (
          <GlassCard className="animate-fade-in">
            <h3 className="text-xs sm:text-sm font-semibold text-foreground mb-3 sm:mb-4">Streams by Platform</h3>
            <div className="h-44 sm:h-52">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={topStores}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(0 0% 20%)" />
                  <XAxis dataKey="name" tick={{ fill: 'hsl(0 0% 55%)', fontSize: 9 }} />
                  <YAxis tick={{ fill: 'hsl(0 0% 55%)', fontSize: 10 }} width={40} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                    {topStores.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </GlassCard>
        )}
      </div>

      {/* Withdrawal Summary + Recent Songs */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 sm:gap-4 mb-4 sm:mb-6">
        <GlassCard className="animate-fade-in">
          <h3 className="text-xs sm:text-sm font-semibold text-foreground mb-3 sm:mb-4">Withdrawal Summary</h3>
          <div className="space-y-2 sm:space-y-3">
            <div className="p-2.5 sm:p-3 rounded-lg bg-muted/30">
              <p className="text-[10px] sm:text-xs text-muted-foreground">Available Revenue</p>
              <p className="text-lg sm:text-xl font-bold text-foreground mt-1">₹{(totalRevenue - withdrawalBalance.pending - withdrawalBalance.paid).toLocaleString()}</p>
            </div>
            <div className="flex gap-2 sm:gap-3">
              <div className="flex-1 p-2.5 sm:p-3 rounded-lg bg-muted/30">
                <p className="text-[10px] sm:text-xs text-muted-foreground">Pending</p>
                <p className="text-xs sm:text-sm font-bold text-foreground mt-1">₹{withdrawalBalance.pending.toLocaleString()}</p>
              </div>
              <div className="flex-1 p-2.5 sm:p-3 rounded-lg bg-muted/30">
                <p className="text-[10px] sm:text-xs text-muted-foreground">Paid</p>
                <p className="text-xs sm:text-sm font-bold text-foreground mt-1">₹{withdrawalBalance.paid.toLocaleString()}</p>
              </div>
            </div>
          </div>
        </GlassCard>

        <GlassCard className="lg:col-span-2 animate-fade-in">
          <h3 className="text-xs sm:text-sm font-semibold text-foreground mb-3 sm:mb-4">Recent Submissions</h3>
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
                        <td className="py-2.5 px-3 text-foreground font-medium truncate max-w-[180px]">{s.title}</td>
                        <td className="py-2.5 px-3 text-muted-foreground truncate max-w-[120px]">{s.artist}</td>
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
                  <div key={s.id} className="p-2.5 rounded-lg bg-muted/20">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-medium text-foreground truncate">{s.title}</p>
                        <p className="text-[10px] text-muted-foreground truncate">{s.artist}</p>
                      </div>
                      <StatusBadge status={s.status} />
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-1">{format(new Date(s.created_at), 'dd MMM yyyy')}</p>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <p className="text-xs text-muted-foreground text-center py-6 sm:py-8">No submissions yet</p>
          )}
        </GlassCard>
      </div>

      <RecentTutorialsWidget />
      <NoticePopup />
    </DashboardLayout>
  );
}

function RecentTutorialsWidget() {
  const navigate = useNavigate();
  const [viewTutorial, setViewTutorial] = useState<any>(null);

  const { data: tutorials = [], isLoading } = useQuery({
    queryKey: ['recent-tutorials'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tutorials')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(3);
      if (error) throw error;
      return data;
    },
  });

  if (isLoading || tutorials.length === 0) return null;

  const stripHtml = (html: string) => {
    const tmp = document.createElement('div');
    tmp.innerHTML = html;
    return tmp.textContent || tmp.innerText || '';
  };

  return (
    <>
      <div className="mt-4 sm:mt-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm sm:text-lg font-semibold flex items-center gap-2">
            <BookOpen className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
            Help Tutorials
          </h2>
          <button
            onClick={() => navigate('/help-tutorials')}
            className="text-[10px] sm:text-xs text-primary hover:underline flex items-center gap-1"
          >
            View All <ArrowRight className="h-2.5 w-2.5 sm:h-3 sm:w-3" />
          </button>
        </div>
        <div className="grid gap-2 sm:gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
          {tutorials.map((t: any) => (
            <GlassCard
              key={t.id}
              className="!p-3 sm:!p-4 cursor-pointer hover:ring-1 hover:ring-primary/30 transition-all"
              onClick={() => setViewTutorial(t)}
            >
              <h3 className="font-medium text-xs sm:text-sm line-clamp-1">{t.subject}</h3>
              <p className="text-[10px] sm:text-xs text-muted-foreground mt-1 line-clamp-2">{stripHtml(t.content)}</p>
              <span className="text-[10px] sm:text-xs text-primary mt-2 inline-block">Read →</span>
            </GlassCard>
          ))}
        </div>
      </div>

      <Dialog open={!!viewTutorial} onOpenChange={(open) => !open && setViewTutorial(null)}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{viewTutorial?.subject}</DialogTitle>
          </DialogHeader>
          <TutorialContent html={viewTutorial?.content || ''} />
        </DialogContent>
      </Dialog>
    </>
  );
}
