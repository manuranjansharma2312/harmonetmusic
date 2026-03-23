import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { DashboardLayout } from '@/components/DashboardLayout';
import { GlassCard } from '@/components/GlassCard';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from 'sonner';
import { Upload, Trash2, FileSpreadsheet } from 'lucide-react';
import { format } from 'date-fns';
import { ConfirmDialog } from '@/components/ConfirmDialog';

const CSV_HEADERS = [
  'Reporting Month', 'Store', 'Sales Type', 'Country', 'Label',
  'C Line', 'P Line', 'Track', 'Artist', 'ISRC', 'UPC',
  'Currency', 'Streams', 'Downloads', 'Net Generated Revenue',
];

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
      setMonthGroups(Object.values(groups).sort((a, b) => b.month.localeCompare(a.month)));
    }
    setLoading(false);
  };

  useEffect(() => { fetchMonths(); }, []);

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

      const toInsert = preview
        .map((row) => {
          const isrc = (row['ISRC'] || '').toUpperCase();
          const userId = isrcMap[isrc];
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
            isrc: row['ISRC'] || null,
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

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Reports & Analytics</h1>
          <p className="text-muted-foreground text-sm">Import and manage user revenue reports</p>
        </div>

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

        <GlassCard className="p-0 overflow-hidden">
          <div className="p-4 border-b border-border/50">
            <h2 className="text-lg font-semibold">Imported Reports</h2>
          </div>
          {loading ? (
            <p className="p-6 text-center text-muted-foreground">Loading...</p>
          ) : monthGroups.length === 0 ? (
            <p className="p-6 text-center text-muted-foreground">No reports imported yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Reporting Month</TableHead>
                  <TableHead>Total Records</TableHead>
                  <TableHead>Last Imported</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {monthGroups.map((g) => (
                  <TableRow key={g.month}>
                    <TableCell className="font-medium">{g.month}</TableCell>
                    <TableCell>{g.count}</TableCell>
                    <TableCell>{format(new Date(g.latestImport), 'dd MMM yyyy, hh:mm a')}</TableCell>
                    <TableCell className="text-right">
                      <Button size="sm" variant="destructive" onClick={() => setDeleteMonth(g.month)}>
                        <Trash2 className="h-4 w-4 mr-1" /> Delete
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
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
