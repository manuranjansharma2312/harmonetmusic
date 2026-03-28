import { useState, useEffect } from 'react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { StatusBadge } from '@/components/StatusBadge';
import { GlassCard } from '@/components/GlassCard';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { RejectReasonModal } from '@/components/RejectReasonModal';
import { TablePagination } from '@/components/TablePagination';
import { Loader2, Youtube, ExternalLink, FileText, CalendarIcon, Pencil } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

interface CmsLink {
  id: string;
  user_id: string;
  channel_name: string;
  channel_url: string;
  is_monetized: boolean;
  noc_file_url: string | null;
  status: string;
  rejection_reason: string | null;
  cms_linked_date: string | null;
  cms_company: string | null;
  created_at: string;
  updated_at: string;
}

interface Profile {
  user_id: string;
  legal_name: string;
  email: string;
  display_id: number;
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
  const [links, setLinks] = useState<CmsLink[]>([]);
  const [profiles, setProfiles] = useState<Record<string, Profile>>({});
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState('all');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState<number | 'all'>(20);

  // Edit modal
  const [editItem, setEditItem] = useState<CmsLink | null>(null);
  const [editChannelName, setEditChannelName] = useState('');
  const [editChannelUrl, setEditChannelUrl] = useState('');
  const [editMonetized, setEditMonetized] = useState(false);
  const [editStatus, setEditStatus] = useState('');
  const [editCmsCompany, setEditCmsCompany] = useState('');
  const [editCmsDate, setEditCmsDate] = useState<Date | undefined>();
  const [saving, setSaving] = useState(false);

  // Reject modal
  const [rejectItem, setRejectItem] = useState<CmsLink | null>(null);

