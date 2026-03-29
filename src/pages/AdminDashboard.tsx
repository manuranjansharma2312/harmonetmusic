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
  Youtube, Film, PenTool, Monitor, Download, Headphones, Play, Zap
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, AreaChart, Area, Legend, ComposedChart, Line
} from 'recharts';
import { format, subMonths } from 'date-fns';
import { useNavigate } from 'react-router-dom';

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

  // CMS stats
  const [cmsLinkCount, setCmsLinkCount] = useState(0);
  const [cmsTotalRevenue, setCmsTotalRevenue] = useState(0);
  const [pendingCmsLinks, setPendingCmsLinks] = useState(0);
  const [cmsWithdrawalPending, setCmsWithdrawalPending] = useState(0);

  // Video & Vevo stats
  const [videoSubmissionCount, setVideoSubmissionCount] = useState(0);
  const [vevoChannelCount, setVevoChannelCount] = useState(0);
  const [pendingVideoCount, setPendingVideoCount] = useState(0);
  const [pendingVevoCount, setPendingVevoCount] = useState(0);
  const [monthlyVevo, setMonthlyVevo] = useState<{ month: string; count: number }[]>([]);

  // Signature stats
  const [signatureDocCount, setSignatureDocCount] = useState(0);

  // Transfer stats
  const [transferCount, setTransferCount] = useState(0);

  // Monthly store breakdown
  const [monthlyStoreData, setMonthlyStoreData] = useState<any[]>([]);
  const [topStoreNames, setTopStoreNames] = useState<string[]>([]);

  useEffect(() => { fetchAll(); }, []);

  async function fetchAll() {
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
      // CMS
      supabase.from('youtube_cms_links' as any).select('id, status'),
      supabase.from('cms_report_entries' as any).select('net_generated_revenue'),
      supabase.from('cms_withdrawal_requests' as any).select('status, amount'),
      // Video & Vevo
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

    // CMS
    const cmsLinks = (cmsLinksRes.data as any[]) || [];
    setCmsLinkCount(cmsLinks.filter(l => l.status === 'linked').length);
    setPendingCmsLinks(cmsLinks.filter(l => l.status === 'pending_review' || l.status === 'reviewing').length);
    const cmsEntries = (cmsEntriesRes.data as any[]) || [];
    setCmsTotalRevenue(cmsEntries.reduce((s, e) => s + (Number(e.net_generated_revenue) || 0), 0));
    const cmsWds = (cmsWdRes.data as any[]) || [];
    setCmsWithdrawalPending(cmsWds.filter(w => w.status === 'pending').length);

    // Video & Vevo
    const videoSubs = (videoSubsRes.data as any[]) || [];
    setVideoSubmissionCount(videoSubs.length);
    setPendingVideoCount(videoSubs.filter(v => v.status === 'pending').length);
    const vevoSubs = (vevoSubsRes.data as any[]) || [];
    setVevoChannelCount(vevoSubs.length);
    setPendingVevoCount(vevoSubs.filter(v => v.status === 'pending').length);
    setSignatureDocCount((signatureDocsRes.data || []).length);
    setTransferCount((transfersRes.data || []).length);

    const allReports = [...(reportRes.data || []), ...(ytReportRes.data || [])];

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
        monthMap[month].revenue += rev;
        monthMap[month].streams += str;
        monthMap[month].downloads += dl;
        const store = r.store || 'Unknown';
        if (!storeMap[store]) storeMap[store] = { streams: 0, revenue: 0 };
        storeMap[store].streams += str;
        storeMap[store].revenue += rev;
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

    // Monthly releases + users + vevo trend (last 6 months)
    const now = new Date();
    const monthlyRelMap: Record<string, number> = {};
    const monthlyUserMap: Record<string, number> = {};
    const monthlyVevoMap: Record<string, number> = {};
    for (let i = 5; i >= 0; i--) {
      const key = format(subMonths(now, i), 'MMM');
      monthlyRelMap[key] = 0;
      monthlyUserMap[key] = 0;
      monthlyVevoMap[key] = 0;
    }
    if (releasesRes.data) releasesRes.data.forEach((r: any) => { const m = format(new Date(r.created_at), 'MMM'); if (monthlyRelMap[m] !== undefined) monthlyRelMap[m]++; });
    if (profilesRes.data) (profilesRes.data as any[]).forEach((p: any) => { const m = format(new Date(p.created_at), 'MMM'); if (monthlyUserMap[m] !== undefined) monthlyUserMap[m]++; });
    if (vevoSubsRes.data) (vevoSubsRes.data as any[]).forEach((v: any) => { const m = format(new Date(v.created_at), 'MMM'); if (monthlyVevoMap[m] !== undefined) monthlyVevoMap[m]++; });
    setMonthlyReleases(Object.entries(monthlyRelMap).map(([month, count]) => ({ month, count })));
    setMonthlyUsers(Object.entries(monthlyUserMap).map(([month, count]) => ({ month, count })));
    setMonthlyVevo(Object.entries(monthlyVevoMap).map(([month, count]) => ({ month, count })));
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

      {/* Hero Stats - Gradient Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 mb-6 sm:mb-8">
        <div className="relative overflow-hidden rounded-2xl p-4 sm:p-5 bg-gradient-to-br from-sky-500/10 to-sky-600/5 border border-sky-500/15">
          <div className="absolute -top-8 -right-8 h-24 w-24 rounded-full bg-sky-500/10 blur-3xl" />
          <Users className="h-5 w-5 text-sky-400 mb-2" />
          <p className="text-[10px] sm:text-xs text-sky-300/70 uppercase tracking-widest font-medium">Total Users</p>
          <p className="text-2xl sm:text-3xl font-bold text-foreground mt-1">{userCount}</p>
        </div>
        <div className="relative overflow-hidden rounded-2xl p-4 sm:p-5 bg-gradient-to-br from-emerald-500/10 to-emerald-600/5 border border-emerald-500/15">
          <div className="absolute -top-8 -right-8 h-24 w-24 rounded-full bg-emerald-500/10 blur-3xl" />
          <DollarSign className="h-5 w-5 text-emerald-400 mb-2" />
          <p className="text-[10px] sm:text-xs text-emerald-300/70 uppercase tracking-widest font-medium">Total Revenue</p>
          <p className="text-2xl sm:text-3xl font-bold text-foreground mt-1 whitespace-nowrap">{formatRevenue(totalRevenue)}</p>
        </div>
        <div className="relative overflow-hidden rounded-2xl p-4 sm:p-5 bg-gradient-to-br from-violet-500/10 to-violet-600/5 border border-violet-500/15">
          <div className="absolute -top-8 -right-8 h-24 w-24 rounded-full bg-violet-500/10 blur-3xl" />
          <BarChart3 className="h-5 w-5 text-violet-400 mb-2" />
          <p className="text-[10px] sm:text-xs text-violet-300/70 uppercase tracking-widest font-medium">Total Streams</p>
          <p className="text-2xl sm:text-3xl font-bold text-foreground mt-1">{formatStreams(totalStreams)}</p>
        </div>
        <div className="relative overflow-hidden rounded-2xl p-4 sm:p-5 bg-gradient-to-br from-rose-500/10 to-rose-600/5 border border-rose-500/15">
          <div className="absolute -top-8 -right-8 h-24 w-24 rounded-full bg-rose-500/10 blur-3xl" />
          <Disc3 className="h-5 w-5 text-rose-400 mb-2" />
          <p className="text-[10px] sm:text-xs text-rose-300/70 uppercase tracking-widest font-medium">Releases</p>
          <p className="text-2xl sm:text-3xl font-bold text-foreground mt-1">{releaseStats.total}</p>
          <div className="flex gap-2 mt-1">
            <span className="text-[10px] text-emerald-400">{releaseStats.approved} live</span>
            <span className="text-[10px] text-amber-400">{releaseStats.pending} pending</span>
          </div>
        </div>
      </div>

      {/* Secondary Stats Grid */}
      <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-8 gap-2 sm:gap-3 mb-6 sm:mb-8">
        {[
          { label: 'Labels', value: labelCount, icon: Tag, accent: 'text-amber-400' },
          { label: 'Sub Labels', value: subLabelCount, icon: UsersRound, accent: 'text-sky-400' },
          { label: 'Downloads', value: formatStreams(totalDownloads), icon: Download, accent: 'text-violet-400' },
          { label: 'CMS Links', value: cmsLinkCount, icon: Youtube, accent: 'text-red-400' },
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

      {/* Financial Summary + Action Required */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 sm:gap-4 mb-6 sm:mb-8">
        <GlassCard className="!p-4 border-l-4 animate-fade-in" style={{ borderLeftColor: 'hsl(45, 80%, 45%)' }}>
          <div className="flex items-center gap-2 mb-2">
            <Clock className="h-4 w-4 text-amber-400" />
            <span className="text-[10px] sm:text-xs text-muted-foreground uppercase tracking-widest font-medium">Pending W/D</span>
          </div>
          <p className="text-xl font-bold text-foreground">{formatRevenue(withdrawalStats.pendingAmount)}</p>
          <p className="text-[10px] text-muted-foreground mt-1">{withdrawalStats.pending} requests</p>
        </GlassCard>
        <GlassCard className="!p-4 border-l-4 animate-fade-in" style={{ borderLeftColor: 'hsl(140, 60%, 40%)' }}>
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle className="h-4 w-4 text-emerald-400" />
            <span className="text-[10px] sm:text-xs text-muted-foreground uppercase tracking-widest font-medium">Total Paid</span>
          </div>
          <p className="text-xl font-bold text-foreground">{formatRevenue(withdrawalStats.totalAmount)}</p>
          <p className="text-[10px] text-muted-foreground mt-1">{withdrawalStats.paid} completed</p>
        </GlassCard>
        <GlassCard className="!p-4 border-l-4 animate-fade-in" style={{ borderLeftColor: 'hsl(0, 67%, 40%)' }}>
          <div className="flex items-center gap-2 mb-2">
            <PenTool className="h-4 w-4 text-pink-400" />
            <span className="text-[10px] sm:text-xs text-muted-foreground uppercase tracking-widest font-medium">E-Signatures</span>
          </div>
          <p className="text-xl font-bold text-foreground">{signatureDocCount}</p>
          <p className="text-[10px] text-muted-foreground mt-1">documents total</p>
        </GlassCard>
        <GlassCard className="!p-4 border-l-4 animate-fade-in" style={{ borderLeftColor: 'hsl(0, 67%, 35%)' }}>
          <div className="flex items-center gap-2 mb-2">
            <Activity className="h-4 w-4 text-primary" />
            <span className="text-[10px] sm:text-xs text-muted-foreground uppercase tracking-widest font-medium">Action Required</span>
          </div>
          <p className="text-xl font-bold text-foreground">{totalActionItems}</p>
          <p className="text-[10px] text-muted-foreground mt-1">total pending items</p>
        </GlassCard>
      </div>

      {/* Revenue & Streams Trend */}
      <GlassCard className="mb-6 sm:mb-8 animate-fade-in overflow-hidden">
        <h3 className="text-sm sm:text-base font-semibold text-foreground mb-5 flex items-center gap-2.5">
          <div className="h-8 w-8 rounded-xl bg-primary/15 flex items-center justify-center">
            <Activity className="h-4 w-4 text-primary" />
          </div>
          Revenue, Streams & Downloads Trend
        </h3>
        {monthlyRevenue.length > 0 ? (
          <div className="h-56 sm:h-72 -mx-2">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={monthlyRevenue} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="admRevGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(0, 67%, 42%)" stopOpacity={0.4} />
                    <stop offset="50%" stopColor="hsl(0, 67%, 35%)" stopOpacity={0.15} />
                    <stop offset="100%" stopColor="hsl(0, 67%, 35%)" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="admStrGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(200, 70%, 55%)" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="hsl(200, 70%, 50%)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(0 0% 13%)" vertical={false} />
                <XAxis dataKey="month" tick={{ fill: 'hsl(0 0% 45%)', fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis yAxisId="left" tick={{ fill: 'hsl(0 0% 45%)', fontSize: 10 }} width={55} axisLine={false} tickLine={false} />
                <YAxis yAxisId="right" orientation="right" tick={{ fill: 'hsl(0 0% 45%)', fontSize: 10 }} width={55} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={tooltipStyle} />
                <Legend wrapperStyle={{ fontSize: '11px', color: 'hsl(0 0% 50%)', paddingTop: '12px' }} />
                <Area yAxisId="left" type="monotone" dataKey="revenue" stroke="hsl(0, 67%, 45%)" fill="url(#admRevGrad)" strokeWidth={2.5} name="Revenue (₹)" dot={{ r: 3, fill: 'hsl(0, 67%, 45%)', strokeWidth: 0 }} activeDot={{ r: 5, strokeWidth: 2, stroke: 'hsl(0, 67%, 55%)' }} />
                <Area yAxisId="right" type="monotone" dataKey="streams" stroke="hsl(200, 70%, 55%)" fill="url(#admStrGrad)" strokeWidth={2} name="Streams" dot={{ r: 2.5, fill: 'hsl(200, 70%, 55%)', strokeWidth: 0 }} />
                <Line yAxisId="right" type="monotone" dataKey="downloads" stroke="hsl(280, 60%, 55%)" strokeWidth={1.5} strokeDasharray="5 5" name="Downloads" dot={false} />
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

      {/* Growth Charts Row: Users, Releases, Vevo */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6 sm:mb-8">
        <GlassCard className="animate-fade-in">
          <h3 className="text-xs sm:text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
            <div className="h-6 w-6 rounded-lg bg-sky-500/15 flex items-center justify-center">
              <Users className="h-3 w-3 text-sky-400" />
            </div>
            New Artists (6 Mo)
          </h3>
          <div className="h-44 sm:h-52">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthlyUsers}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(0 0% 13%)" vertical={false} />
                <XAxis dataKey="month" tick={{ fill: 'hsl(0 0% 45%)', fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: 'hsl(0 0% 45%)', fontSize: 10 }} width={30} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={tooltipStyle} />
                <Bar dataKey="count" name="New Artists" radius={[8, 8, 0, 0]}>
                  {monthlyUsers.map((_, i) => <Cell key={i} fill={`hsl(200, 70%, ${30 + i * 6}%)`} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </GlassCard>

        <GlassCard className="animate-fade-in">
          <h3 className="text-xs sm:text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
            <div className="h-6 w-6 rounded-lg bg-amber-500/15 flex items-center justify-center">
              <Disc3 className="h-3 w-3 text-amber-400" />
            </div>
            New Releases (6 Mo)
          </h3>
          <div className="h-44 sm:h-52">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={monthlyReleases}>
                <defs>
                  <linearGradient id="admRelTrend" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(45, 80%, 45%)" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="hsl(45, 80%, 45%)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(0 0% 13%)" vertical={false} />
                <XAxis dataKey="month" tick={{ fill: 'hsl(0 0% 45%)', fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: 'hsl(0 0% 45%)', fontSize: 10 }} width={30} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={tooltipStyle} />
                <Area type="monotone" dataKey="count" stroke="hsl(45, 80%, 50%)" fill="url(#admRelTrend)" strokeWidth={2.5} name="Releases" dot={{ r: 3, fill: 'hsl(45, 80%, 50%)', strokeWidth: 0 }} activeDot={{ r: 5, strokeWidth: 2, stroke: 'hsl(45, 80%, 60%)' }} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </GlassCard>

        <GlassCard className="animate-fade-in">
          <h3 className="text-xs sm:text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
            <div className="h-6 w-6 rounded-lg bg-pink-500/15 flex items-center justify-center">
              <Play className="h-3 w-3 text-pink-400" />
            </div>
            Vevo Submissions (6 Mo)
          </h3>
          <div className="h-44 sm:h-52">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthlyVevo}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(0 0% 13%)" vertical={false} />
                <XAxis dataKey="month" tick={{ fill: 'hsl(0 0% 45%)', fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: 'hsl(0 0% 45%)', fontSize: 10 }} width={30} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={tooltipStyle} />
                <Bar dataKey="count" name="Vevo" radius={[8, 8, 0, 0]}>
                  {monthlyVevo.map((_, i) => <Cell key={i} fill={`hsl(330, 60%, ${30 + i * 6}%)`} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </GlassCard>
      </div>

      {/* 3-Column: Release Status + Platform Distribution + Monthly Store Breakdown */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6 sm:mb-8">
        {/* Release Status Donut */}
        <GlassCard className="animate-fade-in">
          <h3 className="text-xs sm:text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
            <div className="h-6 w-6 rounded-lg bg-primary/15 flex items-center justify-center">
              <Disc3 className="h-3 w-3 text-primary" />
            </div>
            Release Status
          </h3>
          {releaseStatusData.length > 0 ? (
            <>
              <div className="h-44 sm:h-52 relative">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={releaseStatusData} cx="50%" cy="50%" innerRadius={45} outerRadius={70} dataKey="value" strokeWidth={0} paddingAngle={4}>
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
            <div className="text-center py-16"><Disc3 className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" /><p className="text-xs text-muted-foreground">No release data</p></div>
          )}
        </GlassCard>

        {/* Platform Distribution */}
        <GlassCard className="animate-fade-in">
          <h3 className="text-xs sm:text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
            <div className="h-6 w-6 rounded-lg bg-sky-500/15 flex items-center justify-center">
              <Music className="h-3 w-3 text-sky-400" />
            </div>
            Platform Distribution
          </h3>
          {topStores.length > 0 ? (
            <div className="space-y-3">
              {topStores.map((store) => {
                const pct = totalStoreStreams > 0 ? (store.value / totalStoreStreams) * 100 : 0;
                return (
                  <div key={store.name} className="group">
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-2">
                        <div className="h-2.5 w-2.5 rounded-full" style={{ background: store.color }} />
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
          ) : (
            <div className="text-center py-16"><Music className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" /><p className="text-xs text-muted-foreground">No platform data</p></div>
          )}
        </GlassCard>

        {/* Monthly Store Stacked Bar */}
        <GlassCard className="animate-fade-in">
          <h3 className="text-xs sm:text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
            <div className="h-6 w-6 rounded-lg bg-violet-500/15 flex items-center justify-center">
              <BarChart3 className="h-3 w-3 text-violet-400" />
            </div>
            Monthly Platform Streams
          </h3>
          {monthlyStoreData.length > 0 ? (
            <div className="h-44 sm:h-52">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthlyStoreData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(0 0% 13%)" vertical={false} />
                  <XAxis dataKey="month" tick={{ fill: 'hsl(0 0% 45%)', fontSize: 10 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: 'hsl(0 0% 45%)', fontSize: 10 }} width={35} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={tooltipStyle} />
                  {topStoreNames.map((name, i) => (
                    <Bar key={name} dataKey={name} stackId="stores" fill={STORE_COLORS[name] || CHART_COLORS[i % CHART_COLORS.length]} radius={i === topStoreNames.length - 1 ? [4, 4, 0, 0] : [0, 0, 0, 0]} />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="text-center py-16"><BarChart3 className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" /><p className="text-xs text-muted-foreground">No data</p></div>
          )}
        </GlassCard>
      </div>

      {/* Top Tracks + Top Artists + Country Map */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6 sm:mb-8">
        <GlassCard className="animate-fade-in">
          <h3 className="text-xs sm:text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
            <div className="h-6 w-6 rounded-lg bg-rose-500/15 flex items-center justify-center">
              <Music className="h-3 w-3 text-rose-400" />
            </div>
            Top Tracks
          </h3>
          {topTracks.length > 0 ? (
            <div className="space-y-2">
              {topTracks.map((track, i) => (
                <div key={track.name} className="flex items-center gap-3 p-3 rounded-xl bg-muted/15 hover:bg-muted/25 transition-colors border border-border/20">
                  <div className="h-8 w-8 rounded-lg flex items-center justify-center text-xs font-bold shrink-0" style={{ background: `${CHART_COLORS[i % CHART_COLORS.length]}22`, color: CHART_COLORS[i % CHART_COLORS.length] }}>{i + 1}</div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs sm:text-sm font-medium text-foreground truncate">{track.name}</p>
                    <p className="text-[10px] text-muted-foreground">{formatStreams(track.streams)} streams</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12"><Music className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" /><p className="text-xs text-muted-foreground">No track data</p></div>
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
                  <div className="h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0" style={{ background: `${CHART_COLORS[i % CHART_COLORS.length]}22`, color: CHART_COLORS[i % CHART_COLORS.length] }}>{i + 1}</div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs sm:text-sm font-medium text-foreground truncate">{artist.name}</p>
                    <p className="text-[10px] text-muted-foreground">{formatStreams(artist.streams)} streams</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12"><Headphones className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" /><p className="text-xs text-muted-foreground">No artist data</p></div>
          )}
        </GlassCard>

        <GlassCard className="animate-fade-in">
          <h3 className="text-xs sm:text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
            <div className="h-6 w-6 rounded-lg bg-emerald-500/15 flex items-center justify-center">
              <Globe className="h-3 w-3 text-emerald-400" />
            </div>
            Streams by Country
          </h3>
          {countryData.length > 0 ? (
            <WorldMapChart data={countryData} />
          ) : (
            <div className="text-center py-12"><Globe className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" /><p className="text-xs text-muted-foreground">No country data</p></div>
          )}
        </GlassCard>
      </div>

      {/* Pending Requests Grid - 2x2 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6 sm:mb-8">
        <PendingListCard title="Pending Releases" icon={Disc3} items={pendingReleases} emptyText="No pending releases" onViewAll={() => navigate('/admin/submissions')}
          renderItem={(r) => (
            <div key={r.id} className="flex items-center justify-between gap-2 p-3 rounded-xl bg-muted/15 hover:bg-muted/25 transition-colors border border-border/20">
              <div className="min-w-0 flex-1">
                <p className="text-xs sm:text-sm font-medium text-foreground truncate">{getReleaseName(r)}</p>
                <p className="text-[10px] text-muted-foreground capitalize">{r.content_type}</p>
              </div>
              <span className="text-[10px] text-muted-foreground shrink-0">{format(new Date(r.created_at), 'dd MMM')}</span>
            </div>
          )}
        />
        <PendingListCard title="Pending Content Requests" icon={MessageSquare} items={pendingContentRequests} emptyText="No pending requests" onViewAll={() => navigate('/admin/content-requests')}
          renderItem={(c) => (
            <div key={c.id} className="flex items-center justify-between gap-2 p-3 rounded-xl bg-muted/15 hover:bg-muted/25 transition-colors border border-border/20">
              <div className="min-w-0 flex-1">
                <p className="text-xs sm:text-sm font-medium text-foreground truncate">{formatRequestType(c.request_type)}</p>
                <p className="text-[10px] text-muted-foreground truncate">{c.song_title || c.artist_name || '—'}</p>
              </div>
              <span className="text-[10px] text-muted-foreground shrink-0">{format(new Date(c.created_at), 'dd MMM')}</span>
            </div>
          )}
        />
        <PendingListCard title="Pending Labels" icon={Tag} items={pendingLabels} emptyText="No pending labels" onViewAll={() => navigate('/admin/labels')}
          renderItem={(l) => (
            <div key={l.id} className="flex items-center justify-between gap-2 p-3 rounded-xl bg-muted/15 hover:bg-muted/25 transition-colors border border-border/20">
              <div className="min-w-0 flex-1">
                <p className="text-xs sm:text-sm font-medium text-foreground truncate">{l.label_name}</p>
              </div>
              <span className="text-[10px] text-muted-foreground shrink-0">{format(new Date(l.created_at), 'dd MMM')}</span>
            </div>
          )}
        />
        <PendingListCard title="Pending Withdrawals" icon={Wallet} items={pendingWithdrawals} emptyText="No pending withdrawals" onViewAll={() => navigate('/admin/revenue')}
          renderItem={(w) => (
            <div key={w.id} className="flex items-center justify-between gap-2 p-3 rounded-xl bg-muted/15 hover:bg-muted/25 transition-colors border border-border/20">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold text-foreground">₹{Number(w.amount).toLocaleString()}</p>
                <p className="text-[10px] text-muted-foreground">{format(new Date(w.created_at), 'dd MMM yyyy')}</p>
              </div>
              <StatusBadge status="pending" />
            </div>
          )}
        />
      </div>

      {/* Recent Releases */}
      <GlassCard className="animate-fade-in">
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
    </DashboardLayout>
  );
}

function PendingListCard({ title, icon: Icon, items, emptyText, onViewAll, renderItem }: {
  title: string; icon: any; items: any[]; emptyText: string; onViewAll: () => void; renderItem: (item: any) => React.ReactNode;
}) {
  return (
    <GlassCard className="animate-fade-in">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-xs sm:text-sm font-semibold text-foreground flex items-center gap-2">
          <div className="h-6 w-6 rounded-lg bg-primary/15 flex items-center justify-center">
            <Icon className="h-3 w-3 text-primary" />
          </div>
          {title}
          {items.length > 0 && <span className="ml-1 inline-flex items-center justify-center h-5 min-w-[20px] px-1.5 rounded-full text-[10px] font-bold bg-primary/20 text-primary">{items.length}</span>}
        </h3>
        <button onClick={onViewAll} className="text-[10px] sm:text-xs text-primary hover:underline flex items-center gap-1">View All <ArrowRight className="h-3 w-3" /></button>
      </div>
      {items.length > 0 ? (
        <div className="space-y-2">{items.map(renderItem)}</div>
      ) : (
        <div className="text-center py-8">
          <Icon className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
          <p className="text-xs text-muted-foreground">{emptyText}</p>
        </div>
      )}
    </GlassCard>
  );
}
