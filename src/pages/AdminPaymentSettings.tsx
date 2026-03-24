import { useState, useEffect } from 'react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { QrCode, Percent, Plus, X, CreditCard } from 'lucide-react';

interface Tax {
  name: string;
  percent: number;
}

export default function AdminPaymentSettings() {
  const [settingsId, setSettingsId] = useState('');
  const [isEnabled, setIsEnabled] = useState(false);
  const [takedownPaymentEnabled, setTakedownPaymentEnabled] = useState(false);
  const [qrCodeUrl, setQrCodeUrl] = useState<string | null>(null);
  const [taxes, setTaxes] = useState<Tax[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploadingQr, setUploadingQr] = useState(false);

  useEffect(() => { fetchSettings(); }, []);

  const fetchSettings = async () => {
    setLoading(true);
    const { data } = await supabase.from('promotion_settings').select('*').limit(1).single();
    if (data) {
      setSettingsId(data.id);
      setIsEnabled(data.is_enabled);
      setTakedownPaymentEnabled(data.takedown_payment_enabled || false);
      setQrCodeUrl(data.qr_code_url);
      const taxData = data.taxes as any;
      if (Array.isArray(taxData)) setTaxes(taxData);
    }
    setLoading(false);
  };

  const togglePromoEnabled = async (val: boolean) => {
    const { error } = await supabase.from('promotion_settings').update({ is_enabled: val, updated_at: new Date().toISOString() }).eq('id', settingsId);
    if (error) { toast.error('Failed to update'); return; }
    setIsEnabled(val);
    toast.success(val ? 'Promotion Services enabled for users' : 'Promotion Services disabled for users');
  };

  const toggleTakedownPayment = async (val: boolean) => {
    const { error } = await supabase.from('promotion_settings').update({ takedown_payment_enabled: val, updated_at: new Date().toISOString() }).eq('id', settingsId);
    if (error) { toast.error('Failed to update'); return; }
    setTakedownPaymentEnabled(val);
    toast.success(val ? 'Takedown payment enabled' : 'Takedown payment disabled');
  };

  const handleQrUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingQr(true);
    const ext = file.name.split('.').pop();
    const path = `qr-code.${ext}`;
    const { error: uploadErr } = await supabase.storage.from('promotion-qr').upload(path, file, { upsert: true });
    if (uploadErr) { toast.error('Upload failed'); setUploadingQr(false); return; }
    const { data: urlData } = supabase.storage.from('promotion-qr').getPublicUrl(path);
    const url = urlData.publicUrl + '?t=' + Date.now();
    await supabase.from('promotion_settings').update({ qr_code_url: url, updated_at: new Date().toISOString() }).eq('id', settingsId);
    setQrCodeUrl(url);
    setUploadingQr(false);
    toast.success('QR code updated');
  };

  // Tax management
  const addTax = () => setTaxes([...taxes, { name: '', percent: 0 }]);
  const removeTax = (i: number) => setTaxes(taxes.filter((_, idx) => idx !== i));
  const updateTax = (i: number, field: 'name' | 'percent', value: string) => {
    const updated = [...taxes];
    if (field === 'name') updated[i].name = value;
    else updated[i].percent = Number(value) || 0;
    setTaxes(updated);
  };
  const saveTaxes = async () => {
    for (const t of taxes) {
      if (!t.name.trim()) { toast.error('All taxes must have a name'); return; }
    }
    const { error } = await supabase.from('promotion_settings').update({ taxes: taxes as any, updated_at: new Date().toISOString() }).eq('id', settingsId);
    if (error) { toast.error('Failed to save taxes'); return; }
    toast.success('Taxes saved');
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-[400px]">
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="max-w-4xl mx-auto space-y-6">
        <h1 className="text-2xl font-bold text-foreground">Payment Settings</h1>

        {/* Enable/Disable Toggles */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><CreditCard className="h-5 w-5" /> Service Toggles</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="flex items-center justify-between p-4 rounded-lg border border-border">
              <div>
                <p className="font-medium text-foreground">Promotion Services</p>
                <p className="text-sm text-muted-foreground">Enable or disable promotion services for all users</p>
              </div>
              <Switch checked={isEnabled} onCheckedChange={togglePromoEnabled} />
            </div>
            <div className="flex items-center justify-between p-4 rounded-lg border border-border">
              <div>
                <p className="font-medium text-foreground">Takedown Payment</p>
                <p className="text-sm text-muted-foreground">
                  {takedownPaymentEnabled
                    ? '✅ Users will see QR Code, Transaction ID, and Payment Screenshot fields on the Takedown form.'
                    : '❌ Payment fields are hidden on the Takedown form.'}
                </p>
              </div>
              <Switch checked={takedownPaymentEnabled} onCheckedChange={toggleTakedownPayment} />
            </div>
          </CardContent>
        </Card>

        {/* QR Code */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><QrCode className="h-5 w-5" /> Payment QR Code</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {qrCodeUrl ? (
              <div className="flex justify-center p-4 bg-white rounded-xl border-2 border-dashed border-primary/30">
                <img src={qrCodeUrl} alt="Payment QR" className="w-full max-w-[280px] h-auto aspect-square object-contain" />
              </div>
            ) : (
              <div className="w-full h-48 border-2 border-dashed rounded-lg flex items-center justify-center text-muted-foreground text-sm">No QR uploaded</div>
            )}
            <div className="space-y-2">
              <Label>Upload QR Code Image</Label>
              <Input type="file" accept="image/*" onChange={handleQrUpload} disabled={uploadingQr} />
              <p className="text-xs text-muted-foreground">This QR will be shown to users for payment on Promotion Services and Takedown forms.</p>
            </div>
          </CardContent>
        </Card>

        {/* Tax Settings */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2"><Percent className="h-5 w-5" /> Tax Settings</CardTitle>
            <Button size="sm" variant="outline" onClick={addTax}><Plus className="h-4 w-4 mr-1" /> Add Tax</Button>
          </CardHeader>
          <CardContent className="space-y-3">
            {taxes.length === 0 && (
              <p className="text-sm text-muted-foreground py-4 text-center">No taxes configured. Click "Add Tax" to add one.</p>
            )}
            {taxes.map((tax, i) => (
              <div key={i} className="flex items-center gap-2">
                <Input value={tax.name} onChange={e => updateTax(i, 'name', e.target.value)} placeholder="Tax name (e.g. GST)" className="flex-1" />
                <div className="flex items-center gap-1">
                  <Input type="number" min="0" max="100" step="0.01" value={tax.percent} onChange={e => updateTax(i, 'percent', e.target.value)} className="w-20" />
                  <span className="text-sm text-muted-foreground">%</span>
                </div>
                <Button variant="ghost" size="icon" onClick={() => removeTax(i)}><X className="h-4 w-4 text-destructive" /></Button>
              </div>
            ))}
            {taxes.length > 0 && (
              <Button size="sm" onClick={saveTaxes} className="w-full">Save Taxes</Button>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
