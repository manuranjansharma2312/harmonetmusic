import { useState, useEffect, useRef } from 'react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { GlassCard } from '@/components/GlassCard';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';
import { Loader2, Settings, Tv } from 'lucide-react';
import { useSiteSettings } from '@/hooks/useSiteSettings';

export default function AdminVevoSettings() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { settings, isLoading } = useSiteSettings();
  const [enabled, setEnabled] = useState(true);
  const [settingsId, setSettingsId] = useState('');
  const [saving, setSaving] = useState(false);
  const initialized = useRef(false);

  useEffect(() => {
    if (settings && !initialized.current) {
      setEnabled(settings.enable_vevo);
      setSettingsId(settings.id);
      initialized.current = true;
    }
  }, [settings]);

  const handleSave = async () => {
    if (!user || !settingsId) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from('site_settings')
        .update({
          enable_vevo: enabled,
          enable_video_distribution: enabled,
          updated_by: user.id,
          updated_at: new Date().toISOString(),
        } as any)
        .eq('id', settingsId);
      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: ['site-settings'] });
      toast.success(enabled ? 'Vevo services enabled!' : 'Vevo services disabled!');
    } catch (err: any) {
      toast.error(err.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Settings className="h-6 w-6 text-primary" />
              Vevo Settings
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Control Vevo services visibility across the platform.
            </p>
          </div>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-5 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
          >
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            Save Settings
          </button>
        </div>

        <GlassCard>
          <h2 className="text-lg font-semibold flex items-center gap-2 mb-4">
            <Tv className="h-5 w-5 text-primary" /> Vevo Services
          </h2>
          <div className="flex items-start justify-between gap-4 py-2">
            <div className="min-w-0">
              <p className="text-sm font-medium text-foreground">Enable Vevo Services</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                When disabled, Video Distribution and Vevo Reports are hidden from the sidebar for all users and admin.
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={enabled}
              onClick={() => setEnabled(!enabled)}
              className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full transition-colors duration-200 ${enabled ? 'bg-primary' : 'bg-muted'}`}
            >
              <span className={`inline-block h-5 w-5 rounded-full bg-background shadow-sm transform transition-transform duration-200 mt-0.5 ${enabled ? 'translate-x-5 ml-0.5' : 'translate-x-0.5'}`} />
            </button>
          </div>
        </GlassCard>
      </div>
    </DashboardLayout>
  );
}
