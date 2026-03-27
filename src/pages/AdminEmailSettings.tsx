import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { DashboardLayout } from '@/components/DashboardLayout';
import { GlassCard } from '@/components/GlassCard';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { RichTextEditor } from '@/components/RichTextEditor';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { StatusBadge } from '@/components/StatusBadge';
import { TablePagination, paginateItems } from '@/components/TablePagination';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import {
  Mail, Settings, FileText, Save, Send, Eye, EyeOff, Search,
  ChevronDown, ChevronUp, ToggleLeft, Info, Code, History,
} from 'lucide-react';

interface EmailSettings {
  id: string;
  provider: string;
  smtp_host: string;
  smtp_port: number;
  smtp_username: string;
  smtp_password: string;
  smtp_encryption: string;
  from_email: string;
  from_name: string;
  reply_to_email: string;
  is_enabled: boolean;
}

interface EmailTemplate {
  id: string;
  trigger_key: string;
  trigger_label: string;
  category: string;
  subject: string;
  body_html: string;
  is_enabled: boolean;
  variables: string[];
}

interface EmailLog {
  id: string;
  template_key: string;
  template_label: string | null;
  recipient_email: string;
  subject: string | null;
  status: string;
  error_message: string | null;
  sent_at: string;
  sent_by: string | null;
}

const CATEGORIES = [
  { key: 'all', label: 'All' },
  { key: 'authentication', label: 'Authentication' },
  { key: 'releases', label: 'Releases' },
  { key: 'revenue', label: 'Revenue & Payouts' },
  { key: 'labels', label: 'Labels' },
  { key: 'content_requests', label: 'Content Requests' },
  { key: 'sub_labels', label: 'Sub Labels' },
  { key: 'smart_links', label: 'Smart Links' },
  { key: 'promotions', label: 'Promotions' },
  { key: 'general', label: 'General' },
];

