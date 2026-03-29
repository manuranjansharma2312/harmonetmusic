import { useState, useEffect } from 'react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { GlassCard } from '@/components/GlassCard';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useSiteSettings } from '@/hooks/useSiteSettings';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Loader2, Settings, Youtube } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';

export default function AdminYouTubeCmsSettings() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { settings, isLoading } = useSiteSettings();
  const [enabled, setEnabled] = useState(true);
  const [saving, setSaving] = useState(false);
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    if (settings && !initialized) {
      setEnabled((settings as any).enable_youtube_cms ?? true);
      setInitialized(true);
    }
  }, [settings, initialized]);

  const handleSave = async () => {
    if (!user || !settings?.id) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from('site_settings')
        .update({
          enable_youtube_cms: enabled,
          updated_by: user.id,
          updated_at: new Date().toISOString(),
        } as any)
        .eq('id', settings.id);
      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: ['site-settings'] });
      toast.success('YouTube CMS settings saved successfully');
    } catch (err: any) {
      toast.error(err.message || 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="flex justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Settings className="h-6 w-6 text-primary" />
            <h1 className="text-2xl font-bold">YouTube CMS Settings</h1>
          </div>
          <Button onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            Save Settings
          </Button>
        </div>

        <GlassCard>
          <h2 className="text-lg font-semibold flex items-center gap-2 mb-4">
            <Youtube className="h-5 w-5 text-red-500" /> Module Visibility
          </h2>
          <div className="flex items-start justify-between gap-4 py-2">
            <div className="min-w-0">
              <Label className="text-sm font-medium">Enable YouTube CMS</Label>
              <p className="text-xs text-muted-foreground mt-0.5">
                When disabled, the entire YouTube CMS section (CMS Link, CMS Reports, CMS Analytics, CMS Revenue) will be hidden from the sidebar for all users including admins.
              </p>
            </div>
            <Switch checked={enabled} onCheckedChange={setEnabled} />
          </div>
        </GlassCard>
      </div>
    </DashboardLayout>
  );
}
