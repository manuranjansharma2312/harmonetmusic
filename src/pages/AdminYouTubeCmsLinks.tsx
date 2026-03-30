import { useState, useEffect } from 'react';
import { useTeamPermissions } from '@/hooks/useTeamPermissions';
import { DashboardLayout } from '@/components/DashboardLayout';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { StatusBadge } from '@/components/StatusBadge';
import { GlassCard } from '@/components/GlassCard';
import { CopyButton } from '@/components/CopyButton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { RejectReasonModal } from '@/components/RejectReasonModal';
import { TablePagination } from '@/components/TablePagination';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { Loader2, Youtube, ExternalLink, FileText, CalendarIcon, Pencil, Trash2, Download, Eye, Image as ImageIcon, FileX, ImageOff } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

interface CmsLink {
  id: string;
  user_id: string;
  channel_name: string;
  channel_url: string;
  is_monetized: boolean;
  noc_file_url: string | null;
  yt_reports_screenshot_url: string | null;
  status: string;
  rejection_reason: string | null;
  cms_linked_date: string | null;
  cms_company: string | null;
  cut_percent: number;
  created_at: string;
  updated_at: string;
}

interface Profile {
  user_id: string;
  legal_name: string;
  email: string;
  display_id: number;
  user_type: string;
  artist_name: string | null;
  record_label_name: string | null;
}

interface SubLabel {
  sub_user_id: string;
  parent_user_id: string;
  sub_label_name: string | null;
  parent_label_name: string | null;
}

const STATUSES = ['pending_review', 'reviewing', 'linked', 'rejected'] as const;
const STATUS_MAP: Record<string, string> = {
  pending_review: 'pending',
  reviewing: 'processing',
  linked: 'approved',
  rejected: 'rejected',
};
const STATUS_LABEL: Record<string, string> = {
  pending_review: 'Pending Review',
  reviewing: 'Reviewing',
  linked: 'Linked',
  rejected: 'Rejected',
};

