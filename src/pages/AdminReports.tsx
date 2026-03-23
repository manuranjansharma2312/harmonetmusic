import { useState, useEffect, useRef, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { DashboardLayout } from '@/components/DashboardLayout';
import { GlassCard } from '@/components/GlassCard';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from 'sonner';
import { Upload, Trash2, FileSpreadsheet, Eye, ArrowLeft, Download, Filter, X, ChevronLeft, ChevronRight } from 'lucide-react';
import { format } from 'date-fns';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { normalizeIsrc } from '@/lib/isrc';
...
        const toInsert = preview
          .map((row) => {
            const isrc = normalizeIsrc(row['ISRC']);
            const userId = isrc ? isrcMap[isrc] : null;
            if (!userId) return null;
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

  // Detail view
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
            <Button variant="outline" size="sm" onClick={exportCSV}>
              <Download className="h-4 w-4 mr-2" /> Export CSV
            </Button>
          </div>

          {/* Filters */}
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
                  onValueChange={(v) => setFilters((f) => ({ ...f, [key]: v === '_all' ? '' : v }))}
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
            <div className="px-4 py-3 border-b border-border/50 flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                {filteredEntries.length} record{filteredEntries.length !== 1 ? 's' : ''}
                {activeFilterCount > 0 ? ' (filtered)' : ''}
              </p>
            </div>
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
                    {filteredEntries.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={COLUMNS.length} className="text-center text-muted-foreground py-8">
                          No records match the current filters.
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredEntries.map((entry) => (
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
            )}
          </GlassCard>
        </div>
      </DashboardLayout>
    );
  }

  // List view
  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Reports & Analytics</h1>
          <p className="text-muted-foreground text-sm">Import and manage user revenue reports</p>
        </div>

        {/* Import Section */}
        <GlassCard className="p-5 space-y-4">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5" /> Import Report
          </h2>
          <p className="text-sm text-muted-foreground">
            Upload a CSV file with columns: {CSV_HEADERS.join(', ')}. Rows are matched to users via ISRC.
          </p>
          <div className="flex items-center gap-3">
            <Input ref={fileRef} type="file" accept=".csv,.txt" onChange={handleFileSelect} className="max-w-xs" />
          </div>

          {preview && (
            <div className="space-y-3">
              <p className="text-sm font-medium">{preview.length} rows parsed. Preview (first 5):</p>
              <div className="overflow-x-auto rounded border border-border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      {CSV_HEADERS.map((h) => (
                        <TableHead key={h} className="whitespace-nowrap text-xs">{h}</TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {preview.slice(0, 5).map((row, i) => (
                      <TableRow key={i}>
                        {CSV_HEADERS.map((h) => (
                          <TableCell key={h} className="whitespace-nowrap text-xs">{row[h] || '-'}</TableCell>
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

        {/* Imported Reports */}
        <GlassCard className="p-0 overflow-hidden">
          <div className="p-4 border-b border-border/50">
            <h2 className="text-lg font-semibold">Imported Reports</h2>
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
              {totalMonthPages > 1 && (
                <div className="flex items-center justify-between px-4 py-3 border-t border-border/50">
                  <p className="text-sm text-muted-foreground">
                    Page {monthPage + 1} of {totalMonthPages} ({monthGroups.length} months)
                  </p>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" disabled={monthPage === 0} onClick={() => setMonthPage((p) => p - 1)}>
                      <ChevronLeft className="h-4 w-4 mr-1" /> Previous
                    </Button>
                    <Button size="sm" variant="outline" disabled={monthPage >= totalMonthPages - 1} onClick={() => setMonthPage((p) => p + 1)}>
                      Next <ChevronRight className="h-4 w-4 ml-1" />
                    </Button>
                  </div>
                </div>
              )}
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
