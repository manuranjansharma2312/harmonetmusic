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
  TrendingUp, TrendingDown, Music, BarChart3, Activity, DollarSign, Globe,
  Youtube, Film, PenTool, Monitor, Download, Headphones, Play, Zap, Link2
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, AreaChart, Area, Legend, ComposedChart, Line, RadialBarChart, RadialBar
} from 'recharts';
import { format, subMonths } from 'date-fns';
import { useNavigate } from 'react-router-dom';

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
  const [totalDownloads, setTotalDownloads] = useState(0);
  const [monthlyRevenue, setMonthlyRevenue] = useState<{ month: string; revenue: number; streams: number; downloads: number }[]>([]);
  const [topStores, setTopStores] = useState<{ name: string; value: number; revenue: number; color: string }[]>([]);
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
  const [cmsLinkCount, setCmsLinkCount] = useState(0);
  const [cmsTotalRevenue, setCmsTotalRevenue] = useState(0);
  const [pendingCmsLinks, setPendingCmsLinks] = useState(0);
  const [cmsWithdrawalPending, setCmsWithdrawalPending] = useState(0);
  const [videoSubmissionCount, setVideoSubmissionCount] = useState(0);
  const [vevoChannelCount, setVevoChannelCount] = useState(0);
  const [pendingVideoCount, setPendingVideoCount] = useState(0);
  const [pendingVevoCount, setPendingVevoCount] = useState(0);
  const [monthlyVevo, setMonthlyVevo] = useState<{ month: string; count: number }[]>([]);
  const [monthlyCmsLinked, setMonthlyCmsLinked] = useState<{ month: string; count: number }[]>([]);
  const [signatureDocCount, setSignatureDocCount] = useState(0);
  const [transferCount, setTransferCount] = useState(0);
  const [monthlyStoreData, setMonthlyStoreData] = useState<any[]>([]);
  const [topStoreNames, setTopStoreNames] = useState<string[]>([]);
  // Combined growth chart
  const [growthData, setGrowthData] = useState<{ month: string; artists: number; releases: number; vevo: number; cms: number }[]>([]);

  useEffect(() => { fetchAll(); }, []);

  async function fetchAll() {
    try {
    const [
      releasesRes, profilesRes, labelsRes, subLabelsRes,
      withdrawalsRes, contentRes, reportRes, ytReportRes,
      pendingLabelsRes, pendingReleasesRes, pendingContentRes, pendingWithdrawalsRes,
      recentReleasesRes,
      cmsLinksRes, cmsEntriesRes, cmsWdRes,
      videoSubsRes, vevoSubsRes, signatureDocsRes, transfersRes
    ] = await Promise.all([
      supabase.from('releases').select('status, created_at'),
      supabase.from('profiles').select('id, created_at'),
      supabase.from('labels').select('id'),
      supabase.from('sub_labels').select('id'),
      supabase.from('withdrawal_requests').select('status, amount'),
      supabase.from('content_requests').select('id, status').eq('status', 'pending'),
      supabase.from('report_entries').select('reporting_month, net_generated_revenue, streams, downloads, store, track, artist, country'),
      supabase.from('youtube_report_entries').select('reporting_month, net_generated_revenue, streams, downloads, store, track, artist, country'),
      supabase.from('labels').select('id, label_name, created_at').eq('status', 'pending').order('created_at', { ascending: false }).limit(5),
      supabase.from('releases').select('id, album_name, ep_name, content_type, release_type, created_at').eq('status', 'pending').order('created_at', { ascending: false }).limit(5),
      supabase.from('content_requests').select('id, request_type, song_title, artist_name, created_at').eq('status', 'pending').order('created_at', { ascending: false }).limit(5),
      supabase.from('withdrawal_requests').select('id, amount, created_at, user_id').eq('status', 'pending').order('created_at', { ascending: false }).limit(5),
      supabase.from('releases').select('id, album_name, ep_name, content_type, status, created_at').order('created_at', { ascending: false }).limit(5),
      supabase.from('youtube_cms_links' as any).select('id, status, created_at'),
      supabase.from('cms_report_entries' as any).select('net_generated_revenue'),
      supabase.from('cms_withdrawal_requests' as any).select('status, amount'),
      supabase.from('video_submissions' as any).select('id, status, created_at').eq('submission_type', 'upload_video'),
      supabase.from('video_submissions' as any).select('id, status, created_at').eq('submission_type', 'vevo_channel'),
      supabase.from('signature_documents').select('id'),
      supabase.from('release_transfers').select('id'),
    ]);

    if (releasesRes.data) {
      const d = releasesRes.data;
      setReleaseStats({ total: d.length, pending: d.filter(s => s.status === 'pending').length, approved: d.filter(s => s.status === 'approved').length, rejected: d.filter(s => s.status === 'rejected').length });
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

    const cmsLinks = (cmsLinksRes.data as any[]) || [];
    setCmsLinkCount(cmsLinks.filter(l => l.status === 'linked').length);
    setPendingCmsLinks(cmsLinks.filter(l => l.status === 'pending_review' || l.status === 'reviewing').length);
    const cmsEntries = (cmsEntriesRes.data as any[]) || [];
    setCmsTotalRevenue(cmsEntries.reduce((s, e) => s + (Number(e.net_generated_revenue) || 0), 0));
    const cmsWds = (cmsWdRes.data as any[]) || [];
    setCmsWithdrawalPending(cmsWds.filter(w => w.status === 'pending').length);

    const videoSubs = (videoSubsRes.data as any[]) || [];
    setVideoSubmissionCount(videoSubs.length);
    setPendingVideoCount(videoSubs.filter(v => v.status === 'pending').length);
    const vevoSubs = (vevoSubsRes.data as any[]) || [];
    setVevoChannelCount(vevoSubs.length);
    setPendingVevoCount(vevoSubs.filter(v => v.status === 'pending').length);
    setSignatureDocCount((signatureDocsRes.data || []).length);
    setTransferCount((transfersRes.data || []).length);

    // Include vevo reports in total analytics
    const { data: vevoReportData } = await supabase
      .from('vevo_report_entries')
      .select('reporting_month, net_generated_revenue, streams, downloads, store, track, artist, country');
    const allReports = [...(reportRes.data || []), ...(ytReportRes.data || []), ...(vevoReportData || [])];
    if (allReports.length > 0) {
      let totalRev = 0, totalStr = 0, totalDl = 0;
      const monthMap: Record<string, { revenue: number; streams: number; downloads: number }> = {};
      const storeMap: Record<string, { streams: number; revenue: number }> = {};
      const trackMap: Record<string, number> = {};
      const artistMap: Record<string, number> = {};
      const countryMap: Record<string, number> = {};
      const monthStoreMap: Record<string, Record<string, number>> = {};

      allReports.forEach((r: any) => {
        const rev = Number(r.net_generated_revenue || 0);
        const str = Number(r.streams || 0);
        const dl = Number(r.downloads || 0);
        totalRev += rev; totalStr += str; totalDl += dl;
        const month = r.reporting_month?.length > 7 ? r.reporting_month.substring(0, 7) : r.reporting_month;
        if (!monthMap[month]) monthMap[month] = { revenue: 0, streams: 0, downloads: 0 };
        monthMap[month].revenue += rev; monthMap[month].streams += str; monthMap[month].downloads += dl;
        const store = r.store || 'Unknown';
        if (!storeMap[store]) storeMap[store] = { streams: 0, revenue: 0 };
        storeMap[store].streams += str; storeMap[store].revenue += rev;
        if (r.track) trackMap[r.track] = (trackMap[r.track] || 0) + str;
        if (r.artist) artistMap[r.artist] = (artistMap[r.artist] || 0) + str;
        if (r.country) countryMap[r.country] = (countryMap[r.country] || 0) + str;
        if (!monthStoreMap[month]) monthStoreMap[month] = {};
        monthStoreMap[month][store] = (monthStoreMap[month][store] || 0) + str;
      });

      setTotalRevenue(totalRev);
      setTotalStreams(totalStr);
      setTotalDownloads(totalDl);
      setMonthlyRevenue(Object.entries(monthMap).sort(([a], [b]) => a.localeCompare(b)).slice(-8).map(([month, data]) => ({ month, revenue: Math.round(data.revenue * 100) / 100, streams: data.streams, downloads: data.downloads })));
      const sortedStores = Object.entries(storeMap).sort(([, a], [, b]) => b.streams - a.streams);
      setTopStores(sortedStores.slice(0, 8).map(([name, data]) => ({ name, value: data.streams, revenue: data.revenue, color: STORE_COLORS[name] || CHART_COLORS[0] })));
      setTopTracks(Object.entries(trackMap).sort(([, a], [, b]) => b - a).slice(0, 5).map(([name, streams]) => ({ name: name.length > 25 ? name.substring(0, 25) + '…' : name, streams })));
      setTopArtists(Object.entries(artistMap).sort(([, a], [, b]) => b - a).slice(0, 5).map(([name, streams]) => ({ name: name.length > 20 ? name.substring(0, 20) + '…' : name, streams })));
      setCountryData(Object.entries(countryMap).sort(([, a], [, b]) => b - a).slice(0, 10).map(([name, streams]) => ({ name, streams })));
      const topSNames = sortedStores.slice(0, 4).map(([n]) => n);
      setTopStoreNames(topSNames);
      setMonthlyStoreData(Object.entries(monthStoreMap).sort(([a], [b]) => a.localeCompare(b)).slice(-6).map(([month, stores]) => {
        const row: any = { month };
        topSNames.forEach(s => { row[s] = stores[s] || 0; });
        return row;
      }));
    }

    // Build combined growth data (last 6 months)
    const now = new Date();
    const monthlyRelMap: Record<string, number> = {};
    const monthlyUserMap: Record<string, number> = {};
    const monthlyVevoMap: Record<string, number> = {};
    const monthlyCmsMap: Record<string, number> = {};
    for (let i = 5; i >= 0; i--) {
      const key = format(subMonths(now, i), 'MMM');
      monthlyRelMap[key] = 0; monthlyUserMap[key] = 0; monthlyVevoMap[key] = 0; monthlyCmsMap[key] = 0;
    }
    if (releasesRes.data) releasesRes.data.forEach((r: any) => { const m = format(new Date(r.created_at), 'MMM'); if (monthlyRelMap[m] !== undefined) monthlyRelMap[m]++; });
    if (profilesRes.data) (profilesRes.data as any[]).forEach((p: any) => { const m = format(new Date(p.created_at), 'MMM'); if (monthlyUserMap[m] !== undefined) monthlyUserMap[m]++; });
    if (vevoSubsRes.data) (vevoSubsRes.data as any[]).forEach((v: any) => { const m = format(new Date(v.created_at), 'MMM'); if (monthlyVevoMap[m] !== undefined) monthlyVevoMap[m]++; });
    cmsLinks.forEach((c: any) => { if (c.status === 'linked' && c.created_at) { const m = format(new Date(c.created_at), 'MMM'); if (monthlyCmsMap[m] !== undefined) monthlyCmsMap[m]++; } });

    setMonthlyReleases(Object.entries(monthlyRelMap).map(([month, count]) => ({ month, count })));
    setMonthlyUsers(Object.entries(monthlyUserMap).map(([month, count]) => ({ month, count })));
    setMonthlyVevo(Object.entries(monthlyVevoMap).map(([month, count]) => ({ month, count })));
    setMonthlyCmsLinked(Object.entries(monthlyCmsMap).map(([month, count]) => ({ month, count })));

    // Combined growth data
    const growthKeys = Object.keys(monthlyRelMap);
    setGrowthData(growthKeys.map(month => ({
      month,
      artists: monthlyUserMap[month] || 0,
      releases: monthlyRelMap[month] || 0,
      vevo: monthlyVevoMap[month] || 0,
      cms: monthlyCmsMap[month] || 0,
    })));

    } catch (err) {
      console.error('AdminDashboard fetchAll error:', err);
    } finally {
      setLoading(false);
    }
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
    { name: 'Pending', value: releaseStats.pending, color: 'hsl(45, 80%, 45%)' },
    { name: 'Approved', value: releaseStats.approved, color: 'hsl(140, 60%, 40%)' },
    { name: 'Rejected', value: releaseStats.rejected, color: 'hsl(0, 67%, 45%)' },
  ].filter(d => d.value > 0);

  const getReleaseName = (r: any) => r.album_name || r.ep_name || r.content_type || 'Untitled';
  const formatRequestType = (type: string) => type.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  const totalStoreStreams = topStores.reduce((a, b) => a + b.value, 0);
  const totalActionItems = releaseStats.pending + contentRequestCount + pendingCmsLinks + pendingVideoCount + pendingVevoCount + cmsWithdrawalPending + withdrawalStats.pending;

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
            <p className="text-2xl sm:text-3xl font-bold text-foreground mt-1 whitespace-nowrap">{stat.value}</p>
            {stat.sub && <p className="text-[10px] text-muted-foreground mt-1">{stat.sub}</p>}
          </div>
        ))}
      </div>

      {/* Secondary Compact Stats */}
      <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-8 gap-2 sm:gap-3 mb-6 sm:mb-8">
        {[
          { label: 'Labels', value: labelCount, icon: Tag, accent: 'text-amber-400' },
          { label: 'Sub Labels', value: subLabelCount, icon: UsersRound, accent: 'text-sky-400' },
          { label: 'Downloads', value: formatStreams(totalDownloads), icon: Download, accent: 'text-violet-400' },
          { label: 'CMS Links', value: cmsLinkCount, icon: Link2, accent: 'text-red-400' },
          { label: 'CMS Revenue', value: formatRevenue(cmsTotalRevenue), icon: Monitor, accent: 'text-emerald-400' },
          { label: 'Videos', value: videoSubmissionCount, icon: Film, accent: 'text-violet-400' },
          { label: 'Vevo', value: vevoChannelCount, icon: Play, accent: 'text-pink-400' },
          { label: 'Transfers', value: transferCount, icon: TrendingUp, accent: 'text-sky-400' },
        ].map((stat) => (
          <GlassCard key={stat.label} className="!p-3 group hover:scale-[1.02] transition-transform duration-300">
            <stat.icon className={`h-3.5 w-3.5 ${stat.accent} mb-1`} />
            <p className="text-[9px] sm:text-[10px] text-muted-foreground uppercase tracking-wider leading-tight">{stat.label}</p>
            <p className="text-sm sm:text-base font-bold text-foreground mt-0.5 whitespace-nowrap">{stat.value}</p>
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
          <GlassCard key={stat.label} className="!p-4 border-l-4 animate-fade-in" style={{ borderLeftColor: stat.color }}>
            <div className="flex items-center gap-2 mb-2">
              <stat.icon className={`h-4 w-4 ${stat.iconColor}`} />
              <span className="text-[10px] sm:text-xs text-muted-foreground uppercase tracking-widest font-medium">{stat.label}</span>
            </div>
            <p className="text-xl font-bold text-foreground">{stat.value}</p>
            <p className="text-[10px] text-muted-foreground mt-1">{stat.sub}</p>
          </GlassCard>
        ))}
      </div>

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
                  <linearGradient id="admRevGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(0, 67%, 42%)" stopOpacity={0.5} />
                    <stop offset="60%" stopColor="hsl(0, 67%, 35%)" stopOpacity={0.1} />
                    <stop offset="100%" stopColor="hsl(0, 67%, 35%)" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="admStrGrad" x1="0" y1="0" x2="0" y2="1">
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
                <Area yAxisId="left" type="monotone" dataKey="revenue" stroke="hsl(0, 67%, 45%)" fill="url(#admRevGrad)" strokeWidth={2.5} name="Revenue (₹)" dot={{ r: 4, fill: 'hsl(0 0% 6%)', stroke: 'hsl(0, 67%, 45%)', strokeWidth: 2 }} activeDot={{ r: 6, strokeWidth: 2, stroke: 'hsl(0, 67%, 55%)', fill: 'hsl(0, 67%, 45%)' }} />
                <Area yAxisId="right" type="monotone" dataKey="streams" stroke="hsl(200, 70%, 55%)" fill="url(#admStrGrad)" strokeWidth={2} name="Streams" dot={{ r: 3, fill: 'hsl(0 0% 6%)', stroke: 'hsl(200, 70%, 55%)', strokeWidth: 2 }} />
                <Line yAxisId="right" type="monotone" dataKey="downloads" stroke="hsl(280, 60%, 55%)" strokeWidth={1.5} strokeDasharray="6 4" name="Downloads" dot={false} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        ) : <EmptyChart icon={Activity} text="No revenue data yet" />}
      </GlassCard>

      {/* Platform Growth Overview — Combined Chart */}
      <GlassCard className="mb-6 sm:mb-8 animate-fade-in overflow-hidden">
        <h3 className="text-sm sm:text-base font-semibold text-foreground mb-5 flex items-center gap-2.5">
          <div className="h-8 w-8 rounded-xl bg-sky-500/15 flex items-center justify-center"><TrendingUp className="h-4 w-4 text-sky-400" /></div>
          Platform Growth — Last 6 Months
        </h3>
        {growthData.some(d => d.artists + d.releases + d.vevo + d.cms > 0) ? (
          <div className="h-64 sm:h-72 -mx-2">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={growthData} margin={{ top: 10, right: 15, left: 0, bottom: 0 }} barGap={2}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(0 0% 12%)" vertical={false} />
                <XAxis dataKey="month" tick={axisTickStyle} axisLine={false} tickLine={false} />
                <YAxis tick={axisTickStyle} width={30} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip contentStyle={tooltipStyle} />
                <Legend wrapperStyle={{ fontSize: '11px', color: 'hsl(0 0% 50%)', paddingTop: '12px' }} />
                <Bar dataKey="artists" name="New Artists" fill="hsl(200, 70%, 50%)" radius={[4, 4, 0, 0]} maxBarSize={28} />
                <Bar dataKey="releases" name="New Releases" fill="hsl(45, 80%, 45%)" radius={[4, 4, 0, 0]} maxBarSize={28} />
                <Bar dataKey="vevo" name="Vevo Submissions" fill="hsl(330, 60%, 50%)" radius={[4, 4, 0, 0]} maxBarSize={28} />
                <Bar dataKey="cms" name="CMS Linked" fill="hsl(0, 67%, 40%)" radius={[4, 4, 0, 0]} maxBarSize={28} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : <EmptyChart icon={TrendingUp} text="No growth data yet" />}
      </GlassCard>

      {/* Individual Growth Sparklines */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6 sm:mb-8">
        <SparklineCard title="New Artists" data={monthlyUsers} color="hsl(200, 70%, 50%)" icon={Users} iconBg="bg-sky-500/15" iconColor="text-sky-400" total={monthlyUsers.reduce((s, d) => s + d.count, 0)} />
        <SparklineCard title="New Releases" data={monthlyReleases} color="hsl(45, 80%, 50%)" icon={Disc3} iconBg="bg-amber-500/15" iconColor="text-amber-400" total={monthlyReleases.reduce((s, d) => s + d.count, 0)} />
        <SparklineCard title="Vevo Submissions" data={monthlyVevo} color="hsl(330, 60%, 50%)" icon={Play} iconBg="bg-pink-500/15" iconColor="text-pink-400" total={monthlyVevo.reduce((s, d) => s + d.count, 0)} />
        <SparklineCard title="CMS Linked" data={monthlyCmsLinked} color="hsl(0, 67%, 40%)" icon={Link2} iconBg="bg-primary/15" iconColor="text-primary" total={monthlyCmsLinked.reduce((s, d) => s + d.count, 0)} />
      </div>

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
                    <Pie data={releaseStatusData} cx="50%" cy="50%" innerRadius={50} outerRadius={75} dataKey="value" strokeWidth={0} paddingAngle={4}>
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
          ) : <EmptyChart icon={Disc3} text="No release data" />}
        </GlassCard>

        {/* Platform Distribution */}
        <GlassCard className="animate-fade-in">
          <SectionHeader icon={Music} iconBg="bg-sky-500/15" iconColor="text-sky-400" title="Platform Distribution" />
          {topStores.length > 0 ? (
            <div className="space-y-3">
              {topStores.map((store, idx) => {
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
          ) : <EmptyChart icon={Music} text="No platform data" />}
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
                    <Bar key={name} dataKey={name} stackId="stores" fill={STORE_COLORS[name] || CHART_COLORS[i % CHART_COLORS.length]} radius={i === topStoreNames.length - 1 ? [4, 4, 0, 0] : [0, 0, 0, 0]} />
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
                <RankItem key={track.name} rank={i + 1} name={track.name} sub={`${formatStreams(track.streams)} streams`} color={CHART_COLORS[i % CHART_COLORS.length]} />
              ))}
            </div>
          ) : <EmptyChart icon={Music} text="No track data" />}
        </GlassCard>

        <GlassCard className="animate-fade-in">
          <SectionHeader icon={Headphones} iconBg="bg-amber-500/15" iconColor="text-amber-400" title="Top Artists" />
          {topArtists.length > 0 ? (
            <div className="space-y-2">
              {topArtists.map((artist, i) => (
                <RankItem key={artist.name} rank={i + 1} name={artist.name} sub={`${formatStreams(artist.streams)} streams`} color={CHART_COLORS[i % CHART_COLORS.length]} rounded />
              ))}
            </div>
          ) : <EmptyChart icon={Headphones} text="No artist data" />}
        </GlassCard>

        <GlassCard className="animate-fade-in">
          <SectionHeader icon={Globe} iconBg="bg-emerald-500/15" iconColor="text-emerald-400" title="Streams by Country" />
          {countryData.length > 0 ? <WorldMapChart data={countryData} /> : <EmptyChart icon={Globe} text="No country data" />}
        </GlassCard>
      </div>

      {/* Pending Requests Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6 sm:mb-8">
        <PendingListCard title="Pending Releases" icon={Disc3} items={pendingReleases} emptyText="No pending releases" onViewAll={() => navigate('/admin/submissions')}
          renderItem={(r) => (
            <div key={r.id} className="flex items-center justify-between gap-2 p-3 rounded-xl bg-muted/15 hover:bg-muted/25 transition-colors border border-border/20">
              <div className="min-w-0 flex-1"><p className="text-xs sm:text-sm font-medium text-foreground truncate">{getReleaseName(r)}</p><p className="text-[10px] text-muted-foreground capitalize">{r.content_type}</p></div>
              <span className="text-[10px] text-muted-foreground shrink-0">{format(new Date(r.created_at), 'dd MMM')}</span>
            </div>
          )} />
        <PendingListCard title="Pending Content Requests" icon={MessageSquare} items={pendingContentRequests} emptyText="No pending requests" onViewAll={() => navigate('/admin/content-requests')}
          renderItem={(c) => (
            <div key={c.id} className="flex items-center justify-between gap-2 p-3 rounded-xl bg-muted/15 hover:bg-muted/25 transition-colors border border-border/20">
              <div className="min-w-0 flex-1"><p className="text-xs sm:text-sm font-medium text-foreground truncate">{formatRequestType(c.request_type)}</p><p className="text-[10px] text-muted-foreground truncate">{c.song_title || c.artist_name || '—'}</p></div>
              <span className="text-[10px] text-muted-foreground shrink-0">{format(new Date(c.created_at), 'dd MMM')}</span>
            </div>
          )} />
        <PendingListCard title="Pending Labels" icon={Tag} items={pendingLabels} emptyText="No pending labels" onViewAll={() => navigate('/admin/labels')}
          renderItem={(l) => (
            <div key={l.id} className="flex items-center justify-between gap-2 p-3 rounded-xl bg-muted/15 hover:bg-muted/25 transition-colors border border-border/20">
              <div className="min-w-0 flex-1"><p className="text-xs sm:text-sm font-medium text-foreground truncate">{l.label_name}</p></div>
              <span className="text-[10px] text-muted-foreground shrink-0">{format(new Date(l.created_at), 'dd MMM')}</span>
            </div>
          )} />
        <PendingListCard title="Pending Withdrawals" icon={Wallet} items={pendingWithdrawals} emptyText="No pending withdrawals" onViewAll={() => navigate('/admin/revenue')}
          renderItem={(w) => (
            <div key={w.id} className="flex items-center justify-between gap-2 p-3 rounded-xl bg-muted/15 hover:bg-muted/25 transition-colors border border-border/20">
              <div className="min-w-0 flex-1"><p className="text-sm font-bold text-foreground">₹{Number(w.amount).toLocaleString()}</p><p className="text-[10px] text-muted-foreground">{format(new Date(w.created_at), 'dd MMM yyyy')}</p></div>
              <StatusBadge status="pending" />
            </div>
          )} />
      </div>

      {/* Recent Releases */}
      <GlassCard className="animate-fade-in">
        <SectionHeader icon={Disc3} iconBg="bg-amber-500/15" iconColor="text-amber-400" title="Recent Releases" />
        {recentReleases.length > 0 ? (
          <>
            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full text-sm">
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
  title: string; data: { month: string; count: number }[]; color: string; icon: any; iconBg: string; iconColor: string; total: number;
}) {
  return (
    <GlassCard className="animate-fade-in !p-4 overflow-hidden">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className={`h-6 w-6 rounded-lg ${iconBg} flex items-center justify-center`}><Icon className={`h-3 w-3 ${iconColor}`} /></div>
          <span className="text-xs font-semibold text-foreground">{title}</span>
        </div>
        <span className="text-lg font-bold text-foreground">{total}</span>
      </div>
      <div className="h-16">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id={`spark-${title.replace(/\s/g, '')}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={color} stopOpacity={0.35} />
                <stop offset="100%" stopColor={color} stopOpacity={0} />
              </linearGradient>
            </defs>
            <Area type="monotone" dataKey="count" stroke={color} fill={`url(#spark-${title.replace(/\s/g, '')})`} strokeWidth={2} dot={false} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
      <div className="flex justify-between text-[9px] text-muted-foreground/60 mt-1">
        {data.map(d => <span key={d.month}>{d.month}</span>)}
      </div>
    </GlassCard>
  );
}

function PendingListCard({ title, icon: Icon, items, emptyText, onViewAll, renderItem }: {
  title: string; icon: any; items: any[]; emptyText: string; onViewAll: () => void; renderItem: (item: any) => React.ReactNode;
}) {
  return (
    <GlassCard className="animate-fade-in">
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
