import { useState, useEffect } from 'react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { StatusBadge } from '@/components/StatusBadge';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { Sparkles, CreditCard, History, Image as ImageIcon, Upload, CheckCircle, Loader2, Download, Wand2 } from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import { format } from 'date-fns';

type AIPlan = { id: string; name: string; price: number; credits: number; description: string; tag: string | null };
type AIOrder = { id: string; plan_id: string; transaction_id: string; status: string; rejection_reason: string | null; created_at: string; ai_plans?: { name: string; credits: number; price: number } };
type AIGenImage = { id: string; prompt: string; image_url: string | null; credits_used: number; created_at: string };

export default function AIImageGeneration() {
  const { user } = useAuth();
  const [tab, setTab] = useState('plans');

  // Plans
  const [plans, setPlans] = useState<AIPlan[]>([]);

  // Credits
  const [totalCredits, setTotalCredits] = useState(0);
  const [usedCredits, setUsedCredits] = useState(0);
  const remaining = totalCredits - usedCredits;

  // Orders
  const [orders, setOrders] = useState<AIOrder[]>([]);

  // Generated images
  const [images, setImages] = useState<AIGenImage[]>([]);

  // Purchase modal
  const [purchaseModal, setPurchaseModal] = useState<AIPlan | null>(null);
  const [txId, setTxId] = useState('');
  const [screenshot, setScreenshot] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Generate state
  const [prompt, setPrompt] = useState('');
  const [generating, setGenerating] = useState(false);
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
  const [creditsPerImage, setCreditsPerImage] = useState(1);

  // Payment settings (QR code etc)
  const [qrCodeUrl, setQrCodeUrl] = useState<string | null>(null);
  const [taxes, setTaxes] = useState<any[]>([]);

  const fetchData = async () => {
    if (!user) return;
    const [plansRes, credRes, ordersRes, imagesRes, settingsRes, aiSettingsRes] = await Promise.all([
      supabase.from('ai_plans').select('*').eq('is_active', true).order('price'),
      supabase.from('ai_credits').select('*').eq('user_id', user.id).maybeSingle(),
      supabase.from('ai_plan_orders').select('*, ai_plans(name, credits, price)').eq('user_id', user.id).order('created_at', { ascending: false }),
      supabase.from('ai_generated_images').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).limit(50),
      supabase.from('promotion_settings').select('qr_code_url, taxes').limit(1).maybeSingle(),
      supabase.from('ai_settings').select('free_credits').limit(1).maybeSingle(),
    ]);
    if (plansRes.data) setPlans(plansRes.data as any);
    if (ordersRes.data) setOrders(ordersRes.data as any);
    if (imagesRes.data) setImages(imagesRes.data as any);
    if (settingsRes.data) { setQrCodeUrl((settingsRes.data as any).qr_code_url); setTaxes((settingsRes.data as any).taxes || []); }

    // Handle credits & free credits auto-provisioning
    const freeCredits = (aiSettingsRes.data as any)?.free_credits || 0;
    if (credRes.data) {
      setTotalCredits((credRes.data as any).total_credits);
      setUsedCredits((credRes.data as any).used_credits);
    } else if (freeCredits > 0) {
      // Auto-provision free credits for first-time user
      await supabase.from('ai_credits').insert({ user_id: user.id, total_credits: freeCredits, used_credits: 0 });
      await supabase.from('ai_credit_transactions').insert({ user_id: user.id, credits: freeCredits, type: 'free_credits', note: 'Free credits on first visit' });
      setTotalCredits(freeCredits);
      setUsedCredits(0);
    }
  };

  useEffect(() => { fetchData(); }, [user]);

  const calculateTotal = (price: number) => {
    let total = price;
    taxes.forEach((t: any) => { total += price * (t.percent || 0) / 100; });
    return total;
  };

  const submitOrder = async () => {
    if (!purchaseModal || !user || !txId.trim()) return;
    setSubmitting(true);
    try {
      // Check duplicate transaction ID across tables
      const { data: existingAI } = await supabase.from('ai_plan_orders').select('id').eq('transaction_id', txId.trim()).maybeSingle();
      if (existingAI) { toast.error('This Transaction ID already exists!'); setSubmitting(false); return; }
      const { data: existingPromo } = await supabase.from('promotion_orders').select('id').eq('transaction_id', txId.trim()).maybeSingle();
      if (existingPromo) { toast.error('This Transaction ID already exists!'); setSubmitting(false); return; }
      const { data: existingContent } = await supabase.from('content_requests').select('id').eq('transaction_id', txId.trim()).maybeSingle();
      if (existingContent) { toast.error('This Transaction ID already exists!'); setSubmitting(false); return; }

      let screenshotUrl: string | null = null;
      if (screenshot) {
        const ext = screenshot.name.split('.').pop();
        const path = `ai-orders/${user.id}/${Date.now()}.${ext}`;
        const { error: upErr } = await supabase.storage.from('promotion-screenshots').upload(path, screenshot);
        if (upErr) { toast.error('Screenshot upload failed'); setSubmitting(false); return; }
        const { data: urlData } = supabase.storage.from('promotion-screenshots').getPublicUrl(path);
        screenshotUrl = urlData.publicUrl;
      }

      const { error } = await supabase.from('ai_plan_orders').insert({
        user_id: user.id,
        plan_id: purchaseModal.id,
        transaction_id: txId.trim(),
        screenshot_url: screenshotUrl,
        status: 'pending',
      });
      if (error) { toast.error(error.message); setSubmitting(false); return; }
      toast.success('Order submitted! Waiting for admin approval.');
      setPurchaseModal(null);
      setTxId('');
      setScreenshot(null);
      fetchData();
    } finally { setSubmitting(false); }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <h1 className="text-2xl font-bold flex items-center gap-2"><Sparkles className="h-6 w-6 text-primary" />AI Poster Generate</h1>
          <Card className="px-4 py-2 flex items-center gap-3">
            <CreditCard className="h-5 w-5 text-primary" />
            <div>
              <p className="text-xs text-muted-foreground">Credits</p>
              <p className="font-bold text-lg">{remaining} <span className="text-xs text-muted-foreground font-normal">remaining</span></p>
            </div>
          </Card>
        </div>

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList>
            <TabsTrigger value="plans" className="gap-1"><CreditCard className="h-4 w-4" />Buy Credits</TabsTrigger>
            <TabsTrigger value="orders" className="gap-1"><History className="h-4 w-4" />My Orders</TabsTrigger>
            <TabsTrigger value="gallery" className="gap-1"><ImageIcon className="h-4 w-4" />My Images</TabsTrigger>
          </TabsList>

          {/* PLANS */}
          <TabsContent value="plans">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {plans.map(plan => (
                <Card key={plan.id} className="relative flex flex-col">
                  {plan.tag && (
                    <Badge className="absolute top-3 right-3" variant="default">{plan.tag}</Badge>
                  )}
                  <CardHeader>
                    <CardTitle>{plan.name}</CardTitle>
                    {plan.description && <CardDescription>{plan.description}</CardDescription>}
                  </CardHeader>
                  <CardContent className="flex-1">
                    <p className="text-3xl font-bold">₹{plan.price}</p>
                    <p className="text-muted-foreground">{plan.credits} credits</p>
                    {taxes.length > 0 && (
                      <p className="text-xs text-muted-foreground mt-1">
                        Total with taxes: ₹{calculateTotal(plan.price).toFixed(2)}
                      </p>
                    )}
                  </CardContent>
                  <CardFooter>
                    <Button className="w-full" onClick={() => setPurchaseModal(plan)}>Buy Now</Button>
                  </CardFooter>
                </Card>
              ))}
              {plans.length === 0 && (
                <Card className="col-span-full py-8 text-center text-muted-foreground">
                  No plans available at the moment.
                </Card>
              )}
            </div>
          </TabsContent>

          {/* MY ORDERS */}
          <TabsContent value="orders">
            <Card>
              <CardHeader><CardTitle>My Orders</CardTitle></CardHeader>
              <CardContent>
                <div className="overflow-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Plan</TableHead>
                        <TableHead>Transaction ID</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Note</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {orders.map(o => (
                        <TableRow key={o.id}>
                          <TableCell>{(o as any).ai_plans?.name} ({(o as any).ai_plans?.credits} cr)</TableCell>
                          <TableCell className="font-mono text-xs">{o.transaction_id}</TableCell>
                          <TableCell>{format(new Date(o.created_at), 'dd MMM yyyy')}</TableCell>
                          <TableCell><StatusBadge status={o.status} /></TableCell>
                          <TableCell className="text-xs max-w-[200px] truncate">{o.rejection_reason || '—'}</TableCell>
                        </TableRow>
                      ))}
                      {orders.length === 0 && <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">No orders yet</TableCell></TableRow>}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* MY IMAGES */}
          <TabsContent value="gallery">
            <Card>
              <CardHeader><CardTitle>Generated Images</CardTitle></CardHeader>
              <CardContent>
                {images.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">No images generated yet. Purchase credits to start!</p>
                ) : (
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {images.map(img => (
                      <Card key={img.id} className="overflow-hidden">
                        {img.image_url ? (
                          <img src={img.image_url} alt={img.prompt} className="w-full h-48 object-cover" />
                        ) : (
                          <div className="w-full h-48 bg-muted flex items-center justify-center"><ImageIcon className="h-12 w-12 text-muted-foreground" /></div>
                        )}
                        <CardContent className="p-3">
                          <p className="text-sm truncate">{img.prompt}</p>
                          <p className="text-xs text-muted-foreground">{format(new Date(img.created_at), 'dd MMM yyyy HH:mm')}</p>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Purchase Modal */}
      <Dialog open={!!purchaseModal} onOpenChange={() => { setPurchaseModal(null); setTxId(''); setScreenshot(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Purchase: {purchaseModal?.name}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="bg-muted/50 rounded-lg p-3 space-y-1">
              <p className="text-sm">Plan: <span className="font-semibold">{purchaseModal?.name}</span></p>
              <p className="text-sm">Credits: <span className="font-semibold">{purchaseModal?.credits}</span></p>
              <p className="text-sm">Price: <span className="font-semibold">₹{purchaseModal?.price}</span></p>
              {taxes.length > 0 && (
                <>
                  {taxes.map((t: any, i: number) => (
                    <p key={i} className="text-xs text-muted-foreground">{t.name}: {t.percent}%</p>
                  ))}
                  <p className="text-sm font-bold">Total: ₹{purchaseModal ? calculateTotal(purchaseModal.price).toFixed(2) : 0}</p>
                </>
              )}
            </div>

            {qrCodeUrl && (
              <div className="text-center">
                <p className="text-sm font-medium mb-2">Scan QR Code to Pay</p>
                <img src={qrCodeUrl} alt="Payment QR" className="mx-auto h-40 w-40 rounded-lg border" />
              </div>
            )}

            <div>
              <Label>Transaction ID *</Label>
              <Input value={txId} onChange={e => setTxId(e.target.value)} placeholder="Enter your transaction ID" />
            </div>
            <div>
              <Label>Payment Screenshot</Label>
              <Input type="file" accept="image/*" onChange={e => setScreenshot(e.target.files?.[0] || null)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPurchaseModal(null)}>Cancel</Button>
            <Button onClick={submitOrder} disabled={submitting || !txId.trim()}>
              {submitting ? 'Submitting...' : 'Submit Order'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
