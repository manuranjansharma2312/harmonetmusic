import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { DashboardLayout } from '@/components/DashboardLayout';
import { GlassCard } from '@/components/GlassCard';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';
import { format } from 'date-fns';
import {
  Users, Plus, Trash2, Pencil, Loader2, Shield, FolderOpen, Eye, EyeOff,
  Download, LogIn, CreditCard, KeyRound, Mail,
} from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

// All admin page keys that can be assigned
const ALL_ADMIN_PAGES = [
  { key: 'dashboard', label: 'Dashboard', path: '/admin' },
  { key: 'all-pending', label: 'All Pendings', path: '/admin/all-pending' },
  { key: 'users', label: 'All Users', path: '/admin/users' },
  { key: 'submissions', label: 'All Releases', path: '/admin/submissions' },
  { key: 'content-requests', label: 'Support Requests', path: '/admin/content-requests' },
  { key: 'labels', label: 'Manage Labels', path: '/admin/labels' },
  { key: 'video-distribution', label: 'Video Distribution', path: '/admin/video-submissions' },
  { key: 'sub-labels', label: 'Sub Labels', path: '/admin/sub-labels' },
  { key: 'youtube-cms', label: 'YouTube CMS', path: '/admin/youtube-cms-links' },
  { key: 'revenue', label: 'Revenue & Withdrawals', path: '/admin/revenue' },
  { key: 'reports', label: 'Reports & Analytics', path: '/admin/reports' },
  { key: 'invoices', label: 'Billing & Invoices', path: '/admin/invoices' },
  { key: 'contracts', label: 'Contracts & E-Sign', path: '/admin/agreements' },
  { key: 'promotions', label: 'Promotional Tools', path: '/admin/promotion-tools' },
  { key: 'poster', label: 'Poster Generator', path: '/admin/poster-generator' },
  { key: 'transfer-history', label: 'Release Transfers', path: '/admin/transfer-history' },
  { key: 'notices', label: 'Notice Updates', path: '/admin/notices' },
  { key: 'smart-links', label: 'Smart Links', path: '/admin/smart-links' },
  { key: 'email-settings', label: 'Manage Emails', path: '/admin/email-settings' },
  { key: 'general-settings', label: 'General Settings', path: '/admin/genres-languages' },
  { key: 'contact-policies', label: 'Contact & Policies', path: '/admin/terms' },
  { key: 'settings', label: 'Settings', path: '/admin/branding-settings' },
];

interface GovtId { name: string; number: string; }

interface TeamCategory {
  id: string;
  name: string;
  description: string;
  created_at: string;
}

interface TeamMember {
  id: string;
  user_id: string;
  category_id: string | null;
  name: string;
  email: string;
  allowed_pages: string[];
  govt_ids: GovtId[];
  status: string;
  created_at: string;
}

