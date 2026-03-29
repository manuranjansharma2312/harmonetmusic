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
import { applySnapshotCut, getEffectiveRevenueCutPercent, shouldApplyRevenueCut } from '@/lib/revenueCalculations';
import { TablePagination, paginateItems } from '@/components/TablePagination';
import { Input } from '@/components/ui/input';
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
  cut_percent_snapshot?: number | null;
  extra_data?: Record<string, string>;
}

const ALL_COLUMN_LABELS: Record<string, string> = {
  store: 'Store', sales_type: 'Sales Type', country: 'Country', label: 'Label',
  c_line: 'C Line', p_line: 'P Line', track: 'Track', artist: 'Artist',
  isrc: 'ISRC', upc: 'UPC', currency: 'Currency', streams: 'Streams',
  downloads: 'Downloads', net_generated_revenue: 'Net Revenue',
};

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
  const [subLabelCut, setSubLabelCut] = useState(0);
  const [isSubLabelUser, setIsSubLabelUser] = useState(false);
  const [formatColumns, setFormatColumns] = useState<FormatColumn[]>([]);

  const { impersonatedUserId, isImpersonating } = useImpersonate();
  const activeUserId = (isImpersonating && impersonatedUserId) ? impersonatedUserId : user?.id;

  const COLUMNS = useMemo(() =>
    formatColumns
      .filter(c => c.is_enabled && c.column_key !== 'reporting_month')
      .sort((a, b) => a.sort_order - b.sort_order)
      .map(c => ({ key: c.column_key, label: ALL_COLUMN_LABELS[c.column_key] || c.csv_header })),
    [formatColumns]
  );

  const fetchFormat = async () => {
    const { data } = await supabase.from('ott_report_format').select('*').order('sort_order', { ascending: true });
    if (data) setFormatColumns(data as FormatColumn[]);
  };

  const fetchReports = async () => {
    if (!user) return;
    setLoading(true);

    // Check if user is a sub-label and get parent's cut
    const { data: subLabelData } = await supabase
      .from('sub_labels')
      .select('percentage_cut, parent_user_id')
      .eq('sub_user_id', activeUserId)
      .maybeSingle();
    setSubLabelCut(Number(subLabelData?.percentage_cut) || 0);
    setIsSubLabelUser(Boolean(subLabelData));

    // Fetch hidden cut - for sub-labels use parent's hidden cut
    if (subLabelData?.parent_user_id) {
      const { data: parentProfile } = await supabase.from('profiles').select('hidden_cut_percent').eq('user_id', subLabelData.parent_user_id).maybeSingle();
      setHiddenCut(Number(parentProfile?.hidden_cut_percent) || 0);
    } else if (role !== 'admin') {
      const { data: profileData } = await supabase.from('profiles').select('hidden_cut_percent').eq('user_id', user.id).maybeSingle();
      setHiddenCut(Number(profileData?.hidden_cut_percent) || 0);
    } else if (isImpersonating && impersonatedUserId) {
      const { data: profileData } = await supabase.from('profiles').select('hidden_cut_percent').eq('user_id', impersonatedUserId).maybeSingle();
      setHiddenCut(Number(profileData?.hidden_cut_percent) || 0);
    }

    if (role === 'admin' && isImpersonating && impersonatedUserId) {
      // Get sub-label user IDs for this parent user
      const { data: subLabels } = await supabase
        .from('sub_labels')
        .select('sub_user_id')
        .eq('parent_user_id', impersonatedUserId)
        .eq('status', 'active');

      const subUserIds = (subLabels || [])
        .map(sl => sl.sub_user_id)
        .filter(Boolean) as string[];

      const allUserIds = [impersonatedUserId, ...subUserIds];

      const [{ data: trackRows }, { data: songRows }] = await Promise.all([
        supabase.from('tracks').select('isrc').in('user_id', allUserIds),
        supabase.from('songs').select('isrc').in('user_id', allUserIds),
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

  useEffect(() => {
    if (!user) return;
    fetchReports();
    fetchFormat();

    const channel = supabase
      .channel('ott-reports-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'report_entries' }, () => fetchReports())
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user, role, isImpersonating, impersonatedUserId]);

  // For sub-labels: use parent's percentage_cut only (not admin hidden cut)
  // For regular users: use admin hidden cut
  const effectiveCut = getEffectiveRevenueCutPercent({ hiddenCut, subLabelCut, isSubLabel: isSubLabelUser });
  const shouldApplyCut = shouldApplyRevenueCut({ role, currentUserId: user?.id, activeUserId });
  const applyRevenueCut = (entry: ReportEntry) => applySnapshotCut(Number(entry.net_generated_revenue) || 0, entry.cut_percent_snapshot, effectiveCut, shouldApplyCut);

  const monthlyGroups = useMemo(() => {
    const groups: Record<string, { entries: ReportEntry[]; latestImport: string; totalRevenue: number }> = {};
    entries.forEach((e) => {
      if (!groups[e.reporting_month]) {
        groups[e.reporting_month] = { entries: [], latestImport: e.imported_at, totalRevenue: 0 };
      }
      groups[e.reporting_month].entries.push(e);
      groups[e.reporting_month].totalRevenue += applyRevenueCut(e);
      if (e.imported_at > groups[e.reporting_month].latestImport) {
        groups[e.reporting_month].latestImport = e.imported_at;
      }
    });
    return Object.entries(groups).sort(([a], [b]) => parseMonthKey(b) - parseMonthKey(a));
  }, [entries, effectiveCut, shouldApplyCut]);

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
      ...COLUMNS.map((c) => c.key === 'net_generated_revenue'
        ? String(applyRevenueCut(e))
        : c.key.startsWith('custom_')
          ? String((e.extra_data as Record<string, string>)?.[c.key] ?? '')
          : String(e[c.key as keyof ReportEntry] ?? '')),
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

            <GlassCard className="p-0 overflow-hidden rounded-lg">
              <div className="responsive-table-wrap">
                <Table className="min-w-max">
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
                                ? applyRevenueCut(entry).toFixed(4)
                                : col.key.startsWith('custom_')
                                  ? String((entry.extra_data as Record<string, string>)?.[col.key] ?? '-')
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
