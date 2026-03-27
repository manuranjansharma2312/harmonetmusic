import { useState, useEffect, useMemo } from 'react';
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
  ChevronUp, Info, Code, History, Download, Plus, Trash2, Star, Edit2, BarChart3,
  Tag,
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, PieChart, Pie, Cell } from 'recharts';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

interface EmailAccount {
  id: string;
  account_name: string;
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
  is_default: boolean;
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
  email_account_id: string | null;
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
  body_html: string | null;
}

interface EmailCategory {
  id: string;
  name: string;
  key: string;
  default_account_id: string | null;
  sort_order: number;
}

const CATEGORY_COLORS = [
  'bg-blue-500/20 text-blue-400',
  'bg-green-500/20 text-green-400',
  'bg-yellow-500/20 text-yellow-400',
  'bg-purple-500/20 text-purple-400',
  'bg-orange-500/20 text-orange-400',
  'bg-pink-500/20 text-pink-400',
  'bg-cyan-500/20 text-cyan-400',
  'bg-red-500/20 text-red-400',
  'bg-teal-500/20 text-teal-400',
  'bg-indigo-500/20 text-indigo-400',
];

const EMPTY_ACCOUNT: Omit<EmailAccount, 'id'> = {
  account_name: '',
  provider: 'smtp',
  smtp_host: '',
  smtp_port: 587,
  smtp_username: '',
  smtp_password: '',
  smtp_encryption: 'tls',
  from_email: '',
  from_name: '',
  reply_to_email: '',
  is_enabled: true,
  is_default: false,
};

const CHART_COLORS = {
  sent: 'hsl(142, 71%, 45%)',
  failed: 'hsl(0, 84%, 60%)',
  pending: 'hsl(48, 96%, 53%)',
};

const PIE_COLORS = ['hsl(142, 71%, 45%)', 'hsl(0, 84%, 60%)', 'hsl(48, 96%, 53%)'];