export default function AdminTeamManagement() {
  const [categories, setCategories] = useState<TeamCategory[]>([]);
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);

  // Category form
  const [catOpen, setCatOpen] = useState(false);
  const [catForm, setCatForm] = useState({ name: '', description: '' });
  const [editingCat, setEditingCat] = useState<TeamCategory | null>(null);

  // Member form
  const [memberOpen, setMemberOpen] = useState(false);
  const [memberForm, setMemberForm] = useState({
    name: '', email: '', password: '', category_id: '',
    allowed_pages: [] as string[],
    govt_ids: [{ name: '', number: '' }] as GovtId[],
  });
  const [editingMember, setEditingMember] = useState<TeamMember | null>(null);
  const [showPw, setShowPw] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<{ type: 'cat' | 'member'; id: string } | null>(null);

  // Selection & export
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const fetchAll = async () => {
    setLoading(true);
    const [{ data: cats }, { data: mems }] = await Promise.all([
      (supabase.from('team_categories') as any).select('*').order('created_at', { ascending: true }),
      (supabase.from('team_members') as any).select('*').order('created_at', { ascending: false }),
    ]);
    setCategories(cats || []);
    setMembers((mems || []).map((m: any) => ({ ...m, govt_ids: Array.isArray(m.govt_ids) ? m.govt_ids : [] })));
    setLoading(false);
  };

  useEffect(() => { fetchAll(); }, []);

  // ---- Status change ----
  const handleStatusChange = async (member: TeamMember, newStatus: string) => {
    const { error } = await (supabase.from('team_members') as any).update({ status: newStatus, updated_at: new Date().toISOString() }).eq('id', member.id);
    if (error) toast.error(error.message);
    else { toast.success(`${member.name} status changed to ${newStatus}`); fetchAll(); }
  };

  const statusBadge = (status: string) => {
    const map: Record<string, string> = {
      pending: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30',
      active: 'bg-green-500/15 text-green-400 border-green-500/30',
      suspended: 'bg-red-500/15 text-red-400 border-red-500/30',
    };
    return `inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium capitalize ${map[status] || map.pending}`;
  };

  // ---- Categories ----
  const handleSaveCategory = async () => {
    if (!catForm.name.trim()) { toast.error('Category name is required'); return; }
    setSubmitting(true);
    if (editingCat) {
      const { error } = await (supabase.from('team_categories') as any).update({ name: catForm.name.trim(), description: catForm.description.trim(), updated_at: new Date().toISOString() }).eq('id', editingCat.id);
      if (error) toast.error('Failed to update'); else toast.success('Category updated');
    } else {
      const { error } = await (supabase.from('team_categories') as any).insert({ name: catForm.name.trim(), description: catForm.description.trim() });
      if (error) toast.error(error.message); else toast.success('Category created');
    }
    setSubmitting(false);
    setCatOpen(false);
    setEditingCat(null);
    setCatForm({ name: '', description: '' });
    fetchAll();
  };

  const handleDeleteCategory = async (id: string) => {
    const { error } = await (supabase.from('team_categories') as any).delete().eq('id', id);
    if (error) toast.error('Failed to delete'); else toast.success('Category deleted');
    setDeleteConfirm(null);
    fetchAll();
  };

  // ---- Members ----
  const handleSaveMember = async () => {
    if (!memberForm.name.trim() || !memberForm.email.trim()) { toast.error('Name and email required'); return; }
    const cleanGovtIds = memberForm.govt_ids.filter(g => g.name.trim() && g.number.trim());
    setSubmitting(true);

    if (editingMember) {
      const { error } = await (supabase.from('team_members') as any).update({
        name: memberForm.name.trim(),
        category_id: memberForm.category_id || null,
        allowed_pages: memberForm.allowed_pages,
        govt_ids: cleanGovtIds,
        updated_at: new Date().toISOString(),
      }).eq('id', editingMember.id);
      if (error) toast.error('Failed to update'); else toast.success('Team member updated');
    } else {
      if (!memberForm.password || memberForm.password.length < 6) { toast.error('Password must be at least 6 characters'); setSubmitting(false); return; }
      const { data: fnData, error: fnError } = await supabase.functions.invoke('create-team-user', {
        body: {
          email: memberForm.email.trim(), password: memberForm.password,
          name: memberForm.name.trim(), category_id: memberForm.category_id || null,
          allowed_pages: memberForm.allowed_pages, govt_ids: cleanGovtIds,
        },
      });
      if (fnError || fnData?.error) {
        toast.error(fnData?.error || fnError?.message || 'Failed to create team user');
        setSubmitting(false);
        return;
      }
      toast.success('Team member created');
    }

    setSubmitting(false);
    setMemberOpen(false);
    setEditingMember(null);
    resetMemberForm();
    fetchAll();
  };

  const handleDeleteMember = async (id: string) => {
    const member = members.find(m => m.id === id);
    if (!member) return;
    const { error } = await supabase.functions.invoke('delete-users', { body: { userIds: [member.user_id] } });
    if (error) toast.error('Failed to delete'); else toast.success('Team member deleted');
    setDeleteConfirm(null);
    fetchAll();
  };

  const resetMemberForm = () => setMemberForm({ name: '', email: '', password: '', category_id: '', allowed_pages: [], govt_ids: [{ name: '', number: '' }] });

  const openEditMember = (m: TeamMember) => {
    setEditingMember(m);
    setMemberForm({
      name: m.name, email: m.email, password: '', category_id: m.category_id || '',
      allowed_pages: m.allowed_pages,
      govt_ids: m.govt_ids.length ? m.govt_ids : [{ name: '', number: '' }],
    });
    setMemberOpen(true);
  };

  const togglePage = (key: string) => {
    setMemberForm(prev => ({
      ...prev,
      allowed_pages: prev.allowed_pages.includes(key)
        ? prev.allowed_pages.filter(p => p !== key)
        : [...prev.allowed_pages, key],
    }));
  };

  const selectAllPages = () => setMemberForm(prev => ({ ...prev, allowed_pages: ALL_ADMIN_PAGES.map(p => p.key) }));
  const deselectAllPages = () => setMemberForm(prev => ({ ...prev, allowed_pages: [] }));

  const getCategoryName = (id: string | null) => categories.find(c => c.id === id)?.name || '—';
  const getPageLabel = (key: string) => ALL_ADMIN_PAGES.find(p => p.key === key)?.label || key;

  // ---- Govt ID helpers ----
  const addGovtId = () => setMemberForm(prev => ({ ...prev, govt_ids: [...prev.govt_ids, { name: '', number: '' }] }));
  const removeGovtId = (idx: number) => setMemberForm(prev => ({ ...prev, govt_ids: prev.govt_ids.filter((_, i) => i !== idx) }));
  const updateGovtId = (idx: number, field: 'name' | 'number', value: string) => {
    setMemberForm(prev => ({
      ...prev,
      govt_ids: prev.govt_ids.map((g, i) => i === idx ? { ...g, [field]: value } : g),
    }));
  };

  // ---- Selection ----
  const toggleSelect = (id: string) => setSelected(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const toggleSelectAll = () => setSelected(prev => prev.size === members.length ? new Set() : new Set(members.map(m => m.id)));

  // ---- Login as team member ----
  const handleLoginAs = async (member: TeamMember) => {
    const confirmLogin = window.confirm(`Login as ${member.name} (${member.email})? You will be signed out of your current session.`);
    if (!confirmLogin) return;
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) { toast.error('Not authenticated'); return; }
      
      const { data: fnData, error: fnError } = await supabase.functions.invoke('admin-reset-password', {
        body: { action: 'login_as_user', user_id: member.user_id },
        headers: { Authorization: `Bearer ${token}` },
      });
      if (fnError || !fnData?.success) {
        toast.error(fnData?.error || fnError?.message || 'Failed to generate login');
        return;
      }
      // Sign out admin, then verify OTP with the magic link token
      await supabase.auth.signOut();
      const { error: otpError } = await supabase.auth.verifyOtp({
        type: 'magiclink',
        token_hash: fnData.token_hash,
      } as any);
      if (otpError) {
        toast.error(otpError.message);
        window.location.href = '/auth';
        return;
      }
      window.location.href = '/admin';
    } catch (err: any) {
      toast.error(err.message || 'Login failed');
    }
  };

  // ---- CSV Export ----
  const exportCSV = () => {
    const rows = selected.size > 0 ? members.filter(m => selected.has(m.id)) : members;
    if (!rows.length) { toast.error('No data to export'); return; }
    const headers = ['Name', 'Email', 'Department', 'Pages Access', 'Govt IDs', 'Created'];
    const csvRows = [headers.join(',')];
    rows.forEach(m => {
      const govtStr = (m.govt_ids || []).map(g => `${g.name}: ${g.number}`).join(' | ');
      csvRows.push([
        `"${m.name}"`, `"${m.email}"`, `"${getCategoryName(m.category_id)}"`,
        `"${m.allowed_pages.join(', ')}"`, `"${govtStr}"`,
        `"${format(new Date(m.created_at), 'dd MMM yyyy')}"`,
      ].join(','));
    });
    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `team-members-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click(); URL.revokeObjectURL(url);
    toast.success(`Exported ${rows.length} members`);
  };

  if (loading) {
    return <DashboardLayout><div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div></DashboardLayout>;
  }

  return (
    <DashboardLayout>
      <div className="space-y-6 w-full">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Shield className="h-6 w-6 text-primary" />
              Team Management
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Create departments, manage team users & assign page access
            </p>
          </div>
        </div>

        <Tabs defaultValue="members">
          <TabsList>
            <TabsTrigger value="members" className="gap-2"><Users className="h-4 w-4" /> Team Members</TabsTrigger>
            <TabsTrigger value="categories" className="gap-2"><FolderOpen className="h-4 w-4" /> Departments</TabsTrigger>
          </TabsList>

          {/* ---- TEAM MEMBERS TAB ---- */}
          <TabsContent value="members" className="space-y-4 mt-4">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-2">
                {selected.size > 0 && (
                  <span className="text-sm text-muted-foreground">{selected.size} selected</span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" onClick={exportCSV}>
                  <Download className="h-4 w-4 mr-2" /> Export CSV
                </Button>
                <Button onClick={() => { setEditingMember(null); resetMemberForm(); setMemberOpen(true); }}>
                  <Plus className="h-4 w-4 mr-2" /> Add Team Member
                </Button>
              </div>
            </div>
            <GlassCard>
              <div className="responsive-table-wrap">
                <Table className="min-w-max">
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-10">
                        <Checkbox
                          checked={selected.size === members.length && members.length > 0}
                          onCheckedChange={toggleSelectAll}
                        />
                      </TableHead>
                      <TableHead className="whitespace-nowrap">Name</TableHead>
                      <TableHead className="whitespace-nowrap">Email</TableHead>
                      <TableHead className="whitespace-nowrap">Department</TableHead>
                      <TableHead className="whitespace-nowrap">Pages Access</TableHead>
                      <TableHead className="whitespace-nowrap">Govt IDs</TableHead>
                      <TableHead className="whitespace-nowrap">Status</TableHead>
                      <TableHead className="whitespace-nowrap">Created</TableHead>
                      <TableHead className="whitespace-nowrap text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {members.length === 0 ? (
                      <TableRow><TableCell colSpan={10} className="text-center py-8 text-muted-foreground">No team members yet</TableCell></TableRow>
                    ) : members.map(m => (
                      <TableRow key={m.id} className={selected.has(m.id) ? 'bg-primary/5' : ''}>
                        <TableCell>
                          <Checkbox checked={selected.has(m.id)} onCheckedChange={() => toggleSelect(m.id)} />
                        </TableCell>
                        <TableCell className="font-medium whitespace-nowrap">{m.name}</TableCell>
                        <TableCell className="whitespace-nowrap">{m.email}</TableCell>
                        <TableCell className="whitespace-nowrap">{getCategoryName(m.category_id)}</TableCell>
                        <TableCell>
                          <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded whitespace-nowrap">{m.allowed_pages.length} pages</span>
                        </TableCell>
                        <TableCell className="whitespace-nowrap">
                          {m.govt_ids?.length ? (
                            <div className="space-y-0.5">
                              {m.govt_ids.map((g, i) => (
                                <div key={i} className="text-xs">
                                  <span className="text-muted-foreground">{g.name}:</span> {g.number}
                                </div>
                              ))}
                            </div>
                          ) : <span className="text-muted-foreground text-xs">—</span>}
                        </TableCell>
                        <TableCell className="whitespace-nowrap">
                          <select
                            value={m.status || 'pending'}
                            onChange={(e) => handleStatusChange(m, e.target.value)}
                            className="bg-transparent border border-border rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                          >
                            <option value="pending">Pending</option>
                            <option value="active">Active</option>
                            <option value="suspended">Suspended</option>
                          </select>
                          <span className={`ml-2 ${statusBadge(m.status || 'pending')}`}>{m.status || 'pending'}</span>
                        </TableCell>
                        <TableCell className="whitespace-nowrap">{format(new Date(m.created_at), 'dd MMM yyyy')}</TableCell>
                        <TableCell className="text-right whitespace-nowrap space-x-1">
                          <Button variant="outline" size="sm" title="Login as this member" onClick={() => handleLoginAs(m)}>
                            <LogIn className="h-3.5 w-3.5" />
                          </Button>
                          <Button variant="outline" size="sm" onClick={() => openEditMember(m)}>
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button variant="destructive" size="sm" onClick={() => setDeleteConfirm({ type: 'member', id: m.id })}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </GlassCard>
          </TabsContent>

          {/* ---- DEPARTMENTS TAB ---- */}
          <TabsContent value="categories" className="space-y-4 mt-4">
            <div className="flex justify-end">
              <Button onClick={() => { setEditingCat(null); setCatForm({ name: '', description: '' }); setCatOpen(true); }}>
                <Plus className="h-4 w-4 mr-2" /> Add Department
              </Button>
            </div>
            <GlassCard>
              <div className="responsive-table-wrap">
                <Table className="min-w-max">
                  <TableHeader>
                    <TableRow>
                      <TableHead className="whitespace-nowrap">Name</TableHead>
                      <TableHead className="whitespace-nowrap">Description</TableHead>
                      <TableHead className="whitespace-nowrap">Members</TableHead>
                      <TableHead className="whitespace-nowrap">Created</TableHead>
                      <TableHead className="whitespace-nowrap text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {categories.length === 0 ? (
                      <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">No departments yet</TableCell></TableRow>
                    ) : categories.map(cat => (
                      <TableRow key={cat.id}>
                        <TableCell className="font-medium whitespace-nowrap">{cat.name}</TableCell>
                        <TableCell className="text-muted-foreground whitespace-nowrap">{cat.description || '—'}</TableCell>
                        <TableCell>{members.filter(m => m.category_id === cat.id).length}</TableCell>
                        <TableCell className="whitespace-nowrap">{format(new Date(cat.created_at), 'dd MMM yyyy')}</TableCell>
                        <TableCell className="text-right space-x-2 whitespace-nowrap">
                          <Button variant="outline" size="sm" onClick={() => { setEditingCat(cat); setCatForm({ name: cat.name, description: cat.description }); setCatOpen(true); }}>
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button variant="destructive" size="sm" onClick={() => setDeleteConfirm({ type: 'cat', id: cat.id })}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </GlassCard>
          </TabsContent>
        </Tabs>
      </div>

      {/* ---- CATEGORY DIALOG ---- */}
      <Dialog open={catOpen} onOpenChange={v => { setCatOpen(v); if (!v) setEditingCat(null); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editingCat ? 'Edit Department' : 'Add Department'}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label>Department Name *</Label><Input value={catForm.name} onChange={e => setCatForm(p => ({ ...p, name: e.target.value }))} placeholder="e.g. Content Team" /></div>
            <div><Label>Description</Label><Input value={catForm.description} onChange={e => setCatForm(p => ({ ...p, description: e.target.value }))} placeholder="Brief description" /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCatOpen(false)}>Cancel</Button>
            <Button onClick={handleSaveCategory} disabled={submitting}>{submitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}{editingCat ? 'Update' : 'Create'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ---- MEMBER DIALOG ---- */}
      <Dialog open={memberOpen} onOpenChange={v => { setMemberOpen(v); if (!v) setEditingMember(null); }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editingMember ? 'Edit Team Member' : 'Add Team Member'}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div><Label>Full Name *</Label><Input value={memberForm.name} onChange={e => setMemberForm(p => ({ ...p, name: e.target.value }))} placeholder="Team member name" /></div>
              <div>
                <Label>Email *</Label>
                <Input value={memberForm.email} onChange={e => setMemberForm(p => ({ ...p, email: e.target.value }))} placeholder="team@example.com" disabled={!!editingMember} />
              </div>
            </div>
            {!editingMember && (
              <div>
                <Label>Password *</Label>
                <div className="relative">
                  <Input type={showPw ? 'text' : 'password'} value={memberForm.password} onChange={e => setMemberForm(p => ({ ...p, password: e.target.value }))} placeholder="Min 6 characters" />
                  <button type="button" onClick={() => setShowPw(!showPw)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                    {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
            )}
            <div>
              <Label>Department</Label>
              <select value={memberForm.category_id} onChange={e => setMemberForm(p => ({ ...p, category_id: e.target.value }))} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                <option value="">— No Department —</option>
                {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>

            {/* Govt Issued IDs */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <Label className="flex items-center gap-2"><CreditCard className="h-4 w-4" /> Govt Issued IDs</Label>
                <button type="button" onClick={addGovtId} className="text-xs text-primary hover:underline flex items-center gap-1">
                  <Plus className="h-3 w-3" /> Add ID
                </button>
              </div>
              <div className="space-y-2">
                {memberForm.govt_ids.map((g, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <Input
                      value={g.name}
                      onChange={e => updateGovtId(idx, 'name', e.target.value)}
                      placeholder="ID Name (e.g. Aadhaar, PAN)"
                      className="flex-1"
                    />
                    <Input
                      value={g.number}
                      onChange={e => updateGovtId(idx, 'number', e.target.value)}
                      placeholder="ID Number"
                      className="flex-1"
                    />
                    {memberForm.govt_ids.length > 1 && (
                      <Button type="button" variant="ghost" size="sm" onClick={() => removeGovtId(idx)} className="text-destructive px-2">
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Page Access */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <Label>Page Access</Label>
                <div className="space-x-2">
                  <button type="button" onClick={selectAllPages} className="text-xs text-primary hover:underline">Select All</button>
                  <button type="button" onClick={deselectAllPages} className="text-xs text-muted-foreground hover:underline">Deselect All</button>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 p-3 border border-border rounded-lg bg-muted/30 max-h-60 overflow-y-auto">
                {ALL_ADMIN_PAGES.map(page => (
                  <label key={page.key} className="flex items-center gap-2 text-sm cursor-pointer hover:text-foreground text-muted-foreground">
                    <Checkbox
                      checked={memberForm.allowed_pages.includes(page.key)}
                      onCheckedChange={() => togglePage(page.key)}
                    />
                    {page.label}
                  </label>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMemberOpen(false)}>Cancel</Button>
            <Button onClick={handleSaveMember} disabled={submitting}>{submitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}{editingMember ? 'Update' : 'Create'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ---- DELETE CONFIRM ---- */}
      <Dialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Confirm Delete</DialogTitle></DialogHeader>
          <p className="text-muted-foreground">Are you sure you want to delete this {deleteConfirm?.type === 'cat' ? 'department' : 'team member'}? This action cannot be undone.</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirm(null)}>Cancel</Button>
            <Button variant="destructive" onClick={() => deleteConfirm?.type === 'cat' ? handleDeleteCategory(deleteConfirm.id) : handleDeleteMember(deleteConfirm.id)}>Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
