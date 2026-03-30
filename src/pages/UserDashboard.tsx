import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { WorldMapChart } from '@/components/WorldMapChart';
import { useQuery } from '@tanstack/react-query';
import { NoticePopup } from '@/components/NoticePopup';
import { DashboardLayout } from '@/components/DashboardLayout';
import { GlassCard } from '@/components/GlassCard';
import { StatusBadge } from '@/components/StatusBadge';
import { supabase } from '@/integrations/supabase/client';
import { formatStreams, formatRevenue } from '@/lib/formatNumbers';
import { fetchAllRows } from '@/lib/supabaseFetchAll';
import { applySnapshotCut, calculateAvailableBalance, getEffectiveRevenueCutPercent, shouldApplyRevenueCut, summarizeWithdrawals } from '@/lib/revenueCalculations';
import { useAuth } from '@/hooks/useAuth';
import { useImpersonate } from '@/hooks/useImpersonate';
import {
  Clock, CheckCircle, XCircle, Loader2, Copy, X, BookOpen, ArrowRight,
  Disc3, Wallet, DollarSign, BarChart3, Music, TrendingUp, TrendingDown,
  Activity, Globe, Headphones, Youtube, Monitor, Play, Film, Download,
  PieChart as PieChartIcon, Zap, Link2
} from 'lucide-react';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { TutorialContent } from '@/components/TutorialContent';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, BarChart, Bar, Legend,
  ComposedChart, Line
} from 'recharts';
import { format, subMonths } from 'date-fns';

const CHART_COLORS = [
  'hsl(0, 67%, 35%)', 'hsl(45, 80%, 45%)', 'hsl(140, 60%, 40%)',
  'hsl(200, 70%, 50%)', 'hsl(280, 60%, 50%)', 'hsl(30, 80%, 50%)',
  'hsl(170, 60%, 45%)', 'hsl(320, 60%, 50%)',
];

const STORE_COLORS: Record<string, string> = {
  Spotify: '#1DB954', 'Apple Music': '#FA2D48', 'YouTube Music': '#FF0000',
  YouTube: '#FF0000', JioSaavn: '#2BC5B4', Gaana: '#E72C30',
  Wynk: '#1E90FF', Amazon: '#FF9900', Hungama: '#EF2D56',
  Instagram: '#E1306C', Facebook: '#1877F2', TikTok: '#000000',
};

const tooltipStyle = {
  background: 'hsl(0 0% 5%)',
  border: '1px solid hsl(0 0% 16%)',
  borderRadius: '12px',
  color: 'hsl(0 0% 92%)',
  fontSize: '11px',
  boxShadow: '0 25px 50px rgba(0,0,0,0.5)',
  padding: '10px 14px',
};

