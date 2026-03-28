import { useState, useEffect, useRef } from 'react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { GlassCard } from '@/components/GlassCard';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';
import { Loader2, Settings, Video, Tv } from 'lucide-react';
import { useSiteSettings, type SiteSettings } from '@/hooks/useSiteSettings';

export default function AdminVevoSettings() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { settings, isLoading } = useSiteSettings();
  const [form, setForm] = useState<Pick<SiteSettings, 'id' | 'enable_vevo' | 'enable_video_distribution'> | null>(null);
  const [saving, setSaving] = useState(false);
  const initialized = useRef(false);

  useEffect(() => {
    if (settings && !initialized.current) {
      setForm({
        id: settings.id,
        enable_vevo: settings.enable_vevo,
        enable_video_distribution: settings.enable_video_distribution,
      });
      initialized.current = true;
    }
  }, [settings]);

  const handleSave = async () => {
    if (!form || !user) return;
    setSaving(true);
    try {
      const { id, ...fields } = form;
      const { error } = await supabase
        .from('site_settings')
        .update({
          ...fields,
          updated_by: user.id,
          updated_at: new Date().toISOString(),
        } as any)
        .eq('id', form.id);
      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: ['site-settings'] });
      toast.success('Vevo settings saved!');
    } catch (err: any) {
      toast.error(err.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  if (isLoading || !form) {
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
            <Video className="h-5 w-5 text-primary" /> Video Distribution
          </h2>
          <ToggleRow
            label="Enable Video Distribution"
            description="When disabled, the entire Video Distribution section (Upload Video, Vevo Channels, My Videos, Guidelines) is hidden from sidebar for all users and admin."
            checked={form.enable_video_distribution}
            onChange={(v) => setForm((p) => p ? { ...p, enable_video_distribution: v } : p)}
          />
        </GlassCard>

        <GlassCard>
          <h2 className="text-lg font-semibold flex items-center gap-2 mb-4">
            <Tv className="h-5 w-5 text-primary" /> Vevo Reports
          </h2>
          <ToggleRow
            label="Enable Vevo Reports"
            description="When disabled, the Vevo Reports tab is hidden from Reports & Analytics for both users and admin. Other reports (OTT, YouTube) remain unaffected."
            checked={form.enable_vevo}
            onChange={(v) => setForm((p) => p ? { ...p, enable_vevo: v } : p)}
          />
        </GlassCard>
      </div>
    </DashboardLayout>
  );
}

function ToggleRow({ label, description, checked, onChange }: {
  label: string; description: string; checked: boolean; onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-start justify-between gap-4 py-2">
      <div className="min-w-0">
        <p className="text-sm font-medium text-foreground">{label}</p>
        <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full transition-colors duration-200 ${checked ? 'bg-primary' : 'bg-muted'}`}
      >
        <span className={`inline-block h-5 w-5 rounded-full bg-background shadow-sm transform transition-transform duration-200 mt-0.5 ${checked ? 'translate-x-5 ml-0.5' : 'translate-x-0.5'}`} />
      </button>
    </div>
  );
}
