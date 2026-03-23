import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { DashboardLayout } from '@/components/DashboardLayout';
import { GlassCard } from '@/components/GlassCard';
import { useAuth } from '@/hooks/useAuth';
import { useImpersonate } from '@/hooks/useImpersonate';
import { normalizeIsrc } from '@/lib/isrc';
import {
  IndianRupee,
  TrendingUp,
  Music2,
  Globe,
  Play,
  BarChart3,
  Download,
  Users,
  Disc3,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area,
  Legend,
} from 'recharts';

type TimePeriod = '30d' | '6m' | '12m' | 'all';

interface ReportEntry {
  id: string;
  reporting_month: string;
  store: string | null;
  sales_type: string | null;
  country: string | null;
  label: string | null;
  track: string | null;
  artist: string | null;
  isrc: string | null;
  upc: string | null;
  currency: string | null;
  streams: number;
  downloads: number;
  net_generated_revenue: number;
  imported_at: string;
  source: 'ott' | 'youtube';
}

const TIME_PERIODS: { key: TimePeriod; label: string }[] = [
  { key: '30d', label: 'Last 30 Days' },
  { key: '6m', label: 'Last 6 Months' },
  { key: '12m', label: 'Last 12 Months' },
  { key: 'all', label: 'All Time' },
];

const CHART_COLORS = [
  'hsl(0, 67%, 45%)',
  'hsl(25, 80%, 50%)',
  'hsl(45, 85%, 55%)',
  'hsl(170, 60%, 45%)',
  'hsl(210, 65%, 50%)',
  'hsl(280, 55%, 55%)',
  'hsl(330, 60%, 50%)',
  'hsl(140, 50%, 45%)',
];

const MONTHS_MAP: Record<string, number> = {
  january: 0, february: 1, march: 2, april: 3, may: 4, june: 5,
  july: 6, august: 7, september: 8, october: 9, november: 10, december: 11,
};

function parseMonthToDate(m: string): Date | null {
  const parts = m.toLowerCase().split(' ');
  if (parts.length !== 2) return null;
  const monthIdx = MONTHS_MAP[parts[0]];
  const year = parseInt(parts[1]);
  if (monthIdx === undefined || isNaN(year)) return null;
  return new Date(year, monthIdx, 1);
}

function filterByPeriod(entries: ReportEntry[], period: TimePeriod): ReportEntry[] {
  if (period === 'all') return entries;
  const now = new Date();
  let cutoff: Date;
  if (period === '30d') {
    cutoff = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());
  } else if (period === '6m') {
    cutoff = new Date(now.getFullYear(), now.getMonth() - 6, 1);
  } else {
    cutoff = new Date(now.getFullYear() - 1, now.getMonth(), 1);
  }
  return entries.filter((e) => {
    const d = parseMonthToDate(e.reporting_month);
    return d && d >= cutoff;
  });
}

function aggregateByKey<T extends ReportEntry>(
  data: T[],
  key: keyof T,
  metric: 'revenue' | 'streams',
  limit = 8
): { name: string; value: number }[] {
  const map: Record<string, number> = {};
  data.forEach((e) => {
    const k = String(e[key] ?? 'Unknown');
    map[k] = (map[k] || 0) + (metric === 'revenue' ? Number(e.net_generated_revenue) || 0 : Number(e.streams) || 0);
  });
  return Object.entries(map)
    .sort(([, a], [, b]) => b - a)
    .slice(0, limit)
    .map(([name, value]) => ({ name, value: Math.round(value * 100) / 100 }));
}

function CustomTooltip({ active, payload, label, prefix = '' }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-border/50 bg-card px-3 py-2 text-xs shadow-xl">
      <p className="font-medium text-foreground mb-1">{label}</p>
      {payload.map((p: any, i: number) => (
        <p key={i} style={{ color: p.color }} className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full inline-block" style={{ background: p.color }} />
          {p.name}: {prefix}{p.value?.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
        </p>
      ))}
    </div>
  );
}

