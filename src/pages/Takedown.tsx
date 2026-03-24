import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { DashboardLayout } from '@/components/DashboardLayout';
import { GlassCard } from '@/components/GlassCard';
import { StatusBadge } from '@/components/StatusBadge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { Send, History, Upload, Image as ImageIcon } from 'lucide-react';

export default function Takedown() {
  const { user } = useAuth();
  const [songTitle, setSongTitle] = useState('');
  const [reason, setReason] = useState('');
  const [transactionId, setTransactionId] = useState('');
  const [screenshot, setScreenshot] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Payment settings from admin
  const [paymentEnabled, setPaymentEnabled] = useState(false);
  const [qrCodeUrl, setQrCodeUrl] = useState<string | null>(null);
  const [takedownAmount, setTakedownAmount] = useState(0);
  const [takedownTaxEnabled, setTakedownTaxEnabled] = useState(false);
  const [taxes, setTaxes] = useState<{name: string; percent: number}[]>([]);

  useEffect(() => {
    fetchHistory();
    fetchPaymentSettings();
  }, [user]);

  const fetchPaymentSettings = async () => {
    const { data } = await supabase.from('promotion_settings').select('*').limit(1).single();
    if (data) {
      setPaymentEnabled(data.takedown_payment_enabled || false);
      setQrCodeUrl(data.qr_code_url);
      setTakedownAmount((data as any).takedown_amount || 0);
      setTakedownTaxEnabled((data as any).takedown_tax_enabled || false);
      const taxData = data.taxes as any;
      if (Array.isArray(taxData)) setTaxes(taxData);
    }
  };

  const totalTax = takedownTaxEnabled ? taxes.reduce((sum, t) => sum + (takedownAmount * t.percent / 100), 0) : 0;
  const totalPayable = takedownAmount + totalTax;

  const fetchHistory = async () => {
    if (!user) return;
    const { data, error } = await supabase
      .from('content_requests')
      .select('*')
      .eq('user_id', user.id)
      .eq('request_type', 'takedown')
      .order('created_at', { ascending: false });
    if (!error && data) setHistory(data);
    setLoading(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    // Validate transaction ID uniqueness if payment enabled
    if (paymentEnabled && transactionId.trim()) {
      const tid = transactionId.trim();
      // Check in content_requests
      const { data: crDup } = await supabase
        .from('content_requests')
        .select('id')
        .eq('user_id', user.id)
        .eq('transaction_id', tid)
        .limit(1);
      if (crDup && crDup.length > 0) {
        toast.error('This Transaction ID has already been used in a previous request.');
        return;
      }
      // Check in promotion_orders
      const { data: poDup } = await supabase
        .from('promotion_orders')
        .select('id')
        .eq('user_id', user.id)
        .eq('transaction_id', tid)
        .limit(1);
      if (poDup && poDup.length > 0) {
        toast.error('This Transaction ID has already been used in a promotion order.');
        return;
      }
    }

    if (paymentEnabled && !transactionId.trim()) {
      toast.error('Transaction ID is required');
      return;
    }

    if (paymentEnabled && !screenshot) {
      toast.error('Payment screenshot is required');
      return;
    }

    setSubmitting(true);

    let screenshotUrl: string | null = null;
    if (screenshot && user) {
      const ext = screenshot.name.split('.').pop();
      const path = `${user.id}/takedown-${Date.now()}.${ext}`;
      const { error: uploadErr } = await supabase.storage.from('promotion-screenshots').upload(path, screenshot);
      if (uploadErr) {
        toast.error('Screenshot upload failed');
        setSubmitting(false);
        return;
      }
      const { data: urlData } = supabase.storage.from('promotion-screenshots').getPublicUrl(path);
      screenshotUrl = urlData.publicUrl;
    }

    const insertData: any = {
      user_id: user.id,
      request_type: 'takedown',
      song_title: songTitle || null,
      reason_for_takedown: reason || null,
      transaction_id: paymentEnabled ? transactionId.trim() || null : null,
      payment_screenshot_url: screenshotUrl,
    };

    const { error } = await supabase.from('content_requests').insert(insertData);
    if (error) {
      toast.error('Failed to submit request');
    } else {
      toast.success('Takedown request submitted successfully');
      setSongTitle('');
      setReason('');
      setTransactionId('');
      setScreenshot(null);
      fetchHistory();
    }
    setSubmitting(false);
  };

  return (
    <DashboardLayout>
      <div className="max-w-4xl mx-auto space-y-6">
        <h1 className="text-2xl font-bold text-foreground">Takedown</h1>

        <Tabs defaultValue="form">
          <TabsList>
            <TabsTrigger value="form" className="gap-2">
              <Send className="h-4 w-4" /> New Request
            </TabsTrigger>
            <TabsTrigger value="history" className="gap-2">
              <History className="h-4 w-4" /> History
            </TabsTrigger>
          </TabsList>

          <TabsContent value="form">
            <GlassCard>
              <form onSubmit={handleSubmit} className="space-y-4 p-6">
                <div className="space-y-2">
                  <Label htmlFor="song_title">Song Title <span className="text-destructive">*</span></Label>
                  <Input id="song_title" placeholder="Enter the song title" value={songTitle} onChange={e => setSongTitle(e.target.value)} required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="reason">Reason for Takedown <span className="text-destructive">*</span></Label>
                  <Textarea id="reason" placeholder="Describe the reason for takedown..." value={reason} onChange={e => setReason(e.target.value)} required />
                </div>

                {paymentEnabled && (
                  <>
                    {/* Amount Breakdown */}
                    {takedownAmount > 0 && (
                      <div className="p-4 rounded-lg border border-border bg-muted/30 space-y-2">
                        <p className="font-semibold text-foreground">Payment Details</p>
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Takedown Fee</span>
                          <span className="text-foreground">₹{takedownAmount.toFixed(2)}</span>
                        </div>
                        {takedownTaxEnabled && taxes.map((t, i) => (
                          <div key={i} className="flex justify-between text-sm">
                            <span className="text-muted-foreground">{t.name} ({t.percent}%)</span>
                            <span className="text-foreground">₹{(takedownAmount * t.percent / 100).toFixed(2)}</span>
                          </div>
                        ))}
                        <div className="flex justify-between text-sm font-bold border-t border-border pt-2 mt-2">
                          <span>Total Payable</span>
                          <span>₹{totalPayable.toFixed(2)}</span>
                        </div>
                      </div>
                    )}

                    {qrCodeUrl && (
                      <div className="space-y-2">
                        <Label className="text-base font-semibold">Scan QR to Pay</Label>
                        <div className="flex justify-center p-4 bg-white rounded-xl border-2 border-dashed border-primary/30">
                          <img
                            src={qrCodeUrl}
                            alt="Payment QR Code"
                            className="w-full max-w-[280px] h-auto aspect-square object-contain"
                          />
                        </div>
                        <p className="text-xs text-center text-muted-foreground">Scan this QR code with any UPI app to make payment</p>
                      </div>
                    )}

                    <div className="space-y-2">
                      <Label htmlFor="transaction_id">Transaction ID <span className="text-destructive">*</span></Label>
                      <Input id="transaction_id" placeholder="Enter your payment transaction ID" value={transactionId} onChange={e => setTransactionId(e.target.value)} required />
                    </div>

                    <div className="space-y-2">
                      <Label>Payment Screenshot <span className="text-destructive">*</span></Label>
                      <Input type="file" accept="image/*" onChange={e => setScreenshot(e.target.files?.[0] || null)} required />
                    </div>
                  </>
                )}

                <Button type="submit" disabled={submitting} className="w-full">
                  {submitting ? 'Submitting...' : 'Submit Request'}
                </Button>
              </form>
            </GlassCard>
          </TabsContent>

          <TabsContent value="history">
            <GlassCard>
              <div className="p-6">
                {loading ? (
                  <p className="text-muted-foreground text-center py-8">Loading...</p>
                ) : history.length === 0 ? (
                  <p className="text-muted-foreground text-center py-8">No requests yet.</p>
                ) : (
                  <div className="space-y-4">
                    {history.map((item) => (
                      <div key={item.id} className="border border-border rounded-lg p-4 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-muted-foreground">
                            {new Date(item.created_at).toLocaleDateString()}
                          </span>
                          <StatusBadge status={item.status} />
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                          {item.song_title && (
                            <div>
                              <span className="text-xs text-muted-foreground">Song Title:</span>
                              <p className="text-sm text-foreground break-all">{item.song_title}</p>
                            </div>
                          )}
                          {item.reason_for_takedown && (
                            <div>
                              <span className="text-xs text-muted-foreground">Reason:</span>
                              <p className="text-sm text-foreground break-all">{item.reason_for_takedown}</p>
                            </div>
                          )}
                          {item.transaction_id && (
                            <div>
                              <span className="text-xs text-muted-foreground">Transaction ID:</span>
                              <p className="text-sm text-foreground break-all">{item.transaction_id}</p>
                            </div>
                          )}
                        </div>
                        {item.payment_screenshot_url && (
                          <div>
                            <span className="text-xs text-muted-foreground">Payment Screenshot:</span>
                            <img src={item.payment_screenshot_url} alt="Payment" className="max-h-32 rounded-lg border mt-1 object-contain" />
                          </div>
                        )}
                        {item.status === 'rejected' && item.rejection_reason && (
                          <div className="mt-2 p-2 rounded bg-destructive/10 border border-destructive/20">
                            <span className="text-xs font-medium text-destructive">Rejection Reason:</span>
                            <p className="text-sm text-destructive">{item.rejection_reason}</p>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </GlassCard>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
