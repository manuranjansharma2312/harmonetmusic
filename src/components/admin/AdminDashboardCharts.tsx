import { memo } from 'react';
import { GlassCard } from '@/components/GlassCard';
import { WorldMapChart } from '@/components/WorldMapChart';
import { formatRevenue, formatStreams } from '@/lib/formatNumbers';
import {
  Disc3, Users, Music, BarChart3, Activity, TrendingUp, Globe, Headphones, Play, Link2
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, AreaChart, Area, Legend, ComposedChart, Line
} from 'recharts';

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

interface Props {
  monthlyRevenue: { month: string; revenue: number; streams: number; downloads: number }[];
  growthData: { month: string; artists: number; releases: number; vevo: number; cms: number }[];
  monthlyUsers: { month: string; count: number }[];
  monthlyReleases: { month: string; count: number }[];
  monthlyVevo: { month: string; count: number }[];
  monthlyCmsLinked: { month: string; count: number }[];
  releaseStatusData: { name: string; value: number; color: string }[];
  topStores: { name: string; value: number; revenue: number; color: string }[];
  topStoreNames: string[];
  topTracks: { name: string; streams: number }[];
  topArtists: { name: string; streams: number }[];
  countryData: { name: string; streams: number }[];
  totalStoreStreams: number;
  storeColors: Record<string, string>;
  chartColors: string[];
}

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
            <Area type="monotone" dataKey="count" stroke={color} fill={`url(#spark-${title.replace(/\s/g, '')})`} strokeWidth={2} dot={false} isAnimationActive={false} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
      <div className="flex justify-between text-[9px] text-muted-foreground/60 mt-1">
        {data.map(d => <span key={d.month}>{d.month}</span>)}
      </div>
    </GlassCard>
  );
}

function AdminDashboardCharts({
  monthlyRevenue, growthData, monthlyUsers, monthlyReleases, monthlyVevo, monthlyCmsLinked,
  releaseStatusData, topStores, topStoreNames, topTracks, topArtists, countryData,
  totalStoreStreams, storeColors, chartColors,
}: Props) {
  const releaseTotal = releaseStatusData.reduce((s, d) => s + d.value, 0);

  return (
    <>
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
                <Area yAxisId="left" type="monotone" dataKey="revenue" stroke="hsl(0, 67%, 45%)" fill="url(#admRevGrad)" strokeWidth={2.5} name="Revenue (₹)" isAnimationActive={false} dot={{ r: 4, fill: 'hsl(0 0% 6%)', stroke: 'hsl(0, 67%, 45%)', strokeWidth: 2 }} activeDot={{ r: 6, strokeWidth: 2, stroke: 'hsl(0, 67%, 55%)', fill: 'hsl(0, 67%, 45%)' }} />
                <Area yAxisId="right" type="monotone" dataKey="streams" stroke="hsl(200, 70%, 55%)" fill="url(#admStrGrad)" strokeWidth={2} name="Streams" isAnimationActive={false} dot={{ r: 3, fill: 'hsl(0 0% 6%)', stroke: 'hsl(200, 70%, 55%)', strokeWidth: 2 }} />
                <Line yAxisId="right" type="monotone" dataKey="downloads" stroke="hsl(280, 60%, 55%)" strokeWidth={1.5} strokeDasharray="6 4" name="Downloads" dot={false} isAnimationActive={false} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        ) : <EmptyChart icon={Activity} text="No revenue data yet" />}
      </GlassCard>

      {/* Platform Growth Overview */}
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
                <Bar dataKey="artists" name="New Artists" fill="hsl(200, 70%, 50%)" radius={[4, 4, 0, 0]} maxBarSize={28} isAnimationActive={false} />
                <Bar dataKey="releases" name="New Releases" fill="hsl(45, 80%, 45%)" radius={[4, 4, 0, 0]} maxBarSize={28} isAnimationActive={false} />
                <Bar dataKey="vevo" name="Vevo Submissions" fill="hsl(330, 60%, 50%)" radius={[4, 4, 0, 0]} maxBarSize={28} isAnimationActive={false} />
                <Bar dataKey="cms" name="CMS Linked" fill="hsl(0, 67%, 40%)" radius={[4, 4, 0, 0]} maxBarSize={28} isAnimationActive={false} />
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

      {/* 3-Column: Release Status + Platform Distribution + Country Map */}
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
                    <p className="text-3xl font-bold text-foreground">{releaseTotal}</p>
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

        {/* Country Map */}
        <GlassCard className="animate-fade-in">
          <SectionHeader icon={Globe} iconBg="bg-emerald-500/15" iconColor="text-emerald-400" title="Streams by Country" />
          {countryData.length > 0 ? <WorldMapChart data={countryData} /> : <EmptyChart icon={Globe} text="No country data" />}
        </GlassCard>
      </div>

      {/* Top Tracks + Top Artists */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6 sm:mb-8">
        <GlassCard className="animate-fade-in">
          <SectionHeader icon={Music} iconBg="bg-rose-500/15" iconColor="text-rose-400" title="Top Tracks" />
          {topTracks.length > 0 ? (
            <div className="space-y-2">
              {topTracks.map((track, i) => (
                <RankItem key={track.name} rank={i + 1} name={track.name} sub={`${formatStreams(track.streams)} streams`} color={chartColors[i % chartColors.length]} />
              ))}
            </div>
          ) : <EmptyChart icon={Music} text="No track data" />}
        </GlassCard>

        <GlassCard className="animate-fade-in">
          <SectionHeader icon={Headphones} iconBg="bg-amber-500/15" iconColor="text-amber-400" title="Top Artists" />
          {topArtists.length > 0 ? (
            <div className="space-y-2">
              {topArtists.map((artist, i) => (
                <RankItem key={artist.name} rank={i + 1} name={artist.name} sub={`${formatStreams(artist.streams)} streams`} color={chartColors[i % chartColors.length]} rounded />
              ))}
            </div>
          ) : <EmptyChart icon={Headphones} text="No artist data" />}
        </GlassCard>
      </div>
    </>
  );
}

export default memo(AdminDashboardCharts);
