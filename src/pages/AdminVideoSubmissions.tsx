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
import { Video, Tv, Eye, Search, Upload, Pencil, Check, X, Download, Trash2, CheckSquare, Image as ImageIcon, Film as VideoIcon, FileText as FileIcon } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { format } from 'date-fns';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { TablePagination } from '@/components/TablePagination';
import { Checkbox } from '@/components/ui/checkbox';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { ConfirmDialog } from '@/components/ConfirmDialog';

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
  const [replacePreview, setReplacePreview] = useState<{ fieldId: string; file: File; previewUrl: string; valueId: string } | null>(null);
  const [uploading, setUploading] = useState(false);

  // Edit mode state
  const [editMode, setEditMode] = useState(false);
  const [editValues, setEditValues] = useState<Record<string, string>>({});
  const [editSaving, setEditSaving] = useState(false);

  // Bulk selection state
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkRejectDialog, setBulkRejectDialog] = useState(false);
  const [bulkRejectReason, setBulkRejectReason] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState(false);

  const fetchSubmissions = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('video_submissions')
      .select('*, video_forms(name, form_type)')
      .order('created_at', { ascending: false });
    setSubmissions(data || []);

    const userIds = [...new Set((data || []).map((s: any) => s.user_id))];
    if (userIds.length > 0) {
      const [{ data: profs }, { data: subLabels }] = await Promise.all([
        supabase.from('profiles').select('user_id, display_id, legal_name, email, user_type, record_label_name, artist_name').in('user_id', userIds),
        supabase.from('sub_labels').select('sub_user_id, parent_user_id, status').in('sub_user_id', userIds).eq('status', 'active'),
      ]);
      const map: Record<string, any> = {};
      (profs || []).forEach((p: any) => { map[p.user_id] = p; });
      setProfiles(map);

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

  // Clear selection when tab changes
  useEffect(() => { setSelected(new Set()); }, [tab]);

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

  // Bulk status change
  const handleBulkStatusChange = async (status: string) => {
    if (selected.size === 0) return;
    if (status === 'rejected') {
      setBulkRejectDialog(true);
      return;
    }
    const ids = [...selected];
    const { error } = await supabase.from('video_submissions').update({ status, rejection_reason: null }).in('id', ids);
    if (error) toast.error(error.message);
    else { toast.success(`${ids.length} submission(s) updated to ${status}`); setSelected(new Set()); fetchSubmissions(); }
  };

  const handleBulkReject = async () => {
    const ids = [...selected];
    const { error } = await supabase.from('video_submissions').update({
      status: 'rejected', rejection_reason: bulkRejectReason,
    }).in('id', ids);
    if (error) toast.error(error.message);
    else { toast.success(`${ids.length} submission(s) rejected`); setSelected(new Set()); fetchSubmissions(); }
    setBulkRejectDialog(false);
    setBulkRejectReason('');
  };

  // Bulk delete
  const handleBulkDelete = async () => {
    const ids = [...selected];
    // Delete values first, then submissions
    await supabase.from('video_submission_values').delete().in('submission_id', ids);
    const { error } = await supabase.from('video_submissions').delete().in('id', ids);
    if (error) toast.error(error.message);
    else { toast.success(`${ids.length} submission(s) deleted`); setSelected(new Set()); fetchSubmissions(); }
    setDeleteConfirm(false);
  };

  const openSubmission = async (sub: any, isEdit: boolean) => {
    setViewSubmission(sub);
    setEditMode(isEdit);
    const { data: values } = await supabase.from('video_submission_values').select('*').eq('submission_id', sub.id);
    setViewValues(values || []);
    if (isEdit) {
      const ev: Record<string, string> = {};
      (values || []).forEach((v: any) => { ev[v.field_id] = v.text_value || ''; });
      setEditValues(ev);
    }
    if (sub.form_id) {
      const { data: fields } = await supabase.from('video_form_fields').select('*').eq('form_id', sub.form_id).order('sort_order');
      setViewFields(fields || []);
    }
  };

  const handleSaveAllEdits = async () => {
    setEditSaving(true);
    try {
      const updates = Object.entries(editValues).map(([fieldId, textValue]) => {
        const val = viewValues.find(v => v.field_id === fieldId);
        if (!val) return null;
        return supabase.from('video_submission_values').update({ text_value: textValue }).eq('id', val.id);
      }).filter(Boolean);
      await Promise.all(updates);
      toast.success('All fields saved successfully');
      setViewValues(prev => prev.map(v => editValues[v.field_id] !== undefined ? { ...v, text_value: editValues[v.field_id] } : v));
      setEditMode(false);
    } catch (err: any) {
      toast.error(err.message || 'Failed to save');
    } finally {
      setEditSaving(false);
    }
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

  // Export CSV — uses selected if any, otherwise all filtered
  const handleExport = async (onlySelected = false) => {
    const toExport = onlySelected && selected.size > 0 ? filtered.filter(s => selected.has(s.id)) : filtered;
    if (toExport.length === 0) { toast.error('No data to export'); return; }

    const formIds = [...new Set(toExport.map(s => s.form_id).filter(Boolean))];
    const allFields: any[] = [];
    for (const fid of formIds) {
      const { data } = await supabase.from('video_form_fields').select('*').eq('form_id', fid).order('sort_order');
      if (data) allFields.push(...data);
    }

    const subIds = toExport.map(s => s.id);
    const allValues: any[] = [];
    for (let i = 0; i < subIds.length; i += 50) {
      const chunk = subIds.slice(i, i + 50);
      const { data } = await supabase.from('video_submission_values').select('*').in('submission_id', chunk);
      if (data) allValues.push(...data);
    }

    const fieldMap = new Map<string, string>();
    allFields.forEach(f => { if (!fieldMap.has(f.id)) fieldMap.set(f.id, f.label); });
    const fieldLabels = [...fieldMap.entries()];

    const headers = ['User', 'User ID', 'Email', 'Form', 'Status', 'Rejection Reason', 'Date', ...fieldLabels.map(([, l]) => l)];
    const rows = toExport.map(sub => {
      const profile = profiles[sub.user_id];
      const userName = profile?.user_type === 'record_label' ? profile?.record_label_name : profile?.artist_name || profile?.legal_name || 'Unknown';
      const subValues = allValues.filter(v => v.submission_id === sub.id);
      const fieldCols = fieldLabels.map(([fid]) => {
        const v = subValues.find(sv => sv.field_id === fid);
        return v?.text_value || v?.file_url || '';
      });
      return [
        userName,
        profile?.display_id || '',
        profile?.email || '',
        (sub as any).video_forms?.name || '',
        sub.status,
        sub.rejection_reason || '',
        format(new Date(sub.created_at), 'dd MMM yyyy'),
        ...fieldCols,
      ];
    });

    const csvContent = [headers, ...rows].map(row =>
      row.map((cell: string) => `"${String(cell).replace(/"/g, '""')}"`).join(',')
    ).join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `video-submissions-${tab}-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    toast.success(`Exported ${toExport.length} submission(s)`);
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

  const allPageSelected = paginated.length > 0 && paginated.every(s => selected.has(s.id));
  const someSelected = selected.size > 0;

  const toggleSelectAll = () => {
    if (allPageSelected) {
      const next = new Set(selected);
      paginated.forEach(s => next.delete(s.id));
      setSelected(next);
    } else {
      const next = new Set(selected);
      paginated.forEach(s => next.add(s.id));
      setSelected(next);
    }
  };

  const toggleSelect = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id); else next.add(id);
    setSelected(next);
  };

  const isFileField = (type: string) => ['file_upload', 'image_upload', 'video_upload', 'document_upload', 'drag_drop_upload'].includes(type);

  const renderFieldValue = (field: any, val: any, isEditing: boolean) => {
    const isFile = isFileField(field.field_type);

    if (isFile && val?.file_url) {
      return (
        <div className="mt-1 space-y-2">
          {field.field_type === 'image_upload' ? (
            <img src={val.file_url} alt={field.label} className="h-32 rounded object-cover" />
          ) : field.field_type === 'video_upload' ? (
            <video src={val.file_url} controls className="h-32 rounded" />
          ) : (
            <a href={val.file_url} target="_blank" rel="noopener noreferrer" className="text-sm text-primary underline block">View File</a>
          )}
          {(editMode || isEditing) && (
            <label className="cursor-pointer">
              <input type="file" className="hidden" onChange={e => {
                const f = e.target.files?.[0];
                if (f && val) handleFileSelect(field.id, val.id, f);
              }} />
              <span className="inline-flex items-center gap-1 text-xs text-primary hover:underline cursor-pointer">
                <Upload className="h-3 w-3" /> Replace File
              </span>
            </label>
          )}
        </div>
      );
    }

    if (isFile && !val?.file_url) {
      const placeholderIcon = field.field_type === 'image_upload'
        ? <ImageIcon className="h-8 w-8 text-muted-foreground/50" />
        : field.field_type === 'video_upload'
        ? <VideoIcon className="h-8 w-8 text-muted-foreground/50" />
        : <FileIcon className="h-8 w-8 text-muted-foreground/50" />;
      return (
        <div className="mt-1 h-32 rounded-lg border border-dashed border-border bg-muted/30 flex flex-col items-center justify-center gap-2">
          {placeholderIcon}
          <span className="text-xs text-muted-foreground">No file uploaded</span>
        </div>
      );
    }

    if (isEditing) {
      return (
        <Textarea
          value={editValues[field.id] ?? val?.text_value ?? ''}
          onChange={e => setEditValues(prev => ({ ...prev, [field.id]: e.target.value }))}
          className="mt-1 text-sm min-h-[36px]"
          rows={field.field_type === 'textarea' ? 3 : 1}
        />
      );
    }

    return (
      <div className="flex items-center gap-2 mt-1 group">
        <p className="text-sm flex-1">{val?.text_value || '—'}</p>
        {val?.text_value && <CopyButton value={val.text_value} />}
      </div>
    );
  };

  return (
    <DashboardLayout>
      <div className="p-4 md:p-6 space-y-6">
        <h1 className="text-2xl font-bold">Video Submissions</h1>

        <Tabs value={tab} onValueChange={v => { setTab(v); setPage(0); setStatusFilter('all'); }}>
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

              {/* Bulk Actions Dropdown */}
              {someSelected && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline">
                      <CheckSquare className="h-4 w-4 mr-1" /> {selected.size} Selected
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    {statuses.map(s => (
                      <DropdownMenuItem key={s} onClick={() => handleBulkStatusChange(s)}>
                        Set {s.charAt(0).toUpperCase() + s.slice(1)}
                      </DropdownMenuItem>
                    ))}
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => handleExport(true)}>
                      <Download className="h-4 w-4 mr-2" /> Export Selected
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => setDeleteConfirm(true)}>
                      <Trash2 className="h-4 w-4 mr-2" /> Delete Selected
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}

              <Button variant="outline" onClick={() => handleExport(false)} disabled={filtered.length === 0}>
                <Download className="h-4 w-4 mr-1" /> Export All
              </Button>
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
                        <TableHead className="w-10">
                          <Checkbox checked={allPageSelected} onCheckedChange={toggleSelectAll} />
                        </TableHead>
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
                          <TableRow key={sub.id} data-state={selected.has(sub.id) ? 'selected' : undefined}>
                            <TableCell>
                              <Checkbox checked={selected.has(sub.id)} onCheckedChange={() => toggleSelect(sub.id)} />
                            </TableCell>
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
                                <Button size="sm" variant="outline" onClick={() => openSubmission(sub, false)}>
                                  <Eye className="h-3.5 w-3.5 mr-1" /> View
                                </Button>
                                <Button size="sm" variant="outline" onClick={() => openSubmission(sub, true)}>
                                  <Pencil className="h-3.5 w-3.5 mr-1" /> Edit
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

      {/* View / Edit Submission Dialog */}
      <Dialog open={!!viewSubmission} onOpenChange={() => { setViewSubmission(null); setEditMode(false); }}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between">
              <span>{editMode ? 'Edit Submission' : 'Submission Details'}</span>
              {!editMode && viewSubmission && (
                <Button size="sm" variant="outline" onClick={() => {
                  const ev: Record<string, string> = {};
                  viewValues.forEach((v: any) => { ev[v.field_id] = v.text_value || ''; });
                  setEditValues(ev);
                  setEditMode(true);
                }}>
                  <Pencil className="h-3.5 w-3.5 mr-1" /> Edit
                </Button>
              )}
            </DialogTitle>
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
                  return (
                    <div key={field.id} className="border-b pb-2">
                      <Label className="text-xs text-muted-foreground">{field.label}</Label>
                      {field.description && <p className="text-xs text-muted-foreground/70">{field.description}</p>}
                      {renderFieldValue(field, val, editMode)}
                    </div>
                  );
                })}
              </div>

              {/* Status change */}
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

              {editMode && (
                <div className="flex justify-end gap-2 pt-2 border-t">
                  <Button variant="outline" onClick={() => setEditMode(false)}>Cancel</Button>
                  <Button onClick={handleSaveAllEdits} disabled={editSaving}>
                    <Check className="h-4 w-4 mr-1" /> {editSaving ? 'Saving...' : 'Save All Changes'}
                  </Button>
                </div>
              )}
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

      {/* Single Reject Dialog */}
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

      {/* Bulk Reject Dialog */}
      <Dialog open={bulkRejectDialog} onOpenChange={() => setBulkRejectDialog(false)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Bulk Rejection Reason</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">This will reject {selected.size} selected submission(s).</p>
          <Textarea value={bulkRejectReason} onChange={e => setBulkRejectReason(e.target.value)} placeholder="Enter reason for rejection..." rows={4} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setBulkRejectDialog(false)}>Cancel</Button>
            <Button variant="destructive" onClick={handleBulkReject} disabled={!bulkRejectReason.trim()}>Reject {selected.size} Submission(s)</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      {deleteConfirm && (
        <ConfirmDialog
          title="Delete Submissions"
          message={`Are you sure you want to delete ${selected.size} selected submission(s)? This action cannot be undone.`}
          onConfirm={handleBulkDelete}
          onCancel={() => setDeleteConfirm(false)}
        />
      )}
    </DashboardLayout>
  );
}