export default function AdminYouTubeCmsLinks() {
  const { isTeam, canDelete } = useTeamPermissions();
  const [links, setLinks] = useState<CmsLink[]>([]);
  const [profiles, setProfiles] = useState<Record<string, Profile>>({});
  const [subLabels, setSubLabels] = useState<SubLabel[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState('all');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState<number | 'all'>(20);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  // Edit modal
  const [editItem, setEditItem] = useState<CmsLink | null>(null);
  const [editChannelName, setEditChannelName] = useState('');
  const [editChannelUrl, setEditChannelUrl] = useState('');
  const [editMonetized, setEditMonetized] = useState(false);
  const [editStatus, setEditStatus] = useState('');
  const [editCmsCompany, setEditCmsCompany] = useState('');
  const [editCmsDate, setEditCmsDate] = useState<Date | undefined>();
  const [saving, setSaving] = useState(false);
  const [editCutPercent, setEditCutPercent] = useState('0');

  // View modal
  const [viewItem, setViewItem] = useState<CmsLink | null>(null);

  // Reject & Delete modals
  const [rejectItem, setRejectItem] = useState<CmsLink | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{ ids: string[] } | null>(null);

  // Bulk status change
  const [bulkStatus, setBulkStatus] = useState('');

  const fetchAll = async () => {
    const { data, error } = await supabase
      .from('youtube_cms_links' as any)
      .select('*')
      .order('created_at', { ascending: false });
    if (!error && data) {
      const items = data as any as CmsLink[];
      setLinks(items);
      const userIds = [...new Set(items.map(i => i.user_id))];
      if (userIds.length) {
        const [{ data: profs }, { data: subs }] = await Promise.all([
          supabase.from('profiles').select('user_id, legal_name, email, display_id, user_type, artist_name, record_label_name').in('user_id', userIds),
          supabase.from('sub_labels' as any).select('sub_user_id, parent_user_id, sub_label_name, parent_label_name').in('sub_user_id', userIds).eq('status', 'active'),
        ]);
        if (profs) {
          const map: Record<string, Profile> = {};
          profs.forEach((p: any) => { map[p.user_id] = p; });
          setProfiles(map);
        }
        if (subs) {
          setSubLabels(subs as any as SubLabel[]);
          // Also fetch parent profiles
          const parentIds = [...new Set((subs as any[]).map(s => s.parent_user_id))].filter(id => !profs?.find((p: any) => p.user_id === id));
          if (parentIds.length) {
            const { data: parentProfs } = await supabase.from('profiles').select('user_id, legal_name, email, display_id, user_type, artist_name, record_label_name').in('user_id', parentIds);
            if (parentProfs) {
              setProfiles(prev => {
                const map = { ...prev };
                parentProfs.forEach((p: any) => { map[p.user_id] = p; });
                return map;
              });
            }
          }
        }
      }
    }
    setLoading(false);
  };

  useEffect(() => { fetchAll(); }, []);

  const filtered = links.filter(l => {
    if (filterStatus !== 'all' && l.status !== filterStatus) return false;
    if (search) {
      const s = search.toLowerCase();
      const prof = profiles[l.user_id];
      if (
        !l.channel_name.toLowerCase().includes(s) &&
        !l.channel_url.toLowerCase().includes(s) &&
        !(prof?.legal_name?.toLowerCase().includes(s)) &&
        !(prof?.email?.toLowerCase().includes(s)) &&
        !(prof?.display_id?.toString().includes(s))
      ) return false;
    }
    return true;
  });

  const effectivePerPage = perPage === 'all' ? filtered.length : perPage;
  const paged = perPage === 'all' ? filtered : filtered.slice((page - 1) * effectivePerPage, page * effectivePerPage);

  const toggleSelect = (id: string) => {
    setSelected(prev => {
      const n = new Set(prev);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  };

  const toggleSelectAll = () => {
    if (selected.size === paged.length) setSelected(new Set());
    else setSelected(new Set(paged.map(l => l.id)));
  };

  const getSubmittedBy = (userId: string) => {
    const prof = profiles[userId];
    if (!prof) return { name: '—', sub: '', email: '', displayId: undefined as number | undefined };
    const subLabel = subLabels.find(s => s.sub_user_id === userId);
    const name = subLabel?.sub_label_name || (prof.user_type === 'artist' ? (prof.artist_name || prof.legal_name) : (prof.record_label_name || prof.legal_name));
    let sub = '';
    if (subLabel) {
      const parent = profiles[subLabel.parent_user_id];
      const parentName = subLabel.parent_label_name || (parent ? (parent.record_label_name || parent.legal_name) : 'Parent Label');
      sub = `${subLabel.sub_label_name || name} ↳ Under: ${parentName}`;
    }
    return { name, sub, email: prof.email, displayId: prof.display_id };
  };

  const openEdit = (item: CmsLink) => {
    setEditItem(item);
    setEditChannelName(item.channel_name);
    setEditChannelUrl(item.channel_url);
    setEditMonetized(item.is_monetized);
    setEditStatus(item.status);
    setEditCmsCompany(item.cms_company || '');
    setEditCmsDate(item.cms_linked_date ? new Date(item.cms_linked_date) : undefined);
    setEditCutPercent(String(item.cut_percent || 0));
  };

  const handleSave = async () => {
    if (!editItem) return;
    if (editStatus === 'rejected') {
      setRejectItem(editItem);
      return;
    }
    setSaving(true);
    const update: any = {
      channel_name: editChannelName.trim(),
      channel_url: editChannelUrl.trim(),
      is_monetized: editMonetized,
      status: editStatus,
      updated_at: new Date().toISOString(),
    };
    if (editStatus === 'linked') {
      update.cms_company = editCmsCompany.trim() || null;
      update.cms_linked_date = editCmsDate ? format(editCmsDate, 'yyyy-MM-dd') : null;
      update.cut_percent = parseFloat(editCutPercent) || 0;
    }
    if (editStatus !== 'rejected') update.rejection_reason = null;

    const { error } = await supabase.from('youtube_cms_links' as any).update(update).eq('id', editItem.id);
    if (error) toast.error(error.message);
    else { toast.success('Updated successfully'); setEditItem(null); fetchAll(); }
    setSaving(false);
  };

  const handleReject = async (reason: string) => {
    if (!rejectItem) return;
    const { error } = await supabase.from('youtube_cms_links' as any).update({
      status: 'rejected', rejection_reason: reason, updated_at: new Date().toISOString(),
    } as any).eq('id', rejectItem.id);
    if (error) toast.error(error.message);
    else { toast.success('Rejected'); setRejectItem(null); setEditItem(null); fetchAll(); }
  };

  const handleDelete = async (ids: string[]) => {
    for (const id of ids) {
      await supabase.from('youtube_cms_links' as any).delete().eq('id', id);
    }
    toast.success(`Deleted ${ids.length} record(s)`);
    setSelected(new Set());
    setDeleteConfirm(null);
    fetchAll();
  };

  const handleBulkStatusChange = async () => {
    if (!bulkStatus || selected.size === 0) return;
    if (bulkStatus === 'rejected') {
      toast.error('Use individual reject for rejection reason');
      return;
    }
    for (const id of selected) {
      await supabase.from('youtube_cms_links' as any).update({
        status: bulkStatus, updated_at: new Date().toISOString(),
        ...(bulkStatus !== 'rejected' ? { rejection_reason: null } : {}),
      } as any).eq('id', id);
    }
    toast.success(`Updated ${selected.size} record(s)`);
    setSelected(new Set());
    setBulkStatus('');
    fetchAll();
  };

  const exportCSV = () => {
    const rows = filtered.map(l => {
      const info = getSubmittedBy(l.user_id);
      return {
        'User': info.name,
        'User ID': `#${info.displayId}`,
        'Email': info.email || '',
        'Sub Label': info.sub || '',
        'Channel Name': l.channel_name,
        'Channel URL': l.channel_url,
        'Monetized': l.is_monetized ? 'On' : 'Off',
        'NOC File': l.noc_file_url || '',
        'YT Reports Screenshot': l.yt_reports_screenshot_url || '',
        'Status': STATUS_LABEL[l.status] || l.status,
        'Rejection Reason': l.rejection_reason || '',
        'CMS Company': l.cms_company || '',
        'CMS Linked Date': l.cms_linked_date || '',
        'Submitted': format(new Date(l.created_at), 'dd MMM yyyy'),
      };
    });
    const headers = Object.keys(rows[0] || {});
    const csv = [headers.join(','), ...rows.map(r => headers.map(h => `"${(r as any)[h] || ''}"`).join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `youtube-cms-links-${format(new Date(), 'yyyy-MM-dd')}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  const handleDeleteFile = async (itemId: string, field: 'noc_file_url' | 'yt_reports_screenshot_url', fileUrl: string) => {
    try {
      // Extract path from URL for storage deletion
      const bucketName = 'cms-noc-files';
      const urlParts = fileUrl.split(`/storage/v1/object/public/${bucketName}/`);
      if (urlParts.length > 1) {
        await supabase.storage.from(bucketName).remove([urlParts[1]]);
      }
      // Clear the URL in DB
      const { error } = await supabase
        .from('youtube_cms_links' as any)
        .update({ [field]: null, updated_at: new Date().toISOString() } as any)
        .eq('id', itemId);
      if (error) throw error;
      toast.success('File deleted successfully');
      // Update local state
      setLinks(prev => prev.map(l => l.id === itemId ? { ...l, [field]: null } : l));
      if (viewItem?.id === itemId) setViewItem(prev => prev ? { ...prev, [field]: null } : null);
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete file');
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Youtube className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold">YouTube CMS Link Requests</h1>
        </div>

        <GlassCard>
          <div className="flex flex-wrap gap-3 mb-4 items-center">
            <Input placeholder="Search by name, email, channel..." value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} className="max-w-xs" />
            <Select value={filterStatus} onValueChange={(v) => { setFilterStatus(v); setPage(1); }}>
              <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                {STATUSES.map(s => <SelectItem key={s} value={s}>{STATUS_LABEL[s]}</SelectItem>)}
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm" onClick={exportCSV} className="gap-1 ml-auto">
              <Download className="h-4 w-4" /> Export CSV
            </Button>
          </div>

          {/* Bulk actions bar */}
          {selected.size > 0 && (
            <div className="flex flex-wrap items-center gap-3 mb-4 p-3 rounded-lg bg-muted/50 border">
              <span className="text-sm font-medium">{selected.size} selected</span>
              <Select value={bulkStatus} onValueChange={setBulkStatus}>
                <SelectTrigger className="w-[160px] h-8"><SelectValue placeholder="Change status" /></SelectTrigger>
                <SelectContent>
                  {STATUSES.filter(s => s !== 'rejected').map(s => <SelectItem key={s} value={s}>{STATUS_LABEL[s]}</SelectItem>)}
                </SelectContent>
              </Select>
              {bulkStatus && <Button size="sm" onClick={handleBulkStatusChange}>Apply</Button>}
              {canDelete && <Button size="sm" variant="destructive" onClick={() => setDeleteConfirm({ ids: [...selected] })} className="gap-1">
                <Trash2 className="h-3 w-3" /> Delete
              </Button>}
            </div>
          )}

          {loading ? (
            <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
          ) : paged.length === 0 ? (
            <p className="text-center py-12 text-muted-foreground">No requests found.</p>
          ) : (
            <>
              <div className="responsive-table-wrap">
                <Table className="min-w-max">
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-10">
                        <Checkbox checked={selected.size === paged.length && paged.length > 0} onCheckedChange={toggleSelectAll} />
                      </TableHead>
                      <TableHead>Submitted By</TableHead>
                      <TableHead>Channel Name</TableHead>
                      <TableHead>Channel URL</TableHead>
                      <TableHead>Monetized</TableHead>
                      <TableHead>NOC</TableHead>
                      <TableHead>YT Reports</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>CMS Company</TableHead>
                      <TableHead>CMS Linked Date</TableHead>
                      <TableHead>Submitted</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paged.map((l) => {
                      const info = getSubmittedBy(l.user_id);
                      return (
                        <TableRow key={l.id} className={selected.has(l.id) ? 'bg-muted/30' : ''}>
                          <TableCell>
                            <Checkbox checked={selected.has(l.id)} onCheckedChange={() => toggleSelect(l.id)} />
                          </TableCell>
                          <TableCell>
                            <div className="text-sm font-medium">{info.name}</div>
                            <div className="text-xs text-muted-foreground">{info.email}</div>
                            {info.displayId && <div className="text-xs text-muted-foreground">#{info.displayId}</div>}
                            {info.sub && <div className="text-xs text-primary font-medium mt-0.5">{info.sub}</div>}
                          </TableCell>
                          <TableCell className="font-medium">
                            <div className="flex items-center gap-1">
                              {l.channel_name}
                              <CopyButton value={l.channel_name} />
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1">
                              <a href={l.channel_url} target="_blank" rel="noreferrer" className="text-primary hover:underline flex items-center gap-1">
                                <ExternalLink className="h-3 w-3" /> Link
                              </a>
                              <CopyButton value={l.channel_url} />
                            </div>
                          </TableCell>
                          <TableCell>{l.is_monetized ? 'On' : 'Off'}</TableCell>
                          <TableCell>
                            {l.noc_file_url ? (
                              <div className="flex items-center gap-1">
                                <a href={l.noc_file_url} target="_blank" rel="noreferrer" className="text-primary hover:underline flex items-center gap-1">
                                  <FileText className="h-3 w-3" /> View
                                </a>
                                <button
                                  onClick={() => handleDeleteFile(l.id, 'noc_file_url', l.noc_file_url!)}
                                  className="p-1 rounded hover:bg-destructive/10 text-destructive/60 hover:text-destructive transition-colors"
                                  title="Delete NOC file"
                                >
                                  <Trash2 className="h-3 w-3" />
                                </button>
                              </div>
                            ) : (
                              <div className="flex items-center gap-1 text-muted-foreground">
                                <FileX className="h-4 w-4" />
                                <span className="text-xs">No file</span>
                              </div>
                            )}
                          </TableCell>
                          <TableCell>
                            {l.yt_reports_screenshot_url ? (
                              <div className="flex items-center gap-1">
                                <a href={l.yt_reports_screenshot_url} target="_blank" rel="noreferrer" className="text-primary hover:underline flex items-center gap-1">
                                  <ImageIcon className="h-3 w-3" /> View
                                </a>
                                <button
                                  onClick={() => handleDeleteFile(l.id, 'yt_reports_screenshot_url', l.yt_reports_screenshot_url!)}
                                  className="p-1 rounded hover:bg-destructive/10 text-destructive/60 hover:text-destructive transition-colors"
                                  title="Delete screenshot"
                                >
                                  <Trash2 className="h-3 w-3" />
                                </button>
                              </div>
                            ) : (
                              <div className="flex items-center gap-1 text-muted-foreground">
                                <ImageOff className="h-4 w-4" />
                                <span className="text-xs">No image</span>
                              </div>
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="space-y-2 min-w-[180px]">
                              <div className="flex flex-wrap items-center gap-2">
                                <StatusBadge status={STATUS_MAP[l.status] || l.status} />
                                <span className="text-xs">{STATUS_LABEL[l.status]}</span>
                              </div>
                              <select
                                aria-label={`Change status for ${l.channel_name}`}
                                value={l.status}
                                onChange={async (e) => {
                                  const newStatus = e.target.value;
                                  if (newStatus === l.status) return;
                                  if (newStatus === 'linked') {
                                    openEdit(l);
                                    setEditStatus('linked');
                                    return;
                                  }
                                  if (newStatus === 'rejected') {
                                    setRejectItem(l);
                                    return;
                                  }
                                  const { error } = await supabase
                                    .from('youtube_cms_links' as any)
                                    .update({
                                      status: newStatus,
                                      rejection_reason: null,
                                      updated_at: new Date().toISOString(),
                                    } as any)
                                    .eq('id', l.id);
                                  if (error) toast.error(error.message);
                                  else {
                                    toast.success(`Status changed to ${STATUS_LABEL[newStatus] || newStatus}`);
                                    fetchAll();
                                  }
                                }}
                                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                              >
                                {STATUSES.map((s) => (
                                  <option key={s} value={s}>{STATUS_LABEL[s]}</option>
                                ))}
                              </select>
                              {l.status === 'rejected' && l.rejection_reason && (
                                <p className="text-xs text-destructive">{l.rejection_reason}</p>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            {l.cms_company ? <div className="flex items-center gap-1">{l.cms_company} <CopyButton value={l.cms_company} /></div> : '—'}
                          </TableCell>
                          <TableCell>{l.cms_linked_date ? format(new Date(l.cms_linked_date), 'dd MMM yyyy') : '—'}</TableCell>
                          <TableCell className="text-xs text-muted-foreground">{format(new Date(l.created_at), 'dd MMM yyyy')}</TableCell>
                          <TableCell>
                            <div className="flex flex-wrap items-center gap-2 min-w-[200px]">
                              <Button size="sm" variant="outline" onClick={() => setViewItem(l)} className="gap-1">
                                <Eye className="h-3.5 w-3.5" /> View
                              </Button>
                              <Button size="sm" variant="outline" onClick={() => openEdit(l)} className="gap-1">
                                <Pencil className="h-3.5 w-3.5" /> Edit
                              </Button>
                              <Button size="sm" variant="destructive" onClick={() => setDeleteConfirm({ ids: [l.id] })} className="gap-1">
                                <Trash2 className="h-3.5 w-3.5" /> Delete
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
              <TablePagination totalItems={filtered.length} currentPage={page} pageSize={perPage} onPageChange={setPage} onPageSizeChange={(s) => { setPerPage(s); setPage(1); }} />
            </>
          )}
        </GlassCard>
      </div>

      {/* View Dialog */}
      <Dialog open={!!viewItem} onOpenChange={(o) => { if (!o) setViewItem(null); }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader><DialogTitle>CMS Link Request Details</DialogTitle></DialogHeader>
          {viewItem && (() => {
            const info = getSubmittedBy(viewItem.user_id);
            return (
              <div className="space-y-3 text-sm">
                <div className="grid grid-cols-2 gap-2">
                  <div><span className="text-muted-foreground">Submitted By:</span></div>
                  <div className="font-medium">{info.name} <span className="text-muted-foreground">#{info.displayId}</span></div>
                  <div><span className="text-muted-foreground">Email:</span></div>
                  <div className="flex items-center gap-1">{info.email} <CopyButton value={info.email || ''} /></div>
                  {info.sub && <><div><span className="text-muted-foreground">Label:</span></div><div className="text-primary font-medium">{info.sub}</div></>}
                  <div><span className="text-muted-foreground">Channel Name:</span></div>
                  <div className="flex items-center gap-1">{viewItem.channel_name} <CopyButton value={viewItem.channel_name} /></div>
                  <div><span className="text-muted-foreground">Channel URL:</span></div>
                  <div className="flex items-center gap-1"><a href={viewItem.channel_url} target="_blank" rel="noreferrer" className="text-primary hover:underline truncate max-w-[200px]">{viewItem.channel_url}</a> <CopyButton value={viewItem.channel_url} /></div>
                  <div><span className="text-muted-foreground">Monetized:</span></div>
                  <div>{viewItem.is_monetized ? 'On' : 'Off'}</div>
                  <div><span className="text-muted-foreground">NOC File:</span></div>
                  <div>{viewItem.noc_file_url ? (
                    <div className="flex items-center gap-1">
                      <a href={viewItem.noc_file_url} target="_blank" rel="noreferrer" className="text-primary hover:underline flex items-center gap-1"><FileText className="h-3 w-3" /> View File</a>
                      <button onClick={() => handleDeleteFile(viewItem.id, 'noc_file_url', viewItem.noc_file_url!)} className="p-1 rounded hover:bg-destructive/10 text-destructive/60 hover:text-destructive transition-colors" title="Delete NOC file"><Trash2 className="h-3 w-3" /></button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1 text-muted-foreground"><FileX className="h-4 w-4" /><span className="text-xs">No file</span></div>
                  )}</div>
                  <div><span className="text-muted-foreground">YT Reports:</span></div>
                  <div>{viewItem.yt_reports_screenshot_url ? (
                    <div className="flex items-center gap-1">
                      <a href={viewItem.yt_reports_screenshot_url} target="_blank" rel="noreferrer" className="text-primary hover:underline flex items-center gap-1"><ImageIcon className="h-3 w-3" /> View Image</a>
                      <button onClick={() => handleDeleteFile(viewItem.id, 'yt_reports_screenshot_url', viewItem.yt_reports_screenshot_url!)} className="p-1 rounded hover:bg-destructive/10 text-destructive/60 hover:text-destructive transition-colors" title="Delete screenshot"><Trash2 className="h-3 w-3" /></button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1 text-muted-foreground"><ImageOff className="h-4 w-4" /><span className="text-xs">No image</span></div>
                  )}</div>
                  <div><span className="text-muted-foreground">Status:</span></div>
                  <div><StatusBadge status={STATUS_MAP[viewItem.status] || viewItem.status} /> <span className="ml-1">{STATUS_LABEL[viewItem.status]}</span></div>
                  {viewItem.rejection_reason && <><div><span className="text-muted-foreground">Rejection:</span></div><div className="text-destructive">{viewItem.rejection_reason}</div></>}
                  {viewItem.cms_company && <><div><span className="text-muted-foreground">CMS Company:</span></div><div className="flex items-center gap-1">{viewItem.cms_company} <CopyButton value={viewItem.cms_company} /></div></>}
                  {viewItem.cms_linked_date && <><div><span className="text-muted-foreground">CMS Linked Date:</span></div><div>{format(new Date(viewItem.cms_linked_date), 'dd MMM yyyy')}</div></>}
                  <div><span className="text-muted-foreground">Submitted:</span></div>
                  <div>{format(new Date(viewItem.created_at), 'dd MMM yyyy')}</div>
                </div>
                <div className="mt-4 grid gap-3">
                  {viewItem.yt_reports_screenshot_url ? (
                    <div>
                      <Label className="text-muted-foreground mb-1 block">YT Reports Screenshot Preview</Label>
                      <img src={viewItem.yt_reports_screenshot_url} alt="YT Reports" className="rounded-lg border max-h-60 object-contain w-full bg-muted/20" />
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-6 rounded-lg border border-dashed border-muted-foreground/30 bg-muted/10">
                      <ImageOff className="h-10 w-10 text-muted-foreground/40 mb-2" />
                      <span className="text-xs text-muted-foreground">No YT Reports screenshot</span>
                    </div>
                  )}
                  {viewItem.noc_file_url ? (
                    <div>
                      <Label className="text-muted-foreground mb-1 block">NOC Preview</Label>
                      <iframe src={viewItem.noc_file_url} title="NOC Preview" className="w-full h-72 rounded-lg border bg-background" />
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-6 rounded-lg border border-dashed border-muted-foreground/30 bg-muted/10">
                      <FileX className="h-10 w-10 text-muted-foreground/40 mb-2" />
                      <span className="text-xs text-muted-foreground">No NOC document</span>
                    </div>
                  )}
                </div>
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={!!editItem} onOpenChange={(o) => { if (!o) setEditItem(null); }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader><DialogTitle>Edit CMS Link Request</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label>Channel Name</Label><Input value={editChannelName} onChange={(e) => setEditChannelName(e.target.value)} /></div>
            <div><Label>Channel URL</Label><Input value={editChannelUrl} onChange={(e) => setEditChannelUrl(e.target.value)} /></div>
            <div className="flex items-center gap-3">
              <Label>Monetization</Label>
              <Switch checked={editMonetized} onCheckedChange={setEditMonetized} />
              <span className="text-sm text-muted-foreground">{editMonetized ? 'On' : 'Off'}</span>
            </div>
            <div>
              <Label>Status</Label>
              <Select value={editStatus} onValueChange={setEditStatus}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{STATUSES.map(s => <SelectItem key={s} value={s}>{STATUS_LABEL[s]}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            {editStatus === 'linked' && (
              <>
                <div><Label>CMS Company</Label><Input value={editCmsCompany} onChange={(e) => setEditCmsCompany(e.target.value)} placeholder="Enter CMS company name" /></div>
                <div>
                  <Label>CMS Linked Date</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !editCmsDate && "text-muted-foreground")}>
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {editCmsDate ? format(editCmsDate, 'PPP') : 'Pick a date'}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar mode="single" selected={editCmsDate} onSelect={setEditCmsDate} className={cn("p-3 pointer-events-auto")} />
                    </PopoverContent>
                  </Popover>
                </div>
                <div><Label>Revenue % Cut</Label><Input type="number" min="0" max="100" step="0.01" value={editCutPercent} onChange={(e) => setEditCutPercent(e.target.value)} placeholder="e.g. 30" /></div>
              </>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditItem(null)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving}>{saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />} Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <RejectReasonModal open={!!rejectItem} title="Reject CMS Link Request" onConfirm={handleReject} onCancel={() => setRejectItem(null)} />

      {deleteConfirm && (
        <ConfirmDialog
          title="Delete CMS Link Request(s)"
          message={`Are you sure you want to delete ${deleteConfirm.ids.length} record(s)? This action cannot be undone.`}
          onConfirm={() => handleDelete(deleteConfirm.ids)}
          onCancel={() => setDeleteConfirm(null)}
        />
      )}
    </DashboardLayout>
  );
}
