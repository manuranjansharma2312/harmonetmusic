import { useState, useEffect } from 'react';
import { CopyButton } from '@/components/CopyButton';
import { DashboardLayout } from '@/components/DashboardLayout';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { StatusBadge } from '@/components/StatusBadge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Eye, Search, Loader2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { format } from 'date-fns';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { TablePagination, paginateItems } from '@/components/TablePagination';

export default function MyVideos() {
  const { user } = useAuth();
  const [submissions, setSubmissions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [viewSubmission, setViewSubmission] = useState<any>(null);
  const [viewValues, setViewValues] = useState<any[]>([]);
  const [viewFields, setViewFields] = useState<any[]>([]);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState<number | 'all'>(25);

  const fetchSubmissions = async () => {
    if (!user) return;
    setLoading(true);
    const { data } = await supabase
      .from('video_submissions')
      .select('*, video_forms(name)')
      .eq('user_id', user.id)
      .eq('submission_type', 'upload_video')
      .order('created_at', { ascending: false });
    setSubmissions(data || []);
    setLoading(false);
  };

  useEffect(() => { fetchSubmissions(); }, [user]);

  const handleView = async (sub: any) => {
    setViewSubmission(sub);
    const { data: values } = await supabase.from('video_submission_values').select('*').eq('submission_id', sub.id);
    setViewValues(values || []);
    if (sub.form_id) {
      const { data: fields } = await supabase.from('video_form_fields').select('*').eq('form_id', sub.form_id).order('sort_order');
      setViewFields(fields || []);
    }
  };

  const statuses = ['pending', 'processing', 'approved', 'rejected'];
  const filtered = submissions.filter(s => {
    if (statusFilter !== 'all' && s.status !== statusFilter) return false;
    if (search) {
      const form = (s as any).video_forms;
      return form?.name?.toLowerCase().includes(search.toLowerCase());
    }
    return true;
  });

  const paginated = paginateItems(filtered, page, pageSize);

  return (
    <DashboardLayout>
      <div className="p-4 md:p-6 space-y-6">
        <h1 className="text-2xl font-bold">My Videos</h1>

        <div className="flex flex-wrap gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input className="pl-9" placeholder="Search..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <Select value={statusFilter} onValueChange={v => { setStatusFilter(v); setPage(0); }}>
            <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              {statuses.map(s => <SelectItem key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        <Card>
          <CardContent className="p-0">
            {loading ? (
              <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
            ) : paginated.length === 0 ? (
              <p className="text-center py-12 text-muted-foreground">No video submissions yet</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>#</TableHead>
                    <TableHead>Form</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginated.map((sub, i) => (
                    <TableRow key={sub.id}>
                      <TableCell className="font-mono text-xs">{(pageSize === 'all' ? 0 : page * (pageSize as number)) + i + 1}</TableCell>
                      <TableCell>{(sub as any).video_forms?.name || '—'}</TableCell>
                      <TableCell><StatusBadge status={sub.status} /></TableCell>
                      <TableCell>{format(new Date(sub.created_at), 'dd MMM yyyy')}</TableCell>
                      <TableCell className="text-right">
                        <Button size="sm" variant="outline" onClick={() => handleView(sub)}>
                          <Eye className="h-3.5 w-3.5 mr-1" /> View
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
        <TablePagination totalItems={filtered.length} currentPage={page} pageSize={pageSize} onPageChange={setPage} onPageSizeChange={v => { setPageSize(v); setPage(0); }} />
      </div>

      <Dialog open={!!viewSubmission} onOpenChange={() => setViewSubmission(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Submission Details</DialogTitle></DialogHeader>
          {viewSubmission && (
            <div className="space-y-4">
              <div className="flex gap-4 flex-wrap">
                <div><span className="text-xs text-muted-foreground">Status:</span> <StatusBadge status={viewSubmission.status} /></div>
                <div><span className="text-xs text-muted-foreground">Date:</span> <span className="text-sm">{format(new Date(viewSubmission.created_at), 'dd MMM yyyy HH:mm')}</span></div>
              </div>
              {viewSubmission.rejection_reason && (
                <div className="bg-destructive/10 p-3 rounded-lg">
                  <span className="text-xs font-medium text-destructive">Rejection Reason:</span>
                  <p className="text-sm mt-1">{viewSubmission.rejection_reason}</p>
                </div>
              )}
              <div className="space-y-3">
                {viewFields.map(field => {
                  const val = viewValues.find((v: any) => v.field_id === field.id);
                  const isFile = ['file_upload', 'image_upload', 'video_upload', 'document_upload', 'drag_drop_upload'].includes(field.field_type);
                  return (
                    <div key={field.id} className="border-b pb-2">
                      <Label className="text-xs text-muted-foreground">{field.label}</Label>
                      {isFile && val?.file_url ? (
                        field.field_type === 'image_upload' ? (
                          <img src={val.file_url} alt={field.label} className="h-32 rounded mt-1 object-cover" />
                        ) : (
                          <a href={val.file_url} target="_blank" rel="noopener noreferrer" className="text-sm text-primary underline block mt-1">View File</a>
                        )
                      ) : field.field_type === 'link' && val?.text_value ? (
                        <div className="flex items-center gap-1 mt-1">
                          <a href={val.text_value} target="_blank" rel="noopener noreferrer" className="text-sm text-primary underline truncate">{val.text_value}</a>
                          <CopyButton value={val.text_value} />
                        </div>
                      ) : (
                        <div className="flex items-center gap-1 mt-1">
                          <p className="text-sm">{val?.text_value || '—'}</p>
                          {val?.text_value && <CopyButton value={val.text_value} />}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
