import { Navigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Loader2 } from 'lucide-react';

export default function DashboardRouter() {
  const { role, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-[100dvh] w-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (role === 'admin' || role === 'team') {
    return <Navigate to="/admin" replace />;
  }

  return <Navigate to="/user-dashboard" replace />;
}
