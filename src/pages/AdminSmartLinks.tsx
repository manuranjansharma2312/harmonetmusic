import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { DashboardLayout } from '@/components/DashboardLayout';
import { GlassCard } from '@/components/GlassCard';
import { CopyButton } from '@/components/CopyButton';
import { PlatformLinksEditor } from '@/components/PlatformLinksEditor';
import { SmartLinkEditor } from '@/components/SmartLinkEditor';
import { useAuth } from '@/hooks/useAuth';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2, Link2, ExternalLink, Search, Music, Edit, Plus, Trash2, GripVertical, Settings, ImageIcon, Key, Eye, EyeOff, User, CheckCircle, XCircle, Clock } from 'lucide-react';
import { toast } from 'sonner';
import { RejectReasonModal } from '@/components/RejectReasonModal';

// ─── Types ───
interface SmartLinkRelease {
  id: string;
  album_name: string | null;
  ep_name: string | null;
  poster_url: string | null;
  platform_links: Record<string, string>;
  slug: string | null;
  status: string;
  content_type: string;
  release_date: string;
}

interface Platform {
  id: string;
  name: string;
  icon_url: string | null;
  placeholder: string;
  sort_order: number;
  is_active: boolean;
}

interface ApiConfig {
  id: string;
  api_name: string;
  api_key: string;
  api_url: string;
  is_enabled: boolean;
  notes: string;
}

// ─── Auto-crop helper ───
function autoCropImage(file: File, size: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext('2d')!;
      // Center-crop to square
      const min = Math.min(img.width, img.height);
      const sx = (img.width - min) / 2;
      const sy = (img.height - min) / 2;
      ctx.drawImage(img, sx, sy, min, min, 0, 0, size, size);
      canvas.toBlob(
        blob => blob ? resolve(blob) : reject(new Error('Canvas toBlob failed')),
        'image/png'
      );
    };
    img.onerror = reject;
    img.src = URL.createObjectURL(file);
  });
}

