import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { DashboardLayout } from '@/components/DashboardLayout';
import { GlassCard } from '@/components/GlassCard';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { TablePagination, paginateItems } from '@/components/TablePagination';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/hooks/useAuth';
import { useImpersonate } from '@/hooks/useImpersonate';
import { normalizeIsrc } from '@/lib/isrc';
import { applySnapshotCut, getEffectiveRevenueCutPercent, shouldApplyRevenueCut } from '@/lib/revenueCalculations';
import { ArrowLeft, Eye, BarChart3, Filter, X, Download, Search } from 'lucide-react';
import { format } from 'date-fns';
import { formatRevenue } from '@/lib/formatNumbers';

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

interface ReportSummaryRow {
  reporting_month: string;
  imported_at: string;
  net_generated_revenue: number;
  cut_percent_snapshot?: number | null;
}

interface ReportMonthGroup {
  count: number;
  latestImport: string;
  totalRevenue: number;
}

interface ReportBrowserPageProps {
  title: string;
  emptyMessage: string;
  introText: string;
  exportPrefix: string;
  baseTable: 'report_entries' | 'youtube_report_entries' | 'vevo_report_entries';
  formatTable: 'ott_report_format' | 'youtube_report_format' | 'vevo_report_format';
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

const SUMMARY_SELECT = 'reporting_month, imported_at, net_generated_revenue, cut_percent_snapshot';
const DETAIL_SELECT = 'id, reporting_month, store, sales_type, country, label, c_line, p_line, track, artist, isrc, upc, currency, streams, downloads, net_generated_revenue, imported_at, cut_percent_snapshot, extra_data';

function parseMonthKey(value: string): number {
  if (/^\d{4}-\d{2}$/.test(value)) {
    const [year, month] = value.split('-').map(Number);
    return year * 12 + month;
  }

  const months: Record<string, number> = {
    january: 1, february: 2, march: 3, april: 4, may: 5, june: 6,
    july: 7, august: 8, september: 9, october: 10, november: 11, december: 12,
  };

  const parts = value.toLowerCase().trim().split(' ');
  return (parseInt(parts[1]) || 0) * 12 + (months[parts[0]] ?? 0);
}

export function ReportBrowserPage({
  title,
  emptyMessage,
  introText,
  exportPrefix,
  baseTable,
  formatTable,
}: ReportBrowserPageProps) {
  const { user, role } = useAuth();
  const { impersonatedUserId, isImpersonating } = useImpersonate();
  const activeUserId = (isImpersonating && impersonatedUserId) ? impersonatedUserId : user?.id;

  const [summaryRows, setSummaryRows] = useState<ReportSummaryRow[]>([]);
  const [selectedEntries, setSelectedEntries] = useState<ReportEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
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

  const COLUMNS = useMemo(
    () => formatColumns
      .filter((column) => column.is_enabled && column.column_key !== 'reporting_month')
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((column) => ({ key: column.column_key, label: ALL_COLUMN_LABELS[column.column_key] || column.csv_header })),
    [formatColumns],
  );

  const fetchFormat = useCallback(async () => {
    const { data } = await supabase.from(formatTable as any).select('*').order('sort_order', { ascending: true });
    if (data) setFormatColumns(data as unknown as FormatColumn[]);
  }, [formatTable]);

  const fetchOwnedIsrcs = useCallback(async (parentUserId: string) => {
    const { data: subLabels } = await supabase
      .from('sub_labels')
      .select('sub_user_id')
      .eq('parent_user_id', parentUserId)
      .eq('status', 'active');

    const subUserIds = (subLabels || []).map((item) => item.sub_user_id).filter(Boolean) as string[];
    const allUserIds = [parentUserId, ...subUserIds];

    const [{ data: trackRows }, { data: songRows }] = await Promise.all([
      supabase.from('tracks').select('isrc').in('user_id', allUserIds),
      supabase.from('songs').select('isrc').in('user_id', allUserIds),
    ]);

    return [...new Set(
      [...(trackRows ?? []), ...(songRows ?? [])]
        .map((row) => normalizeIsrc(row.isrc))
        .filter((value): value is string => Boolean(value)),
    )];
  }, []);

  const fetchRows = useCallback(async (selectColumns: string, month?: string) => {
    if (!user || !activeUserId) return [];

    if (role === 'admin' && isImpersonating && impersonatedUserId) {
      const ownedIsrcs = await fetchOwnedIsrcs(impersonatedUserId);
      if (ownedIsrcs.length === 0) return [];

      let query = (supabase.from(baseTable as any).select(selectColumns) as any).in('isrc', ownedIsrcs);
      if (month) query = query.eq('reporting_month', month);
      const { data } = await query.order('reporting_month', { ascending: false });
      return data || [];
    }

    let query = (supabase.from(baseTable as any).select(selectColumns) as any).eq('user_id', activeUserId);
    if (month) query = query.eq('reporting_month', month);
    const { data } = await query.order('reporting_month', { ascending: false });
    return data || [];
  }, [activeUserId, baseTable, fetchOwnedIsrcs, impersonatedUserId, isImpersonating, role, user]);

  const fetchReports = useCallback(async () => {
    if (!user || !activeUserId) return;
    setLoading(true);

    const { data: subLabelData } = await supabase
      .from('sub_labels')
      .select('percentage_cut, parent_user_id')
      .eq('sub_user_id', activeUserId)
      .maybeSingle();

    setSubLabelCut(Number(subLabelData?.percentage_cut) || 0);
    setIsSubLabelUser(Boolean(subLabelData));

    if (subLabelData?.parent_user_id) {
      const { data: parentProfile } = await supabase
        .from('profiles')
        .select('hidden_cut_percent')
        .eq('user_id', subLabelData.parent_user_id)
        .maybeSingle();
      setHiddenCut(Number(parentProfile?.hidden_cut_percent) || 0);
    } else {
      const { data: profileData } = await supabase
        .from('profiles')
        .select('hidden_cut_percent')
        .eq('user_id', activeUserId)
        .maybeSingle();
      setHiddenCut(Number(profileData?.hidden_cut_percent) || 0);
    }

    const rows = await fetchRows(SUMMARY_SELECT);
    setSummaryRows((rows as ReportSummaryRow[]) || []);
    setLoading(false);
  }, [activeUserId, fetchRows, user]);

  const loadMonthEntries = useCallback(async (month: string) => {
    setSelectedMonth(month);
    setFilters({});
    setEntryPage(0);
    setDetailLoading(true);

    const rows = await fetchRows(DETAIL_SELECT, month);
    setSelectedEntries((rows as ReportEntry[]) || []);
    setDetailLoading(false);
  }, [fetchRows]);

  useEffect(() => {
    if (!user || !activeUserId) return;
    void fetchReports();
    void fetchFormat();

    const changeHandler = () => {
      void fetchReports();
      if (selectedMonth) void loadMonthEntries(selectedMonth);
    };

    const channel = supabase
      .channel(`${baseTable}-realtime-${activeUserId}`)
      .on(
        'postgres_changes',
        role === 'admin' && isImpersonating && impersonatedUserId
          ? { event: '*', schema: 'public', table: baseTable }
          : { event: '*', schema: 'public', table: baseTable, filter: `user_id=eq.${activeUserId}` },
        changeHandler,
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [activeUserId, baseTable, fetchFormat, fetchReports, impersonatedUserId, isImpersonating, loadMonthEntries, role, selectedMonth, user]);

  const effectiveCut = getEffectiveRevenueCutPercent({ hiddenCut, subLabelCut, isSubLabel: isSubLabelUser });
  const shouldApplyCut = shouldApplyRevenueCut({ role, currentUserId: user?.id, activeUserId });
  const applyRevenueCut = useCallback(
    (entry: Pick<ReportEntry, 'net_generated_revenue' | 'cut_percent_snapshot'>) => applySnapshotCut(Number(entry.net_generated_revenue) || 0, entry.cut_percent_snapshot, effectiveCut, shouldApplyCut),
    [effectiveCut, shouldApplyCut],
  );

  const monthlyGroups = useMemo(() => {
    const groups: Record<string, ReportMonthGroup> = {};

    summaryRows.forEach((entry) => {
      if (!groups[entry.reporting_month]) {
        groups[entry.reporting_month] = {
          count: 0,
          latestImport: entry.imported_at,
          totalRevenue: 0,
        };
      }

      groups[entry.reporting_month].count += 1;
      groups[entry.reporting_month].totalRevenue += applyRevenueCut(entry as ReportEntry);
      if (entry.imported_at > groups[entry.reporting_month].latestImport) {
        groups[entry.reporting_month].latestImport = entry.imported_at;
      }
    });

    return Object.entries(groups).sort(([a], [b]) => parseMonthKey(b) - parseMonthKey(a));
  }, [applyRevenueCut, summaryRows]);

  const filteredMonthlyGroups = useMemo(() => {
    if (!monthSearch.trim()) return monthlyGroups;
    return monthlyGroups.filter(([month]) => month.toLowerCase().includes(monthSearch.toLowerCase()));
  }, [monthSearch, monthlyGroups]);

  const pagedMonths = paginateItems(filteredMonthlyGroups, monthPage, monthPageSize);

  const filteredSelectedEntries = useMemo(() => {
    let filtered = selectedEntries;
    Object.entries(filters).forEach(([key, value]) => {
      if (value) {
        filtered = filtered.filter((entry) => {
          const fieldValue = entry[key as keyof ReportEntry];
          return fieldValue != null && String(fieldValue).toLowerCase().includes(value.toLowerCase());
        });
      }
    });
    return filtered;
  }, [filters, selectedEntries]);

  const filterOptions = useMemo(() => {
    const options: Record<string, string[]> = {};
    FILTERABLE.forEach(({ key }) => {
      options[key] = [...new Set(selectedEntries.map((entry) => entry[key as keyof ReportEntry]).filter(Boolean).map(String))].sort();
    });
    return options;
  }, [selectedEntries]);

  const activeFilterCount = Object.values(filters).filter(Boolean).length;
  const clearFilters = () => { setFilters({}); setEntryPage(0); };
  const pagedEntries = paginateItems(filteredSelectedEntries, entryPage, entryPageSize);

  const exportCSV = () => {
    const headers = ['Reporting Month', ...COLUMNS.map((column) => column.label)];
    const rows = filteredSelectedEntries.map((entry) => [
      entry.reporting_month,
      ...COLUMNS.map((column) => column.key === 'net_generated_revenue'
        ? String(applyRevenueCut(entry))
        : column.key.startsWith('custom_')
          ? String((entry.extra_data as Record<string, string>)?.[column.key] ?? '')
          : String(entry[column.key as keyof ReportEntry] ?? '')),
    ]);

    const csv = [headers, ...rows].map((row) => row.map((value) => `"${value}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${exportPrefix}-${selectedMonth}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center gap-3 flex-wrap">
          {selectedMonth && (
            <Button variant="ghost" size="icon" onClick={() => { setSelectedMonth(null); setSelectedEntries([]); clearFilters(); }}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
          )}
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl font-bold">{title}</h1>
            <p className="text-muted-foreground text-sm">
              {selectedMonth ? `Viewing report for ${selectedMonth}` : introText} · All amounts in ₹ (INR)
            </p>
          </div>
          {selectedMonth && (
            <Button size="sm" variant="outline" onClick={exportCSV} disabled={detailLoading}>
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
                <p>{emptyMessage}</p>
              </div>
            ) : (
              <>
                <div className="p-4 border-b border-border/50">
                  <div className="relative max-w-xs">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search months..."
                      value={monthSearch}
                      onChange={(event) => { setMonthSearch(event.target.value); setMonthPage(0); }}
                      className="pl-9 h-9"
                    />
                  </div>
                </div>
                <Table className="min-w-max">
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
                        <TableCell>{group.count}</TableCell>
                        <TableCell className="font-medium">{formatRevenue(group.totalRevenue)}</TableCell>
                        <TableCell>{format(new Date(group.latestImport), 'dd MMM yyyy, hh:mm a')}</TableCell>
                        <TableCell className="text-right">
                          <Button size="sm" variant="outline" onClick={() => void loadMonthEntries(month)}>
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
                    onValueChange={(value) => { setFilters((current) => ({ ...current, [key]: value === '_all' ? '' : value })); setEntryPage(0); }}
                  >
                    <SelectTrigger className="h-9 text-xs">
                      <SelectValue placeholder={label} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="_all">All {label}s</SelectItem>
                      {(filterOptions[key] || []).map((option) => (
                        <SelectItem key={option} value={option}>{option}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ))}
              </div>
            </GlassCard>

            <GlassCard className="p-0 overflow-hidden rounded-lg">
              {detailLoading ? (
                <div className="p-8 text-center text-muted-foreground">Loading report details...</div>
              ) : (
                <>
                  <div className="responsive-table-wrap">
                    <Table className="min-w-max">
                      <TableHeader>
                        <TableRow>
                          {COLUMNS.map((column) => (
                            <TableHead key={column.key} className="whitespace-nowrap">{column.label}</TableHead>
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
                              {COLUMNS.map((column) => (
                                <TableCell key={column.key} className="whitespace-nowrap">
                                  {column.key === 'net_generated_revenue'
                                    ? formatRevenue(applyRevenueCut(entry))
                                    : column.key.startsWith('custom_')
                                      ? String((entry.extra_data as Record<string, string>)?.[column.key] ?? '-')
                                      : String(entry[column.key as keyof ReportEntry] ?? '-')}
                                </TableCell>
                              ))}
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </div>
                  <TablePagination
                    totalItems={filteredSelectedEntries.length}
                    currentPage={entryPage}
                    pageSize={entryPageSize}
                    onPageChange={setEntryPage}
                    onPageSizeChange={setEntryPageSize}
                  />
                </>
              )}
            </GlassCard>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
