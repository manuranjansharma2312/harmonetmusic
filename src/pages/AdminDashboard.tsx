import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { GlassCard } from '@/components/GlassCard';
import { StatusBadge } from '@/components/StatusBadge';
import { supabase } from '@/integrations/supabase/client';
import { formatRevenue, formatStreams } from '@/lib/formatNumbers';
import {
  Disc3, Clock, CheckCircle, XCircle, Loader2, Users,
  Wallet, FileText, UsersRound, Tag, MessageSquare, ArrowRight,
  TrendingUp, TrendingDown, Music, BarChart3, Activity, DollarSign, Globe,
  Youtube, Film, PenTool, Monitor, Download, Headphones, Play, Zap, Link2
} from 'lucide-react';
import { format, parse, subMonths } from 'date-fns';
import { useNavigate } from 'react-router-dom';

// Lazy-load heavy chart dependencies
const LazyCharts = lazy(() => import('@/components/admin/AdminDashboardCharts'));

const STORE_COLORS: Record<string, string> = {
  Spotify: '#1DB954', 'Apple Music': '#FA2D48', 'YouTube Music': '#FF0000',
  YouTube: '#FF0000', JioSaavn: '#2BC5B4', Gaana: '#E72C30',
  Wynk: '#1E90FF', Amazon: '#FF9900', Hungama: '#EF2D56',
  Instagram: '#E1306C', Facebook: '#1877F2', TikTok: '#000000',
};

const CHART_COLORS = [
  'hsl(0, 67%, 35%)', 'hsl(45, 80%, 45%)', 'hsl(140, 60%, 40%)',
  'hsl(200, 70%, 50%)', 'hsl(280, 60%, 50%)', 'hsl(30, 80%, 50%)',
  'hsl(170, 60%, 45%)', 'hsl(320, 60%, 50%)',
];

interface DashboardState {
  loading: boolean;
  counts: any;
  reportStats: any;
  pendingLabels: any[];
  pendingReleases: any[];
  pendingContentRequests: any[];
  pendingWithdrawals: any[];
  recentReleases: any[];
  monthlyReleases: { month: string; count: number }[];
  monthlyUsers: { month: string; count: number }[];
  monthlyVevo: { month: string; count: number }[];
  monthlyCmsLinked: { month: string; count: number }[];
}

type DashboardData = Omit<DashboardState, 'loading'>;

interface SafeRequestResult<T> {
  data: T;
  failed: boolean;
}

type RequestLike<T> = PromiseLike<{ data: T | null; error: any }>;

const EMPTY_DASHBOARD_DATA: DashboardData = {
  counts: {},
  reportStats: {},
  pendingLabels: [],
  pendingReleases: [],
  pendingContentRequests: [],
  pendingWithdrawals: [],
  recentReleases: [],
  monthlyReleases: [],
  monthlyUsers: [],
  monthlyVevo: [],
  monthlyCmsLinked: [],
};

const DASHBOARD_CACHE_TTL_MS = 60_000;

let adminDashboardCache: DashboardData | null = null;
let adminDashboardCacheAt = 0;

function hasFreshDashboardCache() {
  return adminDashboardCache && Date.now() - adminDashboardCacheAt < DASHBOARD_CACHE_TTL_MS;
}

function getInitialDashboardState(): DashboardState {
  return hasFreshDashboardCache()
    ? { loading: false, ...(adminDashboardCache as DashboardData) }
    : { loading: true, ...EMPTY_DASHBOARD_DATA };
}

async function safeRequest<T>(label: string, request: RequestLike<T>, fallback: T): Promise<SafeRequestResult<T>> {
  try {
    const { data, error } = await request;

    if (error) {
      console.error(`AdminDashboard ${label} failed:`, error);
      return { data: fallback, failed: true };
    }

    return { data: (data ?? fallback) as T, failed: false };
  } catch (error) {
    console.error(`AdminDashboard ${label} crashed:`, error);
    return { data: fallback, failed: true };
  }
}

function withCachedFallback<T>(result: SafeRequestResult<T>, cachedValue: T) {
  return result.failed ? cachedValue : result.data;
}

