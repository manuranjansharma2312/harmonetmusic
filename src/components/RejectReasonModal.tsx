import { useState } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';

interface RejectReasonModalProps {
  open: boolean;
  title?: string;
  onConfirm: (reason: string) => void;
  onCancel: () => void;
}

export function RejectReasonModal({ open, title = 'Reject', onConfirm, onCancel }: RejectReasonModalProps) {
  const [reason, setReason] = useState('');

  const handleConfirm = () => {
    if (!reason.trim()) return;
    onConfirm(reason.trim());
    setReason('');
  };

  const handleCancel = () => {
    setReason('');
    onCancel();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) handleCancel(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <div className="space-y-2">
          <label className="text-sm font-medium text-muted-foreground">Rejection Reason *</label>
          <Textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Enter the reason for rejection..."
            className="min-h-[100px]"
            autoFocus
          />
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={handleCancel}>Cancel</Button>
          <Button variant="destructive" onClick={handleConfirm} disabled={!reason.trim()}>
            Reject
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
