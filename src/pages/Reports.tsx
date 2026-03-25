import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { DashboardLayout } from '@/components/DashboardLayout';
import { GlassCard } from '@/components/GlassCard';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useAuth } from '@/hooks/useAuth';
import { useImpersonate } from '@/hooks/useImpersonate';
import { normalizeIsrc } from '@/lib/isrc';
import { TablePagination, paginateItems } from '@/components/TablePagination';
import { Input } from '@/components/ui/input';
import { ArrowLeft, Eye, BarChart3, Filter, X, Download, Search } from 'lucide-react';
import { format } from 'date-fns';

interface ReportEntry {
  id: string;
  reporting_month: string;
  store: string | null;
  sales_type: string | null;
  country: string | null;
  label: string | null;
  c_line: string | null;
  p_line: string | null;
  track: string | null;
  artist: string | null;
  isrc: string | null;
  upc: string | null;
  currency: string | null;
  streams: number;
  downloads: number;
  net_generated_revenue: number;
  imported_at: string;
}

const COLUMNS = [
  { key: 'store', label: 'Store' },
  { key: 'sales_type', label: 'Sales Type' },
  { key: 'country', label: 'Country' },
  { key: 'label', label: 'Label' },
  { key: 'c_line', label: 'C Line' },
  { key: 'p_line', label: 'P Line' },
  { key: 'track', label: 'Track' },
  { key: 'artist', label: 'Artist' },
  { key: 'isrc', label: 'ISRC' },
  { key: 'upc', label: 'UPC' },
  { key: 'currency', label: 'Currency' },
  { key: 'streams', label: 'Streams' },
  { key: 'downloads', label: 'Downloads' },
  { key: 'net_generated_revenue', label: 'Net Revenue' },
];

const FILTERABLE = [
  { key: 'label', label: 'Label' },
  { key: 'track', label: 'Track' },
  { key: 'artist', label: 'Artist' },
  { key: 'store', label: 'Store' },
  { key: 'country', label: 'Country' },
];

function parseMonthKey(m: string): number {
  const months: Record<string, number> = {
    january: 0, february: 1, march: 2, april: 3, may: 4, june: 5,
    july: 6, august: 7, september: 8, october: 9, november: 10, december: 11,
  };
  const parts = m.toLowerCase().split(' ');
  const monthNum = months[parts[0]] ?? 0;
  const year = parseInt(parts[1]) || 0;
  return year * 12 + monthNum;
}

