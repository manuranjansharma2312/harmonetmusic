import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { Loader2, ArrowRightLeft, Search, AlertTriangle } from 'lucide-react';
import { computeCmsFreezeIds } from '@/lib/transferFreezeLogic';

interface TransferCmsModalProps {
  open: boolean;
  onClose: () => void;
  cmsLink: {
    id: string;
    user_id: string;
    channel_name: string;
  } | null;
  onTransferred: () => void;
}

interface UserOption {
  user_id: string;
  legal_name: string;
  email: string;
  display_id: number;
}

export function TransferCmsModal({ open, onClose, cmsLink, onTransferred }: TransferCmsModalProps) {
  const [search, setSearch] = useState('');
  const [users, setUsers] = useState<UserOption[]>([]);
  const [searching, setSearching] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserOption | null>(null);
  const [transferring, setTransferring] = useState(false);
  const [step, setStep] = useState<'select' | 'confirm'>('select');

  useEffect(() => {
    if (!open) {
      setSearch('');
      setUsers([]);
      setSelectedUser(null);
      setStep('select');
    }
  }, [open]);

  const handleSearch = async () => {
    if (!search.trim()) return;
    setSearching(true);
    const q = search.trim().toLowerCase();
    const { data } = await supabase
      .from('profiles')
      .select('user_id, legal_name, email, display_id')
      .or(`legal_name.ilike.%${q}%,email.ilike.%${q}%,display_id.eq.${parseInt(q) || 0}`)
      .limit(10);
    const filtered = (data || []).filter((u: any) => u.user_id !== cmsLink?.user_id);
    setUsers(filtered);
    setSearching(false);
  };

  const handleTransfer = async () => {
    if (!cmsLink || !selectedUser) return;
    setTransferring(true);

    try {
      const newUserId = selectedUser.user_id;
      const oldUserId = cmsLink.user_id;

      // Transfer the CMS link ownership
      const { error } = await supabase
        .from('youtube_cms_links' as any)
        .update({ user_id: newUserId })
        .eq('id', cmsLink.id);
      if (error) throw error;

      // Smart freeze: only freeze entries that were effectively paid to old owner
      const { data: linkData } = await supabase
        .from('youtube_cms_links' as any)
        .select('cut_percent')
        .eq('id', cmsLink.id)
        .single();
      const cutPercent = Number((linkData as any)?.cut_percent) || 0;

      const { freezeIds, unfreezeIds } = await computeCmsFreezeIds(oldUserId, cmsLink.channel_name, cutPercent);

      // Freeze paid entries (view-only for new owner)
      if (freezeIds.length > 0) {
        await supabase
          .from('cms_report_entries' as any)
          .update({ revenue_frozen: true })
          .in('id', freezeIds);
      }
      // Unfrozen entries remain active revenue for new owner (no update needed)

      // Log the transfer
      const { data: sessionData } = await supabase.auth.getSession();
      const adminId = sessionData?.session?.user?.id || newUserId;
      await (supabase.from('cms_transfers') as any).insert({
        cms_link_id: cmsLink.id,
        channel_name: cmsLink.channel_name,
        from_user_id: oldUserId,
        to_user_id: newUserId,
        transferred_by: adminId,
      });

      toast.success(`CMS Link "${cmsLink.channel_name}" transferred to ${selectedUser.legal_name} (#${selectedUser.display_id})`);
      onTransferred();
      onClose();
    } catch (err: any) {
      toast.error(err.message || 'Transfer failed');
    }
    setTransferring(false);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ArrowRightLeft className="h-5 w-5 text-primary" />
            Transfer CMS Link
          </DialogTitle>
        </DialogHeader>

        {step === 'select' && (
          <div className="space-y-4">
            <div className="p-3 rounded-lg bg-muted/30 border border-border/50">
              <p className="text-sm font-medium">Channel: <span className="text-primary">{cmsLink?.channel_name || '—'}</span></p>
            </div>
            <div className="flex gap-2">
              <Input
                placeholder="Search user by name, email, or #ID..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSearch()}
              />
              <Button variant="outline" onClick={handleSearch} disabled={searching}>
                {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
              </Button>
            </div>
            {users.length > 0 && (
              <div className="max-h-48 overflow-y-auto space-y-1.5">
                {users.map(u => (
                  <button
                    key={u.user_id}
                    onClick={() => setSelectedUser(u)}
                    className={`w-full text-left px-3 py-2 rounded-lg border transition-colors text-sm ${selectedUser?.user_id === u.user_id ? 'border-primary bg-primary/10' : 'border-border/50 hover:bg-muted/30'}`}
                  >
                    <span className="font-medium">{u.legal_name}</span>
                    <span className="text-primary font-mono ml-2">#{u.display_id}</span>
                    <span className="text-muted-foreground ml-2 text-xs">{u.email}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {step === 'confirm' && selectedUser && (
          <div className="space-y-4">
            <div className="p-4 rounded-lg bg-destructive/5 border border-destructive/20">
              <div className="flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
                <div className="text-sm space-y-2">
                  <p className="font-medium text-destructive">Confirm CMS Link Transfer</p>
                  <p>Channel <strong>{cmsLink?.channel_name}</strong> will be transferred to:</p>
                  <p className="font-medium">{selectedUser.legal_name} <span className="text-primary font-mono">#{selectedUser.display_id}</span></p>
                  <p className="text-xs text-muted-foreground">The new owner will see CMS reports for this channel going forward. Historical report entries will be frozen and won't count towards the new owner's revenue balance.</p>
                </div>
              </div>
            </div>
          </div>
        )}

        <DialogFooter>
          {step === 'select' ? (
            <>
              <Button variant="outline" onClick={onClose}>Cancel</Button>
              <Button disabled={!selectedUser} onClick={() => setStep('confirm')}>Next</Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={() => setStep('select')}>Back</Button>
              <Button variant="destructive" disabled={transferring} onClick={handleTransfer}>
                {transferring ? <><Loader2 className="h-4 w-4 animate-spin mr-1" /> Transferring...</> : 'Confirm Transfer'}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