function toMonthlySeries(rows: Array<{ created_at?: string | null }>) {
  const now = new Date();
  const monthKeys: string[] = [];
  const counts: Record<string, number> = {};

  for (let i = 5; i >= 0; i -= 1) {
    const key = format(subMonths(now, i), 'MMM');
    monthKeys.push(key);
    counts[key] = 0;
  }

  rows.forEach((row) => {
    if (!row.created_at) return;

    const date = new Date(row.created_at);
    if (Number.isNaN(date.getTime())) return;

    const key = format(date, 'MMM');
    if (counts[key] !== undefined) counts[key] += 1;
  });

  return monthKeys.map((month) => ({ month, count: counts[month] }));
}

function getReportingMonthTime(value: string) {
  const parsed = parse(value, 'MMMM yyyy', new Date());
  if (!Number.isNaN(parsed.getTime())) return parsed.getTime();

  const shortParsed = parse(value, 'MMM yyyy', new Date());
  if (!Number.isNaN(shortParsed.getTime())) return shortParsed.getTime();

  return 0;
}

function safeFormatDate(value: string | null | undefined, pattern: string) {
  if (!value) return '—';

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '—';

  return format(parsed, pattern);
}

export default function AdminDashboard() {
  const navigate = useNavigate();
  const requestIdRef = useRef(0);
  const [state, setState] = useState<DashboardState>(() => getInitialDashboardState());

  useEffect(() => {
    const requestId = ++requestIdRef.current;
    void fetchAll(requestId);

    return () => {
      requestIdRef.current += 1;
    };
  }, []);

  async function fetchAll(requestId: number) {
    try {
      const cachedData = adminDashboardCache ?? EMPTY_DASHBOARD_DATA;
      const sixMonthsAgo = subMonths(new Date(), 6).toISOString();

      const [
        countsRes,
        reportStatsRes,
        pendingLabelsRes,
        pendingReleasesRes,
        pendingContentRes,
        pendingWithdrawalsRes,
        recentReleasesRes,
        // For growth charts we need created_at - use limited queries
        releaseDatesRes,
        userDatesRes,
        vevoDatesRes,
        cmsDatesRes,
      ] = await Promise.all([
        safeRequest('counts', supabase.rpc('admin_dashboard_counts' as any), cachedData.counts),
        safeRequest('report stats', supabase.rpc('admin_dashboard_report_stats' as any), cachedData.reportStats),
        safeRequest('pending labels', supabase.from('labels').select('id, label_name, created_at').eq('status', 'pending').order('created_at', { ascending: false }).limit(5), cachedData.pendingLabels),
        safeRequest('pending releases', supabase.from('releases').select('id, album_name, ep_name, content_type, release_type, created_at').eq('status', 'pending').order('created_at', { ascending: false }).limit(5), cachedData.pendingReleases),
        safeRequest('pending content requests', supabase.from('content_requests').select('id, request_type, song_title, artist_name, created_at').eq('status', 'pending').order('created_at', { ascending: false }).limit(5), cachedData.pendingContentRequests),
        safeRequest('pending withdrawals', supabase.from('withdrawal_requests' as any).select('id, amount, created_at, user_id').eq('status', 'pending').order('created_at', { ascending: false }).limit(5), cachedData.pendingWithdrawals),
        safeRequest('recent releases', supabase.from('releases').select('id, album_name, ep_name, content_type, status, created_at').order('created_at', { ascending: false }).limit(5), cachedData.recentReleases),
        safeRequest<Array<{ created_at?: string | null }>>('release growth', supabase.from('releases').select('created_at').gte('created_at', sixMonthsAgo) as any, []),
        safeRequest<Array<{ created_at?: string | null }>>('user growth', supabase.from('profiles').select('created_at').gte('created_at', sixMonthsAgo) as any, []),
        safeRequest<Array<{ created_at?: string | null }>>('vevo growth', supabase.from('video_submissions' as any).select('created_at').eq('submission_type', 'vevo_channel').gte('created_at', sixMonthsAgo) as any, []),
        safeRequest<Array<{ created_at?: string | null }>>('cms growth', supabase.from('youtube_cms_links' as any).select('created_at').eq('status', 'linked').gte('created_at', sixMonthsAgo) as any, []),
      ]);

      if (requestId !== requestIdRef.current) {
        return;
      }

      const nextData: DashboardData = {
        counts: withCachedFallback(countsRes, cachedData.counts),
        reportStats: withCachedFallback(reportStatsRes, cachedData.reportStats),
        pendingLabels: withCachedFallback(pendingLabelsRes, cachedData.pendingLabels),
        pendingReleases: withCachedFallback(pendingReleasesRes, cachedData.pendingReleases),
        pendingContentRequests: withCachedFallback(pendingContentRes, cachedData.pendingContentRequests),
        pendingWithdrawals: withCachedFallback(pendingWithdrawalsRes, cachedData.pendingWithdrawals),
        recentReleases: withCachedFallback(recentReleasesRes, cachedData.recentReleases),
        monthlyReleases: releaseDatesRes.failed ? cachedData.monthlyReleases : toMonthlySeries(releaseDatesRes.data),
        monthlyUsers: userDatesRes.failed ? cachedData.monthlyUsers : toMonthlySeries(userDatesRes.data),
        monthlyVevo: vevoDatesRes.failed ? cachedData.monthlyVevo : toMonthlySeries(vevoDatesRes.data),
        monthlyCmsLinked: cmsDatesRes.failed ? cachedData.monthlyCmsLinked : toMonthlySeries(cmsDatesRes.data),
      };

      adminDashboardCache = nextData;
      adminDashboardCacheAt = Date.now();

      setState({ loading: false, ...nextData });
    } catch (err) {
      console.error('AdminDashboard fetchAll error:', err);
      if (requestId === requestIdRef.current) {
        setState((prev) => ({ ...prev, loading: false }));
      }
    }
  }

  if (state.loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    );
  }

  const c = state.counts || {};
  const rs = state.reportStats || {};
  const ott = rs.ott || {};
  const yt = rs.youtube || {};
  const vevo = rs.vevo || {};

  const totalRevenue = Number(ott.total_revenue || 0) + Number(yt.total_revenue || 0) + Number(vevo.total_revenue || 0);
  const totalStreams = Number(ott.total_streams || 0) + Number(yt.total_streams || 0) + Number(vevo.total_streams || 0);
  const totalDownloads = Number(ott.total_downloads || 0) + Number(yt.total_downloads || 0) + Number(vevo.total_downloads || 0);
  const cmsTotalRevenue = Number(rs.cms_total_revenue || 0);
  const vevoTotalRevenue = Number(vevo.total_revenue || 0);
  const vevoTotalStreams = Number(vevo.total_streams || 0);

  const releaseStats = {
    total: Number(c.releases_total || 0),
    pending: Number(c.releases_pending || 0),
    approved: Number(c.releases_approved || 0),
    rejected: Number(c.releases_rejected || 0),
  };
  const userCount = Number(c.users || 0);
  const labelCount = Number(c.labels || 0);
  const subLabelCount = Number(c.sub_labels || 0);
  const withdrawalStats = {
    pending: Number(c.withdrawals_pending || 0),
    paid: Number(c.withdrawals_paid || 0),
    totalAmount: Number(c.withdrawals_total_amount || 0),
    pendingAmount: Number(c.withdrawals_pending_amount || 0),
  };
  const contentRequestCount = Number(c.content_requests_pending || 0);
  const cmsLinkCount = Number(c.cms_links_linked || 0);
  const pendingCmsLinks = Number(c.cms_links_pending || 0);
  const cmsWithdrawalPending = Number(c.cms_withdrawals_pending || 0);
  const videoSubmissionCount = Number(c.video_submissions || 0);
  const pendingVideoCount = Number(c.video_pending || 0);
  const vevoChannelCount = Number(c.vevo_channels || 0);
  const pendingVevoCount = Number(c.vevo_pending || 0);
  const signatureDocCount = Number(c.signature_docs || 0);
  const transferCount = Number(c.transfers || 0);

  // Process chart data from RPC results
  const monthlyRevenue = ((rs.monthly_trend || []) as any[])
    .map((r: any) => ({ month: r.month, revenue: Math.round(Number(r.revenue) * 100) / 100, streams: Number(r.streams), downloads: Number(r.downloads) }))
    .sort((a, b) => getReportingMonthTime(a.month) - getReportingMonthTime(b.month));

  const topStores = ((rs.top_stores || []) as any[]).map((s: any) => ({
    name: s.name, value: Number(s.streams), revenue: Number(s.revenue),
    color: STORE_COLORS[s.name] || CHART_COLORS[0],
  }));

  const topTracks = ((rs.top_tracks || []) as any[]).map((t: any) => ({
    name: String(t.name).length > 25 ? `${String(t.name).substring(0, 25)}…` : t.name,
    streams: Number(t.streams),
  }));

  const topArtists = ((rs.top_artists || []) as any[]).map((a: any) => ({
    name: String(a.name).length > 20 ? `${String(a.name).substring(0, 20)}…` : a.name,
    streams: Number(a.streams),
  }));

  const countryData = ((rs.top_countries || []) as any[]).map((c: any) => ({ name: c.name, streams: Number(c.streams) }));

  // Monthly store data (simplified - top 4 stores already computed)
  const topStoreNames = topStores.slice(0, 4).map(s => s.name);

  const releaseStatusData = [
    { name: 'Pending', value: releaseStats.pending, color: 'hsl(45, 80%, 45%)' },
    { name: 'Approved', value: releaseStats.approved, color: 'hsl(140, 60%, 40%)' },
    { name: 'Rejected', value: releaseStats.rejected, color: 'hsl(0, 67%, 45%)' },
  ].filter(d => d.value > 0);

  const getReleaseName = (r: any) => r.album_name || r.ep_name || r.content_type || 'Untitled';
  const formatRequestType = (type: string) => type.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  const totalStoreStreams = topStores.reduce((a, b) => a + b.value, 0);
  const totalActionItems = releaseStats.pending + contentRequestCount + pendingCmsLinks + pendingVideoCount + pendingVevoCount + cmsWithdrawalPending + withdrawalStats.pending;

  const growthData = state.monthlyReleases.map((r, i) => ({
    month: r.month,
    artists: state.monthlyUsers[i]?.count || 0,
    releases: r.count,
    vevo: state.monthlyVevo[i]?.count || 0,
    cms: state.monthlyCmsLinked[i]?.count || 0,
  }));

  return (
    <DashboardLayout>
      <div className="mb-6 sm:mb-8">
        <h1 className="text-2xl sm:text-3xl font-display font-bold text-foreground tracking-tight">Admin Dashboard</h1>
        <p className="text-muted-foreground mt-1 text-xs sm:text-sm">Platform overview and analytics</p>
      </div>

      {/* Hero Stats Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 mb-6 sm:mb-8">
        {[
          { label: 'Total Users', value: userCount, icon: Users, gradient: 'from-sky-500/12 to-sky-600/5', border: 'border-sky-500/15', iconColor: 'text-sky-400', labelColor: 'text-sky-300/70', glow: 'bg-sky-500/10' },
          { label: 'Total Revenue', value: formatRevenue(totalRevenue), icon: DollarSign, gradient: 'from-emerald-500/12 to-emerald-600/5', border: 'border-emerald-500/15', iconColor: 'text-emerald-400', labelColor: 'text-emerald-300/70', glow: 'bg-emerald-500/10' },
          { label: 'Total Streams', value: formatStreams(totalStreams), icon: BarChart3, gradient: 'from-violet-500/12 to-violet-600/5', border: 'border-violet-500/15', iconColor: 'text-violet-400', labelColor: 'text-violet-300/70', glow: 'bg-violet-500/10' },
          { label: 'Releases', value: releaseStats.total, icon: Disc3, gradient: 'from-rose-500/12 to-rose-600/5', border: 'border-rose-500/15', iconColor: 'text-rose-400', labelColor: 'text-rose-300/70', glow: 'bg-rose-500/10', sub: `${releaseStats.approved} live · ${releaseStats.pending} pending` },
        ].map((stat) => (
          <div key={stat.label} className={`relative overflow-hidden rounded-2xl p-4 sm:p-5 bg-gradient-to-br ${stat.gradient} ${stat.border} border`}>
            <div className={`absolute -top-8 -right-8 h-24 w-24 rounded-full ${stat.glow} blur-3xl`} />
            <stat.icon className={`h-5 w-5 ${stat.iconColor} mb-2`} />
            <p className={`text-[10px] sm:text-xs ${stat.labelColor} uppercase tracking-widest font-medium`}>{stat.label}</p>
            <p className="text-lg sm:text-2xl lg:text-3xl font-bold text-foreground mt-1 truncate">{stat.value}</p>
            {stat.sub && <p className="text-[10px] text-muted-foreground mt-1">{stat.sub}</p>}
          </div>
        ))}
      </div>

      {/* Secondary Compact Stats */}
      <div className="grid grid-cols-3 sm:grid-cols-5 lg:grid-cols-5 xl:grid-cols-10 gap-2 sm:gap-3 mb-6 sm:mb-8">
        {[
          { label: 'Labels', value: labelCount, icon: Tag, accent: 'text-amber-400' },
          { label: 'Sub Labels', value: subLabelCount, icon: UsersRound, accent: 'text-sky-400' },
          { label: 'Downloads', value: formatStreams(totalDownloads), icon: Download, accent: 'text-violet-400' },
          { label: 'CMS Links', value: cmsLinkCount, icon: Link2, accent: 'text-red-400' },
          { label: 'CMS Revenue', value: formatRevenue(cmsTotalRevenue), icon: Monitor, accent: 'text-emerald-400' },
          { label: 'Videos', value: videoSubmissionCount, icon: Film, accent: 'text-violet-400' },
          { label: 'Vevo Channels', value: vevoChannelCount, icon: Play, accent: 'text-pink-400' },
          { label: 'Vevo Revenue', value: formatRevenue(vevoTotalRevenue), icon: Zap, accent: 'text-rose-400' },
          { label: 'Vevo Streams', value: formatStreams(vevoTotalStreams), icon: Headphones, accent: 'text-pink-300' },
          { label: 'Transfers', value: transferCount, icon: TrendingUp, accent: 'text-sky-400' },
        ].map((stat) => (
          <GlassCard key={stat.label} className="!p-3 group hover:scale-[1.02] transition-transform duration-300 overflow-hidden">
            <stat.icon className={`h-3.5 w-3.5 ${stat.accent} mb-1 shrink-0`} />
            <p className="text-[9px] sm:text-[10px] text-muted-foreground uppercase tracking-wider leading-tight">{stat.label}</p>
            <p className="text-xs sm:text-sm font-bold text-foreground mt-0.5 whitespace-nowrap">{stat.value}</p>
          </GlassCard>
        ))}
      </div>

      {/* Financial + Action Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 mb-6 sm:mb-8">
        {[
          { label: 'Pending W/D', value: formatRevenue(withdrawalStats.pendingAmount), sub: `${withdrawalStats.pending} requests`, icon: Clock, color: 'hsl(45, 80%, 45%)', iconColor: 'text-amber-400' },
          { label: 'Total Paid', value: formatRevenue(withdrawalStats.totalAmount), sub: `${withdrawalStats.paid} completed`, icon: CheckCircle, color: 'hsl(140, 60%, 40%)', iconColor: 'text-emerald-400' },
          { label: 'E-Signatures', value: signatureDocCount, sub: 'documents total', icon: PenTool, color: 'hsl(280, 60%, 50%)', iconColor: 'text-violet-400' },
          { label: 'Action Required', value: totalActionItems, sub: 'pending items', icon: Activity, color: 'hsl(0, 67%, 35%)', iconColor: 'text-primary' },
        ].map((stat) => (
          <GlassCard key={stat.label} className="!p-4 border-l-4 " style={{ borderLeftColor: stat.color }}>
            <div className="flex items-center gap-2 mb-2">
              <stat.icon className={`h-4 w-4 ${stat.iconColor}`} />
              <span className="text-[10px] sm:text-xs text-muted-foreground uppercase tracking-widest font-medium">{stat.label}</span>
            </div>
            <p className="text-xl font-bold text-foreground">{stat.value}</p>
            <p className="text-[10px] text-muted-foreground mt-1">{stat.sub}</p>
          </GlassCard>
        ))}
      </div>

      {/* Charts - Lazy Loaded */}
      <Suspense fallback={<GlassCard className="h-80 flex items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></GlassCard>}>
        <LazyCharts
          monthlyRevenue={monthlyRevenue}
          growthData={growthData}
          monthlyUsers={state.monthlyUsers}
          monthlyReleases={state.monthlyReleases}
          monthlyVevo={state.monthlyVevo}
          monthlyCmsLinked={state.monthlyCmsLinked}
          releaseStatusData={releaseStatusData}
          topStores={topStores}
          topStoreNames={topStoreNames}
          topTracks={topTracks}
          topArtists={topArtists}
          countryData={countryData}
          totalStoreStreams={totalStoreStreams}
          storeColors={STORE_COLORS}
          chartColors={CHART_COLORS}
        />
      </Suspense>

      {/* Pending Requests Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6 sm:mb-8">
        <PendingListCard title="Pending Releases" icon={Disc3} items={state.pendingReleases} emptyText="No pending releases" onViewAll={() => navigate('/admin/submissions')}
          renderItem={(r) => (
            <div key={r.id} className="flex items-center justify-between gap-2 p-3 rounded-xl bg-muted/15 hover:bg-muted/25 transition-colors border border-border/20">
              <div className="min-w-0 flex-1"><p className="text-xs sm:text-sm font-medium text-foreground truncate">{getReleaseName(r)}</p><p className="text-[10px] text-muted-foreground capitalize">{r.content_type}</p></div>
              <span className="text-[10px] text-muted-foreground shrink-0">{safeFormatDate(r.created_at, 'dd MMM')}</span>
            </div>
          )} />
        <PendingListCard title="Pending Content Requests" icon={MessageSquare} items={state.pendingContentRequests} emptyText="No pending requests" onViewAll={() => navigate('/admin/content-requests')}
          renderItem={(c) => (
            <div key={c.id} className="flex items-center justify-between gap-2 p-3 rounded-xl bg-muted/15 hover:bg-muted/25 transition-colors border border-border/20">
              <div className="min-w-0 flex-1"><p className="text-xs sm:text-sm font-medium text-foreground truncate">{formatRequestType(c.request_type)}</p><p className="text-[10px] text-muted-foreground truncate">{c.song_title || c.artist_name || '—'}</p></div>
              <span className="text-[10px] text-muted-foreground shrink-0">{safeFormatDate(c.created_at, 'dd MMM')}</span>
            </div>
          )} />
        <PendingListCard title="Pending Labels" icon={Tag} items={state.pendingLabels} emptyText="No pending labels" onViewAll={() => navigate('/admin/labels')}
          renderItem={(l) => (
            <div key={l.id} className="flex items-center justify-between gap-2 p-3 rounded-xl bg-muted/15 hover:bg-muted/25 transition-colors border border-border/20">
              <div className="min-w-0 flex-1"><p className="text-xs sm:text-sm font-medium text-foreground truncate">{l.label_name}</p></div>
              <span className="text-[10px] text-muted-foreground shrink-0">{safeFormatDate(l.created_at, 'dd MMM')}</span>
            </div>
          )} />
        <PendingListCard title="Pending Withdrawals" icon={Wallet} items={state.pendingWithdrawals} emptyText="No pending withdrawals" onViewAll={() => navigate('/admin/revenue')}
          renderItem={(w) => (
            <div key={w.id} className="flex items-center justify-between gap-2 p-3 rounded-xl bg-muted/15 hover:bg-muted/25 transition-colors border border-border/20">
              <div className="min-w-0 flex-1"><p className="text-sm font-bold text-foreground">₹{Number(w.amount).toLocaleString()}</p><p className="text-[10px] text-muted-foreground">{safeFormatDate(w.created_at, 'dd MMM yyyy')}</p></div>
              <StatusBadge status="pending" />
            </div>
          )} />
      </div>

      {/* Recent Releases */}
      <GlassCard className="">
        <SectionHeader icon={Disc3} iconBg="bg-amber-500/15" iconColor="text-amber-400" title="Recent Releases" />
        {state.recentReleases.length > 0 ? (
          <>
            <div className="responsive-table-wrap hidden sm:block">
              <table className="w-full text-sm min-w-max">
                <thead>
                  <tr className="border-b border-border/40">
                    {['Release', 'Type', 'Status', 'Date'].map(h => <th key={h} className="text-left py-2.5 px-3 text-muted-foreground font-medium text-xs uppercase tracking-wider">{h}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {state.recentReleases.map((r: any) => (
                    <tr key={r.id} className="border-b border-border/20 hover:bg-muted/15 transition-colors">
                      <td className="py-3 px-3 text-foreground font-medium truncate max-w-[180px]">{getReleaseName(r)}</td>
                      <td className="py-3 px-3 text-muted-foreground capitalize text-xs">{r.content_type}</td>
                      <td className="py-3 px-3"><StatusBadge status={r.status} /></td>
                      <td className="py-3 px-3 text-muted-foreground text-xs">{safeFormatDate(r.created_at, 'dd MMM yyyy')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="sm:hidden space-y-2">
              {state.recentReleases.map((r: any) => (
                <div key={r.id} className="p-3 rounded-xl bg-muted/15 border border-border/20">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1"><p className="text-xs font-medium text-foreground truncate">{getReleaseName(r)}</p><p className="text-[10px] text-muted-foreground capitalize">{r.content_type}</p></div>
                    <StatusBadge status={r.status} />
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-1.5">{safeFormatDate(r.created_at, 'dd MMM yyyy')}</p>
                </div>
              ))}
            </div>
          </>
        ) : <EmptyChart icon={Disc3} text="No releases yet" />}
      </GlassCard>
    </DashboardLayout>
  );
}

// --- Sub-components ---

function SectionHeader({ icon: Icon, iconBg, iconColor, title }: { icon: any; iconBg: string; iconColor: string; title: string }) {
  return (
    <h3 className="text-xs sm:text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
      <div className={`h-6 w-6 rounded-lg ${iconBg} flex items-center justify-center`}><Icon className={`h-3 w-3 ${iconColor}`} /></div>
      {title}
    </h3>
  );
}

function EmptyChart({ icon: Icon, text }: { icon: any; text: string }) {
  return (
    <div className="text-center py-16"><Icon className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" /><p className="text-xs text-muted-foreground">{text}</p></div>
  );
}

function PendingListCard({ title, icon: Icon, items, emptyText, onViewAll, renderItem }: {
  title: string; icon: any; items: any[]; emptyText: string; onViewAll: () => void; renderItem: (item: any) => React.ReactNode;
}) {
  return (
    <GlassCard className="">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-xs sm:text-sm font-semibold text-foreground flex items-center gap-2">
          <div className="h-6 w-6 rounded-lg bg-primary/15 flex items-center justify-center"><Icon className="h-3 w-3 text-primary" /></div>
          {title}
          {items.length > 0 && <span className="ml-1 inline-flex items-center justify-center h-5 min-w-[20px] px-1.5 rounded-full text-[10px] font-bold bg-primary/20 text-primary">{items.length}</span>}
        </h3>
        <button onClick={onViewAll} className="text-[10px] sm:text-xs text-primary hover:underline flex items-center gap-1">View All <ArrowRight className="h-3 w-3" /></button>
      </div>
      {items.length > 0 ? <div className="space-y-2">{items.map(renderItem)}</div> : <EmptyChart icon={Icon} text={emptyText} />}
    </GlassCard>
  );
}
