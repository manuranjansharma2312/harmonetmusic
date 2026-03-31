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
import { useTeamPermissions } from '@/hooks/useTeamPermissions';
import { format } from 'date-fns';
import { ConfirmDialog } from '@/components/ConfirmDialog';
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

const ALL_COLUMNS: Record<string, string> = {
  channel_name: 'Channel Name', label: 'Label', track: 'Track', artist: 'Artist',
  currency: 'Currency', streams: 'Streams', downloads: 'Downloads',
  net_generated_revenue: 'Net Generated Revenue', cms_cut: 'CMS Cut %',
  cut_amount: 'Cut Amount', net_payable: 'Net Payable',
};

interface CmsLink {
  channel_name: string;
  cut_percent: number;
}

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

export default function AdminCmsReports() {
  const { canDelete, canChangeSettings } = useTeamPermissions();
  const [entries, setEntries] = useState<ReportEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState<string | null>(null);
  const [formatColumns, setFormatColumns] = useState<FormatColumn[]>([]);
  const [showFormat, setShowFormat] = useState(false);
  const [importing, setImporting] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<{ month: string } | null>(null);
  const [cmsLinks, setCmsLinks] = useState<CmsLink[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);

  // Pagination
  const [monthPage, setMonthPage] = useState(0);
  const [monthPageSize, setMonthPageSize] = useState<number | 'all'>(10);
  const [monthSearch, setMonthSearch] = useState('');
  const [entryPage, setEntryPage] = useState(0);
  const [entryPageSize, setEntryPageSize] = useState<number | 'all'>(10);
  const [filters, setFilters] = useState<Record<string, string>>({});

  // Format editing
  const [editFormat, setEditFormat] = useState<FormatColumn[]>([]);
  const [newColHeader, setNewColHeader] = useState('');

  const COLUMNS = useMemo(() => {
    const baseCols = formatColumns
      .filter(c => c.is_enabled && c.column_key !== 'reporting_month')
      .sort((a, b) => a.sort_order - b.sort_order)
      .map(c => ({ key: c.column_key, label: ALL_COLUMNS[c.column_key] || c.csv_header }));
    // Add calculated columns after net_generated_revenue
    const revenueIdx = baseCols.findIndex(c => c.key === 'net_generated_revenue');
    const extra = [
      { key: 'cms_cut', label: 'CMS Cut %' },
      { key: 'cut_amount', label: 'Cut Amount' },
      { key: 'net_payable', label: 'Net Payable' },
    ];
    if (revenueIdx >= 0) baseCols.splice(revenueIdx + 1, 0, ...extra);
    else baseCols.push(...extra);
    return baseCols;
  }, [formatColumns]);

  // Use frozen snapshot if available, otherwise fallback to live cut
  const getEffectiveCut = (entry: ReportEntry) => {
    if (entry.cut_percent_snapshot != null) return Number(entry.cut_percent_snapshot) || 0;
    const link = cmsLinks.find(l => l.channel_name === entry.channel_name);
    return Number(link?.cut_percent) || 0;
  };
  const calcCutAmount = (entry: ReportEntry) => {
    const revenue = Number(entry.net_generated_revenue) || 0;
    return Number((revenue * getEffectiveCut(entry) / 100).toFixed(4));
  };
  const calcNetPayable = (entry: ReportEntry) => {
    const revenue = Number(entry.net_generated_revenue) || 0;
    const cut = getEffectiveCut(entry);
    return Number((revenue - (revenue * cut / 100)).toFixed(4));
  };

  const fetchFormat = async () => {
    const { data } = await supabase.from('cms_report_format' as any).select('*').order('sort_order', { ascending: true });
    if (data) { setFormatColumns(data as any); setEditFormat(JSON.parse(JSON.stringify(data))); }
  };

  const fetchEntries = async () => {
    setLoading(true);
    const [{ data }, { data: links }] = await Promise.all([
      supabase.from('cms_report_entries' as any).select('*').order('reporting_month', { ascending: false }),
      supabase.from('youtube_cms_links' as any).select('channel_name, cut_percent').eq('status', 'linked'),
    ]);
    setEntries((data as any) || []);
    setCmsLinks((links as any) || []);
    setLoading(false);
  };

  useEffect(() => { fetchFormat(); fetchEntries(); }, []);

  // Monthly groups
  const monthlyGroups = useMemo(() => {
    const groups: Record<string, { entries: ReportEntry[]; latestImport: string; totalRevenue: number; totalNetPayable: number }> = {};
    entries.forEach(e => {
      if (!groups[e.reporting_month]) groups[e.reporting_month] = { entries: [], latestImport: e.imported_at, totalRevenue: 0, totalNetPayable: 0 };
      groups[e.reporting_month].entries.push(e);
      groups[e.reporting_month].totalRevenue += Number(e.net_generated_revenue) || 0;
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

  // CSV Import
  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    try {
      const text = await file.text();
      const lines = text.split('\n').filter(l => l.trim());
      if (lines.length < 2) throw new Error('CSV must have a header row and at least one data row');

      const enabledCols = formatColumns.filter(c => c.is_enabled).sort((a, b) => a.sort_order - b.sort_order);
      const headers = lines[0].split(',').map(h => h.replace(/^"|"$/g, '').trim());

      // Map CSV headers to column keys
      const colMap: { csvIndex: number; col: FormatColumn }[] = [];
      enabledCols.forEach(col => {
        const idx = headers.findIndex(h => h.toLowerCase() === col.csv_header.toLowerCase());
        if (idx >= 0) colMap.push({ csvIndex: idx, col });
      });

      const requiredKeys = enabledCols.filter(c => c.is_required).map(c => c.csv_header.toLowerCase());
      const mappedHeaders = colMap.map(c => c.col.csv_header.toLowerCase());
      const missing = requiredKeys.filter(k => !mappedHeaders.includes(k));
      if (missing.length > 0) throw new Error(`Missing required columns: ${missing.join(', ')}`);

      // Build a channel->cut_percent lookup from all linked CMS links
      const { data: allLinks } = await supabase.from('youtube_cms_links' as any).select('channel_name, cut_percent').eq('status', 'linked');
      const cutLookup: Record<string, number> = {};
      ((allLinks as any[]) || []).forEach((l: any) => { cutLookup[l.channel_name] = Number(l.cut_percent) || 0; });

      const rows: any[] = [];
      for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(',').map(v => v.replace(/^"|"$/g, '').trim());
        if (values.length < 2) continue;

        const row: any = { extra_data: {} };
        colMap.forEach(({ csvIndex, col }) => {
          const val = values[csvIndex] || '';
          const standardKeys = ['reporting_month', 'channel_name', 'label', 'track', 'artist', 'currency', 'streams', 'downloads', 'net_generated_revenue'];
          if (standardKeys.includes(col.column_key)) {
            if (['streams', 'downloads'].includes(col.column_key)) row[col.column_key] = parseInt(val) || 0;
            else if (col.column_key === 'net_generated_revenue') row[col.column_key] = parseFloat(val) || 0;
            else row[col.column_key] = val;
          } else {
            row.extra_data[col.column_key] = val;
          }
        });

        if (!row.reporting_month || !row.channel_name) continue;
        // Snapshot the current cut_percent for this channel at import time
        row.cut_percent_snapshot = cutLookup[row.channel_name] ?? 0;
        rows.push(row);
      }

      if (rows.length === 0) throw new Error('No valid rows found in CSV');

      const batchSize = 500;
      for (let i = 0; i < rows.length; i += batchSize) {
        const batch = rows.slice(i, i + batchSize);
        const { error } = await supabase.from('cms_report_entries' as any).insert(batch as any);
        if (error) throw error;
      }

      toast.success(`Imported ${rows.length} CMS report entries`);
      fetchEntries();
    } catch (err: any) {
      toast.error(err.message || 'Import failed');
    } finally {
      setImporting(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  // Delete month
  const handleDeleteMonth = async (month: string) => {
    const ids = entries.filter(e => e.reporting_month === month).map(e => e.id);
    if (!ids.length) return;
    const batchSize = 500;
    for (let i = 0; i < ids.length; i += batchSize) {
      await supabase.from('cms_report_entries' as any).delete().in('id', ids.slice(i, i + batchSize));
    }
    toast.success(`Deleted ${ids.length} entries for ${month}`);
    setDeleteConfirm(null);
    fetchEntries();
  };

  // Format management
  const toggleCol = (id: string) => setEditFormat(prev => prev.map(c => c.id === id ? { ...c, is_enabled: !c.is_enabled } : c));
  const moveCol = (id: string, dir: -1 | 1) => {
    setEditFormat(prev => {
      const sorted = [...prev].sort((a, b) => a.sort_order - b.sort_order);
      const idx = sorted.findIndex(c => c.id === id);
      if ((dir === -1 && idx <= 0) || (dir === 1 && idx >= sorted.length - 1)) return prev;
      const swap = sorted[idx + dir];
      const tmp = sorted[idx].sort_order;
      sorted[idx].sort_order = swap.sort_order;
      swap.sort_order = tmp;
      return sorted;
    });
  };

  const addCustomCol = () => {
    if (!newColHeader.trim()) return;
    const key = 'custom_' + newColHeader.toLowerCase().replace(/[^a-z0-9]+/g, '_');
    if (editFormat.find(c => c.column_key === key)) { toast.error('Column already exists'); return; }
    setEditFormat(prev => [...prev, {
      id: crypto.randomUUID(), column_key: key, csv_header: newColHeader.trim(),
      is_enabled: true, is_required: false, sort_order: prev.length, is_custom: true,
    }]);
    setNewColHeader('');
  };

  const deleteCustomCol = async (col: FormatColumn) => {
    if (!col.is_custom) return;
    await supabase.from('cms_report_format' as any).delete().eq('id', col.id);
    setEditFormat(prev => prev.filter(c => c.id !== col.id));
    toast.success('Column deleted');
  };

  const saveFormat = async () => {
    for (const col of editFormat) {
      const existing = formatColumns.find(c => c.id === col.id);
      if (existing) {
        await supabase.from('cms_report_format' as any).update({
          is_enabled: col.is_enabled, sort_order: col.sort_order, csv_header: col.csv_header,
        } as any).eq('id', col.id);
      } else {
        await supabase.from('cms_report_format' as any).insert({
          column_key: col.column_key, csv_header: col.csv_header,
          is_enabled: col.is_enabled, is_required: col.is_required,
          sort_order: col.sort_order, is_custom: col.is_custom,
        } as any);
      }
    }
    toast.success('Format saved');
    fetchFormat();
  };

  const downloadTemplate = () => {
    const enabledCols = editFormat.filter(c => c.is_enabled).sort((a, b) => a.sort_order - b.sort_order);
    const csv = enabledCols.map(c => `"${c.csv_header}"`).join(',') + '\n';
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'cms-report-template.csv'; a.click();
    URL.revokeObjectURL(url);
  };

  // Export CSV
  const exportCSV = () => {
    const headers = ['Reporting Month', ...COLUMNS.map(c => c.label)];
    const rows = selectedEntries.map(e => [
      e.reporting_month,
      ...COLUMNS.map(c => {
        if (c.key === 'cms_cut') return `${getCutPercent(e.channel_name)}%`;
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
            <h1 className="text-2xl font-bold">YouTube CMS Reports</h1>
            <p className="text-muted-foreground text-sm">
              {selectedMonth ? `Viewing ${selectedMonth}` : 'Manage CMS revenue reports'} · Channel-based filtering
            </p>
          </div>
          <div className="flex gap-2 flex-wrap">
            {!selectedMonth && canChangeSettings && (
              <>
                <Button size="sm" variant="outline" onClick={() => setShowFormat(!showFormat)}>
                  <Settings2 className="h-4 w-4 mr-1" /> Format
                </Button>
                <Button size="sm" variant="outline" onClick={() => fileRef.current?.click()} disabled={importing}>
                  <Upload className="h-4 w-4 mr-1" /> {importing ? 'Importing...' : 'Import CSV'}
                </Button>
                <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={handleImport} />
              </>
            )}
            {selectedMonth && (
              <Button size="sm" variant="outline" onClick={exportCSV}>
                <Download className="h-4 w-4 mr-1" /> Export CSV
              </Button>
            )}
          </div>
        </div>

        {/* Format Settings */}
        {showFormat && !selectedMonth && (
          <GlassCard className="p-4 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold flex items-center gap-2"><Settings2 className="h-4 w-4" /> Report Format</h3>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={downloadTemplate}><Download className="h-4 w-4 mr-1" /> Template</Button>
                <Button size="sm" onClick={saveFormat}><Save className="h-4 w-4 mr-1" /> Save</Button>
              </div>
            </div>
            <div className="responsive-table-wrap">
            <Table className="min-w-max">
              <TableHeader>
                <TableRow>
                  <TableHead>Order</TableHead>
                  <TableHead>Column</TableHead>
                  <TableHead>CSV Header</TableHead>
                  <TableHead>Enabled</TableHead>
                  <TableHead>Required</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {[...editFormat].sort((a, b) => a.sort_order - b.sort_order).map(col => (
                  <TableRow key={col.id}>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => moveCol(col.id, -1)}><GripVertical className="h-3 w-3" /></Button>
                      </div>
                    </TableCell>
                    <TableCell className="font-mono text-xs">{col.column_key}</TableCell>
                    <TableCell>
                      <Input value={col.csv_header} onChange={e => setEditFormat(prev => prev.map(c => c.id === col.id ? { ...c, csv_header: e.target.value } : c))} className="h-8 text-sm" />
                    </TableCell>
                    <TableCell>
                      <Switch checked={col.is_enabled} onCheckedChange={() => toggleCol(col.id)} disabled={col.is_required} />
                    </TableCell>
                    <TableCell>{col.is_required ? '✓' : ''}</TableCell>
                    <TableCell>
                      {col.is_custom && <Button size="icon" variant="ghost" className="h-6 w-6 text-destructive" onClick={() => deleteCustomCol(col)}><Trash2 className="h-3 w-3" /></Button>}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            </div>
            <div className="flex gap-2">
              <Input placeholder="New column header..." value={newColHeader} onChange={e => setNewColHeader(e.target.value)} className="max-w-xs" />
              <Button size="sm" variant="outline" onClick={addCustomCol}><Plus className="h-4 w-4 mr-1" /> Add Column</Button>
            </div>
          </GlassCard>
        )}

        {loading ? (
          <GlassCard className="p-8 text-center text-muted-foreground">Loading CMS reports...</GlassCard>
        ) : !selectedMonth ? (
          <GlassCard className="p-0 overflow-hidden">
            {monthlyGroups.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground flex flex-col items-center gap-3">
                <FileSpreadsheet className="h-10 w-10 opacity-40" />
                <p>No CMS reports imported yet. Use "Import CSV" to get started.</p>
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
                      <TableHead>Total Revenue</TableHead>
                      <TableHead>Net Payable</TableHead>
                      <TableHead>Last Updated</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pagedMonths.map(([month, group]) => (
                      <TableRow key={month}>
                        <TableCell className="font-medium">{month}</TableCell>
                        <TableCell>{group.entries.length}</TableCell>
                        <TableCell>₹{group.totalRevenue.toFixed(2)}</TableCell>
                        <TableCell className="font-medium text-primary">₹{group.totalNetPayable.toFixed(2)}</TableCell>
                        <TableCell>{format(new Date(group.latestImport), 'dd MMM yyyy, hh:mm a')}</TableCell>
                        <TableCell className="text-right space-x-2">
                          <Button size="sm" variant="outline" onClick={() => setSelectedMonth(month)}><Eye className="h-4 w-4 mr-1" /> View</Button>
                          {canDelete && <Button size="sm" variant="destructive" onClick={() => setDeleteConfirm({ month })}><Trash2 className="h-4 w-4" /></Button>}
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

            <GlassCard className="p-0 overflow-hidden">
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
                            {col.key === 'net_generated_revenue' ? `₹${(Number(entry.net_generated_revenue) || 0).toFixed(4)}`
                              : col.key === 'cms_cut' ? `${getCutPercent(entry.channel_name)}%`
                              : col.key === 'cut_amount' ? `₹${calcCutAmount(entry).toFixed(4)}`
                              : col.key === 'net_payable' ? `₹${calcNetPayable(entry).toFixed(4)}`
                              : col.key.startsWith('custom_') ? String((entry.extra_data as Record<string, string>)?.[col.key] ?? '-')
                              : String(entry[col.key as keyof ReportEntry] ?? '-')}
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

      {deleteConfirm && (
        <ConfirmDialog
          title="Delete CMS Report Month"
          message={`Delete all entries for ${deleteConfirm.month}? This cannot be undone.`}
          onConfirm={() => handleDeleteMonth(deleteConfirm.month)}
          onCancel={() => setDeleteConfirm(null)}
        />
      )}
    </DashboardLayout>
  );
}