export default function AdminEmailSettings() {
  const { user } = useAuth();
  const [settings, setSettings] = useState<EmailSettings | null>(null);
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [editingTemplate, setEditingTemplate] = useState<string | null>(null);
  const [editSubject, setEditSubject] = useState('');
  const [editBody, setEditBody] = useState('');
  const [previewTemplate, setPreviewTemplate] = useState<string | null>(null);
  const [emailLogs, setEmailLogs] = useState<EmailLog[]>([]);
  const [logSearch, setLogSearch] = useState('');
  const [logStatusFilter, setLogStatusFilter] = useState('all');
  const [logPage, setLogPage] = useState(0);
  const [logPageSize, setLogPageSize] = useState<number | 'all'>(20);

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    try {
      const [settingsRes, templatesRes, logsRes] = await Promise.all([
        supabase.from('email_settings').select('*').limit(1).single(),
        supabase.from('email_templates').select('*').order('category').order('trigger_label'),
        supabase.from('email_send_logs').select('*').order('sent_at', { ascending: false }).limit(500),
      ]);
      if (settingsRes.data) setSettings(settingsRes.data as any);
      if (templatesRes.data) setTemplates(templatesRes.data as any);
      if (logsRes.data) setEmailLogs(logsRes.data as any);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  async function saveSettings() {
    if (!settings || !user) return;
    setSaving(true);
    try {
      const { error } = await supabase.from('email_settings').update({
        provider: settings.provider,
        smtp_host: settings.smtp_host,
        smtp_port: settings.smtp_port,
        smtp_username: settings.smtp_username,
        smtp_password: settings.smtp_password,
        smtp_encryption: settings.smtp_encryption,
        from_email: settings.from_email,
        from_name: settings.from_name,
        reply_to_email: settings.reply_to_email,
        is_enabled: settings.is_enabled,
        updated_at: new Date().toISOString(),
        updated_by: user.id,
      } as any).eq('id', settings.id);
      if (error) throw error;
      toast.success('Email settings saved');
    } catch (err: any) {
      toast.error(err.message || 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  }

  async function toggleTemplate(id: string, enabled: boolean) {
    const { error } = await supabase.from('email_templates').update({
      is_enabled: enabled,
      updated_at: new Date().toISOString(),
      updated_by: user?.id,
    } as any).eq('id', id);
    if (error) {
      toast.error('Failed to update');
      return;
    }
    setTemplates(prev => prev.map(t => t.id === id ? { ...t, is_enabled: enabled } : t));
    toast.success(enabled ? 'Template enabled' : 'Template disabled');
  }

  async function saveTemplate(id: string) {
    setSaving(true);
    try {
      const { error } = await supabase.from('email_templates').update({
        subject: editSubject,
        body_html: editBody,
        updated_at: new Date().toISOString(),
        updated_by: user?.id,
      } as any).eq('id', id);
      if (error) throw error;
      setTemplates(prev => prev.map(t => t.id === id ? { ...t, subject: editSubject, body_html: editBody } : t));
      setEditingTemplate(null);
      toast.success('Template saved');
    } catch (err: any) {
      toast.error(err.message || 'Failed to save template');
    } finally {
      setSaving(false);
    }
  }

  function startEditing(template: EmailTemplate) {
    setEditingTemplate(template.id);
    setEditSubject(template.subject);
    setEditBody(template.body_html);
    setPreviewTemplate(null);
  }

  const filteredTemplates = templates.filter(t => {
    const matchesSearch = !searchQuery || 
      t.trigger_label.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.trigger_key.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = categoryFilter === 'all' || t.category === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  const getCategoryColor = (cat: string) => {
    const colors: Record<string, string> = {
      authentication: 'bg-blue-500/20 text-blue-400',
      releases: 'bg-green-500/20 text-green-400',
      revenue: 'bg-yellow-500/20 text-yellow-400',
      labels: 'bg-purple-500/20 text-purple-400',
      content_requests: 'bg-orange-500/20 text-orange-400',
      sub_labels: 'bg-pink-500/20 text-pink-400',
      smart_links: 'bg-cyan-500/20 text-cyan-400',
      promotions: 'bg-red-500/20 text-red-400',
      general: 'bg-muted text-muted-foreground',
    };
    return colors[cat] || colors.general;
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Email Settings</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Configure SMTP settings and manage email templates for all notifications
          </p>
        </div>

        <Tabs defaultValue="settings" className="space-y-4">
          <TabsList>
            <TabsTrigger value="settings" className="gap-2">
              <Settings className="h-4 w-4" /> SMTP Configuration
            </TabsTrigger>
            <TabsTrigger value="templates" className="gap-2">
              <FileText className="h-4 w-4" /> Email Templates
            </TabsTrigger>
            <TabsTrigger value="logs" className="gap-2">
              <History className="h-4 w-4" /> Email Logs
            </TabsTrigger>
            <TabsTrigger value="guide" className="gap-2">
              <Info className="h-4 w-4" /> Setup Guide
            </TabsTrigger>
          </TabsList>

          {/* SMTP Configuration Tab */}
          <TabsContent value="settings">
            <GlassCard className="p-6 space-y-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-xl bg-primary/10">
                    <Mail className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold">SMTP Server Configuration</h2>
                    <p className="text-xs text-muted-foreground">Configure your email server for sending notifications</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Label htmlFor="email-enabled" className="text-sm">Enable Email System</Label>
                  <Switch
                    id="email-enabled"
                    checked={settings?.is_enabled || false}
                    onCheckedChange={(v) => setSettings(prev => prev ? { ...prev, is_enabled: v } : prev)}
                  />
                </div>
              </div>

              {settings && (
                <div className="grid gap-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>SMTP Host</Label>
                      <Input
                        placeholder="smtp.gmail.com"
                        value={settings.smtp_host}
                        onChange={(e) => setSettings({ ...settings, smtp_host: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>SMTP Port</Label>
                      <Input
                        type="number"
                        placeholder="587"
                        value={settings.smtp_port}
                        onChange={(e) => setSettings({ ...settings, smtp_port: parseInt(e.target.value) || 587 })}
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>SMTP Username</Label>
                      <Input
                        placeholder="your-email@gmail.com"
                        value={settings.smtp_username}
                        onChange={(e) => setSettings({ ...settings, smtp_username: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>SMTP Password / App Password</Label>
                      <div className="relative">
                        <Input
                          type={showPassword ? 'text' : 'password'}
                          placeholder="••••••••••••••••"
                          value={settings.smtp_password}
                          onChange={(e) => setSettings({ ...settings, smtp_password: e.target.value })}
                        />
                        <button
                          type="button"
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                          onClick={() => setShowPassword(!showPassword)}
                        >
                          {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Encryption</Label>
                      <Select
                        value={settings.smtp_encryption}
                        onValueChange={(v) => setSettings({ ...settings, smtp_encryption: v })}
                      >
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="tls">TLS (Recommended)</SelectItem>
                          <SelectItem value="ssl">SSL</SelectItem>
                          <SelectItem value="none">None</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Provider Preset</Label>
                      <Select
                        value={settings.provider}
                        onValueChange={(v) => {
                          const presets: Record<string, Partial<EmailSettings>> = {
                            gmail: { smtp_host: 'smtp.gmail.com', smtp_port: 587, smtp_encryption: 'tls' },
                            outlook: { smtp_host: 'smtp.office365.com', smtp_port: 587, smtp_encryption: 'tls' },
                            yahoo: { smtp_host: 'smtp.mail.yahoo.com', smtp_port: 587, smtp_encryption: 'tls' },
                            zoho: { smtp_host: 'smtp.zoho.com', smtp_port: 587, smtp_encryption: 'tls' },
                            smtp: {},
                          };
                          setSettings({ ...settings, provider: v, ...presets[v] } as EmailSettings);
                        }}
                      >
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="smtp">Custom SMTP</SelectItem>
                          <SelectItem value="gmail">Gmail / Google Workspace</SelectItem>
                          <SelectItem value="outlook">Outlook / Office 365</SelectItem>
                          <SelectItem value="yahoo">Yahoo Mail</SelectItem>
                          <SelectItem value="zoho">Zoho Mail</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="border-t border-border pt-4 mt-2">
                    <h3 className="text-sm font-medium mb-3">Sender Information</h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="space-y-2">
                        <Label>From Email</Label>
                        <Input
                          placeholder="notifications@yourdomain.com"
                          value={settings.from_email}
                          onChange={(e) => setSettings({ ...settings, from_email: e.target.value })}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>From Name</Label>
                        <Input
                          placeholder="Harmonet Music"
                          value={settings.from_name}
                          onChange={(e) => setSettings({ ...settings, from_name: e.target.value })}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Reply-To Email</Label>
                        <Input
                          placeholder="support@yourdomain.com"
                          value={settings.reply_to_email}
                          onChange={(e) => setSettings({ ...settings, reply_to_email: e.target.value })}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-3 pt-4">
                    <Button onClick={saveSettings} disabled={saving} className="gap-2">
                      <Save className="h-4 w-4" />
                      {saving ? 'Saving...' : 'Save Settings'}
                    </Button>
                    <Button variant="outline" className="gap-2" onClick={() => toast.info('Test email feature will work after server-side integration')}>
                      <Send className="h-4 w-4" /> Send Test Email
                    </Button>
                  </div>
                </div>
              )}
            </GlassCard>
          </TabsContent>

          {/* Email Templates Tab */}
          <TabsContent value="templates">
            <GlassCard className="p-6 space-y-4">
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2.5 rounded-xl bg-primary/10">
                  <FileText className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold">Email Templates</h2>
                  <p className="text-xs text-muted-foreground">Customize email templates for every trigger and status change</p>
                </div>
              </div>

              {/* Filters */}
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search templates..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9"
                  />
                </div>
                <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                  <SelectTrigger className="w-full sm:w-[200px]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map(c => (
                      <SelectItem key={c.key} value={c.key}>{c.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Template List */}
              <div className="space-y-3">
                {filteredTemplates.map(template => (
                  <div key={template.id} className="border border-border rounded-lg overflow-hidden">
                    <div className="flex items-center justify-between p-4 bg-muted/30">
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <Switch
                          checked={template.is_enabled}
                          onCheckedChange={(v) => toggleTemplate(template.id, v)}
                        />
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-medium text-sm">{template.trigger_label}</span>
                            <Badge variant="outline" className={`text-[10px] ${getCategoryColor(template.category)}`}>
                              {CATEGORIES.find(c => c.key === template.category)?.label || template.category}
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5 truncate">
                            Subject: {template.subject}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 ml-2">
                        {previewTemplate === template.id ? (
                          <Button size="sm" variant="ghost" onClick={() => setPreviewTemplate(null)}>
                            <ChevronUp className="h-4 w-4" />
                          </Button>
                        ) : (
                          <Button size="sm" variant="ghost" onClick={() => { setPreviewTemplate(template.id); setEditingTemplate(null); }}>
                            <Eye className="h-4 w-4" />
                          </Button>
                        )}
                        <Button size="sm" variant="outline" onClick={() => startEditing(template)}>
                          Edit
                        </Button>
                      </div>
                    </div>

                    {/* Preview Panel */}
                    {previewTemplate === template.id && (
                      <div className="p-4 border-t border-border bg-background space-y-3">
                        <div>
                          <Label className="text-xs text-muted-foreground">Available Variables</Label>
                          <div className="flex flex-wrap gap-1.5 mt-1">
                            {template.variables.map(v => (
                              <code key={v} className="text-[11px] px-2 py-0.5 bg-muted rounded">{`{{${v}}}`}</code>
                            ))}
                          </div>
                        </div>
                        <div>
                          <Label className="text-xs text-muted-foreground">Preview</Label>
                          <div className="mt-1 p-4 bg-white rounded border text-sm text-black" dangerouslySetInnerHTML={{ __html: template.body_html }} />
                        </div>
                      </div>
                    )}

                    {/* Edit Panel */}
                    {editingTemplate === template.id && (
                      <div className="p-4 border-t border-border bg-background space-y-3">
                        <div>
                          <Label className="text-xs text-muted-foreground">Available Variables</Label>
                          <div className="flex flex-wrap gap-1.5 mt-1">
                            {template.variables.map(v => (
                              <code key={v} className="text-[11px] px-2 py-0.5 bg-muted rounded cursor-pointer hover:bg-primary/20" onClick={() => {
                                setEditBody(prev => prev + `{{${v}}}`);
                              }}>{`{{${v}}}`}</code>
                            ))}
                          </div>
                        </div>
                        <div className="space-y-2">
                          <Label>Subject</Label>
                          <Input value={editSubject} onChange={(e) => setEditSubject(e.target.value)} />
                        </div>
                        <div className="space-y-2">
                          <Label>Body (HTML)</Label>
                          <RichTextEditor
                            value={editBody}
                            onChange={setEditBody}
                          />
                        </div>
                        <div className="flex gap-2">
                          <Button size="sm" onClick={() => saveTemplate(template.id)} disabled={saving}>
                            <Save className="h-3.5 w-3.5 mr-1.5" />
                            {saving ? 'Saving...' : 'Save Template'}
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => setEditingTemplate(null)}>Cancel</Button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
                {filteredTemplates.length === 0 && (
                  <p className="text-center text-muted-foreground py-8 text-sm">No templates match your search</p>
                )}
              </div>
            </GlassCard>
          </TabsContent>

          {/* Setup Guide Tab */}
          <TabsContent value="guide">
            <GlassCard className="p-6 space-y-6">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-primary/10">
                  <Info className="h-5 w-5 text-primary" />
                </div>
                <h2 className="text-lg font-semibold">Self-Hosting Email Setup Guide</h2>
              </div>

              <div className="space-y-6 text-sm">
                <div className="space-y-2">
                  <h3 className="font-semibold text-base">Option 1: Gmail / Google Workspace (Recommended)</h3>
                  <ol className="list-decimal list-inside space-y-1 text-muted-foreground">
                    <li>Go to your Google Account → Security → 2-Step Verification (enable it)</li>
                    <li>Go to <strong>App Passwords</strong> and generate a new app password for "Mail"</li>
                    <li>Use these settings: Host: <code className="bg-muted px-1.5 py-0.5 rounded">smtp.gmail.com</code>, Port: <code className="bg-muted px-1.5 py-0.5 rounded">587</code>, Encryption: <code className="bg-muted px-1.5 py-0.5 rounded">TLS</code></li>
                    <li>Username: Your full Gmail address, Password: The app password you generated</li>
                  </ol>
                </div>

                <div className="space-y-2">
                  <h3 className="font-semibold text-base">Option 2: Custom SMTP (Any Provider)</h3>
                  <ol className="list-decimal list-inside space-y-1 text-muted-foreground">
                    <li>Get SMTP credentials from your email provider (Zoho, Outlook, etc.)</li>
                    <li>Enter the host, port, username, and password in the SMTP Configuration tab</li>
                    <li>Select the correct encryption method (usually TLS)</li>
                    <li>Set your From Email and From Name</li>
                  </ol>
                </div>

                <div className="space-y-2">
                  <h3 className="font-semibold text-base">Option 3: Transactional Email Services</h3>
                  <p className="text-muted-foreground">For high-volume sending, use services like:</p>
                  <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                    <li><strong>SendGrid</strong> — Free tier: 100 emails/day</li>
                    <li><strong>Resend</strong> — Free tier: 3,000 emails/month</li>
                    <li><strong>Mailgun</strong> — Free tier: 5,000 emails/month</li>
                    <li><strong>Amazon SES</strong> — Very cheap at scale ($0.10 per 1000 emails)</li>
                  </ul>
                  <p className="text-muted-foreground">All these services provide SMTP credentials you can use here.</p>
                </div>

                <div className="p-4 bg-primary/5 border border-primary/20 rounded-lg space-y-2">
                  <h3 className="font-semibold flex items-center gap-2">
                    <Code className="h-4 w-4" /> Server-Side Integration Required
                  </h3>
                  <p className="text-muted-foreground">
                    When you move this project to your own server, you'll need to create a backend service 
                    (Node.js/Express, PHP, etc.) that reads these SMTP settings from the database and sends 
                    emails using a library like <code className="bg-muted px-1 rounded">nodemailer</code>. 
                    The templates and settings stored here will be ready to use.
                  </p>
                  <p className="text-muted-foreground">
                    The email templates support <code className="bg-muted px-1 rounded">{"{{variable}}"}</code> syntax — 
                    your backend should replace these with actual values before sending.
                  </p>
                </div>

                <div className="p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-lg space-y-2">
                  <h3 className="font-semibold text-yellow-400">⚠️ Important Notes</h3>
                  <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                    <li>Never use your main email password — always use App Passwords</li>
                    <li>Gmail allows ~500 emails/day with regular accounts, 2000/day with Workspace</li>
                    <li>For production, use a dedicated transactional email service</li>
                    <li>Set up SPF, DKIM, and DMARC records for better deliverability</li>
                  </ul>
                </div>
              </div>
            </GlassCard>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
