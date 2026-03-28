import { useState, useEffect } from 'react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { GlassCard } from '@/components/GlassCard';
import { BrandingCropModal } from '@/components/BrandingCropModal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Save, Loader2, Globe, Image, Ruler, Upload } from 'lucide-react';

export default function AdminBrandingSettings() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState<string | null>(null);
  const [cropState, setCropState] = useState<{ field: 'logo_url' | 'favicon_url'; src: string } | null>(null);
  const [form, setForm] = useState({
    id: '',
    site_name: 'Harmonet Music',
    tagline: 'Harmony On Networks',
    favicon_url: '',
    logo_url: '',
    login_logo_height: 64,
    sidebar_logo_height: 56,
    sidebar_collapsed_logo_height: 28,
    mobile_header_logo_height: 36,
  });

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from('branding_settings')
        .select('*')
        .limit(1)
        .maybeSingle();
      if (!error && data) {
        setForm({
          id: data.id,
          site_name: (data as any).site_name || '',
          tagline: (data as any).tagline || '',
          favicon_url: (data as any).favicon_url || '',
          logo_url: (data as any).logo_url || '',
          login_logo_height: (data as any).login_logo_height || 64,
          sidebar_logo_height: (data as any).sidebar_logo_height || 56,
          sidebar_collapsed_logo_height: (data as any).sidebar_collapsed_logo_height || 28,
          mobile_header_logo_height: (data as any).mobile_header_logo_height || 36,
        });
      }
      setLoading(false);
    })();
  }, []);

  const handleFileSelect = (field: 'logo_url' | 'favicon_url', file: File) => {
    const reader = new FileReader();
    reader.onload = () => setCropState({ field, src: reader.result as string });
    reader.readAsDataURL(file);
  };

  const handleCroppedUpload = async (file: File) => {
    if (!cropState) return;
    const field = cropState.field;
    setCropState(null);
    setUploading(field);
    try {
      const path = `branding/${field}-${Date.now()}.png`;
      const { error } = await supabase.storage.from('posters').upload(path, file, { upsert: true });
      if (error) throw error;
      const { data: urlData } = supabase.storage.from('posters').getPublicUrl(path);
      setForm(f => ({ ...f, [field]: urlData.publicUrl }));
      toast.success(`${field === 'logo_url' ? 'Logo' : 'Favicon'} uploaded`);
    } catch (err: any) {
      toast.error(err.message || 'Upload failed');
    }
    setUploading(null);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase
        .from('branding_settings')
        .update({
          site_name: form.site_name,
          tagline: form.tagline,
          favicon_url: form.favicon_url || null,
          logo_url: form.logo_url || null,
          login_logo_height: form.login_logo_height,
          sidebar_logo_height: form.sidebar_logo_height,
          sidebar_collapsed_logo_height: form.sidebar_collapsed_logo_height,
          mobile_header_logo_height: form.mobile_header_logo_height,
          updated_by: user?.id,
          updated_at: new Date().toISOString(),
        } as any)
        .eq('id', form.id);
      if (error) throw error;
      toast.success('Branding settings saved! Refresh the page to see changes.');
    } catch (err: any) {
      toast.error(err.message || 'Failed to save');
    }
    setSaving(false);
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64 text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin mr-2" /> Loading...
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Globe className="h-6 w-6 text-primary" />
              Site Settings
            </h1>
            <p className="text-sm text-muted-foreground mt-1">Manage your site name, logo, favicon, and logo sizes</p>
          </div>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
            Save Settings
          </Button>
        </div>

        {/* Site Identity */}
        <GlassCard className="p-6">
          <div className="flex items-center gap-2 mb-4">
            <Globe className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-semibold">Site Identity</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label>Site Name</Label>
              <Input
                value={form.site_name}
                onChange={e => setForm(f => ({ ...f, site_name: e.target.value }))}
                placeholder="Harmonet Music"
              />
              <p className="text-xs text-muted-foreground mt-1">Appears in browser tab, emails, and across the platform</p>
            </div>
            <div>
              <Label>Tagline</Label>
              <Input
                value={form.tagline}
                onChange={e => setForm(f => ({ ...f, tagline: e.target.value }))}
                placeholder="Harmony On Networks"
              />
              <p className="text-xs text-muted-foreground mt-1">Shown alongside the site name in the browser tab</p>
            </div>
          </div>
        </GlassCard>

        {/* Logo & Favicon */}
        <GlassCard className="p-6">
          <div className="flex items-center gap-2 mb-4">
            <Image className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-semibold">Logo & Favicon</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Logo */}
            <div className="space-y-3">
              <Label>Logo</Label>
              <div className="flex items-center gap-4">
                {form.logo_url && (
                  <div className="p-3 rounded-lg bg-muted/50 border">
                    <img src={form.logo_url} alt="Logo preview" className="h-12 w-auto" />
                  </div>
                )}
                <label className="flex items-center gap-2 px-4 py-2.5 border-2 border-dashed rounded-lg cursor-pointer hover:bg-muted/50 transition-colors">
                  {uploading === 'logo_url' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                  <span className="text-sm">Upload Logo</span>
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={e => e.target.files?.[0] && handleUpload('logo_url', e.target.files[0])}
                  />
                </label>
              </div>
              <div>
                <Label className="text-xs">Or paste Logo URL</Label>
                <Input
                  value={form.logo_url}
                  onChange={e => setForm(f => ({ ...f, logo_url: e.target.value }))}
                  placeholder="https://..."
                />
              </div>
              <p className="text-xs text-muted-foreground">Used in sidebar, header, login page. Recommended: PNG with transparent background.</p>
            </div>

            {/* Favicon */}
            <div className="space-y-3">
              <Label>Favicon</Label>
              <div className="flex items-center gap-4">
                {form.favicon_url && (
                  <div className="p-3 rounded-lg bg-muted/50 border">
                    <img src={form.favicon_url} alt="Favicon preview" className="h-8 w-8 object-contain" />
                  </div>
                )}
                <label className="flex items-center gap-2 px-4 py-2.5 border-2 border-dashed rounded-lg cursor-pointer hover:bg-muted/50 transition-colors">
                  {uploading === 'favicon_url' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                  <span className="text-sm">Upload Favicon</span>
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={e => e.target.files?.[0] && handleUpload('favicon_url', e.target.files[0])}
                  />
                </label>
              </div>
              <div>
                <Label className="text-xs">Or paste Favicon URL</Label>
                <Input
                  value={form.favicon_url}
                  onChange={e => setForm(f => ({ ...f, favicon_url: e.target.value }))}
                  placeholder="https://..."
                />
              </div>
              <p className="text-xs text-muted-foreground">Browser tab icon. Recommended: 32×32 or 64×64 PNG/ICO.</p>
            </div>
          </div>
        </GlassCard>

        {/* Logo Size Configuration */}
        <GlassCard className="p-6">
          <div className="flex items-center gap-2 mb-4">
            <Ruler className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-semibold">Logo Size (Pixels)</h2>
          </div>
          <p className="text-xs text-muted-foreground mb-4">
            Control the logo height in different areas of the application. Width adjusts automatically to maintain aspect ratio.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <Label>Login Page</Label>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  min={24}
                  max={200}
                  value={form.login_logo_height}
                  onChange={e => setForm(f => ({ ...f, login_logo_height: Number(e.target.value) }))}
                />
                <span className="text-sm text-muted-foreground">px</span>
              </div>
            </div>
            <div>
              <Label>Sidebar (Expanded)</Label>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  min={20}
                  max={120}
                  value={form.sidebar_logo_height}
                  onChange={e => setForm(f => ({ ...f, sidebar_logo_height: Number(e.target.value) }))}
                />
                <span className="text-sm text-muted-foreground">px</span>
              </div>
            </div>
            <div>
              <Label>Sidebar (Collapsed)</Label>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  min={16}
                  max={60}
                  value={form.sidebar_collapsed_logo_height}
                  onChange={e => setForm(f => ({ ...f, sidebar_collapsed_logo_height: Number(e.target.value) }))}
                />
                <span className="text-sm text-muted-foreground">px</span>
              </div>
            </div>
            <div>
              <Label>Mobile Header</Label>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  min={20}
                  max={80}
                  value={form.mobile_header_logo_height}
                  onChange={e => setForm(f => ({ ...f, mobile_header_logo_height: Number(e.target.value) }))}
                />
                <span className="text-sm text-muted-foreground">px</span>
              </div>
            </div>
          </div>

          {/* Live Preview */}
          <div className="mt-6 p-4 rounded-lg border bg-muted/20">
            <p className="text-xs font-medium text-muted-foreground mb-3">Live Preview</p>
            <div className="flex items-end gap-6 flex-wrap">
              <div className="text-center">
                <p className="text-[10px] text-muted-foreground mb-1">Login</p>
                <div className="p-2 rounded border bg-background">
                  <img
                    src={form.logo_url || '/placeholder.svg'}
                    alt="Login preview"
                    style={{ height: `${Math.min(form.login_logo_height, 80)}px` }}
                    className="w-auto"
                  />
                </div>
              </div>
              <div className="text-center">
                <p className="text-[10px] text-muted-foreground mb-1">Sidebar</p>
                <div className="p-2 rounded border bg-background">
                  <img
                    src={form.logo_url || '/placeholder.svg'}
                    alt="Sidebar preview"
                    style={{ height: `${Math.min(form.sidebar_logo_height, 60)}px` }}
                    className="w-auto"
                  />
                </div>
              </div>
              <div className="text-center">
                <p className="text-[10px] text-muted-foreground mb-1">Collapsed</p>
                <div className="p-2 rounded border bg-background">
                  <img
                    src={form.logo_url || '/placeholder.svg'}
                    alt="Collapsed preview"
                    style={{ height: `${Math.min(form.sidebar_collapsed_logo_height, 40)}px` }}
                    className="w-auto"
                  />
                </div>
              </div>
              <div className="text-center">
                <p className="text-[10px] text-muted-foreground mb-1">Mobile</p>
                <div className="p-2 rounded border bg-background">
                  <img
                    src={form.logo_url || '/placeholder.svg'}
                    alt="Mobile preview"
                    style={{ height: `${Math.min(form.mobile_header_logo_height, 50)}px` }}
                    className="w-auto"
                  />
                </div>
              </div>
            </div>
          </div>
        </GlassCard>

        <div className="p-4 rounded-lg border bg-muted/20">
          <p className="text-xs text-muted-foreground">
            Changes to logo and favicon will take effect after saving and refreshing the page. The favicon will update in the browser tab automatically.
          </p>
        </div>
      </div>
    </DashboardLayout>
  );
}