function EmailAnalytics({ logs }: { logs: EmailLog[] }) {
  const [timeRange, setTimeRange] = useState('7d');

  const filteredLogs = useMemo(() => {
    const now = new Date();
    const ranges: Record<string, number> = { '24h': 1, '7d': 7, '30d': 30, '90d': 90 };
    const days = ranges[timeRange] || 7;
    const cutoff = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
    return logs.filter(l => new Date(l.sent_at) >= cutoff);
  }, [logs, timeRange]);

  const stats = useMemo(() => {
    const total = filteredLogs.length;
    const sent = filteredLogs.filter(l => l.status === 'sent').length;
    const failed = filteredLogs.filter(l => l.status === 'failed').length;
    const pending = filteredLogs.filter(l => l.status === 'pending').length;
    return { total, sent, failed, pending, successRate: total > 0 ? ((sent / total) * 100).toFixed(1) : '0' };
  }, [filteredLogs]);

  const dailyData = useMemo(() => {
    const map = new Map<string, { date: string; sent: number; failed: number; pending: number }>();
    filteredLogs.forEach(log => {
      const date = new Date(log.sent_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      if (!map.has(date)) map.set(date, { date, sent: 0, failed: 0, pending: 0 });
      const entry = map.get(date)!;
      if (log.status === 'sent') entry.sent++;
      else if (log.status === 'failed') entry.failed++;
      else entry.pending++;
    });
    return Array.from(map.values()).reverse();
  }, [filteredLogs]);

  const templateData = useMemo(() => {
    const map = new Map<string, number>();
    filteredLogs.forEach(log => {
      const name = log.template_label || log.template_key;
      map.set(name, (map.get(name) || 0) + 1);
    });
    return Array.from(map.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);
  }, [filteredLogs]);

  const pieData = useMemo(() => [
    { name: 'Sent', value: stats.sent },
    { name: 'Failed', value: stats.failed },
    { name: 'Pending', value: stats.pending },
  ].filter(d => d.value > 0), [stats]);

  return (
    <div className="space-y-6">
      {/* Time range selector */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-primary/10">
            <BarChart3 className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h2 className="text-lg font-semibold">Email Analytics</h2>
            <p className="text-xs text-muted-foreground">Overview of email delivery performance</p>
          </div>
        </div>
        <div className="flex gap-1.5">
          {[{ key: '24h', label: '24h' }, { key: '7d', label: '7 Days' }, { key: '30d', label: '30 Days' }, { key: '90d', label: '90 Days' }].map(r => (
            <Button key={r.key} size="sm" variant={timeRange === r.key ? 'default' : 'outline'}
              onClick={() => setTimeRange(r.key)}>{r.label}</Button>
          ))}
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {[
          { label: 'Total Emails', value: stats.total, color: 'text-foreground' },
          { label: 'Sent', value: stats.sent, color: 'text-green-400' },
          { label: 'Failed', value: stats.failed, color: 'text-red-400' },
          { label: 'Pending', value: stats.pending, color: 'text-yellow-400' },
          { label: 'Success Rate', value: `${stats.successRate}%`, color: 'text-primary' },
        ].map(s => (
          <GlassCard key={s.label} className="p-4 text-center">
            <p className="text-xs text-muted-foreground">{s.label}</p>
            <p className={`text-2xl font-bold mt-1 ${s.color}`}>{s.value}</p>
          </GlassCard>
        ))}
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Bar chart - daily breakdown */}
        <GlassCard className="p-4 lg:col-span-2">
          <h3 className="text-sm font-semibold mb-3">Emails Over Time</h3>
          {dailyData.length > 0 ? (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={dailyData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                <YAxis tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', color: 'hsl(var(--foreground))' }} />
                <Legend />
                <Bar dataKey="sent" fill={CHART_COLORS.sent} radius={[4, 4, 0, 0]} name="Sent" />
                <Bar dataKey="failed" fill={CHART_COLORS.failed} radius={[4, 4, 0, 0]} name="Failed" />
                <Bar dataKey="pending" fill={CHART_COLORS.pending} radius={[4, 4, 0, 0]} name="Pending" />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-[280px] text-muted-foreground text-sm">No data for this period</div>
          )}
        </GlassCard>

        {/* Pie chart - status breakdown */}
        <GlassCard className="p-4">
          <h3 className="text-sm font-semibold mb-3">Status Breakdown</h3>
          {pieData.length > 0 ? (
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie data={pieData} cx="50%" cy="50%" innerRadius={60} outerRadius={90} paddingAngle={4} dataKey="value"
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                  {pieData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                </Pie>
                <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', color: 'hsl(var(--foreground))' }} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-[280px] text-muted-foreground text-sm">No data</div>
          )}
        </GlassCard>
      </div>

      {/* Top templates */}
      <GlassCard className="p-4">
        <h3 className="text-sm font-semibold mb-3">Top Email Templates</h3>
        {templateData.length > 0 ? (
          <ResponsiveContainer width="100%" height={Math.max(200, templateData.length * 40)}>
            <BarChart data={templateData} layout="vertical" margin={{ left: 120 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis type="number" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" width={120} />
              <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', color: 'hsl(var(--foreground))' }} />
              <Bar dataKey="count" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} name="Emails Sent" />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div className="text-center text-muted-foreground text-sm py-8">No template data</div>
        )}
      </GlassCard>
    </div>
  );
}

export default function AdminEmailSettings() {
  const { user } = useAuth();
  const [accounts, setAccounts] = useState<EmailAccount[]>([]);
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [emailLogs, setEmailLogs] = useState<EmailLog[]>([]);
  const [categories, setCategories] = useState<EmailCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Category management
  const [newCategoryName, setNewCategoryName] = useState('');
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
  const [editCategoryName, setEditCategoryName] = useState('');

  // Account editing
  const [editingAccount, setEditingAccount] = useState<Partial<EmailAccount> | null>(null);
  const [isNewAccount, setIsNewAccount] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // Template state
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [editingTemplate, setEditingTemplate] = useState<string | null>(null);
  const [editSubject, setEditSubject] = useState('');
  const [editBody, setEditBody] = useState('');
  const [editAccountId, setEditAccountId] = useState<string | null>(null);
  const [editCategory, setEditCategory] = useState('');
  const [previewTemplate, setPreviewTemplate] = useState<string | null>(null);
  const [templatePage, setTemplatePage] = useState(0);
  const [templatePageSize, setTemplatePageSize] = useState<number | 'all'>(10);

  // Log state
  const [logSearch, setLogSearch] = useState('');
  const [logStatusFilter, setLogStatusFilter] = useState('all');
  const [logPage, setLogPage] = useState(0);
  const [logPageSize, setLogPageSize] = useState<number | 'all'>(20);

  // Test email
  const [showTestDialog, setShowTestDialog] = useState(false);
  const [testEmail, setTestEmail] = useState('');
  const [testAccountId, setTestAccountId] = useState('');
  const [sendingTest, setSendingTest] = useState(false);
  const [viewingLog, setViewingLog] = useState<EmailLog | null>(null);

  useEffect(() => { fetchData(); }, []);

  // Realtime subscription for email logs
  useEffect(() => {
    const channel = supabase
      .channel('email-logs-realtime')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'email_send_logs' }, (payload) => {
        setEmailLogs(prev => [payload.new as EmailLog, ...prev].slice(0, 500));
        toast.info(`New email log: ${(payload.new as any).recipient_email}`);
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  async function fetchData() {
    try {
      const [accountsRes, templatesRes, logsRes, categoriesRes] = await Promise.all([
        supabase.from('email_accounts').select('*').order('is_default', { ascending: false }).order('account_name'),
        supabase.from('email_templates').select('*').order('category').order('trigger_label'),
        supabase.from('email_send_logs').select('*').order('sent_at', { ascending: false }).limit(500),
        supabase.from('email_categories').select('*').order('sort_order'),
      ]);
      if (accountsRes.data) setAccounts(accountsRes.data as any);
      if (templatesRes.data) setTemplates(templatesRes.data as any);
      if (logsRes.data) setEmailLogs(logsRes.data as any);
      if (categoriesRes.data) setCategories(categoriesRes.data as any);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  // ---- Account CRUD ----
  function openNewAccount() {
    setEditingAccount({ ...EMPTY_ACCOUNT });
    setIsNewAccount(true);
    setShowPassword(false);
  }

  function openEditAccount(acc: EmailAccount) {
    setEditingAccount({ ...acc });
    setIsNewAccount(false);
    setShowPassword(false);
  }

  async function saveAccount() {
    if (!editingAccount || !user) return;
    if (!editingAccount.account_name?.trim()) { toast.error('Account name is required'); return; }
    if (!editingAccount.smtp_host?.trim()) { toast.error('SMTP host is required'); return; }
    setSaving(true);
    try {
      if (isNewAccount) {
        const { error } = await supabase.from('email_accounts').insert({
          account_name: editingAccount.account_name,
          provider: editingAccount.provider,
          smtp_host: editingAccount.smtp_host,
          smtp_port: editingAccount.smtp_port,
          smtp_username: editingAccount.smtp_username,
          smtp_password: editingAccount.smtp_password,
          smtp_encryption: editingAccount.smtp_encryption,
          from_email: editingAccount.from_email,
          from_name: editingAccount.from_name,
          reply_to_email: editingAccount.reply_to_email,
          is_enabled: editingAccount.is_enabled,
          is_default: editingAccount.is_default,
        } as any);
        if (error) throw error;
        toast.success('Email account added');
      } else {
        const { error } = await supabase.from('email_accounts').update({
          account_name: editingAccount.account_name,
          provider: editingAccount.provider,
          smtp_host: editingAccount.smtp_host,
          smtp_port: editingAccount.smtp_port,
          smtp_username: editingAccount.smtp_username,
          smtp_password: editingAccount.smtp_password,
          smtp_encryption: editingAccount.smtp_encryption,
          from_email: editingAccount.from_email,
          from_name: editingAccount.from_name,
          reply_to_email: editingAccount.reply_to_email,
          is_enabled: editingAccount.is_enabled,
          is_default: editingAccount.is_default,
          updated_at: new Date().toISOString(),
        } as any).eq('id', editingAccount.id!);
        if (error) throw error;
        toast.success('Email account updated');
      }
      setEditingAccount(null);
      fetchData();
    } catch (err: any) {
      toast.error(err.message || 'Failed to save account');
    } finally {
      setSaving(false);
    }
  }

  async function deleteAccount(id: string) {
    if (!confirm('Delete this email account? Templates using it will fall back to the default account.')) return;
    const { error } = await supabase.from('email_accounts').delete().eq('id', id);
    if (error) { toast.error(error.message); return; }
    toast.success('Account deleted');
    fetchData();
  }

  async function setDefault(id: string) {
    // Unset all defaults first, then set this one
    await supabase.from('email_accounts').update({ is_default: false } as any).neq('id', id);
    await supabase.from('email_accounts').update({ is_default: true } as any).eq('id', id);
    toast.success('Default account updated');
    fetchData();
  }

  // ---- Template functions ----
  async function toggleTemplate(id: string, enabled: boolean) {
    const { error } = await supabase.from('email_templates').update({
      is_enabled: enabled,
      updated_at: new Date().toISOString(),
      updated_by: user?.id,
    } as any).eq('id', id);
    if (error) { toast.error('Failed to update'); return; }
    setTemplates(prev => prev.map(t => t.id === id ? { ...t, is_enabled: enabled } : t));
    toast.success(enabled ? 'Template enabled' : 'Template disabled');
  }

  function startEditing(template: EmailTemplate) {
    setEditingTemplate(template.id);
    setEditSubject(template.subject);
    setEditBody(template.body_html);
    setEditAccountId(template.email_account_id);
    setEditCategory(template.category);
    setPreviewTemplate(null);
  }

  async function saveTemplate(id: string) {
    setSaving(true);
    try {
      const { error } = await supabase.from('email_templates').update({
        subject: editSubject,
        body_html: editBody,
        email_account_id: editAccountId || null,
        category: editCategory,
        updated_at: new Date().toISOString(),
        updated_by: user?.id,
      } as any).eq('id', id);
      if (error) throw error;
      setTemplates(prev => prev.map(t => t.id === id ? { ...t, subject: editSubject, body_html: editBody, email_account_id: editAccountId, category: editCategory } : t));
      setEditingTemplate(null);
      toast.success('Template saved');
    } catch (err: any) {
      toast.error(err.message || 'Failed to save template');
    } finally {
      setSaving(false);
    }
  }

  // ---- Test email ----
  async function sendTestEmail() {
    if (!testEmail.trim()) { toast.error('Enter a recipient email'); return; }
    setSendingTest(true);
    try {
      const { data, error } = await supabase.functions.invoke('send-test-email', {
        body: { test_email: testEmail.trim(), account_id: testAccountId || undefined },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success(data.message || 'Test email sent!');
      setShowTestDialog(false);
      setTestEmail('');
      fetchData();
    } catch (err: any) {
      toast.error(err.message || 'Failed to send test email');
    } finally {
      setSendingTest(false);
    }
  }

  // ---- Export ----
  function exportLogsCSV() {
    const filteredLogs = emailLogs.filter(log => {
      const matchesSearch = !logSearch ||
        log.recipient_email.toLowerCase().includes(logSearch.toLowerCase()) ||
        (log.template_label || log.template_key).toLowerCase().includes(logSearch.toLowerCase());
      const matchesStatus = logStatusFilter === 'all' || log.status === logStatusFilter;
      return matchesSearch && matchesStatus;
    });
    if (filteredLogs.length === 0) { toast.error('No logs to export'); return; }
    const headers = ['Template', 'Recipient', 'Subject', 'Status', 'Sent At', 'Error'];
    const rows = filteredLogs.map(l => [
      l.template_label || l.template_key, l.recipient_email, l.subject || '', l.status,
      new Date(l.sent_at).toLocaleString(), l.error_message || '',
    ]);
    const csv = [headers, ...rows].map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `email-logs-${new Date().toISOString().slice(0, 10)}.csv`; a.click();
    URL.revokeObjectURL(url);
    toast.success(`Exported ${filteredLogs.length} logs`);
  }

  // ---- Category CRUD ----
  async function addCategory() {
    if (!newCategoryName.trim()) { toast.error('Category name is required'); return; }
    const key = newCategoryName.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
    if (categories.some(c => c.key === key)) { toast.error('Category already exists'); return; }
    setSaving(true);
    try {
      const { error } = await supabase.from('email_categories').insert({
        name: newCategoryName.trim(),
        key,
        sort_order: categories.length + 1,
      } as any);
      if (error) throw error;
      setNewCategoryName('');
      toast.success('Category added');
      fetchData();
    } catch (err: any) {
      toast.error(err.message || 'Failed to add category');
    } finally { setSaving(false); }
  }

  async function updateCategory(id: string, updates: Partial<EmailCategory>) {
    setSaving(true);
    try {
      const { error } = await supabase.from('email_categories').update({
        ...updates,
        updated_at: new Date().toISOString(),
      } as any).eq('id', id);
      if (error) throw error;
      setCategories(prev => prev.map(c => c.id === id ? { ...c, ...updates } : c));
      setEditingCategoryId(null);
      toast.success('Category updated');
    } catch (err: any) {
      toast.error(err.message || 'Failed to update');
    } finally { setSaving(false); }
  }

  async function deleteCategory(id: string) {
    const cat = categories.find(c => c.id === id);
    if (!cat) return;
    const usedBy = templates.filter(t => t.category === cat.key).length;
    if (usedBy > 0) {
      toast.error(`Cannot delete: ${usedBy} template(s) are using this category. Reassign them first.`);
      return;
    }
    if (!confirm(`Delete category "${cat.name}"?`)) return;
    const { error } = await supabase.from('email_categories').delete().eq('id', id);
    if (error) { toast.error(error.message); return; }
    toast.success('Category deleted');
    fetchData();
  }

  const categoriesWithAll = useMemo(() =>
    [{ key: 'all', name: 'All' } as any, ...categories],
    [categories]
  );

  const filteredTemplates = useMemo(() => {
    let result = templates.filter(t => {
      const matchesSearch = !searchQuery ||
        t.trigger_label.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.trigger_key.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCategory = categoryFilter === 'all' || t.category === categoryFilter;
      return matchesSearch && matchesCategory;
    });
    return result;
  }, [templates, searchQuery, categoryFilter]);

  const paginatedTemplates = useMemo(
    () => paginateItems(filteredTemplates, templatePage, templatePageSize),
    [filteredTemplates, templatePage, templatePageSize]
  );

  const getCategoryColor = (cat: string) => {
    const idx = categories.findIndex(c => c.key === cat);
    return CATEGORY_COLORS[idx >= 0 ? idx % CATEGORY_COLORS.length : CATEGORY_COLORS.length - 1];
  };

  const getCategoryLabel = (catKey: string) => {
    return categories.find(c => c.key === catKey)?.name || catKey;
  };

  const getCategoryDefaultAccount = (catKey: string) => {
    const cat = categories.find(c => c.key === catKey);
    if (!cat?.default_account_id) return null;
    return accounts.find(a => a.id === cat.default_account_id) || null;
  };

  const getAccountName = (accountId: string | null) => {
    if (!accountId) return null;
    return accounts.find(a => a.id === accountId)?.account_name || null;
  };

  const defaultAccount = accounts.find(a => a.is_default);

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
            Manage email accounts, assign them to triggers, and customize templates
          </p>
        </div>

        <Tabs defaultValue="accounts" className="space-y-4">
          <TabsList className="flex-wrap">
            <TabsTrigger value="accounts" className="gap-2">
              <Mail className="h-4 w-4" /> Email Accounts
            </TabsTrigger>
            <TabsTrigger value="categories" className="gap-2">
              <Tag className="h-4 w-4" /> Categories
            </TabsTrigger>
            <TabsTrigger value="templates" className="gap-2">
              <FileText className="h-4 w-4" /> Templates & Assignment
            </TabsTrigger>
            <TabsTrigger value="logs" className="gap-2">
              <History className="h-4 w-4" /> Email Logs
            </TabsTrigger>
            <TabsTrigger value="analytics" className="gap-2">
              <BarChart3 className="h-4 w-4" /> Analytics
            </TabsTrigger>
            <TabsTrigger value="guide" className="gap-2">
              <Info className="h-4 w-4" /> Setup Guide
            </TabsTrigger>
          </TabsList>

          {/* =============== Email Accounts Tab =============== */}
          <TabsContent value="accounts">
            <GlassCard className="p-6 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-xl bg-primary/10">
                    <Mail className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold">Email Accounts</h2>
                    <p className="text-xs text-muted-foreground">Add multiple SMTP accounts and assign each to specific email triggers</p>
                  </div>
                </div>
                <Button size="sm" className="gap-2" onClick={openNewAccount}>
                  <Plus className="h-4 w-4" /> Add Account
                </Button>
              </div>

              {accounts.length === 0 && !editingAccount && (
                <div className="text-center py-12 text-muted-foreground">
                  <Mail className="h-10 w-10 mx-auto mb-3 opacity-40" />
                  <p className="font-medium">No email accounts configured</p>
                  <p className="text-sm mt-1">Add your first SMTP account to start sending emails</p>
                  <Button size="sm" className="mt-4 gap-2" onClick={openNewAccount}>
                    <Plus className="h-4 w-4" /> Add First Account
                  </Button>
                </div>
              )}

              {/* Account cards */}
              <div className="grid gap-3">
                {accounts.map(acc => (
                  <div key={acc.id} className="border border-border rounded-lg p-4 flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-sm">{acc.account_name}</span>
                        {acc.is_default && (
                          <Badge className="bg-primary/20 text-primary text-[10px] gap-1">
                            <Star className="h-3 w-3" /> Default
                          </Badge>
                        )}
                        <Badge variant={acc.is_enabled ? 'default' : 'secondary'} className="text-[10px]">
                          {acc.is_enabled ? 'Active' : 'Disabled'}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        {acc.from_name ? `${acc.from_name} <${acc.from_email || acc.smtp_username}>` : acc.from_email || acc.smtp_username}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {acc.smtp_host}:{acc.smtp_port} ({acc.smtp_encryption.toUpperCase()}) • {acc.provider !== 'smtp' ? acc.provider.charAt(0).toUpperCase() + acc.provider.slice(1) : 'Custom SMTP'}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Used by: {templates.filter(t => t.email_account_id === acc.id).length} template(s)
                        {acc.is_default && ` + ${templates.filter(t => !t.email_account_id).length} unassigned`}
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5">
                      {!acc.is_default && (
                        <Button size="sm" variant="ghost" title="Set as default" onClick={() => setDefault(acc.id)}>
                          <Star className="h-4 w-4" />
                        </Button>
                      )}
                      <Button size="sm" variant="ghost" onClick={() => openEditAccount(acc)}>
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive" onClick={() => deleteAccount(acc.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex gap-3 pt-2">
                <Button variant="outline" className="gap-2" onClick={() => setShowTestDialog(true)} disabled={accounts.length === 0}>
                  <Send className="h-4 w-4" /> Send Test Email
                </Button>
              </div>
            </GlassCard>
          </TabsContent>

          {/* =============== Categories Tab =============== */}
          <TabsContent value="categories">
            <GlassCard className="p-6 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-xl bg-primary/10">
                    <Tag className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold">Email Categories</h2>
                    <p className="text-xs text-muted-foreground">Create categories and assign a default email account to each one</p>
                  </div>
                </div>
              </div>

              {/* Add new category */}
              <div className="flex gap-2">
                <Input placeholder="New category name..." value={newCategoryName}
                  onChange={(e) => setNewCategoryName(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') addCategory(); }}
                  className="max-w-xs" />
                <Button size="sm" onClick={addCategory} disabled={saving || !newCategoryName.trim()} className="gap-1.5">
                  <Plus className="h-4 w-4" /> Add Category
                </Button>
              </div>

              {/* Category list */}
              <div className="space-y-2">
                {categories.map((cat, idx) => (
                  <div key={cat.id} className="flex items-center justify-between gap-3 p-3 rounded-lg border border-border bg-muted/20">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <Badge variant="outline" className={`text-[10px] shrink-0 ${CATEGORY_COLORS[idx % CATEGORY_COLORS.length]}`}>
                        {cat.key}
                      </Badge>
                      {editingCategoryId === cat.id ? (
                        <div className="flex items-center gap-2">
                          <Input value={editCategoryName} onChange={(e) => setEditCategoryName(e.target.value)}
                            className="h-7 text-sm w-48" autoFocus
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') updateCategory(cat.id, { name: editCategoryName });
                              if (e.key === 'Escape') setEditingCategoryId(null);
                            }} />
                          <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => updateCategory(cat.id, { name: editCategoryName })}>
                            <Save className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      ) : (
                        <span className="font-medium text-sm">{cat.name}</span>
                      )}
                      <span className="text-xs text-muted-foreground">
                        ({templates.filter(t => t.category === cat.key).length} templates)
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Select
                        value={cat.default_account_id || '_none'}
                        onValueChange={(v) => updateCategory(cat.id, { default_account_id: v === '_none' ? null : v })}
                      >
                        <SelectTrigger className="w-[220px] h-8 text-xs">
                          <SelectValue placeholder="No default account" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="_none">No default account</SelectItem>
                          {accounts.filter(a => a.is_enabled).map(acc => (
                            <SelectItem key={acc.id} value={acc.id}>
                              {acc.account_name} — {acc.from_email || acc.smtp_username}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button size="sm" variant="ghost" onClick={() => { setEditingCategoryId(cat.id); setEditCategoryName(cat.name); }}>
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive" onClick={() => deleteCategory(cat.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
                {categories.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    <Tag className="h-8 w-8 mx-auto mb-2 opacity-40" />
                    <p className="text-sm">No categories yet. Add your first one above.</p>
                  </div>
                )}
              </div>

              <div className="p-3 bg-muted/30 rounded-lg text-xs text-muted-foreground">
                <strong>How it works:</strong> Assign a default email account to each category. All templates in that category will use this account unless overridden individually in the template edit form.
              </div>
            </GlassCard>
          </TabsContent>

          {/* =============== Templates Tab =============== */}
          <TabsContent value="templates">
            <GlassCard className="p-6 space-y-4">
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2.5 rounded-xl bg-primary/10">
                  <FileText className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold">Email Templates & Account Assignment</h2>
                  <p className="text-xs text-muted-foreground">Customize templates and assign which email account sends each type</p>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Search templates..." value={searchQuery} onChange={(e) => { setSearchQuery(e.target.value); setTemplatePage(0); }} className="pl-9" />
                </div>
                <Select value={categoryFilter} onValueChange={(v) => { setCategoryFilter(v); setTemplatePage(0); }}>
                  <SelectTrigger className="w-full sm:w-[200px]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {categoriesWithAll.map((c: any) => <SelectItem key={c.key} value={c.key}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-3">
                {paginatedTemplates.map(template => {
                  const assignedName = getAccountName(template.email_account_id);
                  return (
                    <div key={template.id} className="border border-border rounded-lg overflow-hidden">
                      <div className="flex items-center justify-between p-4 bg-muted/30">
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          <Switch checked={template.is_enabled} onCheckedChange={(v) => toggleTemplate(template.id, v)} />
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-medium text-sm">{template.trigger_label}</span>
                              <Badge variant="outline" className={`text-[10px] ${getCategoryColor(template.category)}`}>
                                {getCategoryLabel(template.category)}
                              </Badge>
                              {(() => {
                                const catDefault = getCategoryDefaultAccount(template.category);
                                const effectiveAccount = assignedName
                                  ? assignedName
                                  : catDefault
                                    ? `${catDefault.account_name} (category)`
                                    : defaultAccount
                                      ? `${defaultAccount.account_name} (default)`
                                      : null;
                                const isOverride = !!assignedName;
                                return effectiveAccount ? (
                                  <Badge variant="outline" className={`text-[10px] gap-1 ${isOverride ? 'bg-primary/10 text-primary' : 'text-muted-foreground'}`}>
                                    <Mail className="h-2.5 w-2.5" /> {effectiveAccount}
                                  </Badge>
                                ) : null;
                              })()}
                            </div>
                            <p className="text-xs text-muted-foreground mt-0.5 truncate">Subject: {template.subject}</p>
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
                          <Button size="sm" variant="outline" onClick={() => startEditing(template)}>Edit</Button>
                        </div>
                      </div>

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

                      {editingTemplate === template.id && (
                        <div className="p-4 border-t border-border bg-background space-y-3">
                          <div>
                            <Label className="text-xs text-muted-foreground">Available Variables</Label>
                            <div className="flex flex-wrap gap-1.5 mt-1">
                              {template.variables.map(v => (
                                <code key={v} className="text-[11px] px-2 py-0.5 bg-muted rounded cursor-pointer hover:bg-primary/20"
                                  onClick={() => setEditBody(prev => prev + `{{${v}}}`)}>
                                  {`{{${v}}}`}
                                </code>
                              ))}
                            </div>
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div className="space-y-2">
                              <Label>Category</Label>
                              <Select value={editCategory} onValueChange={setEditCategory}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                  {categories.map(c => (
                                    <SelectItem key={c.key} value={c.key}>{c.name}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="space-y-2">
                              <Label>Send From Account</Label>
                              <Select value={editAccountId || '_category_default'} onValueChange={(v) => setEditAccountId(v === '_category_default' ? null : v)}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="_category_default">
                                    {(() => {
                                      const catDefault = getCategoryDefaultAccount(editCategory);
                                      if (catDefault) return `Category default (${catDefault.account_name})`;
                                      if (defaultAccount) return `Default (${defaultAccount.account_name})`;
                                      return 'Default Account';
                                    })()}
                                  </SelectItem>
                                  {accounts.filter(a => a.is_enabled).map(acc => (
                                    <SelectItem key={acc.id} value={acc.id}>
                                      {acc.account_name} — {acc.from_email || acc.smtp_username}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                          </div>
                          <div className="space-y-2">
                            <Label>Subject</Label>
                            <Input value={editSubject} onChange={(e) => setEditSubject(e.target.value)} />
                          </div>
                          <div className="space-y-2">
                            <Label>Body (HTML)</Label>
                            <RichTextEditor value={editBody} onChange={setEditBody} />
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
                  );
                })}
                {filteredTemplates.length === 0 && (
                  <p className="text-center text-muted-foreground py-8 text-sm">No templates match your search</p>
                )}
              </div>
              <TablePagination
                totalItems={filteredTemplates.length}
                currentPage={templatePage}
                pageSize={templatePageSize}
                onPageChange={setTemplatePage}
                onPageSizeChange={setTemplatePageSize}
                itemLabel="templates"
              />
            </GlassCard>
          </TabsContent>

          {/* =============== Email Logs Tab =============== */}
          <TabsContent value="logs">
            <GlassCard className="p-6 space-y-4">
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2.5 rounded-xl bg-primary/10">
                  <History className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold">Email Sending Logs</h2>
                  <p className="text-xs text-muted-foreground">Track all sent emails with status, recipient, and timestamps</p>
                </div>
              </div>
              <Button variant="outline" size="sm" className="gap-2 ml-auto" onClick={exportLogsCSV}>
                <Download className="h-4 w-4" /> Export CSV
              </Button>

              <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input placeholder="Search by recipient or template..." value={logSearch}
                    onChange={(e) => { setLogSearch(e.target.value); setLogPage(0); }} className="pl-9" />
                </div>
                <Select value={logStatusFilter} onValueChange={(v) => { setLogStatusFilter(v); setLogPage(0); }}>
                  <SelectTrigger className="w-full sm:w-[160px]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="sent">Sent</SelectItem>
                    <SelectItem value="failed">Failed</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {(() => {
                const filteredLogs = emailLogs.filter(log => {
                  const matchesSearch = !logSearch ||
                    log.recipient_email.toLowerCase().includes(logSearch.toLowerCase()) ||
                    (log.template_label || log.template_key).toLowerCase().includes(logSearch.toLowerCase()) ||
                    (log.subject || '').toLowerCase().includes(logSearch.toLowerCase());
                  const matchesStatus = logStatusFilter === 'all' || log.status === logStatusFilter;
                  return matchesSearch && matchesStatus;
                });
                const paginatedLogs = paginateItems(filteredLogs, logPage, logPageSize);
                return (
                  <>
                    <div className="text-xs text-muted-foreground">{filteredLogs.length} log{filteredLogs.length !== 1 ? 's' : ''} found</div>
                    <div className="space-y-2">
                      {paginatedLogs.length === 0 ? (
                        <div className="text-center text-muted-foreground py-8">No email logs found</div>
                      ) : paginatedLogs.map((log: EmailLog) => (
                        <div key={log.id} className="p-3 rounded-lg border border-border bg-card/50 space-y-2">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0 flex-1">
                              <p className="font-medium text-sm truncate">{log.template_label || log.template_key}</p>
                              <p className="text-xs text-muted-foreground truncate">{log.recipient_email}</p>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              <StatusBadge status={log.status} />
                              <Button size="sm" variant="ghost" onClick={() => setViewingLog(log)} title="View email" className="h-7 w-7 p-0">
                                <Eye className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                          {log.subject && <p className="text-xs text-muted-foreground truncate">Subject: {log.subject}</p>}
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-xs text-muted-foreground">{new Date(log.sent_at).toLocaleString()}</span>
                            {log.error_message && <span className="text-xs text-destructive truncate max-w-[50%]">{log.error_message}</span>}
                          </div>
                        </div>
                      ))}
                    </div>
                    <TablePagination totalItems={filteredLogs.length} currentPage={logPage} pageSize={logPageSize}
                      onPageChange={setLogPage} onPageSizeChange={setLogPageSize} itemLabel="logs" />
                  </>
                );
              })()}
            </GlassCard>
          </TabsContent>

          {/* =============== Analytics Tab =============== */}
          <TabsContent value="analytics">
            <EmailAnalytics logs={emailLogs} />
          </TabsContent>

          {/* =============== Setup Guide Tab =============== */}
          <TabsContent value="guide">
            <GlassCard className="p-6 space-y-6">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-primary/10">
                  <Info className="h-5 w-5 text-primary" />
                </div>
                <h2 className="text-lg font-semibold">Self-Hosting Email Setup Guide</h2>
              </div>
              <div className="space-y-6 text-sm">
                <div className="p-4 bg-primary/5 border border-primary/20 rounded-lg space-y-2">
                  <h3 className="font-semibold">💡 Multiple Email Accounts</h3>
                  <p className="text-muted-foreground">
                    You can add multiple email accounts for different purposes. For example:
                  </p>
                  <ul className="list-disc list-inside text-muted-foreground space-y-1">
                    <li><strong>notifications@harmonetmusic.com</strong> — For release updates, status changes</li>
                    <li><strong>accounts@harmonetmusic.com</strong> — For registration, password reset</li>
                    <li><strong>payments@harmonetmusic.com</strong> — For revenue & payout emails</li>
                    <li><strong>support@harmonetmusic.com</strong> — For support-related emails</li>
                  </ul>
                  <p className="text-muted-foreground mt-2">
                    Set one account as <strong>Default</strong> — templates without a specific assignment will use it.
                    Then assign specific accounts to individual templates in the Templates tab.
                  </p>
                </div>
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
                    <li>Enter the host, port, username, and password</li>
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
                </div>
                <div className="p-4 bg-primary/5 border border-primary/20 rounded-lg space-y-2">
                  <h3 className="font-semibold flex items-center gap-2">
                    <Code className="h-4 w-4" /> Server-Side Integration Required
                  </h3>
                  <p className="text-muted-foreground">
                    When you move this project to your own server, you'll need to create a backend service
                    that reads these SMTP settings from the database and sends emails using a library like <code className="bg-muted px-1 rounded">nodemailer</code>.
                    The templates and settings stored here will be ready to use.
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

                {/* Anti-Spam / Deliverability Checklist */}
                <div className="p-4 bg-green-500/10 border border-green-500/20 rounded-lg space-y-3">
                  <h3 className="font-semibold text-green-400 text-base">🛡️ Anti-Spam & Deliverability Checklist</h3>
                  <p className="text-muted-foreground text-sm">
                    Follow these DNS configurations at your domain registrar to ensure emails don't land in spam:
                  </p>

                  <div className="space-y-3">
                    <div className="p-3 bg-background/50 rounded-lg border border-border/30">
                      <h4 className="font-semibold text-sm mb-1">1. SPF Record (Sender Policy Framework)</h4>
                      <p className="text-xs text-muted-foreground mb-1.5">Authorizes your server to send emails on behalf of your domain.</p>
                      <code className="block bg-muted px-3 py-2 rounded text-xs break-all">
                        TXT &nbsp; @ &nbsp; v=spf1 include:_spf.google.com include:your-smtp-provider.com ~all
                      </code>
                      <p className="text-xs text-muted-foreground mt-1">Replace with your actual SMTP provider's SPF include.</p>
                    </div>

                    <div className="p-3 bg-background/50 rounded-lg border border-border/30">
                      <h4 className="font-semibold text-sm mb-1">2. DKIM Record (DomainKeys Identified Mail)</h4>
                      <p className="text-xs text-muted-foreground mb-1.5">Proves your emails haven't been tampered with in transit.</p>
                      <code className="block bg-muted px-3 py-2 rounded text-xs break-all">
                        TXT &nbsp; selector._domainkey &nbsp; v=DKIM1; k=rsa; p=YOUR_PUBLIC_KEY
                      </code>
                      <p className="text-xs text-muted-foreground mt-1">Get DKIM key from your SMTP provider's dashboard (Gmail Workspace, Zoho, SendGrid, etc.)</p>
                    </div>

                    <div className="p-3 bg-background/50 rounded-lg border border-border/30">
                      <h4 className="font-semibold text-sm mb-1">3. DMARC Record (Domain-based Message Authentication)</h4>
                      <p className="text-xs text-muted-foreground mb-1.5">Tells receiving servers how to handle unauthenticated emails.</p>
                      <code className="block bg-muted px-3 py-2 rounded text-xs break-all">
                        TXT &nbsp; _dmarc &nbsp; v=DMARC1; p=quarantine; rua=mailto:dmarc@yourdomain.com; pct=100
                      </code>
                      <p className="text-xs text-muted-foreground mt-1">Start with <code className="bg-muted px-1 rounded">p=none</code> for monitoring, then move to <code className="bg-muted px-1 rounded">p=quarantine</code> or <code className="bg-muted px-1 rounded">p=reject</code>.</p>
                    </div>

                    <div className="p-3 bg-background/50 rounded-lg border border-border/30">
                      <h4 className="font-semibold text-sm mb-1">4. Reverse DNS (PTR Record)</h4>
                      <p className="text-xs text-muted-foreground">Set up with your hosting/VPS provider. Maps your server IP back to your domain. Most cloud providers handle this automatically.</p>
                    </div>

                    <div className="p-3 bg-background/50 rounded-lg border border-border/30">
                      <h4 className="font-semibold text-sm mb-1">5. MX Records</h4>
                      <p className="text-xs text-muted-foreground">Ensure your domain has valid MX records for receiving email. This helps establish domain legitimacy with spam filters.</p>
                    </div>
                  </div>
                </div>

                {/* Built-in Anti-Spam Features */}
                <div className="p-4 bg-blue-500/10 border border-blue-500/20 rounded-lg space-y-2">
                  <h3 className="font-semibold text-blue-400 text-base">✅ Built-in Anti-Spam Features (Already Active)</h3>
                  <p className="text-muted-foreground text-sm mb-2">
                    The following anti-spam measures are automatically applied to all outgoing emails:
                  </p>
                  <ul className="list-disc list-inside space-y-1.5 text-muted-foreground text-sm">
                    <li><strong>Proper From Header</strong> — Emails use "Name &lt;email&gt;" format</li>
                    <li><strong>Message-ID Header</strong> — Unique identifier generated per email</li>
                    <li><strong>Plain-Text Fallback</strong> — Auto-generated from HTML for multi-part emails</li>
                    <li><strong>Email-Safe HTML Structure</strong> — DOCTYPE, charset, viewport, and table-based layout</li>
                    <li><strong>Hidden Preview Text</strong> — Pre-header text for inbox previews</li>
                    <li><strong>Reply-To Header</strong> — Set when reply-to email is configured</li>
                    <li><strong>List-Unsubscribe Header</strong> — Helps ISPs identify legitimate senders</li>
                    <li><strong>Proper MIME Headers</strong> — MIME-Version, X-Priority, Precedence</li>
                    <li><strong>Rate Limiting</strong> — Built-in rate limits prevent sending spikes</li>
                    <li><strong>Copyright Footer</strong> — Adds legitimacy with proper attribution</li>
                  </ul>
                </div>

                {/* Verification Tools */}
                <div className="p-4 bg-muted/30 border border-border/30 rounded-lg space-y-2">
                  <h3 className="font-semibold text-sm">🔍 Verify Your Setup</h3>
                  <p className="text-muted-foreground text-xs">Use these free tools to check your email deliverability:</p>
                  <ul className="list-disc list-inside space-y-1 text-muted-foreground text-xs">
                    <li><strong>mail-tester.com</strong> — Send a test email and get a spam score (aim for 9+/10)</li>
                    <li><strong>mxtoolbox.com</strong> — Check SPF, DKIM, DMARC, and MX records</li>
                    <li><strong>dmarcian.com</strong> — Monitor DMARC reports</li>
                    <li><strong>Google Postmaster Tools</strong> — Track domain reputation with Gmail</li>
                    <li><strong>learndmarc.com</strong> — Visualize your email authentication flow</li>
                  </ul>
                </div>
              </div>
            </GlassCard>
          </TabsContent>
        </Tabs>
      </div>

      {/* =============== Account Edit Dialog =============== */}
      <Dialog open={!!editingAccount} onOpenChange={(o) => { if (!o) setEditingAccount(null); }}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{isNewAccount ? 'Add Email Account' : 'Edit Email Account'}</DialogTitle>
          </DialogHeader>
          {editingAccount && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Account Name *</Label>
                <Input placeholder="e.g. Notifications, Payments, Support"
                  value={editingAccount.account_name || ''}
                  onChange={(e) => setEditingAccount({ ...editingAccount, account_name: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Provider Preset</Label>
                  <Select value={editingAccount.provider || 'smtp'}
                    onValueChange={(v) => {
                      const presets: Record<string, Partial<EmailAccount>> = {
                        gmail: { smtp_host: 'smtp.gmail.com', smtp_port: 587, smtp_encryption: 'tls' },
                        outlook: { smtp_host: 'smtp.office365.com', smtp_port: 587, smtp_encryption: 'tls' },
                        yahoo: { smtp_host: 'smtp.mail.yahoo.com', smtp_port: 587, smtp_encryption: 'tls' },
                        zoho: { smtp_host: 'smtp.zoho.com', smtp_port: 587, smtp_encryption: 'tls' },
                        smtp: {},
                      };
                      setEditingAccount({ ...editingAccount, provider: v, ...presets[v] });
                    }}>
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
                <div className="space-y-2">
                  <Label>Encryption</Label>
                  <Select value={editingAccount.smtp_encryption || 'tls'}
                    onValueChange={(v) => setEditingAccount({ ...editingAccount, smtp_encryption: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="tls">TLS (Recommended)</SelectItem>
                      <SelectItem value="ssl">SSL</SelectItem>
                      <SelectItem value="none">None</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>SMTP Host *</Label>
                  <Input placeholder="smtp.gmail.com" value={editingAccount.smtp_host || ''}
                    onChange={(e) => setEditingAccount({ ...editingAccount, smtp_host: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>SMTP Port</Label>
                  <Input type="number" placeholder="587" value={editingAccount.smtp_port || 587}
                    onChange={(e) => setEditingAccount({ ...editingAccount, smtp_port: parseInt(e.target.value) || 587 })} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Username</Label>
                  <Input placeholder="your-email@gmail.com" value={editingAccount.smtp_username || ''}
                    onChange={(e) => setEditingAccount({ ...editingAccount, smtp_username: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Password / App Password</Label>
                  <div className="relative">
                    <Input type={showPassword ? 'text' : 'password'} placeholder="••••••••"
                      value={editingAccount.smtp_password || ''}
                      onChange={(e) => setEditingAccount({ ...editingAccount, smtp_password: e.target.value })} />
                    <button type="button" className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      onClick={() => setShowPassword(!showPassword)}>
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
              </div>
              <div className="border-t border-border pt-3 space-y-3">
                <h4 className="text-sm font-medium">Sender Information</h4>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>From Email</Label>
                    <Input placeholder="notifications@yourdomain.com" value={editingAccount.from_email || ''}
                      onChange={(e) => setEditingAccount({ ...editingAccount, from_email: e.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <Label>From Name</Label>
                    <Input placeholder="Harmonet Music" value={editingAccount.from_name || ''}
                      onChange={(e) => setEditingAccount({ ...editingAccount, from_name: e.target.value })} />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Reply-To Email</Label>
                  <Input placeholder="support@yourdomain.com" value={editingAccount.reply_to_email || ''}
                    onChange={(e) => setEditingAccount({ ...editingAccount, reply_to_email: e.target.value })} />
                </div>
              </div>
              <div className="flex items-center gap-4 pt-2">
                <div className="flex items-center gap-2">
                  <Switch checked={editingAccount.is_enabled ?? true}
                    onCheckedChange={(v) => setEditingAccount({ ...editingAccount, is_enabled: v })} />
                  <Label className="text-sm">Enabled</Label>
                </div>
                <div className="flex items-center gap-2">
                  <Switch checked={editingAccount.is_default ?? false}
                    onCheckedChange={(v) => setEditingAccount({ ...editingAccount, is_default: v })} />
                  <Label className="text-sm">Set as Default</Label>
                </div>
              </div>
              <div className="flex gap-2 justify-end pt-2">
                <Button variant="outline" onClick={() => setEditingAccount(null)}>Cancel</Button>
                <Button onClick={saveAccount} disabled={saving} className="gap-2">
                  <Save className="h-4 w-4" />
                  {saving ? 'Saving...' : isNewAccount ? 'Add Account' : 'Save Changes'}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* =============== Test Email Dialog =============== */}
      <Dialog open={showTestDialog} onOpenChange={setShowTestDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Send Test Email</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">Send a test email to verify your SMTP configuration is working.</p>
            <div className="space-y-2">
              <Label>Send From Account</Label>
              <Select value={testAccountId || '_default'} onValueChange={(v) => setTestAccountId(v === '_default' ? '' : v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {defaultAccount && <SelectItem value="_default">Default ({defaultAccount.account_name})</SelectItem>}
                  {accounts.filter(a => a.is_enabled).map(acc => (
                    <SelectItem key={acc.id} value={acc.id}>{acc.account_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Recipient Email</Label>
              <Input type="email" placeholder="test@example.com" value={testEmail} onChange={(e) => setTestEmail(e.target.value)} />
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setShowTestDialog(false)}>Cancel</Button>
              <Button onClick={sendTestEmail} disabled={sendingTest} className="gap-2">
                <Send className="h-4 w-4" />
                {sendingTest ? 'Sending...' : 'Send Test'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* =============== Email Preview Dialog =============== */}
      <Dialog open={!!viewingLog} onOpenChange={(o) => { if (!o) setViewingLog(null); }}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Mail className="h-5 w-5" /> Email Preview
            </DialogTitle>
          </DialogHeader>
          {viewingLog && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <Label className="text-xs text-muted-foreground">Template</Label>
                  <p className="font-medium">{viewingLog.template_label || viewingLog.template_key}</p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Status</Label>
                  <div className="mt-0.5"><StatusBadge status={viewingLog.status} /></div>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Recipient</Label>
                  <p>{viewingLog.recipient_email}</p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Sent At</Label>
                  <p>{new Date(viewingLog.sent_at).toLocaleString()}</p>
                </div>
                <div className="col-span-2">
                  <Label className="text-xs text-muted-foreground">Subject</Label>
                  <p className="font-medium">{viewingLog.subject || '—'}</p>
                </div>
                {viewingLog.error_message && (
                  <div className="col-span-2">
                    <Label className="text-xs text-destructive">Error</Label>
                    <p className="text-sm text-destructive">{viewingLog.error_message}</p>
                  </div>
                )}
              </div>
              <div className="border-t border-border pt-4">
                <Label className="text-xs text-muted-foreground mb-2 block">Email Body</Label>
                {viewingLog.body_html ? (
                  <div className="p-4 bg-white rounded-lg border text-sm text-black max-h-[400px] overflow-y-auto"
                    dangerouslySetInnerHTML={{ __html: viewingLog.body_html }} />
                ) : (
                  <div className="p-4 bg-muted/30 rounded-lg text-center text-muted-foreground text-sm">
                    Email body not available for this log entry
                  </div>
                )}
              </div>
              <div className="flex justify-end">
                <Button variant="outline" onClick={() => setViewingLog(null)}>Close</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
