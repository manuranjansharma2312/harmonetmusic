import { useState, useEffect, useMemo, useCallback } from 'react';
import WorldMap from 'react-svg-worldmap';
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
  ArrowUpRight,
  ArrowDownRight,
  Minus,
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
  RadialBarChart,
  RadialBar,
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
  '#dc2626', '#f97316', '#eab308', '#22c55e',
  '#3b82f6', '#8b5cf6', '#ec4899', '#14b8a6',
  '#f43f5e', '#6366f1', '#84cc16', '#06b6d4',
];

/* Country name → ISO alpha-2 mapping for the world map */
const COUNTRY_ISO: Record<string, string> = {
  india: 'IN', 'united states': 'US', usa: 'US', 'united kingdom': 'GB', uk: 'GB',
  germany: 'DE', france: 'FR', canada: 'CA', australia: 'AU', brazil: 'BR',
  japan: 'JP', 'south korea': 'KR', mexico: 'MX', spain: 'ES', italy: 'IT',
  russia: 'RU', china: 'CN', indonesia: 'ID', turkey: 'TR', 'saudi arabia': 'SA',
  netherlands: 'NL', sweden: 'SE', norway: 'NO', denmark: 'DK', finland: 'FI',
  poland: 'PL', switzerland: 'CH', austria: 'AT', belgium: 'BE', portugal: 'PT',
  argentina: 'AR', colombia: 'CO', chile: 'CL', peru: 'PE', egypt: 'EG',
  'south africa': 'ZA', nigeria: 'NG', kenya: 'KE', pakistan: 'PK', bangladesh: 'BD',
  'sri lanka': 'LK', nepal: 'NP', philippines: 'PH', thailand: 'TH', vietnam: 'VN',
  malaysia: 'MY', singapore: 'SG', 'new zealand': 'NZ', ireland: 'IE', israel: 'IL',
  'united arab emirates': 'AE', uae: 'AE', taiwan: 'TW', 'hong kong': 'HK',
  greece: 'GR', romania: 'RO', czech: 'CZ', hungary: 'HU', ukraine: 'UA',
};

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
  if (period === '30d') cutoff = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());
  else if (period === '6m') cutoff = new Date(now.getFullYear(), now.getMonth() - 6, 1);
  else cutoff = new Date(now.getFullYear() - 1, now.getMonth(), 1);
  return entries.filter((e) => {
    const d = parseMonthToDate(e.reporting_month);
    return d && d >= cutoff;
  });
}

