import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { NoticePopup } from '@/components/NoticePopup';
import { DashboardLayout } from '@/components/DashboardLayout';
import { StatCard } from '@/components/StatCard';
import { GlassCard } from '@/components/GlassCard';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useImpersonate } from '@/hooks/useImpersonate';
import { Music, Clock, CheckCircle, XCircle, Loader2, Copy, X, BookOpen, ArrowRight } from 'lucide-react';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { TutorialContent } from '@/components/TutorialContent';

export default function UserDashboard() {
  const { user } = useAuth();
  const { isImpersonating, impersonatedUserId, impersonatedEmail, stopImpersonating } = useImpersonate();
  const navigate = useNavigate();
  const [stats, setStats] = useState({ total: 0, pending: 0, approved: 0, rejected: 0 });
  const [displayId, setDisplayId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  const effectiveUserId = isImpersonating ? impersonatedUserId : user?.id;

  useEffect(() => {
    if (!effectiveUserId) return;
    (async () => {
      const [songsRes, profileRes] = await Promise.all([
        supabase.from('songs').select('status').eq('user_id', effectiveUserId),
        supabase.from('profiles').select('display_id').eq('user_id', effectiveUserId).single(),
      ]);
      if (songsRes.data) {
        setStats({
          total: songsRes.data.length,
          pending: songsRes.data.filter((s) => s.status === 'pending').length,
          approved: songsRes.data.filter((s) => s.status === 'approved').length,
          rejected: songsRes.data.filter((s) => s.status === 'rejected').length,
        });
      }
      if (profileRes.data) {
        setDisplayId((profileRes.data as any).display_id);
      }
      setLoading(false);
    })();
  }, [effectiveUserId]);

  const copyUserId = () => {
    if (displayId) {
      navigator.clipboard.writeText(`#${displayId}`);
      toast.success('User ID copied!');
    }
  };

  const handleStopImpersonating = () => {
    stopImpersonating();
    navigate('/admin/users');
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
      {isImpersonating && (
        <div className="mb-6 p-3 sm:p-4 rounded-xl bg-blue-500/15 border border-blue-500/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 animate-fade-in">
          <div className="min-w-0">
            <p className="text-sm font-medium text-blue-400">Viewing as user</p>
            <p className="text-xs text-blue-300/70 break-all">{impersonatedEmail}</p>
          </div>
          <button
            onClick={handleStopImpersonating}
            className="flex w-full sm:w-auto items-center justify-center gap-2 px-4 py-2 rounded-lg bg-blue-500/20 text-blue-400 text-sm font-medium hover:bg-blue-500/30 transition-all"
          >
            <X className="h-4 w-4" />
            Back to Admin
          </button>
        </div>
      )}

      <div className="mb-6 sm:mb-8">
        <h1 className="text-2xl sm:text-3xl font-display font-bold text-foreground">Dashboard</h1>
        <p className="text-muted-foreground mt-1 text-sm sm:text-base">Welcome back! Here's your overview.</p>
      </div>

      {displayId && (
        <GlassCard className="mb-6 !p-4 animate-fade-in">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">Your User ID</p>
              <p className="font-mono text-lg font-bold text-foreground mt-0.5">#{displayId}</p>
            </div>
            <button
              onClick={copyUserId}
              className="self-start sm:self-auto p-2 rounded-lg hover:bg-muted/50 text-muted-foreground hover:text-foreground transition-all"
              title="Copy ID"
            >
              <Copy className="h-4 w-4" />
            </button>
          </div>
        </GlassCard>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3 sm:gap-4">
        <StatCard title="Total Songs" value={stats.total} icon={Music} />
        <StatCard title="Pending" value={stats.pending} icon={Clock} color="hsla(45, 80%, 40%, 0.3)" />
        <StatCard title="Approved" value={stats.approved} icon={CheckCircle} color="hsla(140, 60%, 30%, 0.3)" />
        <StatCard title="Rejected" value={stats.rejected} icon={XCircle} color="hsla(0, 60%, 40%, 0.3)" />
      </div>

      <RecentTutorialsWidget />

      <NoticePopup />
    </DashboardLayout>
  );
}

function RecentTutorialsWidget() {
  const navigate = useNavigate();
  const [viewTutorial, setViewTutorial] = useState<any>(null);

  const { data: tutorials = [], isLoading } = useQuery({
    queryKey: ['recent-tutorials'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tutorials')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(3);
      if (error) throw error;
      return data;
    },
  });

  if (isLoading || tutorials.length === 0) return null;

  const stripHtml = (html: string) => {
    const tmp = document.createElement('div');
    tmp.innerHTML = html;
    return tmp.textContent || tmp.innerText || '';
  };

  return (
    <>
      <div className="mt-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-primary" />
            Help Tutorials
          </h2>
          <button
            onClick={() => navigate('/help-tutorials')}
            className="text-xs text-primary hover:underline flex items-center gap-1"
          >
            View All <ArrowRight className="h-3 w-3" />
          </button>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {tutorials.map((t: any) => (
            <GlassCard
              key={t.id}
              className="!p-4 cursor-pointer hover:ring-1 hover:ring-primary/30 transition-all"
              onClick={() => setViewTutorial(t)}
            >
              <h3 className="font-medium text-sm line-clamp-1">{t.subject}</h3>
              <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{stripHtml(t.content)}</p>
              <span className="text-xs text-primary mt-2 inline-block">Read →</span>
            </GlassCard>
          ))}
        </div>
      </div>

      <Dialog open={!!viewTutorial} onOpenChange={(open) => !open && setViewTutorial(null)}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{viewTutorial?.subject}</DialogTitle>
          </DialogHeader>
          <TutorialContent html={viewTutorial?.content || ''} />
        </DialogContent>
      </Dialog>
    </>
  );
}