export default function AdminSmartLinks() {
  const { user } = useAuth();
  // ─── Platforms state ───
  const [platforms, setPlatforms] = useState<Platform[]>([]);
  const [platformsLoading, setPlatformsLoading] = useState(true);
  const [editPlatform, setEditPlatform] = useState<Platform | null>(null);
  const [newPlatform, setNewPlatform] = useState(false);
  const [platformForm, setPlatformForm] = useState({ name: '', icon_url: '', placeholder: '', is_active: true });
  const [saving, setSaving] = useState(false);
  const [uploadingIcon, setUploadingIcon] = useState(false);

  // ─── API Configs state ───
  const [apiConfigs, setApiConfigs] = useState<ApiConfig[]>([]);
  const [apisLoading, setApisLoading] = useState(true);
  const [editApi, setEditApi] = useState<ApiConfig | null>(null);
  const [newApi, setNewApi] = useState(false);
  const [apiForm, setApiForm] = useState({ api_name: '', api_key: '', api_url: '', is_enabled: false, notes: '' });
  const [savingApi, setSavingApi] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);

  // ─── Custom Smart Links state ───
  const [customLinks, setCustomLinks] = useState<any[]>([]);
  const [customLoading, setCustomLoading] = useState(true);
  const [customSearch, setCustomSearch] = useState('');
  const [editCustom, setEditCustom] = useState<any | null>(null);
  const [creatingCustom, setCreatingCustom] = useState(false);

  // ─── System enable/disable ───
  const [systemEnabled, setSystemEnabled] = useState(true);
  const [togglingSystem, setTogglingSystem] = useState(false);

  // ─── Fetchers ───

  const fetchPlatforms = async () => {
    const { data } = await supabase
      .from('smart_link_platforms')
      .select('*')
      .order('sort_order', { ascending: true });
    setPlatforms((data as any) || []);
    setPlatformsLoading(false);
  };

  const fetchApiConfigs = async () => {
    const { data } = await supabase
      .from('smart_link_api_configs')
      .select('*')
      .order('created_at', { ascending: true });
    setApiConfigs((data as any) || []);
    setApisLoading(false);
  };

  const fetchCustomLinks = async () => {
    const { data } = await supabase
      .from('smart_links')
      .select('id, title, artist_name, poster_url, platform_links, slug, created_at, user_id, status')
      .order('created_at', { ascending: false });
    const links = (data as any) || [];

    // Fetch profiles for all unique user_ids
    const userIds = [...new Set(links.map((l: any) => l.user_id))] as string[];
    let profilesMap: Record<string, any> = {};
    let subLabelsMap: Record<string, any> = {};

    if (userIds.length > 0) {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, legal_name, artist_name, record_label_name, user_type, display_id')
        .in('user_id', userIds);
      (profiles || []).forEach((p: any) => { profilesMap[p.user_id] = p; });

      // Check if any are sub-labels
      const { data: subLabels } = await supabase
        .from('sub_labels')
        .select('sub_user_id, sub_label_name, parent_label_name, parent_user_id, status')
        .in('sub_user_id', userIds)
        .eq('status', 'active');
      (subLabels || []).forEach((sl: any) => { if (sl.sub_user_id) subLabelsMap[sl.sub_user_id] = sl; });
    }

    const enriched = links.map((l: any) => ({
      ...l,
      _profile: profilesMap[l.user_id] || null,
      _subLabel: subLabelsMap[l.user_id] || null,
    }));

    setCustomLinks(enriched);
    setCustomLoading(false);
  };

  const fetchSystemSetting = async () => {
    const { data } = await supabase.from('smart_link_settings').select('is_enabled').limit(1).single();
    if (data) setSystemEnabled((data as any).is_enabled);
  };

  const toggleSystem = async (val: boolean) => {
    setTogglingSystem(true);
    const { data } = await supabase.from('smart_link_settings').select('id').limit(1).single();
    if (data) {
      await supabase.from('smart_link_settings').update({ is_enabled: val, updated_at: new Date().toISOString(), updated_by: user?.id } as any).eq('id', (data as any).id);
    }
    setSystemEnabled(val);
    setTogglingSystem(false);
    toast.success(val ? 'Smart Links system enabled' : 'Smart Links system disabled');
  };

  useEffect(() => { fetchReleases(); fetchPlatforms(); fetchApiConfigs(); fetchCustomLinks(); fetchSystemSetting(); }, []);

  // ─── Release helpers ───
  const filtered = releases.filter(r => {
    const name = r.album_name || r.ep_name || '';
    return name.toLowerCase().includes(search.toLowerCase());
  });

  const getSmartLinkUrl = (r: SmartLinkRelease) => {
    const base = window.location.origin;
    return r.slug ? `${base}/r/${r.slug}` : `${base}/r/${r.id}`;
  };

  const hasLinks = (r: SmartLinkRelease) => {
    const links = r.platform_links as Record<string, string>;
    return links && Object.values(links).some(v => v?.trim());
  };

  // ─── Platform handlers ───
  const openNewPlatform = () => {
    setPlatformForm({ name: '', icon_url: '', placeholder: '', is_active: true });
    setEditPlatform(null);
    setNewPlatform(true);
  };

  const openEditPlatform = (p: Platform) => {
    setPlatformForm({ name: p.name, icon_url: p.icon_url || '', placeholder: p.placeholder || '', is_active: p.is_active });
    setEditPlatform(p);
    setNewPlatform(true);
  };

  const handleIconUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) { toast.error('Icon must be under 2MB'); return; }

    setUploadingIcon(true);
    try {
      // Auto-crop to 128x128 square PNG
      const croppedBlob = await autoCropImage(file, 128);
      const path = `platform-icons/${Date.now()}.png`;
      const { error } = await supabase.storage.from('posters').upload(path, croppedBlob, { upsert: true, contentType: 'image/png' });
      if (error) { toast.error('Upload failed'); return; }
      const { data: urlData } = supabase.storage.from('posters').getPublicUrl(path);
      setPlatformForm(prev => ({ ...prev, icon_url: urlData.publicUrl }));
      toast.success('Icon uploaded & auto-cropped to 128×128');
    } catch {
      toast.error('Failed to process image');
    } finally {
      setUploadingIcon(false);
    }
  };

  const savePlatform = async () => {
    if (!platformForm.name.trim()) { toast.error('Platform name is required'); return; }
    setSaving(true);

    if (editPlatform) {
      const { error } = await supabase
        .from('smart_link_platforms')
        .update({ name: platformForm.name.trim(), icon_url: platformForm.icon_url || null, placeholder: platformForm.placeholder, is_active: platformForm.is_active, updated_at: new Date().toISOString() } as any)
        .eq('id', editPlatform.id);
      if (error) { toast.error('Failed to update'); setSaving(false); return; }
      toast.success('Platform updated');
    } else {
      const maxOrder = platforms.length > 0 ? Math.max(...platforms.map(p => p.sort_order)) : 0;
      const { error } = await supabase
        .from('smart_link_platforms')
        .insert({ name: platformForm.name.trim(), icon_url: platformForm.icon_url || null, placeholder: platformForm.placeholder, sort_order: maxOrder + 1, is_active: platformForm.is_active } as any);
      if (error) { toast.error('Failed to add'); setSaving(false); return; }
      toast.success('Platform added');
    }
    setSaving(false);
    setNewPlatform(false);
    setEditPlatform(null);
    fetchPlatforms();
  };

  const deletePlatform = async (id: string) => {
    if (!confirm('Remove this platform?')) return;
    await supabase.from('smart_link_platforms').delete().eq('id', id);
    toast.success('Platform removed');
    fetchPlatforms();
  };

  const togglePlatform = async (p: Platform) => {
    await supabase.from('smart_link_platforms').update({ is_active: !p.is_active, updated_at: new Date().toISOString() } as any).eq('id', p.id);
    fetchPlatforms();
  };

  // ─── API Config handlers ───
  const openNewApi = () => {
    setApiForm({ api_name: '', api_key: '', api_url: '', is_enabled: false, notes: '' });
    setEditApi(null);
    setNewApi(true);
    setShowApiKey(false);
  };

  const openEditApi = (a: ApiConfig) => {
    setApiForm({ api_name: a.api_name, api_key: a.api_key || '', api_url: a.api_url || '', is_enabled: a.is_enabled, notes: a.notes || '' });
    setEditApi(a);
    setNewApi(true);
    setShowApiKey(false);
  };

  const saveApi = async () => {
    if (!apiForm.api_name.trim()) { toast.error('API name is required'); return; }
    setSavingApi(true);

    if (editApi) {
      const { error } = await supabase
        .from('smart_link_api_configs')
        .update({ api_name: apiForm.api_name.trim(), api_key: apiForm.api_key, api_url: apiForm.api_url, is_enabled: apiForm.is_enabled, notes: apiForm.notes, updated_at: new Date().toISOString() } as any)
        .eq('id', editApi.id);
      if (error) { toast.error('Failed to update'); setSavingApi(false); return; }
      toast.success('API config updated');
    } else {
      const { error } = await supabase
        .from('smart_link_api_configs')
        .insert({ api_name: apiForm.api_name.trim(), api_key: apiForm.api_key, api_url: apiForm.api_url, is_enabled: apiForm.is_enabled, notes: apiForm.notes } as any);
      if (error) { toast.error('Failed to add'); setSavingApi(false); return; }
      toast.success('API added');
    }
    setSavingApi(false);
    setNewApi(false);
    setEditApi(null);
    fetchApiConfigs();
  };

  const deleteApi = async (id: string) => {
    if (!confirm('Remove this API configuration?')) return;
    await supabase.from('smart_link_api_configs').delete().eq('id', id);
    toast.success('API config removed');
    fetchApiConfigs();
  };

  const toggleApi = async (a: ApiConfig) => {
    await supabase.from('smart_link_api_configs').update({ is_enabled: !a.is_enabled, updated_at: new Date().toISOString() } as any).eq('id', a.id);
    fetchApiConfigs();
  };

  // ─── Smart Link Approve/Reject ───
  const [rejectingId, setRejectingId] = useState<string | null>(null);

  const approveSmartLink = async (id: string) => {
    await supabase.from('smart_links').update({ status: 'approved', rejection_reason: null, updated_at: new Date().toISOString() } as any).eq('id', id);
    toast.success('Smart link approved');
    fetchCustomLinks();
  };

  const rejectSmartLink = async (id: string, reason: string) => {
    await supabase.from('smart_links').update({ status: 'rejected', rejection_reason: reason, updated_at: new Date().toISOString() } as any).eq('id', id);
    toast.success('Smart link rejected — will be auto-deleted in 1 hour');
    setRejectingId(null);
    fetchCustomLinks();
  };

  const deleteSmartLink = async (id: string) => {
    if (!confirm('Delete this smart link permanently?')) return;
    await supabase.from('smart_links').delete().eq('id', id);
    toast.success('Smart link deleted');
    fetchCustomLinks();
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Smart Links</h1>
            <p className="text-sm text-muted-foreground mt-1">Manage platform links for all approved releases</p>
          </div>
          <div className="flex items-center gap-3">
            <Label htmlFor="system-toggle" className="text-sm text-muted-foreground">{systemEnabled ? 'Enabled' : 'Disabled'}</Label>
            <Switch
              id="system-toggle"
              checked={systemEnabled}
              onCheckedChange={toggleSystem}
              disabled={togglingSystem}
            />
          </div>
        </div>

        <Tabs defaultValue="custom" className="w-full">
          <TabsList>
            <TabsTrigger value="custom"><Music className="h-3.5 w-3.5 mr-1.5" />Custom Links</TabsTrigger>
            <TabsTrigger value="platforms"><Settings className="h-3.5 w-3.5 mr-1.5" />Platforms</TabsTrigger>
            <TabsTrigger value="apis"><Key className="h-3.5 w-3.5 mr-1.5" />API Integrations</TabsTrigger>
          </TabsList>



          <TabsContent value="custom" className="space-y-4 mt-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">Standalone smart links created by users or admin.</p>
              <Button size="sm" onClick={() => setCreatingCustom(true)}><Plus className="h-3.5 w-3.5 mr-1" /> Create Smart Link</Button>
            </div>
            <div className="relative max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search custom links..." value={customSearch} onChange={e => setCustomSearch(e.target.value)} className="pl-9" />
            </div>

            {customLoading ? (
              <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
            ) : customLinks.filter(c => c.title.toLowerCase().includes(customSearch.toLowerCase())).length === 0 ? (
              <GlassCard className="p-8 text-center">
                <Music className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
                <p className="text-muted-foreground">No custom smart links yet</p>
              </GlassCard>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {customLinks.filter(c => c.title.toLowerCase().includes(customSearch.toLowerCase())).map(c => {
                  const url = c.slug ? `${window.location.origin}/r/${c.slug}` : `${window.location.origin}/r/${c.id}`;
                  const active = c.platform_links && Object.values(c.platform_links).some((v: any) => v?.trim());
                  const linkCount = active ? Object.values(c.platform_links).filter((v: any) => v?.trim()).length : 0;

                  return (
                    <GlassCard key={c.id} className="p-4 space-y-3">
                      <div className="flex items-start gap-3">
                        {c.poster_url ? (
                          <img src={c.poster_url} alt={c.title} className="h-14 w-14 rounded-lg object-cover flex-shrink-0" />
                        ) : (
                          <div className="h-14 w-14 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
                            <Music className="h-6 w-6 text-muted-foreground" />
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-sm text-foreground truncate">{c.title}</p>
                          <p className="text-xs text-muted-foreground">{c.artist_name || 'Unknown Artist'}</p>
                          {/* Created by info */}
                          {c._profile && (
                            <div className="mt-1">
                              <p className="text-[10px] text-muted-foreground/80 flex items-center gap-1">
                                <User className="h-3 w-3" />
                                {c._profile.artist_name || c._profile.record_label_name || c._profile.legal_name}
                                <span className="text-muted-foreground/50">#{c._profile.display_id}</span>
                              </p>
                              {c._subLabel && (
                                <p className="text-[10px] text-muted-foreground/60 ml-4">
                                  ↳ Under: {c._subLabel.parent_label_name}
                                </p>
                              )}
                            </div>
                          )}
                          {active ? (
                            <Badge variant="outline" className="mt-1 text-[10px]">{linkCount} platforms</Badge>
                          ) : (
                            <Badge variant="outline" className="mt-1 text-[10px]">No links</Badge>
                          )}
                          {/* Status badge */}
                          {c.status === 'pending' && (
                            <Badge variant="secondary" className="mt-1 text-[10px] gap-0.5"><Clock className="h-2.5 w-2.5" /> Pending</Badge>
                          )}
                          {c.status === 'approved' && (
                            <Badge className="mt-1 text-[10px] gap-0.5 bg-green-600"><CheckCircle className="h-2.5 w-2.5" /> Approved</Badge>
                          )}
                          {c.status === 'rejected' && (
                            <Badge variant="destructive" className="mt-1 text-[10px] gap-0.5"><XCircle className="h-2.5 w-2.5" /> Rejected</Badge>
                          )}
                          {c.status === 'rejected' && c.rejection_reason && (
                            <p className="text-[10px] text-destructive/80 mt-0.5 truncate" title={c.rejection_reason}>Reason: {c.rejection_reason}</p>
                          )}
                        </div>
                        <div className="flex gap-1">
                          {c.status !== 'approved' && (
                            <Button size="icon" variant="ghost" className="h-7 w-7 text-green-500 hover:text-green-600" onClick={() => approveSmartLink(c.id)} title="Approve">
                              <CheckCircle className="h-3.5 w-3.5" />
                            </Button>
                          )}
                          {c.status !== 'rejected' && (
                            <Button size="icon" variant="ghost" className="h-7 w-7 text-red-500 hover:text-red-600" onClick={() => setRejectingId(c.id)} title="Reject">
                              <XCircle className="h-3.5 w-3.5" />
                            </Button>
                          )}
                          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setEditCustom(c)}>
                            <Edit className="h-3.5 w-3.5" />
                          </Button>
                          <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => deleteSmartLink(c.id)}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                      {active && (
                        <div className="flex items-center gap-2 p-2 rounded-md bg-primary/5 border border-primary/20">
                          <Link2 className="h-3.5 w-3.5 text-primary flex-shrink-0" />
                          <span className="text-[11px] text-muted-foreground flex-1 truncate font-mono">{url}</span>
                          <CopyButton value={url} />
                          <a href={url} target="_blank" rel="noopener noreferrer" className="text-primary hover:text-primary/80">
                            <ExternalLink className="h-3.5 w-3.5" />
                          </a>
                        </div>
                      )}
                    </GlassCard>
                  );
                })}
              </div>
            )}
          </TabsContent>

          {/* === PLATFORMS TAB === */}
          <TabsContent value="platforms" className="space-y-4 mt-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">Configure streaming platforms. Logos are auto-cropped to 128×128.</p>
              <Button size="sm" onClick={openNewPlatform}><Plus className="h-3.5 w-3.5 mr-1" /> Add Platform</Button>
            </div>

            {platformsLoading ? (
              <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
            ) : platforms.length === 0 ? (
              <GlassCard className="p-8 text-center">
                <Settings className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
                <p className="text-muted-foreground">No platforms configured</p>
              </GlassCard>
            ) : (
              <div className="space-y-2">
                {platforms.map(p => (
                  <GlassCard key={p.id} className={`p-3 flex items-center gap-3 ${!p.is_active ? 'opacity-50' : ''}`}>
                    <GripVertical className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    {p.icon_url ? (
                      <img src={p.icon_url} alt={p.name} className="h-8 w-8 rounded object-contain flex-shrink-0" />
                    ) : (
                      <div className="h-8 w-8 rounded bg-muted flex items-center justify-center flex-shrink-0">
                        <Music className="h-4 w-4 text-muted-foreground" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground">{p.name}</p>
                      <p className="text-xs text-muted-foreground truncate">{p.placeholder || 'No placeholder set'}</p>
                    </div>
                    <Badge variant={p.is_active ? 'default' : 'secondary'} className="text-[10px] cursor-pointer" onClick={() => togglePlatform(p)}>
                      {p.is_active ? 'Active' : 'Inactive'}
                    </Badge>
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => openEditPlatform(p)}>
                      <Edit className="h-3.5 w-3.5" />
                    </Button>
                    <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => deletePlatform(p.id)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </GlassCard>
                ))}
              </div>
            )}
          </TabsContent>

          {/* === API INTEGRATIONS TAB === */}
          <TabsContent value="apis" className="space-y-4 mt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Add external API keys for auto-filling platform links in the future.</p>
                <p className="text-xs text-muted-foreground/70 mt-0.5">e.g., Songlink/Odesli, MusicBrainz, or custom APIs</p>
              </div>
              <Button size="sm" onClick={openNewApi}><Plus className="h-3.5 w-3.5 mr-1" /> Add API</Button>
            </div>

            {apisLoading ? (
              <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
            ) : apiConfigs.length === 0 ? (
              <GlassCard className="p-8 text-center">
                <Key className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
                <p className="text-muted-foreground">No API integrations configured</p>
              </GlassCard>
            ) : (
              <div className="space-y-2">
                {apiConfigs.map(a => (
                  <GlassCard key={a.id} className={`p-4 space-y-2 ${!a.is_enabled ? 'opacity-60' : ''}`}>
                    <div className="flex items-center gap-3">
                      <Key className="h-5 w-5 text-primary flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground">{a.api_name}</p>
                        <p className="text-xs text-muted-foreground truncate font-mono">{a.api_url || 'No URL set'}</p>
                      </div>
                      <Badge variant={a.is_enabled ? 'default' : 'secondary'} className="text-[10px] cursor-pointer" onClick={() => toggleApi(a)}>
                        {a.is_enabled ? 'Enabled' : 'Disabled'}
                      </Badge>
                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => openEditApi(a)}>
                        <Edit className="h-3.5 w-3.5" />
                      </Button>
                      <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => deleteApi(a.id)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                    {a.api_key && (
                      <div className="flex items-center gap-2 p-2 rounded-md bg-muted/50">
                        <span className="text-[11px] text-muted-foreground font-mono flex-1 truncate">
                          API Key: {'•'.repeat(20)}
                        </span>
                      </div>
                    )}
                    {a.notes && <p className="text-xs text-muted-foreground">{a.notes}</p>}
                  </GlassCard>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* Edit Release Dialog */}
      <Dialog open={!!editRelease} onOpenChange={open => !open && setEditRelease(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Smart Link — {editRelease?.album_name || editRelease?.ep_name || 'Untitled'}</DialogTitle>
            <DialogDescription>Add platform URLs for this release's smart link page.</DialogDescription>
          </DialogHeader>
          {editRelease && (
            <PlatformLinksEditor
              releaseId={editRelease.id}
              releaseSlug={editRelease.slug}
              initialLinks={editRelease.platform_links || {}}
              onSaved={(links) => {
                setReleases(prev => prev.map(r => r.id === editRelease.id ? { ...r, platform_links: links } : r));
                setEditRelease(null);
              }}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Add/Edit Platform Dialog */}
      <Dialog open={newPlatform} onOpenChange={open => { if (!open) { setNewPlatform(false); setEditPlatform(null); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editPlatform ? 'Edit' : 'Add'} Platform</DialogTitle>
            <DialogDescription>Configure the streaming platform details. Logos are auto-cropped to 128×128 square.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="text-xs">Platform Name *</Label>
              <Input value={platformForm.name} onChange={e => setPlatformForm(p => ({ ...p, name: e.target.value }))} placeholder="e.g. Spotify" className="mt-1" />
            </div>
            <div>
              <Label className="text-xs">Platform Logo (auto-cropped to 128×128)</Label>
              <div className="flex items-center gap-3 mt-1">
                {platformForm.icon_url ? (
                  <img src={platformForm.icon_url} alt="icon" className="h-10 w-10 rounded object-contain border border-border" />
                ) : (
                  <div className="h-10 w-10 rounded border border-dashed border-border flex items-center justify-center">
                    <ImageIcon className="h-4 w-4 text-muted-foreground" />
                  </div>
                )}
                <div className="flex-1">
                  <Input type="file" accept="image/*" onChange={handleIconUpload} className="text-xs h-8" disabled={uploadingIcon} />
                  {uploadingIcon && <p className="text-[10px] text-primary mt-1 flex items-center gap-1"><Loader2 className="h-3 w-3 animate-spin" /> Cropping & uploading...</p>}
                  <p className="text-[10px] text-muted-foreground mt-1">Max 2MB. Any image will be auto-cropped to 128×128 PNG.</p>
                </div>
              </div>
              <div className="mt-2">
                <Label className="text-xs">Or paste logo URL</Label>
                <Input value={platformForm.icon_url} onChange={e => setPlatformForm(p => ({ ...p, icon_url: e.target.value }))} placeholder="https://..." className="mt-1 text-xs h-8" />
              </div>
            </div>
            <div>
              <Label className="text-xs">Placeholder URL</Label>
              <Input value={platformForm.placeholder} onChange={e => setPlatformForm(p => ({ ...p, placeholder: e.target.value }))} placeholder="e.g. https://open.spotify.com/..." className="mt-1 text-xs" />
            </div>
            <div className="flex items-center gap-2">
              <input type="checkbox" checked={platformForm.is_active} onChange={e => setPlatformForm(p => ({ ...p, is_active: e.target.checked }))} id="platform-active" />
              <Label htmlFor="platform-active" className="text-xs">Active (visible to users)</Label>
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" size="sm" onClick={() => { setNewPlatform(false); setEditPlatform(null); }}>Cancel</Button>
              <Button size="sm" onClick={savePlatform} disabled={saving}>
                {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : null}
                {editPlatform ? 'Update' : 'Add'} Platform
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Add/Edit API Dialog */}
      <Dialog open={newApi} onOpenChange={open => { if (!open) { setNewApi(false); setEditApi(null); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editApi ? 'Edit' : 'Add'} API Integration</DialogTitle>
            <DialogDescription>Configure an external API for auto-fetching platform links.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="text-xs">API Name *</Label>
              <Input value={apiForm.api_name} onChange={e => setApiForm(p => ({ ...p, api_name: e.target.value }))} placeholder="e.g. Songlink / Odesli" className="mt-1" />
            </div>
            <div>
              <Label className="text-xs">API Base URL</Label>
              <Input value={apiForm.api_url} onChange={e => setApiForm(p => ({ ...p, api_url: e.target.value }))} placeholder="https://api.example.com/v1/..." className="mt-1 text-xs font-mono" />
            </div>
            <div>
              <Label className="text-xs">API Key</Label>
              <div className="relative mt-1">
                <Input
                  type={showApiKey ? 'text' : 'password'}
                  value={apiForm.api_key}
                  onChange={e => setApiForm(p => ({ ...p, api_key: e.target.value }))}
                  placeholder="Paste your API key here"
                  className="text-xs font-mono pr-10"
                />
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
                  onClick={() => setShowApiKey(!showApiKey)}
                >
                  {showApiKey ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                </Button>
              </div>
            </div>
            <div>
              <Label className="text-xs">Notes / Instructions</Label>
              <Textarea
                value={apiForm.notes}
                onChange={e => setApiForm(p => ({ ...p, notes: e.target.value }))}
                placeholder="Where to get the API key, usage notes..."
                className="mt-1 text-xs min-h-[60px]"
              />
            </div>
            <div className="flex items-center gap-3">
              <Switch checked={apiForm.is_enabled} onCheckedChange={v => setApiForm(p => ({ ...p, is_enabled: v }))} id="api-enabled" />
              <Label htmlFor="api-enabled" className="text-xs">Enable this API</Label>
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" size="sm" onClick={() => { setNewApi(false); setEditApi(null); }}>Cancel</Button>
              <Button size="sm" onClick={saveApi} disabled={savingApi}>
                {savingApi ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : null}
                {editApi ? 'Update' : 'Add'} API
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Create Custom Smart Link Dialog */}
      <Dialog open={creatingCustom} onOpenChange={open => !open && setCreatingCustom(false)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create Smart Link</DialogTitle>
            <DialogDescription>Create a standalone smart link for any song.</DialogDescription>
          </DialogHeader>
          {user && (
            <SmartLinkEditor
              userId={user.id}
              onSaved={() => { setCreatingCustom(false); fetchCustomLinks(); }}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Edit Custom Smart Link Dialog */}
      <Dialog open={!!editCustom} onOpenChange={open => !open && setEditCustom(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Smart Link — {editCustom?.title}</DialogTitle>
            <DialogDescription>Update the smart link details and platform URLs.</DialogDescription>
          </DialogHeader>
          {editCustom && user && (
            <SmartLinkEditor
              smartLink={editCustom}
              userId={user.id}
              onSaved={() => { setEditCustom(null); fetchCustomLinks(); }}
            />
          )}
        </DialogContent>
      </Dialog>
      {/* Reject Reason Modal */}
      <RejectReasonModal
        open={!!rejectingId}
        title="Reject Smart Link"
        onConfirm={(reason) => rejectingId && rejectSmartLink(rejectingId, reason)}
        onCancel={() => setRejectingId(null)}
      />
    </DashboardLayout>
  );
}
