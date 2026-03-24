import { useEffect, useState } from 'react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { GlassCard } from '@/components/GlassCard';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useImpersonate } from '@/hooks/useImpersonate';
import { Loader2, Landmark, AlertTriangle, Lock, Globe } from 'lucide-react';
import { toast } from 'sonner';

type BankDetail = {
  id: string;
  user_id: string;
  payment_method: string;
  account_holder_name: string;
  bank_name: string;
  account_number: string;
  ifsc_code: string | null;
  branch_name: string | null;
  iban: string | null;
  swift_bic: string | null;
  bank_address: string | null;
  country: string | null;
  is_locked: boolean;
  created_at: string;
};

export default function BankDetails() {
  const { user } = useAuth();
  const { isImpersonating, impersonatedUserId } = useImpersonate();
  const effectiveUserId = isImpersonating ? impersonatedUserId : user?.id;
  const [bankDetail, setBankDetail] = useState<BankDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<'bank_transfer' | 'wise'>('bank_transfer');
  const [form, setForm] = useState({
    account_holder_name: '',
    bank_name: '',
    account_number: '',
    ifsc_code: '',
    branch_name: '',
    iban: '',
    swift_bic: '',
    bank_address: '',
    country: '',
  });

  const update = (field: string, value: string) => setForm(p => ({ ...p, [field]: value }));

  useEffect(() => {
    if (!effectiveUserId) return;
    (async () => {
      const { data } = await supabase
        .from('bank_details')
        .select('*')
        .eq('user_id', effectiveUserId)
        .maybeSingle();
      setBankDetail(data as BankDetail | null);
      setLoading(false);
    })();
  }, [effectiveUserId]);

  const inputClass = 'w-full px-4 py-2.5 rounded-lg bg-muted/50 border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary transition-all text-sm';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!effectiveUserId) return;

    // Validation
    if (!form.account_holder_name.trim() || !form.bank_name.trim() || !form.account_number.trim()) {
      toast.error('Please fill all required fields');
      return;
    }
    if (paymentMethod === 'bank_transfer' && (!form.ifsc_code.trim() || !form.branch_name.trim())) {
      toast.error('Please fill IFSC Code and Branch Name');
      return;
    }
    if (paymentMethod === 'wise' && (!form.swift_bic.trim() || !form.country.trim())) {
      toast.error('Please fill SWIFT/BIC Code and Country');
      return;
    }

    setSaving(true);
    const payload = {
      user_id: effectiveUserId,
      payment_method: paymentMethod,
      account_holder_name: form.account_holder_name.trim(),
      bank_name: form.bank_name.trim(),
      account_number: form.account_number.trim(),
      ifsc_code: paymentMethod === 'bank_transfer' ? form.ifsc_code.trim() : null,
      branch_name: paymentMethod === 'bank_transfer' ? form.branch_name.trim() : null,
      iban: paymentMethod === 'wise' ? form.account_number.trim() : null,
      swift_bic: paymentMethod === 'wise' ? form.swift_bic.trim() : null,
      bank_address: paymentMethod === 'wise' ? form.bank_address.trim() || null : null,
      country: paymentMethod === 'wise' ? form.country.trim() : null,
      is_locked: true,
    };

    const { data, error } = await supabase.from('bank_details').insert(payload).select().single();
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success('Bank details saved successfully!');
    setBankDetail(data as BankDetail);
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    );
  }

  // Read-only view when details exist
  if (bankDetail) {
    return (
      <DashboardLayout>
        <div className="mx-auto w-full max-w-2xl">
          <div className="mb-6 sm:mb-8">
            <h1 className="text-2xl sm:text-3xl font-display font-bold text-foreground">Bank Details</h1>
            <p className="text-muted-foreground mt-1 text-sm sm:text-base">Your saved payment information.</p>
          </div>

          <GlassCard className="animate-fade-in">
            <div className="flex items-center gap-2 mb-4">
              <Lock className="h-4 w-4 text-primary" />
              <span className="text-sm font-medium text-primary">Details Locked</span>
            </div>

            <div className="space-y-4">
              <DetailRow label="Payment Method" value={bankDetail.payment_method === 'wise' ? 'Wise (International)' : 'Bank Transfer (India)'} />
              <DetailRow label="Account Holder Name" value={bankDetail.account_holder_name} />
              <DetailRow label="Bank Name" value={bankDetail.bank_name} />
              <DetailRow label={bankDetail.payment_method === 'wise' ? 'Account Number / IBAN' : 'Account Number'} value={bankDetail.account_number} />
              {bankDetail.payment_method === 'bank_transfer' && (
                <>
                  <DetailRow label="IFSC Code" value={bankDetail.ifsc_code || '-'} />
                  <DetailRow label="Branch Name" value={bankDetail.branch_name || '-'} />
                </>
              )}
              {bankDetail.payment_method === 'wise' && (
                <>
                  <DetailRow label="SWIFT / BIC Code" value={bankDetail.swift_bic || '-'} />
                  <DetailRow label="Bank Address" value={bankDetail.bank_address || '-'} />
                  <DetailRow label="Country" value={bankDetail.country || '-'} />
                </>
              )}
              <DetailRow label="Submitted On" value={new Date(bankDetail.created_at).toLocaleDateString()} />
            </div>
          </GlassCard>

          <GlassCard className="mt-4 animate-fade-in">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-4 w-4 text-yellow-400 mt-0.5 shrink-0" />
              <p className="text-xs text-muted-foreground">
                Bank details are locked after submission. If you need to make changes, please contact the admin through Custom Support.
              </p>
            </div>
          </GlassCard>
        </div>
      </DashboardLayout>
    );
  }

  // Form for first-time submission
  return (
    <DashboardLayout>
      <div className="mx-auto w-full max-w-2xl">
        <div className="mb-6 sm:mb-8">
          <h1 className="text-2xl sm:text-3xl font-display font-bold text-foreground">Bank Details</h1>
          <p className="text-muted-foreground mt-1 text-sm sm:text-base">Submit your payment information for revenue payouts.</p>
        </div>

        <GlassCard className="mb-4 animate-fade-in">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-4 w-4 text-yellow-400 mt-0.5 shrink-0" />
            <p className="text-xs text-muted-foreground">
              <strong className="text-foreground">Important:</strong> Once submitted, bank details cannot be changed by you. Any correction must be requested through admin support. Please double-check all fields before submitting.
            </p>
          </div>
        </GlassCard>

        <GlassCard className="animate-fade-in">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-4">Select Payment Method</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
            <button
              type="button"
              onClick={() => setPaymentMethod('bank_transfer')}
              className={`flex items-center gap-3 p-4 rounded-xl border-2 transition-all ${paymentMethod === 'bank_transfer' ? 'border-primary bg-primary/10' : 'border-border hover:border-primary/50'}`}
            >
              <Landmark className="h-5 w-5 text-primary" />
              <div className="text-left">
                <p className="text-sm font-semibold text-foreground">Bank Transfer</p>
                <p className="text-xs text-muted-foreground">India (INR)</p>
              </div>
            </button>
            <button
              type="button"
              onClick={() => setPaymentMethod('wise')}
              className={`flex items-center gap-3 p-4 rounded-xl border-2 transition-all ${paymentMethod === 'wise' ? 'border-primary bg-primary/10' : 'border-border hover:border-primary/50'}`}
            >
              <Globe className="h-5 w-5 text-primary" />
              <div className="text-left">
                <p className="text-sm font-semibold text-foreground">Wise</p>
                <p className="text-xs text-muted-foreground">International Payments</p>
              </div>
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs text-muted-foreground mb-1">Account Holder Name <span className="text-destructive">*</span></label>
              <input className={inputClass} value={form.account_holder_name} onChange={e => update('account_holder_name', e.target.value)} placeholder="Full name as per bank account" required />
            </div>
            <div>
              <label className="block text-xs text-muted-foreground mb-1">Bank Name <span className="text-destructive">*</span></label>
              <input className={inputClass} value={form.bank_name} onChange={e => update('bank_name', e.target.value)} placeholder="e.g. State Bank of India" required />
            </div>
            <div>
              <label className="block text-xs text-muted-foreground mb-1">
                {paymentMethod === 'wise' ? 'Account Number / IBAN' : 'Account Number'} <span className="text-destructive">*</span>
              </label>
              <input className={inputClass} value={form.account_number} onChange={e => update('account_number', e.target.value)} placeholder={paymentMethod === 'wise' ? 'IBAN or Account Number' : 'Bank account number'} required />
            </div>

            {paymentMethod === 'bank_transfer' && (
              <>
                <div>
                  <label className="block text-xs text-muted-foreground mb-1">IFSC Code <span className="text-destructive">*</span></label>
                  <input className={inputClass} value={form.ifsc_code} onChange={e => update('ifsc_code', e.target.value.toUpperCase())} placeholder="e.g. SBIN0001234" required />
                </div>
                <div>
                  <label className="block text-xs text-muted-foreground mb-1">Branch Name <span className="text-destructive">*</span></label>
                  <input className={inputClass} value={form.branch_name} onChange={e => update('branch_name', e.target.value)} placeholder="e.g. Connaught Place, New Delhi" required />
                </div>
              </>
            )}

            {paymentMethod === 'wise' && (
              <>
                <div>
                  <label className="block text-xs text-muted-foreground mb-1">SWIFT / BIC Code <span className="text-destructive">*</span></label>
                  <input className={inputClass} value={form.swift_bic} onChange={e => update('swift_bic', e.target.value.toUpperCase())} placeholder="e.g. TRWIGB2L" required />
                </div>
                <div>
                  <label className="block text-xs text-muted-foreground mb-1">Bank Address</label>
                  <input className={inputClass} value={form.bank_address} onChange={e => update('bank_address', e.target.value)} placeholder="Bank branch address" />
                </div>
                <div>
                  <label className="block text-xs text-muted-foreground mb-1">Country <span className="text-destructive">*</span></label>
                  <input className={inputClass} value={form.country} onChange={e => update('country', e.target.value)} placeholder="e.g. United Kingdom" required />
                </div>
              </>
            )}

            <button
              type="submit"
              disabled={saving}
              className="w-full py-2.5 rounded-lg btn-primary-gradient text-primary-foreground font-semibold disabled:opacity-50 flex items-center justify-center gap-2 mt-2"
            >
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              Submit Bank Details
            </button>
          </form>
        </GlassCard>
      </div>
    </DashboardLayout>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-sm font-medium text-foreground">{value}</span>
    </div>
  );
}
