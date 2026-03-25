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
import { formatStreams, formatRevenue } from '@/lib/formatNumbers';
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
  { from: '#ff6b6b', to: '#ee5a24' },
  { from: '#f0932b', to: '#e55039' },
  { from: '#fed330', to: '#f0932b' },
  { from: '#26de81', to: '#20bf6b' },
  { from: '#45aaf2', to: '#2d98da' },
  { from: '#a55eea', to: '#8854d0' },
  { from: '#fd79a8', to: '#e84393' },
  { from: '#00d2d3', to: '#01a3a4' },
  { from: '#786fa6', to: '#574b90' },
  { from: '#58B19F', to: '#38ada9' },
  { from: '#e77f67', to: '#cf6a87' },
  { from: '#778beb', to: '#546de5' },
];

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


/* ── Tooltips ── */
function CustomTooltip({ active, payload, label, prefix = '' }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-2xl border border-border/30 bg-card/95 backdrop-blur-2xl px-5 py-4 shadow-2xl shadow-black/50 ring-1 ring-white/[0.05]"
      style={{ minWidth: 180 }}>
      <p className="font-bold text-foreground text-xs mb-3 pb-2 border-b border-border/20 tracking-wide">{label}</p>
      <div className="space-y-2">
        {payload.map((p: any, i: number) => (
          <div key={i} className="flex items-center justify-between gap-6">
            <span className="flex items-center gap-2.5">
              <span className="h-3 w-3 rounded-full shadow-lg" style={{ background: p.color, boxShadow: `0 0 8px ${p.color}60` }} />
              <span className="text-muted-foreground text-xs font-medium">{p.name}</span>
            </span>
            <span className="font-mono font-bold text-foreground text-xs">{prefix}{typeof p.value === 'number' ? p.value.toLocaleString('en-IN', { maximumFractionDigits: 2 }) : p.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function PieTooltip({ active, payload, prefix = '' }: any) {
  if (!active || !payload?.length) return null;
  const d = payload[0];
  const total = d.payload?.total || 0;
  const pct = total > 0 ? ((d.value / total) * 100).toFixed(1) : '0';
  return (
    <div className="rounded-2xl border border-border/30 bg-card/95 backdrop-blur-2xl px-5 py-4 shadow-2xl shadow-black/50 ring-1 ring-white/[0.05]">
      <p className="font-bold text-foreground text-xs mb-1">{d.name}</p>
      <p className="text-base font-mono font-black text-foreground">{prefix}{d.value?.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</p>
      <p className="text-[10px] text-muted-foreground mt-1 font-semibold">{pct}% of total</p>
    </div>
  );
}

function BarTooltip({ active, payload, label, prefix = '' }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-2xl border border-border/30 bg-card/95 backdrop-blur-2xl px-5 py-4 shadow-2xl shadow-black/50 ring-1 ring-white/[0.05]"
      style={{ minWidth: 160 }}>
      <p className="font-bold text-foreground text-xs mb-2 pb-1.5 border-b border-border/20">{label}</p>
      {payload.map((p: any, i: number) => (
        <div key={i} className="flex items-center justify-between gap-4 mt-1.5">
          <span className="text-muted-foreground text-xs font-medium">{p.name}</span>
          <span className="font-mono font-bold text-foreground text-xs">{prefix}{typeof p.value === 'number' ? p.value.toLocaleString('en-IN', { maximumFractionDigits: 2 }) : p.value}</span>
        </div>
      ))}
    </div>
  );
}

function CustomLegend({ payload }: any) {
  if (!payload?.length) return null;
  return (
    <div className="flex items-center justify-center gap-8 mt-4">
      {payload.map((entry: any, i: number) => (
        <div key={i} className="flex items-center gap-2.5">
          <span className="h-2.5 w-8 rounded-full shadow-sm" style={{ background: entry.color, boxShadow: `0 0 10px ${entry.color}40` }} />
          <span className="text-[11px] text-muted-foreground font-semibold tracking-wide uppercase">{entry.value}</span>
        </div>
      ))}
    </div>
  );
}

function renderPieLabel({ cx, cy, midAngle, outerRadius, percent, name }: any) {
  const RADIAN = Math.PI / 180;
  const radius = outerRadius + 28;
  const x = cx + radius * Math.cos(-midAngle * RADIAN);
  const y = cy + radius * Math.sin(-midAngle * RADIAN);
  if (percent < 0.03) return null;
  return (
    <text x={x} y={y} fill="hsl(0 0% 75%)" textAnchor={x > cx ? 'start' : 'end'} dominantBaseline="central"
      className="text-[11px] font-bold" style={{ textShadow: '0 1px 4px rgba(0,0,0,0.5)' }}>
      {name} ({(percent * 100).toFixed(0)}%)
    </text>
  );
}

/* Custom active dot for area charts */
function GlowDot({ cx, cy, color }: { cx: number; cy: number; color: string }) {
  return (
    <g>
      <circle cx={cx} cy={cy} r={10} fill={color} opacity={0.15} />
      <circle cx={cx} cy={cy} r={6} fill="hsl(0 0% 6%)" stroke={color} strokeWidth={3} />
      <circle cx={cx} cy={cy} r={2.5} fill={color} />
    </g>
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
  const revenueByCountry = useMemo(() => aggregateByKey(filtered, 'country', 'revenue', 10), [filtered]);
  const streamsByCountry = useMemo(() => aggregateByKey(filtered, 'country', 'streams', 10), [filtered]);

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

  const PIE_COLORS = ['#f0932b', '#eb4d4b'];

  return (
    <DashboardLayout>
      <div className="space-y-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold font-display tracking-tight">Analytics</h1>
            <p className="text-muted-foreground text-sm mt-1">YouTube + OTT combined · All amounts in ₹ INR</p>
          </div>
          <div className="flex gap-1 p-1 rounded-2xl bg-muted/25 border border-border/15 w-fit backdrop-blur-sm">
            {TIME_PERIODS.map((tp) => (
              <button key={tp.key} onClick={() => setPeriod(tp.key)}
                className={`px-4 py-2 rounded-xl text-[11px] font-bold tracking-wide transition-all duration-300 ${
                  period === tp.key
                    ? 'bg-gradient-to-r from-primary to-primary/80 text-primary-foreground shadow-lg shadow-primary/25'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted/40'
                }`}
              >{tp.label}</button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
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
            <p className="text-muted-foreground text-sm mt-1 max-w-sm mx-auto">Report data will appear here once your reports are imported.</p>
          </GlassCard>
        ) : (
          <>
            {/* ── KPI Cards ── */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
              {[
                { icon: IndianRupee, label: 'Revenue', value: formatRevenue(totalRevenue), from: '#ff6b6b', to: '#ee5a24' },
                { icon: Play, label: 'Streams', value: formatStreams(totalStreams), from: '#45aaf2', to: '#4834d4' },
                { icon: Download, label: 'Downloads', value: formatStreams(totalDownloads), from: '#00d2d3', to: '#01a3a4' },
                { icon: Music2, label: 'Tracks', value: String(uniqueTracks), from: '#f0932b', to: '#e55039' },
                { icon: Users, label: 'Artists', value: String(uniqueArtists), from: '#a55eea', to: '#8854d0' },
                { icon: Globe, label: 'Countries', value: String(uniqueCountries), from: '#26de81', to: '#20bf6b' },
              ].map((kpi) => (
                <KpiCard key={kpi.label} {...kpi} />
              ))}
            </div>

            {/* ── Revenue Trend + Revenue Split ── */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
              {/* Revenue Trend Area Chart */}
              <div className="lg:col-span-2 rounded-2xl border border-border/20 bg-card/40 backdrop-blur-sm overflow-hidden">
                <div className="p-6 pb-2">
                  <SectionHeader icon={TrendingUp} title="Revenue Trend" subtitle="Monthly revenue by source" accent="#f0932b" />
                </div>
                <div className="h-[340px] px-3 pb-5">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={revenueTrend} margin={{ top: 20, right: 20, left: 5, bottom: 0 }}>
                      <defs>
                        <linearGradient id="gradOttArea" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#f0932b" stopOpacity={0.45} />
                          <stop offset="50%" stopColor="#f0932b" stopOpacity={0.12} />
                          <stop offset="100%" stopColor="#f0932b" stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id="gradYtArea" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#eb4d4b" stopOpacity={0.45} />
                          <stop offset="50%" stopColor="#eb4d4b" stopOpacity={0.12} />
                          <stop offset="100%" stopColor="#eb4d4b" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 6" stroke="hsl(0 0% 14%)" vertical={false} />
                      <XAxis dataKey="month" tick={{ fill: 'hsl(0 0% 45%)', fontSize: 10, fontWeight: 600 }} axisLine={false} tickLine={false} dy={10} />
                      <YAxis tick={{ fill: 'hsl(0 0% 40%)', fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={(v) => formatRevenue(v)} width={58} />
                      <Tooltip content={<CustomTooltip prefix="₹" />} />
                      <Legend content={<CustomLegend />} />
                      <Area type="monotone" dataKey="OTT" stroke="#f0932b" fill="url(#gradOttArea)" strokeWidth={2.5} dot={false}
                        activeDot={(props: any) => <GlowDot cx={props.cx} cy={props.cy} color="#f0932b" />} />
                      <Area type="monotone" dataKey="YouTube" stroke="#eb4d4b" fill="url(#gradYtArea)" strokeWidth={2.5} dot={false}
                        activeDot={(props: any) => <GlowDot cx={props.cx} cy={props.cy} color="#eb4d4b" />} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Revenue Split Donut */}
              <div className="rounded-2xl border border-border/20 bg-card/40 backdrop-blur-sm overflow-hidden">
                <div className="p-6 pb-2">
                  <SectionHeader icon={Disc3} title="Revenue Split" subtitle="OTT vs YouTube share" accent="#eb4d4b" />
                </div>
                <div className="h-[240px] flex items-center justify-center relative">
                  {sourceSplit.length > 0 ? (
                    <>
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <defs>
                            <linearGradient id="pieGrad0" x1="0" y1="0" x2="1" y2="1">
                              <stop offset="0%" stopColor="#ffa502" />
                              <stop offset="100%" stopColor="#f0932b" />
                            </linearGradient>
                            <linearGradient id="pieGrad1" x1="0" y1="0" x2="1" y2="1">
                              <stop offset="0%" stopColor="#ff6b6b" />
                              <stop offset="100%" stopColor="#eb4d4b" />
                            </linearGradient>
                          </defs>
                          <Pie data={sourceSplit} cx="50%" cy="50%" innerRadius={58} outerRadius={88} paddingAngle={5}
                            dataKey="value" stroke="none" labelLine={false}
                            style={{ filter: 'drop-shadow(0 4px 16px rgba(0,0,0,0.4))' }}>
                            {sourceSplit.map((_, i) => <Cell key={i} fill={`url(#pieGrad${i})`} />)}
                          </Pie>
                          <Tooltip content={<PieTooltip prefix="₹" />} />
                        </PieChart>
                      </ResponsiveContainer>
                      {/* Center label */}
                      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                        <div className="text-center">
                          <p className="text-[9px] text-muted-foreground font-bold uppercase tracking-widest">Total</p>
                          <p className="text-base font-black font-display text-foreground mt-0.5">{formatRevenue(totalRevenue)}</p>
                        </div>
                      </div>
                    </>
                  ) : (
                    <p className="text-muted-foreground text-sm">No data</p>
                  )}
                </div>
                {sourceSplit.length > 0 && (
                  <div className="flex items-center justify-center gap-8 px-5 pb-6">
                    {sourceSplit.map((s, i) => (
                      <div key={s.name} className="flex items-center gap-3">
                        <span className="h-4 w-4 rounded-lg shadow-lg" style={{ background: PIE_COLORS[i], boxShadow: `0 0 12px ${PIE_COLORS[i]}50` }} />
                        <div>
                          <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold">{s.name}</p>
                          <p className="text-sm font-black font-mono text-foreground">{formatRevenue(s.value)}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* ── Streams Trend ── */}
            <div className="rounded-2xl border border-border/20 bg-card/40 backdrop-blur-sm overflow-hidden">
              <div className="p-6 pb-2">
                <SectionHeader icon={Play} title="Streams Trend" subtitle="Monthly stream counts by source" accent="#45aaf2" />
              </div>
              <div className="h-[320px] px-3 pb-5">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={streamsTrend} margin={{ top: 20, right: 20, left: 5, bottom: 0 }}>
                    <defs>
                      <linearGradient id="sOttArea" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#45aaf2" stopOpacity={0.45} />
                        <stop offset="50%" stopColor="#45aaf2" stopOpacity={0.12} />
                        <stop offset="100%" stopColor="#45aaf2" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="sYtArea" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#26de81" stopOpacity={0.45} />
                        <stop offset="50%" stopColor="#26de81" stopOpacity={0.12} />
                        <stop offset="100%" stopColor="#26de81" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 6" stroke="hsl(0 0% 14%)" vertical={false} />
                    <XAxis dataKey="month" tick={{ fill: 'hsl(0 0% 45%)', fontSize: 10, fontWeight: 600 }} axisLine={false} tickLine={false} dy={10} />
                    <YAxis tick={{ fill: 'hsl(0 0% 40%)', fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={(v) => formatStreams(v)} width={58} />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend content={<CustomLegend />} />
                    <Area type="monotone" dataKey="OTT" stroke="#45aaf2" fill="url(#sOttArea)" strokeWidth={2.5} dot={false}
                      activeDot={(props: any) => <GlowDot cx={props.cx} cy={props.cy} color="#45aaf2" />} />
                    <Area type="monotone" dataKey="YouTube" stroke="#26de81" fill="url(#sYtArea)" strokeWidth={2.5} dot={false}
                      activeDot={(props: any) => <GlowDot cx={props.cx} cy={props.cy} color="#26de81" />} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* ── Revenue & Streams by Platform ── */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              <div className="rounded-2xl border border-border/20 bg-card/40 backdrop-blur-sm overflow-hidden">
                <div className="p-6 pb-2">
                  <SectionHeader icon={BarChart3} title="Revenue by Platform" subtitle="Top performing stores" accent="#f0932b" />
                </div>
                <div className="h-[320px] px-3 pb-5 mt-2">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={revenueByPlatform} layout="vertical" margin={{ top: 0, right: 24, left: 5, bottom: 0 }}>
                      <defs>
                        {PALETTE.map((p, i) => (
                          <linearGradient key={`rpg${i}`} id={`revBarGrad${i}`} x1="0" y1="0" x2="1" y2="0">
                            <stop offset="0%" stopColor={p.from} stopOpacity={0.75} />
                            <stop offset="100%" stopColor={p.to} stopOpacity={1} />
                          </linearGradient>
                        ))}
                      </defs>
                      <CartesianGrid strokeDasharray="3 6" stroke="hsl(0 0% 14%)" horizontal={false} />
                      <XAxis type="number" tick={{ fill: 'hsl(0 0% 42%)', fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={(v) => `₹${formatCompact(v)}`} />
                      <YAxis dataKey="name" type="category" tick={{ fill: 'hsl(0 0% 68%)', fontSize: 11, fontWeight: 600 }} width={100} axisLine={false} tickLine={false} />
                      <Tooltip content={<BarTooltip prefix="₹" />} cursor={{ fill: 'hsl(0 0% 10%)', radius: 6 }} />
                      <Bar dataKey="value" name="Revenue" radius={[0, 10, 10, 0]} maxBarSize={24} animationDuration={1200} animationEasing="ease-out">
                        {revenueByPlatform.map((_, i) => <Cell key={i} fill={`url(#revBarGrad${i % PALETTE.length})`} />)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="rounded-2xl border border-border/20 bg-card/40 backdrop-blur-sm overflow-hidden">
                <div className="p-6 pb-2">
                  <SectionHeader icon={Play} title="Streams by Platform" subtitle="Top streaming stores" accent="#45aaf2" />
                </div>
                <div className="h-[320px] px-3 pb-5 mt-2">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={streamsByPlatform} layout="vertical" margin={{ top: 0, right: 24, left: 5, bottom: 0 }}>
                      <defs>
                        {PALETTE.map((p, i) => (
                          <linearGradient key={`spg${i}`} id={`strBarGrad${i}`} x1="0" y1="0" x2="1" y2="0">
                            <stop offset="0%" stopColor={p.from} stopOpacity={0.75} />
                            <stop offset="100%" stopColor={p.to} stopOpacity={1} />
                          </linearGradient>
                        ))}
                      </defs>
                      <CartesianGrid strokeDasharray="3 6" stroke="hsl(0 0% 14%)" horizontal={false} />
                      <XAxis type="number" tick={{ fill: 'hsl(0 0% 42%)', fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={(v) => formatCompact(v)} />
                      <YAxis dataKey="name" type="category" tick={{ fill: 'hsl(0 0% 68%)', fontSize: 11, fontWeight: 600 }} width={100} axisLine={false} tickLine={false} />
                      <Tooltip content={<BarTooltip />} cursor={{ fill: 'hsl(0 0% 10%)', radius: 6 }} />
                      <Bar dataKey="value" name="Streams" radius={[0, 10, 10, 0]} maxBarSize={24} animationDuration={1200} animationEasing="ease-out">
                        {streamsByPlatform.map((_, i) => <Cell key={i} fill={`url(#strBarGrad${(i + 4) % PALETTE.length})`} />)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            {/* ── Top Tracks ── */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              <div className="rounded-2xl border border-border/20 bg-card/40 backdrop-blur-sm overflow-hidden">
                <div className="p-6 pb-3"><SectionHeader icon={Music2} title="Top Tracks · Revenue" subtitle="Highest earning tracks" accent="#fed330" /></div>
                <div className="px-6 pb-6 space-y-3">
                  {revenueByTrack.length === 0 && <EmptyState text="No track data" />}
                  {revenueByTrack.map((t, i) => (
                    <RankRow key={t.name} rank={i + 1} name={t.name} value={`₹${formatCompact(t.value)}`} pct={revenueByTrack[0] ? (t.value / revenueByTrack[0].value) * 100 : 0} pal={PALETTE[i % PALETTE.length]} />
                  ))}
                </div>
              </div>
              <div className="rounded-2xl border border-border/20 bg-card/40 backdrop-blur-sm overflow-hidden">
                <div className="p-6 pb-3"><SectionHeader icon={Music2} title="Top Tracks · Streams" subtitle="Most streamed tracks" accent="#45aaf2" /></div>
                <div className="px-6 pb-6 space-y-3">
                  {streamsByTrack.length === 0 && <EmptyState text="No track data" />}
                  {streamsByTrack.map((t, i) => (
                    <RankRow key={t.name} rank={i + 1} name={t.name} value={formatCompact(t.value)} pct={streamsByTrack[0] ? (t.value / streamsByTrack[0].value) * 100 : 0} pal={PALETTE[(i + 4) % PALETTE.length]} />
                  ))}
                </div>
              </div>
            </div>

            {/* ── Top Artists ── */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              <div className="rounded-2xl border border-border/20 bg-card/40 backdrop-blur-sm overflow-hidden">
                <div className="p-6 pb-3"><SectionHeader icon={Users} title="Top Artists · Revenue" subtitle="Highest earning artists" accent="#a55eea" /></div>
                <div className="px-6 pb-6 space-y-3">
                  {revenueByArtist.length === 0 && <EmptyState text="No artist data" />}
                  {revenueByArtist.map((a, i) => (
                    <RankRow key={a.name} rank={i + 1} name={a.name} value={`₹${formatCompact(a.value)}`} pct={revenueByArtist[0] ? (a.value / revenueByArtist[0].value) * 100 : 0} pal={PALETTE[(i + 5) % PALETTE.length]} />
                  ))}
                </div>
              </div>
              <div className="rounded-2xl border border-border/20 bg-card/40 backdrop-blur-sm overflow-hidden">
                <div className="p-6 pb-3"><SectionHeader icon={Users} title="Top Artists · Streams" subtitle="Most streamed artists" accent="#26de81" /></div>
                <div className="px-6 pb-6 space-y-3">
                  {streamsByArtist.length === 0 && <EmptyState text="No artist data" />}
                  {streamsByArtist.map((a, i) => (
                    <RankRow key={a.name} rank={i + 1} name={a.name} value={formatCompact(a.value)} pct={streamsByArtist[0] ? (a.value / streamsByArtist[0].value) * 100 : 0} pal={PALETTE[(i + 3) % PALETTE.length]} />
                  ))}
                </div>
              </div>
            </div>

            {/* ── World Map ── */}
            <div className="rounded-2xl border border-border/20 bg-card/40 backdrop-blur-sm overflow-hidden relative">
              <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/[0.03] via-transparent to-emerald-500/[0.03] pointer-events-none" />
              <div className="relative">
                <div className="p-6 pb-0"><SectionHeader icon={Globe} title="Global Streams Distribution" subtitle="Streams intensity across countries" accent="#00d2d3" /></div>
                <div className="mt-4 flex justify-center overflow-hidden px-4">
                  {worldMapData.length > 0 ? (
                    <div className="w-full max-w-4xl [&_svg]:w-full [&_svg]:h-auto">
                      <WorldMap
                        color="#00d2d3"
                        valueSuffix=" streams"
                        size="responsive"
                        data={worldMapData}
                        backgroundColor="transparent"
                        borderColor="#2a2a2a"
                        styleFunction={(context: any) => {
                          if (!context.countryValue) return { fill: 'hsl(0 0% 10%)', stroke: 'hsl(0 0% 16%)', strokeWidth: 0.4, cursor: 'default' };
                          const ratio = context.minValue !== undefined && context.maxValue !== undefined
                            ? (context.countryValue - context.minValue) / (context.maxValue - context.minValue || 1) : 0.5;
                          // Bright cyan → lime
                          const r = Math.round(0 + ratio * 38);
                          const g = Math.round(210 + ratio * (222 - 210));
                          const b = Math.round(211 + ratio * (68 - 211));
                          const opacity = 0.55 + ratio * 0.45;
                          return {
                            fill: `rgba(${r}, ${g}, ${b}, ${opacity})`,
                            stroke: 'hsl(0 0% 22%)',
                            strokeWidth: 0.5,
                            cursor: 'pointer',
                            filter: ratio > 0.4 ? `drop-shadow(0 0 ${6 + ratio * 10}px rgba(${r},${g},${b},0.5))` : 'none',
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
                  <div className="p-6 pt-5 grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {worldMapData.sort((a, b) => b.value - a.value).slice(0, 8).map((d, i) => {
                      const maxVal = worldMapData.reduce((m, x) => Math.max(m, x.value), 0);
                      const pct = maxVal > 0 ? (d.value / maxVal) * 100 : 0;
                      return (
                        <div key={d.country} className="flex items-center gap-3 px-3.5 py-3 rounded-xl bg-gradient-to-r from-muted/25 to-transparent border border-border/10 hover:border-border/25 transition-all duration-300 group">
                          <div className="w-7 h-7 rounded-lg flex items-center justify-center text-[10px] font-black shrink-0"
                            style={{ background: `linear-gradient(135deg, ${PALETTE[i % PALETTE.length].from}30, ${PALETTE[i % PALETTE.length].to}15)`, color: PALETTE[i % PALETTE.length].from }}>
                            {i + 1}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-[11px] font-bold text-foreground truncate group-hover:text-primary transition-colors">{d.country}</p>
                            <div className="flex items-center gap-2 mt-1">
                              <div className="flex-1 h-[5px] rounded-full bg-muted/30 overflow-hidden">
                                <div className="h-full rounded-full transition-all duration-700" style={{ width: `${Math.max(pct, 5)}%`, background: `linear-gradient(90deg, ${PALETTE[i % PALETTE.length].from}, ${PALETTE[i % PALETTE.length].to})`, boxShadow: `0 0 6px ${PALETTE[i % PALETTE.length].from}40` }} />
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
            </div>

            {/* ── Country Bar Charts ── */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              <div className="rounded-2xl border border-border/20 bg-card/40 backdrop-blur-sm overflow-hidden">
                <div className="p-6 pb-2"><SectionHeader icon={Globe} title="Revenue by Country" subtitle="Geographic revenue breakdown" accent="#f0932b" /></div>
                <div className="h-[360px] px-3 pb-5 mt-2">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={revenueByCountry} margin={{ top: 10, right: 16, left: 5, bottom: 40 }}>
                      <defs>
                        {revenueByCountry.map((_, i) => (
                          <linearGradient key={`rcg${i}`} id={`revCGrad${i}`} x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor={PALETTE[i % PALETTE.length].from} stopOpacity={1} />
                            <stop offset="100%" stopColor={PALETTE[i % PALETTE.length].to} stopOpacity={0.75} />
                          </linearGradient>
                        ))}
                      </defs>
                      <CartesianGrid strokeDasharray="3 6" stroke="hsl(0 0% 14%)" horizontal vertical={false} />
                      <XAxis dataKey="name" tick={{ fill: 'hsl(0 0% 50%)', fontSize: 9, fontWeight: 600 }} axisLine={false} tickLine={false} angle={-45} textAnchor="end" interval={0} />
                      <YAxis tick={{ fill: 'hsl(0 0% 40%)', fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={(v) => `₹${formatCompact(v)}`} />
                      <Tooltip content={<BarTooltip prefix="₹" />} cursor={{ fill: 'hsl(0 0% 9%)', radius: 4 }} />
                      <Bar dataKey="value" name="Revenue" radius={[8, 8, 0, 0]} maxBarSize={36} animationDuration={1000}>
                        {revenueByCountry.map((_, i) => <Cell key={i} fill={`url(#revCGrad${i})`} />)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="rounded-2xl border border-border/20 bg-card/40 backdrop-blur-sm overflow-hidden">
                <div className="p-6 pb-2"><SectionHeader icon={Globe} title="Streams by Country" subtitle="Geographic streams breakdown" accent="#00d2d3" /></div>
                <div className="h-[360px] px-3 pb-5 mt-2">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={streamsByCountry} margin={{ top: 10, right: 16, left: 5, bottom: 40 }}>
                      <defs>
                        {streamsByCountry.map((_, i) => (
                          <linearGradient key={`scg${i}`} id={`strCGrad${i}`} x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor={PALETTE[(i + 4) % PALETTE.length].from} stopOpacity={1} />
                            <stop offset="100%" stopColor={PALETTE[(i + 4) % PALETTE.length].to} stopOpacity={0.75} />
                          </linearGradient>
                        ))}
                      </defs>
                      <CartesianGrid strokeDasharray="3 6" stroke="hsl(0 0% 14%)" horizontal vertical={false} />
                      <XAxis dataKey="name" tick={{ fill: 'hsl(0 0% 50%)', fontSize: 9, fontWeight: 600 }} axisLine={false} tickLine={false} angle={-45} textAnchor="end" interval={0} />
                      <YAxis tick={{ fill: 'hsl(0 0% 40%)', fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={(v) => formatCompact(v)} />
                      <Tooltip content={<BarTooltip />} cursor={{ fill: 'hsl(0 0% 9%)', radius: 4 }} />
                      <Bar dataKey="value" name="Streams" radius={[8, 8, 0, 0]} maxBarSize={36} animationDuration={1000}>
                        {streamsByCountry.map((_, i) => <Cell key={i} fill={`url(#strCGrad${i})`} />)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
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
    <div className="rounded-2xl border border-border/15 bg-card/30 backdrop-blur-sm overflow-hidden group cursor-default animate-fade-in hover:border-border/30 transition-all duration-500">
      <div className="relative p-5">
        <div className="absolute inset-0 opacity-[0.07] group-hover:opacity-[0.14] transition-opacity duration-500"
          style={{ background: `radial-gradient(ellipse at top right, ${from}, transparent 65%)` }} />
        <div className="relative flex flex-col gap-3.5">
          <div className="rounded-xl p-2.5 w-fit shadow-lg" style={{ background: `linear-gradient(135deg, ${from}25, ${to}12)`, boxShadow: `0 4px 12px ${from}15` }}>
            <Icon className="h-4.5 w-4.5" style={{ color: from }} />
          </div>
          <div>
            <p className="text-xl sm:text-2xl font-black font-display leading-tight tracking-tight">{value}</p>
            <p className="text-[9px] text-muted-foreground mt-1 font-bold uppercase tracking-[0.2em]">{label}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function SectionHeader({ icon: Icon, title, subtitle, accent }: { icon: any; title: string; subtitle: string; accent?: string }) {
  return (
    <div className="flex items-center gap-3.5">
      <div className="rounded-xl p-2.5 border border-border/15 shadow-md"
        style={{ background: accent ? `linear-gradient(135deg, ${accent}18, ${accent}08)` : 'hsl(0 0% 12%)', boxShadow: accent ? `0 4px 12px ${accent}10` : 'none' }}>
        <Icon className="h-[18px] w-[18px]" style={{ color: accent || 'hsl(0 0% 60%)' }} />
      </div>
      <div>
        <h3 className="font-bold text-[15px] text-foreground tracking-tight">{title}</h3>
        <p className="text-[11px] text-muted-foreground font-medium mt-0.5">{subtitle}</p>
      </div>
    </div>
  );
}

function RankRow({ rank, name, value, pct, pal }: { rank: number; name: string; value: string; pct: number; pal: { from: string; to: string } }) {
  const isTop3 = rank <= 3;
  return (
    <div className="flex items-center gap-3.5 group py-1.5">
      <div className={`w-8 h-8 rounded-xl flex items-center justify-center text-[11px] font-black shrink-0 border border-border/10 shadow-md ${isTop3 ? '' : ''}`}
        style={{ background: `linear-gradient(135deg, ${pal.from}${isTop3 ? '30' : '18'}, ${pal.to}${isTop3 ? '15' : '08'})`, color: pal.from, boxShadow: isTop3 ? `0 4px 12px ${pal.from}20` : 'none' }}>
        {rank}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[13px] font-semibold text-foreground truncate mr-3 group-hover:text-primary transition-colors duration-300">{name}</span>
          <span className="text-xs font-mono font-bold text-muted-foreground whitespace-nowrap">{value}</span>
        </div>
        <div className="h-[6px] rounded-full bg-muted/30 overflow-hidden">
          <div className="h-full rounded-full transition-all duration-1000 ease-out"
            style={{ width: `${Math.max(pct, 4)}%`, background: `linear-gradient(90deg, ${pal.from}, ${pal.to})`, boxShadow: `0 0 8px ${pal.from}30` }} />
        </div>
      </div>
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return <p className="text-muted-foreground text-sm text-center py-10">{text}</p>;
}
