import { useState, useEffect } from 'react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { StatusBadge } from '@/components/StatusBadge';
import { GlassCard } from '@/components/GlassCard';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, Plus, Youtube, FileText, ExternalLink, Image as ImageIcon } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { format } from 'date-fns';

interface CmsLink {
  id: string;
  channel_name: string;
  channel_url: string;
  is_monetized: boolean;
  noc_file_url: string | null;
  yt_reports_screenshot_url: string | null;
  status: string;
  rejection_reason: string | null;
  cms_linked_date: string | null;
  cms_company: string | null;
  created_at: string;
}

export default function YouTubeCmsLink() {
  const { user } = useAuth();
  const [links, setLinks] = useState<CmsLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [channelName, setChannelName] = useState('');
  const [channelUrl, setChannelUrl] = useState('');
  const [isMonetized, setIsMonetized] = useState(false);
  const [nocFile, setNocFile] = useState<File | null>(null);
  const [ytReportsFile, setYtReportsFile] = useState<File | null>(null);

  const fetchLinks = async () => {
    if (!user) return;
    const { data, error } = await supabase
      .from('youtube_cms_links' as any)
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });
    if (!error) setLinks((data as any) || []);
    setLoading(false);
  };

  useEffect(() => { fetchLinks(); }, [user]);

  const uploadFile = async (file: File, folder: string) => {
    const ext = file.name.split('.').pop();
    const path = `${user!.id}/${crypto.randomUUID()}.${ext}`;
    const { error } = await supabase.storage.from(folder).upload(path, file);
    if (error) throw error;
    const { data: urlData } = supabase.storage.from(folder).getPublicUrl(path);
    return urlData.publicUrl;
  };

  const handleSubmit = async () => {
    if (!user || !channelName.trim() || !channelUrl.trim()) {
      toast.error('Please fill all required fields');
      return;
    }
    setSubmitting(true);
    try {
      let nocUrl: string | null = null;
      let ytReportsUrl: string | null = null;

      if (nocFile) nocUrl = await uploadFile(nocFile, 'cms-noc-files');
      if (ytReportsFile) ytReportsUrl = await uploadFile(ytReportsFile, 'cms-noc-files');

      const { error } = await supabase.from('youtube_cms_links' as any).insert({
        user_id: user.id,
        channel_name: channelName.trim(),
        channel_url: channelUrl.trim(),
        is_monetized: isMonetized,
        noc_file_url: nocUrl,
        yt_reports_screenshot_url: ytReportsUrl,
      } as any);

      if (error) throw error;
      toast.success('YouTube CMS Link request submitted');
      setShowForm(false);
      setChannelName('');
      setChannelUrl('');
      setIsMonetized(false);
      setNocFile(null);
      setYtReportsFile(null);
      fetchLinks();
    } catch (err: any) {
      toast.error(err.message || 'Submission failed');
    } finally {
      setSubmitting(false);
    }
  };

  const statusMap: Record<string, string> = {
    pending_review: 'pending',
    reviewing: 'processing',
    linked: 'approved',
    rejected: 'rejected',
  };

  const statusLabel: Record<string, string> = {
    pending_review: 'Pending Review',
    reviewing: 'Reviewing',
    linked: 'Linked',
    rejected: 'Rejected',
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Youtube className="h-6 w-6 text-primary" />
            <h1 className="text-2xl font-bold">YouTube CMS Link</h1>
          </div>
          <Button onClick={() => setShowForm(true)} className="gap-2">
            <Plus className="h-4 w-4" /> New Request
          </Button>
        </div>

        <p className="text-sm text-muted-foreground">
          Connect your YouTube Channel with the YouTube CMS to gain better control over your content, ensure proper rights management, and simplify revenue tracking and distribution in a professional environment.
        </p>

        <GlassCard>
          {loading ? (
            <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
          ) : links.length === 0 ? (
            <p className="text-center py-12 text-muted-foreground">No YouTube CMS Link requests yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Channel Name</TableHead>
                    <TableHead>Channel URL</TableHead>
                    <TableHead>Monetized</TableHead>
                    <TableHead>NOC</TableHead>
                    <TableHead>YT Reports</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>CMS Company</TableHead>
                    <TableHead>CMS Linked Date</TableHead>
                    <TableHead>Submitted</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {links.map((l) => (
                    <TableRow key={l.id}>
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
                        {l.yt_reports_screenshot_url ? (
                          <a href={l.yt_reports_screenshot_url} target="_blank" rel="noreferrer" className="text-primary hover:underline flex items-center gap-1">
                            <ImageIcon className="h-3 w-3" /> View
                          </a>
                        ) : '—'}
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={statusMap[l.status] || l.status} />
                        <span className="ml-1 text-xs text-muted-foreground">{statusLabel[l.status] || l.status}</span>
                        {l.status === 'rejected' && l.rejection_reason && (
                          <p className="text-xs text-destructive mt-1">{l.rejection_reason}</p>
                        )}
                      </TableCell>
                      <TableCell>{l.cms_company || '—'}</TableCell>
                      <TableCell>{l.cms_linked_date ? format(new Date(l.cms_linked_date), 'dd MMM yyyy') : '—'}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{format(new Date(l.created_at), 'dd MMM yyyy')}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </GlassCard>
      </div>

      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>New YouTube CMS Link Request</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Channel Name *</Label>
              <Input value={channelName} onChange={(e) => setChannelName(e.target.value)} placeholder="Enter channel name" />
            </div>
            <div>
              <Label>Channel URL *</Label>
              <Input value={channelUrl} onChange={(e) => setChannelUrl(e.target.value)} placeholder="https://youtube.com/@channel" />
            </div>
            <div className="flex items-center gap-3">
              <Label>Is this Channel Monetization</Label>
              <Switch checked={isMonetized} onCheckedChange={setIsMonetized} />
              <span className="text-sm text-muted-foreground">{isMonetized ? 'On' : 'Off'}</span>
            </div>
            <div>
              <Label>Clarification / NOC (PDF)</Label>
              <Input type="file" accept=".pdf" onChange={(e) => setNocFile(e.target.files?.[0] || null)} />
            </div>
            <div>
              <Label>Last 6 Month Reports of YouTube Reports (Image)</Label>
              <Input type="file" accept="image/*" onChange={(e) => setYtReportsFile(e.target.files?.[0] || null)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
            <Button onClick={handleSubmit} disabled={submitting}>
              {submitting && <Loader2 className="h-4 w-4 animate-spin mr-2" />} Submit
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
