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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useImpersonate } from '@/hooks/useImpersonate';
import { toast } from 'sonner';
import { Sparkles, CreditCard, History, Image as ImageIcon, Upload, CheckCircle, Loader2, Download, Wand2, X, Paperclip } from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import { format, formatDistanceToNow, addHours, isAfter } from 'date-fns';
import { addWatermark } from '@/lib/watermark';

type AIPlan = { id: string; name: string; price: number; credits: number; description: string; tag: string | null };
type AIOrder = { id: string; plan_id: string; transaction_id: string; status: string; rejection_reason: string | null; created_at: string; ai_plans?: { name: string; credits: number; price: number } };
type AIGenImage = { id: string; prompt: string; image_url: string | null; credits_used: number; created_at: string };

export default function AIImageGeneration() {
  const { user, role } = useAuth();
  const { impersonatedUserId } = useImpersonate();
  const activeUserId = impersonatedUserId || user?.id;
  const [tab, setTab] = useState('generate');

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
  const [imageSizes, setImageSizes] = useState<{ label: string; ratio: string }[]>([]);
  const [selectedSize, setSelectedSize] = useState('');
  const [referenceImage, setReferenceImage] = useState<File | null>(null);
  const [referencePreview, setReferencePreview] = useState<string | null>(null);
  const [isLifetimeFree, setIsLifetimeFree] = useState(false);

  // Payment settings (QR code etc)
  const [qrCodeUrl, setQrCodeUrl] = useState<string | null>(null);
  const [taxes, setTaxes] = useState<any[]>([]);

  const fetchData = async () => {
    if (!activeUserId) return;
    
    // Fetch AI settings FIRST to determine lifetime free status
    const { data: aiSettingsArr } = await supabase.rpc('get_ai_settings_public' as any);
    const aiSettingsData = Array.isArray(aiSettingsArr) ? aiSettingsArr[0] : aiSettingsArr;
    
    const lfEnabled = aiSettingsData?.lifetime_free_enabled === true;
    const lfAllUsers = aiSettingsData?.lifetime_free_all_users !== false; // default true
    const lfUserIds: string[] = (aiSettingsData?.lifetime_free_user_ids as string[]) || [];
    const userIsLifetimeFree = lfEnabled && (lfAllUsers || lfUserIds.includes(activeUserId));
    setIsLifetimeFree(userIsLifetimeFree);
    
    setCreditsPerImage(aiSettingsData?.credits_per_image || 1);
    const sizes = (aiSettingsData?.image_sizes as any[]) || [];
    setImageSizes(sizes);
    if (sizes.length > 0 && !selectedSize) setSelectedSize(sizes[0].ratio);

    const [plansRes, credRes, ordersRes, imagesRes, settingsRes] = await Promise.all([
      supabase.from('ai_plans').select('*').eq('is_active', true).order('price'),
      supabase.from('ai_credits').select('*').eq('user_id', activeUserId).maybeSingle(),
      supabase.from('ai_plan_orders').select('*, ai_plans(name, credits, price)').eq('user_id', activeUserId).order('created_at', { ascending: false }),
      supabase.from('ai_generated_images').select('*').eq('user_id', activeUserId).order('created_at', { ascending: false }).limit(50),
      supabase.from('promotion_settings').select('qr_code_url, taxes').limit(1).maybeSingle(),
    ]);
    if (plansRes.data) setPlans(plansRes.data as any);
    if (ordersRes.data) setOrders(ordersRes.data as any);
    if (imagesRes.data) setImages(imagesRes.data as any);
    if (settingsRes.data) { setQrCodeUrl((settingsRes.data as any).qr_code_url); setTaxes((settingsRes.data as any).taxes || []); }

    // Handle credits - if lifetime free, no need for credit provisioning
    if (userIsLifetimeFree) {
      // Set high values so UI doesn't block generation
      setTotalCredits(999999);
      setUsedCredits(0);
    } else {
      const freeCredits = aiSettingsData?.free_credits || 0;
      if (credRes.data) {
        setTotalCredits((credRes.data as any).total_credits);
        setUsedCredits((credRes.data as any).used_credits);
      } else if (freeCredits > 0 && !impersonatedUserId) {
        await supabase.rpc('init_ai_credits' as any, { _user_id: activeUserId, _free_credits: freeCredits });
        await supabase.rpc('log_ai_credit_transaction' as any, { _user_id: activeUserId, _credits: freeCredits, _type: 'free_credits', _note: 'Free credits on first visit' });
        setTotalCredits(freeCredits);
        setUsedCredits(0);
      }
    }
  };

  useEffect(() => { fetchData(); }, [activeUserId]);

  const calculateTotal = (price: number) => {
    let total = price;
    taxes.forEach((t: any) => { total += price * (t.percent || 0) / 100; });
    return total;
  };

  const submitOrder = async () => {
    if (!purchaseModal || !activeUserId || !txId.trim()) return;
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
        const path = `ai-orders/${activeUserId}/${Date.now()}.${ext}`;
        const { error: upErr } = await supabase.storage.from('promotion-screenshots').upload(path, screenshot);
        if (upErr) { toast.error('Screenshot upload failed'); setSubmitting(false); return; }
        const { data: urlData } = supabase.storage.from('promotion-screenshots').getPublicUrl(path);
        screenshotUrl = urlData.publicUrl;
      }

      const { error } = await supabase.from('ai_plan_orders').insert({
        user_id: activeUserId,
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

  const generateImage = async () => {
    if (!activeUserId || !prompt.trim()) return;
    if (!isLifetimeFree && remaining < creditsPerImage) { toast.error(`Not enough credits. You need ${creditsPerImage} credits.`); return; }
    setGenerating(true);
    setGeneratedImage(null);
    try {
      // Convert reference image to base64 if provided
      let referenceImageData: string | undefined;
      if (referenceImage) {
        referenceImageData = await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.readAsDataURL(referenceImage);
        });
      }

      const { data, error } = await supabase.functions.invoke('generate-ai-poster', { 
        body: { 
          prompt: prompt.trim(), 
          aspectRatio: selectedSize || undefined,
          referenceImage: referenceImageData || undefined,
        } 
      });
      if (error) { toast.error('Generation failed. Please try again.'); return; }
      if (data?.error) { toast.error(data.error); return; }
      const imageUrl = data?.image_url;
      if (!imageUrl) { toast.error('No image generated. Try a different prompt.'); return; }

      // Add Harmonet Music watermark to generated image
      let watermarkedUrl: string;
      try {
        watermarkedUrl = await addWatermark(imageUrl);
      } catch {
        watermarkedUrl = imageUrl; // Fallback to original if watermark fails
      }

      setGeneratedImage(watermarkedUrl);

      // Deduct credits only if not lifetime free
      if (!isLifetimeFree) {
        await supabase.rpc('deduct_ai_credit' as any, { _user_id: activeUserId, _amount: creditsPerImage });
        await supabase.rpc('log_ai_credit_transaction' as any, { _user_id: activeUserId, _credits: creditsPerImage, _type: 'usage', _note: `Generated: ${prompt.trim().slice(0, 100)}` });
        setUsedCredits(prev => prev + creditsPerImage);
      }
      await supabase.from('ai_generated_images').insert({ user_id: activeUserId, prompt: prompt.trim(), image_url: watermarkedUrl, credits_used: isLifetimeFree ? 0 : creditsPerImage });
      toast.success('Poster generated!');
      // Refresh gallery
      const { data: imgData } = await supabase.from('ai_generated_images').select('*').eq('user_id', activeUserId).order('created_at', { ascending: false }).limit(50);
      if (imgData) setImages(imgData as any);
    } catch (e) {
      toast.error('Generation failed. Please try again.');
    } finally { setGenerating(false); }
  };

  const downloadImage = (dataUrl: string, filename: string) => {
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = filename;
    a.click();
  };

  const handleReferenceImage = (file: File | null) => {
    setReferenceImage(file);
    if (file) {
      const url = URL.createObjectURL(file);
      setReferencePreview(url);
    } else {
      setReferencePreview(null);
    }
  };

  const clearReferenceImage = () => {
    setReferenceImage(null);
    if (referencePreview) URL.revokeObjectURL(referencePreview);
    setReferencePreview(null);
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2"><Sparkles className="h-6 w-6 text-primary" />AI Poster Generate</h1>
            <p className="text-sm text-muted-foreground mt-1 ml-8 italic">Create Ultra-Realistic, Studio-Quality Posters — Powered by Harmonet Music Image Generation AI ✨</p>
          </div>
          <Card className="px-4 py-2 flex items-center gap-3">
            <CreditCard className="h-5 w-5 text-primary" />
            <div>
              <p className="text-xs text-muted-foreground">Credits</p>
              {isLifetimeFree ? (
                <p className="font-bold text-lg text-green-600">Unlimited <span className="text-xs text-muted-foreground font-normal">(Free Plan)</span></p>
              ) : (
                <p className="font-bold text-lg">{remaining} <span className="text-xs text-muted-foreground font-normal">remaining</span></p>
              )}
            </div>
          </Card>
        </div>

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="flex flex-wrap h-auto gap-1">
            <TabsTrigger value="generate" className="gap-1"><Wand2 className="h-4 w-4" />Generate</TabsTrigger>
            <TabsTrigger value="gallery" className="gap-1"><ImageIcon className="h-4 w-4" />My Posters</TabsTrigger>
            {!isLifetimeFree && <TabsTrigger value="plans" className="gap-1"><CreditCard className="h-4 w-4" />Buy Credits</TabsTrigger>}
            {!isLifetimeFree && <TabsTrigger value="orders" className="gap-1"><History className="h-4 w-4" />My Orders</TabsTrigger>}
          </TabsList>

          {/* GENERATE TAB */}
          <TabsContent value="generate">
            <div className="grid gap-6 lg:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2"><Wand2 className="h-5 w-5" />Create Your Poster</CardTitle>
                  <CardDescription>Describe the poster you want to generate. Be detailed for better results.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label>Your Prompt *</Label>
                    <Textarea
                      value={prompt}
                      onChange={e => setPrompt(e.target.value)}
                      placeholder="e.g. A vibrant music album poster for a pop song called 'Midnight Dreams' with neon lights, city skyline, and bold typography..."
                      className="min-h-[140px]"
                      disabled={generating}
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      {isLifetimeFree ? 'Unlimited free generation — no credits needed!' : `Cost: ${creditsPerImage} credit${creditsPerImage > 1 ? 's' : ''} per generation`}
                    </p>
                    <p className="text-xs text-amber-500 mt-1">⚠️ Generated posters are automatically deleted after 12 hours. Download them before they expire!</p>
                  </div>
                  {imageSizes.length > 0 && (
                    <div>
                      <Label>Aspect Ratio *</Label>
                      <Select value={selectedSize} onValueChange={setSelectedSize}>
                        <SelectTrigger><SelectValue placeholder="Select aspect ratio" /></SelectTrigger>
                        <SelectContent>
                          {imageSizes.map((s, i) => (
                            <SelectItem key={i} value={s.ratio}>{s.label} ({s.ratio})</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                  {/* Reference Image */}
                  <div>
                    <Label>Reference Image (Optional)</Label>
                    {referencePreview ? (
                      <div className="relative mt-2 inline-block">
                        <img src={referencePreview} alt="Reference" className="h-32 rounded-lg border object-cover" />
                        <Button variant="destructive" size="icon" className="absolute -top-2 -right-2 h-6 w-6 rounded-full" onClick={clearReferenceImage}>
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    ) : (
                      <div className="mt-1">
                        <label className="flex items-center gap-2 cursor-pointer rounded-lg border border-dashed p-3 hover:bg-muted/50 transition-colors">
                          <Paperclip className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm text-muted-foreground">Attach a reference image</span>
                          <Input type="file" accept="image/*" className="hidden" onChange={e => handleReferenceImage(e.target.files?.[0] || null)} disabled={generating} />
                        </label>
                      </div>
                    )}
                    <p className="text-xs text-muted-foreground mt-1">Upload an image to use as style/design reference for AI generation.</p>
                  </div>
                  <Button onClick={generateImage} disabled={generating || !prompt.trim() || (!isLifetimeFree && remaining < creditsPerImage)} className="w-full" size="lg">
                    {generating ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Generating...</> : <><Sparkles className="h-4 w-4 mr-2" />Generate Poster</>}
                  </Button>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Preview</CardTitle>
                </CardHeader>
                <CardContent className="flex items-center justify-center min-h-[300px]">
                  {generating ? (
                    <div className="text-center space-y-3">
                      <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto" />
                      <p className="text-muted-foreground">Creating your poster...</p>
                    </div>
                  ) : generatedImage ? (
                    <div className="space-y-3 w-full">
                      <img src={generatedImage} alt="Generated poster" className="w-full rounded-lg border max-h-[400px] object-contain" />
                      <Button variant="outline" className="w-full" onClick={() => downloadImage(generatedImage, `ai-poster-${Date.now()}.png`)}>
                        <Download className="h-4 w-4 mr-2" />Download Poster
                      </Button>
                    </div>
                  ) : (
                    <div className="text-center text-muted-foreground space-y-2">
                      <ImageIcon className="h-16 w-16 mx-auto opacity-30" />
                      <p>Your generated poster will appear here</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

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
                          {isAfter(addHours(new Date(img.created_at), 12), new Date()) ? (
                            <p className="text-xs text-orange-500 mt-1">⏳ Expires {formatDistanceToNow(addHours(new Date(img.created_at), 12), { addSuffix: true })}</p>
                          ) : (
                            <p className="text-xs text-destructive mt-1">⚠️ Expired — will be removed soon</p>
                          )}
                          {img.image_url && (
                            <Button variant="outline" size="sm" className="w-full mt-2" onClick={() => downloadImage(img.image_url!, `poster-${img.id}.png`)}>
                              <Download className="h-3 w-3 mr-1" />Download
                            </Button>
                          )}
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
