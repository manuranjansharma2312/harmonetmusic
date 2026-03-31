import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { Loader2, ArrowRight, Search, AlertTriangle } from 'lucide-react';
import { computeReleaseFreezeIds } from '@/lib/transferFreezeLogic';

interface TransferOwnershipModalProps {
  open: boolean;
  onClose: () => void;
  release: {
    id: string;
    user_id: string;
    album_name?: string | null;
    ep_name?: string | null;
    tracks?: { id: string; song_title: string; isrc: string | null }[];
  } | null;
  onTransferred: () => void;
}

interface UserOption {
  user_id: string;
  legal_name: string;
  email: string;
  display_id: number;
}

export function TransferOwnershipModal({ open, onClose, release, onTransferred }: TransferOwnershipModalProps) {
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
      .or(`email.ilike.%${q}%,legal_name.ilike.%${q}%,display_id.eq.${parseInt(q) || 0}`)
      .limit(20);

    // Filter out current owner
    const filtered = (data || []).filter(u => u.user_id !== release?.user_id);
    setUsers(filtered);
    setSearching(false);
  };

  const handleTransfer = async () => {
    if (!release || !selectedUser) return;
    setTransferring(true);

    try {
      const oldUserId = release.user_id;
      const newUserId = selectedUser.user_id;

      // 1. Get all track ISRCs for this release
      const { data: tracks } = await supabase
        .from('tracks')
        .select('id, isrc')
        .eq('release_id', release.id);

      const isrcs = (tracks || [])
        .map(t => t.isrc?.trim().toUpperCase())
        .filter(Boolean) as string[];

      // 2. Transfer release ownership
      const { error: releaseErr } = await supabase
        .from('releases')
        .update({ user_id: newUserId })
        .eq('id', release.id);
      if (releaseErr) throw releaseErr;

      // 3. Transfer all tracks ownership
      const { error: trackErr } = await supabase
        .from('tracks')
        .update({ user_id: newUserId })
        .eq('release_id', release.id);
      if (trackErr) throw trackErr;

      // 4. Mark existing report entries for these ISRCs as frozen & reassign to new user
      if (isrcs.length > 0) {
        // OTT reports - mark as frozen and reassign
        const { error: ottErr } = await supabase
          .from('report_entries')
          .update({ user_id: newUserId, revenue_frozen: true } as any)
          .eq('user_id', oldUserId)
          .in('isrc', isrcs);
        if (ottErr) console.error('OTT report transfer error:', ottErr);

        // YouTube reports - mark as frozen and reassign
        const { error: ytErr } = await supabase
          .from('youtube_report_entries')
          .update({ user_id: newUserId, revenue_frozen: true } as any)
          .eq('user_id', oldUserId)
          .in('isrc', isrcs);
        if (ytErr) console.error('YT report transfer error:', ytErr);
      }

      // 5. Log the transfer
      const { data: sessionData } = await supabase.auth.getSession();
      const adminId = sessionData?.session?.user?.id || newUserId;
      await supabase.from('release_transfers').insert({
        release_id: release.id,
        from_user_id: oldUserId,
        to_user_id: newUserId,
        transferred_by: adminId,
        release_name: releaseName,
        isrcs: isrcs,
      } as any);

      toast.success(`Release transferred to ${selectedUser.legal_name} (#${selectedUser.display_id}). Historical reports are view-only for the new owner.`);
      onTransferred();
      onClose();
    } catch (err: any) {
      toast.error(err.message || 'Transfer failed');
    }
    setTransferring(false);
  };

  const releaseName = release?.album_name || release?.ep_name || release?.tracks?.[0]?.song_title || 'Untitled';

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ArrowRight className="h-5 w-5 text-primary" />
            Transfer Release Ownership
          </DialogTitle>
        </DialogHeader>

        {step === 'select' && (
          <div className="space-y-4">
            <div className="p-3 rounded-lg bg-muted/30 border border-border/50">
              <p className="text-sm font-medium">Release: <span className="text-primary">{releaseName}</span></p>
              <p className="text-xs text-muted-foreground mt-1">
                {release?.tracks?.length || 0} track(s) • ISRCs: {release?.tracks?.filter(t => t.isrc).map(t => t.isrc).join(', ') || 'None'}
              </p>
            </div>

            <div>
              <label className="text-sm font-medium mb-1.5 block">Search new owner</label>
              <div className="flex gap-2">
                <Input
                  placeholder="Search by name, email, or ID#..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                />
                <Button size="sm" onClick={handleSearch} disabled={searching}>
                  {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                </Button>
              </div>
            </div>

            {users.length > 0 && (
              <div className="max-h-48 overflow-y-auto space-y-1">
                {users.map((u) => (
                  <button
                    key={u.user_id}
                    onClick={() => setSelectedUser(u)}
                    className={`w-full text-left p-2.5 rounded-lg border text-sm transition-all ${
                      selectedUser?.user_id === u.user_id
                        ? 'border-primary bg-primary/10'
                        : 'border-border/50 hover:border-primary/40 hover:bg-muted/30'
                    }`}
                  >
                    <p className="font-medium">{u.legal_name} <span className="text-primary font-mono">#{u.display_id}</span></p>
                    <p className="text-xs text-muted-foreground">{u.email}</p>
                  </button>
                ))}
              </div>
            )}

            {users.length === 0 && search && !searching && (
              <p className="text-sm text-muted-foreground text-center py-3">No users found</p>
            )}
          </div>
        )}

        {step === 'confirm' && selectedUser && (
          <div className="space-y-4">
            <div className="p-4 rounded-lg bg-destructive/10 border border-destructive/30">
              <div className="flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
                <div className="text-sm space-y-2">
                  <p className="font-medium text-destructive">Confirm Ownership Transfer</p>
                  <p>Release <strong>{releaseName}</strong> and all its tracks will be transferred to:</p>
                  <p className="font-medium">{selectedUser.legal_name} <span className="text-primary font-mono">#{selectedUser.display_id}</span></p>
                  <ul className="text-xs text-muted-foreground list-disc pl-4 space-y-1">
                    <li>All existing report entries for this release's ISRCs will be moved but <strong>will NOT count as revenue</strong> for the new owner</li>
                    <li>Future imported reports will count as revenue for the new owner</li>
                    <li>This action cannot be easily undone</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        )}

        <DialogFooter>
          {step === 'select' ? (
            <>
              <Button variant="outline" onClick={onClose}>Cancel</Button>
              <Button
                disabled={!selectedUser}
                onClick={() => setStep('confirm')}
              >
                Next
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={() => setStep('select')}>Back</Button>
              <Button
                variant="destructive"
                disabled={transferring}
                onClick={handleTransfer}
              >
                {transferring ? <><Loader2 className="h-4 w-4 animate-spin mr-1" /> Transferring...</> : 'Confirm Transfer'}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
