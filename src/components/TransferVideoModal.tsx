import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { Loader2, ArrowRightLeft, Search, AlertTriangle } from 'lucide-react';

interface TransferVideoModalProps {
  open: boolean;
  onClose: () => void;
  submission: {
    id: string;
    user_id: string;
    submission_type: string;
    form_name?: string;
  } | null;
  onTransferred: () => void;
}

interface UserOption {
  user_id: string;
  legal_name: string;
  email: string;
  display_id: number;
}

export function TransferVideoModal({ open, onClose, submission, onTransferred }: TransferVideoModalProps) {
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
    const filtered = (data || []).filter(u => u.user_id !== submission?.user_id);
    setUsers(filtered);
    setSearching(false);
  };

  const handleTransfer = async () => {
    if (!submission || !selectedUser) return;
    setTransferring(true);

    try {
      const newUserId = selectedUser.user_id;

      // Transfer the submission ownership
      const { error: subErr } = await supabase
        .from('video_submissions')
        .update({ user_id: newUserId })
        .eq('id', submission.id);
      if (subErr) throw subErr;

      // If transferring a vevo_channel, also transfer any videos linked to this channel
      if (submission.submission_type === 'vevo_channel') {
        const { data: linkedVideos } = await supabase
          .from('video_submissions')
          .select('id')
          .eq('vevo_channel_id', submission.id);

        if (linkedVideos && linkedVideos.length > 0) {
          const linkedIds = linkedVideos.map(v => v.id);
          await supabase
            .from('video_submissions')
            .update({ user_id: newUserId })
            .in('id', linkedIds);
        }
      }

      toast.success(
        `${submission.submission_type === 'vevo_channel' ? 'Vevo Channel' : 'Video'} transferred to ${selectedUser.legal_name} (#${selectedUser.display_id})${
          submission.submission_type === 'vevo_channel' ? ' along with linked videos' : ''
        }`
      );
      onTransferred();
      onClose();
    } catch (err: any) {
      toast.error(err.message || 'Transfer failed');
    }
    setTransferring(false);
  };

  const typeLabel = submission?.submission_type === 'vevo_channel' ? 'Vevo Channel' : 'Video Submission';

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ArrowRightLeft className="h-5 w-5 text-primary" />
            Transfer {typeLabel}
          </DialogTitle>
        </DialogHeader>

        {step === 'select' && (
          <div className="space-y-4">
            <div className="p-3 rounded-lg bg-muted/30 border border-border/50">
              <p className="text-sm font-medium">{typeLabel}: <span className="text-primary">{submission?.form_name || 'Submission'}</span></p>
              {submission?.submission_type === 'vevo_channel' && (
                <p className="text-xs text-muted-foreground mt-1">All videos linked to this channel will also be transferred.</p>
              )}
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
                  <p>{typeLabel} will be transferred to:</p>
                  <p className="font-medium">{selectedUser.legal_name} <span className="text-primary font-mono">#{selectedUser.display_id}</span></p>
                  <ul className="text-xs text-muted-foreground list-disc pl-4 space-y-1">
                    {submission?.submission_type === 'vevo_channel' && (
                      <li>All videos linked to this Vevo Channel will also be transferred</li>
                    )}
                    <li>The submission and all its data will belong to the new owner</li>
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
