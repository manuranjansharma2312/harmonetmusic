import { useState, useEffect, useRef, useCallback } from 'react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { GlassCard } from '@/components/GlassCard';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';
import {
  Loader2, Settings, Zap, Image, Monitor, Shield, Database, RefreshCw,
  Bell, Wifi, Clock, Upload, Terminal, AlertTriangle, Type, Gauge, RotateCcw,
} from 'lucide-react';
import { useSiteSettings, SITE_SETTINGS_DEFAULTS, type SiteSettings } from '@/hooks/useSiteSettings';

export default function AdminSiteSettings() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { settings, isLoading } = useSiteSettings();
  const [form, setForm] = useState<SiteSettings | null>(null);
  const [saving, setSaving] = useState(false);
  const formInitialized = useRef(false);

  useEffect(() => {
    if (settings && !formInitialized.current) {
      setForm(settings);
      formInitialized.current = true;
    }
  }, [settings]);

  const update = useCallback(<K extends keyof SiteSettings>(key: K, value: SiteSettings[K]) =>
    setForm((p) => (p ? { ...p, [key]: value } : p)), []);

  const handleSave = async () => {
    if (!form || !user) return;
    setSaving(true);
    try {
      const { id, updated_at, updated_by, ...fields } = form;
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

  const applyPreset = (preset: 'performance' | 'balanced' | 'quality') => {
    if (!form) return;
    const presets: Record<string, Partial<SiteSettings>> = {
      performance: {
        enable_background_animations: false,
        enable_page_transitions: false,
        query_stale_time: 300000,
        query_cache_time: 600000,
        query_retry_count: 1,
        max_table_rows: 25,
        image_quality: 60,
        enable_image_lazy_load: true,
        enable_prefetch: false,
        debounce_delay: 500,
        toast_duration: 3000,
      },
      balanced: {
        enable_background_animations: true,
        enable_page_transitions: true,
        query_stale_time: 60000,
        query_cache_time: 300000,
        query_retry_count: 1,
        max_table_rows: 50,
        image_quality: 80,
        enable_image_lazy_load: true,
        enable_prefetch: true,
        debounce_delay: 300,
        toast_duration: 4000,
      },
      quality: {
        enable_background_animations: true,
        enable_page_transitions: true,
        query_stale_time: 30000,
        query_cache_time: 120000,
        query_retry_count: 2,
        max_table_rows: 100,
        image_quality: 100,
        enable_image_lazy_load: false,
        enable_prefetch: true,
        debounce_delay: 200,
        toast_duration: 5000,
      },
    };
    setForm((p) => (p ? { ...p, ...presets[preset] } : p));
    toast.success(`Applied "${preset}" preset. Click Save to apply.`);
  };

  const handleResetDefaults = () => {
    if (!form) return;
    setForm((p) => (p ? { ...p, ...SITE_SETTINGS_DEFAULTS, id: p.id, updated_at: p.updated_at, updated_by: p.updated_by } : p));
    toast.success('Reset to defaults (Max Performance). Click Save to apply.');
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
        {/* Header */}
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
          <div className="flex gap-2 flex-wrap">
            <button onClick={handleClearCache} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-muted text-foreground text-sm font-medium hover:bg-muted/80 transition-colors">
              <RefreshCw className="h-4 w-4" /> Clear Cache
            </button>
            <button onClick={handleSave} disabled={saving} className="flex items-center gap-2 px-5 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Save Settings
            </button>
          </div>
        </div>

        {/* Quick Presets */}
        <GlassCard>
          <h2 className="text-lg font-semibold flex items-center gap-2 mb-3">
            <Gauge className="h-5 w-5 text-primary" /> Quick Presets
          </h2>
          <p className="text-xs text-muted-foreground mb-3">Apply a preset to quickly configure multiple settings at once.</p>
          <div className="flex gap-2 flex-wrap">
            <button onClick={() => applyPreset('performance')} className="px-4 py-2 rounded-lg bg-green-500/10 text-green-400 text-sm font-medium hover:bg-green-500/20 transition-colors border border-green-500/20">
              ⚡ Max Performance
            </button>
            <button onClick={() => applyPreset('balanced')} className="px-4 py-2 rounded-lg bg-blue-500/10 text-blue-400 text-sm font-medium hover:bg-blue-500/20 transition-colors border border-blue-500/20">
              ⚖️ Balanced
            </button>
            <button onClick={() => applyPreset('quality')} className="px-4 py-2 rounded-lg bg-purple-500/10 text-purple-400 text-sm font-medium hover:bg-purple-500/20 transition-colors border border-purple-500/20">
              💎 Max Quality
            </button>
            <button onClick={handleResetDefaults} className="px-4 py-2 rounded-lg bg-destructive/10 text-destructive text-sm font-medium hover:bg-destructive/20 transition-colors border border-destructive/20 flex items-center gap-1.5">
              <RotateCcw className="h-3.5 w-3.5" /> Reset to Defaults
            </button>
          </div>
        </GlassCard>

        {/* Maintenance Mode */}
        <GlassCard>
          <h2 className="text-lg font-semibold flex items-center gap-2 mb-4">
            <AlertTriangle className="h-5 w-5 text-orange-500" /> Maintenance Mode
          </h2>
          <div className="space-y-4">
            <ToggleRow
              label="Enable Maintenance Mode"
              description="Show a maintenance page to all non-admin users. Useful during updates or migrations."
              checked={form.maintenance_mode}
              onChange={(v) => update('maintenance_mode', v)}
            />
            {form.maintenance_mode && (
              <div>
                <p className="text-sm font-medium text-foreground mb-1">Maintenance Message</p>
                <textarea
                  className="w-full rounded-lg bg-muted/50 border border-border/50 px-3 py-2 text-sm text-foreground resize-none focus:outline-none focus:ring-2 focus:ring-primary/50"
                  rows={3}
                  value={form.maintenance_message}
                  onChange={(e) => update('maintenance_message', e.target.value)}
                  placeholder="Enter maintenance message..."
                />
              </div>
            )}
          </div>
        </GlassCard>

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
            <ToggleRow
              label="Prefetch on Hover"
              description="Pre-load page data when hovering over navigation links. Uses more bandwidth but makes navigation instant."
              checked={form.enable_prefetch}
              onChange={(v) => update('enable_prefetch', v)}
            />
            <NumberRow
              label="Debounce Delay (ms)"
              description="Delay before search/filter inputs trigger a data fetch. Higher = fewer requests, lower = more responsive."
              value={form.debounce_delay}
              onChange={(v) => update('debounce_delay', v)}
              min={100}
              max={1000}
              step={50}
              presets={[
                { label: '150ms', value: 150 },
                { label: '300ms', value: 300 },
                { label: '500ms', value: 500 },
              ]}
            />
          </div>
        </GlassCard>

        {/* Data & Caching */}
        <GlassCard>
          <h2 className="text-lg font-semibold flex items-center gap-2 mb-4">
            <Database className="h-5 w-5 text-blue-500" /> Data & Caching
          </h2>
          <div className="space-y-4">
            <ToggleRow
              label="Auto Clear Cache"
              description="Automatically clear client-side cache at a set interval to prevent stale data and memory buildup."
              checked={form.auto_clear_cache_enabled}
              onChange={(v) => update('auto_clear_cache_enabled', v)}
            />
            {form.auto_clear_cache_enabled && (
              <NumberRow
                label="Auto Clear Interval"
                description={`How often to automatically clear the cache. Current: ${form.auto_clear_cache_interval >= 86400000 ? `${(form.auto_clear_cache_interval / 86400000).toFixed(0)} day(s)` : form.auto_clear_cache_interval >= 3600000 ? `${(form.auto_clear_cache_interval / 3600000).toFixed(1)} hour(s)` : `${(form.auto_clear_cache_interval / 60000).toFixed(0)} min`}`}
                value={form.auto_clear_cache_interval}
                onChange={(v) => update('auto_clear_cache_interval', v)}
                min={300000}
                max={86400000}
                step={300000}
                presets={[
                  { label: '5 min', value: 300000 },
                  { label: '15 min', value: 900000 },
                  { label: '30 min', value: 1800000 },
                  { label: '1 hour', value: 3600000 },
                  { label: '6 hours', value: 21600000 },
                  { label: '12 hours', value: 43200000 },
                  { label: '24 hours', value: 86400000 },
                ]}
                formatValue={(v) => {
                  if (v >= 86400000) return `${(v / 86400000).toFixed(0)}d`;
                  if (v >= 3600000) return `${(v / 3600000).toFixed(1)}h`;
                  return `${(v / 60000).toFixed(0)}m`;
                }}
              />
            )}
            <NumberRow
              label="Query Stale Time (ms)"
              description="How long fetched data stays fresh before re-fetching. Higher = fewer network requests."
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
              description="How long inactive data is kept in memory. Higher = faster back-navigation."
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
              description="How many times to retry a failed network request. 0 = no retries, 3 = most resilient."
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
            <ToggleRow
              label="Realtime Subscriptions"
              description="Enable live database updates via WebSocket. Disable to reduce server load if real-time isn't needed."
              checked={form.enable_realtime}
              onChange={(v) => update('enable_realtime', v)}
            />
          </div>
        </GlassCard>

        {/* Images & Uploads */}
        <GlassCard>
          <h2 className="text-lg font-semibold flex items-center gap-2 mb-4">
            <Image className="h-5 w-5 text-green-500" /> Images & Uploads
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
            <NumberRow
              label="Max Upload Size (MB)"
              description="Maximum file size allowed for uploads (audio, images, documents)."
              value={form.max_upload_size_mb}
              onChange={(v) => update('max_upload_size_mb', v)}
              min={5}
              max={999}
              step={5}
              presets={[
                { label: '25 MB', value: 25 },
                { label: '50 MB', value: 50 },
                { label: '100 MB', value: 100 },
                { label: '250 MB', value: 250 },
                { label: '500 MB', value: 500 },
                { label: '999 MB', value: 999 },
              ]}
            />
          </div>
        </GlassCard>

        {/* Notifications */}
        <GlassCard>
          <h2 className="text-lg font-semibold flex items-center gap-2 mb-4">
            <Bell className="h-5 w-5 text-yellow-500" /> Notifications & Alerts
          </h2>
          <div className="space-y-4">
            <ToggleRow
              label="Toast Notifications"
              description="Show pop-up notifications for actions (save, delete, errors). Disable for a cleaner UI."
              checked={form.enable_toast_notifications}
              onChange={(v) => update('enable_toast_notifications', v)}
            />
            {form.enable_toast_notifications && (
              <NumberRow
                label="Toast Duration (ms)"
                description="How long toast notifications stay visible before auto-dismissing."
                value={form.toast_duration}
                onChange={(v) => update('toast_duration', v)}
                min={1000}
                max={10000}
                step={500}
                presets={[
                  { label: '2s', value: 2000 },
                  { label: '4s', value: 4000 },
                  { label: '6s', value: 6000 },
                  { label: '10s', value: 10000 },
                ]}
              />
            )}
            <ToggleRow
              label="Error Reporting"
              description="Capture and display detailed error messages when something goes wrong."
              checked={form.enable_error_reporting}
              onChange={(v) => update('enable_error_reporting', v)}
            />
          </div>
        </GlassCard>

        {/* Session & Security */}
        <GlassCard>
          <h2 className="text-lg font-semibold flex items-center gap-2 mb-4">
            <Shield className="h-5 w-5 text-red-500" /> Security & Session
          </h2>
          <div className="space-y-4">
            <ToggleRow
              label="Anti-Inspection Mode"
              description="Blocks right-click, DevTools shortcuts, and view-source in production."
              checked={form.enable_anti_inspection}
              onChange={(v) => update('enable_anti_inspection', v)}
            />
            <ToggleRow
              label="Allow Text Selection"
              description="Allow users to select and copy text on the site. Disable for content protection."
              checked={form.enable_text_selection}
              onChange={(v) => update('enable_text_selection', v)}
            />
            <NumberRow
              label="Session Timeout (minutes)"
              description="Auto-logout inactive users after this time. 0 = never timeout."
              value={form.session_timeout}
              onChange={(v) => update('session_timeout', v)}
              min={0}
              max={480}
              step={15}
              presets={[
                { label: 'Never', value: 0 },
                { label: '30 min', value: 30 },
                { label: '1 hour', value: 60 },
                { label: '4 hours', value: 240 },
              ]}
            />
          </div>
        </GlassCard>

        {/* Developer / Debug */}
        <GlassCard>
          <h2 className="text-lg font-semibold flex items-center gap-2 mb-4">
            <Terminal className="h-5 w-5 text-emerald-500" /> Developer & Debug
          </h2>
          <div className="space-y-4">
            <ToggleRow
              label="Console Logs (Production)"
              description="Show detailed console logs in production. Useful for debugging but exposes internals."
              checked={form.enable_console_logs}
              onChange={(v) => update('enable_console_logs', v)}
            />
          </div>
        </GlassCard>

        {/* Quick Fix Tips */}
        <GlassCard>
          <h2 className="text-lg font-semibold flex items-center gap-2 mb-4">
            <Monitor className="h-5 w-5 text-purple-500" /> Quick Fix Guide
          </h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <TipCard title="🐌 Slow Loading" tip="Use 'Max Performance' preset, or increase stale time to 2-5 min and disable animations." />
            <TipCard title="🔄 Laggy Scrolling" tip="Disable background animations, reduce table rows to 25, enable image lazy loading." />
            <TipCard title="📱 Slow on Mobile" tip="Disable transitions & animations, lower image quality to 60%, set debounce to 500ms." />
            <TipCard title="⚡ Self-Hosted Server" tip="Set stale time to 2min+, cache time to 10min+, retry count to 2-3, enable auto-cache clear." />
            <TipCard title="🧹 Stale Data" tip="Enable auto-clear cache (1 hour), or click 'Clear Cache' manually. Reduce stale time to 30s." />
            <TipCard title="🔒 Need to Debug" tip="Disable Anti-Inspection, enable Console Logs, and turn on Error Reporting." />
            <TipCard title="💾 Memory Issues" tip="Reduce cache time, lower table rows, disable prefetch, and enable auto-clear cache." />
            <TipCard title="🔌 High Bandwidth" tip="Disable realtime subscriptions, disable prefetch, increase debounce delay to 500ms+." />
            <TipCard title="🛠️ Maintenance" tip="Enable Maintenance Mode before server updates. Only admins can still access the site." />
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

function NumberRow({ label, description, value, onChange, min, max, step, presets, formatValue }: {
  label: string; description: string; value: number; onChange: (v: number) => void;
  min: number; max: number; step: number;
  presets?: { label: string; value: number }[];
  formatValue?: (v: number) => string;
}) {
  const display = formatValue ? formatValue(value) : value.toLocaleString();
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
        <span className="text-sm font-mono text-foreground w-20 text-right">{display}</span>
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
