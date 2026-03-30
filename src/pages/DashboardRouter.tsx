import { useAuth } from '@/hooks/useAuth';
import { Loader2 } from 'lucide-react';
import { lazy, Suspense } from 'react';

const AdminDashboard = lazy(() => import('./AdminDashboard'));
const UserDashboard = lazy(() => import('./UserDashboard'));

const PageLoader = () => (
  <div className="flex min-h-[100dvh] w-full items-center justify-center">
    <Loader2 className="h-8 w-8 animate-spin text-primary" />
  </div>
);

export default function DashboardRouter() {
  const { role, loading } = useAuth();

  if (loading) return <PageLoader />;

  return (
    <Suspense fallback={<PageLoader />}>
      {role === 'admin' || role === 'team' ? <AdminDashboard /> : <UserDashboard />}
    </Suspense>
  );
}