function PieTooltip({ active, payload, prefix = '' }: any) {
  if (!active || !payload?.length) return null;
  const d = payload[0];
  return (
    <div className="rounded-lg border border-border/50 bg-card px-3 py-2 text-xs shadow-xl">
      <p className="font-medium text-foreground">{d.name}</p>
      <p className="text-muted-foreground">{prefix}{d.value?.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</p>
    </div>
  );
}

export default function Analytics() {
  const { user, role } = useAuth();
  const { impersonatedUserId, isImpersonating } = useImpersonate();
  const [ottEntries, setOttEntries] = useState<ReportEntry[]>([]);
  const [ytEntries, setYtEntries] = useState<ReportEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<TimePeriod>('all');

  useEffect(() => {
    if (!user) return;
    const fetchData = async () => {
      setLoading(true);

      if (role === 'admin' && isImpersonating && impersonatedUserId) {
        const [{ data: trackRows }, { data: songRows }] = await Promise.all([
          supabase.from('tracks').select('isrc').eq('user_id', impersonatedUserId),
          supabase.from('songs').select('isrc').eq('user_id', impersonatedUserId),
        ]);
        const ownedIsrcs = [...new Set(
          [...(trackRows ?? []), ...(songRows ?? [])]
            .map((row) => normalizeIsrc(row.isrc))
            .filter((v): v is string => Boolean(v))
        )];
        if (ownedIsrcs.length === 0) { setOttEntries([]); setYtEntries([]); setLoading(false); return; }
        const [{ data: ott }, { data: yt }] = await Promise.all([
          supabase.from('report_entries').select('*').in('isrc', ownedIsrcs),
          supabase.from('youtube_report_entries').select('*').in('isrc', ownedIsrcs),
        ]);
        setOttEntries((ott || []).map((e: any) => ({ ...e, source: 'ott' as const, streams: e.streams || 0, downloads: e.downloads || 0, net_generated_revenue: e.net_generated_revenue || 0 })));
        setYtEntries((yt || []).map((e: any) => ({ ...e, source: 'youtube' as const, streams: e.streams || 0, downloads: e.downloads || 0, net_generated_revenue: e.net_generated_revenue || 0 })));
      } else {
        const [{ data: ott }, { data: yt }] = await Promise.all([
          supabase.from('report_entries').select('*'),
          supabase.from('youtube_report_entries').select('*'),
        ]);
        setOttEntries((ott || []).map((e: any) => ({ ...e, source: 'ott' as const, streams: e.streams || 0, downloads: e.downloads || 0, net_generated_revenue: e.net_generated_revenue || 0 })));
        setYtEntries((yt || []).map((e: any) => ({ ...e, source: 'youtube' as const, streams: e.streams || 0, downloads: e.downloads || 0, net_generated_revenue: e.net_generated_revenue || 0 })));
      }
      setLoading(false);
    };
    fetchData();
  }, [user, role, isImpersonating, impersonatedUserId]);

  const allEntries = useMemo(() => [...ottEntries, ...ytEntries], [ottEntries, ytEntries]);
  const filtered = useMemo(() => filterByPeriod(allEntries, period), [allEntries, period]);

  const totalRevenue = useMemo(() => filtered.reduce((s, e) => s + (Number(e.net_generated_revenue) || 0), 0), [filtered]);
  const totalStreams = useMemo(() => filtered.reduce((s, e) => s + (Number(e.streams) || 0), 0), [filtered]);
  const totalDownloads = useMemo(() => filtered.reduce((s, e) => s + (Number(e.downloads) || 0), 0), [filtered]);
  const uniqueTracks = useMemo(() => new Set(filtered.map((e) => e.track).filter(Boolean)).size, [filtered]);
  const uniqueArtists = useMemo(() => new Set(filtered.map((e) => e.artist).filter(Boolean)).size, [filtered]);
  const uniqueCountries = useMemo(() => new Set(filtered.map((e) => e.country).filter(Boolean)).size, [filtered]);

  // Revenue trend by month
  const revenueTrend = useMemo(() => {
    const map: Record<string, { ott: number; youtube: number }> = {};
    filtered.forEach((e) => {
      if (!map[e.reporting_month]) map[e.reporting_month] = { ott: 0, youtube: 0 };
      map[e.reporting_month][e.source] += Number(e.net_generated_revenue) || 0;
    });
    return Object.entries(map)
      .sort(([a], [b]) => {
        const da = parseMonthToDate(a);
        const db = parseMonthToDate(b);
        return (da?.getTime() || 0) - (db?.getTime() || 0);
      })
      .map(([month, vals]) => ({
        month: month.split(' ').map((w, i) => i === 0 ? w.slice(0, 3) : `'${w.slice(2)}`).join(' '),
        OTT: Math.round(vals.ott * 100) / 100,
        YouTube: Math.round(vals.youtube * 100) / 100,
      }));
  }, [filtered]);

  // Streams trend by month
  const streamsTrend = useMemo(() => {
    const map: Record<string, { ott: number; youtube: number }> = {};
    filtered.forEach((e) => {
      if (!map[e.reporting_month]) map[e.reporting_month] = { ott: 0, youtube: 0 };
      map[e.reporting_month][e.source] += Number(e.streams) || 0;
    });
    return Object.entries(map)
      .sort(([a], [b]) => {
        const da = parseMonthToDate(a);
        const db = parseMonthToDate(b);
        return (da?.getTime() || 0) - (db?.getTime() || 0);
      })
      .map(([month, vals]) => ({
        month: month.split(' ').map((w, i) => i === 0 ? w.slice(0, 3) : `'${w.slice(2)}`).join(' '),
        OTT: vals.ott,
        YouTube: vals.youtube,
      }));
  }, [filtered]);

  const revenueByPlatform = useMemo(() => aggregateByKey(filtered, 'store', 'revenue'), [filtered]);
  const streamsByPlatform = useMemo(() => aggregateByKey(filtered, 'store', 'streams'), [filtered]);
  const revenueByTrack = useMemo(() => aggregateByKey(filtered, 'track', 'revenue'), [filtered]);
  const revenueByArtist = useMemo(() => aggregateByKey(filtered, 'artist', 'revenue'), [filtered]);
  const streamsByArtist = useMemo(() => aggregateByKey(filtered, 'artist', 'streams'), [filtered]);
  const streamsByTrack = useMemo(() => aggregateByKey(filtered, 'track', 'streams'), [filtered]);
  const revenueByCountry = useMemo(() => aggregateByKey(filtered, 'country', 'revenue', 12), [filtered]);
  const streamsByCountry = useMemo(() => aggregateByKey(filtered, 'country', 'streams', 12), [filtered]);

  // Source split (OTT vs YouTube)
  const sourceSplit = useMemo(() => {
    let ott = 0, yt = 0;
    filtered.forEach((e) => {
      if (e.source === 'ott') ott += Number(e.net_generated_revenue) || 0;
      else yt += Number(e.net_generated_revenue) || 0;
    });
    return [
      { name: 'OTT Platforms', value: Math.round(ott * 100) / 100 },
      { name: 'YouTube', value: Math.round(yt * 100) / 100 },
    ].filter((d) => d.value > 0);
  }, [filtered]);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold font-display">Analytics</h1>
            <p className="text-muted-foreground text-sm">Combined YouTube + OTT performance overview · All amounts in ₹ (INR)</p>
          </div>
        </div>

        {/* Time Period Tabs */}
        <div className="flex gap-1.5 p-1 rounded-xl bg-secondary/50 w-fit">
          {TIME_PERIODS.map((tp) => (
            <button
              key={tp.key}
              onClick={() => setPeriod(tp.key)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                period === tp.key
                  ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/25'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
              }`}
            >
              {tp.label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <GlassCard key={i} className="h-28 animate-pulse"><div /></GlassCard>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <GlassCard className="py-16 text-center">
            <BarChart3 className="h-12 w-12 mx-auto text-muted-foreground/40 mb-4" />
            <p className="text-muted-foreground text-lg font-medium">No analytics data available</p>
            <p className="text-muted-foreground/60 text-sm mt-1">Report data will appear here once available.</p>
          </GlassCard>
        ) : (
          <>
            {/* Summary Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              <SummaryCard icon={IndianRupee} label="Total Revenue" value={`₹${totalRevenue.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`} color="hsl(0, 67%, 25%)" />
              <SummaryCard icon={Play} label="Total Streams" value={totalStreams.toLocaleString('en-IN')} color="hsl(210, 65%, 40%)" />
              <SummaryCard icon={Download} label="Downloads" value={totalDownloads.toLocaleString('en-IN')} color="hsl(170, 60%, 35%)" />
              <SummaryCard icon={Music2} label="Tracks" value={String(uniqueTracks)} color="hsl(25, 80%, 40%)" />
              <SummaryCard icon={Users} label="Artists" value={String(uniqueArtists)} color="hsl(280, 55%, 40%)" />
              <SummaryCard icon={Globe} label="Countries" value={String(uniqueCountries)} color="hsl(140, 50%, 35%)" />
            </div>

            {/* Revenue Trend + Source Split */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <GlassCard className="lg:col-span-2">
                <ChartHeader icon={TrendingUp} title="Revenue Trend" subtitle="Monthly revenue by source" />
                <div className="h-72 mt-4">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={revenueTrend}>
                      <defs>
                        <linearGradient id="gradOtt" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="hsl(25, 80%, 50%)" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="hsl(25, 80%, 50%)" stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id="gradYt" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="hsl(0, 67%, 45%)" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="hsl(0, 67%, 45%)" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(0,0%,20%)" />
                      <XAxis dataKey="month" tick={{ fill: 'hsl(0,0%,55%)', fontSize: 11 }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fill: 'hsl(0,0%,55%)', fontSize: 11 }} axisLine={false} tickLine={false} />
                      <Tooltip content={<CustomTooltip prefix="₹" />} />
                      <Legend wrapperStyle={{ fontSize: 12 }} />
                      <Area type="monotone" dataKey="OTT" stroke="hsl(25, 80%, 50%)" fill="url(#gradOtt)" strokeWidth={2} />
                      <Area type="monotone" dataKey="YouTube" stroke="hsl(0, 67%, 45%)" fill="url(#gradYt)" strokeWidth={2} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </GlassCard>

              <GlassCard>
                <ChartHeader icon={Disc3} title="Revenue Split" subtitle="OTT vs YouTube" />
                <div className="h-72 mt-4 flex items-center justify-center">
                  {sourceSplit.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={sourceSplit}
                          cx="50%"
                          cy="50%"
                          innerRadius={55}
                          outerRadius={90}
                          paddingAngle={4}
                          dataKey="value"
                          stroke="none"
                        >
                          {sourceSplit.map((_, i) => (
                            <Cell key={i} fill={i === 0 ? 'hsl(25, 80%, 50%)' : 'hsl(0, 67%, 45%)'} />
                          ))}
                        </Pie>
                        <Tooltip content={<PieTooltip prefix="₹" />} />
                        <Legend wrapperStyle={{ fontSize: 12 }} />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : (
                    <p className="text-muted-foreground text-sm">No data</p>
                  )}
                </div>
              </GlassCard>
            </div>

            {/* Streams Trend */}
            <GlassCard>
              <ChartHeader icon={Play} title="Streams Trend" subtitle="Monthly streams by source" />
              <div className="h-72 mt-4">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={streamsTrend}>
                    <defs>
                      <linearGradient id="gradOttS" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(210, 65%, 50%)" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="hsl(210, 65%, 50%)" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="gradYtS" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(170, 60%, 45%)" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="hsl(170, 60%, 45%)" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(0,0%,20%)" />
                    <XAxis dataKey="month" tick={{ fill: 'hsl(0,0%,55%)', fontSize: 11 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: 'hsl(0,0%,55%)', fontSize: 11 }} axisLine={false} tickLine={false} />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Area type="monotone" dataKey="OTT" stroke="hsl(210, 65%, 50%)" fill="url(#gradOttS)" strokeWidth={2} />
                    <Area type="monotone" dataKey="YouTube" stroke="hsl(170, 60%, 45%)" fill="url(#gradYtS)" strokeWidth={2} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </GlassCard>

            {/* Revenue by Platform + Streams by Platform */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <GlassCard>
                <ChartHeader icon={BarChart3} title="Revenue by Platform" subtitle="Top performing stores" />
                <div className="h-72 mt-4">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={revenueByPlatform} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(0,0%,20%)" horizontal={false} />
                      <XAxis type="number" tick={{ fill: 'hsl(0,0%,55%)', fontSize: 11 }} axisLine={false} tickLine={false} />
                      <YAxis dataKey="name" type="category" tick={{ fill: 'hsl(0,0%,75%)', fontSize: 11 }} width={100} axisLine={false} tickLine={false} />
                      <Tooltip content={<CustomTooltip prefix="₹" />} />
                      <Bar dataKey="value" name="Revenue" radius={[0, 6, 6, 0]} maxBarSize={28}>
                        {revenueByPlatform.map((_, i) => (
                          <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </GlassCard>

              <GlassCard>
                <ChartHeader icon={Play} title="Streams by Platform" subtitle="Top streaming stores" />
                <div className="h-72 mt-4">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={streamsByPlatform} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(0,0%,20%)" horizontal={false} />
                      <XAxis type="number" tick={{ fill: 'hsl(0,0%,55%)', fontSize: 11 }} axisLine={false} tickLine={false} />
                      <YAxis dataKey="name" type="category" tick={{ fill: 'hsl(0,0%,75%)', fontSize: 11 }} width={100} axisLine={false} tickLine={false} />
                      <Tooltip content={<CustomTooltip />} />
                      <Bar dataKey="value" name="Streams" radius={[0, 6, 6, 0]} maxBarSize={28}>
                        {streamsByPlatform.map((_, i) => (
                          <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </GlassCard>
            </div>

            {/* Top Tracks */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <GlassCard>
                <ChartHeader icon={Music2} title="Top Tracks by Revenue" subtitle="Highest earning tracks" />
                <div className="mt-4 space-y-2.5">
                  {revenueByTrack.map((t, i) => (
                    <TopItemRow key={t.name} rank={i + 1} name={t.name} value={`₹${t.value.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`} percentage={revenueByTrack[0] ? (t.value / revenueByTrack[0].value) * 100 : 0} color={CHART_COLORS[i % CHART_COLORS.length]} />
                  ))}
                  {revenueByTrack.length === 0 && <p className="text-muted-foreground text-sm text-center py-4">No track data</p>}
                </div>
              </GlassCard>

              <GlassCard>
                <ChartHeader icon={Music2} title="Top Tracks by Streams" subtitle="Most streamed tracks" />
                <div className="mt-4 space-y-2.5">
                  {streamsByTrack.map((t, i) => (
                    <TopItemRow key={t.name} rank={i + 1} name={t.name} value={t.value.toLocaleString('en-IN')} percentage={streamsByTrack[0] ? (t.value / streamsByTrack[0].value) * 100 : 0} color={CHART_COLORS[i % CHART_COLORS.length]} />
                  ))}
                  {streamsByTrack.length === 0 && <p className="text-muted-foreground text-sm text-center py-4">No track data</p>}
                </div>
              </GlassCard>
            </div>

            {/* Top Artists */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <GlassCard>
                <ChartHeader icon={Users} title="Top Artists by Revenue" subtitle="Highest earning artists" />
                <div className="mt-4 space-y-2.5">
                  {revenueByArtist.map((a, i) => (
                    <TopItemRow key={a.name} rank={i + 1} name={a.name} value={`₹${a.value.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`} percentage={revenueByArtist[0] ? (a.value / revenueByArtist[0].value) * 100 : 0} color={CHART_COLORS[i % CHART_COLORS.length]} />
                  ))}
                  {revenueByArtist.length === 0 && <p className="text-muted-foreground text-sm text-center py-4">No artist data</p>}
                </div>
              </GlassCard>

              <GlassCard>
                <ChartHeader icon={Users} title="Top Artists by Streams" subtitle="Most streamed artists" />
                <div className="mt-4 space-y-2.5">
                  {streamsByArtist.map((a, i) => (
                    <TopItemRow key={a.name} rank={i + 1} name={a.name} value={a.value.toLocaleString('en-IN')} percentage={streamsByArtist[0] ? (a.value / streamsByArtist[0].value) * 100 : 0} color={CHART_COLORS[i % CHART_COLORS.length]} />
                  ))}
                  {streamsByArtist.length === 0 && <p className="text-muted-foreground text-sm text-center py-4">No artist data</p>}
                </div>
              </GlassCard>
            </div>

            {/* Countries */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <GlassCard>
                <ChartHeader icon={Globe} title="Revenue by Country" subtitle="Geographic revenue distribution" />
                <div className="h-80 mt-4">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={revenueByCountry}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(0,0%,20%)" />
                      <XAxis dataKey="name" tick={{ fill: 'hsl(0,0%,55%)', fontSize: 10 }} axisLine={false} tickLine={false} angle={-45} textAnchor="end" height={60} />
                      <YAxis tick={{ fill: 'hsl(0,0%,55%)', fontSize: 11 }} axisLine={false} tickLine={false} />
                      <Tooltip content={<CustomTooltip prefix="₹" />} />
                      <Bar dataKey="value" name="Revenue" radius={[6, 6, 0, 0]} maxBarSize={32}>
                        {revenueByCountry.map((_, i) => (
                          <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </GlassCard>

              <GlassCard>
                <ChartHeader icon={Globe} title="Streams by Country" subtitle="Geographic streams distribution" />
                <div className="h-80 mt-4">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={streamsByCountry}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(0,0%,20%)" />
                      <XAxis dataKey="name" tick={{ fill: 'hsl(0,0%,55%)', fontSize: 10 }} axisLine={false} tickLine={false} angle={-45} textAnchor="end" height={60} />
                      <YAxis tick={{ fill: 'hsl(0,0%,55%)', fontSize: 11 }} axisLine={false} tickLine={false} />
                      <Tooltip content={<CustomTooltip />} />
                      <Bar dataKey="value" name="Streams" radius={[6, 6, 0, 0]} maxBarSize={32}>
                        {streamsByCountry.map((_, i) => (
                          <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </GlassCard>
            </div>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}

/* ── Sub-components ── */

function SummaryCard({ icon: Icon, label, value, color }: { icon: any; label: string; value: string; color: string }) {
  return (
    <GlassCard glow className="animate-fade-in">
      <div className="flex flex-col gap-2">
        <div className="rounded-lg p-2 w-fit" style={{ background: `${color.replace(')', ', 0.2)').replace('hsl', 'hsla')}` }}>
          <Icon className="h-4 w-4" style={{ color }} />
        </div>
        <p className="text-lg sm:text-xl font-bold font-display leading-tight break-all">{value}</p>
        <p className="text-xs text-muted-foreground">{label}</p>
      </div>
    </GlassCard>
  );
}

function ChartHeader({ icon: Icon, title, subtitle }: { icon: any; title: string; subtitle: string }) {
  return (
    <div className="flex items-center gap-3">
      <div className="rounded-lg p-2 bg-primary/10">
        <Icon className="h-4 w-4 text-primary" />
      </div>
      <div>
        <h3 className="font-semibold text-sm text-foreground">{title}</h3>
        <p className="text-xs text-muted-foreground">{subtitle}</p>
      </div>
    </div>
  );
}

function TopItemRow({ rank, name, value, percentage, color }: { rank: number; name: string; value: string; percentage: number; color: string }) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-xs font-bold text-muted-foreground w-5 text-right">{rank}</span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-1">
          <span className="text-sm font-medium text-foreground truncate mr-2">{name}</span>
          <span className="text-xs font-mono text-muted-foreground whitespace-nowrap">{value}</span>
        </div>
        <div className="h-1.5 rounded-full bg-muted overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{ width: `${Math.max(percentage, 2)}%`, background: color }}
          />
        </div>
      </div>
    </div>
  );
}
