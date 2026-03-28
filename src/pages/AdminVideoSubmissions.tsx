import { useState, useEffect } from 'react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { CopyButton } from '@/components/CopyButton';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { StatusBadge } from '@/components/StatusBadge';
import { toast } from 'sonner';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Video, Tv, Eye, Search, Upload, Pencil, Check, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { format } from 'date-fns';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { TablePagination } from '@/components/TablePagination';

const VIDEO_STATUSES = ['pending', 'processing', 'approved', 'rejected'];
const CHANNEL_STATUSES = ['pending', 'approved', 'rejected', 'suspended'];

export default function AdminVideoSubmissions() {
  const [submissions, setSubmissions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('upload_video');
  const [statusFilter, setStatusFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [profiles, setProfiles] = useState<Record<string, any>>({});
  const [subLabelMap, setSubLabelMap] = useState<Record<string, any>>({});
  const [viewSubmission, setViewSubmission] = useState<any>(null);
  const [viewValues, setViewValues] = useState<any[]>([]);
  const [viewFields, setViewFields] = useState<any[]>([]);
  const [rejectDialog, setRejectDialog] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState<number | 'all'>(25);
  const [editingField, setEditingField] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [replacePreview, setReplacePreview] = useState<{ fieldId: string; file: File; previewUrl: string; valueId: string } | null>(null);
  const [uploading, setUploading] = useState(false);

  const fetchSubmissions = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('video_submissions')
      .select('*, video_forms(name, form_type)')
      .order('created_at', { ascending: false });
    setSubmissions(data || []);

    // Fetch profiles
    const userIds = [...new Set((data || []).map((s: any) => s.user_id))];
    if (userIds.length > 0) {
      const [{ data: profs }, { data: subLabels }] = await Promise.all([
        supabase.from('profiles').select('user_id, display_id, legal_name, email, user_type, record_label_name, artist_name').in('user_id', userIds),
        supabase.from('sub_labels').select('sub_user_id, parent_user_id, status').in('sub_user_id', userIds).eq('status', 'active'),
      ]);
      const map: Record<string, any> = {};
      (profs || []).forEach((p: any) => { map[p.user_id] = p; });
      setProfiles(map);

      // Fetch parent profiles for sub-labels
      const parentIds = [...new Set((subLabels || []).map((s: any) => s.parent_user_id))];
      const slMap: Record<string, any> = {};
      if (parentIds.length > 0) {
        const { data: parentProfs } = await supabase.from('profiles').select('user_id, display_id, legal_name, record_label_name, artist_name').in('user_id', parentIds);
        const parentMap: Record<string, any> = {};
        (parentProfs || []).forEach((p: any) => { parentMap[p.user_id] = p; });
        (subLabels || []).forEach((sl: any) => {
          slMap[sl.sub_user_id] = parentMap[sl.parent_user_id];
        });
      }
      setSubLabelMap(slMap);
    }
    setLoading(false);
  };

  useEffect(() => { fetchSubmissions(); }, []);

  const handleStatusChange = async (id: string, status: string) => {
    if (status === 'rejected') {
      setRejectDialog(id);
      return;
    }
    const { error } = await supabase.from('video_submissions').update({ status, rejection_reason: null }).eq('id', id);
    if (error) toast.error(error.message);
    else { toast.success(`Status updated to ${status}`); fetchSubmissions(); }
  };

  const handleReject = async () => {
    if (!rejectDialog) return;
    const { error } = await supabase.from('video_submissions').update({
      status: 'rejected', rejection_reason: rejectionReason,
    }).eq('id', rejectDialog);
    if (error) toast.error(error.message);
    else { toast.success('Submission rejected'); fetchSubmissions(); }
    setRejectDialog(null);
    setRejectionReason('');
  };

  const handleView = async (sub: any) => {
    setViewSubmission(sub);
    const { data: values } = await supabase.from('video_submission_values').select('*').eq('submission_id', sub.id);
    setViewValues(values || []);
    if (sub.form_id) {
      const { data: fields } = await supabase.from('video_form_fields').select('*').eq('form_id', sub.form_id).order('sort_order');
      setViewFields(fields || []);
    }
  };

  const handleSaveTextField = async (valueId: string) => {
    const { error } = await supabase.from('video_submission_values').update({ text_value: editValue }).eq('id', valueId);
    if (error) toast.error(error.message);
    else {
      toast.success('Field updated');
      setViewValues(prev => prev.map(v => v.id === valueId ? { ...v, text_value: editValue } : v));
    }
    setEditingField(null);
  };

  const handleFileSelect = (fieldId: string, valueId: string, file: File) => {
    const previewUrl = URL.createObjectURL(file);
    setReplacePreview({ fieldId, file, previewUrl, valueId });
  };

  const handleConfirmReplace = async () => {
    if (!replacePreview || !viewSubmission) return;
    setUploading(true);
    try {
      const ext = replacePreview.file.name.split('.').pop();
      const path = `${viewSubmission.user_id}/${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from('video-uploads').upload(path, replacePreview.file, { upsert: true });
      if (upErr) throw upErr;
      const { data: pub } = supabase.storage.from('video-uploads').getPublicUrl(path);
      const newUrl = pub.publicUrl;
      const { error } = await supabase.from('video_submission_values').update({ file_url: newUrl }).eq('id', replacePreview.valueId);
      if (error) throw error;
      toast.success('File replaced successfully');
      setViewValues(prev => prev.map(v => v.id === replacePreview.valueId ? { ...v, file_url: newUrl } : v));
    } catch (err: any) {
      toast.error(err.message || 'Failed to replace file');
    } finally {
      setUploading(false);
      if (replacePreview.previewUrl) URL.revokeObjectURL(replacePreview.previewUrl);
      setReplacePreview(null);
    }
  };


  const statuses = tab === 'upload_video' ? VIDEO_STATUSES : CHANNEL_STATUSES;
  const effectivePageSize = pageSize === 'all' ? 9999 : pageSize;
  const filtered = submissions.filter(s => {
    if (s.submission_type !== tab) return false;
    if (statusFilter !== 'all' && s.status !== statusFilter) return false;
    if (search) {
      const profile = profiles[s.user_id];
      const q = search.toLowerCase();
      if (!profile) return false;
      return profile.legal_name?.toLowerCase().includes(q) || profile.email?.toLowerCase().includes(q) || String(profile.display_id).includes(q);
    }
    return true;
  });

  const paginated = pageSize === 'all' ? filtered : filtered.slice(page * effectivePageSize, (page + 1) * effectivePageSize);

  return (
    <DashboardLayout>
      <div className="p-4 md:p-6 space-y-6">
        <h1 className="text-2xl font-bold">Video Submissions</h1>

        <Tabs value={tab} onValueChange={v => { setTab(v); setPage(1); setStatusFilter('all'); }}>
          <TabsList>
            <TabsTrigger value="upload_video" className="gap-2"><Video className="h-4 w-4" /> Videos</TabsTrigger>
            <TabsTrigger value="vevo_channel" className="gap-2"><Tv className="h-4 w-4" /> Vevo Channels</TabsTrigger>
          </TabsList>

          <TabsContent value={tab}>
            <div className="flex flex-wrap gap-3 mb-4">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input className="pl-9" placeholder="Search by name, email, ID..." value={search} onChange={e => setSearch(e.target.value)} />
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
                  <p className="text-center py-8 text-muted-foreground">Loading...</p>
                ) : paginated.length === 0 ? (
                  <p className="text-center py-8 text-muted-foreground">No submissions found</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>User</TableHead>
                        <TableHead>Form</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paginated.map(sub => {
                        const profile = profiles[sub.user_id];
                        return (
                          <TableRow key={sub.id}>
                            <TableCell>
                              <div className="text-sm font-medium">
                                {profile?.user_type === 'record_label' ? profile?.record_label_name : profile?.artist_name || profile?.legal_name || 'Unknown'}
                              </div>
                              <div className="text-xs text-muted-foreground">#{profile?.display_id}</div>
                              {subLabelMap[sub.user_id] && (
                                <div className="text-xs text-muted-foreground mt-0.5">
                                  ↳ Under: <span className="font-medium">{subLabelMap[sub.user_id]?.record_label_name || subLabelMap[sub.user_id]?.legal_name}</span>
                                  <span className="ml-1">#{subLabelMap[sub.user_id]?.display_id}</span>
                                </div>
                              )}
                            </TableCell>
                            <TableCell>{(sub as any).video_forms?.name || '—'}</TableCell>
                            <TableCell><StatusBadge status={sub.status} /></TableCell>
                            <TableCell>{format(new Date(sub.created_at), 'dd MMM yyyy')}</TableCell>
                            <TableCell className="text-right">
                              <div className="flex justify-end gap-1">
                                <Button size="sm" variant="outline" onClick={() => handleView(sub)}>
                                  <Eye className="h-3.5 w-3.5 mr-1" /> View
                                </Button>
                                <Select value={sub.status} onValueChange={v => handleStatusChange(sub.id, v)}>
                                  <SelectTrigger className="h-8 w-[120px] text-xs"><SelectValue /></SelectTrigger>
                                  <SelectContent>
                                    {statuses.map(s => <SelectItem key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</SelectItem>)}
                                  </SelectContent>
                                </Select>
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
            <TablePagination totalItems={filtered.length} currentPage={page} pageSize={pageSize} onPageChange={setPage} onPageSizeChange={v => { setPageSize(v); setPage(0); }} />
          </TabsContent>
        </Tabs>
      </div>

      {/* View Submission Dialog */}
      <Dialog open={!!viewSubmission} onOpenChange={() => setViewSubmission(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Submission Details</DialogTitle>
          </DialogHeader>
          {viewSubmission && (() => {
            const vProfile = profiles[viewSubmission.user_id];
            const vParent = subLabelMap[viewSubmission.user_id];
            const userName = vProfile?.user_type === 'record_label' ? vProfile?.record_label_name : vProfile?.artist_name || vProfile?.legal_name || 'Unknown';
            return (
            <div className="space-y-4">
              <div className="bg-muted/40 p-3 rounded-lg space-y-1">
                <div className="text-sm font-medium">{userName} <span className="text-muted-foreground">#{vProfile?.display_id}</span></div>
                <div className="text-xs text-muted-foreground">{vProfile?.email}</div>
                {vParent && (
                  <div className="text-xs text-muted-foreground">↳ Under: <span className="font-medium">{vParent?.record_label_name || vParent?.legal_name}</span> #{vParent?.display_id}</div>
                )}
              </div>
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
                  const val = viewValues.find(v => v.field_id === field.id);
                  const isFile = ['file_upload', 'image_upload', 'video_upload', 'document_upload', 'drag_drop_upload'].includes(field.field_type);
                  const isEditing = editingField === field.id;
                  return (
                    <div key={field.id} className="border-b pb-2">
                      <Label className="text-xs text-muted-foreground">{field.label}</Label>
                      {isFile && val?.file_url ? (
                        <div className="mt-1 space-y-2">
                          {field.field_type === 'image_upload' ? (
                            <img src={val.file_url} alt={field.label} className="h-32 rounded object-cover" />
                          ) : field.field_type === 'video_upload' ? (
                            <video src={val.file_url} controls className="h-32 rounded" />
                          ) : (
                            <a href={val.file_url} target="_blank" rel="noopener noreferrer" className="text-sm text-primary underline block">View File</a>
                          )}
                          <div>
                            <label className="cursor-pointer">
                              <input type="file" className="hidden" onChange={e => {
                                const f = e.target.files?.[0];
                                if (f && val) handleFileSelect(field.id, val.id, f);
                              }} />
                              <span className="inline-flex items-center gap-1 text-xs text-primary hover:underline cursor-pointer">
                                <Upload className="h-3 w-3" /> Replace File
                              </span>
                            </label>
                          </div>
                        </div>
                      ) : isEditing && val ? (
                        <div className="flex items-center gap-2 mt-1">
                          <Input value={editValue} onChange={e => setEditValue(e.target.value)} className="h-8 text-sm" />
                          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => handleSaveTextField(val.id)}>
                            <Check className="h-3.5 w-3.5 text-green-600" />
                          </Button>
                          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setEditingField(null)}>
                            <X className="h-3.5 w-3.5 text-destructive" />
                          </Button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 mt-1 group">
                          <p className="text-sm flex-1">{val?.text_value || '—'}</p>
                          {val?.text_value && <CopyButton value={val.text_value} />}
                          {val && (
                            <Button size="icon" variant="ghost" className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => { setEditingField(field.id); setEditValue(val.text_value || ''); }}>
                              <Pencil className="h-3 w-3" />
                            </Button>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Inline status change */}
              <div className="pt-2 border-t flex items-center gap-3">
                <Label className="text-xs text-muted-foreground">Change Status:</Label>
                <Select value={viewSubmission.status} onValueChange={v => {
                  if (v === 'rejected') { setRejectDialog(viewSubmission.id); return; }
                  handleStatusChange(viewSubmission.id, v);
                  setViewSubmission({ ...viewSubmission, status: v });
                }}>
                  <SelectTrigger className="h-8 w-[140px] text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(viewSubmission.submission_type === 'upload_video' ? VIDEO_STATUSES : CHANNEL_STATUSES).map(s => (
                      <SelectItem key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            );
          })()}
        </DialogContent>
      </Dialog>

      {/* File Replace Preview Dialog */}
      <Dialog open={!!replacePreview} onOpenChange={() => { if (replacePreview?.previewUrl) URL.revokeObjectURL(replacePreview.previewUrl); setReplacePreview(null); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Confirm File Replacement</DialogTitle></DialogHeader>
          {replacePreview && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">Are you sure you want to replace this file?</p>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs text-muted-foreground mb-1 block">Current</Label>
                  {(() => {
                    const val = viewValues.find(v => v.id === replacePreview.valueId);
                    const field = viewFields.find(f => f.id === replacePreview.fieldId);
                    if (field?.field_type === 'image_upload' && val?.file_url) return <img src={val.file_url} className="h-28 rounded object-cover w-full" />;
                    return <div className="h-28 rounded bg-muted flex items-center justify-center text-xs text-muted-foreground">Current file</div>;
                  })()}
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground mb-1 block">New</Label>
                  {replacePreview.file.type.startsWith('image/') ? (
                    <img src={replacePreview.previewUrl} className="h-28 rounded object-cover w-full" />
                  ) : (
                    <div className="h-28 rounded bg-muted flex items-center justify-center text-xs text-muted-foreground">{replacePreview.file.name}</div>
                  )}
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => { if (replacePreview?.previewUrl) URL.revokeObjectURL(replacePreview.previewUrl); setReplacePreview(null); }}>Cancel</Button>
            <Button onClick={handleConfirmReplace} disabled={uploading}>{uploading ? 'Uploading...' : 'Confirm Replace'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reject Dialog */}
      <Dialog open={!!rejectDialog} onOpenChange={() => setRejectDialog(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Rejection Reason</DialogTitle></DialogHeader>
          <Textarea value={rejectionReason} onChange={e => setRejectionReason(e.target.value)} placeholder="Enter reason for rejection..." rows={4} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectDialog(null)}>Cancel</Button>
            <Button variant="destructive" onClick={handleReject} disabled={!rejectionReason.trim()}>Reject</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
