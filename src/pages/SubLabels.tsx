import { useEffect, useState, useMemo } from 'react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { GlassCard } from '@/components/GlassCard';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useImpersonate } from '@/hooks/useImpersonate';
import { StatusBadge } from '@/components/StatusBadge';
import { Loader2, Plus, Users, Upload, Eye, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { TablePagination, paginateItems } from '@/components/TablePagination';
import { format } from 'date-fns';

type SubLabel = {
  id: string;
  parent_label_name: string;
  sub_label_name: string;
  agreement_start_date: string;
  agreement_end_date: string;
  email: string;
  phone: string;
  percentage_cut: number;
  withdrawal_threshold: number;
  b2b_url: string | null;
  status: string;
  rejection_reason: string | null;
  created_at: string;
  sub_user_id: string | null;
};

const inputClass =
  'w-full px-4 py-3 rounded-lg bg-muted/50 border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary transition-all text-sm';

export default function SubLabels() {
  const { user } = useAuth();
  const { impersonatedUserId, isImpersonating } = useImpersonate();
  const effectiveUserId = isImpersonating && impersonatedUserId ? impersonatedUserId : user?.id;
  const [subLabels, setSubLabels] = useState<SubLabel[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [parentLabelName, setParentLabelName] = useState('');
  const [viewSubLabel, setViewSubLabel] = useState<SubLabel | null>(null);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState<number | 'all'>(10);


  // Form state
  const [formData, setFormData] = useState({
    sub_label_name: '',
    agreement_start_date: '',
    agreement_end_date: '',
    email: '',
    password: '',
    phone: '',
    percentage_cut: '',
    withdrawal_threshold: '1000',
  });
  const [b2bFile, setB2bFile] = useState<File | null>(null);

  const fetchSubLabels = async () => {
    if (!effectiveUserId) return;
    const { data } = await supabase
      .from('sub_labels')
      .select('*')
      .eq('parent_user_id', effectiveUserId)
      .order('created_at', { ascending: false });
    setSubLabels((data as SubLabel[]) || []);
    setLoading(false);
  };


  const fetchParentLabel = async () => {
    if (!effectiveUserId) return;
    const { data } = await supabase
      .from('profiles')
      .select('record_label_name')
      .eq('user_id', effectiveUserId)
      .maybeSingle();
    setParentLabelName(data?.record_label_name || '');
  };

  useEffect(() => {
    fetchSubLabels();
    fetchParentLabel();
  }, [effectiveUserId]);

  const formatCurrency = (val: number) =>
    `₹${val.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const resetForm = () => {
    setFormData({
      sub_label_name: '', agreement_start_date: '', agreement_end_date: '',
      email: '', password: '', phone: '', percentage_cut: '', withdrawal_threshold: '1000',
    });
    setB2bFile(null);
    setShowForm(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    const { sub_label_name, agreement_start_date, agreement_end_date, email, password, phone, percentage_cut } = formData;

    if (!sub_label_name.trim() || !agreement_start_date || !agreement_end_date || !email.trim() || !password.trim() || !b2bFile) {
      if (!b2bFile) { toast.error('B2B agreement (PDF) is required'); return; }
      toast.error('Please fill all required fields');
      return;
    }

    if (password.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }

    setSubmitting(true);
    try {
      let b2b_url: string | null = null;
      if (b2bFile) {
        const path = `sub-labels/${effectiveUserId}/${Date.now()}-${b2bFile.name}`;
        const { error } = await supabase.storage.from('b2b-documents').upload(path, b2bFile);
        if (error) throw error;
        b2b_url = path;
      }

      const { data, error } = await supabase.functions.invoke('create-sub-label', {
        body: {
          email: email.trim(),
          password,
          sub_label_name: sub_label_name.trim(),
          parent_label_name: parentLabelName,
          agreement_start_date,
          agreement_end_date,
          phone: phone.trim(),
          percentage_cut: parseFloat(percentage_cut) || 0,
          withdrawal_threshold: parseFloat(formData.withdrawal_threshold) || 1000,
          b2b_url,
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast.success('Sub label created successfully! Awaiting admin approval.');
      resetForm();
      fetchSubLabels();
    } catch (err: any) {
      toast.error(err.message || 'Failed to create sub label');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDownloadB2b = async (b2bPath: string) => {
    const { data, error } = await supabase.storage.from('b2b-documents').createSignedUrl(b2bPath, 300);
    if (error || !data?.signedUrl) {
      toast.error('Failed to get download link');
      return;
    }
    window.open(data.signedUrl, '_blank');
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

  return (
    <DashboardLayout>
      <div className="mb-6 sm:mb-8">
        <h1 className="text-2xl sm:text-3xl font-display font-bold text-foreground">Sub Labels</h1>
        <p className="text-muted-foreground mt-1 text-sm sm:text-base">
          Create and manage sub-label accounts under your record label.
        </p>
      </div>

      {!showForm && (
        <Button onClick={() => setShowForm(true)} className="mb-6 gap-2 btn-primary-gradient text-primary-foreground font-semibold">
          <Plus className="h-4 w-4" /> Create Sub Label
        </Button>
      )}

      {showForm && (
        <GlassCard glow className="mb-6 animate-fade-in">
          <h2 className="text-lg font-semibold text-foreground mb-4">Create New Sub Label</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-1">Main Label Name</label>
              <input className={`${inputClass} opacity-60 cursor-not-allowed`} value={parentLabelName} disabled />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-muted-foreground mb-1">Sub Label Name *</label>
                <input className={inputClass} value={formData.sub_label_name} onChange={(e) => setFormData(p => ({ ...p, sub_label_name: e.target.value }))} required placeholder="Enter sub label name" />
              </div>
              <div>
                <label className="block text-sm font-medium text-muted-foreground mb-1">Percentage Cut % *</label>
                <input className={inputClass} type="text" inputMode="decimal" value={formData.percentage_cut} onChange={(e) => { if (/^\d*\.?\d*$/.test(e.target.value)) setFormData(p => ({ ...p, percentage_cut: e.target.value })); }} placeholder="e.g. 10" />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-1">Withdrawal Threshold (₹)</label>
              <input className={inputClass} type="text" inputMode="decimal" value={formData.withdrawal_threshold} onChange={(e) => { if (/^\d*\.?\d*$/.test(e.target.value)) setFormData(p => ({ ...p, withdrawal_threshold: e.target.value })); }} placeholder="e.g. 1000" />
              <p className="text-xs text-muted-foreground mt-1">Minimum balance required for sub-label to request withdrawal</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-muted-foreground mb-1">Agreement Start Date *</label>
                <input className={inputClass} type="date" value={formData.agreement_start_date} onChange={(e) => setFormData(p => ({ ...p, agreement_start_date: e.target.value }))} required />
              </div>
              <div>
                <label className="block text-sm font-medium text-muted-foreground mb-1">Agreement End Date *</label>
                <input className={inputClass} type="date" value={formData.agreement_end_date} onChange={(e) => setFormData(p => ({ ...p, agreement_end_date: e.target.value }))} required />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-muted-foreground mb-1">Email *</label>
                <input className={inputClass} type="email" value={formData.email} onChange={(e) => setFormData(p => ({ ...p, email: e.target.value }))} required placeholder="sub-label@example.com" />
              </div>
              <div>
                <label className="block text-sm font-medium text-muted-foreground mb-1">Password *</label>
                <input className={inputClass} type="password" value={formData.password} onChange={(e) => setFormData(p => ({ ...p, password: e.target.value }))} required placeholder="Min 6 characters" />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-1">Phone Number</label>
              <input className={inputClass} type="tel" value={formData.phone} onChange={(e) => setFormData(p => ({ ...p, phone: e.target.value }))} placeholder="Phone number" />
            </div>

            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-1">
                B2B Agreement (PDF) <span className="text-xs text-muted-foreground">— optional</span>
              </label>
              <div className="relative">
                <input type="file" accept=".pdf,application/pdf" onChange={(e) => setB2bFile(e.target.files?.[0] || null)} className="hidden" id="sub-b2b-upload" />
                <label htmlFor="sub-b2b-upload" className={`${inputClass} flex min-w-0 cursor-pointer items-center gap-2`}>
                  <Upload className="h-4 w-4 shrink-0" />
                  <span className="truncate">{b2bFile?.name || 'Choose PDF file'}</span>
                </label>
              </div>
            </div>

            <div className="flex gap-3">
              <Button type="button" variant="outline" onClick={resetForm} className="flex-1">Cancel</Button>
              <Button type="submit" disabled={submitting} className="flex-1 btn-primary-gradient font-semibold text-primary-foreground">
                {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                Create Sub Label
              </Button>
            </div>
          </form>
        </GlassCard>
      )}

      {subLabels.length === 0 ? (
        <GlassCard className="animate-fade-in text-center py-12">
          <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground">No sub labels yet. Create your first sub label!</p>
        </GlassCard>
      ) : (
        <div className="space-y-3">
          {paginateItems(subLabels, page, pageSize).map((sl) => (
            <GlassCard key={sl.id} className="animate-fade-in">
              <div className="flex items-center gap-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Users className="h-5 w-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-foreground">{sl.sub_label_name}</p>
                  <div className="flex flex-wrap items-center gap-2 mt-1">
                    <span className="text-xs text-muted-foreground">{sl.email}</span>
                    <span className="text-xs text-muted-foreground">•</span>
                     <span className="text-xs text-muted-foreground">Cut: {sl.percentage_cut}%</span>
                    <span className="text-xs text-muted-foreground">•</span>
                    <span className="text-xs text-muted-foreground">Threshold: ₹{sl.withdrawal_threshold?.toLocaleString() || '1,000'}</span>
                    <span className="text-xs text-muted-foreground">•</span>
                    <span className="text-xs text-muted-foreground">
                      {new Date(sl.agreement_start_date).toLocaleDateString()} – {new Date(sl.agreement_end_date).toLocaleDateString()}
                    </span>
                  </div>
                </div>
                <StatusBadge status={sl.status === 'active' ? 'approved' : sl.status} />
                {sl.status === 'rejected' && sl.rejection_reason && (
                  <p className="text-xs text-destructive max-w-[200px] truncate" title={sl.rejection_reason}>
                    Reason: {sl.rejection_reason}
                  </p>
                )}
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setViewSubLabel(sl)}>
                  <Eye className="h-4 w-4" />
                </Button>
              </div>
            </GlassCard>
          ))}
          <div className="rounded-lg bg-card/50 border border-border/50 overflow-hidden">
            <TablePagination totalItems={subLabels.length} currentPage={page} pageSize={pageSize} onPageChange={setPage} onPageSizeChange={setPageSize} itemLabel="sub labels" />
          </div>
        </div>
      )}


      {/* View Detail Modal */}
      {viewSubLabel && (
        <Dialog open={!!viewSubLabel} onOpenChange={() => setViewSubLabel(null)}>
          <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{viewSubLabel.sub_label_name}</DialogTitle>
            </DialogHeader>
            <div className="space-y-3 text-sm">
              <Detail label="Parent Label" value={viewSubLabel.parent_label_name} />
              <Detail label="Sub Label Name" value={viewSubLabel.sub_label_name} />
              <Detail label="Email" value={viewSubLabel.email} />
              <Detail label="Phone" value={viewSubLabel.phone || '—'} />
              <Detail label="Percentage Cut" value={`${viewSubLabel.percentage_cut}%`} />
              <Detail label="Withdrawal Threshold" value={`₹${viewSubLabel.withdrawal_threshold?.toLocaleString() || '1,000'}`} />
              <Detail label="Agreement Start" value={new Date(viewSubLabel.agreement_start_date).toLocaleDateString()} />
              <Detail label="Agreement End" value={new Date(viewSubLabel.agreement_end_date).toLocaleDateString()} />
              <Detail label="Status" value={viewSubLabel.status} />
              {viewSubLabel.rejection_reason && <Detail label="Rejection Reason" value={viewSubLabel.rejection_reason} />}
              {viewSubLabel.b2b_url && (
                <div>
                  <p className="text-muted-foreground text-xs">B2B Document</p>
                  <button onClick={() => handleDownloadB2b(viewSubLabel.b2b_url!)} className="flex items-center gap-1 text-sm text-primary hover:text-primary/80 transition-colors">
                    <FileText className="h-4 w-4" /> View B2B PDF
                  </button>
                </div>
              )}
              <Detail label="Created" value={new Date(viewSubLabel.created_at).toLocaleString()} />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setViewSubLabel(null)}>Close</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </DashboardLayout>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-muted-foreground text-xs">{label}</p>
      <p className="text-foreground break-all">{value}</p>
    </div>
  );
}
