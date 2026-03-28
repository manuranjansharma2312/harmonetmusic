import { useState, useEffect, useRef, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { DashboardLayout } from '@/components/DashboardLayout';
import { GlassCard } from '@/components/GlassCard';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from 'sonner';
import { Upload, Trash2, FileSpreadsheet, Eye, ArrowLeft, Filter, X, Download, Search } from 'lucide-react';
import { format } from 'date-fns';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { normalizeIsrc } from '@/lib/isrc';
import { TablePagination, paginateItems } from '@/components/TablePagination';

const CSV_HEADERS = [
  'Reporting Month', 'Store', 'Sales Type', 'Country', 'Label',
  'C Line', 'P Line', 'Track', 'Artist', 'ISRC', 'UPC',
  'Currency', 'Streams', 'Downloads', 'Net Generated Revenue',
];

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
}

interface MonthGroup {
  month: string;
  count: number;
  latestImport: string;
}

export default function AdminVevoReports() {
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

  const fetchMonths = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('vevo_report_entries')
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
      .from('vevo_report_entries')
      .select('*')
      .eq('reporting_month', month)
      .order('artist', { ascending: true });
    setDetailEntries((data as ReportEntry[]) || []);
    setDetailLoading(false);
  };

  useEffect(() => { fetchMonths(); fetchUserCuts(); }, []);

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
      ...COLUMNS.map((c) => c.key === 'net_generated_revenue' ? String(applyUserCut(e)) : String(e[c.key as keyof ReportEntry] ?? '')),
    ]);
    const csv = [headers, ...rows].map((r) => r.map((v) => `"${v}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `vevo-report-${selectedMonth}.csv`;
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

      const toInsert = preview
        .map((row) => {
          const isrc = normalizeIsrc(row['ISRC']);
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
          return {
            user_id: userId,
            reporting_month: row['Reporting Month'] || '',
            store: row['Store'] || null,
            sales_type: row['Sales Type'] || null,
            country: row['Country'] || null,
            label: row['Label'] || null,
            c_line: row['C Line'] || null,
            p_line: row['P Line'] || null,
            track: row['Track'] || null,
            artist: row['Artist'] || null,
            isrc,
            upc: row['UPC'] || null,
            currency: row['Currency'] || null,
            streams: parseInt(row['Streams'] || '0') || 0,
            downloads: parseInt(row['Downloads'] || '0') || 0,
            net_generated_revenue: parseFloat(row['Net Generated Revenue'] || '0') || 0,
            cut_percent_snapshot: snapshotCut,
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
        const { error } = await supabase.from('vevo_report_entries').insert(batch);
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
    const { error } = await supabase.from('vevo_report_entries').delete().eq('reporting_month', deleteMonth);
    if (error) { toast.error(error.message); } else { toast.success(`Deleted all entries for ${deleteMonth}`); }
    setDeleteMonth(null);
    fetchMonths();
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
              <h1 className="text-2xl font-bold">Vevo Reports</h1>
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
                                ? applyUserCut(entry).toFixed(4)
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
        <div>
          <h1 className="text-2xl font-bold">Vevo Reports</h1>
          <p className="text-muted-foreground text-sm">Import and manage Vevo revenue reports</p>
        </div>

        <GlassCard className="p-5 space-y-4">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5" /> Import Vevo Report
          </h2>
          <p className="text-sm text-muted-foreground">
            Upload a CSV file with the following required columns: <strong>ISRC</strong> and <strong>Net Generated Revenue</strong>.
            Other columns (Store, Country, Track, Artist, etc.) are optional and will auto-populate analytics.
          </p>

          <div className="flex items-center gap-3">
            <input ref={fileRef} type="file" accept=".csv,.xlsx,.xls" className="hidden" onChange={handleFileSelect} />
            <Button variant="outline" onClick={() => fileRef.current?.click()}>
              <Upload className="h-4 w-4 mr-1" /> Select File
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                const csv = CSV_HEADERS.map((h) => `"${h}"`).join(',') + '\n"January 2025","YouTube","Streaming","IN","Label","C","P","Track","Artist","ISRC001","UPC001","INR","1000","0","100.50"';
                const blob = new Blob([csv], { type: 'text/csv' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = 'vevo-report-template.csv';
                a.click();
                URL.revokeObjectURL(url);
              }}
            >
              <Download className="h-4 w-4 mr-1" /> Download Template
            </Button>
          </div>

          {preview && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium">{preview.length} rows ready</p>
                <div className="flex gap-2">
                  <Button variant="ghost" size="sm" onClick={() => setPreview(null)}>Cancel</Button>
                  <Button size="sm" onClick={handleImport} disabled={importing}>
                    {importing ? 'Importing...' : 'Confirm Import'}
                  </Button>
                </div>
              </div>
              <div className="overflow-x-auto max-h-48 border rounded-lg">
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
            </div>
          )}
        </GlassCard>

        <GlassCard className="p-0 overflow-hidden">
          {loading ? (
            <p className="p-6 text-center text-muted-foreground">Loading reports...</p>
          ) : monthGroups.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground flex flex-col items-center gap-3">
              <FileSpreadsheet className="h-10 w-10 opacity-40" />
              <p>No Vevo reports imported yet.</p>
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
                    <TableHead>Last Import</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pagedMonths.map((g) => (
                    <TableRow key={g.month}>
                      <TableCell className="font-medium">{g.month}</TableCell>
                      <TableCell>{g.count}</TableCell>
                      <TableCell>{format(new Date(g.latestImport), 'dd MMM yyyy, hh:mm a')}</TableCell>
                      <TableCell className="text-right space-x-2">
                        <Button size="sm" variant="outline" onClick={() => handleViewMonth(g.month)}>
                          <Eye className="h-4 w-4 mr-1" /> View
                        </Button>
                        <Button size="sm" variant="destructive" onClick={() => setDeleteMonth(g.month)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
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

        {deleteMonth && (
          <ConfirmDialog
            title={`Delete ${deleteMonth}?`}
            message="All report entries for this month will be permanently deleted."
            onConfirm={() => { handleDeleteMonth(); }}
            onCancel={() => setDeleteMonth(null)}
          />
        )}
      </div>
    </DashboardLayout>
  );
}
