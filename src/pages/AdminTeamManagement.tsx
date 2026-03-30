import { useState, useEffect } from 'react';
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
  const [memberForm, setMemberForm] = useState({ name: '', email: '', password: '', category_id: '', allowed_pages: [] as string[] });
  const [editingMember, setEditingMember] = useState<TeamMember | null>(null);
  const [showPw, setShowPw] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<{ type: 'cat' | 'member'; id: string } | null>(null);

  const fetchAll = async () => {
    setLoading(true);
    const [{ data: cats }, { data: mems }] = await Promise.all([
      (supabase.from('team_categories') as any).select('*').order('created_at', { ascending: true }),
      (supabase.from('team_members') as any).select('*').order('created_at', { ascending: false }),
    ]);
    setCategories(cats || []);
    setMembers(mems || []);
    setLoading(false);
  };

  useEffect(() => { fetchAll(); }, []);

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
    setSubmitting(true);

    if (editingMember) {
      // Update existing member
      const { error } = await (supabase.from('team_members') as any).update({
        name: memberForm.name.trim(),
        category_id: memberForm.category_id || null,
        allowed_pages: memberForm.allowed_pages,
        updated_at: new Date().toISOString(),
      }).eq('id', editingMember.id);
      if (error) toast.error('Failed to update'); else toast.success('Team member updated');
    } else {
      // Create new auth user + team member
      if (!memberForm.password || memberForm.password.length < 6) { toast.error('Password must be at least 6 characters'); setSubmitting(false); return; }

      // Sign up the team user via edge function to avoid logging out admin
      const { data: fnData, error: fnError } = await supabase.functions.invoke('create-team-user', {
        body: { email: memberForm.email.trim(), password: memberForm.password, name: memberForm.name.trim(), category_id: memberForm.category_id || null, allowed_pages: memberForm.allowed_pages },
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
    setMemberForm({ name: '', email: '', password: '', category_id: '', allowed_pages: [] });
    fetchAll();
  };

  const handleDeleteMember = async (id: string) => {
    const member = members.find(m => m.id === id);
    if (!member) return;
    // Delete from auth + team_members via edge function
    const { error } = await supabase.functions.invoke('delete-users', { body: { userIds: [member.user_id] } });
    if (error) toast.error('Failed to delete'); else toast.success('Team member deleted');
    setDeleteConfirm(null);
    fetchAll();
  };

  const openEditMember = (m: TeamMember) => {
    setEditingMember(m);
    setMemberForm({ name: m.name, email: m.email, password: '', category_id: m.category_id || '', allowed_pages: m.allowed_pages });
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
            <div className="flex justify-end">
              <Button onClick={() => { setEditingMember(null); setMemberForm({ name: '', email: '', password: '', category_id: '', allowed_pages: [] }); setMemberOpen(true); }}>
                <Plus className="h-4 w-4 mr-2" /> Add Team Member
              </Button>
            </div>
            <GlassCard>
              <div className="responsive-table-wrap">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Department</TableHead>
                      <TableHead>Pages Access</TableHead>
                      <TableHead>Created</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {members.length === 0 ? (
                      <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">No team members yet</TableCell></TableRow>
                    ) : members.map(m => (
                      <TableRow key={m.id}>
                        <TableCell className="font-medium">{m.name}</TableCell>
                        <TableCell>{m.email}</TableCell>
                        <TableCell>{getCategoryName(m.category_id)}</TableCell>
                        <TableCell>
                          <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded">{m.allowed_pages.length} pages</span>
                        </TableCell>
                        <TableCell>{format(new Date(m.created_at), 'dd MMM yyyy')}</TableCell>
                        <TableCell className="text-right space-x-2">
                          <Button variant="outline" size="sm" onClick={() => openEditMember(m)}><Pencil className="h-3.5 w-3.5" /></Button>
                          <Button variant="destructive" size="sm" onClick={() => setDeleteConfirm({ type: 'member', id: m.id })}><Trash2 className="h-3.5 w-3.5" /></Button>
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
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Members</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {categories.length === 0 ? (
                    <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">No departments yet</TableCell></TableRow>
                  ) : categories.map(cat => (
                    <TableRow key={cat.id}>
                      <TableCell className="font-medium">{cat.name}</TableCell>
                      <TableCell className="text-muted-foreground">{cat.description || '—'}</TableCell>
                      <TableCell>{members.filter(m => m.category_id === cat.id).length}</TableCell>
                      <TableCell>{format(new Date(cat.created_at), 'dd MMM yyyy')}</TableCell>
                      <TableCell className="text-right space-x-2">
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
