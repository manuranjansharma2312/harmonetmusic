import { useState, useEffect, useMemo } from 'react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { RejectReasonModal } from '@/components/RejectReasonModal';
import { StatusBadge } from '@/components/StatusBadge';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { Plus, Pencil, Trash2, CreditCard, History, BarChart3, Settings, Users, Image as ImageIcon } from 'lucide-react';
import { format } from 'date-fns';

type AIPlan = { id: string; name: string; price: number; credits: number; description: string; tag: string | null; is_active: boolean; created_at: string };
type AIOrder = { id: string; user_id: string; plan_id: string; screenshot_url: string | null; transaction_id: string; status: string; rejection_reason: string | null; payment_note: string | null; created_at: string; ai_plans?: { name: string; credits: number; price: number } };
type AICreditTx = { id: string; user_id: string; credits: number; type: string; note: string | null; created_at: string };
type AICredit = { id: string; user_id: string; total_credits: number; used_credits: number };
type Profile = { user_id: string; legal_name: string; display_id: number; email: string };

export default function AdminAIImageSystem() {
  const { user } = useAuth();
  const [tab, setTab] = useState('plans');

  // Plans state
  const [plans, setPlans] = useState<AIPlan[]>([]);
  const [planModal, setPlanModal] = useState(false);
  const [editPlan, setEditPlan] = useState<AIPlan | null>(null);
  const [planForm, setPlanForm] = useState({ name: '', price: '', credits: '', description: '', tag: '' });

  // Orders state
  const [orders, setOrders] = useState<AIOrder[]>([]);
  const [rejectOrderId, setRejectOrderId] = useState<string | null>(null);
  const [noteModal, setNoteModal] = useState<{ id: string; note: string } | null>(null);

  // Credits state
  const [credits, setCredits] = useState<AICredit[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [manualCreditModal, setManualCreditModal] = useState(false);
  const [manualForm, setManualForm] = useState({ userId: '', credits: '', note: '' });

  // Transactions
  const [transactions, setTransactions] = useState<AICreditTx[]>([]);

  // Usage stats
  const [totalImages, setTotalImages] = useState(0);
  const [totalCreditsUsed, setTotalCreditsUsed] = useState(0);
  const [activeUsers, setActiveUsers] = useState(0);

  // Settings
  const [aiSettings, setAiSettings] = useState<{ credits_per_image: number; api_provider: string; is_enabled: boolean; free_credits: number; image_sizes: { label: string; ratio: string }[] }>({ credits_per_image: 1, api_provider: 'openai', is_enabled: true, free_credits: 0, image_sizes: [] });
  const [settingsLoading, setSettingsLoading] = useState(false);
  const [newSize, setNewSize] = useState({ label: '', ratio: '' });

  const profileMap = useMemo(() => {
    const m: Record<string, Profile> = {};
    profiles.forEach(p => { m[p.user_id] = p; });
    return m;
  }, [profiles]);

  const getUserName = (uid: string) => {
    const p = profileMap[uid];
    return p ? `${p.legal_name} (#${p.display_id})` : uid.slice(0, 8);
  };

  // Fetch all data
  const fetchPlans = async () => {
    const { data } = await supabase.from('ai_plans').select('*').order('created_at', { ascending: false });
    if (data) setPlans(data as any);
  };

  const fetchOrders = async () => {
    const { data } = await supabase.from('ai_plan_orders').select('*, ai_plans(name, credits, price)').order('created_at', { ascending: false });
    if (data) setOrders(data as any);
  };

  const fetchCredits = async () => {
    const { data } = await supabase.from('ai_credits').select('*');
    if (data) setCredits(data as any);
  };

  const fetchProfiles = async () => {
    const { data } = await supabase.from('profiles').select('user_id, legal_name, display_id, email');
    if (data) setProfiles(data as any);
  };

  const fetchTransactions = async () => {
    const { data } = await supabase.from('ai_credit_transactions').select('*').order('created_at', { ascending: false });
    if (data) setTransactions(data as any);
  };

  const fetchUsageStats = async () => {
    const { count: imgCount } = await supabase.from('ai_generated_images').select('*', { count: 'exact', head: true });
    setTotalImages(imgCount || 0);
    const { data: credData } = await supabase.from('ai_credits').select('used_credits, user_id');
    if (credData) {
      setTotalCreditsUsed(credData.reduce((s, c) => s + (c as any).used_credits, 0));
      setActiveUsers(credData.filter((c: any) => c.used_credits > 0).length);
    }
  };

  const fetchSettings = async () => {
    const { data } = await supabase.from('ai_settings').select('*').limit(1).maybeSingle();
    if (data) setAiSettings({ credits_per_image: (data as any).credits_per_image, api_provider: (data as any).api_provider, is_enabled: (data as any).is_enabled, free_credits: (data as any).free_credits, image_sizes: (data as any).image_sizes || [] });
  };

  useEffect(() => {
    fetchPlans(); fetchOrders(); fetchCredits(); fetchProfiles(); fetchTransactions(); fetchUsageStats(); fetchSettings();
  }, []);

  // Plan CRUD
  const openPlanModal = (plan?: AIPlan) => {
    if (plan) {
      setEditPlan(plan);
      setPlanForm({ name: plan.name, price: String(plan.price), credits: String(plan.credits), description: plan.description || '', tag: plan.tag || '' });
    } else {
      setEditPlan(null);
      setPlanForm({ name: '', price: '', credits: '', description: '', tag: '' });
    }
    setPlanModal(true);
  };

  const savePlan = async () => {
    const payload = { name: planForm.name, price: Number(planForm.price), credits: Number(planForm.credits), description: planForm.description, tag: planForm.tag || null, updated_at: new Date().toISOString() };
    if (editPlan) {
      const { error } = await supabase.from('ai_plans').update(payload).eq('id', editPlan.id);
      if (error) { toast.error(error.message); return; }
      toast.success('Plan updated');
    } else {
      const { error } = await supabase.from('ai_plans').insert(payload);
      if (error) { toast.error(error.message); return; }
      toast.success('Plan created');
    }
    setPlanModal(false);
    fetchPlans();
  };

  const togglePlan = async (plan: AIPlan) => {
    await supabase.from('ai_plans').update({ is_active: !plan.is_active }).eq('id', plan.id);
    fetchPlans();
  };

  const deletePlan = async (id: string) => {
    if (!confirm('Delete this plan?')) return;
    await supabase.from('ai_plans').delete().eq('id', id);
    fetchPlans();
    toast.success('Plan deleted');
  };

  // Order actions
  const approveOrder = async (order: AIOrder) => {
    const planCredits = (order as any).ai_plans?.credits || 0;
    // Update order status
    await supabase.from('ai_plan_orders').update({ status: 'approved', updated_at: new Date().toISOString() }).eq('id', order.id);
    // Add credits
    const { data: existing } = await supabase.from('ai_credits').select('*').eq('user_id', order.user_id).maybeSingle();
    if (existing) {
      await supabase.from('ai_credits').update({ total_credits: (existing as any).total_credits + planCredits, updated_at: new Date().toISOString() }).eq('user_id', order.user_id);
    } else {
      await supabase.from('ai_credits').insert({ user_id: order.user_id, total_credits: planCredits, used_credits: 0 });
    }
    // Log transaction
    await supabase.from('ai_credit_transactions').insert({ user_id: order.user_id, credits: planCredits, type: 'plan_purchase', note: `Plan approved: ${(order as any).ai_plans?.name}`, order_id: order.id });
    toast.success(`Approved! ${planCredits} credits added`);
    fetchOrders(); fetchCredits(); fetchTransactions(); fetchUsageStats();
  };

  const rejectOrder = async (reason: string) => {
    if (!rejectOrderId) return;
    await supabase.from('ai_plan_orders').update({ status: 'rejected', rejection_reason: reason, updated_at: new Date().toISOString() }).eq('id', rejectOrderId);
    setRejectOrderId(null);
    toast.success('Order rejected');
    fetchOrders();
  };

  const savePaymentNote = async () => {
    if (!noteModal) return;
    await supabase.from('ai_plan_orders').update({ payment_note: noteModal.note }).eq('id', noteModal.id);
    setNoteModal(null);
    toast.success('Note saved');
    fetchOrders();
  };

  // Manual credit
  const addManualCredits = async () => {
    const creditsNum = Number(manualForm.credits);
    if (!manualForm.userId || creditsNum <= 0) { toast.error('Select user and enter credits'); return; }
    const { data: existing } = await supabase.from('ai_credits').select('*').eq('user_id', manualForm.userId).maybeSingle();
    if (existing) {
      await supabase.from('ai_credits').update({ total_credits: (existing as any).total_credits + creditsNum, updated_at: new Date().toISOString() }).eq('user_id', manualForm.userId);
    } else {
      await supabase.from('ai_credits').insert({ user_id: manualForm.userId, total_credits: creditsNum, used_credits: 0 });
    }
    await supabase.from('ai_credit_transactions').insert({ user_id: manualForm.userId, credits: creditsNum, type: 'manual_addition', note: manualForm.note || 'Manually added by admin' });
    toast.success(`${creditsNum} credits added`);
    setManualCreditModal(false);
    setManualForm({ userId: '', credits: '', note: '' });
    fetchCredits(); fetchTransactions(); fetchUsageStats();
  };

  const addImageSize = () => {
    if (!newSize.label || !newSize.ratio) { toast.error('Fill label and ratio'); return; }
    if (!/^\d+:\d+$/.test(newSize.ratio)) { toast.error('Ratio format must be like 9:16'); return; }
    setAiSettings(s => ({ ...s, image_sizes: [...s.image_sizes, { label: newSize.label, ratio: newSize.ratio }] }));
    setNewSize({ label: '', ratio: '' });
  };

  const removeImageSize = (idx: number) => {
    setAiSettings(s => ({ ...s, image_sizes: s.image_sizes.filter((_, i) => i !== idx) }));
  };

  const saveSettings = async () => {
    setSettingsLoading(true);
    const { data: settingsRow } = await supabase.from('ai_settings').select('id').limit(1).single();
    await supabase.from('ai_settings').update({ credits_per_image: aiSettings.credits_per_image, api_provider: aiSettings.api_provider, is_enabled: aiSettings.is_enabled, free_credits: aiSettings.free_credits, image_sizes: aiSettings.image_sizes as any, updated_at: new Date().toISOString(), updated_by: user?.id }).eq('id', settingsRow?.id || '');
    toast.success('Settings saved');
    setSettingsLoading(false);
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">AI Poster Generate</h1>
        </div>

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="flex flex-wrap h-auto gap-1">
            <TabsTrigger value="plans" className="gap-1"><CreditCard className="h-4 w-4" />Plans</TabsTrigger>
            <TabsTrigger value="orders" className="gap-1"><History className="h-4 w-4" />Orders</TabsTrigger>
            <TabsTrigger value="credits" className="gap-1"><Users className="h-4 w-4" />User Credits</TabsTrigger>
            <TabsTrigger value="transactions" className="gap-1"><History className="h-4 w-4" />Transactions</TabsTrigger>
            <TabsTrigger value="usage" className="gap-1"><BarChart3 className="h-4 w-4" />Usage</TabsTrigger>
            <TabsTrigger value="settings" className="gap-1"><Settings className="h-4 w-4" />Settings</TabsTrigger>
          </TabsList>

          {/* PLANS TAB */}
          <TabsContent value="plans">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Manage Plans</CardTitle>
                <Button onClick={() => openPlanModal()} size="sm"><Plus className="h-4 w-4 mr-1" />Add Plan</Button>
              </CardHeader>
              <CardContent>
                <div className="overflow-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Price (₹)</TableHead>
                        <TableHead>Credits</TableHead>
                        <TableHead>Tag</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {plans.map(p => (
                        <TableRow key={p.id}>
                          <TableCell className="font-medium">{p.name}</TableCell>
                          <TableCell>₹{p.price}</TableCell>
                          <TableCell>{p.credits}</TableCell>
                          <TableCell>{p.tag ? <Badge variant="secondary">{p.tag}</Badge> : '—'}</TableCell>
                          <TableCell>
                            <Switch checked={p.is_active} onCheckedChange={() => togglePlan(p)} />
                          </TableCell>
                          <TableCell className="flex gap-1">
                            <Button variant="ghost" size="icon" onClick={() => openPlanModal(p)}><Pencil className="h-4 w-4" /></Button>
                            <Button variant="ghost" size="icon" onClick={() => deletePlan(p.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                          </TableCell>
                        </TableRow>
                      ))}
                      {plans.length === 0 && <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">No plans yet</TableCell></TableRow>}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ORDERS TAB */}
          <TabsContent value="orders">
            <Card>
              <CardHeader><CardTitle>Plan Orders</CardTitle></CardHeader>
              <CardContent>
                <div className="overflow-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>User</TableHead>
                        <TableHead>Plan</TableHead>
                        <TableHead>Transaction ID</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {orders.map(o => (
                        <TableRow key={o.id}>
                          <TableCell>{getUserName(o.user_id)}</TableCell>
                          <TableCell>{(o as any).ai_plans?.name || '—'} ({(o as any).ai_plans?.credits} cr)</TableCell>
                          <TableCell className="font-mono text-xs">{o.transaction_id}</TableCell>
                          <TableCell>{format(new Date(o.created_at), 'dd MMM yyyy')}</TableCell>
                          <TableCell><StatusBadge status={o.status} /></TableCell>
                          <TableCell className="flex gap-1 flex-wrap">
                            {o.status === 'pending' && (
                              <>
                                <Button size="sm" variant="default" onClick={() => approveOrder(o)}>Approve</Button>
                                <Button size="sm" variant="destructive" onClick={() => setRejectOrderId(o.id)}>Reject</Button>
                              </>
                            )}
                            {o.screenshot_url && (
                              <Button size="sm" variant="outline" onClick={() => window.open(o.screenshot_url!, '_blank')}>Screenshot</Button>
                            )}
                            <Button size="sm" variant="ghost" onClick={() => setNoteModal({ id: o.id, note: o.payment_note || '' })}>Note</Button>
                          </TableCell>
                        </TableRow>
                      ))}
                      {orders.length === 0 && <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">No orders yet</TableCell></TableRow>}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* USER CREDITS TAB */}
          <TabsContent value="credits">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>User Credits</CardTitle>
                <Button size="sm" onClick={() => setManualCreditModal(true)}><Plus className="h-4 w-4 mr-1" />Add Credits</Button>
              </CardHeader>
              <CardContent>
                <div className="overflow-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>User</TableHead>
                        <TableHead>Total Credits</TableHead>
                        <TableHead>Used</TableHead>
                        <TableHead>Remaining</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {credits.map(c => (
                        <TableRow key={c.id}>
                          <TableCell>{getUserName(c.user_id)}</TableCell>
                          <TableCell>{c.total_credits}</TableCell>
                          <TableCell>{c.used_credits}</TableCell>
                          <TableCell className="font-semibold">{c.total_credits - c.used_credits}</TableCell>
                        </TableRow>
                      ))}
                      {credits.length === 0 && <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground">No credit records</TableCell></TableRow>}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* TRANSACTIONS TAB */}
          <TabsContent value="transactions">
            <Card>
              <CardHeader><CardTitle>Credit Transaction History</CardTitle></CardHeader>
              <CardContent>
                <div className="overflow-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>User</TableHead>
                        <TableHead>Credits</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Note</TableHead>
                        <TableHead>Date</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {transactions.map(t => (
                        <TableRow key={t.id}>
                          <TableCell>{getUserName(t.user_id)}</TableCell>
                          <TableCell className={t.type === 'usage' ? 'text-destructive' : 'text-green-600'}>{t.type === 'usage' ? '-' : '+'}{t.credits}</TableCell>
                          <TableCell><Badge variant="outline">{t.type.replace('_', ' ')}</Badge></TableCell>
                          <TableCell className="max-w-[200px] truncate">{t.note || '—'}</TableCell>
                          <TableCell>{format(new Date(t.created_at), 'dd MMM yyyy HH:mm')}</TableCell>
                        </TableRow>
                      ))}
                      {transactions.length === 0 && <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">No transactions</TableCell></TableRow>}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* USAGE TAB */}
          <TabsContent value="usage">
            <div className="grid gap-4 md:grid-cols-3">
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Total Images Generated</CardTitle></CardHeader>
                <CardContent><p className="text-3xl font-bold">{totalImages}</p></CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Total Credits Used</CardTitle></CardHeader>
                <CardContent><p className="text-3xl font-bold">{totalCreditsUsed}</p></CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Active Users (AI)</CardTitle></CardHeader>
                <CardContent><p className="text-3xl font-bold">{activeUsers}</p></CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* SETTINGS TAB */}
          <TabsContent value="settings">
            <Card>
              <CardHeader><CardTitle>AI Poster Generate Settings</CardTitle></CardHeader>
              <CardContent className="space-y-4 max-w-md">
                <div className="flex items-center justify-between rounded-lg border p-3">
                  <div>
                    <Label className="text-base">Enable AI Poster System</Label>
                    <p className="text-xs text-muted-foreground">When disabled, the AI Poster menu is hidden from users.</p>
                  </div>
                  <Switch checked={aiSettings.is_enabled} onCheckedChange={v => setAiSettings(s => ({ ...s, is_enabled: v }))} />
                </div>
                <div>
                  <Label>Free Credits for New Users</Label>
                  <Input type="text" inputMode="numeric" value={aiSettings.free_credits} onChange={e => { const v = e.target.value.replace(/[^0-9]/g, ''); setAiSettings(s => ({ ...s, free_credits: Number(v) || 0 })); }} />
                  <p className="text-xs text-muted-foreground mt-1">Each new user gets this many free credits automatically.</p>
                </div>
                <div>
                  <Label>API Provider</Label>
                  <Input value={aiSettings.api_provider} onChange={e => setAiSettings(s => ({ ...s, api_provider: e.target.value }))} placeholder="e.g. openai, stability, etc." />
                  <p className="text-xs text-muted-foreground mt-1">The API key is securely stored as an edge function secret. Users cannot see it.</p>
                </div>
                <div>
                  <Label>Credits Per Image</Label>
                  <Input type="number" min={1} value={aiSettings.credits_per_image} onChange={e => setAiSettings(s => ({ ...s, credits_per_image: Number(e.target.value) }))} />
                </div>

                {/* Image Sizes (Aspect Ratios) */}
                <div className="space-y-3 pt-2 border-t">
                  <Label className="text-base">Image Size Options (Aspect Ratios)</Label>
                  <p className="text-xs text-muted-foreground">Define aspect ratio presets that users can choose when generating posters (e.g. 9:16, 3:4, 1:1).</p>
                  
                  {aiSettings.image_sizes.map((size, idx) => (
                    <div key={idx} className="flex items-center gap-2 rounded-lg border p-2">
                      <span className="flex-1 text-sm font-medium">{size.label}</span>
                      <Badge variant="secondary">{size.ratio}</Badge>
                      <Button variant="ghost" size="icon" onClick={() => removeImageSize(idx)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                    </div>
                  ))}

                  <div className="grid grid-cols-2 gap-2">
                    <Input placeholder="Label (e.g. Portrait)" value={newSize.label} onChange={e => setNewSize(s => ({ ...s, label: e.target.value }))} />
                    <Input placeholder="Ratio (e.g. 9:16)" value={newSize.ratio} onChange={e => setNewSize(s => ({ ...s, ratio: e.target.value }))} />
                  </div>
                  <Button variant="outline" size="sm" onClick={addImageSize}><Plus className="h-4 w-4 mr-1" />Add Size</Button>
                </div>

                <Button onClick={saveSettings} disabled={settingsLoading}>{settingsLoading ? 'Saving...' : 'Save Settings'}</Button>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Plan Modal */}
      <Dialog open={planModal} onOpenChange={setPlanModal}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editPlan ? 'Edit Plan' : 'Create Plan'}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Plan Name *</Label><Input value={planForm.name} onChange={e => setPlanForm(f => ({ ...f, name: e.target.value }))} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Price (₹) *</Label><Input type="number" value={planForm.price} onChange={e => setPlanForm(f => ({ ...f, price: e.target.value }))} /></div>
              <div><Label>Credits *</Label><Input type="number" value={planForm.credits} onChange={e => setPlanForm(f => ({ ...f, credits: e.target.value }))} /></div>
            </div>
            <div><Label>Description</Label><Textarea value={planForm.description} onChange={e => setPlanForm(f => ({ ...f, description: e.target.value }))} /></div>
            <div><Label>Tag (e.g. Most Popular)</Label><Input value={planForm.tag} onChange={e => setPlanForm(f => ({ ...f, tag: e.target.value }))} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPlanModal(false)}>Cancel</Button>
            <Button onClick={savePlan} disabled={!planForm.name || !planForm.price || !planForm.credits}>{editPlan ? 'Update' : 'Create'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reject Modal */}
      <RejectReasonModal open={!!rejectOrderId} title="Reject Order" onConfirm={rejectOrder} onCancel={() => setRejectOrderId(null)} />

      {/* Payment Note Modal */}
      <Dialog open={!!noteModal} onOpenChange={() => setNoteModal(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Payment Note</DialogTitle></DialogHeader>
          <Textarea value={noteModal?.note || ''} onChange={e => setNoteModal(n => n ? { ...n, note: e.target.value } : null)} placeholder="Add payment confirmation note..." />
          <DialogFooter>
            <Button variant="outline" onClick={() => setNoteModal(null)}>Cancel</Button>
            <Button onClick={savePaymentNote}>Save Note</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Manual Credit Modal */}
      <Dialog open={manualCreditModal} onOpenChange={setManualCreditModal}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add Credits Manually</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Select User *</Label>
              <Select value={manualForm.userId} onValueChange={v => setManualForm(f => ({ ...f, userId: v }))}>
                <SelectTrigger><SelectValue placeholder="Choose user" /></SelectTrigger>
                <SelectContent>
                  {profiles.map(p => (
                    <SelectItem key={p.user_id} value={p.user_id}>{p.legal_name} (#{p.display_id})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div><Label>Credits *</Label><Input type="number" min={1} value={manualForm.credits} onChange={e => setManualForm(f => ({ ...f, credits: e.target.value }))} /></div>
            <div><Label>Note (Optional)</Label><Textarea value={manualForm.note} onChange={e => setManualForm(f => ({ ...f, note: e.target.value }))} placeholder="Reason for adding credits..." /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setManualCreditModal(false)}>Cancel</Button>
            <Button onClick={addManualCredits} disabled={!manualForm.userId || !manualForm.credits}>Add Credits</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
