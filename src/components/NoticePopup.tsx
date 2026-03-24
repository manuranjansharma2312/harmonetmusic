import { useState, useEffect, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
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
  const queryClient = useQueryClient();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [open, setOpen] = useState(false);
  const shownRef = useRef(false);
  const dismissedIds = useRef(new Set<string>());

  const { data: unreadNotices = [] } = useQuery({
    queryKey: ['unread-notices', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];

      const { data: notices, error: nErr } = await supabase
        .from('notices')
        .select('*')
        .eq('is_active', true)
        .order('created_at', { ascending: false });
      if (nErr) throw nErr;

      const { data: reads, error: rErr } = await supabase
        .from('notice_reads')
        .select('notice_id')
        .eq('user_id', user.id);
      if (rErr) throw rErr;

      const readIds = new Set((reads || []).map((r: any) => r.notice_id));
      return (notices || []).filter((n: any) => !readIds.has(n.id)) as Notice[];
    },
    enabled: !!user?.id,
    staleTime: Infinity,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  });

  // Only open once per mount when data first arrives
  useEffect(() => {
    if (!shownRef.current && unreadNotices.length > 0) {
      shownRef.current = true;
      setCurrentIndex(0);
      setOpen(true);
    }
  }, [unreadNotices]);

  const markRead = async (noticeId: string) => {
    if (!user?.id || dismissedIds.current.has(noticeId)) return;
    dismissedIds.current.add(noticeId);
    await supabase
      .from('notice_reads')
      .upsert({ notice_id: noticeId, user_id: user.id }, { onConflict: 'notice_id,user_id' });
  };

  const handleDismiss = async () => {
    const notice = unreadNotices[currentIndex];
    if (notice) await markRead(notice.id);

    if (currentIndex < unreadNotices.length - 1) {
      setCurrentIndex((i) => i + 1);
    } else {
      setOpen(false);
      // Refresh cache after all dismissed
      queryClient.invalidateQueries({ queryKey: ['unread-notices'] });
    }
  };

  const handleCloseAll = async () => {
    for (const n of unreadNotices) {
      await markRead(n.id);
    }
    setOpen(false);
    queryClient.invalidateQueries({ queryKey: ['unread-notices'] });
  };

  if (unreadNotices.length === 0) return null;

  const notice = unreadNotices[currentIndex];
  if (!notice) return null;

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleCloseAll(); }}>
      <DialogContent className="max-w-md sm:max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-2 text-primary">
            <Bell className="h-5 w-5" />
            <span className="text-xs font-medium uppercase tracking-wider">
              Notice {currentIndex + 1} of {unreadNotices.length}
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
            {currentIndex < unreadNotices.length - 1 && (
              <Button size="sm" variant="outline" onClick={() => setCurrentIndex((i) => i + 1)}>
                Next <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            )}
          </div>
          <Button size="sm" onClick={handleDismiss}>
            {currentIndex < unreadNotices.length - 1 ? 'Dismiss' : 'Close'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
