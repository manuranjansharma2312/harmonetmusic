import { useEffect, useState } from 'react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { GlassCard } from '@/components/GlassCard';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useImpersonate } from '@/hooks/useImpersonate';
import { Loader2, Landmark, AlertTriangle, Lock, Globe, Building2, CreditCard, User, Hash, GitBranch, MapPin } from 'lucide-react';
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

  const inputClass = 'w-full px-4 py-3 rounded-xl bg-muted/40 border border-border text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/50 transition-all text-sm';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!effectiveUserId) return;

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
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/20">
                  <Landmark className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-foreground">
                    {bankDetail.payment_method === 'wise' ? 'Wise (International)' : 'Bank Transfer (India)'}
                  </h3>
                  <p className="text-xs text-muted-foreground">Submitted on {new Date(bankDetail.created_at).toLocaleDateString()}</p>
                </div>
              </div>
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-primary/15 text-primary">
                <Lock className="h-3 w-3" /> Locked
              </span>
            </div>

            <div className="space-y-4">
              <LockedRow icon={User} label="Account Holder Name" value={bankDetail.account_holder_name} />
              <LockedRow icon={Building2} label="Bank Name" value={bankDetail.bank_name} />
              <LockedRow icon={CreditCard} label={bankDetail.payment_method === 'wise' ? 'Account Number / IBAN' : 'Account Number'} value={bankDetail.account_number} />
              {bankDetail.payment_method === 'bank_transfer' && (
                <>
                  <LockedRow icon={Hash} label="IFSC Code" value={bankDetail.ifsc_code || '-'} />
                  <LockedRow icon={GitBranch} label="Branch Name" value={bankDetail.branch_name || '-'} />
                </>
              )}
              {bankDetail.payment_method === 'wise' && (
                <>
                  <LockedRow icon={Hash} label="SWIFT / BIC Code" value={bankDetail.swift_bic || '-'} />
                  {bankDetail.bank_address && <LockedRow icon={MapPin} label="Bank Address" value={bankDetail.bank_address} />}
                  <LockedRow icon={Globe} label="Country" value={bankDetail.country || '-'} />
                </>
              )}
            </div>
          </GlassCard>

          <div className="mt-4 rounded-xl border border-border/50 bg-muted/20 p-4 animate-fade-in">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-4 w-4 text-yellow-500 mt-0.5 shrink-0" />
              <p className="text-xs text-muted-foreground leading-relaxed">
                Bank details are locked after submission and cannot be modified. If you need to make changes, please contact admin through <a href="/tools/custom-support" className="text-primary hover:underline font-medium">Custom Support</a>.
              </p>
            </div>
          </div>
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

        <div className="mb-5 rounded-xl border border-yellow-500/20 bg-yellow-500/5 p-4 animate-fade-in">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-4 w-4 text-yellow-500 mt-0.5 shrink-0" />
            <p className="text-xs text-muted-foreground leading-relaxed">
              <strong className="text-foreground">Important:</strong> Once submitted, bank details cannot be changed by you. Any correction must be requested through admin support. Please double-check all fields before submitting.
            </p>
          </div>
        </div>

        <GlassCard className="animate-fade-in">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-5">Select Payment Method</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-8">
            <button
              type="button"
              onClick={() => setPaymentMethod('bank_transfer')}
              className={`group flex items-center gap-4 p-5 rounded-xl border-2 transition-all ${paymentMethod === 'bank_transfer' ? 'border-primary bg-primary/10 shadow-lg shadow-primary/5' : 'border-border/60 hover:border-primary/40 hover:bg-muted/30'}`}
            >
              <div className={`flex h-12 w-12 items-center justify-center rounded-xl transition-all ${paymentMethod === 'bank_transfer' ? 'bg-primary/20' : 'bg-muted/50 group-hover:bg-primary/10'}`}>
                <Landmark className={`h-6 w-6 transition-colors ${paymentMethod === 'bank_transfer' ? 'text-primary' : 'text-muted-foreground group-hover:text-primary'}`} />
              </div>
              <div className="text-left">
                <p className="text-sm font-bold text-foreground">Bank Transfer</p>
                <p className="text-xs text-muted-foreground mt-0.5">India (INR)</p>
              </div>
            </button>
            <button
              type="button"
              onClick={() => setPaymentMethod('wise')}
              className={`group flex items-center gap-4 p-5 rounded-xl border-2 transition-all ${paymentMethod === 'wise' ? 'border-primary bg-primary/10 shadow-lg shadow-primary/5' : 'border-border/60 hover:border-primary/40 hover:bg-muted/30'}`}
            >
              <div className={`flex h-12 w-12 items-center justify-center rounded-xl transition-all ${paymentMethod === 'wise' ? 'bg-primary/20' : 'bg-muted/50 group-hover:bg-primary/10'}`}>
                <Globe className={`h-6 w-6 transition-colors ${paymentMethod === 'wise' ? 'text-primary' : 'text-muted-foreground group-hover:text-primary'}`} />
              </div>
              <div className="text-left">
                <p className="text-sm font-bold text-foreground">Wise</p>
                <p className="text-xs text-muted-foreground mt-0.5">International Payments</p>
              </div>
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">Account Holder Name <span className="text-destructive">*</span></label>
              <input className={inputClass} value={form.account_holder_name} onChange={e => update('account_holder_name', e.target.value)} placeholder="Full name as per bank account" required />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">Bank Name <span className="text-destructive">*</span></label>
              <input className={inputClass} value={form.bank_name} onChange={e => update('bank_name', e.target.value)} placeholder="e.g. State Bank of India" required />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">
                {paymentMethod === 'wise' ? 'Account Number / IBAN' : 'Account Number'} <span className="text-destructive">*</span>
              </label>
              <input className={inputClass} value={form.account_number} onChange={e => update('account_number', e.target.value)} placeholder={paymentMethod === 'wise' ? 'IBAN or Account Number' : 'Bank account number'} required />
            </div>

            {paymentMethod === 'bank_transfer' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1.5">IFSC Code <span className="text-destructive">*</span></label>
                  <input className={inputClass} value={form.ifsc_code} onChange={e => update('ifsc_code', e.target.value.toUpperCase())} placeholder="e.g. SBIN0001234" required />
                </div>
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1.5">Branch Name <span className="text-destructive">*</span></label>
                  <input className={inputClass} value={form.branch_name} onChange={e => update('branch_name', e.target.value)} placeholder="e.g. Connaught Place" required />
                </div>
              </div>
            )}

            {paymentMethod === 'wise' && (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-muted-foreground mb-1.5">SWIFT / BIC Code <span className="text-destructive">*</span></label>
                    <input className={inputClass} value={form.swift_bic} onChange={e => update('swift_bic', e.target.value.toUpperCase())} placeholder="e.g. TRWIGB2L" required />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-muted-foreground mb-1.5">Country <span className="text-destructive">*</span></label>
                    <input className={inputClass} value={form.country} onChange={e => update('country', e.target.value)} placeholder="e.g. United Kingdom" required />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1.5">Bank Address <span className="text-muted-foreground/50">(Optional)</span></label>
                  <input className={inputClass} value={form.bank_address} onChange={e => update('bank_address', e.target.value)} placeholder="Bank branch address" />
                </div>
              </>
            )}

            <div className="pt-2">
              <button
                type="submit"
                disabled={saving}
                className="w-full py-3 rounded-xl btn-primary-gradient text-primary-foreground font-semibold disabled:opacity-50 flex items-center justify-center gap-2 text-sm shadow-lg shadow-primary/20 hover:shadow-primary/30 transition-all"
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Lock className="h-4 w-4" />}
                Submit & Lock Bank Details
              </button>
            </div>
          </form>
        </GlassCard>
      </div>
    </DashboardLayout>
  );
}

function LockedRow({ icon: Icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/20 border border-border/30">
      <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
      <div className="min-w-0 flex-1">
        <p className="text-[11px] text-muted-foreground uppercase tracking-wider">{label}</p>
        <p className="text-sm font-medium text-foreground mt-0.5 break-words">{value}</p>
      </div>
    </div>
  );
}
