import { useState, useEffect, useMemo, useCallback } from 'react';
import WorldMap from 'react-svg-worldmap';
import { supabase } from '@/integrations/supabase/client';
import { DashboardLayout } from '@/components/DashboardLayout';
import { GlassCard } from '@/components/GlassCard';
import { useAuth } from '@/hooks/useAuth';
import { useImpersonate } from '@/hooks/useImpersonate';
import { normalizeIsrc } from '@/lib/isrc';
import {
  IndianRupee, TrendingUp, Music2, Globe, Play, BarChart3,
  Download, Users, Disc3,
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell,
  AreaChart, Area, Legend,
} from 'recharts';

/* ── Types ── */
type TimePeriod = '30d' | '6m' | '12m' | 'all';

interface ReportEntry {
  id: string; reporting_month: string; store: string | null;
  sales_type: string | null; country: string | null; label: string | null;
  track: string | null; artist: string | null; isrc: string | null;
  upc: string | null; currency: string | null; streams: number;
  downloads: number; net_generated_revenue: number; imported_at: string;
  source: 'ott' | 'youtube';
}

const TIME_PERIODS: { key: TimePeriod; label: string }[] = [
  { key: '30d', label: '30 Days' },
  { key: '6m', label: '6 Months' },
  { key: '12m', label: '12 Months' },
  { key: 'all', label: 'All Time' },
];

const PALETTE = [
  { from: '#f43f5e', to: '#e11d48' },
  { from: '#f97316', to: '#ea580c' },
  { from: '#eab308', to: '#ca8a04' },
  { from: '#22c55e', to: '#16a34a' },
  { from: '#06b6d4', to: '#0891b2' },
  { from: '#8b5cf6', to: '#7c3aed' },
  { from: '#ec4899', to: '#db2777' },
  { from: '#14b8a6', to: '#0d9488' },
  { from: '#6366f1', to: '#4f46e5' },
  { from: '#3b82f6', to: '#2563eb' },
  { from: '#84cc16', to: '#65a30d' },
  { from: '#f59e0b', to: '#d97706' },
];

const FLAT = PALETTE.map(p => p.from);

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
  return entries.filter((e) => { const d = parseMonthToDate(e.reporting_month); return d && d >= cutoff; });
}

function aggregateByKey<T extends ReportEntry>(data: T[], key: keyof T, metric: 'revenue' | 'streams', limit = 8): { name: string; value: number }[] {
  const map: Record<string, number> = {};
  data.forEach((e) => {
    const k = String(e[key] ?? 'Unknown');
    map[k] = (map[k] || 0) + (metric === 'revenue' ? Number(e.net_generated_revenue) || 0 : Number(e.streams) || 0);
  });
  return Object.entries(map).sort(([, a], [, b]) => b - a).slice(0, limit).map(([name, value]) => ({ name, value: Math.round(value * 100) / 100 }));
}

function formatCompact(n: number): string {
  if (n >= 10000000) return `${(n / 10000000).toFixed(2)}Cr`;
  if (n >= 100000) return `${(n / 100000).toFixed(2)}L`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return n.toLocaleString('en-IN', { maximumFractionDigits: 2 });
}

/* ── Shared Chart Config ── */
const GRID_STROKE = 'hsl(0 0% 13%)';
const AXIS_TICK = { fill: 'hsl(0 0% 42%)', fontSize: 10, fontWeight: 500 };
const AXIS_TICK_Y = { fill: 'hsl(0 0% 38%)', fontSize: 10 };

/* ── Tooltips ── */
function ChartTooltipBox({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border/40 bg-card/90 backdrop-blur-2xl px-4 py-3 shadow-2xl shadow-black/60 ring-1 ring-white/[0.04]">
      {children}
    </div>
  );
}