function aggregateByKey<T extends ReportEntry>(
  data: T[], key: keyof T, metric: 'revenue' | 'streams', limit = 8
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

function formatCompact(n: number): string {
  if (n >= 10000000) return `${(n / 10000000).toFixed(2)}Cr`;
  if (n >= 100000) return `${(n / 100000).toFixed(2)}L`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return n.toLocaleString('en-IN', { maximumFractionDigits: 2 });
}

/* ── Tooltip Components ── */

function ChartTooltipBox({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border/60 bg-card/95 backdrop-blur-xl px-4 py-3 shadow-2xl shadow-black/40">
      {children}
    </div>
  );
}

function CustomTooltip({ active, payload, label, prefix = '' }: any) {
  if (!active || !payload?.length) return null;
  return (
    <ChartTooltipBox>
      <p className="font-semibold text-foreground text-xs mb-2 border-b border-border/40 pb-1.5">{label}</p>
      <div className="space-y-1">
        {payload.map((p: any, i: number) => (
          <div key={i} className="flex items-center justify-between gap-4 text-xs">
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-sm inline-block" style={{ background: p.color }} />
              <span className="text-muted-foreground">{p.name}</span>
            </span>
            <span className="font-mono font-semibold text-foreground">{prefix}{p.value?.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</span>
          </div>
        ))}
      </div>
    </ChartTooltipBox>
  );
}

function PieTooltip({ active, payload, prefix = '' }: any) {
  if (!active || !payload?.length) return null;
  const d = payload[0];
  const total = d.payload?.total || 0;
  const pct = total > 0 ? ((d.value / total) * 100).toFixed(1) : '0';
  return (
    <ChartTooltipBox>
      <p className="font-semibold text-foreground text-xs mb-1">{d.name}</p>
      <p className="text-sm font-mono font-bold text-foreground">{prefix}{d.value?.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</p>
      <p className="text-[10px] text-muted-foreground mt-0.5">{pct}% of total</p>
    </ChartTooltipBox>
  );
}

function CustomLegend({ payload }: any) {
  if (!payload?.length) return null;
  return (
    <div className="flex items-center justify-center gap-5 mt-2">
      {payload.map((entry: any, i: number) => (
        <div key={i} className="flex items-center gap-1.5">
          <span className="h-2 w-6 rounded-full" style={{ background: entry.color }} />
          <span className="text-[11px] text-muted-foreground font-medium">{entry.value}</span>
        </div>
      ))}
    </div>
  );
}

/* ── Custom Pie Label ── */
function renderPieLabel({ cx, cy, midAngle, innerRadius, outerRadius, percent, name }: any) {
  const RADIAN = Math.PI / 180;
  const radius = outerRadius + 20;
  const x = cx + radius * Math.cos(-midAngle * RADIAN);
  const y = cy + radius * Math.sin(-midAngle * RADIAN);
  return (
    <text x={x} y={y} fill="hsl(0,0%,75%)" textAnchor={x > cx ? 'start' : 'end'} dominantBaseline="central" className="text-[10px] font-medium">
      {name} ({(percent * 100).toFixed(0)}%)
    </text>
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
      const mapEntries = (arr: any[], source: 'ott' | 'youtube') =>
        (arr || []).map((e: any) => ({ ...e, source, streams: e.streams || 0, downloads: e.downloads || 0, net_generated_revenue: e.net_generated_revenue || 0 }));

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
        setOttEntries(mapEntries(ott || [], 'ott'));
        setYtEntries(mapEntries(yt || [], 'youtube'));
      } else {
        const [{ data: ott }, { data: yt }] = await Promise.all([
          supabase.from('report_entries').select('*'),
          supabase.from('youtube_report_entries').select('*'),
        ]);
        setOttEntries(mapEntries(ott || [], 'ott'));
        setYtEntries(mapEntries(yt || [], 'youtube'));
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

  const formatMonth = useCallback((month: string) =>
    month.split(' ').map((w, i) => i === 0 ? w.slice(0, 3) : `'${w.slice(2)}`).join(' '), []);

  const revenueTrend = useMemo(() => {
    const map: Record<string, { ott: number; youtube: number }> = {};
    filtered.forEach((e) => {
      if (!map[e.reporting_month]) map[e.reporting_month] = { ott: 0, youtube: 0 };
      map[e.reporting_month][e.source] += Number(e.net_generated_revenue) || 0;
    });
    return Object.entries(map)
      .sort(([a], [b]) => (parseMonthToDate(a)?.getTime() || 0) - (parseMonthToDate(b)?.getTime() || 0))
      .map(([month, vals]) => ({ month: formatMonth(month), OTT: Math.round(vals.ott * 100) / 100, YouTube: Math.round(vals.youtube * 100) / 100 }));
  }, [filtered, formatMonth]);

  const streamsTrend = useMemo(() => {
    const map: Record<string, { ott: number; youtube: number }> = {};
    filtered.forEach((e) => {
      if (!map[e.reporting_month]) map[e.reporting_month] = { ott: 0, youtube: 0 };
      map[e.reporting_month][e.source] += Number(e.streams) || 0;
    });
    return Object.entries(map)
      .sort(([a], [b]) => (parseMonthToDate(a)?.getTime() || 0) - (parseMonthToDate(b)?.getTime() || 0))
      .map(([month, vals]) => ({ month: formatMonth(month), OTT: vals.ott, YouTube: vals.youtube }));
  }, [filtered, formatMonth]);

  const revenueByPlatform = useMemo(() => aggregateByKey(filtered, 'store', 'revenue'), [filtered]);
  const streamsByPlatform = useMemo(() => aggregateByKey(filtered, 'store', 'streams'), [filtered]);
  const revenueByTrack = useMemo(() => aggregateByKey(filtered, 'track', 'revenue'), [filtered]);
  const revenueByArtist = useMemo(() => aggregateByKey(filtered, 'artist', 'revenue'), [filtered]);
  const streamsByArtist = useMemo(() => aggregateByKey(filtered, 'artist', 'streams'), [filtered]);
  const streamsByTrack = useMemo(() => aggregateByKey(filtered, 'track', 'streams'), [filtered]);
  const revenueByCountry = useMemo(() => aggregateByKey(filtered, 'country', 'revenue', 12), [filtered]);
  const streamsByCountry = useMemo(() => aggregateByKey(filtered, 'country', 'streams', 12), [filtered]);

  // World map data (streams by country ISO)
  const worldMapData = useMemo(() => {
    const map: Record<string, number> = {};
    filtered.forEach((e) => {
      if (!e.country) return;
      const iso = COUNTRY_ISO[e.country.toLowerCase().trim()];
      if (!iso) return;
      map[iso] = (map[iso] || 0) + (Number(e.streams) || 0);
    });
    return Object.entries(map).map(([country, value]) => ({ country: country as any, value }));
  }, [filtered]);

  const sourceSplit = useMemo(() => {
    let ott = 0, yt = 0;
    filtered.forEach((e) => {
      if (e.source === 'ott') ott += Number(e.net_generated_revenue) || 0;
      else yt += Number(e.net_generated_revenue) || 0;
    });
    const total = ott + yt;
    return [
      { name: 'OTT', value: Math.round(ott * 100) / 100, total },
      { name: 'YouTube', value: Math.round(yt * 100) / 100, total },
    ].filter((d) => d.value > 0);
  }, [filtered]);

  const platformRadial = useMemo(() => {
    const max = revenueByPlatform[0]?.value || 1;
    return revenueByPlatform.slice(0, 5).map((p, i) => ({
      name: p.name,
      value: Math.round((p.value / max) * 100),
      revenue: p.value,
      fill: CHART_COLORS[i],
    }));
  }, [revenueByPlatform]);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold font-display tracking-tight">Analytics Overview</h1>
          <p className="text-muted-foreground text-sm mt-0.5">Combined YouTube + OTT performance · All amounts in ₹ (INR)</p>
        </div>

        {/* Time Period Selector */}
        <div className="flex gap-1 p-1 rounded-xl bg-muted/40 border border-border/30 w-fit backdrop-blur-sm">
          {TIME_PERIODS.map((tp) => (
            <button
              key={tp.key}
              onClick={() => setPeriod(tp.key)}
              className={`px-4 py-2 rounded-lg text-xs font-semibold tracking-wide transition-all duration-200 ${
                period === tp.key
                  ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/30'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/60'
              }`}
            >
              {tp.label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <GlassCard key={i} className="h-[120px] animate-pulse"><div /></GlassCard>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <GlassCard className="py-20 text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-muted/50 mb-4">
              <BarChart3 className="h-8 w-8 text-muted-foreground/50" />
            </div>
            <p className="text-foreground text-lg font-semibold">No Analytics Data</p>
            <p className="text-muted-foreground text-sm mt-1 max-w-sm mx-auto">Report data will appear here once your OTT and YouTube reports are imported.</p>
          </GlassCard>
        ) : (
          <>
            {/* ── KPI Cards ── */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              <KpiCard icon={IndianRupee} label="Total Revenue" value={`₹${formatCompact(totalRevenue)}`} accent="#dc2626" />
              <KpiCard icon={Play} label="Total Streams" value={formatCompact(totalStreams)} accent="#3b82f6" />
              <KpiCard icon={Download} label="Downloads" value={formatCompact(totalDownloads)} accent="#14b8a6" />
              <KpiCard icon={Music2} label="Tracks" value={String(uniqueTracks)} accent="#f97316" />
              <KpiCard icon={Users} label="Artists" value={String(uniqueArtists)} accent="#8b5cf6" />
              <KpiCard icon={Globe} label="Countries" value={String(uniqueCountries)} accent="#22c55e" />
            </div>

            {/* ── Revenue Trend + Revenue Split ── */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <GlassCard className="lg:col-span-2 !p-5">
                <SectionHeader icon={TrendingUp} title="Revenue Trend" subtitle="Monthly revenue breakdown by source" />
                <div className="h-[300px] mt-5">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={revenueTrend} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
                      <defs>
                        <linearGradient id="areaOtt" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#f97316" stopOpacity={0.25} />
                          <stop offset="100%" stopColor="#f97316" stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id="areaYt" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#dc2626" stopOpacity={0.25} />
                          <stop offset="100%" stopColor="#dc2626" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(0,0%,18%)" vertical={false} />
                      <XAxis dataKey="month" tick={{ fill: 'hsl(0,0%,50%)', fontSize: 10, fontWeight: 500 }} axisLine={false} tickLine={false} dy={8} />
                      <YAxis tick={{ fill: 'hsl(0,0%,50%)', fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={(v) => formatCompact(v)} />
                      <Tooltip content={<CustomTooltip prefix="₹" />} />
                      <Legend content={<CustomLegend />} />
                      <Area type="monotone" dataKey="OTT" stroke="#f97316" fill="url(#areaOtt)" strokeWidth={2.5} dot={false} activeDot={{ r: 5, strokeWidth: 2, stroke: '#f97316', fill: 'hsl(0,0%,8%)' }} />
                      <Area type="monotone" dataKey="YouTube" stroke="#dc2626" fill="url(#areaYt)" strokeWidth={2.5} dot={false} activeDot={{ r: 5, strokeWidth: 2, stroke: '#dc2626', fill: 'hsl(0,0%,8%)' }} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </GlassCard>

              <GlassCard className="!p-5">
                <SectionHeader icon={Disc3} title="Revenue Split" subtitle="OTT vs YouTube share" />
                <div className="h-[300px] mt-2 flex items-center justify-center">
                  {sourceSplit.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <defs>
                          <filter id="pieShadow">
                            <feDropShadow dx="0" dy="2" stdDeviation="4" floodColor="#000" floodOpacity="0.4" />
                          </filter>
                        </defs>
                        <Pie
                          data={sourceSplit}
                          cx="50%"
                          cy="45%"
                          innerRadius={50}
                          outerRadius={85}
                          paddingAngle={5}
                          dataKey="value"
                          stroke="none"
                          labelLine={false}
                          label={renderPieLabel}
                          style={{ filter: 'url(#pieShadow)' }}
                        >
                          <Cell fill="#f97316" />
                          <Cell fill="#dc2626" />
                        </Pie>
                        <Tooltip content={<PieTooltip prefix="₹" />} />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : (
                    <p className="text-muted-foreground text-sm">No data available</p>
                  )}
                  {/* Center label */}
                  {sourceSplit.length > 0 && (
                    <div className="absolute flex flex-col items-center pointer-events-none" style={{ display: 'none' }}>
                      <span className="text-[10px] text-muted-foreground">Total</span>
                      <span className="text-sm font-bold text-foreground">₹{formatCompact(totalRevenue)}</span>
                    </div>
                  )}
                </div>
                {/* Legend below pie */}
                <div className="flex items-center justify-center gap-6 mt-1">
                  {sourceSplit.map((s, i) => (
                    <div key={s.name} className="flex items-center gap-2">
                      <span className="h-3 w-3 rounded-sm" style={{ background: i === 0 ? '#f97316' : '#dc2626' }} />
                      <div>
                        <p className="text-[11px] text-muted-foreground">{s.name}</p>
                        <p className="text-xs font-semibold text-foreground">₹{formatCompact(s.value)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </GlassCard>
            </div>

            {/* ── Streams Trend ── */}
            <GlassCard className="!p-5">
              <SectionHeader icon={Play} title="Streams Trend" subtitle="Monthly stream counts by source" />
              <div className="h-[280px] mt-5">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={streamsTrend} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
                    <defs>
                      <linearGradient id="areaOttS" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.2} />
                        <stop offset="100%" stopColor="#3b82f6" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="areaYtS" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#14b8a6" stopOpacity={0.2} />
                        <stop offset="100%" stopColor="#14b8a6" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(0,0%,18%)" vertical={false} />
                    <XAxis dataKey="month" tick={{ fill: 'hsl(0,0%,50%)', fontSize: 10, fontWeight: 500 }} axisLine={false} tickLine={false} dy={8} />
                    <YAxis tick={{ fill: 'hsl(0,0%,50%)', fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={(v) => formatCompact(v)} />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend content={<CustomLegend />} />
                    <Area type="monotone" dataKey="OTT" stroke="#3b82f6" fill="url(#areaOttS)" strokeWidth={2.5} dot={false} activeDot={{ r: 5, strokeWidth: 2, stroke: '#3b82f6', fill: 'hsl(0,0%,8%)' }} />
                    <Area type="monotone" dataKey="YouTube" stroke="#14b8a6" fill="url(#areaYtS)" strokeWidth={2.5} dot={false} activeDot={{ r: 5, strokeWidth: 2, stroke: '#14b8a6', fill: 'hsl(0,0%,8%)' }} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </GlassCard>

            {/* ── Revenue & Streams by Platform ── */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <GlassCard className="!p-5">
                <SectionHeader icon={BarChart3} title="Revenue by Platform" subtitle="Top performing stores" />
                <div className="h-[300px] mt-4">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={revenueByPlatform} layout="vertical" margin={{ top: 0, right: 20, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(0,0%,16%)" horizontal={false} />
                      <XAxis type="number" tick={{ fill: 'hsl(0,0%,50%)', fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={(v) => `₹${formatCompact(v)}`} />
                      <YAxis dataKey="name" type="category" tick={{ fill: 'hsl(0,0%,70%)', fontSize: 11, fontWeight: 500 }} width={90} axisLine={false} tickLine={false} />
                      <Tooltip content={<CustomTooltip prefix="₹" />} cursor={{ fill: 'hsl(0,0%,12%)' }} />
                      <Bar dataKey="value" name="Revenue" radius={[0, 8, 8, 0]} maxBarSize={24} animationDuration={800}>
                        {revenueByPlatform.map((_, i) => (
                          <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </GlassCard>

              <GlassCard className="!p-5">
                <SectionHeader icon={Play} title="Streams by Platform" subtitle="Top streaming stores" />
                <div className="h-[300px] mt-4">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={streamsByPlatform} layout="vertical" margin={{ top: 0, right: 20, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(0,0%,16%)" horizontal={false} />
                      <XAxis type="number" tick={{ fill: 'hsl(0,0%,50%)', fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={(v) => formatCompact(v)} />
                      <YAxis dataKey="name" type="category" tick={{ fill: 'hsl(0,0%,70%)', fontSize: 11, fontWeight: 500 }} width={90} axisLine={false} tickLine={false} />
                      <Tooltip content={<CustomTooltip />} cursor={{ fill: 'hsl(0,0%,12%)' }} />
                      <Bar dataKey="value" name="Streams" radius={[0, 8, 8, 0]} maxBarSize={24} animationDuration={800}>
                        {streamsByPlatform.map((_, i) => (
                          <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </GlassCard>
            </div>

            {/* ── Top Tracks ── */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <GlassCard className="!p-5">
                <SectionHeader icon={Music2} title="Top Tracks · Revenue" subtitle="Highest earning tracks" />
                <div className="mt-4 space-y-3">
                  {revenueByTrack.length === 0 && <EmptyState text="No track data" />}
                  {revenueByTrack.map((t, i) => (
                    <RankRow key={t.name} rank={i + 1} name={t.name} value={`₹${formatCompact(t.value)}`} pct={revenueByTrack[0] ? (t.value / revenueByTrack[0].value) * 100 : 0} color={CHART_COLORS[i % CHART_COLORS.length]} />
                  ))}
                </div>
              </GlassCard>

              <GlassCard className="!p-5">
                <SectionHeader icon={Music2} title="Top Tracks · Streams" subtitle="Most streamed tracks" />
                <div className="mt-4 space-y-3">
                  {streamsByTrack.length === 0 && <EmptyState text="No track data" />}
                  {streamsByTrack.map((t, i) => (
                    <RankRow key={t.name} rank={i + 1} name={t.name} value={formatCompact(t.value)} pct={streamsByTrack[0] ? (t.value / streamsByTrack[0].value) * 100 : 0} color={CHART_COLORS[i % CHART_COLORS.length]} />
                  ))}
                </div>
              </GlassCard>
            </div>

            {/* ── Top Artists ── */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <GlassCard className="!p-5">
                <SectionHeader icon={Users} title="Top Artists · Revenue" subtitle="Highest earning artists" />
                <div className="mt-4 space-y-3">
                  {revenueByArtist.length === 0 && <EmptyState text="No artist data" />}
                  {revenueByArtist.map((a, i) => (
                    <RankRow key={a.name} rank={i + 1} name={a.name} value={`₹${formatCompact(a.value)}`} pct={revenueByArtist[0] ? (a.value / revenueByArtist[0].value) * 100 : 0} color={CHART_COLORS[i % CHART_COLORS.length]} />
                  ))}
                </div>
              </GlassCard>

              <GlassCard className="!p-5">
                <SectionHeader icon={Users} title="Top Artists · Streams" subtitle="Most streamed artists" />
                <div className="mt-4 space-y-3">
                  {streamsByArtist.length === 0 && <EmptyState text="No artist data" />}
                  {streamsByArtist.map((a, i) => (
                    <RankRow key={a.name} rank={i + 1} name={a.name} value={formatCompact(a.value)} pct={streamsByArtist[0] ? (a.value / streamsByArtist[0].value) * 100 : 0} color={CHART_COLORS[i % CHART_COLORS.length]} />
                  ))}
                </div>
              </GlassCard>
            </div>

            {/* ── World Map ── */}
            <GlassCard className="!p-5">
              <SectionHeader icon={Globe} title="Global Streams Distribution" subtitle="Streams by country on the world map" />
              <div className="mt-4 flex justify-center overflow-hidden">
                {worldMapData.length > 0 ? (
                  <div className="w-full max-w-4xl [&_svg]:w-full [&_svg]:h-auto">
                    <WorldMap
                      color="#dc2626"
                      valueSuffix=" streams"
                      size="responsive"
                      data={worldMapData}
                      backgroundColor="transparent"
                      borderColor="#333"
                      styleFunction={(context: any) => {
                        const opacityLevel = context.minValue && context.maxValue && context.countryValue
                          ? 0.2 + 0.8 * ((context.countryValue - context.minValue) / (context.maxValue - context.minValue || 1))
                          : 0.1;
                        return {
                          fill: context.countryValue ? `rgba(220, 38, 38, ${opacityLevel})` : 'hsl(0,0%,14%)',
                          stroke: '#444',
                          strokeWidth: 0.5,
                          cursor: context.countryValue ? 'pointer' : 'default',
                        };
                      }}
                    />
                  </div>
                ) : (
                  <div className="py-12 text-center">
                    <Globe className="h-10 w-10 mx-auto text-muted-foreground/30 mb-3" />
                    <p className="text-muted-foreground text-sm">No geographic data available</p>
                  </div>
                )}
              </div>
              {/* Top countries legend below map */}
              {worldMapData.length > 0 && (
                <div className="mt-4 flex flex-wrap justify-center gap-3">
                  {worldMapData
                    .sort((a, b) => b.value - a.value)
                    .slice(0, 8)
                    .map((d, i) => (
                      <div key={d.country} className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-muted/40 border border-border/30">
                        <span className="h-2 w-2 rounded-full" style={{ background: CHART_COLORS[i % CHART_COLORS.length] }} />
                        <span className="text-[10px] font-semibold text-foreground">{d.country}</span>
                        <span className="text-[10px] text-muted-foreground">{formatCompact(d.value)}</span>
                      </div>
                    ))}
                </div>
              )}
            </GlassCard>

            {/* ── Country Bar Charts ── */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <GlassCard className="!p-5">
                <SectionHeader icon={Globe} title="Revenue by Country" subtitle="Geographic revenue distribution" />
                <div className="h-[320px] mt-4">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={revenueByCountry} margin={{ top: 5, right: 10, left: -10, bottom: 30 }}>
                      <defs>
                        <linearGradient id="barRevGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#f97316" stopOpacity={1} />
                          <stop offset="100%" stopColor="#dc2626" stopOpacity={0.8} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(0,0%,16%)" horizontal vertical={false} />
                      <XAxis dataKey="name" tick={{ fill: 'hsl(0,0%,55%)', fontSize: 9, fontWeight: 500 }} axisLine={false} tickLine={false} angle={-40} textAnchor="end" interval={0} />
                      <YAxis tick={{ fill: 'hsl(0,0%,50%)', fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={(v) => `₹${formatCompact(v)}`} />
                      <Tooltip content={<CustomTooltip prefix="₹" />} cursor={{ fill: 'hsl(0,0%,12%)' }} />
                      <Bar dataKey="value" name="Revenue" fill="url(#barRevGrad)" radius={[6, 6, 0, 0]} maxBarSize={36} animationDuration={800} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </GlassCard>

              <GlassCard className="!p-5">
                <SectionHeader icon={Globe} title="Streams by Country" subtitle="Geographic streams distribution" />
                <div className="h-[320px] mt-4">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={streamsByCountry} margin={{ top: 5, right: 10, left: -10, bottom: 30 }}>
                      <defs>
                        <linearGradient id="barStrGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#3b82f6" stopOpacity={1} />
                          <stop offset="100%" stopColor="#6366f1" stopOpacity={0.8} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(0,0%,16%)" horizontal vertical={false} />
                      <XAxis dataKey="name" tick={{ fill: 'hsl(0,0%,55%)', fontSize: 9, fontWeight: 500 }} axisLine={false} tickLine={false} angle={-40} textAnchor="end" interval={0} />
                      <YAxis tick={{ fill: 'hsl(0,0%,50%)', fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={(v) => formatCompact(v)} />
                      <Tooltip content={<CustomTooltip />} cursor={{ fill: 'hsl(0,0%,12%)' }} />
                      <Bar dataKey="value" name="Streams" fill="url(#barStrGrad)" radius={[6, 6, 0, 0]} maxBarSize={36} animationDuration={800} />
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

/* ════════════════════════════════════════════
   Sub-components
   ════════════════════════════════════════════ */

function KpiCard({ icon: Icon, label, value, accent }: { icon: any; label: string; value: string; accent: string }) {
  return (
    <GlassCard glow className="animate-fade-in !p-4 relative overflow-hidden group">
      {/* Subtle glow orb */}
      <div className="absolute -top-6 -right-6 w-20 h-20 rounded-full opacity-10 group-hover:opacity-20 transition-opacity duration-500" style={{ background: `radial-gradient(circle, ${accent}, transparent)` }} />
      <div className="relative flex flex-col gap-2.5">
        <div className="rounded-lg p-2 w-fit" style={{ background: `${accent}15` }}>
          <Icon className="h-4 w-4" style={{ color: accent }} />
        </div>
        <div>
          <p className="text-lg sm:text-xl font-bold font-display leading-tight tracking-tight">{value}</p>
          <p className="text-[11px] text-muted-foreground mt-0.5 font-medium uppercase tracking-wider">{label}</p>
        </div>
      </div>
    </GlassCard>
  );
}

function SectionHeader({ icon: Icon, title, subtitle }: { icon: any; title: string; subtitle: string }) {
  return (
    <div className="flex items-center gap-3">
      <div className="rounded-xl p-2.5 bg-primary/10 border border-primary/10">
        <Icon className="h-4 w-4 text-primary" />
      </div>
      <div>
        <h3 className="font-semibold text-sm text-foreground tracking-tight">{title}</h3>
        <p className="text-[11px] text-muted-foreground">{subtitle}</p>
      </div>
    </div>
  );
}

function RankRow({ rank, name, value, pct, color }: { rank: number; name: string; value: string; pct: number; color: string }) {
  return (
    <div className="flex items-center gap-3 group">
      <div className="w-6 h-6 rounded-md flex items-center justify-center text-[10px] font-bold shrink-0" style={{ background: `${color}20`, color }}>
        {rank}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-sm font-medium text-foreground truncate mr-2 group-hover:text-primary transition-colors">{name}</span>
          <span className="text-xs font-mono font-semibold text-muted-foreground whitespace-nowrap">{value}</span>
        </div>
        <div className="h-1.5 rounded-full bg-muted/60 overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-700 ease-out"
            style={{ width: `${Math.max(pct, 3)}%`, background: `linear-gradient(90deg, ${color}, ${color}aa)` }}
          />
        </div>
      </div>
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return <p className="text-muted-foreground text-sm text-center py-6">{text}</p>;
}
