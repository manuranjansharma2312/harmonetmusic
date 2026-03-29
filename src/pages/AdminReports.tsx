import { useState, useEffect, useRef, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { DashboardLayout } from '@/components/DashboardLayout';
import { GlassCard } from '@/components/GlassCard';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { Upload, Trash2, FileSpreadsheet, Eye, ArrowLeft, Filter, X, Download, Search, Settings2, Save, GripVertical, Plus } from 'lucide-react';
import { format } from 'date-fns';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { normalizeIsrc } from '@/lib/isrc';
import { TablePagination, paginateItems } from '@/components/TablePagination';

interface FormatColumn {
  id: string;
  column_key: string;
  csv_header: string;
  is_enabled: boolean;
  is_required: boolean;
  sort_order: number;
  is_custom: boolean;
}

const ALL_COLUMNS = [
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
  return (parseInt(parts[1]) || 0) * 12 + (months[parts[0]] ?? 0);
}

function parseCSV(text: string): Record<string, string>[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return [];
  const headers = lines[0].split(',').map((h) => h.trim().replace(/^"|"$/g, ''));
  return lines.slice(1).map((line) => {
    const values: string[] = [];
    let current = '';
    let inQuotes = false;
    for (const char of line) {
      if (char === '"') { inQuotes = !inQuotes; continue; }
      if (char === ',' && !inQuotes) { values.push(current.trim()); current = ''; continue; }
      current += char;
    }
    values.push(current.trim());
    const row: Record<string, string> = {};
    headers.forEach((h, i) => { row[h] = values[i] || ''; });
    return row;
  });
}

interface ReportEntry {
  id: string;
  user_id: string;
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

interface MonthGroup {
  month: string;
  count: number;
  latestImport: string;
}

export default function AdminReports() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);
  const [preview, setPreview] = useState<Record<string, string>[] | null>(null);
  const [monthGroups, setMonthGroups] = useState<MonthGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteMonth, setDeleteMonth] = useState<string | null>(null);
  const [monthPage, setMonthPage] = useState(0);
  const [monthPageSize, setMonthPageSize] = useState<number | 'all'>(10);
  const [monthSearch, setMonthSearch] = useState('');

  const [selectedMonth, setSelectedMonth] = useState<string | null>(null);
  const [detailEntries, setDetailEntries] = useState<ReportEntry[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [entryPage, setEntryPage] = useState(0);
  const [entryPageSize, setEntryPageSize] = useState<number | 'all'>(10);
  const [userCutMap, setUserCutMap] = useState<Record<string, number>>({});

  const [formatColumns, setFormatColumns] = useState<FormatColumn[]>([]);
  const [editingFormat, setEditingFormat] = useState<FormatColumn[]>([]);
  const [showFormatConfig, setShowFormatConfig] = useState(false);
  const [savingFormat, setSavingFormat] = useState(false);
  const [newColumnName, setNewColumnName] = useState('');
  const [deletingColumnId, setDeletingColumnId] = useState<string | null>(null);

  const applyUserCut = (entry: ReportEntry) => {
    const cut = entry.cut_percent_snapshot != null ? entry.cut_percent_snapshot : (userCutMap[entry.user_id] || 0);
    return Number(((Number(entry.net_generated_revenue) || 0) * (1 - cut / 100)).toFixed(4));
  };

  const fetchUserCuts = async () => {
    const { data } = await supabase.from('profiles').select('user_id, hidden_cut_percent');
    const map: Record<string, number> = {};
    (data || []).forEach((p: any) => { map[p.user_id] = Number(p.hidden_cut_percent) || 0; });
    setUserCutMap(map);
  };

  const fetchFormat = async () => {
    const { data } = await supabase.from('ott_report_format').select('*').order('sort_order', { ascending: true });
    if (data) setFormatColumns(data as FormatColumn[]);
  };

  const fetchMonths = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('report_entries')
      .select('reporting_month, imported_at')
      .order('reporting_month', { ascending: false });

    if (data) {
      const groups: Record<string, MonthGroup> = {};
      data.forEach((r: any) => {
        if (!groups[r.reporting_month]) {
          groups[r.reporting_month] = { month: r.reporting_month, count: 0, latestImport: r.imported_at };
        }
        groups[r.reporting_month].count++;
        if (r.imported_at > groups[r.reporting_month].latestImport) {
          groups[r.reporting_month].latestImport = r.imported_at;
        }
      });
      setMonthGroups(Object.values(groups).sort((a, b) => parseMonthKey(b.month) - parseMonthKey(a.month)));
    }
    setLoading(false);
  };

  const fetchDetailEntries = async (month: string) => {
    setDetailLoading(true);
    const { data } = await supabase
      .from('report_entries')
      .select('*')
      .eq('reporting_month', month)
      .order('artist', { ascending: true });
    setDetailEntries((data as ReportEntry[]) || []);
    setDetailLoading(false);
  };

  useEffect(() => { fetchMonths(); fetchUserCuts(); fetchFormat(); }, []);

  const enabledFormat = useMemo(() =>
    formatColumns.filter(c => c.is_enabled).sort((a, b) => a.sort_order - b.sort_order),
    [formatColumns]
  );

  const csvHeaders = useMemo(() => enabledFormat.map(c => c.csv_header), [enabledFormat]);

  const COLUMNS = useMemo(() =>
    enabledFormat
      .filter(c => c.column_key !== 'reporting_month')
      .map(c => ({ key: c.column_key, label: ALL_COLUMNS.find(a => a.key === c.column_key)?.label || c.csv_header })),
    [enabledFormat]
  );

  const handleViewMonth = (month: string) => {
    setSelectedMonth(month);
    setFilters({});
    setEntryPage(0);
    fetchDetailEntries(month);
  };

  const handleBackToList = () => {
    setSelectedMonth(null);
    setDetailEntries([]);
    setFilters({});
    setEntryPage(0);
  };

  const filteredMonthGroups = useMemo(() => {
    if (!monthSearch.trim()) return monthGroups;
    return monthGroups.filter((g) => g.month.toLowerCase().includes(monthSearch.toLowerCase()));
  }, [monthGroups, monthSearch]);

  const pagedMonths = paginateItems(filteredMonthGroups, monthPage, monthPageSize);

  const filteredEntries = useMemo(() => {
    let filtered = detailEntries;
    Object.entries(filters).forEach(([key, value]) => {
      if (value) {
        filtered = filtered.filter((e) => {
          const val = e[key as keyof ReportEntry];
          return val != null && String(val).toLowerCase().includes(value.toLowerCase());
        });
      }
    });
    return filtered;
  }, [detailEntries, filters]);

  const filterOptions = useMemo(() => {
    const opts: Record<string, string[]> = {};
    FILTERABLE.forEach(({ key }) => {
      const unique = [...new Set(detailEntries.map((e) => e[key as keyof ReportEntry]).filter(Boolean).map(String))].sort();
      opts[key] = unique;
    });
    return opts;
  }, [detailEntries]);

  const activeFilterCount = Object.values(filters).filter(Boolean).length;
  const clearFilters = () => { setFilters({}); setEntryPage(0); };
  const pagedEntries = paginateItems(filteredEntries, entryPage, entryPageSize);

  const exportCSV = () => {
    const headers = ['Reporting Month', ...COLUMNS.map((c) => c.label)];
    const rows = filteredEntries.map((e) => [
      e.reporting_month,
      ...COLUMNS.map((c) => c.key === 'net_generated_revenue'
        ? String(applyUserCut(e))
        : c.key.startsWith('custom_')
          ? String((e.extra_data as Record<string, string>)?.[c.key] ?? '')
          : String(e[c.key as keyof ReportEntry] ?? '')),
    ]);
    const csv = [headers, ...rows].map((r) => r.map((v) => `"${v}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `report-${selectedMonth}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      const rows = parseCSV(text);
      if (rows.length === 0) { toast.error('No data found in file'); return; }
      setPreview(rows);
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleImport = async () => {
    if (!preview || preview.length === 0) return;
    setImporting(true);
    try {
      const { data: tracks } = await supabase.from('tracks').select('isrc, user_id');
      const isrcMap: Record<string, string> = {};
      tracks?.forEach((t: any) => { if (t.isrc) isrcMap[t.isrc.toUpperCase()] = t.user_id; });
      const { data: songs } = await supabase.from('songs').select('isrc, user_id');
      songs?.forEach((s: any) => { if (s.isrc) isrcMap[s.isrc.toUpperCase()] = s.user_id; });

      const { data: profiles } = await supabase.from('profiles').select('user_id, hidden_cut_percent');
      const cutMap: Record<string, number> = {};
      (profiles || []).forEach((p: any) => { cutMap[p.user_id] = Number(p.hidden_cut_percent) || 0; });

      const { data: subLabels } = await supabase.from('sub_labels').select('sub_user_id, parent_user_id, percentage_cut').eq('status', 'active');
      const subLabelMap: Record<string, { parentCut: number; parentUserId: string }> = {};
      (subLabels || []).forEach((sl: any) => {
        if (sl.sub_user_id) subLabelMap[sl.sub_user_id] = { parentCut: Number(sl.percentage_cut) || 0, parentUserId: sl.parent_user_id };
      });

      const headerMap: Record<string, FormatColumn> = {};
      enabledFormat.forEach(c => { headerMap[c.csv_header] = c; });

      const toInsert = preview
        .map((row) => {
          const isrcHeader = enabledFormat.find(c => c.column_key === 'isrc')?.csv_header || 'ISRC';
          const isrc = normalizeIsrc(row[isrcHeader]);
          const userId = isrc ? isrcMap[isrc] : null;
          if (!userId) return null;
          let snapshotCut: number;
          const subInfo = subLabelMap[userId];
          if (subInfo) {
            const adminCutOnParent = cutMap[subInfo.parentUserId] || 0;
            const parentCutOnSub = subInfo.parentCut;
            snapshotCut = (1 - (1 - adminCutOnParent / 100) * (1 - parentCutOnSub / 100)) * 100;
          } else {
            snapshotCut = cutMap[userId] || 0;
          }

          const extra_data: Record<string, string> = {};
          enabledFormat.filter(c => c.is_custom).forEach(c => {
            if (row[c.csv_header]) extra_data[c.column_key] = row[c.csv_header];
          });

          const monthHeader = enabledFormat.find(c => c.column_key === 'reporting_month')?.csv_header || 'Reporting Month';
          const revenueHeader = enabledFormat.find(c => c.column_key === 'net_generated_revenue')?.csv_header || 'Net Generated Revenue';

          const getVal = (key: string) => {
            const col = enabledFormat.find(c => c.column_key === key);
            return col ? (row[col.csv_header] || null) : null;
          };

          return {
            user_id: userId,
            reporting_month: row[monthHeader] || '',
            store: getVal('store'),
            sales_type: getVal('sales_type'),
            country: getVal('country'),
            label: getVal('label'),
            c_line: getVal('c_line'),
            p_line: getVal('p_line'),
            track: getVal('track'),
            artist: getVal('artist'),
            isrc,
            upc: getVal('upc'),
            currency: getVal('currency'),
            streams: parseInt(getVal('streams') || '0') || 0,
            downloads: parseInt(getVal('downloads') || '0') || 0,
            net_generated_revenue: parseFloat(row[revenueHeader] || '0') || 0,
            cut_percent_snapshot: snapshotCut,
            extra_data: Object.keys(extra_data).length > 0 ? extra_data : {},
          };
        })
        .filter(Boolean) as any[];

      if (toInsert.length === 0) {
        toast.error('No matching ISRCs found. Make sure the ISRCs in the CSV match existing tracks.');
        setImporting(false);
        return;
      }

      for (let i = 0; i < toInsert.length; i += 500) {
        const batch = toInsert.slice(i, i + 500);
        const { error } = await supabase.from('report_entries').insert(batch);
        if (error) throw error;
      }

      const skipped = preview.length - toInsert.length;
      toast.success(`Imported ${toInsert.length} entries.${skipped > 0 ? ` ${skipped} rows skipped (no matching ISRC).` : ''}`);
      setPreview(null);
      fetchMonths();
    } catch (err: any) {
      toast.error(err.message || 'Import failed');
    }
    setImporting(false);
  };

  const handleDeleteMonth = async () => {
    if (!deleteMonth) return;
    const { error } = await supabase.from('report_entries').delete().eq('reporting_month', deleteMonth);
    if (error) { toast.error(error.message); } else { toast.success(`Deleted all entries for ${deleteMonth}`); }
    setDeleteMonth(null);
    fetchMonths();
  };

  // Format config handlers
  const openFormatConfig = () => {
    setEditingFormat(formatColumns.map(c => ({ ...c })));
    setShowFormatConfig(true);
  };

  const handleFormatToggle = (id: string, enabled: boolean) => {
    setEditingFormat(prev => prev.map(c => c.id === id ? { ...c, is_enabled: enabled } : c));
  };

  const handleFormatHeaderChange = (id: string, newHeader: string) => {
    setEditingFormat(prev => prev.map(c => c.id === id ? { ...c, csv_header: newHeader } : c));
  };

  const saveFormat = async () => {
    setSavingFormat(true);
    try {
      for (const col of editingFormat) {
        if (col.id.startsWith('new-')) continue;
        const { error } = await supabase
          .from('ott_report_format')
          .update({ csv_header: col.csv_header, is_enabled: col.is_enabled, updated_at: new Date().toISOString() })
          .eq('id', col.id);
        if (error) throw error;
      }
      toast.success('Format saved successfully');
      setFormatColumns(editingFormat.filter(c => !c.id.startsWith('new-')).map(c => ({ ...c })));
      setShowFormatConfig(false);
    } catch (err: any) {
      toast.error(err.message || 'Failed to save format');
    }
    setSavingFormat(false);
  };

  const handleAddCustomColumn = async () => {
    const name = newColumnName.trim();
    if (!name) { toast.error('Please enter a column name'); return; }
    const columnKey = 'custom_' + name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
    const exists = editingFormat.some(c => c.column_key === columnKey);
    if (exists) { toast.error('A column with this key already exists'); return; }

    const maxOrder = Math.max(...editingFormat.map(c => c.sort_order), 0);
    const { data, error } = await supabase.from('ott_report_format').insert({
      column_key: columnKey,
      csv_header: name,
      is_enabled: true,
      is_required: false,
      is_custom: true,
      sort_order: maxOrder + 1,
    }).select().single();

    if (error) { toast.error(error.message); return; }
    const newCol = data as FormatColumn;
    setEditingFormat(prev => [...prev, newCol]);
    setFormatColumns(prev => [...prev, newCol]);
    setNewColumnName('');
    toast.success(`Column "${name}" added`);
  };

  const handleDeleteCustomColumn = async () => {
    if (!deletingColumnId) return;
    const { error } = await supabase.from('ott_report_format').delete().eq('id', deletingColumnId);
    if (error) { toast.error(error.message); } else {
      setEditingFormat(prev => prev.filter(c => c.id !== deletingColumnId));
      setFormatColumns(prev => prev.filter(c => c.id !== deletingColumnId));
      toast.success('Custom column removed');
    }
    setDeletingColumnId(null);
  };

  const downloadTemplate = () => {
    const headers = csvHeaders;
    const sampleValues = enabledFormat.map(c => {
      const samples: Record<string, string> = {
        reporting_month: 'January 2025', store: 'Spotify', sales_type: 'Streaming',
        country: 'IN', label: 'Label', c_line: 'C', p_line: 'P',
        track: 'Track Name', artist: 'Artist Name', isrc: 'ISRC001',
        upc: 'UPC001', currency: 'INR', streams: '1000', downloads: '0',
        net_generated_revenue: '100.50',
      };
      return samples[c.column_key] || '';
    });
    const csv = headers.map(h => `"${h}"`).join(',') + '\n' + sampleValues.map(v => `"${v}"`).join(',');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'ott-report-template.csv'; a.click();
    URL.revokeObjectURL(url);
  };

  if (selectedMonth) {
    return (
      <DashboardLayout>
        <div className="space-y-6">
           <div className="flex items-center gap-3 flex-wrap">
            <Button variant="ghost" size="icon" onClick={handleBackToList}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="flex-1 min-w-0">
              <h1 className="text-2xl font-bold">Reports & Analytics</h1>
              <p className="text-muted-foreground text-sm">Viewing report for {selectedMonth}</p>
            </div>
            <Button size="sm" variant="outline" onClick={exportCSV}>
              <Download className="h-4 w-4 mr-1" /> Export CSV
            </Button>
          </div>

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
            {detailLoading ? (
              <p className="p-6 text-center text-muted-foreground">Loading...</p>
            ) : (
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
                                ? applyUserCut(entry).toFixed(4)
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
            )}
            <TablePagination
              totalItems={filteredEntries.length}
              currentPage={entryPage}
              pageSize={entryPageSize}
              onPageChange={setEntryPage}
              onPageSizeChange={setEntryPageSize}
            />
          </GlassCard>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold">Reports & Analytics</h1>
            <p className="text-muted-foreground text-sm">Import and manage user revenue reports</p>
          </div>
          <Button variant="outline" size="sm" onClick={openFormatConfig}>
            <Settings2 className="h-4 w-4 mr-1" /> Report Format
          </Button>
        </div>

        {showFormatConfig && (
          <GlassCard className="p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <Settings2 className="h-5 w-5" /> CSV Report Format
              </h2>
              <div className="flex gap-2">
                <Button variant="ghost" size="sm" onClick={() => setShowFormatConfig(false)}>Cancel</Button>
                <Button size="sm" onClick={saveFormat} disabled={savingFormat}>
                  <Save className="h-4 w-4 mr-1" /> {savingFormat ? 'Saving...' : 'Save Format'}
                </Button>
              </div>
            </div>
            <p className="text-sm text-muted-foreground">
              Enable/disable columns and customize CSV header names. Required columns (ISRC, Net Generated Revenue, Reporting Month) cannot be disabled.
            </p>
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">Enabled</TableHead>
                    <TableHead>Column</TableHead>
                    <TableHead>CSV Header Name</TableHead>
                    <TableHead className="w-20">Type</TableHead>
                    <TableHead className="w-16"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {editingFormat.map((col) => (
                    <TableRow key={col.id}>
                      <TableCell>
                        <Switch
                          checked={col.is_enabled}
                          onCheckedChange={(v) => handleFormatToggle(col.id, v)}
                          disabled={col.is_required}
                        />
                      </TableCell>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          <GripVertical className="h-4 w-4 text-muted-foreground/40" />
                          {col.is_custom ? col.csv_header : (ALL_COLUMNS.find(a => a.key === col.column_key)?.label || col.column_key)}
                          {col.column_key === 'reporting_month' && ' (Reporting Month)'}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Input
                          value={col.csv_header}
                          onChange={(e) => handleFormatHeaderChange(col.id, e.target.value)}
                          className="h-8 text-sm max-w-[200px]"
                        />
                      </TableCell>
                      <TableCell>
                        {col.is_required ? (
                          <span className="text-xs font-medium text-primary bg-primary/10 px-2 py-0.5 rounded-full">Required</span>
                        ) : col.is_custom ? (
                          <span className="text-xs font-medium text-accent-foreground bg-accent px-2 py-0.5 rounded-full">Custom</span>
                        ) : null}
                      </TableCell>
                      <TableCell>
                        {col.is_custom && (
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => setDeletingColumnId(col.id)}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <Input
                placeholder="New column name..."
                value={newColumnName}
                onChange={(e) => setNewColumnName(e.target.value)}
                className="h-9 max-w-[250px]"
                onKeyDown={(e) => e.key === 'Enter' && handleAddCustomColumn()}
              />
              <Button size="sm" variant="outline" onClick={handleAddCustomColumn}>
                <Plus className="h-4 w-4 mr-1" /> Add Column
              </Button>
            </div>

            {deletingColumnId && (
              <ConfirmDialog
                title="Delete Custom Column?"
                message="This column will be removed from the format. Existing data in this column will remain stored but won't be displayed."
                onConfirm={handleDeleteCustomColumn}
                onCancel={() => setDeletingColumnId(null)}
              />
            )}
          </GlassCard>
        )}

        <GlassCard className="p-5 space-y-4">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5" /> Import Report
          </h2>
          <p className="text-sm text-muted-foreground">
            Upload a CSV file with the configured format. Required columns: <strong>{enabledFormat.filter(c => c.is_required).map(c => c.csv_header).join(', ')}</strong>.
            {enabledFormat.filter(c => c.is_enabled && !c.is_required).length > 0 && (
              <> Optional: {enabledFormat.filter(c => c.is_enabled && !c.is_required).map(c => c.csv_header).join(', ')}.</>
            )}
          </p>
          <div className="flex items-center gap-3">
            <Input ref={fileRef} type="file" accept=".csv,.txt" onChange={handleFileSelect} className="max-w-xs" />
            <Button variant="outline" size="sm" onClick={downloadTemplate}>
              <Download className="h-4 w-4 mr-1" /> Download Template
            </Button>
          </div>

          {preview && (
            <div className="space-y-3">
              <p className="text-sm font-medium">{preview.length} rows parsed. Preview (first 5):</p>
              <div className="overflow-x-auto rounded border border-border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      {Object.keys(preview[0] || {}).map((h) => (
                        <TableHead key={h} className="whitespace-nowrap text-xs">{h}</TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {preview.slice(0, 5).map((row, i) => (
                      <TableRow key={i}>
                        {Object.values(row).map((v, j) => (
                          <TableCell key={j} className="whitespace-nowrap text-xs">{v}</TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <div className="flex gap-2">
                <Button onClick={handleImport} disabled={importing}>
                  <Upload className="h-4 w-4 mr-2" /> {importing ? 'Importing...' : 'Import All'}
                </Button>
                <Button variant="outline" onClick={() => setPreview(null)}>Cancel</Button>
              </div>
            </div>
          )}
        </GlassCard>

        <GlassCard className="p-0 overflow-hidden">
          <div className="p-4 border-b border-border/50 flex items-center justify-between gap-3 flex-wrap">
            <h2 className="text-lg font-semibold">Imported Reports</h2>
            <div className="relative max-w-xs w-full sm:w-auto">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search months..."
                value={monthSearch}
                onChange={(e) => { setMonthSearch(e.target.value); setMonthPage(0); }}
                className="pl-9 h-9"
              />
            </div>
          </div>
          {loading ? (
            <p className="p-6 text-center text-muted-foreground">Loading...</p>
          ) : monthGroups.length === 0 ? (
            <p className="p-6 text-center text-muted-foreground">No reports imported yet.</p>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Reporting Month</TableHead>
                    <TableHead>Total Records</TableHead>
                    <TableHead>Last Imported</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pagedMonths.map((g) => (
                    <TableRow key={g.month}>
                      <TableCell className="font-medium">{g.month}</TableCell>
                      <TableCell>{g.count}</TableCell>
                      <TableCell>{format(new Date(g.latestImport), 'dd MMM yyyy, hh:mm a')}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button size="sm" variant="outline" onClick={() => handleViewMonth(g.month)}>
                            <Eye className="h-4 w-4 mr-1" /> View
                          </Button>
                          <Button size="sm" variant="destructive" onClick={() => setDeleteMonth(g.month)}>
                            <Trash2 className="h-4 w-4 mr-1" /> Delete
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <TablePagination
                totalItems={filteredMonthGroups.length}
                currentPage={monthPage}
                pageSize={monthPageSize}
                onPageChange={setMonthPage}
                onPageSizeChange={setMonthPageSize}
                itemLabel="months"
              />
            </>
          )}
        </GlassCard>
      </div>

      {deleteMonth && (
        <ConfirmDialog
          title="Delete Report"
          message={`Are you sure you want to delete all report entries for "${deleteMonth}"? This cannot be undone.`}
          onConfirm={handleDeleteMonth}
          onCancel={() => setDeleteMonth(null)}
        />
      )}
    </DashboardLayout>
  );
}
