import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { WorldMapChart } from '@/components/WorldMapChart';
import { useQuery } from '@tanstack/react-query';
import { NoticePopup } from '@/components/NoticePopup';
import { DashboardLayout } from '@/components/DashboardLayout';
import { GlassCard } from '@/components/GlassCard';
import { StatusBadge } from '@/components/StatusBadge';
import { supabase } from '@/integrations/supabase/client';
import { formatStreams, formatRevenue } from '@/lib/formatNumbers';
import { applySnapshotCut, calculateAvailableBalance, getEffectiveRevenueCutPercent, shouldApplyRevenueCut, summarizeWithdrawals } from '@/lib/revenueCalculations';
import { useAuth } from '@/hooks/useAuth';
import { useImpersonate } from '@/hooks/useImpersonate';
import {
  Clock, CheckCircle, XCircle, Loader2, Copy, X, BookOpen, ArrowRight,
  Disc3, Wallet, DollarSign, BarChart3, Music, TrendingUp, TrendingDown,
  Activity, Globe, Headphones
} from 'lucide-react';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { TutorialContent } from '@/components/TutorialContent';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, BarChart, Bar, Legend
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

export default function UserDashboard() {
  const { user, role } = useAuth();
  const { isImpersonating, impersonatedUserId, impersonatedEmail, stopImpersonating } = useImpersonate();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [displayId, setDisplayId] = useState<number | null>(null);

  const [releaseStats, setReleaseStats] = useState({ total: 0, pending: 0, approved: 0, rejected: 0 });
  const [totalRevenue, setTotalRevenue] = useState(0);
  const [totalStreams, setTotalStreams] = useState(0);
  const [totalDownloads, setTotalDownloads] = useState(0);
  const [monthlyRevenue, setMonthlyRevenue] = useState<{ month: string; revenue: number; streams: number }[]>([]);
  const [topTracks, setTopTracks] = useState<{ name: string; streams: number }[]>([]);
  const [topStores, setTopStores] = useState<{ name: string; value: number; color: string }[]>([]);
  const [countryData, setCountryData] = useState<{ name: string; streams: number }[]>([]);
  const [recentReleases, setRecentReleases] = useState<any[]>([]);
  const [withdrawalBalance, setWithdrawalBalance] = useState({ pending: 0, paid: 0 });
  const [hiddenCut, setHiddenCut] = useState(0);
  const [subLabelCut, setSubLabelCut] = useState(0);
  const [isSubLabelUser, setIsSubLabelUser] = useState(false);
  const refreshTimeoutRef = useRef<number | null>(null);
  const isFetchingRef = useRef(false);
  const shouldRefetchRef = useRef(false);

  const effectiveUserId = isImpersonating ? impersonatedUserId : user?.id;
  const effectiveCut = getEffectiveRevenueCutPercent({ hiddenCut, subLabelCut, isSubLabel: isSubLabelUser });
  const netRevenue = totalRevenue; // totalRevenue is now already net (computed per-row with snapshots)
  const availableRevenue = Math.max(calculateAvailableBalance(netRevenue, withdrawalBalance.paid, withdrawalBalance.pending), 0);

  const fetchAll = useCallback(async () => {
    if (!effectiveUserId) return;
    if (isFetchingRef.current) {
      shouldRefetchRef.current = true;
      return;
    }

    isFetchingRef.current = true;

    try {
      const [releasesRes, profileRes, subLabelRes, withdrawalRes, recentReleasesRes] = await Promise.all([
        supabase.from('releases').select('status').eq('user_id', effectiveUserId),
        supabase.from('profiles').select('display_id, hidden_cut_percent').eq('user_id', effectiveUserId).single(),
        supabase.from('sub_labels').select('percentage_cut, parent_user_id').eq('sub_user_id', effectiveUserId).maybeSingle(),
        supabase.from('withdrawal_requests').select('status, amount').eq('user_id', effectiveUserId),
        supabase.from('releases').select('id, album_name, ep_name, content_type, status, created_at, poster_url').eq('user_id', effectiveUserId).order('created_at', { ascending: false }).limit(5),
      ]);

      if (releasesRes.data) {
        const d = releasesRes.data;
        setReleaseStats({
          total: d.length,
          pending: d.filter((s) => s.status === 'pending').length,
          approved: d.filter((s) => s.status === 'approved').length,
          rejected: d.filter((s) => s.status === 'rejected').length,
        });
      }

      setDisplayId(profileRes.data ? (profileRes.data as any).display_id : null);

      const hasSubLabel = Boolean(subLabelRes.data);
      const subLabelCutPercent = Number(subLabelRes.data?.percentage_cut || 0);

      // For sub-labels, fetch PARENT's hidden cut for stacked calculation
      let hiddenCutPercent = profileRes.data ? Number((profileRes.data as any).hidden_cut_percent || 0) : 0;
      if (hasSubLabel && subLabelRes.data?.parent_user_id) {
        const { data: parentProfile } = await supabase
          .from('profiles')
          .select('hidden_cut_percent')
          .eq('user_id', subLabelRes.data.parent_user_id)
          .maybeSingle();
        hiddenCutPercent = Number(parentProfile?.hidden_cut_percent || 0);
      }

      const effectiveCutPercent = getEffectiveRevenueCutPercent({
        hiddenCut: hiddenCutPercent,
        subLabelCut: subLabelCutPercent,
        isSubLabel: hasSubLabel,
      });
      const shouldApplyCut = shouldApplyRevenueCut({ role, currentUserId: user?.id, activeUserId: effectiveUserId });

      setHiddenCut(hiddenCutPercent);
      setSubLabelCut(subLabelCutPercent);
      setIsSubLabelUser(hasSubLabel);

      let reportData: any[] = [];
      let ytReportData: any[] = [];

      if (role === 'admin' && isImpersonating && impersonatedUserId) {
        const { data: subLabels } = await supabase
          .from('sub_labels')
          .select('sub_user_id')
          .eq('parent_user_id', effectiveUserId)
          .eq('status', 'active');

        const subUserIds = (subLabels || []).map((sl) => sl.sub_user_id).filter(Boolean) as string[];
        const allUserIds = [effectiveUserId, ...subUserIds];

        const [{ data: trackRows }, { data: songRows }] = await Promise.all([
          supabase.from('tracks').select('isrc').in('user_id', allUserIds),
          supabase.from('songs').select('isrc').in('user_id', allUserIds),
        ]);

        const ownedIsrcs = [...new Set(
          [...(trackRows ?? []), ...(songRows ?? [])]
            .map((row) => (row.isrc || '').trim().toUpperCase())
            .filter(Boolean),
        )];

        if (ownedIsrcs.length > 0) {
          const [{ data: ottData }, { data: ytData }] = await Promise.all([
            supabase.from('report_entries').select('reporting_month, net_generated_revenue, streams, downloads, store, track, country, cut_percent_snapshot, revenue_frozen').in('isrc', ownedIsrcs),
            supabase.from('youtube_report_entries').select('reporting_month, net_generated_revenue, streams, downloads, store, track, country, cut_percent_snapshot, revenue_frozen').in('isrc', ownedIsrcs),
          ]);
          reportData = ottData || [];
          ytReportData = ytData || [];
        }
      } else {
        const [reportRes, ytReportRes] = await Promise.all([
          supabase.from('report_entries').select('reporting_month, net_generated_revenue, streams, downloads, store, track, country, cut_percent_snapshot').eq('user_id', effectiveUserId),
          supabase.from('youtube_report_entries').select('reporting_month, net_generated_revenue, streams, downloads, store, track, country, cut_percent_snapshot').eq('user_id', effectiveUserId),
        ]);
        reportData = reportRes.data || [];
        ytReportData = ytReportRes.data || [];
      }

      const allReports = [...reportData, ...ytReportData];

      if (allReports.length > 0) {
        let totalRev = 0;
        let totalStr = 0;
        let totalDl = 0;
        const monthMap: Record<string, { revenue: number; streams: number }> = {};
        const storeMap: Record<string, number> = {};
        const trackMap: Record<string, number> = {};
        const countryMap: Record<string, number> = {};

        allReports.forEach((r: any) => {
          const grossRevenue = Number(r.net_generated_revenue || 0);
          const rev = applySnapshotCut(grossRevenue, r.cut_percent_snapshot, effectiveCutPercent, shouldApplyCut);
          const str = Number(r.streams || 0);
          const dl = Number(r.downloads || 0);
          totalRev += rev;
          totalStr += str;
          totalDl += dl;

          const month = r.reporting_month;
          if (!monthMap[month]) monthMap[month] = { revenue: 0, streams: 0 };
          monthMap[month].revenue += rev;
          monthMap[month].streams += str;

          if (r.store) storeMap[r.store] = (storeMap[r.store] || 0) + str;
          if (r.track) trackMap[r.track] = (trackMap[r.track] || 0) + str;
          if (r.country) countryMap[r.country] = (countryMap[r.country] || 0) + str;
        });

        setTotalRevenue(Math.round(totalRev * 100) / 100);
        setTotalStreams(totalStr);
        setTotalDownloads(totalDl);

        setMonthlyRevenue(
          Object.entries(monthMap)
            .sort(([a], [b]) => a.localeCompare(b))
            .slice(-8)
            .map(([month, data]) => ({
              month: month.length > 7 ? month.substring(0, 7) : month,
              revenue: Math.round(data.revenue * 100) / 100,
              streams: data.streams,
            })),
        );

        setTopStores(
          Object.entries(storeMap)
            .sort(([, a], [, b]) => b - a)
            .slice(0, 6)
            .map(([name, value]) => ({ name, value, color: STORE_COLORS[name] || CHART_COLORS[0] })),
        );

        setTopTracks(
          Object.entries(trackMap)
            .sort(([, a], [, b]) => b - a)
            .slice(0, 5)
            .map(([name, streams]) => ({ name: name.length > 22 ? `${name.substring(0, 22)}…` : name, streams })),
        );

        setCountryData(
          Object.entries(countryMap)
            .sort(([, a], [, b]) => b - a)
            .slice(0, 6)
            .map(([name, streams]) => ({ name, streams })),
        );
      } else {
        setTotalRevenue(0);
        setTotalStreams(0);
        setTotalDownloads(0);
        setMonthlyRevenue([]);
        setTopStores([]);
        setTopTracks([]);
        setCountryData([]);
      }

      if (withdrawalRes.data) {
        setWithdrawalBalance(summarizeWithdrawals(withdrawalRes.data));
      }

      setRecentReleases(recentReleasesRes.data || []);
    } catch (error) {
      console.error('Failed to load dashboard', error);
      toast.error('Failed to load dashboard data. Please refresh and try again.');
    } finally {
      setLoading(false);
      isFetchingRef.current = false;

      if (shouldRefetchRef.current) {
        shouldRefetchRef.current = false;
        void fetchAll();
      }
    }
  }, [effectiveUserId, impersonatedUserId, isImpersonating, role, user?.id]);

  const scheduleFetchAll = useCallback(() => {
    if (refreshTimeoutRef.current !== null) {
      window.clearTimeout(refreshTimeoutRef.current);
    }

    refreshTimeoutRef.current = window.setTimeout(() => {
      refreshTimeoutRef.current = null;
      void fetchAll();
    }, 250);
  }, [fetchAll]);

  useEffect(() => {
    if (!effectiveUserId) return;

    setLoading(true);
    void fetchAll();

    const channel = supabase
      .channel(`dashboard-realtime-${effectiveUserId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'report_entries' }, scheduleFetchAll)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'youtube_report_entries' }, scheduleFetchAll)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'withdrawal_requests' }, scheduleFetchAll)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'releases' }, scheduleFetchAll)
      .subscribe();

    return () => {
      if (refreshTimeoutRef.current !== null) {
        window.clearTimeout(refreshTimeoutRef.current);
        refreshTimeoutRef.current = null;
      }

      supabase.removeChannel(channel);
    };
  }, [effectiveUserId, fetchAll, scheduleFetchAll]);

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

  const releaseStatusData = useMemo(
    () =>
      [
        { name: 'Pending', value: releaseStats.pending, color: CHART_COLORS[1] },
        { name: 'Approved', value: releaseStats.approved, color: CHART_COLORS[2] },
        { name: 'Rejected', value: releaseStats.rejected, color: CHART_COLORS[0] },
      ].filter((d) => d.value > 0),
    [releaseStats],
  );

  const pendingReleases = useMemo(() => recentReleases.filter((r) => r.status === 'pending'), [recentReleases]);

  const totalStoreStreams = useMemo(() => topStores.reduce((a, b) => a + b.value, 0), [topStores]);

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    );
  }

  const getReleaseName = (r: any) => {
    if (r.content_type === 'album') return r.album_name || 'Untitled Album';
    if (r.content_type === 'ep') return r.ep_name || 'Untitled EP';
    return r.album_name || r.ep_name || 'Untitled Single';
  };

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

      <div className="mb-4 sm:mb-6 lg:mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl lg:text-3xl font-display font-bold text-foreground">Dashboard</h1>
          <p className="text-muted-foreground mt-1 text-xs sm:text-sm lg:text-base">Welcome back! Here's your overview.</p>
        </div>
        {displayId && (
          <button
            onClick={copyUserId}
            className="flex items-center gap-2 px-3 py-2 rounded-xl glass hover:ring-1 hover:ring-primary/30 transition-all group"
            title="Copy User ID"
          >
            <span className="font-mono text-sm sm:text-base font-bold text-foreground">#{displayId}</span>
            <Copy className="h-3.5 w-3.5 text-muted-foreground group-hover:text-foreground transition-colors" />
          </button>
        )}
      </div>

      {/* Financial Overview */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3 mb-4 sm:mb-6">
        <GlassCard className="!p-3 sm:!p-4 animate-fade-in border-l-4" style={{ borderLeftColor: 'hsl(140, 60%, 40%)' }}>
          <div className="flex items-center gap-2 mb-1.5">
            <DollarSign className="h-4 w-4 text-emerald-400" />
            <span className="text-[10px] sm:text-xs text-muted-foreground uppercase tracking-wider font-medium">Available</span>
          </div>
          <p className="text-lg sm:text-xl lg:text-2xl font-bold text-foreground whitespace-nowrap">{formatRevenue(availableRevenue)}</p>
        </GlassCard>
        <GlassCard className="!p-3 sm:!p-4 animate-fade-in border-l-4" style={{ borderLeftColor: 'hsl(45, 80%, 45%)' }}>
          <div className="flex items-center gap-2 mb-1.5">
            <Clock className="h-4 w-4 text-yellow-400" />
            <span className="text-[10px] sm:text-xs text-muted-foreground uppercase tracking-wider font-medium">Pending</span>
          </div>
          <p className="text-lg sm:text-xl lg:text-2xl font-bold text-foreground whitespace-nowrap">{formatRevenue(withdrawalBalance.pending)}</p>
        </GlassCard>
        <GlassCard className="!p-3 sm:!p-4 animate-fade-in border-l-4" style={{ borderLeftColor: 'hsl(200, 70%, 50%)' }}>
          <div className="flex items-center gap-2 mb-1.5">
            <Wallet className="h-4 w-4 text-blue-400" />
            <span className="text-[10px] sm:text-xs text-muted-foreground uppercase tracking-wider font-medium">Paid</span>
          </div>
          <p className="text-lg sm:text-xl lg:text-2xl font-bold text-foreground whitespace-nowrap">{formatRevenue(withdrawalBalance.paid)}</p>
        </GlassCard>
        <GlassCard className="!p-3 sm:!p-4 animate-fade-in border-l-4" style={{ borderLeftColor: 'hsl(0, 67%, 35%)' }}>
          <div className="flex items-center gap-2 mb-1.5">
            <TrendingUp className="h-4 w-4 text-primary" />
            <span className="text-[10px] sm:text-xs text-muted-foreground uppercase tracking-wider font-medium">Net Revenue</span>
          </div>
          <p className="text-lg sm:text-xl lg:text-2xl font-bold text-foreground whitespace-nowrap">{formatRevenue(netRevenue)}</p>
        </GlassCard>
      </div>

      {/* KPI Stats Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3 mb-4 sm:mb-6">
        <GlassCard className="!p-3 sm:!p-4 animate-fade-in group hover:scale-[1.02] transition-transform duration-200">
          <div className="flex items-center gap-2 mb-1">
            <Disc3 className="h-4 w-4 text-primary" />
            <span className="text-[10px] sm:text-xs text-muted-foreground">Releases</span>
          </div>
          <p className="text-lg sm:text-xl font-bold text-foreground">{releaseStats.total}</p>
          <div className="flex gap-2 mt-1.5">
            <span className="text-[10px] text-emerald-400">{releaseStats.approved} approved</span>
            <span className="text-[10px] text-yellow-400">{releaseStats.pending} pending</span>
          </div>
        </GlassCard>
        <GlassCard className="!p-3 sm:!p-4 animate-fade-in group hover:scale-[1.02] transition-transform duration-200">
          <div className="flex items-center gap-2 mb-1">
            <Headphones className="h-4 w-4 text-blue-400" />
            <span className="text-[10px] sm:text-xs text-muted-foreground">Total Streams</span>
          </div>
          <p className="text-lg sm:text-xl font-bold text-foreground">{formatStreams(totalStreams)}</p>
        </GlassCard>
        <GlassCard className="!p-3 sm:!p-4 animate-fade-in group hover:scale-[1.02] transition-transform duration-200">
          <div className="flex items-center gap-2 mb-1">
            <BarChart3 className="h-4 w-4 text-purple-400" />
            <span className="text-[10px] sm:text-xs text-muted-foreground">Downloads</span>
          </div>
          <p className="text-lg sm:text-xl font-bold text-foreground">{formatStreams(totalDownloads)}</p>
        </GlassCard>
        <GlassCard className="!p-3 sm:!p-4 animate-fade-in group hover:scale-[1.02] transition-transform duration-200">
          <div className="flex items-center gap-2 mb-1">
            <Music className="h-4 w-4 text-orange-400" />
            <span className="text-[10px] sm:text-xs text-muted-foreground">Top Platforms</span>
          </div>
          <p className="text-lg sm:text-xl font-bold text-foreground">{topStores.length}</p>
        </GlassCard>
      </div>

      {/* Pending Releases */}
      {pendingReleases.length > 0 && (
        <GlassCard className="mb-4 sm:mb-6 animate-fade-in">
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
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-1.5 sm:gap-2">
            {pendingReleases.map(r => (
              <div key={r.id} className="flex items-center justify-between gap-2 p-2.5 sm:p-3 rounded-lg bg-muted/20">
                <div className="min-w-0 flex-1">
                  <p className="text-xs sm:text-sm font-medium text-foreground truncate">{getReleaseName(r)}</p>
                  <p className="text-[10px] sm:text-xs text-muted-foreground capitalize">{r.content_type}</p>
                </div>
                <span className="text-[10px] sm:text-xs text-muted-foreground shrink-0">{format(new Date(r.created_at), 'dd MMM')}</span>
              </div>
            ))}
          </div>
        </GlassCard>
      )}

      {/* Revenue & Streams Dual Chart */}
      <GlassCard className="mb-4 sm:mb-6 animate-fade-in">
        <h3 className="text-sm sm:text-base font-semibold text-foreground mb-4 flex items-center gap-2">
          <Activity className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
          Revenue & Streams Trend
        </h3>
        {monthlyRevenue.length > 0 ? (
          <div className="h-52 sm:h-64">
            <ResponsiveContainer width="100%" height="100%" debounce={200}>
              <AreaChart data={monthlyRevenue}>
                <defs>
                  <linearGradient id="userRevenueGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(0, 67%, 35%)" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="hsl(0, 67%, 35%)" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="userStreamsGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(200, 70%, 50%)" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="hsl(200, 70%, 50%)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(0 0% 16%)" />
                <XAxis dataKey="month" tick={{ fill: 'hsl(0 0% 55%)', fontSize: 10 }} axisLine={{ stroke: 'hsl(0 0% 20%)' }} />
                <YAxis yAxisId="left" tick={{ fill: 'hsl(0 0% 55%)', fontSize: 10 }} width={50} axisLine={{ stroke: 'hsl(0 0% 20%)' }} />
                <YAxis yAxisId="right" orientation="right" tick={{ fill: 'hsl(0 0% 55%)', fontSize: 10 }} width={50} axisLine={{ stroke: 'hsl(0 0% 20%)' }} />
                <Tooltip contentStyle={tooltipStyle} />
                <Legend wrapperStyle={{ fontSize: '11px', color: 'hsl(0 0% 60%)' }} />
                <Area yAxisId="left" type="monotone" dataKey="revenue" stroke="hsl(0, 67%, 40%)" fill="url(#userRevenueGrad)" strokeWidth={2.5} name="Revenue (₹)" dot={{ r: 3, fill: 'hsl(0, 67%, 40%)' }} isAnimationActive={false} />
                <Area yAxisId="right" type="monotone" dataKey="streams" stroke="hsl(200, 70%, 50%)" fill="url(#userStreamsGrad)" strokeWidth={2} name="Streams" dot={{ r: 2.5, fill: 'hsl(200, 70%, 50%)' }} isAnimationActive={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground text-center py-16">No revenue data yet</p>
        )}
      </GlassCard>

      {/* Release Status Donut + Platform Distribution */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4 mb-4 sm:mb-6">
        <GlassCard className="animate-fade-in">
          <h3 className="text-xs sm:text-sm font-semibold text-foreground mb-3">Release Status</h3>
          {releaseStatusData.length > 0 ? (
            <>
              <div className="h-44 sm:h-52 relative">
                <ResponsiveContainer width="100%" height="100%" debounce={200}>
                  <PieChart>
                    <Pie data={releaseStatusData} cx="50%" cy="50%" innerRadius={42} outerRadius={65} dataKey="value" strokeWidth={0} paddingAngle={3} isAnimationActive={false}>
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
            <p className="text-xs text-muted-foreground text-center py-16">No releases yet</p>
          )}
        </GlassCard>

        {/* Platform Distribution */}
        <GlassCard className="animate-fade-in">
          <h3 className="text-xs sm:text-sm font-semibold text-foreground mb-3">Platform Distribution</h3>
          {topStores.length > 0 ? (
            <div className="space-y-2.5 sm:space-y-3">
              {topStores.map((store) => {
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
          ) : (
            <p className="text-xs text-muted-foreground text-center py-16">No platform data yet</p>
          )}
        </GlassCard>
      </div>

      {/* Top Tracks + Country Distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4 mb-4 sm:mb-6">
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
                  <div className="w-16 h-1.5 rounded-full bg-muted/40 overflow-hidden">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${topTracks[0]?.streams ? (track.streams / topTracks[0].streams) * 100 : 0}%`,
                        background: CHART_COLORS[i % CHART_COLORS.length]
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground text-center py-12">No track data yet</p>
          )}
        </GlassCard>

        {/* Country Distribution - World Map */}
        <GlassCard className="animate-fade-in">
          <h3 className="text-xs sm:text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
            <Globe className="h-4 w-4 text-primary" />
            Top Countries
          </h3>
          {countryData.length > 0 ? (
            <WorldMapChart data={countryData} />
          ) : (
            <p className="text-xs text-muted-foreground text-center py-12">No country data yet</p>
          )}
        </GlassCard>
      </div>

      {/* Recent Releases */}
      <GlassCard className="mb-4 sm:mb-6 animate-fade-in">
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
                      <td className="py-2.5 px-3 text-foreground font-medium truncate max-w-[180px]">{getReleaseName(r)}</td>
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
                <div key={r.id} className="p-2.5 rounded-lg bg-muted/20">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-medium text-foreground truncate">{getReleaseName(r)}</p>
                      <p className="text-[10px] text-muted-foreground capitalize">{r.content_type}</p>
                    </div>
                    <StatusBadge status={r.status} />
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-1">{format(new Date(r.created_at), 'dd MMM yyyy')}</p>
                </div>
              ))}
            </div>
          </>
        ) : (
          <p className="text-xs text-muted-foreground text-center py-6 sm:py-8">No releases yet</p>
        )}
      </GlassCard>

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