export default function Reports() {
  const { user, role } = useAuth();
  const [entries, setEntries] = useState<ReportEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState<string | null>(null);
  const [monthPage, setMonthPage] = useState(0);
  const [monthPageSize, setMonthPageSize] = useState<number | 'all'>(10);
  const [monthSearch, setMonthSearch] = useState('');
  const [entryPage, setEntryPage] = useState(0);
  const [entryPageSize, setEntryPageSize] = useState<number | 'all'>(10);
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [hiddenCut, setHiddenCut] = useState(0);

  const { impersonatedUserId, isImpersonating } = useImpersonate();

  useEffect(() => {
    if (!user) return;

    const fetchReports = async () => {
      setLoading(true);

      if (role === 'admin' && isImpersonating && impersonatedUserId) {
        const [{ data: trackRows }, { data: songRows }] = await Promise.all([
          supabase.from('tracks').select('isrc').eq('user_id', impersonatedUserId),
          supabase.from('songs').select('isrc').eq('user_id', impersonatedUserId),
        ]);

        const ownedIsrcs = [...new Set(
          [...(trackRows ?? []), ...(songRows ?? [])]
            .map((row) => normalizeIsrc(row.isrc))
            .filter((value): value is string => Boolean(value))
        )];

        if (ownedIsrcs.length === 0) {
          setEntries([]);
          setLoading(false);
          return;
        }

        const { data } = await supabase
          .from('report_entries')
          .select('*')
          .in('isrc', ownedIsrcs)
          .order('reporting_month', { ascending: false });

        setEntries((data as ReportEntry[]) || []);
        setLoading(false);
        return;
      }

      const { data } = await supabase
        .from('report_entries')
        .select('*')
        .order('reporting_month', { ascending: false });

      setEntries((data as ReportEntry[]) || []);
      setLoading(false);
    };

    fetchReports();
  }, [user, role, isImpersonating, impersonatedUserId]);

  const monthlyGroups = useMemo(() => {
    const groups: Record<string, { entries: ReportEntry[]; latestImport: string; totalRevenue: number }> = {};
    entries.forEach((e) => {
      if (!groups[e.reporting_month]) {
        groups[e.reporting_month] = { entries: [], latestImport: e.imported_at, totalRevenue: 0 };
      }
      groups[e.reporting_month].entries.push(e);
      groups[e.reporting_month].totalRevenue += Number(e.net_generated_revenue) || 0;
      if (e.imported_at > groups[e.reporting_month].latestImport) {
        groups[e.reporting_month].latestImport = e.imported_at;
      }
    });
    return Object.entries(groups).sort(([a], [b]) => parseMonthKey(b) - parseMonthKey(a));
  }, [entries]);

  const filteredMonthlyGroups = useMemo(() => {
    if (!monthSearch.trim()) return monthlyGroups;
    return monthlyGroups.filter(([month]) => month.toLowerCase().includes(monthSearch.toLowerCase()));
  }, [monthlyGroups, monthSearch]);

  const pagedMonths = paginateItems(filteredMonthlyGroups, monthPage, monthPageSize);

  const selectedEntries = useMemo(() => {
    if (!selectedMonth) return [];
    let filtered = entries.filter((e) => e.reporting_month === selectedMonth);
    Object.entries(filters).forEach(([key, value]) => {
      if (value) {
        filtered = filtered.filter((e) => {
          const val = e[key as keyof ReportEntry];
          return val != null && String(val).toLowerCase().includes(value.toLowerCase());
        });
      }
    });
    return filtered;
  }, [entries, selectedMonth, filters]);

  const filterOptions = useMemo(() => {
    if (!selectedMonth) return {};
    const monthEntries = entries.filter((e) => e.reporting_month === selectedMonth);
    const opts: Record<string, string[]> = {};
    FILTERABLE.forEach(({ key }) => {
      const unique = [...new Set(monthEntries.map((e) => e[key as keyof ReportEntry]).filter(Boolean).map(String))].sort();
      opts[key] = unique;
    });
    return opts;
  }, [entries, selectedMonth]);

  const activeFilterCount = Object.values(filters).filter(Boolean).length;
  const clearFilters = () => { setFilters({}); setEntryPage(0); };

  const pagedEntries = paginateItems(selectedEntries, entryPage, entryPageSize);

  const exportCSV = () => {
    const headers = ['Reporting Month', ...COLUMNS.map((c) => c.label)];
    const rows = selectedEntries.map((e) => [
      e.reporting_month,
      ...COLUMNS.map((c) => String(e[c.key as keyof ReportEntry] ?? '')),
    ]);
    const csv = [headers, ...rows].map((r) => r.map((v) => `"${v}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ott-report-${selectedMonth}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center gap-3 flex-wrap">
          {selectedMonth && (
            <Button variant="ghost" size="icon" onClick={() => { setSelectedMonth(null); clearFilters(); }}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
          )}
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl font-bold">Reports & Analytics</h1>
            <p className="text-muted-foreground text-sm">
              {selectedMonth ? `Viewing report for ${selectedMonth}` : 'Monthly revenue reports'} · All amounts in ₹ (INR)
            </p>
          </div>
          {selectedMonth && (
            <Button size="sm" variant="outline" onClick={exportCSV}>
              <Download className="h-4 w-4 mr-1" /> Export CSV
            </Button>
          )}
        </div>

        {loading ? (
          <GlassCard className="p-8 text-center text-muted-foreground">Loading reports...</GlassCard>
        ) : !selectedMonth ? (
          <GlassCard className="p-0 overflow-hidden">
            {monthlyGroups.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground flex flex-col items-center gap-3">
                <BarChart3 className="h-10 w-10 opacity-40" />
                <p>No reports available yet.</p>
              </div>
            ) : (
              <>
                <div className="p-4 border-b border-border/50">
                  <div className="relative max-w-xs">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search months..."
                      value={monthSearch}
                      onChange={(e) => { setMonthSearch(e.target.value); setMonthPage(0); }}
                      className="pl-9 h-9"
                    />
                  </div>
                </div>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Reporting Month</TableHead>
                      <TableHead>Records</TableHead>
                      <TableHead>Net Revenue</TableHead>
                      <TableHead>Last Updated</TableHead>
                      <TableHead className="text-right">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pagedMonths.map(([month, group]) => (
                      <TableRow key={month}>
                        <TableCell className="font-medium">{month}</TableCell>
                        <TableCell>{group.entries.length}</TableCell>
                        <TableCell className="font-medium">{group.totalRevenue.toFixed(4)}</TableCell>
                        <TableCell>{format(new Date(group.latestImport), 'dd MMM yyyy, hh:mm a')}</TableCell>
                        <TableCell className="text-right">
                          <Button size="sm" variant="outline" onClick={() => setSelectedMonth(month)}>
                            <Eye className="h-4 w-4 mr-1" /> View
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                <TablePagination
                  totalItems={filteredMonthlyGroups.length}
                  currentPage={monthPage}
                  pageSize={monthPageSize}
                  onPageChange={setMonthPage}
                  onPageSizeChange={setMonthPageSize}
                  itemLabel="months"
                />
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
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
                {FILTERABLE.map(({ key, label }) => (
                  <Select
                    key={key}
                    value={filters[key] || '_all'}
                    onValueChange={(v) => { setFilters((f) => ({ ...f, [key]: v === '_all' ? '' : v })); setEntryPage(0); }}
                  >
                    <SelectTrigger className="h-9 text-xs">
                      <SelectValue placeholder={label} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="_all">All {label}s</SelectItem>
                      {(filterOptions[key] || []).map((opt) => (
                        <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ))}
              </div>
            </GlassCard>

            <GlassCard className="p-0 overflow-hidden">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      {COLUMNS.map((col) => (
                        <TableHead key={col.key} className="whitespace-nowrap">{col.label}</TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pagedEntries.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={COLUMNS.length} className="text-center text-muted-foreground py-8">
                          No records match the current filters.
                        </TableCell>
                      </TableRow>
                    ) : (
                      pagedEntries.map((entry) => (
                        <TableRow key={entry.id}>
                          {COLUMNS.map((col) => (
                            <TableCell key={col.key} className="whitespace-nowrap">
                              {col.key === 'net_generated_revenue'
                                ? Number(entry[col.key]).toFixed(4)
                                : String(entry[col.key as keyof ReportEntry] ?? '-')}
                            </TableCell>
                          ))}
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
              <TablePagination
                totalItems={selectedEntries.length}
                currentPage={entryPage}
                pageSize={entryPageSize}
                onPageChange={setEntryPage}
                onPageSizeChange={setEntryPageSize}
              />
            </GlassCard>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
