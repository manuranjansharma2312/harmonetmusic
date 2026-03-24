import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useImpersonate } from '@/hooks/useImpersonate';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, Bell } from 'lucide-react';
import { format } from 'date-fns';

interface Notice {
  id: string;
  title: string;
  content: string;
  image_url: string | null;
  created_at: string;
}

export function NoticePopup() {
  const { user } = useAuth();
  const { isImpersonating, impersonatedUserId } = useImpersonate();
  const [notices, setNotices] = useState<Notice[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [open, setOpen] = useState(false);
  const fetchedRef = useRef(false);

  const effectiveUserId = isImpersonating ? impersonatedUserId : user?.id;

  const fetchUnread = useCallback(async () => {
    if (!effectiveUserId || fetchedRef.current) return;
    fetchedRef.current = true;

    try {
      // Get active notices
      const { data: allNotices, error: nErr } = await supabase
        .from('notices')
        .select('*')
        .eq('is_active', true)
        .order('created_at', { ascending: false });
      if (nErr) throw nErr;
      if (!allNotices || allNotices.length === 0) return;

      // Get already-read notice IDs
      const { data: reads, error: rErr } = await supabase
        .from('notice_reads')
        .select('notice_id')
        .eq('user_id', effectiveUserId);
      if (rErr) throw rErr;

      const readIds = new Set((reads || []).map((r: any) => r.notice_id));
      const unread = allNotices.filter((n: any) => !readIds.has(n.id)) as Notice[];

      if (unread.length > 0) {
        setNotices(unread);
        setCurrentIndex(0);
        setOpen(true);
      }
    } catch (err) {
      console.error('Failed to fetch notices:', err);
    }
  }, [effectiveUserId]);

  useEffect(() => {
    fetchUnread();
  }, [fetchUnread]);

  const markRead = async (noticeId: string) => {
    if (!effectiveUserId) return;
    try {
      await supabase
        .from('notice_reads')
        .insert({ notice_id: noticeId, user_id: effectiveUserId });
    } catch {
      // ignore duplicate errors
    }
  };

  const handleDismiss = async () => {
    const notice = notices[currentIndex];
    if (notice) await markRead(notice.id);

    if (currentIndex < notices.length - 1) {
      setCurrentIndex((i) => i + 1);
    } else {
      setOpen(false);
    }
  };

  const handleCloseAll = async () => {
    for (const n of notices) {
      await markRead(n.id);
    }
    setOpen(false);
  };

  if (notices.length === 0 || !open) return null;

  const notice = notices[currentIndex];
  if (!notice) return null;

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleCloseAll(); }}>
      <DialogContent className="max-w-md sm:max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-2 text-primary">
            <Bell className="h-5 w-5" />
            <span className="text-xs font-medium uppercase tracking-wider">
              Notice {currentIndex + 1} of {notices.length}
            </span>
          </div>
          <DialogTitle className="text-lg">{notice.title}</DialogTitle>
          <DialogDescription className="text-xs">
            {format(new Date(notice.created_at), 'dd MMM yyyy, hh:mm a')}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {notice.image_url && (
            <img
              src={notice.image_url}
              alt=""
              className="w-full max-h-64 object-contain rounded-lg border border-border"
            />
          )}
          {notice.content && (
            <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">{notice.content}</p>
          )}
        </div>

        <div className="flex items-center justify-between gap-3 pt-3">
          <div className="flex gap-2">
            {currentIndex > 0 && (
              <Button size="sm" variant="outline" onClick={() => setCurrentIndex((i) => i - 1)}>
                <ChevronLeft className="h-4 w-4 mr-1" /> Prev
              </Button>
            )}
            {currentIndex < notices.length - 1 && (
              <Button size="sm" variant="outline" onClick={() => setCurrentIndex((i) => i + 1)}>
                Next <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            )}
          </div>
          <Button size="sm" onClick={handleDismiss}>
            {currentIndex < notices.length - 1 ? 'Dismiss' : 'Close'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