function CustomTooltip({ active, payload, label, prefix = '' }: any) {
  if (!active || !payload?.length) return null;
  return (
    <ChartTooltipBox>
      <p className="font-semibold text-foreground text-[11px] mb-2 pb-1.5 border-b border-border/30">{label}</p>
      <div className="space-y-1.5">
        {payload.map((p: any, i: number) => (
          <div key={i} className="flex items-center justify-between gap-6 text-[11px]">
            <span className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full ring-2 ring-white/10" style={{ background: p.color }} />
              <span className="text-muted-foreground">{p.name}</span>
            </span>
            <span className="font-mono font-bold text-foreground">{prefix}{typeof p.value === 'number' ? p.value.toLocaleString('en-IN', { maximumFractionDigits: 2 }) : p.value}</span>
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
      <p className="font-semibold text-foreground text-[11px] mb-1">{d.name}</p>
      <p className="text-sm font-mono font-bold text-foreground">{prefix}{d.value?.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</p>
      <p className="text-[10px] text-muted-foreground mt-0.5">{pct}% of total</p>
    </ChartTooltipBox>
  );
}

function CustomLegend({ payload }: any) {
  if (!payload?.length) return null;
  return (
    <div className="flex items-center justify-center gap-6 mt-3">
      {payload.map((entry: any, i: number) => (
        <div key={i} className="flex items-center gap-2">
          <span className="h-2 w-6 rounded-full" style={{ background: entry.color }} />
          <span className="text-[11px] text-muted-foreground font-medium tracking-wide">{entry.value}</span>
        </div>
      ))}
    </div>
  );
}

function renderPieLabel({ cx, cy, midAngle, outerRadius, percent, name }: any) {
  const RADIAN = Math.PI / 180;
  const radius = outerRadius + 22;
  const x = cx + radius * Math.cos(-midAngle * RADIAN);
  const y = cy + radius * Math.sin(-midAngle * RADIAN);
  if (percent < 0.03) return null;
  return (
    <text x={x} y={y} fill="hsl(0 0% 72%)" textAnchor={x > cx ? 'start' : 'end'} dominantBaseline="central" className="text-[10px] font-semibold">
      {name} ({(percent * 100).toFixed(0)}%)
    </text>
  );
}

/* ═══════════════════════ MAIN ═══════════════════════ */

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
        const ownedIsrcs = [...new Set([...(trackRows ?? []), ...(songRows ?? [])].map((row) => normalizeIsrc(row.isrc)).filter((v): v is string => Boolean(v)))];
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
    filtered.forEach((e) => { if (!map[e.reporting_month]) map[e.reporting_month] = { ott: 0, youtube: 0 }; map[e.reporting_month][e.source] += Number(e.net_generated_revenue) || 0; });
    return Object.entries(map).sort(([a], [b]) => (parseMonthToDate(a)?.getTime() || 0) - (parseMonthToDate(b)?.getTime() || 0))
      .map(([month, vals]) => ({ month: formatMonth(month), OTT: Math.round(vals.ott * 100) / 100, YouTube: Math.round(vals.youtube * 100) / 100 }));
  }, [filtered, formatMonth]);

  const streamsTrend = useMemo(() => {
    const map: Record<string, { ott: number; youtube: number }> = {};
    filtered.forEach((e) => { if (!map[e.reporting_month]) map[e.reporting_month] = { ott: 0, youtube: 0 }; map[e.reporting_month][e.source] += Number(e.streams) || 0; });
    return Object.entries(map).sort(([a], [b]) => (parseMonthToDate(a)?.getTime() || 0) - (parseMonthToDate(b)?.getTime() || 0))
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

  const worldMapData = useMemo(() => {
    const map: Record<string, number> = {};
    filtered.forEach((e) => { if (!e.country) return; const iso = COUNTRY_ISO[e.country.toLowerCase().trim()]; if (!iso) return; map[iso] = (map[iso] || 0) + (Number(e.streams) || 0); });
    return Object.entries(map).map(([country, value]) => ({ country: country as any, value }));
  }, [filtered]);

  const sourceSplit = useMemo(() => {
    let ott = 0, yt = 0;
    filtered.forEach((e) => { if (e.source === 'ott') ott += Number(e.net_generated_revenue) || 0; else yt += Number(e.net_generated_revenue) || 0; });
    const total = ott + yt;
    return [
      { name: 'OTT Platforms', value: Math.round(ott * 100) / 100, total },
      { name: 'YouTube', value: Math.round(yt * 100) / 100, total },
    ].filter((d) => d.value > 0);
  }, [filtered]);


  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold font-display tracking-tight">Analytics</h1>
            <p className="text-muted-foreground text-sm mt-1">YouTube + OTT combined · All amounts in ₹ INR</p>
          </div>
          <div className="flex gap-1 p-1 rounded-xl bg-muted/30 border border-border/20 w-fit backdrop-blur-sm">
            {TIME_PERIODS.map((tp) => (
              <button key={tp.key} onClick={() => setPeriod(tp.key)}
                className={`px-3.5 py-1.5 rounded-lg text-[11px] font-semibold tracking-wide transition-all duration-300 ${
                  period === tp.key
                    ? 'bg-gradient-to-r from-primary to-primary/80 text-primary-foreground shadow-lg shadow-primary/25'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted/40'
                }`}
              >{tp.label}</button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <GlassCard key={i} className="h-[110px] animate-pulse"><div /></GlassCard>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <GlassCard className="py-20 text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-muted/50 mb-4">
              <BarChart3 className="h-8 w-8 text-muted-foreground/50" />
            </div>
            <p className="text-foreground text-lg font-semibold">No Analytics Data</p>
            <p className="text-muted-foreground text-sm mt-1 max-w-sm mx-auto">Report data will appear here once your reports are imported.</p>
          </GlassCard>
        ) : (
          <>
            {/* ── KPI Cards ── */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              {[
                { icon: IndianRupee, label: 'Revenue', value: `₹${formatCompact(totalRevenue)}`, from: '#f43f5e', to: '#e11d48' },
                { icon: Play, label: 'Streams', value: formatCompact(totalStreams), from: '#3b82f6', to: '#6366f1' },
                { icon: Download, label: 'Downloads', value: formatCompact(totalDownloads), from: '#14b8a6', to: '#06b6d4' },
                { icon: Music2, label: 'Tracks', value: String(uniqueTracks), from: '#f97316', to: '#f59e0b' },
                { icon: Users, label: 'Artists', value: String(uniqueArtists), from: '#8b5cf6', to: '#a78bfa' },
                { icon: Globe, label: 'Countries', value: String(uniqueCountries), from: '#22c55e', to: '#4ade80' },
              ].map((kpi) => (
                <KpiCard key={kpi.label} {...kpi} />
              ))}
            </div>

            {/* ── Revenue Trend + Revenue Split ── */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <GlassCard className="lg:col-span-2 !p-0 overflow-hidden">
                <div className="p-5 pb-0">
                  <SectionHeader icon={TrendingUp} title="Revenue Trend" subtitle="Monthly revenue by source" accent="#f97316" />
                </div>
                <div className="h-[320px] px-2 pb-4 mt-2">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={revenueTrend} margin={{ top: 20, right: 20, left: 0, bottom: 0 }}>
                      <defs>
                        <linearGradient id="gradOttArea" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#f97316" stopOpacity={0.5} />
                          <stop offset="40%" stopColor="#f97316" stopOpacity={0.2} />
                          <stop offset="100%" stopColor="#f97316" stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id="gradYtArea" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#ef4444" stopOpacity={0.5} />
                          <stop offset="40%" stopColor="#ef4444" stopOpacity={0.2} />
                          <stop offset="100%" stopColor="#ef4444" stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id="gradOttLine" x1="0" y1="0" x2="1" y2="0">
                          <stop offset="0%" stopColor="#fb923c" />
                          <stop offset="100%" stopColor="#f97316" />
                        </linearGradient>
                        <linearGradient id="gradYtLine" x1="0" y1="0" x2="1" y2="0">
                          <stop offset="0%" stopColor="#f87171" />
                          <stop offset="100%" stopColor="#dc2626" />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="4 4" stroke={GRID_STROKE} vertical={false} />
                      <XAxis dataKey="month" tick={AXIS_TICK} axisLine={false} tickLine={false} dy={8} />
                      <YAxis tick={AXIS_TICK_Y} axisLine={false} tickLine={false} tickFormatter={(v) => `₹${formatCompact(v)}`} width={55} />
                      <Tooltip content={<CustomTooltip prefix="₹" />} />
                      <Legend content={<CustomLegend />} />
                      <Area type="monotone" dataKey="OTT" stroke="url(#gradOttLine)" fill="url(#gradOttArea)" strokeWidth={3} dot={false}
                        activeDot={{ r: 6, strokeWidth: 3, stroke: '#f97316', fill: 'hsl(0 0% 6%)', filter: 'drop-shadow(0 0 6px rgba(249,115,22,0.6))' }} />
                      <Area type="monotone" dataKey="YouTube" stroke="url(#gradYtLine)" fill="url(#gradYtArea)" strokeWidth={3} dot={false}
                        activeDot={{ r: 6, strokeWidth: 3, stroke: '#ef4444', fill: 'hsl(0 0% 6%)', filter: 'drop-shadow(0 0 6px rgba(239,68,68,0.6))' }} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </GlassCard>

              <GlassCard className="!p-0 overflow-hidden">
                <div className="p-5 pb-0">
                  <SectionHeader icon={Disc3} title="Revenue Split" subtitle="OTT vs YouTube" accent="#dc2626" />
                </div>
                <div className="h-[260px] mt-2 flex items-center justify-center relative">
                  {sourceSplit.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <defs>
                          <linearGradient id="pieOtt" x1="0" y1="0" x2="1" y2="1">
                            <stop offset="0%" stopColor="#fb923c" />
                            <stop offset="100%" stopColor="#f97316" />
                          </linearGradient>
                          <linearGradient id="pieYt" x1="0" y1="0" x2="1" y2="1">
                            <stop offset="0%" stopColor="#f87171" />
                            <stop offset="100%" stopColor="#dc2626" />
                          </linearGradient>
                        </defs>
                        <Pie data={sourceSplit} cx="50%" cy="48%" innerRadius={55} outerRadius={90} paddingAngle={4}
                          dataKey="value" stroke="none" labelLine={false} label={renderPieLabel}
                          style={{ filter: 'drop-shadow(0 4px 12px rgba(0,0,0,0.5))' }}>
                          <Cell fill="url(#pieOtt)" />
                          <Cell fill="url(#pieYt)" />
                        </Pie>
                        <Tooltip content={<PieTooltip prefix="₹" />} />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : (
                    <p className="text-muted-foreground text-sm">No data</p>
                  )}
                </div>
                {sourceSplit.length > 0 && (
                  <div className="flex items-center justify-center gap-6 px-5 pb-5">
                    {sourceSplit.map((s, i) => (
                      <div key={s.name} className="flex items-center gap-2.5">
                        <span className="h-3 w-3 rounded-full ring-2 ring-white/10" style={{ background: i === 0 ? '#f97316' : '#dc2626' }} />
                        <div>
                          <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">{s.name}</p>
                          <p className="text-xs font-bold font-mono text-foreground">₹{formatCompact(s.value)}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </GlassCard>
            </div>

            {/* ── Streams Trend ── */}
            <GlassCard className="!p-0 overflow-hidden">
              <div className="p-5 pb-0">
                <SectionHeader icon={Play} title="Streams Trend" subtitle="Monthly stream counts by source" accent="#3b82f6" />
              </div>
              <div className="h-[300px] px-2 pb-4 mt-2">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={streamsTrend} margin={{ top: 20, right: 20, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="gradOttSArea" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#38bdf8" stopOpacity={0.5} />
                        <stop offset="40%" stopColor="#3b82f6" stopOpacity={0.18} />
                        <stop offset="100%" stopColor="#3b82f6" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="gradYtSArea" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#34d399" stopOpacity={0.5} />
                        <stop offset="40%" stopColor="#10b981" stopOpacity={0.18} />
                        <stop offset="100%" stopColor="#10b981" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="gradOttSLine" x1="0" y1="0" x2="1" y2="0">
                        <stop offset="0%" stopColor="#7dd3fc" />
                        <stop offset="100%" stopColor="#3b82f6" />
                      </linearGradient>
                      <linearGradient id="gradYtSLine" x1="0" y1="0" x2="1" y2="0">
                        <stop offset="0%" stopColor="#6ee7b7" />
                        <stop offset="100%" stopColor="#10b981" />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="4 4" stroke={GRID_STROKE} vertical={false} />
                    <XAxis dataKey="month" tick={AXIS_TICK} axisLine={false} tickLine={false} dy={8} />
                    <YAxis tick={AXIS_TICK_Y} axisLine={false} tickLine={false} tickFormatter={(v) => formatCompact(v)} width={55} />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend content={<CustomLegend />} />
                    <Area type="monotone" dataKey="OTT" stroke="url(#gradOttSLine)" fill="url(#gradOttSArea)" strokeWidth={3} dot={false}
                      activeDot={{ r: 6, strokeWidth: 3, stroke: '#3b82f6', fill: 'hsl(0 0% 6%)', filter: 'drop-shadow(0 0 6px rgba(59,130,246,0.6))' }} />
                    <Area type="monotone" dataKey="YouTube" stroke="url(#gradYtSLine)" fill="url(#gradYtSArea)" strokeWidth={3} dot={false}
                      activeDot={{ r: 6, strokeWidth: 3, stroke: '#10b981', fill: 'hsl(0 0% 6%)', filter: 'drop-shadow(0 0 6px rgba(16,185,129,0.6))' }} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </GlassCard>

            {/* ── Revenue & Streams by Platform ── */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <GlassCard className="!p-0 overflow-hidden">
                <div className="p-5 pb-0">
                  <SectionHeader icon={BarChart3} title="Revenue by Platform" subtitle="Top performing stores" accent="#f97316" />
                </div>
                <div className="h-[300px] px-2 pb-4 mt-4">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={revenueByPlatform} layout="vertical" margin={{ top: 0, right: 24, left: 0, bottom: 0 }}>
                      <SharedDefs />
                      <CartesianGrid strokeDasharray="4 4" stroke={GRID_STROKE} horizontal={false} />
                      <XAxis type="number" tick={AXIS_TICK_Y} axisLine={false} tickLine={false} tickFormatter={(v) => `₹${formatCompact(v)}`} />
                      <YAxis dataKey="name" type="category" tick={{ fill: 'hsl(0 0% 65%)', fontSize: 11, fontWeight: 600 }} width={95} axisLine={false} tickLine={false} />
                      <Tooltip content={<CustomTooltip prefix="₹" />} cursor={{ fill: 'hsl(0 0% 10%)', radius: 6 }} />
                      <Bar dataKey="value" name="Revenue" radius={[0, 8, 8, 0]} maxBarSize={22} animationDuration={1000} animationEasing="ease-out">
                        {revenueByPlatform.map((_, i) => <Cell key={i} fill={`url(#hbarGrad${i % PALETTE.length})`} />)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </GlassCard>

              <GlassCard className="!p-0 overflow-hidden">
                <div className="p-5 pb-0">
                  <SectionHeader icon={Play} title="Streams by Platform" subtitle="Top streaming stores" accent="#3b82f6" />
                </div>
                <div className="h-[300px] px-2 pb-4 mt-4">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={streamsByPlatform} layout="vertical" margin={{ top: 0, right: 24, left: 0, bottom: 0 }}>
                      <SharedDefs />
                      <CartesianGrid strokeDasharray="4 4" stroke={GRID_STROKE} horizontal={false} />
                      <XAxis type="number" tick={AXIS_TICK_Y} axisLine={false} tickLine={false} tickFormatter={(v) => formatCompact(v)} />
                      <YAxis dataKey="name" type="category" tick={{ fill: 'hsl(0 0% 65%)', fontSize: 11, fontWeight: 600 }} width={95} axisLine={false} tickLine={false} />
                      <Tooltip content={<CustomTooltip />} cursor={{ fill: 'hsl(0 0% 10%)', radius: 6 }} />
                      <Bar dataKey="value" name="Streams" radius={[0, 8, 8, 0]} maxBarSize={22} animationDuration={1000} animationEasing="ease-out">
                        {streamsByPlatform.map((_, i) => <Cell key={i} fill={`url(#hbarGrad${(i + 4) % PALETTE.length})`} />)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </GlassCard>
            </div>

            {/* ── Top Tracks ── */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <GlassCard className="!p-0 overflow-hidden">
                <div className="p-5 pb-3"><SectionHeader icon={Music2} title="Top Tracks · Revenue" subtitle="Highest earning tracks" accent="#eab308" /></div>
                <div className="px-5 pb-5 space-y-2.5">
                  {revenueByTrack.length === 0 && <EmptyState text="No track data" />}
                  {revenueByTrack.map((t, i) => (
                    <RankRow key={t.name} rank={i + 1} name={t.name} value={`₹${formatCompact(t.value)}`} pct={revenueByTrack[0] ? (t.value / revenueByTrack[0].value) * 100 : 0} pal={PALETTE[i % PALETTE.length]} />
                  ))}
                </div>
              </GlassCard>
              <GlassCard className="!p-0 overflow-hidden">
                <div className="p-5 pb-3"><SectionHeader icon={Music2} title="Top Tracks · Streams" subtitle="Most streamed tracks" accent="#3b82f6" /></div>
                <div className="px-5 pb-5 space-y-2.5">
                  {streamsByTrack.length === 0 && <EmptyState text="No track data" />}
                  {streamsByTrack.map((t, i) => (
                    <RankRow key={t.name} rank={i + 1} name={t.name} value={formatCompact(t.value)} pct={streamsByTrack[0] ? (t.value / streamsByTrack[0].value) * 100 : 0} pal={PALETTE[(i + 4) % PALETTE.length]} />
                  ))}
                </div>
              </GlassCard>
            </div>

            {/* ── Top Artists ── */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <GlassCard className="!p-0 overflow-hidden">
                <div className="p-5 pb-3"><SectionHeader icon={Users} title="Top Artists · Revenue" subtitle="Highest earning artists" accent="#8b5cf6" /></div>
                <div className="px-5 pb-5 space-y-2.5">
                  {revenueByArtist.length === 0 && <EmptyState text="No artist data" />}
                  {revenueByArtist.map((a, i) => (
                    <RankRow key={a.name} rank={i + 1} name={a.name} value={`₹${formatCompact(a.value)}`} pct={revenueByArtist[0] ? (a.value / revenueByArtist[0].value) * 100 : 0} pal={PALETTE[(i + 5) % PALETTE.length]} />
                  ))}
                </div>
              </GlassCard>
              <GlassCard className="!p-0 overflow-hidden">
                <div className="p-5 pb-3"><SectionHeader icon={Users} title="Top Artists · Streams" subtitle="Most streamed artists" accent="#22c55e" /></div>
                <div className="px-5 pb-5 space-y-2.5">
                  {streamsByArtist.length === 0 && <EmptyState text="No artist data" />}
                  {streamsByArtist.map((a, i) => (
                    <RankRow key={a.name} rank={i + 1} name={a.name} value={formatCompact(a.value)} pct={streamsByArtist[0] ? (a.value / streamsByArtist[0].value) * 100 : 0} pal={PALETTE[(i + 3) % PALETTE.length]} />
                  ))}
                </div>
              </GlassCard>
            </div>

            {/* ── World Map ── */}
            <GlassCard className="!p-0 overflow-hidden relative">
              <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/[0.04] via-transparent to-emerald-500/[0.04] pointer-events-none" />
              <div className="relative">
                <div className="p-5 pb-0"><SectionHeader icon={Globe} title="Global Streams Distribution" subtitle="Streams intensity across countries" accent="#22d3ee" /></div>
                <div className="mt-4 flex justify-center overflow-hidden px-4">
                  {worldMapData.length > 0 ? (
                    <div className="w-full max-w-4xl [&_svg]:w-full [&_svg]:h-auto">
                      <WorldMap
                        color="#22d3ee"
                        valueSuffix=" streams"
                        size="responsive"
                        data={worldMapData}
                        backgroundColor="transparent"
                        borderColor="#2a2a2a"
                        styleFunction={(context: any) => {
                          if (!context.countryValue) return { fill: 'hsl(0 0% 10%)', stroke: 'hsl(0 0% 16%)', strokeWidth: 0.4, cursor: 'default' };
                          const ratio = context.minValue !== undefined && context.maxValue !== undefined
                            ? (context.countryValue - context.minValue) / (context.maxValue - context.minValue || 1) : 0.5;
                          // Vivid cyan → emerald → lime gradient
                          const r = Math.round(6 + ratio * 74);
                          const g = Math.round(182 + ratio * (250 - 182));
                          const b = Math.round(212 + ratio * (50 - 212));
                          const opacity = 0.6 + ratio * 0.4;
                          return {
                            fill: `rgba(${r}, ${g}, ${b}, ${opacity})`,
                            stroke: 'hsl(0 0% 20%)',
                            strokeWidth: 0.5,
                            cursor: 'pointer',
                            filter: ratio > 0.5 ? `drop-shadow(0 0 ${4 + ratio * 8}px rgba(${r},${g},${b},0.5))` : 'none',
                          };
                        }}
                      />
                    </div>
                  ) : (
                    <div className="py-16 text-center">
                      <Globe className="h-12 w-12 mx-auto text-muted-foreground/20 mb-3" />
                      <p className="text-muted-foreground text-sm">No geographic data available</p>
                    </div>
                  )}
                </div>
                {worldMapData.length > 0 && (
                  <div className="p-5 pt-4 grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {worldMapData.sort((a, b) => b.value - a.value).slice(0, 8).map((d, i) => {
                      const maxVal = worldMapData.reduce((m, x) => Math.max(m, x.value), 0);
                      const pct = maxVal > 0 ? (d.value / maxVal) * 100 : 0;
                      return (
                        <div key={d.country} className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg bg-gradient-to-r from-muted/30 to-muted/10 border border-border/15 hover:border-border/30 transition-colors">
                          <div className="w-6 h-6 rounded-md flex items-center justify-center text-[10px] font-black shrink-0"
                            style={{ background: `linear-gradient(135deg, ${PALETTE[i % PALETTE.length].from}25, ${PALETTE[i % PALETTE.length].to}15)`, color: PALETTE[i % PALETTE.length].from }}>
                            {i + 1}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-[11px] font-semibold text-foreground truncate">{d.country}</p>
                            <div className="flex items-center gap-1.5 mt-1">
                              <div className="flex-1 h-1.5 rounded-full bg-muted/40 overflow-hidden">
                                <div className="h-full rounded-full transition-all duration-700" style={{ width: `${Math.max(pct, 5)}%`, background: `linear-gradient(90deg, ${PALETTE[i % PALETTE.length].from}, ${PALETTE[i % PALETTE.length].to})` }} />
                              </div>
                              <span className="text-[9px] text-muted-foreground font-mono font-bold">{formatCompact(d.value)}</span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </GlassCard>

            {/* ── Country Bar Charts ── */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <GlassCard className="!p-0 overflow-hidden">
                <div className="p-5 pb-0"><SectionHeader icon={Globe} title="Revenue by Country" subtitle="Geographic revenue breakdown" accent="#f59e0b" /></div>
                <div className="h-[340px] px-2 pb-4 mt-4">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={revenueByCountry} margin={{ top: 5, right: 16, left: 0, bottom: 35 }}>
                      <SharedDefs />
                      <CartesianGrid strokeDasharray="4 4" stroke={GRID_STROKE} horizontal vertical={false} />
                      <XAxis dataKey="name" tick={{ fill: 'hsl(0 0% 50%)', fontSize: 9, fontWeight: 600 }} axisLine={false} tickLine={false} angle={-45} textAnchor="end" interval={0} />
                      <YAxis tick={AXIS_TICK_Y} axisLine={false} tickLine={false} tickFormatter={(v) => `₹${formatCompact(v)}`} />
                      <Tooltip content={<CustomTooltip prefix="₹" />} cursor={{ fill: 'hsl(0 0% 9%)', radius: 4 }} />
                      <Bar dataKey="value" name="Revenue" fill="url(#barRevCountry)" radius={[6, 6, 0, 0]} maxBarSize={32} animationDuration={900} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </GlassCard>

              <GlassCard className="!p-0 overflow-hidden">
                <div className="p-5 pb-0"><SectionHeader icon={Globe} title="Streams by Country" subtitle="Geographic streams breakdown" accent="#06b6d4" /></div>
                <div className="h-[340px] px-2 pb-4 mt-4">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={streamsByCountry} margin={{ top: 5, right: 16, left: 0, bottom: 35 }}>
                      <SharedDefs />
                      <CartesianGrid strokeDasharray="4 4" stroke={GRID_STROKE} horizontal vertical={false} />
                      <XAxis dataKey="name" tick={{ fill: 'hsl(0 0% 50%)', fontSize: 9, fontWeight: 600 }} axisLine={false} tickLine={false} angle={-45} textAnchor="end" interval={0} />
                      <YAxis tick={AXIS_TICK_Y} axisLine={false} tickLine={false} tickFormatter={(v) => formatCompact(v)} />
                      <Tooltip content={<CustomTooltip />} cursor={{ fill: 'hsl(0 0% 9%)', radius: 4 }} />
                      <Bar dataKey="value" name="Streams" fill="url(#barStrCountry)" radius={[6, 6, 0, 0]} maxBarSize={32} animationDuration={900} />
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

/* ═══════════════════════ Sub-components ═══════════════════════ */

function KpiCard({ icon: Icon, label, value, from, to }: { icon: any; label: string; value: string; from: string; to: string }) {
  return (
    <GlassCard className="animate-fade-in !p-0 overflow-hidden group cursor-default">
      <div className="relative p-4">
        {/* Gradient glow background */}
        <div className="absolute inset-0 opacity-[0.06] group-hover:opacity-[0.12] transition-opacity duration-500"
          style={{ background: `radial-gradient(ellipse at top right, ${from}, transparent 70%)` }} />
        <div className="relative flex flex-col gap-3">
          <div className="rounded-lg p-2 w-fit" style={{ background: `linear-gradient(135deg, ${from}20, ${to}10)` }}>
            <Icon className="h-4 w-4" style={{ color: from }} />
          </div>
          <div>
            <p className="text-lg sm:text-xl font-bold font-display leading-tight tracking-tight">{value}</p>
            <p className="text-[10px] text-muted-foreground mt-0.5 font-semibold uppercase tracking-widest">{label}</p>
          </div>
        </div>
      </div>
    </GlassCard>
  );
}

function SectionHeader({ icon: Icon, title, subtitle, accent }: { icon: any; title: string; subtitle: string; accent?: string }) {
  return (
    <div className="flex items-center gap-3">
      <div className="rounded-xl p-2.5 border border-border/20"
        style={{ background: accent ? `linear-gradient(135deg, ${accent}15, ${accent}08)` : 'hsl(0 0% 12%)' }}>
        <Icon className="h-4 w-4" style={{ color: accent || 'hsl(0 0% 60%)' }} />
      </div>
      <div>
        <h3 className="font-semibold text-sm text-foreground tracking-tight">{title}</h3>
        <p className="text-[11px] text-muted-foreground">{subtitle}</p>
      </div>
    </div>
  );
}

function RankRow({ rank, name, value, pct, pal }: { rank: number; name: string; value: string; pct: number; pal: { from: string; to: string } }) {
  return (
    <div className="flex items-center gap-3 group py-1">
      <div className="w-7 h-7 rounded-lg flex items-center justify-center text-[10px] font-black shrink-0 border border-border/10"
        style={{ background: `linear-gradient(135deg, ${pal.from}20, ${pal.to}10)`, color: pal.from }}>
        {rank}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-[13px] font-medium text-foreground truncate mr-3 group-hover:text-primary transition-colors">{name}</span>
          <span className="text-xs font-mono font-bold text-muted-foreground whitespace-nowrap">{value}</span>
        </div>
        <div className="h-[5px] rounded-full bg-muted/40 overflow-hidden">
          <div className="h-full rounded-full transition-all duration-700 ease-out"
            style={{ width: `${Math.max(pct, 4)}%`, background: `linear-gradient(90deg, ${pal.from}, ${pal.to})` }} />
        </div>
      </div>
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return <p className="text-muted-foreground text-sm text-center py-8">{text}</p>;
}
