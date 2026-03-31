import { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { DashboardLayout } from '@/components/DashboardLayout';
import { GlassCard } from '@/components/GlassCard';
import { useAuth } from '@/hooks/useAuth';
import { useImpersonate } from '@/hooks/useImpersonate';
import { formatStreams, formatRevenue } from '@/lib/formatNumbers';
import {
  IndianRupee, TrendingUp, Play, BarChart3, Tv, Users, Clock,
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell,
  AreaChart, Area, Legend,
} from 'recharts';

type TimePeriod = '30d' | '6m' | '12m' | 'all';

interface CmsEntry {
  id: string;
  channel_name: string;
  reporting_month: string;
  label: string | null;
  track: string | null;
  artist: string | null;
  streams: number;
  downloads: number;
  net_generated_revenue: number;
  extra_data?: Record<string, string>;
}

interface CmsLink {
  channel_name: string;
  cut_percent: number;
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

function filterByPeriod(entries: CmsEntry[], period: TimePeriod): CmsEntry[] {
  if (period === 'all') return entries;
  const now = new Date();
  let cutoff: Date;
  if (period === '30d') cutoff = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());
  else if (period === '6m') cutoff = new Date(now.getFullYear(), now.getMonth() - 6, 1);
  else cutoff = new Date(now.getFullYear() - 1, now.getMonth(), 1);
  return entries.filter((e) => { const d = parseMonthToDate(e.reporting_month); return d && d >= cutoff; });
}

function aggregateByKey(data: CmsEntry[], key: keyof CmsEntry, metric: 'revenue' | 'streams' | 'net_payable', cmsLinks: CmsLink[], limit = 8): { name: string; value: number }[] {
  const map: Record<string, number> = {};
  data.forEach((e) => {
    const k = String(e[key] ?? 'Unknown');
    let val = 0;
    if (metric === 'revenue') val = Number(e.net_generated_revenue) || 0;
    else if (metric === 'streams') val = Number(e.streams) || 0;
    else {
      const rev = Number(e.net_generated_revenue) || 0;
      const link = cmsLinks.find(l => l.channel_name === e.channel_name);
      const cut = Number(link?.cut_percent) || 0;
      val = rev - (rev * cut / 100);
    }
    map[k] = (map[k] || 0) + val;
  });
  return Object.entries(map).sort(([, a], [, b]) => b - a).slice(0, limit).map(([name, value]) => ({ name, value: Math.round(value * 100) / 100 }));
}

/* Tooltips */
function CustomTooltip({ active, payload, label, prefix = '' }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-2xl border border-border/30 bg-card/95 backdrop-blur-2xl px-5 py-4 shadow-2xl shadow-black/50 ring-1 ring-white/[0.05]" style={{ minWidth: 180 }}>
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
    <div className="rounded-2xl border border-border/30 bg-card/95 backdrop-blur-2xl px-5 py-4 shadow-2xl shadow-black/50 ring-1 ring-white/[0.05]" style={{ minWidth: 160 }}>
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

export default function CmsAnalytics() {
  const { user, role } = useAuth();
  const { impersonatedUserId, isImpersonating } = useImpersonate();
  const [entries, setEntries] = useState<CmsEntry[]>([]);
  const [cmsLinks, setCmsLinks] = useState<CmsLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<TimePeriod>('all');
  const [extraKeys, setExtraKeys] = useState<string[]>([]);

  const activeUserId = (role === 'admin' && isImpersonating && impersonatedUserId) ? impersonatedUserId : user?.id;

  const fetchData = useCallback(async () => {
    if (!user) return;
    setLoading(true);

    // Fetch user's linked channels
    const { data: links } = await supabase
      .from('youtube_cms_links' as any)
      .select('channel_name, cut_percent')
      .eq('user_id', activeUserId)
      .eq('status', 'linked');

    const myLinks = (links as any[]) || [];
    setCmsLinks(myLinks);

    if (myLinks.length === 0) {
      setEntries([]);
      setLoading(false);
      return;
    }

    const channelNames = myLinks.map(l => l.channel_name);

    // Fetch CMS report entries for those channels (exclude frozen)
    const { data: reportData } = await supabase
      .from('cms_report_entries' as any)
      .select('*')
      .in('channel_name', channelNames)
      .eq('revenue_frozen', false);

    const raw = (reportData as any[]) || [];
    const mapped: CmsEntry[] = raw.map((e: any) => ({
      id: e.id,
      channel_name: e.channel_name,
      reporting_month: e.reporting_month,
      label: e.label,
      track: e.track,
      artist: e.artist,
      streams: Number(e.streams) || 0,
      downloads: Number(e.downloads) || 0,
      net_generated_revenue: Number(e.net_generated_revenue) || 0,
      extra_data: e.extra_data || {},
    }));

    // Discover dynamic extra_data keys (e.g. watchtime)
    const keys = new Set<string>();
    mapped.forEach(e => {
      if (e.extra_data) Object.keys(e.extra_data).forEach(k => keys.add(k));
    });
    setExtraKeys(Array.from(keys));
    setEntries(mapped);
    setLoading(false);
  }, [user, activeUserId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const filtered = useMemo(() => filterByPeriod(entries, period), [entries, period]);

  // KPI calculations
  const totalRevenue = useMemo(() => filtered.reduce((s, e) => s + e.net_generated_revenue, 0), [filtered]);
  const totalStreams = useMemo(() => filtered.reduce((s, e) => s + e.streams, 0), [filtered]);
  const totalNetPayable = useMemo(() => {
    return filtered.reduce((s, e) => {
      const rev = e.net_generated_revenue;
      const link = cmsLinks.find(l => l.channel_name === e.channel_name);
      const cut = Number(link?.cut_percent) || 0;
      return s + (rev - (rev * cut / 100));
    }, 0);
  }, [filtered, cmsLinks]);
  const totalCutAmount = useMemo(() => totalRevenue - totalNetPayable, [totalRevenue, totalNetPayable]);
  const uniqueChannels = useMemo(() => new Set(filtered.map(e => e.channel_name)).size, [filtered]);
  const uniqueArtists = useMemo(() => new Set(filtered.map(e => e.artist).filter(Boolean)).size, [filtered]);

  // Dynamic numeric extra columns aggregation
  const extraNumericTotals = useMemo(() => {
    const totals: Record<string, number> = {};
    extraKeys.forEach(k => {
      totals[k] = filtered.reduce((s, e) => {
        const val = Number(e.extra_data?.[k]) || 0;
        return s + val;
      }, 0);
    });
    return totals;
  }, [filtered, extraKeys]);

  const formatMonth = useCallback((month: string) =>
    month.split(' ').map((w, i) => i === 0 ? w.slice(0, 3) : `'${w.slice(2)}`).join(' '), []);

  // Revenue trend by month
  const revenueTrend = useMemo(() => {
    const map: Record<string, { revenue: number; net_payable: number }> = {};
    filtered.forEach((e) => {
      if (!map[e.reporting_month]) map[e.reporting_month] = { revenue: 0, net_payable: 0 };
      const rev = e.net_generated_revenue;
      const link = cmsLinks.find(l => l.channel_name === e.channel_name);
      const cut = Number(link?.cut_percent) || 0;
      map[e.reporting_month].revenue += rev;
      map[e.reporting_month].net_payable += rev - (rev * cut / 100);
    });
    return Object.entries(map).sort(([a], [b]) => (parseMonthToDate(a)?.getTime() || 0) - (parseMonthToDate(b)?.getTime() || 0))
      .map(([month, vals]) => ({
        month: formatMonth(month),
        'Net Revenue': Math.round(vals.revenue * 100) / 100,
        'Net Payable': Math.round(vals.net_payable * 100) / 100,
      }));
  }, [filtered, cmsLinks, formatMonth]);

  // Revenue by channel
  const revenueByChannel = useMemo(() => aggregateByKey(filtered, 'channel_name', 'net_payable', cmsLinks), [filtered, cmsLinks]);
  const revByLabel = useMemo(() => aggregateByKey(filtered, 'label', 'net_payable', cmsLinks), [filtered, cmsLinks]);
  const revByArtist = useMemo(() => aggregateByKey(filtered, 'artist', 'net_payable', cmsLinks), [filtered, cmsLinks]);
  const streamsByChannel = useMemo(() => aggregateByKey(filtered, 'channel_name', 'streams', cmsLinks), [filtered, cmsLinks]);

  // Channel split donut
  const channelSplit = useMemo(() => {
    const map: Record<string, number> = {};
    filtered.forEach(e => {
      const rev = e.net_generated_revenue;
      const link = cmsLinks.find(l => l.channel_name === e.channel_name);
      const cut = Number(link?.cut_percent) || 0;
      map[e.channel_name] = (map[e.channel_name] || 0) + (rev - (rev * cut / 100));
    });
    const total = Object.values(map).reduce((s, v) => s + v, 0);
    return Object.entries(map).map(([name, value]) => ({ name, value: Math.round(value * 100) / 100, total })).filter(d => d.value > 0);
  }, [filtered, cmsLinks]);

  // Dynamic extra_data trends (e.g. watchtime)
  const extraTrends = useMemo(() => {
    if (extraKeys.length === 0) return [];
    return extraKeys.filter(k => {
      // Only show keys that have numeric values
      return filtered.some(e => !isNaN(Number(e.extra_data?.[k])) && Number(e.extra_data?.[k]) > 0);
    }).map(key => {
      const map: Record<string, number> = {};
      filtered.forEach(e => {
        if (!map[e.reporting_month]) map[e.reporting_month] = 0;
        map[e.reporting_month] += Number(e.extra_data?.[key]) || 0;
      });
      return {
        key,
        label: key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
        data: Object.entries(map).sort(([a], [b]) => (parseMonthToDate(a)?.getTime() || 0) - (parseMonthToDate(b)?.getTime() || 0))
          .map(([month, value]) => ({ month: formatMonth(month), value: Math.round(value * 100) / 100 })),
      };
    });
  }, [filtered, extraKeys, formatMonth]);

  const PIE_COLORS = PALETTE.map(p => p.from);

  return (
    <DashboardLayout>
      <div className="space-y-4 sm:space-y-6 lg:space-y-8">
        {/* Header */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between sm:gap-4">
          <div>
            <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold font-display tracking-tight">CMS Analytics</h1>
            <p className="text-muted-foreground text-xs sm:text-sm mt-1">YouTube CMS channel performance · All amounts in ₹ INR</p>
          </div>
          <div className="flex gap-1 p-1 rounded-2xl bg-muted/25 border border-border/15 w-full sm:w-fit backdrop-blur-sm overflow-x-auto scrollbar-none">
            {TIME_PERIODS.map((tp) => (
              <button key={tp.key} onClick={() => setPeriod(tp.key)}
                className={`flex-1 sm:flex-none px-3 sm:px-4 py-1.5 sm:py-2 rounded-xl text-[10px] sm:text-[11px] font-bold tracking-wide transition-all duration-300 whitespace-nowrap ${
                  period === tp.key
                    ? 'bg-gradient-to-r from-primary to-primary/80 text-primary-foreground shadow-lg shadow-primary/25'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted/40'
                }`}
              >{tp.label}</button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 sm:gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <GlassCard key={i} className="h-[120px] animate-pulse"><div /></GlassCard>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <GlassCard className="py-20 text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-muted/50 mb-4">
              <BarChart3 className="h-8 w-8 text-muted-foreground/50" />
            </div>
            <p className="text-foreground text-lg font-semibold">No CMS Analytics Data</p>
            <p className="text-muted-foreground text-sm mt-1 max-w-sm mx-auto">CMS report data will appear here once your channel reports are imported.</p>
          </GlassCard>
        ) : (
          <>
            {/* KPI Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 sm:gap-4">
              {[
                { icon: IndianRupee, label: 'Net Revenue', value: formatRevenue(totalRevenue), from: '#ff6b6b', to: '#ee5a24' },
                { icon: TrendingUp, label: 'Net Payable', value: formatRevenue(totalNetPayable), from: '#26de81', to: '#20bf6b' },
                { icon: IndianRupee, label: 'CMS Cut', value: formatRevenue(totalCutAmount), from: '#f0932b', to: '#e55039' },
                { icon: Play, label: 'Streams', value: formatStreams(totalStreams), from: '#45aaf2', to: '#2d98da' },
                { icon: Tv, label: 'Channels', value: String(uniqueChannels), from: '#a55eea', to: '#8854d0' },
                { icon: Users, label: 'Artists', value: String(uniqueArtists), from: '#00d2d3', to: '#01a3a4' },
                // Dynamic extra KPIs
                ...extraKeys.filter(k => (extraNumericTotals[k] || 0) > 0).slice(0, 2).map((k, i) => ({
                  icon: Clock,
                  label: k.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
                  value: formatStreams(extraNumericTotals[k] || 0),
                  from: PALETTE[(i + 6) % PALETTE.length].from,
                  to: PALETTE[(i + 6) % PALETTE.length].to,
                })),
              ].map((kpi) => (
                <KpiCard key={kpi.label} {...kpi} />
              ))}
            </div>

            {/* Revenue Trend + Channel Split */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 sm:gap-5">
              <div className="lg:col-span-2 rounded-2xl border border-border/20 bg-card/40 backdrop-blur-sm overflow-hidden">
                <div className="p-4 sm:p-6 pb-2">
                  <SectionHeader icon={TrendingUp} title="CMS Revenue Trend" subtitle="Net Revenue vs Net Payable by month" accent="#f0932b" />
                </div>
                <div className="h-[240px] sm:h-[300px] lg:h-[340px] px-1 sm:px-3 pb-3 sm:pb-5">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={revenueTrend} margin={{ top: 20, right: 20, left: 5, bottom: 0 }}>
                      <defs>
                        <linearGradient id="gradRevArea" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#f0932b" stopOpacity={0.45} />
                          <stop offset="100%" stopColor="#f0932b" stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id="gradPayArea" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#26de81" stopOpacity={0.45} />
                          <stop offset="100%" stopColor="#26de81" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 6" stroke="hsl(0 0% 14%)" vertical={false} />
                      <XAxis dataKey="month" tick={{ fill: 'hsl(0 0% 45%)', fontSize: 10, fontWeight: 600 }} axisLine={false} tickLine={false} dy={10} />
                      <YAxis tick={{ fill: 'hsl(0 0% 40%)', fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={(v) => formatRevenue(v)} width={58} />
                      <Tooltip content={<CustomTooltip prefix="₹" />} />
                      <Legend content={<CustomLegend />} />
                      <Area type="monotone" dataKey="Net Revenue" stroke="#f0932b" fill="url(#gradRevArea)" strokeWidth={2.5} dot={false}
                        activeDot={(props: any) => <GlowDot cx={props.cx} cy={props.cy} color="#f0932b" />} />
                      <Area type="monotone" dataKey="Net Payable" stroke="#26de81" fill="url(#gradPayArea)" strokeWidth={2.5} dot={false}
                        activeDot={(props: any) => <GlowDot cx={props.cx} cy={props.cy} color="#26de81" />} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Channel Split Donut */}
              <div className="rounded-2xl border border-border/20 bg-card/40 backdrop-blur-sm overflow-hidden">
                <div className="p-4 sm:p-6 pb-2">
                  <SectionHeader icon={Tv} title="Channel Split" subtitle="Net payable by channel" accent="#a55eea" />
                </div>
                <div className="h-[200px] sm:h-[240px] flex items-center justify-center relative">
                  {channelSplit.length > 0 ? (
                    <>
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <defs>
                            {channelSplit.map((_, i) => (
                              <linearGradient key={`csg${i}`} id={`cmsPieGrad${i}`} x1="0" y1="0" x2="1" y2="1">
                                <stop offset="0%" stopColor={PALETTE[i % PALETTE.length].from} />
                                <stop offset="100%" stopColor={PALETTE[i % PALETTE.length].to} />
                              </linearGradient>
                            ))}
                          </defs>
                          <Pie data={channelSplit} cx="50%" cy="50%" innerRadius={45} outerRadius={72} paddingAngle={5}
                            dataKey="value" stroke="none" style={{ filter: 'drop-shadow(0 4px 16px rgba(0,0,0,0.4))' }}>
                            {channelSplit.map((_, i) => <Cell key={i} fill={`url(#cmsPieGrad${i})`} />)}
                          </Pie>
                          <Tooltip content={<PieTooltip prefix="₹" />} />
                        </PieChart>
                      </ResponsiveContainer>
                      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                        <div className="text-center">
                          <p className="text-[9px] text-muted-foreground font-bold uppercase tracking-widest">Total</p>
                          <p className="text-base font-black font-display text-foreground mt-0.5">{formatRevenue(totalNetPayable)}</p>
                        </div>
                      </div>
                    </>
                  ) : (
                    <p className="text-muted-foreground text-sm">No data</p>
                  )}
                </div>
                {channelSplit.length > 0 && (
                  <div className="flex flex-col gap-2 px-4 sm:px-5 pb-4 sm:pb-6">
                    {channelSplit.map((s, i) => (
                      <div key={s.name} className="flex items-center gap-3">
                        <span className="h-3 w-3 rounded-md shadow-lg" style={{ background: PIE_COLORS[i % PIE_COLORS.length], boxShadow: `0 0 8px ${PIE_COLORS[i % PIE_COLORS.length]}50` }} />
                        <div className="flex-1 min-w-0">
                          <p className="text-[10px] text-muted-foreground font-bold truncate">{s.name}</p>
                        </div>
                        <p className="text-xs font-mono font-bold text-foreground">{formatRevenue(s.value)}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Revenue by Channel & Label */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-5">
              <div className="rounded-2xl border border-border/20 bg-card/40 backdrop-blur-sm overflow-hidden">
                <div className="p-4 sm:p-6 pb-2">
                  <SectionHeader icon={Tv} title="Net Payable by Channel" subtitle="Top earning channels" accent="#f0932b" />
                </div>
                <div className="h-[260px] sm:h-[290px] lg:h-[320px] px-1 sm:px-3 pb-3 sm:pb-5 mt-2">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={revenueByChannel} layout="vertical" margin={{ top: 0, right: 16, left: 0, bottom: 0 }}>
                      <defs>
                        {PALETTE.map((p, i) => (
                          <linearGradient key={`rcg${i}`} id={`cmsRevBarGrad${i}`} x1="0" y1="0" x2="1" y2="0">
                            <stop offset="0%" stopColor={p.from} stopOpacity={0.75} />
                            <stop offset="100%" stopColor={p.to} stopOpacity={1} />
                          </linearGradient>
                        ))}
                      </defs>
                      <CartesianGrid strokeDasharray="3 6" stroke="hsl(0 0% 14%)" horizontal={false} />
                      <XAxis type="number" tick={{ fill: 'hsl(0 0% 42%)', fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={(v) => formatRevenue(v)} />
                      <YAxis dataKey="name" type="category" tick={{ fill: 'hsl(0 0% 68%)', fontSize: 10, fontWeight: 600 }} width={100} axisLine={false} tickLine={false} />
                      <Tooltip content={<BarTooltip prefix="₹" />} cursor={{ fill: 'hsl(0 0% 10%)', radius: 6 }} />
                      <Bar dataKey="value" name="Net Payable" radius={[0, 10, 10, 0]} maxBarSize={24} animationDuration={1200}>
                        {revenueByChannel.map((_, i) => <Cell key={i} fill={`url(#cmsRevBarGrad${i % PALETTE.length})`} />)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="rounded-2xl border border-border/20 bg-card/40 backdrop-blur-sm overflow-hidden">
                <div className="p-4 sm:p-6 pb-2">
                  <SectionHeader icon={BarChart3} title="Net Payable by Label" subtitle="Revenue by label" accent="#45aaf2" />
                </div>
                <div className="h-[260px] sm:h-[290px] lg:h-[320px] px-1 sm:px-3 pb-3 sm:pb-5 mt-2">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={revByLabel} layout="vertical" margin={{ top: 0, right: 16, left: 0, bottom: 0 }}>
                      <defs>
                        {PALETTE.map((p, i) => (
                          <linearGradient key={`rlg${i}`} id={`cmsLabelGrad${i}`} x1="0" y1="0" x2="1" y2="0">
                            <stop offset="0%" stopColor={p.from} stopOpacity={0.75} />
                            <stop offset="100%" stopColor={p.to} stopOpacity={1} />
                          </linearGradient>
                        ))}
                      </defs>
                      <CartesianGrid strokeDasharray="3 6" stroke="hsl(0 0% 14%)" horizontal={false} />
                      <XAxis type="number" tick={{ fill: 'hsl(0 0% 42%)', fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={(v) => formatRevenue(v)} />
                      <YAxis dataKey="name" type="category" tick={{ fill: 'hsl(0 0% 68%)', fontSize: 10, fontWeight: 600 }} width={100} axisLine={false} tickLine={false} />
                      <Tooltip content={<BarTooltip prefix="₹" />} cursor={{ fill: 'hsl(0 0% 10%)', radius: 6 }} />
                      <Bar dataKey="value" name="Net Payable" radius={[0, 10, 10, 0]} maxBarSize={24} animationDuration={1200}>
                        {revByLabel.map((_, i) => <Cell key={i} fill={`url(#cmsLabelGrad${(i + 4) % PALETTE.length})`} />)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            {/* Top Artists + Streams by Channel */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-5">
              <div className="rounded-2xl border border-border/20 bg-card/40 backdrop-blur-sm overflow-hidden">
                <div className="p-4 sm:p-6 pb-3"><SectionHeader icon={Users} title="Top Artists · Net Payable" subtitle="Highest earning artists" accent="#a55eea" /></div>
                <div className="px-4 sm:px-6 pb-4 sm:pb-6 space-y-2 sm:space-y-3">
                  {revByArtist.length === 0 && <EmptyState text="No artist data" />}
                  {revByArtist.map((a, i) => (
                    <RankRow key={a.name} rank={i + 1} name={a.name} value={formatRevenue(a.value)} pct={revByArtist[0] ? (a.value / revByArtist[0].value) * 100 : 0} pal={PALETTE[(i + 5) % PALETTE.length]} />
                  ))}
                </div>
              </div>
              <div className="rounded-2xl border border-border/20 bg-card/40 backdrop-blur-sm overflow-hidden">
                <div className="p-4 sm:p-6 pb-3"><SectionHeader icon={Play} title="Streams by Channel" subtitle="Top streaming channels" accent="#00d2d3" /></div>
                <div className="px-4 sm:px-6 pb-4 sm:pb-6 space-y-2 sm:space-y-3">
                  {streamsByChannel.length === 0 && <EmptyState text="No stream data" />}
                  {streamsByChannel.map((c, i) => (
                    <RankRow key={c.name} rank={i + 1} name={c.name} value={formatStreams(c.value)} pct={streamsByChannel[0] ? (c.value / streamsByChannel[0].value) * 100 : 0} pal={PALETTE[(i + 7) % PALETTE.length]} />
                  ))}
                </div>
              </div>
            </div>

            {/* Dynamic Extra Data Charts (e.g. Watchtime) */}
            {extraTrends.length > 0 && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-5">
                {extraTrends.map((trend, idx) => (
                  <div key={trend.key} className="rounded-2xl border border-border/20 bg-card/40 backdrop-blur-sm overflow-hidden">
                    <div className="p-4 sm:p-6 pb-2">
                      <SectionHeader icon={Clock} title={`${trend.label} Trend`} subtitle={`Monthly ${trend.label.toLowerCase()} from reports`} accent={PALETTE[(idx + 8) % PALETTE.length].from} />
                    </div>
                    <div className="h-[240px] sm:h-[280px] px-1 sm:px-3 pb-3 sm:pb-5">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={trend.data} margin={{ top: 20, right: 20, left: 5, bottom: 0 }}>
                          <defs>
                            <linearGradient id={`gradExtra${idx}`} x1="0" y1="0" x2="0" y2="1">
                              <stop offset="0%" stopColor={PALETTE[(idx + 8) % PALETTE.length].from} stopOpacity={0.45} />
                              <stop offset="100%" stopColor={PALETTE[(idx + 8) % PALETTE.length].from} stopOpacity={0} />
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 6" stroke="hsl(0 0% 14%)" vertical={false} />
                          <XAxis dataKey="month" tick={{ fill: 'hsl(0 0% 45%)', fontSize: 10, fontWeight: 600 }} axisLine={false} tickLine={false} dy={10} />
                          <YAxis tick={{ fill: 'hsl(0 0% 40%)', fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={(v) => formatStreams(v)} width={58} />
                          <Tooltip content={<CustomTooltip />} />
                          <Area type="monotone" dataKey="value" name={trend.label} stroke={PALETTE[(idx + 8) % PALETTE.length].from}
                            fill={`url(#gradExtra${idx})`} strokeWidth={2.5} dot={false}
                            activeDot={(props: any) => <GlowDot cx={props.cx} cy={props.cy} color={PALETTE[(idx + 8) % PALETTE.length].from} />} />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                ))}
              </div>
            )}
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
      <div className="relative p-3 sm:p-5">
        <div className="absolute inset-0 opacity-[0.07] group-hover:opacity-[0.14] transition-opacity duration-500"
          style={{ background: `radial-gradient(ellipse at top right, ${from}, transparent 65%)` }} />
        <div className="relative flex flex-col gap-2 sm:gap-3.5">
          <div className="rounded-lg sm:rounded-xl p-2 sm:p-2.5 w-fit shadow-lg" style={{ background: `linear-gradient(135deg, ${from}25, ${to}12)`, boxShadow: `0 4px 12px ${from}15` }}>
            <Icon className="h-3.5 w-3.5 sm:h-4.5 sm:w-4.5" style={{ color: from }} />
          </div>
          <div>
            <p className="text-sm sm:text-xl lg:text-2xl font-black font-display leading-tight tracking-tight whitespace-nowrap">{value}</p>
            <p className="text-[8px] sm:text-[9px] text-muted-foreground mt-0.5 sm:mt-1 font-bold uppercase tracking-[0.15em] sm:tracking-[0.2em]">{label}</p>
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
    <div className="flex items-center gap-2 sm:gap-3.5 group py-1 sm:py-1.5">
      <div className="w-6 h-6 sm:w-8 sm:h-8 rounded-lg sm:rounded-xl flex items-center justify-center text-[9px] sm:text-[11px] font-black shrink-0 border border-border/10 shadow-md"
        style={{ background: `linear-gradient(135deg, ${pal.from}${isTop3 ? '30' : '18'}, ${pal.to}${isTop3 ? '15' : '08'})`, color: pal.from, boxShadow: isTop3 ? `0 4px 12px ${pal.from}20` : 'none' }}>
        {rank}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-1 sm:mb-2">
          <span className="text-[11px] sm:text-[13px] font-semibold text-foreground truncate mr-2 sm:mr-3 group-hover:text-primary transition-colors duration-300">{name}</span>
          <span className="text-[10px] sm:text-xs font-mono font-bold text-muted-foreground whitespace-nowrap">{value}</span>
        </div>
        <div className="h-[4px] sm:h-[6px] rounded-full bg-muted/30 overflow-hidden">
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
