import { useState, useEffect } from 'react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { GlassCard } from '@/components/GlassCard';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Save, Loader2, Mail, Clock, Settings2, Building2, Send } from 'lucide-react';

export default function AdminSignatureSettings() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [emailAccounts, setEmailAccounts] = useState<any[]>([]);
  const [settings, setSettings] = useState({
    id: '',
    auto_send_completion: false,
    signing_email_subject: 'Please sign: {{document_title}}',
    signing_email_body: 'You have been requested to sign the following document.',
    completion_email_subject: 'Completed: {{document_title}} - Signed Document & Certificate',
    completion_email_body: 'The following document has been successfully signed by all parties.',
    issued_by_name: '',
    issued_by_address: '',
    issued_by_email: '',
    email_account_id: '',
  });

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from('signature_settings')
        .select('*')
        .limit(1)
        .maybeSingle();
      if (!error && data) {
        setSettings({
          id: data.id,
          auto_send_completion: (data as any).auto_send_completion ?? false,
          signing_email_subject: (data as any).signing_email_subject ?? '',
          signing_email_body: (data as any).signing_email_body ?? '',
          completion_email_subject: (data as any).completion_email_subject ?? '',
          completion_email_body: (data as any).completion_email_body ?? '',
          issued_by_name: (data as any).issued_by_name ?? '',
          issued_by_address: (data as any).issued_by_address ?? '',
          issued_by_email: (data as any).issued_by_email ?? '',
        });
      }
      setLoading(false);
    })();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase
        .from('signature_settings')
        .update({
          auto_send_completion: settings.auto_send_completion,
          signing_email_subject: settings.signing_email_subject,
          signing_email_body: settings.signing_email_body,
          completion_email_subject: settings.completion_email_subject,
          completion_email_body: settings.completion_email_body,
          issued_by_name: settings.issued_by_name,
          issued_by_address: settings.issued_by_address,
          issued_by_email: settings.issued_by_email,
          updated_by: user?.id,
          updated_at: new Date().toISOString(),
        } as any)
        .eq('id', settings.id);
      if (error) throw error;
      toast.success('Settings saved successfully');
    } catch (err: any) {
      toast.error(err.message || 'Failed to save settings');
    }
    setSaving(false);
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64 text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin mr-2" /> Loading settings...
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">E-Signature Settings</h1>
            <p className="text-muted-foreground text-sm">Configure email templates, expiry, and auto-send behavior</p>
          </div>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
            Save Settings
          </Button>
        </div>

        {/* General Settings */}
        <GlassCard className="p-6">
          <div className="flex items-center gap-2 mb-4">
            <Settings2 className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-semibold">General Settings</h2>
          </div>

          <div className="grid grid-cols-1 gap-6">
            <div className="flex items-center justify-between p-4 rounded-lg border bg-muted/30">
              <div>
                <Label>Auto-Send Completion Email</Label>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Automatically send signed document to all recipients when the last person signs
                </p>
              </div>
              <Switch
                checked={settings.auto_send_completion}
                onCheckedChange={v => setSettings(s => ({ ...s, auto_send_completion: v }))}
              />
            </div>
          </div>
        </GlassCard>

        {/* Issued By Details */}
        <GlassCard className="p-6">
          <div className="flex items-center gap-2 mb-4">
            <Building2 className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-semibold">Issued By Details</h2>
          </div>
          <p className="text-xs text-muted-foreground mb-4">
            These details appear on the Certificate of Completion as the issuing authority. Leave blank to use Company Details instead.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label>Issuer Name</Label>
              <Input
                value={settings.issued_by_name}
                onChange={e => setSettings(s => ({ ...s, issued_by_name: e.target.value }))}
                placeholder="e.g. Harmonet Music Pvt Ltd"
              />
            </div>
            <div>
              <Label>Issuer Email</Label>
              <Input
                value={settings.issued_by_email}
                onChange={e => setSettings(s => ({ ...s, issued_by_email: e.target.value }))}
                placeholder="e.g. legal@harmonet.com"
              />
            </div>
            <div className="md:col-span-2">
              <Label>Issuer Address</Label>
              <Textarea
                value={settings.issued_by_address}
                onChange={e => setSettings(s => ({ ...s, issued_by_address: e.target.value }))}
                placeholder="Full address of the issuing organization"
                rows={2}
              />
            </div>
          </div>
        </GlassCard>


        <GlassCard className="p-6">
          <div className="flex items-center gap-2 mb-4">
            <Mail className="h-5 w-5 text-blue-500" />
            <h2 className="text-lg font-semibold">Signing Request Email</h2>
          </div>
          <p className="text-xs text-muted-foreground mb-4">
            Sent to recipients when a document is sent for signing. Available variables: <code className="bg-muted px-1 py-0.5 rounded text-xs">{'{{document_title}}'}</code>, <code className="bg-muted px-1 py-0.5 rounded text-xs">{'{{recipient_name}}'}</code>, <code className="bg-muted px-1 py-0.5 rounded text-xs">{'{{company_name}}'}</code>
          </p>

          <div className="space-y-4">
            <div>
              <Label>Subject Line</Label>
              <Input
                value={settings.signing_email_subject}
                onChange={e => setSettings(s => ({ ...s, signing_email_subject: e.target.value }))}
                placeholder="Please sign: {{document_title}}"
              />
            </div>
            <div>
              <Label>Email Body (intro paragraph)</Label>
              <Textarea
                value={settings.signing_email_body}
                onChange={e => setSettings(s => ({ ...s, signing_email_body: e.target.value }))}
                placeholder="You have been requested to sign the following document."
                rows={3}
              />
            </div>
          </div>
        </GlassCard>

        {/* Completion Email Template */}
        <GlassCard className="p-6">
          <div className="flex items-center gap-2 mb-4">
            <Clock className="h-5 w-5 text-green-500" />
            <h2 className="text-lg font-semibold">Completion Email</h2>
          </div>
          <p className="text-xs text-muted-foreground mb-4">
            Sent to all recipients after the document is fully signed (with the bound PDF + certificate). Available variables: <code className="bg-muted px-1 py-0.5 rounded text-xs">{'{{document_title}}'}</code>, <code className="bg-muted px-1 py-0.5 rounded text-xs">{'{{recipient_name}}'}</code>, <code className="bg-muted px-1 py-0.5 rounded text-xs">{'{{company_name}}'}</code>, <code className="bg-muted px-1 py-0.5 rounded text-xs">{'{{certificate_id}}'}</code>
          </p>

          <div className="space-y-4">
            <div>
              <Label>Subject Line</Label>
              <Input
                value={settings.completion_email_subject}
                onChange={e => setSettings(s => ({ ...s, completion_email_subject: e.target.value }))}
                placeholder="Completed: {{document_title}} - Signed Document & Certificate"
              />
            </div>
            <div>
              <Label>Email Body (intro paragraph)</Label>
              <Textarea
                value={settings.completion_email_body}
                onChange={e => setSettings(s => ({ ...s, completion_email_body: e.target.value }))}
                placeholder="The following document has been successfully signed by all parties."
                rows={3}
              />
            </div>
          </div>
        </GlassCard>

        <div className="p-4 rounded-lg border bg-muted/20">
          <p className="text-xs text-muted-foreground">
            Email sending uses the default email account configured in <strong>Admin Email Settings</strong>. Company name and branding are pulled from <strong>Company Details</strong>.
          </p>
        </div>
      </div>
    </DashboardLayout>
  );
}
