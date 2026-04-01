import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { DashboardLayout } from '@/components/DashboardLayout';
import { GlassCard } from '@/components/GlassCard';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/hooks/useAuth';
import { useImpersonate } from '@/hooks/useImpersonate';
import { TablePagination, paginateItems } from '@/components/TablePagination';
import { ArrowLeft, Eye, BarChart3, Filter, X, Download, Search } from 'lucide-react';
import { format } from 'date-fns';

interface FormatColumn {
  id: string;
  column_key: string;
  csv_header: string;
  is_enabled: boolean;
  is_required: boolean;
  sort_order: number;
  is_custom: boolean;
}

interface ReportEntry {
  id: string;
  channel_name: string;
  reporting_month: string;
  label: string | null;
  track: string | null;
  artist: string | null;
  currency: string | null;
  streams: number;
  downloads: number;
  net_generated_revenue: number;
  imported_at: string;
  extra_data?: Record<string, string>;
  cut_percent_snapshot?: number | null;
}

interface CmsLink {
  channel_name: string;
  cut_percent: number;
}

const ALL_COLUMN_LABELS: Record<string, string> = {
  channel_name: 'Channel Name', label: 'Label', track: 'Track', artist: 'Artist',
  currency: 'Currency', streams: 'Streams', downloads: 'Downloads',
  net_generated_revenue: 'Net Revenue', cms_cut: 'CMS Cut %', cut_amount: '% Cut Amount', net_payable: 'Net Payable',
};

const FILTERABLE = [
  { key: 'channel_name', label: 'Channel' },
  { key: 'label', label: 'Label' },
  { key: 'artist', label: 'Artist' },
];

function parseMonthKey(m: string): number {
  const months: Record<string, number> = {
    january: 0, february: 1, march: 2, april: 3, may: 4, june: 5,
    july: 6, august: 7, september: 8, october: 9, november: 10, december: 11,
  };
  const parts = m.toLowerCase().split(' ');
  return (parseInt(parts[1]) || 0) * 12 + (months[parts[0]] ?? 0);
}

