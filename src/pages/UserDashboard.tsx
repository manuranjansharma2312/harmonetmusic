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
  Activity, Globe, Headphones, Youtube, Monitor, Play, Film, Download,
  PieChart as PieChartIcon, Zap
} from 'lucide-react';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { TutorialContent } from '@/components/TutorialContent';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, BarChart, Bar, Legend, RadialBarChart, RadialBar,
  ComposedChart, Line
} from 'recharts';
import { format } from 'date-fns';

const CHART_COLORS = [
  'hsl(0, 67%, 35%)', 'hsl(45, 80%, 45%)', 'hsl(140, 60%, 40%)',
  'hsl(200, 70%, 50%)', 'hsl(280, 60%, 50%)', 'hsl(30, 80%, 50%)',
];

const STORE_COLORS: Record<string, string> = {
  Spotify: '#1DB954', 'Apple Music': '#FA2D48', 'YouTube Music': '#FF0000',
  YouTube: '#FF0000', JioSaavn: '#2BC5B4', Gaana: '#E72C30',
  Wynk: '#1E90FF', Amazon: '#FF9900', Hungama: '#EF2D56',
  Instagram: '#E1306C', Facebook: '#1877F2', TikTok: '#000000',
};

const tooltipStyle = {
  background: 'hsl(0 0% 7%)',
  border: '1px solid hsl(0 0% 14%)',
  borderRadius: '16px',
  color: 'hsl(0 0% 90%)',
  fontSize: '11px',
  boxShadow: '0 20px 60px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.05)',
  padding: '12px 16px',
  backdropFilter: 'blur(20px)',
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
  const [monthlyRevenue, setMonthlyRevenue] = useState<{ month: string; revenue: number; streams: number; downloads: number }[]>([]);
  const [topTracks, setTopTracks] = useState<{ name: string; streams: number; revenue: number }[]>([]);
  const [topStores, setTopStores] = useState<{ name: string; value: number; revenue: number; color: string }[]>([]);
  const [countryData, setCountryData] = useState<{ name: string; streams: number }[]>([]);
  const [recentReleases, setRecentReleases] = useState<any[]>([]);
  const [withdrawalBalance, setWithdrawalBalance] = useState({ pending: 0, paid: 0 });
  const [hiddenCut, setHiddenCut] = useState(0);
  const [subLabelCut, setSubLabelCut] = useState(0);
  const [isSubLabelUser, setIsSubLabelUser] = useState(false);

  // CMS data
  const [cmsRevenue, setCmsRevenue] = useState(0);
  const [cmsChannels, setCmsChannels] = useState(0);
  const [cmsPaid, setCmsPaid] = useState(0);
  const [cmsPending, setCmsPending] = useState(0);

  // Monthly breakdown for stores (bar chart)
  const [monthlyStoreData, setMonthlyStoreData] = useState<any[]>([]);
  // Top artists for the user
  const [topArtists, setTopArtists] = useState<{ name: string; streams: number }[]>([]);

  const refreshTimeoutRef = useRef<number | null>(null);
  const isFetchingRef = useRef(false);
  const shouldRefetchRef = useRef(false);

  const effectiveUserId = isImpersonating ? impersonatedUserId : user?.id;
  const effectiveCut = getEffectiveRevenueCutPercent({ hiddenCut, subLabelCut, isSubLabel: isSubLabelUser });
  const netRevenue = totalRevenue;
  const availableRevenue = Math.max(calculateAvailableBalance(netRevenue, withdrawalBalance.paid, withdrawalBalance.pending), 0);
  const cmsAvailable = Math.max(0, cmsRevenue - cmsPaid - cmsPending);

  const fetchAll = useCallback(async () => {
    if (!effectiveUserId) return;
    if (isFetchingRef.current) { shouldRefetchRef.current = true; return; }
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
      let hiddenCutPercent = profileRes.data ? Number((profileRes.data as any).hidden_cut_percent || 0) : 0;
      if (hasSubLabel && subLabelRes.data?.parent_user_id) {
        const { data: parentProfile } = await supabase.from('profiles').select('hidden_cut_percent').eq('user_id', subLabelRes.data.parent_user_id).maybeSingle();
        hiddenCutPercent = Number(parentProfile?.hidden_cut_percent || 0);
      }

      const effectiveCutPercent = getEffectiveRevenueCutPercent({ hiddenCut: hiddenCutPercent, subLabelCut: subLabelCutPercent, isSubLabel: hasSubLabel });
      const shouldCut = shouldApplyRevenueCut({ role, currentUserId: user?.id, activeUserId: effectiveUserId });

      setHiddenCut(hiddenCutPercent);
      setSubLabelCut(subLabelCutPercent);
      setIsSubLabelUser(hasSubLabel);

      let reportData: any[] = [];
      let ytReportData: any[] = [];

      if (role === 'admin' && isImpersonating && impersonatedUserId) {
        const { data: subLabels } = await supabase.from('sub_labels').select('sub_user_id').eq('parent_user_id', effectiveUserId).eq('status', 'active');
        const subUserIds = (subLabels || []).map((sl) => sl.sub_user_id).filter(Boolean) as string[];
        const allUserIds = [effectiveUserId, ...subUserIds];
        const [{ data: trackRows }, { data: songRows }] = await Promise.all([
          supabase.from('tracks').select('isrc').in('user_id', allUserIds),
          supabase.from('songs').select('isrc').in('user_id', allUserIds),
        ]);
        const ownedIsrcs = [...new Set([...(trackRows ?? []), ...(songRows ?? [])].map((row) => (row.isrc || '').trim().toUpperCase()).filter(Boolean))];
        if (ownedIsrcs.length > 0) {
          const [{ data: ottData }, { data: ytData }] = await Promise.all([
            supabase.from('report_entries').select('reporting_month, net_generated_revenue, streams, downloads, store, track, artist, country, cut_percent_snapshot, revenue_frozen').in('isrc', ownedIsrcs),
            supabase.from('youtube_report_entries').select('reporting_month, net_generated_revenue, streams, downloads, store, track, artist, country, cut_percent_snapshot, revenue_frozen').in('isrc', ownedIsrcs),
          ]);
          reportData = ottData || [];
          ytReportData = ytData || [];
        }
      } else {
        const [reportRes, ytReportRes] = await Promise.all([
          supabase.from('report_entries').select('reporting_month, net_generated_revenue, streams, downloads, store, track, artist, country, cut_percent_snapshot, revenue_frozen').eq('user_id', effectiveUserId),
          supabase.from('youtube_report_entries').select('reporting_month, net_generated_revenue, streams, downloads, store, track, artist, country, cut_percent_snapshot, revenue_frozen').eq('user_id', effectiveUserId),
        ]);
        reportData = reportRes.data || [];
        ytReportData = ytReportRes.data || [];
      }

      // CMS data (not for sub-label users)
      if (!hasSubLabel) {
        const [{ data: cmsLinks }, { data: cmsEntries }, { data: cmsWds }] = await Promise.all([
          supabase.from('youtube_cms_links' as any).select('channel_name, cut_percent').eq('user_id', effectiveUserId).eq('status', 'linked'),
          supabase.from('cms_report_entries' as any).select('net_generated_revenue, channel_name'),
          supabase.from('cms_withdrawal_requests' as any).select('status, amount').eq('user_id', effectiveUserId),
        ]);
        const linkedChannels = (cmsLinks as any[]) || [];
        setCmsChannels(linkedChannels.length);
        const linkedNames = new Set(linkedChannels.map(l => l.channel_name));
        const userCmsEntries = ((cmsEntries as any[]) || []).filter(e => linkedNames.has(e.channel_name));
        let cmsTotal = 0;
        userCmsEntries.forEach(e => {
          const rev = Number(e.net_generated_revenue) || 0;
          const cut = Number(linkedChannels.find(l => l.channel_name === e.channel_name)?.cut_percent || 0);
          cmsTotal += rev - (rev * cut / 100);
        });
        setCmsRevenue(Math.round(cmsTotal * 100) / 100);
        const cmsWithdrawals = (cmsWds as any[]) || [];
        setCmsPaid(cmsWithdrawals.filter(w => w.status === 'paid').reduce((s, w) => s + Number(w.amount), 0));
        setCmsPending(cmsWithdrawals.filter(w => w.status === 'pending').reduce((s, w) => s + Number(w.amount), 0));
      } else {
        setCmsChannels(0); setCmsRevenue(0); setCmsPaid(0); setCmsPending(0);
      }

      const allReports = [...reportData, ...ytReportData];

      if (allReports.length > 0) {
        let totalRev = 0, totalStr = 0, totalDl = 0;
        const monthMap: Record<string, { revenue: number; streams: number; downloads: number }> = {};
        const storeMap: Record<string, { streams: number; revenue: number }> = {};
        const trackMap: Record<string, { streams: number; revenue: number }> = {};
        const countryMap: Record<string, number> = {};
        const artistMap: Record<string, number> = {};
        // Monthly store breakdown
        const monthStoreMap: Record<string, Record<string, number>> = {};

        allReports.forEach((r: any) => {
          const isFrozen = r.revenue_frozen === true;
          const grossRevenue = Number(r.net_generated_revenue || 0);
          const rev = isFrozen ? 0 : applySnapshotCut(grossRevenue, r.cut_percent_snapshot, effectiveCutPercent, shouldCut);
          const str = Number(r.streams || 0);
          const dl = Number(r.downloads || 0);
          totalRev += rev; totalStr += str; totalDl += dl;
          const month = r.reporting_month?.length > 7 ? r.reporting_month.substring(0, 7) : r.reporting_month;
          if (!monthMap[month]) monthMap[month] = { revenue: 0, streams: 0, downloads: 0 };
          monthMap[month].revenue += rev;
          monthMap[month].streams += str;
          monthMap[month].downloads += dl;
          const store = r.store || 'Other';
          if (!storeMap[store]) storeMap[store] = { streams: 0, revenue: 0 };
          storeMap[store].streams += str;
          storeMap[store].revenue += rev;
          if (r.track) {
            if (!trackMap[r.track]) trackMap[r.track] = { streams: 0, revenue: 0 };
            trackMap[r.track].streams += str;
            trackMap[r.track].revenue += rev;
          }
          if (r.country) countryMap[r.country] = (countryMap[r.country] || 0) + str;
          if (r.artist) artistMap[r.artist] = (artistMap[r.artist] || 0) + str;
          // Monthly store
          if (!monthStoreMap[month]) monthStoreMap[month] = {};
          monthStoreMap[month][store] = (monthStoreMap[month][store] || 0) + str;
        });

        setTotalRevenue(Math.round(totalRev * 100) / 100);
        setTotalStreams(totalStr);
        setTotalDownloads(totalDl);
        setMonthlyRevenue(Object.entries(monthMap).sort(([a], [b]) => a.localeCompare(b)).slice(-8).map(([month, data]) => ({ month, revenue: Math.round(data.revenue * 100) / 100, streams: data.streams, downloads: data.downloads })));
        setTopStores(Object.entries(storeMap).sort(([, a], [, b]) => b.streams - a.streams).slice(0, 8).map(([name, data]) => ({ name, value: data.streams, revenue: data.revenue, color: STORE_COLORS[name] || CHART_COLORS[0] })));
        setTopTracks(Object.entries(trackMap).sort(([, a], [, b]) => b.streams - a.streams).slice(0, 6).map(([name, data]) => ({ name: name.length > 22 ? `${name.substring(0, 22)}…` : name, streams: data.streams, revenue: data.revenue })));
        setCountryData(Object.entries(countryMap).sort(([, a], [, b]) => b - a).slice(0, 10).map(([name, streams]) => ({ name, streams })));
        setTopArtists(Object.entries(artistMap).sort(([, a], [, b]) => b - a).slice(0, 5).map(([name, streams]) => ({ name: name.length > 20 ? name.substring(0, 20) + '…' : name, streams })));

        // Top 4 stores for monthly breakdown
        const topStoreNames = Object.entries(storeMap).sort(([, a], [, b]) => b.streams - a.streams).slice(0, 4).map(([n]) => n);
        setMonthlyStoreData(Object.entries(monthStoreMap).sort(([a], [b]) => a.localeCompare(b)).slice(-6).map(([month, stores]) => {
          const row: any = { month };
          topStoreNames.forEach(s => { row[s] = stores[s] || 0; });
          return row;
        }));
      } else {
        setTotalRevenue(0); setTotalStreams(0); setTotalDownloads(0);
        setMonthlyRevenue([]); setTopStores([]); setTopTracks([]); setCountryData([]);
        setTopArtists([]); setMonthlyStoreData([]);
      }

      if (withdrawalRes.data) setWithdrawalBalance(summarizeWithdrawals(withdrawalRes.data));
      setRecentReleases(recentReleasesRes.data || []);
    } catch (error) {
      console.error('Failed to load dashboard', error);
      toast.error('Failed to load dashboard data. Please refresh and try again.');
    } finally {
      setLoading(false);
      isFetchingRef.current = false;
      if (shouldRefetchRef.current) { shouldRefetchRef.current = false; void fetchAll(); }
    }
  }, [effectiveUserId, impersonatedUserId, isImpersonating, role, user?.id]);

  const scheduleFetchAll = useCallback(() => {
    if (refreshTimeoutRef.current !== null) window.clearTimeout(refreshTimeoutRef.current);
    refreshTimeoutRef.current = window.setTimeout(() => { refreshTimeoutRef.current = null; void fetchAll(); }, 250);
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
    return () => { if (refreshTimeoutRef.current !== null) { window.clearTimeout(refreshTimeoutRef.current); refreshTimeoutRef.current = null; } supabase.removeChannel(channel); };
  }, [effectiveUserId, fetchAll, scheduleFetchAll]);

  const copyUserId = () => { if (displayId) { navigator.clipboard.writeText(`#${displayId}`); toast.success('User ID copied!'); } };
  const handleStopImpersonating = () => { stopImpersonating(); navigate('/admin/users'); };

  const releaseStatusData = useMemo(() => [
    { name: 'Pending', value: releaseStats.pending, color: 'hsl(45, 80%, 45%)' },
    { name: 'Approved', value: releaseStats.approved, color: 'hsl(140, 60%, 40%)' },
    { name: 'Rejected', value: releaseStats.rejected, color: 'hsl(0, 67%, 45%)' },
  ].filter(d => d.value > 0), [releaseStats]);

  const pendingReleases = useMemo(() => recentReleases.filter(r => r.status === 'pending'), [recentReleases]);
  const totalStoreStreams = useMemo(() => topStores.reduce((a, b) => a + b.value, 0), [topStores]);
  const totalStoreRevenue = useMemo(() => topStores.reduce((a, b) => a + b.revenue, 0), [topStores]);
  const topStoreNames = useMemo(() => topStores.slice(0, 4).map(s => s.name), [topStores]);

  const getReleaseName = (r: any) => {
    if (r.content_type === 'album') return r.album_name || 'Untitled Album';
    if (r.content_type === 'ep') return r.ep_name || 'Untitled EP';
    return r.album_name || r.ep_name || 'Untitled Single';
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

  return (
    <DashboardLayout>
      {isImpersonating && (
        <div className="mb-4 sm:mb-6 p-3 sm:p-4 rounded-2xl bg-blue-500/10 border border-blue-500/20 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 animate-fade-in backdrop-blur-sm">
          <div className="min-w-0">
            <p className="text-xs sm:text-sm font-medium text-blue-400">Viewing as user</p>
            <p className="text-[10px] sm:text-xs text-blue-300/60 break-all">{impersonatedEmail}</p>
          </div>
          <button onClick={handleStopImpersonating} className="flex w-full sm:w-auto items-center justify-center gap-2 px-4 py-2 rounded-xl bg-blue-500/15 text-blue-400 text-xs font-medium hover:bg-blue-500/25 transition-all border border-blue-500/20">
            <X className="h-3.5 w-3.5" /> Back to Admin
          </button>
        </div>
      )}

      {/* Header */}
      <div className="mb-6 sm:mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-display font-bold text-foreground tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground mt-1 text-xs sm:text-sm">Welcome back! Here's your overview.</p>
        </div>
        {displayId && (
          <button onClick={copyUserId} className="flex items-center gap-2.5 px-4 py-2.5 rounded-2xl glass hover:ring-1 hover:ring-primary/30 transition-all group" title="Copy User ID">
            <span className="font-mono text-sm sm:text-base font-bold text-foreground">#{displayId}</span>
            <Copy className="h-3.5 w-3.5 text-muted-foreground group-hover:text-foreground transition-colors" />
          </button>
        )}
      </div>

      {/* Revenue Hero Section - Bento Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6 sm:mb-8">
        <div className="relative overflow-hidden rounded-2xl p-4 sm:p-5 bg-gradient-to-br from-emerald-500/10 to-emerald-600/5 border border-emerald-500/15">
          <div className="absolute -top-6 -right-6 h-20 w-20 rounded-full bg-emerald-500/10 blur-2xl" />
          <DollarSign className="h-5 w-5 text-emerald-400 mb-2" />
          <p className="text-[10px] sm:text-xs text-emerald-300/70 uppercase tracking-widest font-medium">Available</p>
          <p className="text-xl sm:text-2xl lg:text-3xl font-bold text-foreground mt-1 whitespace-nowrap">{formatRevenue(availableRevenue)}</p>
        </div>
        <div className="relative overflow-hidden rounded-2xl p-4 sm:p-5 bg-gradient-to-br from-amber-500/10 to-amber-600/5 border border-amber-500/15">
          <div className="absolute -top-6 -right-6 h-20 w-20 rounded-full bg-amber-500/10 blur-2xl" />
          <Clock className="h-5 w-5 text-amber-400 mb-2" />
          <p className="text-[10px] sm:text-xs text-amber-300/70 uppercase tracking-widest font-medium">Pending</p>
          <p className="text-xl sm:text-2xl lg:text-3xl font-bold text-foreground mt-1 whitespace-nowrap">{formatRevenue(withdrawalBalance.pending)}</p>
        </div>
        <div className="relative overflow-hidden rounded-2xl p-4 sm:p-5 bg-gradient-to-br from-sky-500/10 to-sky-600/5 border border-sky-500/15">
          <div className="absolute -top-6 -right-6 h-20 w-20 rounded-full bg-sky-500/10 blur-2xl" />
          <Wallet className="h-5 w-5 text-sky-400 mb-2" />
          <p className="text-[10px] sm:text-xs text-sky-300/70 uppercase tracking-widest font-medium">Paid</p>
          <p className="text-xl sm:text-2xl lg:text-3xl font-bold text-foreground mt-1 whitespace-nowrap">{formatRevenue(withdrawalBalance.paid)}</p>
        </div>
        <div className="relative overflow-hidden rounded-2xl p-4 sm:p-5 bg-gradient-to-br from-rose-500/10 to-rose-600/5 border border-rose-500/15">
          <div className="absolute -top-6 -right-6 h-20 w-20 rounded-full bg-rose-500/10 blur-2xl" />
          <TrendingUp className="h-5 w-5 text-rose-400 mb-2" />
          <p className="text-[10px] sm:text-xs text-rose-300/70 uppercase tracking-widest font-medium">Net Revenue</p>
          <p className="text-xl sm:text-2xl lg:text-3xl font-bold text-foreground mt-1 whitespace-nowrap">{formatRevenue(netRevenue)}</p>
        </div>
      </div>

      {/* KPI Stats Row */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 sm:gap-3 mb-6 sm:mb-8">
        {[
          { label: 'Releases', value: releaseStats.total, icon: Disc3, accent: 'text-primary' },
          { label: 'Streams', value: formatStreams(totalStreams), icon: Headphones, accent: 'text-sky-400' },
          { label: 'Downloads', value: formatStreams(totalDownloads), icon: Download, accent: 'text-violet-400' },
          { label: 'Platforms', value: topStores.length, icon: Music, accent: 'text-amber-400' },
          ...(isSubLabelUser ? [] : [
            { label: 'CMS Channels', value: cmsChannels, icon: Youtube, accent: 'text-red-400' },
            { label: 'CMS Available', value: formatRevenue(cmsAvailable), icon: Monitor, accent: 'text-emerald-400' },
          ]),
          ...(isSubLabelUser ? [
            { label: 'Countries', value: countryData.length, icon: Globe, accent: 'text-emerald-400' },
            { label: 'Artists', value: topArtists.length, icon: Music, accent: 'text-pink-400' },
          ] : []),
        ].map((stat) => (
          <GlassCard key={stat.label} className="!p-3 sm:!p-4 group hover:scale-[1.02] transition-transform duration-300">
            <stat.icon className={`h-4 w-4 ${stat.accent} mb-1.5`} />
            <p className="text-[10px] sm:text-xs text-muted-foreground uppercase tracking-wider">{stat.label}</p>
            <p className="text-lg sm:text-xl font-bold text-foreground mt-0.5">{stat.value}</p>
          </GlassCard>
        ))}
      </div>

      {/* CMS Balance Summary (not for sub-label users) */}
      {!isSubLabelUser && cmsChannels > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 sm:gap-4 mb-6 sm:mb-8">
          <GlassCard className="!p-4 border-l-4 animate-fade-in" style={{ borderLeftColor: 'hsl(0, 67%, 40%)' }}>
            <div className="flex items-center gap-2 mb-1">
              <Youtube className="h-4 w-4 text-red-400" />
              <span className="text-[10px] text-muted-foreground uppercase tracking-widest font-medium">CMS Net Payable</span>
            </div>
            <p className="text-lg font-bold text-foreground">{formatRevenue(cmsRevenue)}</p>
          </GlassCard>
          <GlassCard className="!p-4 border-l-4 animate-fade-in" style={{ borderLeftColor: 'hsl(140, 60%, 40%)' }}>
            <div className="flex items-center gap-2 mb-1">
              <CheckCircle className="h-4 w-4 text-emerald-400" />
              <span className="text-[10px] text-muted-foreground uppercase tracking-widest font-medium">CMS Paid</span>
            </div>
            <p className="text-lg font-bold text-foreground">{formatRevenue(cmsPaid)}</p>
          </GlassCard>
          <GlassCard className="!p-4 border-l-4 animate-fade-in" style={{ borderLeftColor: 'hsl(45, 80%, 45%)' }}>
            <div className="flex items-center gap-2 mb-1">
              <Clock className="h-4 w-4 text-amber-400" />
              <span className="text-[10px] text-muted-foreground uppercase tracking-widest font-medium">CMS Pending</span>
            </div>
            <p className="text-lg font-bold text-foreground">{formatRevenue(cmsPending)}</p>
          </GlassCard>
          <GlassCard className="!p-4 border-l-4 animate-fade-in" style={{ borderLeftColor: 'hsl(200, 70%, 50%)' }}>
            <div className="flex items-center gap-2 mb-1">
              <Zap className="h-4 w-4 text-sky-400" />
              <span className="text-[10px] text-muted-foreground uppercase tracking-widest font-medium">CMS Available</span>
            </div>
            <p className="text-lg font-bold text-foreground">{formatRevenue(cmsAvailable)}</p>
          </GlassCard>
        </div>
      )}

      {/* Pending Releases */}
      {pendingReleases.length > 0 && (
        <GlassCard className="mb-6 sm:mb-8 animate-fade-in">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <div className="h-7 w-7 rounded-lg bg-primary/15 flex items-center justify-center">
                <Disc3 className="h-3.5 w-3.5 text-primary" />
              </div>
              Pending Releases
              <span className="ml-1 inline-flex items-center justify-center h-5 min-w-[20px] px-1.5 rounded-full text-[10px] font-bold bg-primary/20 text-primary">{pendingReleases.length}</span>
            </h3>
            <button onClick={() => navigate('/my-releases')} className="text-[10px] sm:text-xs text-primary hover:underline flex items-center gap-1">View All <ArrowRight className="h-3 w-3" /></button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {pendingReleases.map(r => (
              <div key={r.id} className="flex items-center justify-between gap-2 p-3 rounded-xl bg-muted/20 hover:bg-muted/30 transition-colors border border-border/30">
                <div className="min-w-0 flex-1">
                  <p className="text-xs sm:text-sm font-medium text-foreground truncate">{getReleaseName(r)}</p>
                  <p className="text-[10px] text-muted-foreground capitalize">{r.content_type}</p>
                </div>
                <span className="text-[10px] text-muted-foreground shrink-0">{format(new Date(r.created_at), 'dd MMM')}</span>
              </div>
            ))}
          </div>
        </GlassCard>
      )}

      {/* Revenue & Streams Trend - Premium Chart */}
      <GlassCard className="mb-6 sm:mb-8 animate-fade-in overflow-hidden">
        <h3 className="text-sm sm:text-base font-semibold text-foreground mb-5 flex items-center gap-2.5">
          <div className="h-8 w-8 rounded-xl bg-primary/15 flex items-center justify-center">
            <Activity className="h-4 w-4 text-primary" />
          </div>
          Revenue & Streams Trend
        </h3>
        {monthlyRevenue.length > 0 ? (
          <div className="h-56 sm:h-72 -mx-2">
            <ResponsiveContainer width="100%" height="100%" debounce={200}>
              <ComposedChart data={monthlyRevenue} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="userRevGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(0, 67%, 42%)" stopOpacity={0.4} />
                    <stop offset="50%" stopColor="hsl(0, 67%, 35%)" stopOpacity={0.15} />
                    <stop offset="100%" stopColor="hsl(0, 67%, 35%)" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="userStrGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(200, 70%, 55%)" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="hsl(200, 70%, 50%)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(0 0% 13%)" vertical={false} />
                <XAxis dataKey="month" tick={{ fill: 'hsl(0 0% 45%)', fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis yAxisId="left" tick={{ fill: 'hsl(0 0% 45%)', fontSize: 10 }} width={50} axisLine={false} tickLine={false} />
                <YAxis yAxisId="right" orientation="right" tick={{ fill: 'hsl(0 0% 45%)', fontSize: 10 }} width={50} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={tooltipStyle} />
                <Legend wrapperStyle={{ fontSize: '11px', color: 'hsl(0 0% 50%)', paddingTop: '12px' }} />
                <Area yAxisId="left" type="monotone" dataKey="revenue" stroke="hsl(0, 67%, 45%)" fill="url(#userRevGrad)" strokeWidth={2.5} name="Revenue (₹)" dot={{ r: 3, fill: 'hsl(0, 67%, 45%)', strokeWidth: 0 }} activeDot={{ r: 5, strokeWidth: 2, stroke: 'hsl(0, 67%, 55%)' }} isAnimationActive={false} />
                <Area yAxisId="right" type="monotone" dataKey="streams" stroke="hsl(200, 70%, 55%)" fill="url(#userStrGrad)" strokeWidth={2} name="Streams" dot={{ r: 2.5, fill: 'hsl(200, 70%, 55%)', strokeWidth: 0 }} isAnimationActive={false} />
                <Line yAxisId="right" type="monotone" dataKey="downloads" stroke="hsl(280, 60%, 55%)" strokeWidth={1.5} strokeDasharray="5 5" name="Downloads" dot={false} isAnimationActive={false} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="text-center py-20">
            <Activity className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-xs text-muted-foreground">No revenue data yet</p>
          </div>
        )}
      </GlassCard>

      {/* Release Status + Platform Distribution + Streams by Store - Asymmetric Bento */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6 sm:mb-8">
        {/* Release Donut - Compact */}
        <GlassCard className="md:col-span-2 animate-fade-in">
          <h3 className="text-xs sm:text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
            <div className="h-6 w-6 rounded-lg bg-primary/15 flex items-center justify-center">
              <Disc3 className="h-3 w-3 text-primary" />
            </div>
            Release Status
          </h3>
          {releaseStatusData.length > 0 ? (
            <>
              <div className="h-44 sm:h-52 relative">
                <ResponsiveContainer width="100%" height="100%" debounce={200}>
                  <PieChart>
                    <Pie data={releaseStatusData} cx="50%" cy="50%" innerRadius={45} outerRadius={68} dataKey="value" strokeWidth={0} paddingAngle={4} isAnimationActive={false}>
                      {releaseStatusData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                    </Pie>
                    <Tooltip contentStyle={tooltipStyle} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="text-center">
                    <p className="text-2xl font-bold text-foreground">{releaseStats.total}</p>
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Total</p>
                  </div>
                </div>
              </div>
              <div className="flex flex-wrap justify-center gap-3 mt-3">
                {releaseStatusData.map(d => (
                  <div key={d.name} className="flex items-center gap-1.5 text-[10px] sm:text-xs">
                    <div className="h-2 w-2 rounded-full" style={{ background: d.color }} />
                    <span className="text-muted-foreground">{d.name}: <span className="text-foreground font-semibold">{d.value}</span></span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="text-center py-16">
              <Disc3 className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
              <p className="text-xs text-muted-foreground">No releases yet</p>
            </div>
          )}
        </GlassCard>

        {/* Platform Distribution - Enhanced */}
        <GlassCard className="md:col-span-3 animate-fade-in">
          <h3 className="text-xs sm:text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
            <div className="h-6 w-6 rounded-lg bg-sky-500/15 flex items-center justify-center">
              <Play className="h-3 w-3 text-sky-400" />
            </div>
            Platform Distribution
          </h3>
          {topStores.length > 0 ? (
            <div className="space-y-3">
              {topStores.map((store) => {
                const pctStreams = totalStoreStreams > 0 ? (store.value / totalStoreStreams) * 100 : 0;
                const pctRevenue = totalStoreRevenue > 0 ? (store.revenue / totalStoreRevenue) * 100 : 0;
                return (
                  <div key={store.name} className="group">
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-2">
                        <div className="h-2.5 w-2.5 rounded-full" style={{ background: store.color }} />
                        <span className="text-xs text-foreground font-medium">{store.name}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-[10px] text-muted-foreground font-mono">{formatStreams(store.value)}</span>
                        <span className="text-[10px] text-emerald-400 font-mono">{formatRevenue(store.revenue)}</span>
                        <span className="text-[10px] text-muted-foreground/60 w-10 text-right">{pctStreams.toFixed(1)}%</span>
                      </div>
                    </div>
                    <div className="h-1.5 rounded-full bg-muted/30 overflow-hidden">
                      <div className="h-full rounded-full transition-all duration-700 group-hover:brightness-125" style={{ width: `${pctStreams}%`, background: store.color }} />
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-16">
              <Play className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
              <p className="text-xs text-muted-foreground">No platform data yet</p>
            </div>
          )}
        </GlassCard>
      </div>

      {/* Monthly Store Breakdown Bar Chart */}
      {monthlyStoreData.length > 0 && topStoreNames.length > 0 && (
        <GlassCard className="mb-6 sm:mb-8 animate-fade-in overflow-hidden">
          <h3 className="text-xs sm:text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
            <div className="h-6 w-6 rounded-lg bg-violet-500/15 flex items-center justify-center">
              <BarChart3 className="h-3 w-3 text-violet-400" />
            </div>
            Monthly Platform Streams
          </h3>
          <div className="h-48 sm:h-60 -mx-2">
            <ResponsiveContainer width="100%" height="100%" debounce={200}>
              <BarChart data={monthlyStoreData} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(0 0% 13%)" vertical={false} />
                <XAxis dataKey="month" tick={{ fill: 'hsl(0 0% 45%)', fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: 'hsl(0 0% 45%)', fontSize: 10 }} width={45} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={tooltipStyle} />
                <Legend wrapperStyle={{ fontSize: '10px', color: 'hsl(0 0% 50%)', paddingTop: '8px' }} />
                {topStoreNames.map((name, i) => (
                  <Bar key={name} dataKey={name} stackId="stores" fill={STORE_COLORS[name] || CHART_COLORS[i % CHART_COLORS.length]} radius={i === topStoreNames.length - 1 ? [4, 4, 0, 0] : [0, 0, 0, 0]} isAnimationActive={false} />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>
        </GlassCard>
      )}

      {/* Top Tracks + Top Artists + Country Map */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6 sm:mb-8">
        <GlassCard className="animate-fade-in">
          <h3 className="text-xs sm:text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
            <div className="h-6 w-6 rounded-lg bg-violet-500/15 flex items-center justify-center">
              <Music className="h-3 w-3 text-violet-400" />
            </div>
            Top Tracks
          </h3>
          {topTracks.length > 0 ? (
            <div className="space-y-2">
              {topTracks.map((track, i) => (
                <div key={track.name} className="flex items-center gap-3 p-3 rounded-xl bg-muted/15 hover:bg-muted/25 transition-colors border border-border/20">
                  <div className="h-8 w-8 rounded-lg flex items-center justify-center text-xs font-bold shrink-0" style={{ background: `${CHART_COLORS[i % CHART_COLORS.length]}22`, color: CHART_COLORS[i % CHART_COLORS.length] }}>
                    {i + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs sm:text-sm font-medium text-foreground truncate">{track.name}</p>
                    <p className="text-[10px] text-muted-foreground">{formatStreams(track.streams)} streams · {formatRevenue(track.revenue)}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <Music className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
              <p className="text-xs text-muted-foreground">No track data yet</p>
            </div>
          )}
        </GlassCard>

        <GlassCard className="animate-fade-in">
          <h3 className="text-xs sm:text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
            <div className="h-6 w-6 rounded-lg bg-amber-500/15 flex items-center justify-center">
              <Headphones className="h-3 w-3 text-amber-400" />
            </div>
            Top Artists
          </h3>
          {topArtists.length > 0 ? (
            <div className="space-y-2">
              {topArtists.map((artist, i) => (
                <div key={artist.name} className="flex items-center gap-3 p-3 rounded-xl bg-muted/15 hover:bg-muted/25 transition-colors border border-border/20">
                  <div className="h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0" style={{ background: `${CHART_COLORS[i % CHART_COLORS.length]}22`, color: CHART_COLORS[i % CHART_COLORS.length] }}>
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
            <div className="text-center py-12">
              <Headphones className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
              <p className="text-xs text-muted-foreground">No artist data yet</p>
            </div>
          )}
        </GlassCard>

        <GlassCard className="animate-fade-in">
          <h3 className="text-xs sm:text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
            <div className="h-6 w-6 rounded-lg bg-emerald-500/15 flex items-center justify-center">
              <Globe className="h-3 w-3 text-emerald-400" />
            </div>
            Top Countries
          </h3>
          {countryData.length > 0 ? (
            <WorldMapChart data={countryData} />
          ) : (
            <div className="text-center py-12">
              <Globe className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
              <p className="text-xs text-muted-foreground">No country data yet</p>
            </div>
          )}
        </GlassCard>
      </div>

      {/* Recent Releases */}
      <GlassCard className="mb-6 sm:mb-8 animate-fade-in">
        <h3 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
          <div className="h-6 w-6 rounded-lg bg-amber-500/15 flex items-center justify-center">
            <Disc3 className="h-3 w-3 text-amber-400" />
          </div>
          Recent Releases
        </h3>
        {recentReleases.length > 0 ? (
          <>
            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/40">
                    <th className="text-left py-2.5 px-3 text-muted-foreground font-medium text-xs uppercase tracking-wider">Release</th>
                    <th className="text-left py-2.5 px-3 text-muted-foreground font-medium text-xs uppercase tracking-wider">Type</th>
                    <th className="text-left py-2.5 px-3 text-muted-foreground font-medium text-xs uppercase tracking-wider">Status</th>
                    <th className="text-left py-2.5 px-3 text-muted-foreground font-medium text-xs uppercase tracking-wider">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {recentReleases.map((r: any) => (
                    <tr key={r.id} className="border-b border-border/20 hover:bg-muted/15 transition-colors">
                      <td className="py-3 px-3 text-foreground font-medium truncate max-w-[180px]">{getReleaseName(r)}</td>
                      <td className="py-3 px-3 text-muted-foreground capitalize text-xs">{r.content_type}</td>
                      <td className="py-3 px-3"><StatusBadge status={r.status} /></td>
                      <td className="py-3 px-3 text-muted-foreground text-xs">{format(new Date(r.created_at), 'dd MMM yyyy')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="sm:hidden space-y-2">
              {recentReleases.map((r: any) => (
                <div key={r.id} className="p-3 rounded-xl bg-muted/15 border border-border/20">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-medium text-foreground truncate">{getReleaseName(r)}</p>
                      <p className="text-[10px] text-muted-foreground capitalize">{r.content_type}</p>
                    </div>
                    <StatusBadge status={r.status} />
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-1.5">{format(new Date(r.created_at), 'dd MMM yyyy')}</p>
                </div>
              ))}
            </div>
          </>
        ) : (
          <div className="text-center py-8">
            <Disc3 className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
            <p className="text-xs text-muted-foreground">No releases yet</p>
          </div>
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
      const { data, error } = await supabase.from('tutorials').select('*').order('created_at', { ascending: false }).limit(3);
      if (error) throw error;
      return data;
    },
  });

  if (isLoading || tutorials.length === 0) return null;
  const stripHtml = (html: string) => { const tmp = document.createElement('div'); tmp.innerHTML = html; return tmp.textContent || tmp.innerText || ''; };

  return (
    <>
      <div className="mt-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm sm:text-lg font-semibold flex items-center gap-2.5">
            <div className="h-7 w-7 rounded-xl bg-primary/15 flex items-center justify-center">
              <BookOpen className="h-3.5 w-3.5 text-primary" />
            </div>
            Recent Tutorials
          </h2>
          <button onClick={() => navigate('/help-tutorials')} className="text-[10px] sm:text-xs text-primary hover:underline flex items-center gap-1">View All <ArrowRight className="h-3 w-3" /></button>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {tutorials.map((t: any) => (
            <GlassCard key={t.id} className="cursor-pointer hover:ring-1 hover:ring-primary/30 transition-all !p-4" onClick={() => setViewTutorial(t)}>
              <h3 className="text-xs sm:text-sm font-semibold text-foreground truncate mb-1">{t.title}</h3>
              <p className="text-[10px] text-muted-foreground line-clamp-2">{stripHtml(t.content)}</p>
              <p className="text-[9px] text-muted-foreground/50 mt-2">{format(new Date(t.created_at), 'dd MMM yyyy')}</p>
            </GlassCard>
          ))}
        </div>
      </div>
      <Dialog open={!!viewTutorial} onOpenChange={() => setViewTutorial(null)}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{viewTutorial?.title}</DialogTitle></DialogHeader>
          {viewTutorial && <TutorialContent html={viewTutorial.content} />}
        </DialogContent>
      </Dialog>
    </>
  );
}
