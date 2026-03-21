import { useEffect, useState } from 'react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { StatCard } from '@/components/StatCard';
import { supabase } from '@/integrations/supabase/client';
import { Music, Clock, CheckCircle, XCircle, Loader2 } from 'lucide-react';

export default function AdminDashboard() {
  const [stats, setStats] = useState({ total: 0, pending: 0, approved: 0, rejected: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from('songs').select('status');
      if (data) {
        setStats({
          total: data.length,
          pending: data.filter((s) => s.status === 'pending').length,
          approved: data.filter((s) => s.status === 'approved').length,
          rejected: data.filter((s) => s.status === 'rejected').length,
        });
      }
      setLoading(false);
    })();
  }, []);

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
      <div className="mb-8">
        <h1 className="text-3xl font-display font-bold text-foreground">Admin Dashboard</h1>
        <p className="text-muted-foreground mt-1">Overview of all music submissions.</p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Total Songs" value={stats.total} icon={Music} />
        <StatCard title="Pending" value={stats.pending} icon={Clock} color="hsla(45, 80%, 40%, 0.3)" />
        <StatCard title="Approved" value={stats.approved} icon={CheckCircle} color="hsla(140, 60%, 30%, 0.3)" />
        <StatCard title="Rejected" value={stats.rejected} icon={XCircle} color="hsla(0, 60%, 40%, 0.3)" />
      </div>
    </DashboardLayout>
  );
}