export default function CmsReports() {
  const { user } = useAuth();
  const { impersonatedUserId, isImpersonating } = useImpersonate();
  const activeUserId = (isImpersonating && impersonatedUserId) ? impersonatedUserId : user?.id;

  const [entries, setEntries] = useState<ReportEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState<string | null>(null);
  const [formatColumns, setFormatColumns] = useState<FormatColumn[]>([]);
  const [cmsLinks, setCmsLinks] = useState<CmsLink[]>([]);

  const [monthPage, setMonthPage] = useState(0);
  const [monthPageSize, setMonthPageSize] = useState<number | 'all'>(10);
  const [monthSearch, setMonthSearch] = useState('');
  const [entryPage, setEntryPage] = useState(0);
  const [entryPageSize, setEntryPageSize] = useState<number | 'all'>(10);
  const [filters, setFilters] = useState<Record<string, string>>({});

  const COLUMNS = useMemo(() => {
    const baseCols = formatColumns
      .filter(c => c.is_enabled && c.column_key !== 'reporting_month')
      .sort((a, b) => a.sort_order - b.sort_order)
      .map(c => ({ key: c.column_key, label: ALL_COLUMN_LABELS[c.column_key] || c.csv_header }));
    // Add calculated columns after net_generated_revenue
    const revenueIdx = baseCols.findIndex(c => c.key === 'net_generated_revenue');
    const extra = [
      { key: 'cms_cut', label: 'CMS Cut %' },
      { key: 'cut_amount', label: '% Cut Amount' },
      { key: 'net_payable', label: 'Net Payable' },
    ];
    if (revenueIdx >= 0) baseCols.splice(revenueIdx + 1, 0, ...extra);
    else baseCols.push(...extra);
    return baseCols;
  }, [formatColumns]);

  useEffect(() => {
    if (!user) return;
    const fetchAll = async () => {
      setLoading(true);
      const [{ data: fmt }, { data: links }, { data: reportData }] = await Promise.all([
        supabase.from('cms_report_format' as any).select('*').order('sort_order', { ascending: true }),
        supabase.from('youtube_cms_links' as any).select('channel_name, cut_percent').eq('user_id', activeUserId).eq('status', 'linked'),
        supabase.from('cms_report_entries' as any).select('*').order('reporting_month', { ascending: false }),
      ]);
      if (fmt) setFormatColumns(fmt as any);
      if (links) setCmsLinks(links as any);
      setEntries((reportData as any) || []);
      setLoading(false);
    };
    fetchAll();
  }, [user, activeUserId]);

  // Get cut percent: use frozen snapshot if available, otherwise fallback to live
  const getEffectiveCut = (entry: ReportEntry) => {
    if (entry.cut_percent_snapshot != null) return Number(entry.cut_percent_snapshot) || 0;
    const link = cmsLinks.find(l => l.channel_name === entry.channel_name);
    return Number(link?.cut_percent) || 0;
  };

  const calcNetPayable = (entry: ReportEntry) => {
    const revenue = Number(entry.net_generated_revenue) || 0;
    const cut = getEffectiveCut(entry);
    return Number((revenue - (revenue * cut / 100)).toFixed(4));
  };

  const calcCutAmount = (entry: ReportEntry) => {
    const revenue = Number(entry.net_generated_revenue) || 0;
    const cut = getEffectiveCut(entry);
    return Number((revenue * cut / 100).toFixed(4));
  };

  const monthlyGroups = useMemo(() => {
    const groups: Record<string, { entries: ReportEntry[]; latestImport: string; totalNetPayable: number }> = {};
    entries.forEach(e => {
      if (!groups[e.reporting_month]) groups[e.reporting_month] = { entries: [], latestImport: e.imported_at, totalNetPayable: 0 };
      groups[e.reporting_month].entries.push(e);
      groups[e.reporting_month].totalNetPayable += calcNetPayable(e);
      if (e.imported_at > groups[e.reporting_month].latestImport) groups[e.reporting_month].latestImport = e.imported_at;
    });
    return Object.entries(groups).sort(([a], [b]) => parseMonthKey(b) - parseMonthKey(a));
  }, [entries, cmsLinks]);

  const filteredMonthlyGroups = useMemo(() => {
    if (!monthSearch.trim()) return monthlyGroups;
    return monthlyGroups.filter(([month]) => month.toLowerCase().includes(monthSearch.toLowerCase()));
  }, [monthlyGroups, monthSearch]);

  const pagedMonths = paginateItems(filteredMonthlyGroups, monthPage, monthPageSize);

  const selectedEntries = useMemo(() => {
    if (!selectedMonth) return [];
    let filtered = entries.filter(e => e.reporting_month === selectedMonth);
    Object.entries(filters).forEach(([key, value]) => {
      if (value) filtered = filtered.filter(e => {
        const val = e[key as keyof ReportEntry];
        return val != null && String(val).toLowerCase().includes(value.toLowerCase());
      });
    });
    return filtered;
  }, [entries, selectedMonth, filters]);

  const filterOptions = useMemo(() => {
    if (!selectedMonth) return {};
    const monthEntries = entries.filter(e => e.reporting_month === selectedMonth);
    const opts: Record<string, string[]> = {};
    FILTERABLE.forEach(({ key }) => {
      opts[key] = [...new Set(monthEntries.map(e => e[key as keyof ReportEntry]).filter(Boolean).map(String))].sort();
    });
    return opts;
  }, [entries, selectedMonth]);

  const activeFilterCount = Object.values(filters).filter(Boolean).length;
  const clearFilters = () => { setFilters({}); setEntryPage(0); };
  const pagedEntries = paginateItems(selectedEntries, entryPage, entryPageSize);

  const filteredNetPayableTotal = useMemo(() =>
    selectedEntries.reduce((sum, e) => sum + calcNetPayable(e), 0),
    [selectedEntries, cmsLinks],
  );

  const exportCSV = () => {
    const headers = ['Reporting Month', ...COLUMNS.map(c => c.label)];
    const rows = selectedEntries.map(e => [
      e.reporting_month,
      ...COLUMNS.map(c => {
        if (c.key === 'cms_cut') return `${getEffectiveCut(e)}%`;
        if (c.key === 'cut_amount') return String(calcCutAmount(e));
        if (c.key === 'net_payable') return String(calcNetPayable(e));
        if (c.key.startsWith('custom_')) return String((e.extra_data as Record<string, string>)?.[c.key] ?? '');
        return String(e[c.key as keyof ReportEntry] ?? '');
      }),
    ]);
    const csv = [headers, ...rows].map(r => r.map(v => `"${v}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `cms-report-${selectedMonth}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  const getCellValue = (entry: ReportEntry, colKey: string) => {
    if (colKey === 'net_generated_revenue') return `₹${(Number(entry.net_generated_revenue) || 0).toFixed(4)}`;
    if (colKey === 'cms_cut') return `${getEffectiveCut(entry)}%`;
    if (colKey === 'cut_amount') return `₹${calcCutAmount(entry).toFixed(4)}`;
    if (colKey === 'net_payable') return `₹${calcNetPayable(entry).toFixed(4)}`;
    if (colKey.startsWith('custom_')) return String((entry.extra_data as Record<string, string>)?.[colKey] ?? '-');
    return String(entry[colKey as keyof ReportEntry] ?? '-');
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          {selectedMonth && (
            <Button variant="ghost" size="icon" className="shrink-0" onClick={() => { setSelectedMonth(null); clearFilters(); }}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
          )}
          <div className="min-w-0">
            <h1 className="text-xl sm:text-2xl font-bold">YouTube CMS Reports</h1>
            <p className="text-muted-foreground text-xs sm:text-sm">
              {selectedMonth ? `Viewing report for ${selectedMonth}` : 'Monthly CMS revenue reports'} · All amounts in ₹ (INR)
            </p>
          </div>
        </div>

        {!selectedMonth && monthlyGroups.length > 0 && (
          <div className="text-left">
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">Total Net Payable</p>
            <p className="text-xl font-bold text-primary">₹{monthlyGroups.reduce((sum, [, g]) => sum + g.totalNetPayable, 0).toFixed(2)}</p>
          </div>
        )}

        {loading ? (
          <GlassCard className="p-8 text-center text-muted-foreground">Loading CMS reports...</GlassCard>
        ) : !selectedMonth ? (
          <GlassCard className="p-0 overflow-hidden">
            {monthlyGroups.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground flex flex-col items-center gap-3">
                <BarChart3 className="h-10 w-10 opacity-40" />
                <p>No CMS reports available yet.</p>
              </div>
            ) : (
              <>
                <div className="p-4 border-b border-border/50">
                  <div className="relative max-w-xs">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input placeholder="Search months..." value={monthSearch} onChange={e => { setMonthSearch(e.target.value); setMonthPage(0); }} className="pl-9 h-9" />
                  </div>
                </div>
                <div className="responsive-table-wrap">
                <Table className="min-w-max">
                  <TableHeader>
                    <TableRow>
                       <TableHead>Reporting Month</TableHead>
                      <TableHead>Records</TableHead>
                      <TableHead>Net Payable</TableHead>
                      <TableHead className="hidden sm:table-cell">Last Updated</TableHead>
                      <TableHead className="text-right">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pagedMonths.map(([month, group]) => (
                      <TableRow key={month}>
                        <TableCell className="font-medium">{month}</TableCell>
                        <TableCell>{group.entries.length}</TableCell>
                        <TableCell className="font-medium">₹{group.totalNetPayable.toFixed(2)}</TableCell>
                        <TableCell className="hidden sm:table-cell">{format(new Date(group.latestImport), 'dd MMM yyyy, hh:mm a')}</TableCell>
                        <TableCell className="text-right">
                          <Button size="sm" variant="outline" onClick={() => setSelectedMonth(month)}>
                            <Eye className="h-4 w-4 mr-1" /> View
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                </div>
                <TablePagination totalItems={filteredMonthlyGroups.length} currentPage={monthPage} pageSize={monthPageSize} onPageChange={setMonthPage} onPageSizeChange={setMonthPageSize} itemLabel="months" />
              </>
            )}
          </GlassCard>
        ) : (
          <>
            <GlassCard className="p-4">
              <div className="flex items-center gap-2 mb-3">
                <Filter className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">Filters</span>
                {activeFilterCount > 0 && (
                  <Button variant="ghost" size="sm" className="h-6 px-2 text-xs" onClick={clearFilters}>
                    <X className="h-3 w-3 mr-1" /> Clear all
                  </Button>
                )}
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {FILTERABLE.map(({ key, label }) => (
                  <Select key={key} value={filters[key] || '_all'} onValueChange={v => { setFilters(f => ({ ...f, [key]: v === '_all' ? '' : v })); setEntryPage(0); }}>
                    <SelectTrigger className="h-9 text-xs"><SelectValue placeholder={label} /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="_all">All {label}s</SelectItem>
                      {(filterOptions[key] || []).map(opt => <SelectItem key={opt} value={opt}>{opt}</SelectItem>)}
                    </SelectContent>
                  </Select>
                ))}
              </div>
            </GlassCard>

            <GlassCard className="p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Net Payable (Filtered)</p>
                  <p className="text-xl sm:text-2xl font-bold text-primary">₹{filteredNetPayableTotal.toFixed(2)}</p>
                </div>
                <Button size="sm" variant="outline" onClick={exportCSV} className="w-full sm:w-auto">
                  <Download className="h-4 w-4 mr-1" /> Export CSV
                </Button>
              </div>
            </GlassCard>

            <GlassCard className="p-0 overflow-hidden rounded-lg">
              <div className="responsive-table-wrap">
                <Table className="min-w-max">
                  <TableHeader>
                    <TableRow>
                      {COLUMNS.map(col => <TableHead key={col.key} className="whitespace-nowrap">{col.label}</TableHead>)}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pagedEntries.length === 0 ? (
                      <TableRow><TableCell colSpan={COLUMNS.length} className="text-center text-muted-foreground py-8">No records match filters.</TableCell></TableRow>
                    ) : pagedEntries.map(entry => (
                      <TableRow key={entry.id}>
                        {COLUMNS.map(col => (
                          <TableCell key={col.key} className={`whitespace-nowrap ${col.key === 'net_payable' ? 'font-semibold text-primary' : col.key === 'cut_amount' ? 'text-destructive' : ''}`}>
                            {getCellValue(entry, col.key)}
                          </TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <TablePagination totalItems={selectedEntries.length} currentPage={entryPage} pageSize={entryPageSize} onPageChange={setEntryPage} onPageSizeChange={setEntryPageSize} />
            </GlassCard>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