const axisTickStyle = { fill: 'hsl(0 0% 40%)', fontSize: 10 };
const reportSelect = 'reporting_month, net_generated_revenue, streams, downloads, store, track, artist, country, cut_percent_snapshot, revenue_frozen';

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
  const [cmsRevenue, setCmsRevenue] = useState(0);
  const [cmsChannels, setCmsChannels] = useState(0);
  const [cmsPaid, setCmsPaid] = useState(0);
  const [cmsPending, setCmsPending] = useState(0);
  const [monthlyStoreData, setMonthlyStoreData] = useState<any[]>([]);
  const [topArtists, setTopArtists] = useState<{ name: string; streams: number }[]>([]);
  const [monthlyStreamsData, setMonthlyStreamsData] = useState<{ month: string; count: number }[]>([]);
  const [monthlyReleasesData, setMonthlyReleasesData] = useState<{ month: string; count: number }[]>([]);
  const [monthlyRevenueSparkline, setMonthlyRevenueSparkline] = useState<{ month: string; count: number }[]>([]);
  const [monthlyDownloadsData, setMonthlyDownloadsData] = useState<{ month: string; count: number }[]>([]);

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
    if (isFetchingRef.current) {
      shouldRefetchRef.current = true;
      return;
    }

    isFetchingRef.current = true;

    try {
      const [releaseRows, profileRes, subLabelRes, withdrawalRows, recentReleasesRes] = await Promise.all([
        fetchAllRows('releases', 'status, created_at', (query) => query.eq('user_id', effectiveUserId)),
        supabase.from('profiles').select('display_id, hidden_cut_percent').eq('user_id', effectiveUserId).single(),
        supabase.from('sub_labels').select('percentage_cut, parent_user_id').eq('sub_user_id', effectiveUserId).maybeSingle(),
        fetchAllRows('withdrawal_requests', 'status, amount', (query) => query.eq('user_id', effectiveUserId)),
        supabase.from('releases').select('id, album_name, ep_name, content_type, status, created_at, poster_url').eq('user_id', effectiveUserId).order('created_at', { ascending: false }).limit(5),
      ]);

      setReleaseStats({
        total: releaseRows.length,
        pending: releaseRows.filter((s: any) => s.status === 'pending').length,
        approved: releaseRows.filter((s: any) => s.status === 'approved').length,
        rejected: releaseRows.filter((s: any) => s.status === 'rejected').length,
      });
      setDisplayId(profileRes.data ? (profileRes.data as any).display_id : null);

      // Build monthly releases sparkline (last 6 months)
      const now = new Date();
      const monthlyRelMap: Record<string, number> = {};
      for (let i = 5; i >= 0; i--) {
        monthlyRelMap[format(subMonths(now, i), 'MMM')] = 0;
      }
      releaseRows.forEach((r: any) => {
        if (r.created_at) {
          const m = format(new Date(r.created_at), 'MMM');
          if (monthlyRelMap[m] !== undefined) monthlyRelMap[m]++;
        }
      });
      setMonthlyReleasesData(Object.entries(monthlyRelMap).map(([month, count]) => ({ month, count })));

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
          [reportData, ytReportData] = await Promise.all([
            fetchAllRows('report_entries', reportSelect, (query) => query.in('isrc', ownedIsrcs)),
            fetchAllRows('youtube_report_entries', reportSelect, (query) => query.in('isrc', ownedIsrcs)),
          ]);
        }
      } else {
        [reportData, ytReportData] = await Promise.all([
          fetchAllRows('report_entries', reportSelect, (query) => query.eq('user_id', effectiveUserId)),
          fetchAllRows('youtube_report_entries', reportSelect, (query) => query.eq('user_id', effectiveUserId)),
        ]);
      }

      if (!hasSubLabel) {
        const [cmsLinks, cmsEntries, cmsWithdrawals] = await Promise.all([
          fetchAllRows('youtube_cms_links', 'channel_name, cut_percent', (query) => query.eq('user_id', effectiveUserId).eq('status', 'linked')),
          fetchAllRows('cms_report_entries', 'net_generated_revenue, channel_name'),
          fetchAllRows('cms_withdrawal_requests', 'status, amount', (query) => query.eq('user_id', effectiveUserId)),
        ]);

        const linkedChannels = (cmsLinks as any[]) || [];
        setCmsChannels(linkedChannels.length);
        const linkedNames = new Set(linkedChannels.map((link) => link.channel_name));
        const userCmsEntries = ((cmsEntries as any[]) || []).filter((entry) => linkedNames.has(entry.channel_name));

        let cmsTotal = 0;
        userCmsEntries.forEach((entry) => {
          const rev = Number(entry.net_generated_revenue) || 0;
          const cut = Number(linkedChannels.find((link) => link.channel_name === entry.channel_name)?.cut_percent || 0);
          cmsTotal += rev - (rev * cut / 100);
        });

        setCmsRevenue(Math.round(cmsTotal * 100) / 100);

        const cmsWithdrawalRows = (cmsWithdrawals as any[]) || [];
        setCmsPaid(cmsWithdrawalRows.filter((w) => w.status === 'paid').reduce((sum, w) => sum + Number(w.amount), 0));
        setCmsPending(cmsWithdrawalRows.filter((w) => w.status === 'pending').reduce((sum, w) => sum + Number(w.amount), 0));
      } else {
        setCmsChannels(0);
        setCmsRevenue(0);
        setCmsPaid(0);
        setCmsPending(0);
      }

      const allReports = [...reportData, ...ytReportData];
      if (allReports.length > 0) {
        let totalRev = 0;
        let totalStr = 0;
        let totalDl = 0;
        const monthMap: Record<string, { revenue: number; streams: number; downloads: number }> = {};
        const storeMap: Record<string, { streams: number; revenue: number }> = {};
        const trackMap: Record<string, { streams: number; revenue: number }> = {};
        const countryMap: Record<string, number> = {};
        const artistMap: Record<string, number> = {};
        const monthStoreMap: Record<string, Record<string, number>> = {};
        // Sparkline maps for last 6 months
        const sparkStreamsMap: Record<string, number> = {};
        const sparkRevMap: Record<string, number> = {};
        const sparkDlMap: Record<string, number> = {};
        for (let i = 5; i >= 0; i--) {
          const key = format(subMonths(now, i), 'MMM');
          sparkStreamsMap[key] = 0;
          sparkRevMap[key] = 0;
          sparkDlMap[key] = 0;
        }

        allReports.forEach((r: any) => {
          const isFrozen = r.revenue_frozen === true;
          const grossRevenue = Number(r.net_generated_revenue || 0);
          const rev = isFrozen ? 0 : applySnapshotCut(grossRevenue, r.cut_percent_snapshot, effectiveCutPercent, shouldCut);
          const str = Number(r.streams || 0);
          const dl = Number(r.downloads || 0);
          totalRev += rev;
          totalStr += str;
          totalDl += dl;
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
          if (!monthStoreMap[month]) monthStoreMap[month] = {};
          monthStoreMap[month][store] = (monthStoreMap[month][store] || 0) + str;

          // Sparkline aggregation
          if (r.reporting_month) {
            try {
              const sparkMonth = format(new Date(r.reporting_month + '-01'), 'MMM');
              if (sparkStreamsMap[sparkMonth] !== undefined) {
                sparkStreamsMap[sparkMonth] += str;
                sparkRevMap[sparkMonth] += rev;
                sparkDlMap[sparkMonth] += dl;
              }
            } catch { /* ignore parse errors */ }
          }
        });

        setTotalRevenue(Math.round(totalRev * 100) / 100);
        setTotalStreams(totalStr);
        setTotalDownloads(totalDl);
        setMonthlyRevenue(Object.entries(monthMap).sort(([a], [b]) => a.localeCompare(b)).slice(-8).map(([month, data]) => ({ month, revenue: Math.round(data.revenue * 100) / 100, streams: data.streams, downloads: data.downloads })));
        setTopStores(Object.entries(storeMap).sort(([, a], [, b]) => b.streams - a.streams).slice(0, 8).map(([name, data]) => ({ name, value: data.streams, revenue: data.revenue, color: STORE_COLORS[name] || CHART_COLORS[0] })));
        setTopTracks(Object.entries(trackMap).sort(([, a], [, b]) => b.streams - a.streams).slice(0, 6).map(([name, data]) => ({ name: name.length > 22 ? `${name.substring(0, 22)}…` : name, streams: data.streams, revenue: data.revenue })));
        setCountryData(Object.entries(countryMap).sort(([, a], [, b]) => b - a).slice(0, 10).map(([name, streams]) => ({ name, streams })));
        setTopArtists(Object.entries(artistMap).sort(([, a], [, b]) => b - a).slice(0, 5).map(([name, streams]) => ({ name: name.length > 20 ? `${name.substring(0, 20)}…` : name, streams })));
        const topStoreNamesArr = Object.entries(storeMap).sort(([, a], [, b]) => b.streams - a.streams).slice(0, 4).map(([name]) => name);
        setMonthlyStoreData(Object.entries(monthStoreMap).sort(([a], [b]) => a.localeCompare(b)).slice(-6).map(([month, stores]) => {
          const row: any = { month };
          topStoreNamesArr.forEach((storeName) => { row[storeName] = stores[storeName] || 0; });
          return row;
        }));
        setMonthlyStreamsData(Object.entries(sparkStreamsMap).map(([month, count]) => ({ month, count })));
        setMonthlyRevenueSparkline(Object.entries(sparkRevMap).map(([month, count]) => ({ month, count: Math.round(count) })));
        setMonthlyDownloadsData(Object.entries(sparkDlMap).map(([month, count]) => ({ month, count })));
      } else {
        setTotalRevenue(0);
        setTotalStreams(0);
        setTotalDownloads(0);
        setMonthlyRevenue([]);
        setTopStores([]);
        setTopTracks([]);
        setCountryData([]);
        setTopArtists([]);
        setMonthlyStoreData([]);
        setMonthlyStreamsData([]);
        setMonthlyRevenueSparkline([]);
        setMonthlyDownloadsData([]);
      }

      setWithdrawalBalance(summarizeWithdrawals(withdrawalRows as any[]));
      setRecentReleases(recentReleasesRes.data || []);
    } catch (error) {
      console.error('Failed to load dashboard', error);
      toast.error('Failed to load dashboard data.');
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
    if (refreshTimeoutRef.current !== null) window.clearTimeout(refreshTimeoutRef.current);
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
    return <DashboardLayout><div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div></DashboardLayout>;
  }

  return (
    <DashboardLayout>
      {isImpersonating && (
        <div className="mb-4 sm:mb-6 p-3 sm:p-4 rounded-2xl bg-blue-500/10 border border-blue-500/20 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 animate-fade-in backdrop-blur-sm">
          <div className="min-w-0"><p className="text-xs sm:text-sm font-medium text-blue-400">Viewing as user</p><p className="text-[10px] sm:text-xs text-blue-300/60 break-all">{impersonatedEmail}</p></div>
          <button onClick={handleStopImpersonating} className="flex w-full sm:w-auto items-center justify-center gap-2 px-4 py-2 rounded-xl bg-blue-500/15 text-blue-400 text-xs font-medium hover:bg-blue-500/25 transition-all border border-blue-500/20"><X className="h-3.5 w-3.5" /> Back to Admin</button>
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

      {/* Hero Stats Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 mb-6 sm:mb-8">
        {[
          { label: 'Available', value: formatRevenue(availableRevenue), icon: DollarSign, gradient: 'from-emerald-500/12 to-emerald-600/5', border: 'border-emerald-500/15', iconColor: 'text-emerald-400', labelColor: 'text-emerald-300/70', glow: 'bg-emerald-500/10' },
          { label: 'Pending W/D', value: formatRevenue(withdrawalBalance.pending), icon: Clock, gradient: 'from-amber-500/12 to-amber-600/5', border: 'border-amber-500/15', iconColor: 'text-amber-400', labelColor: 'text-amber-300/70', glow: 'bg-amber-500/10' },
          { label: 'Paid', value: formatRevenue(withdrawalBalance.paid), icon: Wallet, gradient: 'from-sky-500/12 to-sky-600/5', border: 'border-sky-500/15', iconColor: 'text-sky-400', labelColor: 'text-sky-300/70', glow: 'bg-sky-500/10' },
          { label: 'Net Revenue', value: formatRevenue(netRevenue), icon: TrendingUp, gradient: 'from-rose-500/12 to-rose-600/5', border: 'border-rose-500/15', iconColor: 'text-rose-400', labelColor: 'text-rose-300/70', glow: 'bg-rose-500/10' },
        ].map((stat) => (
          <div key={stat.label} className={`relative overflow-hidden rounded-2xl p-4 sm:p-5 bg-gradient-to-br ${stat.gradient} ${stat.border} border`}>
            <div className={`absolute -top-8 -right-8 h-24 w-24 rounded-full ${stat.glow} blur-3xl`} />
            <stat.icon className={`h-5 w-5 ${stat.iconColor} mb-2`} />
            <p className={`text-[10px] sm:text-xs ${stat.labelColor} uppercase tracking-widest font-medium`}>{stat.label}</p>
            <p className="text-2xl sm:text-3xl font-bold text-foreground mt-1 whitespace-nowrap">{stat.value}</p>
          </div>
        ))}
      </div>

      {/* Secondary Compact Stats */}
      <div className="grid grid-cols-3 sm:grid-cols-3 lg:grid-cols-6 gap-2 sm:gap-3 mb-6 sm:mb-8">
        {[
          { label: 'Releases', value: releaseStats.total, icon: Disc3, accent: 'text-primary' },
          { label: 'Streams', value: formatStreams(totalStreams), icon: Headphones, accent: 'text-sky-400' },
          { label: 'Downloads', value: formatStreams(totalDownloads), icon: Download, accent: 'text-violet-400' },
          { label: 'Platforms', value: topStores.length, icon: Music, accent: 'text-amber-400' },
          ...(isSubLabelUser ? [
            { label: 'Countries', value: countryData.length, icon: Globe, accent: 'text-emerald-400' },
            { label: 'Artists', value: topArtists.length, icon: Headphones, accent: 'text-pink-400' },
          ] : [
            { label: 'CMS Channels', value: cmsChannels, icon: Youtube, accent: 'text-red-400' },
            { label: 'CMS Balance', value: formatRevenue(cmsAvailable), icon: Monitor, accent: 'text-emerald-400' },
          ]),
        ].map((stat) => (
          <GlassCard key={stat.label} className="!p-3 group hover:scale-[1.02] transition-transform duration-300">
            <stat.icon className={`h-3.5 w-3.5 ${stat.accent} mb-1`} />
            <p className="text-[9px] sm:text-[10px] text-muted-foreground uppercase tracking-wider leading-tight">{stat.label}</p>
            <p className="text-sm sm:text-base font-bold text-foreground mt-0.5 whitespace-nowrap">{stat.value}</p>
          </GlassCard>
        ))}
      </div>

      {/* CMS Balance (not for sub-label users) */}
      {!isSubLabelUser && cmsChannels > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 mb-6 sm:mb-8">
          {[
            { label: 'CMS Net Payable', value: formatRevenue(cmsRevenue), icon: Youtube, color: 'hsl(0, 67%, 40%)', iconColor: 'text-red-400' },
            { label: 'CMS Paid', value: formatRevenue(cmsPaid), icon: CheckCircle, color: 'hsl(140, 60%, 40%)', iconColor: 'text-emerald-400' },
            { label: 'CMS Pending', value: formatRevenue(cmsPending), icon: Clock, color: 'hsl(45, 80%, 45%)', iconColor: 'text-amber-400' },
            { label: 'CMS Balance', value: formatRevenue(cmsAvailable), icon: Zap, color: 'hsl(200, 70%, 50%)', iconColor: 'text-sky-400' },
          ].map((stat) => (
            <GlassCard key={stat.label} className="!p-4 border-l-4 animate-fade-in" style={{ borderLeftColor: stat.color }}>
              <div className="flex items-center gap-2 mb-2">
                <stat.icon className={`h-4 w-4 ${stat.iconColor}`} />
                <span className="text-[10px] sm:text-xs text-muted-foreground uppercase tracking-widest font-medium">{stat.label}</span>
              </div>
              <p className="text-xl font-bold text-foreground">{stat.value}</p>
            </GlassCard>
          ))}
        </div>
      )}

      {/* Sparkline Overview Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6 sm:mb-8">
        <SparklineCard title="Monthly Streams" data={monthlyStreamsData} color="hsl(200, 70%, 50%)" icon={Headphones} iconBg="bg-sky-500/15" iconColor="text-sky-400" total={formatStreams(totalStreams)} />
        <SparklineCard title="Monthly Revenue" data={monthlyRevenueSparkline} color="hsl(0, 67%, 45%)" icon={DollarSign} iconBg="bg-primary/15" iconColor="text-primary" total={formatRevenue(totalRevenue)} />
        <SparklineCard title="Monthly Downloads" data={monthlyDownloadsData} color="hsl(280, 60%, 50%)" icon={Download} iconBg="bg-violet-500/15" iconColor="text-violet-400" total={formatStreams(totalDownloads)} />
        <SparklineCard title="New Releases" data={monthlyReleasesData} color="hsl(45, 80%, 50%)" icon={Disc3} iconBg="bg-amber-500/15" iconColor="text-amber-400" total={releaseStats.total} />
      </div>

      {/* Pending Releases */}
      {pendingReleases.length > 0 && (
        <GlassCard className="mb-6 sm:mb-8 animate-fade-in">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <div className="h-7 w-7 rounded-lg bg-primary/15 flex items-center justify-center"><Disc3 className="h-3.5 w-3.5 text-primary" /></div>
              Pending Releases
              <span className="ml-1 inline-flex items-center justify-center h-5 min-w-[20px] px-1.5 rounded-full text-[10px] font-bold bg-primary/20 text-primary">{pendingReleases.length}</span>
            </h3>
            <button onClick={() => navigate('/my-releases')} className="text-[10px] sm:text-xs text-primary hover:underline flex items-center gap-1">View All <ArrowRight className="h-3 w-3" /></button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {pendingReleases.map(r => (
              <div key={r.id} className="flex items-center justify-between gap-2 p-3 rounded-xl bg-muted/15 hover:bg-muted/25 transition-colors border border-border/20">
                <div className="min-w-0 flex-1"><p className="text-xs sm:text-sm font-medium text-foreground truncate">{getReleaseName(r)}</p><p className="text-[10px] text-muted-foreground capitalize">{r.content_type}</p></div>
                <span className="text-[10px] text-muted-foreground shrink-0">{format(new Date(r.created_at), 'dd MMM')}</span>
              </div>
            ))}
          </div>
        </GlassCard>
      )}

      {/* Revenue & Streams Trend */}
      <GlassCard className="mb-6 sm:mb-8 animate-fade-in overflow-hidden">
        <h3 className="text-sm sm:text-base font-semibold text-foreground mb-5 flex items-center gap-2.5">
          <div className="h-8 w-8 rounded-xl bg-primary/15 flex items-center justify-center"><Activity className="h-4 w-4 text-primary" /></div>
          Revenue, Streams & Downloads Trend
        </h3>
        {monthlyRevenue.length > 0 ? (
          <div className="h-64 sm:h-80 -mx-2">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={monthlyRevenue} margin={{ top: 10, right: 15, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="userRevGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(0, 67%, 42%)" stopOpacity={0.5} />
                    <stop offset="60%" stopColor="hsl(0, 67%, 35%)" stopOpacity={0.1} />
                    <stop offset="100%" stopColor="hsl(0, 67%, 35%)" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="userStrGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(200, 70%, 55%)" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="hsl(200, 70%, 50%)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(0 0% 12%)" vertical={false} />
                <XAxis dataKey="month" tick={axisTickStyle} axisLine={false} tickLine={false} />
                <YAxis yAxisId="left" tick={axisTickStyle} width={55} axisLine={false} tickLine={false} tickFormatter={(v) => formatRevenue(v)} />
                <YAxis yAxisId="right" orientation="right" tick={axisTickStyle} width={50} axisLine={false} tickLine={false} tickFormatter={(v) => formatStreams(v)} />
                <Tooltip contentStyle={tooltipStyle} formatter={(value: number, name: string) => [name.includes('Revenue') ? formatRevenue(value) : formatStreams(value), name]} />
                <Legend wrapperStyle={{ fontSize: '11px', color: 'hsl(0 0% 50%)', paddingTop: '12px' }} />
                <Area yAxisId="left" type="monotone" dataKey="revenue" stroke="hsl(0, 67%, 45%)" fill="url(#userRevGrad)" strokeWidth={2.5} name="Revenue (₹)" dot={{ r: 4, fill: 'hsl(0 0% 6%)', stroke: 'hsl(0, 67%, 45%)', strokeWidth: 2 }} activeDot={{ r: 6, strokeWidth: 2, stroke: 'hsl(0, 67%, 55%)', fill: 'hsl(0, 67%, 45%)' }} isAnimationActive={false} />
                <Area yAxisId="right" type="monotone" dataKey="streams" stroke="hsl(200, 70%, 55%)" fill="url(#userStrGrad)" strokeWidth={2} name="Streams" dot={{ r: 3, fill: 'hsl(0 0% 6%)', stroke: 'hsl(200, 70%, 55%)', strokeWidth: 2 }} isAnimationActive={false} />
                <Line yAxisId="right" type="monotone" dataKey="downloads" stroke="hsl(280, 60%, 55%)" strokeWidth={1.5} strokeDasharray="6 4" name="Downloads" dot={false} isAnimationActive={false} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        ) : <EmptyChart icon={Activity} text="No revenue data yet" />}
      </GlassCard>

      {/* 3-Column: Release Status + Platform Distribution + Monthly Store Breakdown */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6 sm:mb-8">
        {/* Release Status Donut */}
        <GlassCard className="animate-fade-in">
          <SectionHeader icon={Disc3} iconBg="bg-primary/15" iconColor="text-primary" title="Release Status" />
          {releaseStatusData.length > 0 ? (
            <>
              <div className="h-48 sm:h-56 relative">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={releaseStatusData} cx="50%" cy="50%" innerRadius={50} outerRadius={75} dataKey="value" strokeWidth={0} paddingAngle={4} isAnimationActive={false}>
                      {releaseStatusData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                    </Pie>
                    <Tooltip contentStyle={tooltipStyle} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="text-center">
                    <p className="text-3xl font-bold text-foreground">{releaseStats.total}</p>
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
          ) : <EmptyChart icon={Disc3} text="No releases yet" />}
        </GlassCard>

        {/* Platform Distribution */}
        <GlassCard className="animate-fade-in">
          <SectionHeader icon={Play} iconBg="bg-sky-500/15" iconColor="text-sky-400" title="Platform Distribution" />
          {topStores.length > 0 ? (
            <div className="space-y-3">
              {topStores.map((store) => {
                const pct = totalStoreStreams > 0 ? (store.value / totalStoreStreams) * 100 : 0;
                return (
                  <div key={store.name} className="group">
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-2">
                        <div className="h-2.5 w-2.5 rounded-full shrink-0" style={{ background: store.color }} />
                        <span className="text-xs text-foreground font-medium">{store.name}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-muted-foreground font-mono">{formatStreams(store.value)}</span>
                        <span className="text-[10px] text-emerald-400 font-mono">{formatRevenue(store.revenue)}</span>
                        <span className="text-[10px] text-muted-foreground/60 w-10 text-right">{pct.toFixed(1)}%</span>
                      </div>
                    </div>
                    <div className="h-1.5 rounded-full bg-muted/30 overflow-hidden">
                      <div className="h-full rounded-full transition-all duration-700 group-hover:brightness-125" style={{ width: `${pct}%`, background: store.color }} />
                    </div>
                  </div>
                );
              })}
            </div>
          ) : <EmptyChart icon={Play} text="No platform data yet" />}
        </GlassCard>

        {/* Monthly Store Stacked Bar */}
        <GlassCard className="animate-fade-in">
          <SectionHeader icon={BarChart3} iconBg="bg-violet-500/15" iconColor="text-violet-400" title="Monthly Platform Streams" />
          {monthlyStoreData.length > 0 ? (
            <div className="h-48 sm:h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthlyStoreData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(0 0% 12%)" vertical={false} />
                  <XAxis dataKey="month" tick={axisTickStyle} axisLine={false} tickLine={false} />
                  <YAxis tick={axisTickStyle} width={35} axisLine={false} tickLine={false} tickFormatter={(v) => formatStreams(v)} />
                  <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => [formatStreams(v), undefined]} />
                  {topStoreNames.map((name, i) => (
                    <Bar key={name} dataKey={name} stackId="stores" fill={STORE_COLORS[name] || CHART_COLORS[i % CHART_COLORS.length]} radius={i === topStoreNames.length - 1 ? [4, 4, 0, 0] : [0, 0, 0, 0]} isAnimationActive={false} />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : <EmptyChart icon={BarChart3} text="No data" />}
        </GlassCard>
      </div>

      {/* Top Tracks + Top Artists + Country Map */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6 sm:mb-8">
        <GlassCard className="animate-fade-in">
          <SectionHeader icon={Music} iconBg="bg-rose-500/15" iconColor="text-rose-400" title="Top Tracks" />
          {topTracks.length > 0 ? (
            <div className="space-y-2">
              {topTracks.map((track, i) => (
                <RankItem key={track.name} rank={i + 1} name={track.name} sub={`${formatStreams(track.streams)} streams · ${formatRevenue(track.revenue)}`} color={CHART_COLORS[i % CHART_COLORS.length]} />
              ))}
            </div>
          ) : <EmptyChart icon={Music} text="No track data yet" />}
        </GlassCard>

        <GlassCard className="animate-fade-in">
          <SectionHeader icon={Headphones} iconBg="bg-amber-500/15" iconColor="text-amber-400" title="Top Artists" />
          {topArtists.length > 0 ? (
            <div className="space-y-2">
              {topArtists.map((artist, i) => (
                <RankItem key={artist.name} rank={i + 1} name={artist.name} sub={`${formatStreams(artist.streams)} streams`} color={CHART_COLORS[i % CHART_COLORS.length]} rounded />
              ))}
            </div>
          ) : <EmptyChart icon={Headphones} text="No artist data yet" />}
        </GlassCard>

        <GlassCard className="animate-fade-in">
          <SectionHeader icon={Globe} iconBg="bg-emerald-500/15" iconColor="text-emerald-400" title="Streams by Country" />
          {countryData.length > 0 ? <WorldMapChart data={countryData} /> : <EmptyChart icon={Globe} text="No country data yet" />}
        </GlassCard>
      </div>

      {/* Recent Releases */}
      <GlassCard className="mb-6 sm:mb-8 animate-fade-in">
        <SectionHeader icon={Disc3} iconBg="bg-amber-500/15" iconColor="text-amber-400" title="Recent Releases" />
        {recentReleases.length > 0 ? (
          <>
            <div className="responsive-table-wrap">
              <table className="w-full text-sm min-w-max">
                <thead>
                  <tr className="border-b border-border/40">
                    {['Release', 'Type', 'Status', 'Date'].map(h => <th key={h} className="text-left py-2.5 px-3 text-muted-foreground font-medium text-xs uppercase tracking-wider">{h}</th>)}
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
                    <div className="min-w-0 flex-1"><p className="text-xs font-medium text-foreground truncate">{getReleaseName(r)}</p><p className="text-[10px] text-muted-foreground capitalize">{r.content_type}</p></div>
                    <StatusBadge status={r.status} />
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-1.5">{format(new Date(r.created_at), 'dd MMM yyyy')}</p>
                </div>
              ))}
            </div>
          </>
        ) : <EmptyChart icon={Disc3} text="No releases yet" />}
      </GlassCard>

      <RecentTutorialsWidget />
      <NoticePopup />
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
  return <div className="text-center py-16"><Icon className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" /><p className="text-xs text-muted-foreground">{text}</p></div>;
}

function RankItem({ rank, name, sub, color, rounded }: { rank: number; name: string; sub: string; color: string; rounded?: boolean }) {
  return (
    <div className="flex items-center gap-3 p-3 rounded-xl bg-muted/15 hover:bg-muted/25 transition-colors border border-border/20">
      <div className={`h-8 w-8 ${rounded ? 'rounded-full' : 'rounded-lg'} flex items-center justify-center text-xs font-bold shrink-0`} style={{ background: `${color}22`, color }}>{rank}</div>
      <div className="flex-1 min-w-0">
        <p className="text-xs sm:text-sm font-medium text-foreground truncate">{name}</p>
        <p className="text-[10px] text-muted-foreground">{sub}</p>
      </div>
    </div>
  );
}

function SparklineCard({ title, data, color, icon: Icon, iconBg, iconColor, total }: {
  title: string; data: { month: string; count: number }[]; color: string; icon: any; iconBg: string; iconColor: string; total: string | number;
}) {
  return (
    <GlassCard className="animate-fade-in !p-4 overflow-hidden">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className={`h-6 w-6 rounded-lg ${iconBg} flex items-center justify-center`}><Icon className={`h-3 w-3 ${iconColor}`} /></div>
          <span className="text-xs font-semibold text-foreground">{title}</span>
        </div>
        <span className="text-lg font-bold text-foreground whitespace-nowrap">{total}</span>
      </div>
      <div className="h-16">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id={`spark-user-${title.replace(/\s/g, '')}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={color} stopOpacity={0.35} />
                <stop offset="100%" stopColor={color} stopOpacity={0} />
              </linearGradient>
            </defs>
            <Area type="monotone" dataKey="count" stroke={color} fill={`url(#spark-user-${title.replace(/\s/g, '')})`} strokeWidth={2} dot={false} isAnimationActive={false} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
      <div className="flex justify-between text-[9px] text-muted-foreground/60 mt-1">
        {data.map(d => <span key={d.month}>{d.month}</span>)}
      </div>
    </GlassCard>
  );
}

type TutorialPreview = {
  id: string;
  subject: string;
  content: string;
  created_at: string;
};

function RecentTutorialsWidget() {
  const navigate = useNavigate();
  const [viewTutorial, setViewTutorial] = useState<TutorialPreview | null>(null);
  const { data: tutorials = [], isLoading } = useQuery<TutorialPreview[]>({
    queryKey: ['recent-tutorials'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tutorials')
        .select('id, subject, content, created_at')
        .order('created_at', { ascending: false })
        .limit(3);
      if (error) throw error;
      return (data || []) as TutorialPreview[];
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
      <div className="mt-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm sm:text-lg font-semibold flex items-center gap-2.5">
            <div className="h-7 w-7 rounded-xl bg-primary/15 flex items-center justify-center"><BookOpen className="h-3.5 w-3.5 text-primary" /></div>
            Recent Tutorials
          </h2>
          <button onClick={() => navigate('/help-tutorials')} className="text-[10px] sm:text-xs text-primary hover:underline flex items-center gap-1">View All <ArrowRight className="h-3 w-3" /></button>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {tutorials.map((tutorial) => (
            <GlassCard key={tutorial.id} className="cursor-pointer hover:ring-1 hover:ring-primary/30 transition-all !p-4" onClick={() => setViewTutorial(tutorial)}>
              <h3 className="text-xs sm:text-sm font-semibold text-foreground truncate mb-1">{tutorial.subject}</h3>
              <p className="text-[10px] text-muted-foreground line-clamp-2">{stripHtml(tutorial.content || '')}</p>
              <p className="text-[9px] text-muted-foreground/50 mt-2">{format(new Date(tutorial.created_at), 'dd MMM yyyy')}</p>
            </GlassCard>
          ))}
        </div>
      </div>
      {viewTutorial && (
        <Dialog open={!!viewTutorial} onOpenChange={(open) => !open && setViewTutorial(null)}>
          <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
            <DialogHeader><DialogTitle>{viewTutorial.subject}</DialogTitle></DialogHeader>
            <TutorialContent html={viewTutorial.content || ''} />
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}