  const fetchAll = async () => {
    const { data, error } = await supabase
      .from('youtube_cms_links' as any)
      .select('*')
      .order('created_at', { ascending: false });
    if (!error && data) {
      const items = data as any as CmsLink[];
      setLinks(items);
      // Fetch profiles
      const userIds = [...new Set(items.map(i => i.user_id))];
      if (userIds.length) {
        const { data: profs } = await supabase
          .from('profiles')
          .select('user_id, legal_name, email, display_id')
          .in('user_id', userIds);
        if (profs) {
          const map: Record<string, Profile> = {};
          profs.forEach(p => { map[p.user_id] = p; });
          setProfiles(map);
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

  const openEdit = (item: CmsLink) => {
    setEditItem(item);
    setEditChannelName(item.channel_name);
    setEditChannelUrl(item.channel_url);
    setEditMonetized(item.is_monetized);
    setEditStatus(item.status);
    setEditCmsCompany(item.cms_company || '');
    setEditCmsDate(item.cms_linked_date ? new Date(item.cms_linked_date) : undefined);
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
    }
    // Clear rejection reason if not rejected
    if (editStatus !== 'rejected') {
      update.rejection_reason = null;
    }

    const { error } = await supabase
      .from('youtube_cms_links' as any)
      .update(update)
      .eq('id', editItem.id);
    if (error) toast.error(error.message);
    else {
      toast.success('Updated successfully');
      setEditItem(null);
      fetchAll();
    }
    setSaving(false);
  };

  const handleReject = async (reason: string) => {
    if (!rejectItem) return;
    const { error } = await supabase
      .from('youtube_cms_links' as any)
      .update({
        status: 'rejected',
        rejection_reason: reason,
        updated_at: new Date().toISOString(),
      } as any)
      .eq('id', rejectItem.id);
    if (error) toast.error(error.message);
    else {
      toast.success('Rejected successfully');
      setRejectItem(null);
      setEditItem(null);
      fetchAll();
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
          <div className="flex flex-wrap gap-3 mb-4">
            <Input
              placeholder="Search by name, email, channel..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              className="max-w-xs"
            />
            <Select value={filterStatus} onValueChange={(v) => { setFilterStatus(v); setPage(1); }}>
              <SelectTrigger className="w-[180px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                {STATUSES.map(s => (
                  <SelectItem key={s} value={s}>{STATUS_LABEL[s]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {loading ? (
            <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
          ) : paged.length === 0 ? (
            <p className="text-center py-12 text-muted-foreground">No requests found.</p>
          ) : (
            <>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>User</TableHead>
                      <TableHead>Channel Name</TableHead>
                      <TableHead>Channel URL</TableHead>
                      <TableHead>Monetized</TableHead>
                      <TableHead>NOC</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>CMS Company</TableHead>
                      <TableHead>CMS Linked Date</TableHead>
                      <TableHead>Submitted</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paged.map((l) => {
                      const prof = profiles[l.user_id];
                      return (
                        <TableRow key={l.id}>
                          <TableCell>
                            <div className="text-sm font-medium">{prof?.legal_name || '—'}</div>
                            <div className="text-xs text-muted-foreground">{prof?.email}</div>
                            {prof?.display_id && <div className="text-xs text-muted-foreground">#{prof.display_id}</div>}
                          </TableCell>
                          <TableCell className="font-medium">{l.channel_name}</TableCell>
                          <TableCell>
                            <a href={l.channel_url} target="_blank" rel="noreferrer" className="text-primary hover:underline flex items-center gap-1">
                              <ExternalLink className="h-3 w-3" /> Link
                            </a>
                          </TableCell>
                          <TableCell>{l.is_monetized ? 'On' : 'Off'}</TableCell>
                          <TableCell>
                            {l.noc_file_url ? (
                              <a href={l.noc_file_url} target="_blank" rel="noreferrer" className="text-primary hover:underline flex items-center gap-1">
                                <FileText className="h-3 w-3" /> View
                              </a>
                            ) : '—'}
                          </TableCell>
                          <TableCell>
                            <StatusBadge status={STATUS_MAP[l.status] || l.status} />
                            <span className="ml-1 text-xs">{STATUS_LABEL[l.status]}</span>
                            {l.status === 'rejected' && l.rejection_reason && (
                              <p className="text-xs text-destructive mt-1">{l.rejection_reason}</p>
                            )}
                          </TableCell>
                          <TableCell>{l.cms_company || '—'}</TableCell>
                          <TableCell>{l.cms_linked_date ? format(new Date(l.cms_linked_date), 'dd MMM yyyy') : '—'}</TableCell>
                          <TableCell className="text-xs text-muted-foreground">{format(new Date(l.created_at), 'dd MMM yyyy')}</TableCell>
                          <TableCell>
                            <Button size="sm" variant="outline" onClick={() => openEdit(l)} className="gap-1">
                              <Pencil className="h-3 w-3" /> Edit
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
              {totalPages > 1 && (
                <TablePagination currentPage={page} totalPages={totalPages} onPageChange={setPage} />
              )}
            </>
          )}
        </GlassCard>
      </div>

      {/* Edit Dialog */}
      <Dialog open={!!editItem} onOpenChange={(o) => { if (!o) setEditItem(null); }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit CMS Link Request</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Channel Name</Label>
              <Input value={editChannelName} onChange={(e) => setEditChannelName(e.target.value)} />
            </div>
            <div>
              <Label>Channel URL</Label>
              <Input value={editChannelUrl} onChange={(e) => setEditChannelUrl(e.target.value)} />
            </div>
            <div className="flex items-center gap-3">
              <Label>Monetization</Label>
              <Switch checked={editMonetized} onCheckedChange={setEditMonetized} />
              <span className="text-sm text-muted-foreground">{editMonetized ? 'On' : 'Off'}</span>
            </div>
            <div>
              <Label>Status</Label>
              <Select value={editStatus} onValueChange={setEditStatus}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {STATUSES.map(s => (
                    <SelectItem key={s} value={s}>{STATUS_LABEL[s]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {editStatus === 'linked' && (
              <>
                <div>
                  <Label>CMS Company</Label>
                  <Input value={editCmsCompany} onChange={(e) => setEditCmsCompany(e.target.value)} placeholder="Enter CMS company name" />
                </div>
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
              </>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditItem(null)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />} Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <RejectReasonModal
        open={!!rejectItem}
        title="Reject CMS Link Request"
        onConfirm={handleReject}
        onCancel={() => setRejectItem(null)}
      />
    </DashboardLayout>
  );
}
