import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { X, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';

interface BankDetail {
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
}

export function EditBankDetailsModal({
  bankDetail,
  onClose,
  onSaved,
}: {
  bankDetail: BankDetail;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { user } = useAuth();
  const [form, setForm] = useState({
    payment_method: bankDetail.payment_method,
    account_holder_name: bankDetail.account_holder_name,
    bank_name: bankDetail.bank_name,
    account_number: bankDetail.account_number,
    ifsc_code: bankDetail.ifsc_code || '',
    branch_name: bankDetail.branch_name || '',
    swift_bic: bankDetail.swift_bic || '',
    bank_address: bankDetail.bank_address || '',
    country: bankDetail.country || '',
  });
  const [saving, setSaving] = useState(false);

  const update = (field: string, value: string) => setForm(p => ({ ...p, [field]: value }));

  const inputClass = 'w-full px-3 sm:px-4 py-2.5 rounded-lg bg-muted/50 border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary transition-all text-sm';

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    // Build changes object for audit log
    const changes: Record<string, { from: string | null; to: string | null }> = {};
    const fields = ['payment_method', 'account_holder_name', 'bank_name', 'account_number', 'ifsc_code', 'branch_name', 'swift_bic', 'bank_address', 'country'] as const;
    for (const f of fields) {
      const oldVal = (bankDetail as any)[f] || '';
      const newVal = (form as any)[f] || '';
      if (oldVal !== newVal) {
        changes[f] = { from: oldVal || null, to: newVal || null };
      }
    }

    const updatePayload = {
      payment_method: form.payment_method,
      account_holder_name: form.account_holder_name.trim(),
      bank_name: form.bank_name.trim(),
      account_number: form.account_number.trim(),
      ifsc_code: form.payment_method === 'bank_transfer' ? form.ifsc_code.trim() || null : null,
      branch_name: form.payment_method === 'bank_transfer' ? form.branch_name.trim() || null : null,
      iban: form.payment_method === 'wise' ? form.account_number.trim() : null,
      swift_bic: form.payment_method === 'wise' ? form.swift_bic.trim() || null : null,
      bank_address: form.payment_method === 'wise' ? form.bank_address.trim() || null : null,
      country: form.payment_method === 'wise' ? form.country.trim() || null : null,
    };

    const { error } = await supabase.from('bank_details').update(updatePayload).eq('id', bankDetail.id);
    if (error) {
      setSaving(false);
      toast.error(error.message);
      return;
    }

    // Insert audit log
    if (Object.keys(changes).length > 0 && user?.id) {
      await supabase.from('bank_detail_audit_logs').insert({
        bank_detail_id: bankDetail.id,
        changed_by: user.id,
        changes,
      });
    }

    setSaving(false);
    toast.success('Bank details updated!');
    onSaved();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-background/80 backdrop-blur-sm" />
      <div className="glass-strong rounded-2xl p-4 sm:p-6 max-w-lg w-full relative animate-scale-in max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <button onClick={onClose} className="absolute top-4 right-4 text-muted-foreground hover:text-foreground transition-colors">
          <X className="h-5 w-5" />
        </button>
        <h2 className="font-display text-xl font-bold text-foreground mb-4">Edit Bank Details</h2>

        <form onSubmit={handleSave} className="space-y-3">
          <div>
            <label className="block text-xs text-muted-foreground mb-1">Payment Method</label>
            <select className={inputClass} value={form.payment_method} onChange={e => update('payment_method', e.target.value)}>
              <option value="bank_transfer">Bank Transfer (India)</option>
              <option value="wise">Wise (International)</option>
            </select>
          </div>
          <div>
            <label className="block text-xs text-muted-foreground mb-1">Account Holder Name</label>
            <input className={inputClass} value={form.account_holder_name} onChange={e => update('account_holder_name', e.target.value)} required />
          </div>
          <div>
            <label className="block text-xs text-muted-foreground mb-1">Bank Name</label>
            <input className={inputClass} value={form.bank_name} onChange={e => update('bank_name', e.target.value)} required />
          </div>
          <div>
            <label className="block text-xs text-muted-foreground mb-1">{form.payment_method === 'wise' ? 'Account Number / IBAN' : 'Account Number'}</label>
            <input className={inputClass} value={form.account_number} onChange={e => update('account_number', e.target.value)} required />
          </div>

          {form.payment_method === 'bank_transfer' && (
            <>
              <div>
                <label className="block text-xs text-muted-foreground mb-1">IFSC Code</label>
                <input className={inputClass} value={form.ifsc_code} onChange={e => update('ifsc_code', e.target.value.toUpperCase())} />
              </div>
              <div>
                <label className="block text-xs text-muted-foreground mb-1">Branch Name</label>
                <input className={inputClass} value={form.branch_name} onChange={e => update('branch_name', e.target.value)} />
              </div>
            </>
          )}

          {form.payment_method === 'wise' && (
            <>
              <div>
                <label className="block text-xs text-muted-foreground mb-1">SWIFT / BIC Code</label>
                <input className={inputClass} value={form.swift_bic} onChange={e => update('swift_bic', e.target.value.toUpperCase())} />
              </div>
              <div>
                <label className="block text-xs text-muted-foreground mb-1">Bank Address</label>
                <input className={inputClass} value={form.bank_address} onChange={e => update('bank_address', e.target.value)} />
              </div>
              <div>
                <label className="block text-xs text-muted-foreground mb-1">Country</label>
                <input className={inputClass} value={form.country} onChange={e => update('country', e.target.value)} />
              </div>
            </>
          )}

          <button type="submit" disabled={saving} className="w-full py-2.5 rounded-lg btn-primary-gradient text-primary-foreground font-semibold disabled:opacity-50 flex items-center justify-center gap-2 mt-2">
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            Save Changes
          </button>
        </form>
      </div>
    </div>
  );
}
