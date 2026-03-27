import { useState, useEffect } from 'react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { GlassCard } from '@/components/GlassCard';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';
import { Loader2, Settings, Zap, Image, Monitor, Shield, Database, RefreshCw } from 'lucide-react';
import { useSiteSettings, type SiteSettings } from '@/hooks/useSiteSettings';

export default function AdminSiteSettings() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { settings, isLoading } = useSiteSettings();
  const [form, setForm] = useState<SiteSettings | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (settings && !form) setForm(settings);
  }, [settings]);

  const update = <K extends keyof SiteSettings>(key: K, value: SiteSettings[K]) =>
    setForm((p) => (p ? { ...p, [key]: value } : p));

  const handleSave = async () => {
    if (!form || !user) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from('site_settings')
        .update({
          enable_background_animations: form.enable_background_animations,
          enable_anti_inspection: form.enable_anti_inspection,
          query_stale_time: form.query_stale_time,
          query_cache_time: form.query_cache_time,
          query_retry_count: form.query_retry_count,
          enable_lazy_loading: form.enable_lazy_loading,
          image_quality: form.image_quality,
          enable_image_lazy_load: form.enable_image_lazy_load,
          enable_page_transitions: form.enable_page_transitions,
          max_table_rows: form.max_table_rows,
          updated_by: user.id,
          updated_at: new Date().toISOString(),
        } as any)
        .eq('id', form.id);
      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: ['site-settings'] });
      toast.success('Site settings saved! Changes take effect on next page load.');
    } catch (err: any) {
      toast.error(err.message || 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const handleClearCache = () => {
    queryClient.clear();
    toast.success('Client cache cleared successfully');
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
              Site Settings
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Optimize performance, fix lag & loading issues. Works on all hosting servers.
            </p>
          </div>
          <div className="flex gap-2">
            <button onClick={handleClearCache} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-muted text-foreground text-sm font-medium hover:bg-muted/80 transition-colors">
              <RefreshCw className="h-4 w-4" /> Clear Cache
            </button>
            <button onClick={handleSave} disabled={saving} className="flex items-center gap-2 px-5 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Save Settings
            </button>
          </div>
        </div>

        {/* Performance */}
        <GlassCard>
          <h2 className="text-lg font-semibold flex items-center gap-2 mb-4">
            <Zap className="h-5 w-5 text-yellow-500" /> Performance & Speed
          </h2>
          <div className="space-y-4">
            <ToggleRow
              label="Background Animations"
              description="Floating gradient blobs on all pages. Disable to reduce GPU usage and improve performance on low-end devices."
              checked={form.enable_background_animations}
              onChange={(v) => update('enable_background_animations', v)}
            />
            <ToggleRow
              label="Page Transitions"
              description="Smooth fade animations when navigating between pages. Disable for instant page switches."
              checked={form.enable_page_transitions}
              onChange={(v) => update('enable_page_transitions', v)}
            />
            <ToggleRow
              label="Lazy Loading (Code Splitting)"
              description="Load pages on-demand instead of all at once. Keeps initial load fast. Recommended: ON."
              checked={form.enable_lazy_loading}
              onChange={(v) => update('enable_lazy_loading', v)}
            />
          </div>
        </GlassCard>

        {/* Data & Caching */}
        <GlassCard>
          <h2 className="text-lg font-semibold flex items-center gap-2 mb-4">
            <Database className="h-5 w-5 text-blue-500" /> Data & Caching
          </h2>
          <div className="space-y-4">
            <NumberRow
              label="Query Stale Time (ms)"
              description="How long fetched data stays fresh before re-fetching. Higher = fewer network requests, lower = fresher data."
              value={form.query_stale_time}
              onChange={(v) => update('query_stale_time', v)}
              min={5000}
              max={600000}
              step={5000}
              presets={[
                { label: '30s', value: 30000 },
                { label: '1m', value: 60000 },
                { label: '2m', value: 120000 },
                { label: '5m', value: 300000 },
              ]}
            />
            <NumberRow
              label="Query Cache Time (ms)"
              description="How long inactive data is kept in memory. Higher = faster back-navigation, more memory usage."
              value={form.query_cache_time}
              onChange={(v) => update('query_cache_time', v)}
              min={60000}
              max={1800000}
              step={60000}
              presets={[
                { label: '1m', value: 60000 },
                { label: '5m', value: 300000 },
                { label: '10m', value: 600000 },
                { label: '30m', value: 1800000 },
              ]}
            />
            <NumberRow
              label="Query Retry Count"
              description="How many times to retry a failed network request. 0 = no retries (fastest failure), 3 = most resilient."
              value={form.query_retry_count}
              onChange={(v) => update('query_retry_count', v)}
              min={0}
              max={5}
              step={1}
              presets={[
                { label: '0', value: 0 },
                { label: '1', value: 1 },
                { label: '2', value: 2 },
                { label: '3', value: 3 },
              ]}
            />
            <NumberRow
              label="Table Rows Per Page"
              description="Maximum rows displayed in data tables. Lower = faster rendering on large datasets."
              value={form.max_table_rows}
              onChange={(v) => update('max_table_rows', v)}
              min={10}
              max={200}
              step={10}
              presets={[
                { label: '25', value: 25 },
                { label: '50', value: 50 },
                { label: '100', value: 100 },
              ]}
            />
          </div>
        </GlassCard>

        {/* Images */}
        <GlassCard>
          <h2 className="text-lg font-semibold flex items-center gap-2 mb-4">
            <Image className="h-5 w-5 text-green-500" /> Image Optimization
          </h2>
          <div className="space-y-4">
            <ToggleRow
              label="Lazy Load Images"
              description="Load images only when they scroll into view. Reduces initial page weight."
              checked={form.enable_image_lazy_load}
              onChange={(v) => update('enable_image_lazy_load', v)}
            />
            <NumberRow
              label="Image Quality (%)"
              description="JPEG/WebP compression quality for generated images. Lower = smaller files & faster loads."
              value={form.image_quality}
              onChange={(v) => update('image_quality', v)}
              min={30}
              max={100}
              step={5}
              presets={[
                { label: '60%', value: 60 },
                { label: '80%', value: 80 },
                { label: '100%', value: 100 },
              ]}
            />
          </div>
        </GlassCard>

        {/* Security */}
        <GlassCard>
          <h2 className="text-lg font-semibold flex items-center gap-2 mb-4">
            <Shield className="h-5 w-5 text-red-500" /> Security & Protection
          </h2>
          <div className="space-y-4">
            <ToggleRow
              label="Anti-Inspection Mode"
              description="Blocks right-click, DevTools shortcuts, and view-source in production. Disable for debugging."
              checked={form.enable_anti_inspection}
              onChange={(v) => update('enable_anti_inspection', v)}
            />
          </div>
        </GlassCard>

        {/* Quick Fix Tips */}
        <GlassCard>
          <h2 className="text-lg font-semibold flex items-center gap-2 mb-4">
            <Monitor className="h-5 w-5 text-purple-500" /> Quick Fix Guide
          </h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <TipCard title="🐌 Slow Loading" tip="Increase stale time to 2-5 min, enable lazy loading, disable background animations." />
            <TipCard title="🔄 Laggy Scrolling" tip="Disable background animations, reduce table rows to 25, enable image lazy loading." />
            <TipCard title="📱 Slow on Mobile" tip="Disable page transitions & animations, lower image quality to 60%, reduce cache time." />
            <TipCard title="⚡ Self-Hosted Server" tip="Set stale time to 2min+, cache time to 10min+, retry count to 2-3 for resilience." />
            <TipCard title="🧹 Stale Data" tip="Click 'Clear Cache' button above, reduce stale time to 30s for real-time freshness." />
            <TipCard title="🔒 Need to Debug" tip="Temporarily disable Anti-Inspection to access browser DevTools for troubleshooting." />
          </div>
        </GlassCard>
      </div>
    </DashboardLayout>
  );
}

/* ── Sub-components ── */

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

function NumberRow({ label, description, value, onChange, min, max, step, presets }: {
  label: string; description: string; value: number; onChange: (v: number) => void;
  min: number; max: number; step: number;
  presets?: { label: string; value: number }[];
}) {
  return (
    <div className="py-2 space-y-2">
      <div>
        <p className="text-sm font-medium text-foreground">{label}</p>
        <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
      </div>
      <div className="flex items-center gap-3 flex-wrap">
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="flex-1 min-w-[120px] accent-primary"
        />
        <span className="text-sm font-mono text-foreground w-20 text-right">{value.toLocaleString()}</span>
      </div>
      {presets && (
        <div className="flex gap-1.5 flex-wrap">
          {presets.map((p) => (
            <button
              key={p.value}
              type="button"
              onClick={() => onChange(p.value)}
              className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${value === p.value ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:text-foreground'}`}
            >
              {p.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function TipCard({ title, tip }: { title: string; tip: string }) {
  return (
    <div className="rounded-lg border border-border/50 bg-muted/30 p-3">
      <p className="text-sm font-medium mb-1">{title}</p>
      <p className="text-xs text-muted-foreground">{tip}</p>
    </div>
  );
}
